const Vote = require('../models/voteModel');
const Content = require('../models/contentModel');
const Comment = require('../models/commentModel');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const appError = require('../utils/appError');

exports.getVoteContent = catchAsync(async (req, res, next) => {
  const { contentId } = req.query;
  const result = await Vote.find({ contentId: contentId }).populate({
    path: 'userId',
  });
  res.status(200).json({
    status: 'success',
    data: result,
  });
});

exports.getUserUpvotedContent = catchAsync(async (req, res, next) => {
  // Get all upvotes by the user
  if (!req.params.userId) {
    req.params.userId = req.user.id;
  }

  const userVotes = await Vote.find({
    userId: req.params.userId,
    voteType: 'upvote',
    contentId: { $exists: true }, // Only get content votes, not comment votes
  });

  // Extract content IDs from votes
  const contentIds = userVotes.map((vote) => vote.contentId);

  // If no upvoted content found
  if (!contentIds.length) {
    return res.status(200).json({
      status: 'success',
      results: 0,
      data: {
        content: [],
      },
    });
  }

  res.status(200).json({
    status: 'success',
    results: contentIds.length,
    data: {
      content: contentIds,
    },
  });
});

exports.getAlltheVote = catchAsync(async (req, res, next) => {
  const result = await Vote.find(req.query).populate({ path: 'userId' });
  res.status(200).json({
    status: 'success',
    data: result,
  });
});

exports.createVote = catchAsync(async (req, res, next) => {
  if (!req.body.userId) {
    req.body.userId = req.user.id;
  }
  if (!req.body.contentId) {
    req.body.contentId = req.params.contentId;
  }
  const { contentId, userId, voteType, flagged } = req.body;

  const existingLike = await Vote.findOne({ contentId, userId });

  if (!existingLike) {
    const vote = await Vote.create(req.body);

    const voteField = voteType === 'upvote' ? { upVote: 1 } : { downVote: 1 };

    await Content.findByIdAndUpdate(
      contentId,
      { $inc: voteField },
      { new: true }
    );
    return res.status(201).json({
      status: 'success',
      data: {
        message: 'upvote added successfull',
        data: vote,
      },
    });
  } else {
    const vote = await Vote.findByIdAndDelete(existingLike._id);
    const voteField = voteType === 'upvote' ? { upVote: -1 } : { downVote: -1 };

    await Content.findByIdAndUpdate(
      contentId,
      { $inc: voteField },
      { new: true }
    );
    return res.status(201).json({
      status: 'success',
      data: {
        message: 'upvote removed successfull',
        data: vote,
      },
    });
  }
});

exports.createVoteOnComment = catchAsync(async (req, res, next) => {
  if (!req.body.userId) {
    req.body.userId = req.user.id;
  }
  if (!req.body.commentId) {
    req.body.commentId = req.params.commentId;
  }
  const { userId, commentId, flagged } = req.body;

  const existingLike = await Vote.findOne({ commentId, userId });
  if (!existingLike) {
    const vote = await Vote.create(req.body);

    const d1 = await Comment.findByIdAndUpdate(
      commentId,
      { $inc: { upVote: 1 } },
      { new: true }
    );
    return res.status(201).json({
      status: 'success',
      data: {
        message: 'upvote added successfull',
        data: vote,
      },
    });
  } else {
    const vote = await Vote.findByIdAndDelete(existingLike._id);

    await Comment.findByIdAndUpdate(
      commentId,
      { $inc: { upVote: -1 } },
      { new: true }
    );
    return res.status(201).json({
      status: 'success',
      data: {
        message: 'upvote removed successfull',
        data: vote,
      },
    });
  }
});

exports.getUserCommentAndReplyVotes = async (req, res) => {
  try {
    const { userId } = req.params;

    const commentVotes = await Vote.find({
      userId,
      commentId: { $exists: true },
      replyId: { $exists: false },
    })
      .select('commentId voteType userId')
      .populate('commentId', 'contentId');

    const replyVotes = await Vote.find({
      userId,
      commentId: { $exists: true },
      replyId: { $exists: true },
    }).select('commentId replyId voteType userId');

    const result = {
      commentVotes: commentVotes.map((vote) => ({
        commentId: vote.commentId,
        voteType: vote.voteType,
        userId: vote.userId,
      })),
      replyVotes: replyVotes.map((vote) => ({
        replyId: vote.replyId,
        voteType: vote.voteType,
        userId: vote.userId,
      })),
    };

    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      status: 'fail',
      message: error.message,
    });
  }
};

exports.createVoteOnReply = catchAsync(async (req, res, next) => {
  if (!req.body.userId) {
    req.body.userId = req.user.id;
  }

  const commentId = req.params.commentId;
  const replyId = req.params.replyId;
  const userId = req.body.userId;

  // First verify the reply exists
  const comment = await Comment.findOne({
    _id: commentId,
    'replies._id': replyId,
  });

  if (!comment) {
    return next(new appError('Reply not found', 404));
  }

  // Find if user has already voted on this reply
  const existingVote = await Vote.findOne({
    commentId,
    replyId,
    userId,
  });

  if (!existingVote) {
    // Create new vote
    const vote = await Vote.create({
      commentId, // Include both commentId and replyId
      replyId,
      userId,
      voteType: 'upvote',
    });

    // Update the reply's upvote count
    await Comment.findOneAndUpdate(
      {
        _id: commentId,
        'replies._id': replyId,
      },
      {
        $inc: { 'replies.$.upVoteReply': 1 },
      },
      { new: true }
    );

    return res.status(201).json({
      status: 'success',
      data: {
        message: 'upvote added successfully',
        data: vote,
      },
    });
  } else {
    // Remove existing vote
    const vote = await Vote.findByIdAndDelete(existingVote._id);

    // Decrease the reply's upvote count
    await Comment.findOneAndUpdate(
      {
        _id: commentId,
        'replies._id': replyId,
      },
      {
        $inc: { 'replies.$.upVoteReply': -1 },
      },
      { new: true }
    );

    return res.status(201).json({
      status: 'success',
      data: {
        message: 'upvote removed successfully',
        data: vote,
      },
    });
  }
});
