const Content = require('../models/contentModel');
const User = require('../models/userModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

// Helper function to clean and escape search query
const sanitizeSearchQuery = (query) => {
  return query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

exports.searchAll = catchAsync(async (req, res, next) => {
  const { query } = req.query;

  if (!query) {
    return next(new AppError('Please provide a search query', 400));
  }

  const sanitizedQuery = sanitizeSearchQuery(query);
  const searchRegex = new RegExp(sanitizedQuery, 'i');

  const [users, contents] = await Promise.all([
    User.find({
      name: { $regex: searchRegex },
    })
      .select('_id name profilePicture followers following')
      .populate('followers', '_id name')
      .populate('following', '_id name'),

    // Search contents
    Content.find({
      $or: [
        { title: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
      ],
    })
      .select('_id title description image video')
      .populate({
        path: 'user',
        select: '_id name profilePicture',
      }),
  ]);

  const results = {
    users: users.map((user) => ({
      type: 'user',
      userId: user._id,
      name: user.name,
      profilePicture: user.profilePicture,
      followersCount: user.followers.length,
      followingCount: user.following.length,
    })),
    contents: contents.map((content) => ({
      type: 'content',
      contentId: content._id,
      title: content.title,
      description: content.description,
      image: content.image || null,
      video: content.video || null,
      user: {
        userId: content.user._id,
        name: content.user.name,
        profilePicture: content.user.profilePicture,
      },
    })),
  };

  res.status(200).json({
    status: 'success',
    results: {
      total: users.length + contents.length,
      users: users.length,
      contents: contents.length,
    },
    data: results,
  });
});

exports.searchUsers = catchAsync(async (req, res, next) => {
  const { query } = req.query;

  if (!query) {
    return next(new AppError('Please provide a search query', 400));
  }

  const sanitizedQuery = sanitizeSearchQuery(query);

  const users = await User.find({
    name: { $regex: sanitizedQuery, $options: 'i' },
  })
    .select('_id name profilePicture followers following')
    .populate('followers', '_id name')
    .populate('following', '_id name')
    .limit(10);

  const formattedUsers = users.map((user) => ({
    userId: user._id,
    name: user.name,
    profilePicture: user.profilePicture,
    followersCount: user.followers.length,
    followingCount: user.following.length,
  }));

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: formattedUsers,
  });
});

exports.searchContents = catchAsync(async (req, res, next) => {
  const { query, category } = req.query;

  if (!query && !category) {
    return next(new AppError('Please provide a search query or category', 400));
  }

  const sanitizedQuery = query ? sanitizeSearchQuery(query) : '';

  const searchCriteria = {};

  if (query) {
    searchCriteria.$or = [
      { title: { $regex: sanitizedQuery, $options: 'i' } },
      { description: { $regex: sanitizedQuery, $options: 'i' } },
    ];
  }

  if (category) {
    searchCriteria.category = category;
  }

  const contents = await Content.find(searchCriteria)
    .select('_id title description image video')
    .populate({
      path: 'user',
      select: '_id name profilePicture',
    })
    .sort('-createdAt')
    .limit(20);

  const formattedContents = contents.map((content) => ({
    contentId: content._id,
    title: content.title,
    description: content.description,
    image: content.image || null,
    video: content.video || null,
    user: {
      userId: content.user._id,
      name: content.user.name,
      profilePicture: content.user.profilePicture,
    },
  }));

  res.status(200).json({
    status: 'success',
    results: contents.length,
    data: formattedContents,
  });
});

exports.getSearchSuggestions = catchAsync(async (req, res, next) => {
  const { query } = req.query;

  if (!query) {
    return next(new AppError('Please provide a search query', 400));
  }

  const sanitizedQuery = sanitizeSearchQuery(query);
  const searchRegex = new RegExp(sanitizedQuery, 'i');

  const [users, contents] = await Promise.all([
    User.find({ name: { $regex: searchRegex } })
      .select('_id name profilePicture followers following')
      .populate('followers', '_id name')
      .populate('following', '_id name')
      .limit(5),

    Content.find({
      $or: [
        { title: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
      ],
    })
      .select('_id title description image video')
      .populate({
        path: 'user',
        select: '_id name profilePicture',
      })
      .limit(5),
  ]);

  const suggestions = {
    users: users.map((user) => ({
      type: 'user',
      userId: user._id,
      name: user.name,
      profilePicture: user.profilePicture,
      followersCount: user.followers.length,
      followingCount: user.following.length,
    })),
    contents: contents.map((content) => ({
      type: 'content',
      contentId: content._id,
      title: content.title,
      description: content.description,
      image: content.image || null,
      video: content.video || null,
      user: {
        userId: content.user._id,
        name: content.user.name,
        profilePicture: content.user.profilePicture,
      },
    })),
  };

  res.status(200).json({
    status: 'success',
    data: suggestions,
  });
});
