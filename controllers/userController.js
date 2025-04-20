const Content = require('../models/contentModel');
const User = require('../models/userModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const uploadService = require('../services/uploadService');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { default: mongoose } = require('mongoose');
const Message = require('../models/messagesModel');

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getAllUser = catchAsync(async (req, res, next) => {
  const users = await User.find(req.query).populate({
    path: 'contents',
    select: '_id  -user',
  });
  res.status(201).json({
    status: 'success',
    data: users,
  });
});

exports.getMeUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id)
    .populate({
      path: 'contents',
      select: 'title upVote downVote description  -user ',
    })
    .populate({
      path: 'bookmarkedCont.content',
      select: 'title upVote downVote description user createdAt  url',
    });

  if (!user) {
    return next(new AppError('No user found by this ID', 404));
  }
  res.status(200).json({
    status: 'success',
    data: {
      data: user,
    },
  });
});

exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  // .populate({
  //   path: 'bookmarkedCont.content',
  //   select:
  //     'title upVote downVote description user createdAt url image video commentCount mediaId uploadId',
  // });

  if (!user) {
    return next(new AppError('No user found by this ID', 404));
  }
  res.status(200).json({
    status: 'success',
    data: {
      data: user,
    },
  });
});

exports.searchuser = catchAsync(async (req, res, next) => {
  const search = req.query.search;
  if (!search) {
    next(new AppError('Please provide the field you want to search', 403));
  }
  const result = await User.find({
    name: { $regex: search, $options: 'i' },
  }).populate({
    path: 'contents',
    select: 'title upVote downVote createdAt -user url',
  });
  if (!result) {
    next(new AppError('Could not found your query', 404));
  }
  res.status(200).json({
    status: 'success',
    data: {
      result,
    },
  });
});

exports.addBookmarks = catchAsync(async (req, res, next) => {
  if (!req.body.userId) {
    req.body.userId = req.user.id;
  }
  const id = req.body.userId;
  const contentData = req.params.contentId;

  const user = await User.findById(id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  const isBookmarked = user.bookmarkedCont.some((bookmark) => {
    return bookmark.content && bookmark.content.toString() === contentData;
  });

  if (isBookmarked) {
    return next(new AppError('This content is already bookmarked.', 400));
  }

  const updatedUser = await User.findByIdAndUpdate(
    id,
    { $push: { bookmarkedCont: { content: contentData } } },
    { new: true, runValidators: false }
  );

  if (!updatedUser) {
    return next(new AppError('Error updating user', 500));
  }

  res.status(201).json({
    status: 'success',
    data: {
      bookmarks: updatedUser.bookmarkedCont,
    },
  });
});

exports.removeBookmarks = catchAsync(async (req, res, next) => {
  const userId = req.body.userId || req.user.id;
  const contentId = req.params.contentId;

  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  const bookmarkIndex = user.bookmarkedCont.findIndex(
    (bookmark) => bookmark.content.toString() === contentId
  );
  console.log(bookmarkIndex);

  if (bookmarkIndex === -1) {
    return next(new AppError('Bookmark not found', 404));
  }

  user.bookmarkedCont.splice(bookmarkIndex, 1);

  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: 'Bookmark deleted successfully',
    data: {
      bookmarks: user.bookmarkedCont,
    },
  });
});

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
  //1)Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates .Please use /updateMyPassword',
        400
      )
    );
  }

  //as in req.body there can we many fields which user want to update but we only want to allow the user to only update name and email so we use filterObj() function to filter out the all the unnecessary details and only provide email and name
  const filteredBody = filterObj(req.body, 'name', 'email');

  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

//from this function user can delete itself means deleting account from our webapp
exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });
  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.getFollowers = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.userId)
    .populate('followers', 'name _id email')
    .select('followers');

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    results: user.followers.length,
    data: {
      followers: user.followers,
    },
  });
});

