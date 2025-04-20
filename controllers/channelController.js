const { default: mongoose } = require('mongoose');
const Channel = require('../models/channelModel');
const Message = require('../models/channelModel');
const User = require('../models/userModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

exports.createChannel = catchAsync(async (req, res, next) => {
  try {
    const { name, members } = req.body;
    const userId = req.user.id;

    const admin = await User.findById(userId);
    if (!admin) {
      next(new AppError('Admin User not found', 400));
    }

    const validMembers = await User.find({ _id: { $in: members } });

    if (validMembers.length !== members.length) {
      next(new AppError('Some members are not valid users.', 400));
    }

    const newChannel = new Channel({
      name,
      members,
      admin: userId,
    });

    await newChannel.save();

    res.status(201).json({
      Channel: newChannel,
    });
  } catch (error) {
    console.log({ error });
    next(new AppError('Internal Server Error', 500));
  }
});

exports.getUserChannel = catchAsync(async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const channels = await Channel.find({
      $or: [{ admin: userId }, { members: userId }],
    }).sort({ updatedAt: -1 });

    res.status(201).json({
      channels,
    });
  } catch (error) {
    console.log({ error });
    next(new AppError('Internal Server Error', 500));
  }
});

exports.getChannelMessages = catchAsync(async (req, res, next) => {
  try {
    const { channelId } = req.params;

    const channel = await Channel.findById(channelId).populate({
      path: 'messages',
      populate: { path: 'senders', select: 'name _id profilePicture' },
    });

    if (!channel) {
      next(new AppError('Channel not found', 404));
    }

    const messages = channel.messages;

    res.status(201).json({
      messages,
    });
  } catch (error) {
    console.log({ error });
    next(new AppError('Internal Server Error', 500));
  }
});
