const Moderation = require('../models/flagModel');
const catchAsync = require('../utils/catchAsync');
const appError = require('../utils/appError');
const Content = require('../models/contentModel');

exports.flagTheContent = catchAsync(async (req, res, next) => {
  if (!req.body.flaggedBy) req.body.flaggedBy = req.user.id;
  const { contentId, flaggedBy, flagReasons } = req.body;

  const existingFlag = await Moderation.findOne({ contentId });

  if (existingFlag) {
    if (existingFlag.flaggedBy.includes(flaggedBy)) {
      next(new appError('You have already flagged this content.', 400));
    } else {
      existingFlag.flaggedBy.push(flaggedBy);
      existingFlag.flagReasons.push(flagReasons);
    }
    await existingFlag.save();
    res.status(201).json({
      status: 'success',
      data: {
        data: existingFlag,
      },
    });
  }

  if (!existingFlag) {
    const flagged = await Moderation.create({
      contentId,
      flaggedBy: [flaggedBy],
      flagReasons,
    });

    res.status(201).json({
      status: 'success',
      data: {
        data: flagged,
      },
    });
  }
});

exports.getflaggedContent = catchAsync(async (req, res, next) => {
  const flaggedContent = await Moderation.find({ moderationStatus: 'Pending' })
    .populate({ path: 'contentId', select: '_id title user' })
    .populate({ path: 'flaggedBy', select: '_id name' })
    .populate('flagReasons')
    .select('id');
  if (!flaggedContent) {
    next(new appError('No content found', 401));
  }
  res.status(201).json({
    status: 'success',
    result: flaggedContent.length,
    data: {
      flaggedContent,
    },
  });
});

exports.moderatorResult = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  const moderator = await Moderation.findById(id);
  if (!moderator) {
    next(new appError('Moderation entry not found', 404));
  }
  moderator.moderationStatus = status;

  moderator.moderatedBy = req.user.id;
  moderator.moderationNotes = notes;
  await moderator.save();

  if (status === 'Approved') {
    const content = await Content.findById(moderator.contentId);
    content.flagged = true;
    await content.save();
  }

  res.status(201).json({
    status: 'success',
    data: {
      message: 'Content moderated successfully',
    },
  });
});