exports.getFollowing = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.userId)
    .populate('following', 'name _id email')
    .select('following');

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    results: user.following.length,
    data: {
      following: user.following,
    },
  });
});

exports.followUser = catchAsync(async (req, res, next) => {
  // Check if trying to follow self
  if (req.params.userId === req.user.id) {
    return next(new AppError('You cannot follow yourself', 400));
  }

  const userToFollow = await User.findById(req.params.userId);
  const currentUser = await User.findById(req.user.id);

  if (!userToFollow) {
    return next(new AppError('No user found with that ID', 404));
  }

  // Check if already following
  if (currentUser.isFollowing(userToFollow._id)) {
    return next(new AppError('You are already following this user', 400));
  }

  // Add to following list of current user
  await User.findByIdAndUpdate(
    req.user.id,
    { $push: { following: userToFollow._id } },
    { new: true, runValidators: true }
  );

  // Add to followers list of target user
  const updatedUserToFollow = await User.findByIdAndUpdate(
    req.params.userId,
    { $push: { followers: req.user.id } },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    message: `You are now following ${updatedUserToFollow.name}`,
    data: {
      following: updatedUserToFollow,
    },
  });
});

exports.unfollowUser = catchAsync(async (req, res, next) => {
  // Check if trying to unfollow self
  if (req.params.userId === req.user.id) {
    return next(new appError('You cannot unfollow yourself', 400));
  }

  const userToUnfollow = await User.findById(req.params.userId);
  const currentUser = await User.findById(req.user.id);

  if (!userToUnfollow) {
    return next(new AppError('No user found with that ID', 404));
  }

  // Check if actually following
  if (!currentUser.isFollowing(userToUnfollow._id)) {
    return next(new AppError('You are not following this user', 400));
  }

  // Remove from following list of current user
  await User.findByIdAndUpdate(
    req.user.id,
    { $pull: { following: userToUnfollow._id } },
    { new: true, runValidators: true }
  );

  // Remove from followers list of target user
  const updatedUserToUnfollow = await User.findByIdAndUpdate(
    req.params.userId,
    { $pull: { followers: req.user.id } },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    message: `You have unfollowed ${updatedUserToUnfollow.name}`,
    data: {
      unfollowed: updatedUserToUnfollow,
    },
  });
});

// Optional: Get follower stats
exports.getFollowerStats = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.userId).select(
    'followers following'
  );

  if (!user) {
    return next(new appError('No user found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      stats: {
        followersCount: user.followers.length,
        followingCount: user.following.length,
      },
    },
  });
});

