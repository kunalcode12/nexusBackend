const Comment = require('../models/commentModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const Content = require('../models/contentModel');

exports.createComment = catchAsync(async (req, res, next) => {
  const id = req.params.contentId;
  if (!req.body.userId) {
    req.body.userId = req.user.id;
  }
  if (!id) {
    return next(new AppError('No content found with given id', 404));
  }

  const { userId, comment } = req.body;

  // Create comment
  let createComment = await Comment.create({
    contentId: id,
    userId,
    comment,
  });

  // Populate user details
  createComment = await createComment.populate({
    path: 'userId',
    select: 'name email profilePicture',
  });

  // Update comment count in Content
  await Content.findByIdAndUpdate(id, {
    $inc: { commentCount: 1 },
  });

  res.status(201).json({
    status: 'success',
    data: {
      data: createComment,
    },
  });
});

exports.getAllComments = catchAsync(async (req, res, next) => {
  if (!req.params.contentId) {
    next(new AppError('No comment found on this content id', 404));
  }
  const contents = await Comment.find({ contentId: req.params.contentId })
    .sort('-createdAt')
    .populate({
      path: 'userId',
      select: '+name +email +profilePicture +_id',
    })
    .populate({
      path: 'replies.userId',
      select: '+name +email +profilePicture +_id',
    });

  res.status(201).json({
    status: 'success',
    data: {
      data: contents,
    },
  });
});

exports.addReplyToComment = catchAsync(async (req, res, next) => {
  if (!req.params.commentId) {
    next(new AppError('Please provide valid commentId', 403));
  }
  if (!req.body.userId) {
    req.body.userId = req.user.id;
  }
  const replyData = {
    userId: req.body.userId,
    commentId: req.params.commentId,
    reply: req.body.reply,
  };
  console.log(replyData);
  const reply = await Comment.findByIdAndUpdate(
    req.params.commentId,
    {
      $push: { replies: replyData },
    },
    { new: true }
  ).populate({ path: 'replies.userId', select: 'name email profilePicture' });
  res.status(201).json({
    status: 'success',
    data: {
      reply,
    },
  });
});

exports.getComments = catchAsync(async (req, res, next) => {
  if (!req.params.commentId) {
    next(new AppError('Please provide valid commentId', 403));
  }
  const comment = await Comment.findById(req.params.commentId);
  res.status(201).json({
    status: 'success',
    data: {
      comment,
    },
  });
});

exports.deleteComment = catchAsync(async (req, res, next) => {
  const id = req.params.commentId;
  if (!req.body.userId) {
    req.body.userId = req.user.id;
  }

  if (!id) {
    return next(new AppError('Please provide the id of comment', 404));
  }

  const comment = await Comment.findById(id);

  if (!comment) {
    return next(new AppError('Please provide valid comment id', 404));
  }

  if (comment.userId.toString() === req.body.userId) {
    // If the comment has replies, mark it as deleted
    if (comment.replies.length > 0) {
      comment.isDeleted = true;
      await comment.save();

      res.status(200).json({
        status: 'success',
        data: {
          message: 'Comment marked as deleted due to existing replies',
        },
      });
    } else {
      // Delete the comment if no replies
      await Comment.findByIdAndDelete(id);

      // Decrement comment count in Content
      await Content.findByIdAndUpdate(comment.contentId, {
        $inc: { commentCount: -1 },
      });

      res.status(200).json({
        status: 'success',
        data: {
          message: 'Comment deleted successfully',
        },
      });
    }
  } else {
    res.status(405).json({
      status: 'fail',
      data: {
        message: 'You do not have permission to delete this comment',
      },
    });
  }
});

exports.deleteReplyComment = catchAsync(async (req, res, next) => {
  req.body.userId = req.body.userId || req.user.id;
  const comment_id = req.params.commentId;
  const reply_id = req.params.replyId;

  if (!comment_id || !reply_id) {
    return next(new AppError('Please provide comment and reply IDs', 403));
  }

  const comment = await Comment.findById(comment_id);

  if (!comment || !comment.replies) {
    return next(
      new AppError('No replies found or comment does not exist', 404)
    );
  }

  const replyIndex = comment.replies.findIndex(
    (el) =>
      el._id.toString() === reply_id && el.userId.toString() === req.body.userId
  );

  if (replyIndex === -1) {
    return next(
      new AppError(
        'Reply not found or you do not have permission to delete it',
        403
      )
    );
  }

  comment.replies.splice(replyIndex, 1);
  await comment.save();

  let responseMessage = 'Reply in a comment deleted successfully';
  if (comment.replies.length === 0 && comment.isDeleted) {
    await Comment.findByIdAndDelete(comment_id);

    await Content.findByIdAndUpdate(comment.contentId, {
      $inc: { commentCount: -1 },
    });

    responseMessage = 'Last reply deleted and comment removed';
  }

  res.status(200).json({
    status: 'success',
    data: {
      message: responseMessage,
    },
  });
});