exports.createProfilePicture = catchAsync(async (req, res, next) => {
  const file = req.file;
  console.log(file);

  // Validate input
  if (!file) {
    return next(new AppError('No image file uploaded', 400));
  }

  // Validate file type
  if (!file.mimetype.startsWith('image/')) {
    return next(new AppError('Please upload only image files', 400));
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Check if user already has a profile picture
  if (user.profilePicture) {
    return next(
      new AppError(
        'Profile picture already exists. Use update endpoint instead.',
        400
      )
    );
  }

  let tempChunkPath;

  try {
    // Create temporary file path
    tempChunkPath = path.join(
      os.tmpdir(),
      `temp_profile_${Date.now()}${path.extname(file.originalname)}`
    );

    // Write file to temporary location
    await fs.writeFile(tempChunkPath, file.buffer);

    // Preprocess the image
    const processedBuffer = await uploadService.preprocessImageChunk(
      tempChunkPath
    );

    // Clean up temporary file
    await fs.remove(tempChunkPath).catch((err) => {
      console.warn(`Could not remove temporary file: ${err.message}`);
    });

    // Upload profile picture to Cloudinary
    const result = await uploadService.uploadToCloudinary1(
      processedBuffer,
      'image'
    );

    // Update user with profile picture URL
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { profilePicture: result.secure_url },
      { new: true, runValidators: true }
    );

    res.status(201).json({
      status: 'success',
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    console.error('Profile picture creation error:', error);
    return next(new AppError('Failed to create profile picture', 500));
  }
});

exports.updateProfilePicture = catchAsync(async (req, res, next) => {
  const file = req.file;

  // Validate input
  if (!file) {
    return next(new AppError('No image file uploaded', 400));
  }

  // Validate file type
  if (!file.mimetype.startsWith('image/')) {
    return next(new AppError('Please upload only image files', 400));
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  let tempChunkPath;

  try {
    // Create temporary file path
    tempChunkPath = path.join(
      os.tmpdir(),
      `temp_profile_${Date.now()}${path.extname(file.originalname)}`
    );

    // Write file to temporary location
    await fs.writeFile(tempChunkPath, file.buffer);

    // Preprocess the image
    const processedBuffer = await uploadService.preprocessImageChunk(
      tempChunkPath
    );

    // Clean up temporary file
    await fs.remove(tempChunkPath).catch((err) => {
      console.warn(`Could not remove temporary file: ${err.message}`);
    });

    // Delete existing profile picture from Cloudinary if it exists
    if (user.profilePicture) {
      const publicId = user.profilePicture.split('/').pop().split('.')[0];
      await uploadService.deleteFromCloud(publicId, 'image');
    }

    // Upload new profile picture to Cloudinary
    const result = await uploadService.uploadToCloudinary1(
      processedBuffer,
      'image'
    );

    // Update user's profile picture URL
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { profilePicture: result.secure_url },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      status: 'success',
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    console.error('Profile picture update error:', error);
    return next(new AppError('Failed to update profile picture', 500));
  }
});

exports.deleteProfilePicture = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Check if user has a profile picture to delete
  if (!user.profilePicture) {
    return next(new AppError('No profile picture to delete', 400));
  }

  try {
    // Extract public ID from profile picture URL
    const publicId = user.profilePicture.split('/').pop().split('.')[0];

    // Delete from Cloudinary
    await uploadService.deleteFromCloud(publicId, 'image');

    // Remove profile picture URL from user document
    await User.findByIdAndUpdate(
      req.user._id,
      { $unset: { profilePicture: 1 } },
      { new: true }
    );

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    console.error('Profile picture deletion error:', error);
    return next(new AppError('Failed to delete profile picture', 500));
  }
});

exports.getContactForDMList = catchAsync(async (req, res, next) => {
  let userId = req.user.id;
  userId = new mongoose.Types.ObjectId(userId);

  if (!userId) {
    next(new AppError('Please provide the user', 404));
  }

  try {
    const contacts = await Message.aggregate([
      {
        $match: {
          $or: [{ senders: userId }, { recipient: userId }],
        },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $group: {
          _id: {
            $cond: {
              if: { $eq: ['$senders', userId] },
              then: '$recipient',
              else: '$senders',
            },
          },
          lastMessageTime: { $first: '$timestamp' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'contactInfo',
        },
      },
      {
        $unwind: '$contactInfo',
      },
      {
        $project: {
          userId: '$_id',
          _id: 0,
          lastMessageTime: 1,
          email: '$contactInfo.email',
          name: '$contactInfo.name',
          profilePicture: '$contactInfo.profilePicture',
        },
      },
      {
        $sort: { lastMessageTime: -1 },
      },
    ]);

    res.status(200).json({ contacts });
  } catch (error) {
    console.log('Error in code:', error);
  }
});

exports.getAllContact = catchAsync(async (req, res, next) => {
  try {
    // const userId = req.user.id;
    // console.log(userId);
    const users = await User.find({ _id: { $ne: req.user.id } }, 'name _id');
    const contacts = users.map((user) => ({
      label: user.name,
      value: user._id,
    }));

    res.status(200).json({ contacts });
  } catch (error) {
    console.log('Error in code:', error);
    next(new AppError('Internal Server Error', 500));
  }
});
