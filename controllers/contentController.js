const Content = require('../models/contentModel');
const catchAsync = require('../utils/catchAsync');
const User = require('../models/userModel');
const appError = require('../utils/appError');
const mongoose = require('mongoose');

exports.CreateContent = catchAsync(async (req, res, next) => {
  if (!req.body.user) req.body.user = req.user.id;
  const { upVote, downVote, flagged, ...updates } = req.body;
  const content = await Content.create(updates);

  res.status(201).json({
    status: 'success',
    data: {
      data: content,
    },
  });
});

exports.getAllContent = catchAsync(async (req, res, next) => {
  // const content = await Content.find(req.query);
  // res.status(201).json({
  //   status: 'success',
  //   result: content.length,
  //   data: {
  //     data: content,
  //   },
  // });
});

exports.getUserContent = catchAsync(async (req, res, next) => {
  // Prepare query object
  const queryObj = { ...req.query };
  const excludedFields = ['page', 'sort', 'limit', 'fields'];
  excludedFields.forEach((el) => delete queryObj[el]);

  const userId = req.params.id;

  // Find the user
  const user = await User.findById(userId);
  if (!user) {
    return next(new appError('No user found', 404));
  }

  const userData = {
    Id: user._id.toString(),
    name: user.name,
    email: user.email,
    profilePicture: user.profilePicture,
  };

  // Prepare base query for user's own contents
  let baseQuery = Content.find({ user: userId });

  // Optional filtering
  if (Object.keys(queryObj).length) {
    const queryStr = JSON.stringify(queryObj).replace(
      /\b(gte|gt|lte|lt)\b/g,
      (match) => `$${match}`
    );
    baseQuery = baseQuery.find(JSON.parse(queryStr));
  }

  // Sorting
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    baseQuery = baseQuery.sort(sortBy);
  } else {
    // Default sorting by most recently created
    baseQuery = baseQuery.sort('-createdAt');
  }

  // Field limiting (if specified)
  if (req.query.fields) {
    const fields = req.query.fields.split(',').join(' ');
    baseQuery = baseQuery.select(fields);
  }

  // Pagination
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 10;
  const skip = (page - 1) * limit;

  // Count total documents for pagination
  const totalDocuments = await baseQuery.clone().countDocuments();
  const totalPages = Math.ceil(totalDocuments / limit);

  // Apply pagination to user's contents
  const contents = await baseQuery.skip(skip).limit(limit).populate({
    path: 'user',
    select: 'name profilePicture', // Only select necessary user details
  });

  // Fetch bookmarked contents
  const bookmarkedContents = await Promise.all(
    user.bookmarkedCont.map(async (bookmark) => {
      return await Content.findById(bookmark.content).populate({
        path: 'user',
        select: 'name profilePicture',
      });
    })
  );

  res.status(200).json({
    status: 'success',
    results: contents.length,
    data: {
      userData,
      contents,
      bookmarkedContents,
      pagination: {
        currentPage: page,
        totalPages,
        totalDocuments,
        documentsPerPage: limit,
      },
      stats: {
        totalContents: totalDocuments,
        totalBookmarkedContents: bookmarkedContents.length,
      },
    },
  });
});

exports.contentDiscovery = catchAsync(async (req, res, next) => {
  const search = req.query.search;
  const categoriesQuery = req.query.categories; // Now accepts multiple categories

  const queryObj = { ...req.query };
  const excludedField = [
    'page',
    'sort',
    'limit',
    'field',
    'categories',
    'search',
  ];
  excludedField.forEach((el) => delete queryObj[el]);

  let baseQuery = Content.find(JSON.parse(JSON.stringify(queryObj)));

  // Multiple Category filtering
  if (categoriesQuery) {
    // Support both comma-separated string and array of categories
    const categoriesArray = Array.isArray(categoriesQuery)
      ? categoriesQuery
      : categoriesQuery.split(',').map((category) => category.trim());

    // Find contents where category is in the provided categories
    baseQuery = baseQuery.where('category').in(categoriesArray);
  }

  // Search functionality
  if (search) {
    baseQuery = baseQuery.find({
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ],
    });
  }

  // Count total documents for pagination (after applying category and search filters)
  const totalDocuments = await baseQuery.clone().countDocuments();

  // Sorting
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    baseQuery = baseQuery.sort(sortBy);
  } else {
    // Use aggregation pipeline for random sorting when no sort parameter is provided
    baseQuery = Content.aggregate([
      // First, apply all the existing filters
      {
        $match: baseQuery._conditions,
      },
      // Then add random sorting
      { $sample: { size: totalDocuments } },
    ]);
  }

  // Pagination
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 10; // Default to 10 items per page
  const skip = (page - 1) * limit;

  // Calculate total pages
  const totalPages = Math.ceil(totalDocuments / limit);

  // Apply pagination
  let query = req.query.sort
    ? baseQuery.skip(skip).limit(limit)
    : baseQuery.skip(skip).limit(limit);

  // Populate user details
  const contents = req.query.sort
    ? await query.populate('user')
    : await Content.populate(await query, { path: 'user' });

  res.status(200).json({
    status: 'success',
    results: contents.length,
    data: {
      data: contents,
      totalPages: totalPages,
      currentPage: page,
      totalDocuments: totalDocuments,
      categories: categoriesQuery
        ? Array.isArray(categoriesQuery)
          ? categoriesQuery
          : categoriesQuery.split(',').map((category) => category.trim())
        : [],
    },
  });
});

exports.trendingContent = catchAsync(async (req, res, next) => {
  req.query.sort = '-upVote';
  req.query.limit = '10';
  next();
});

exports.getContent = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const content = await Content.findById(id).populate({
    path: 'user',
    select: 'name email profilePicture',
  });

  if (!content) {
    return next(new appError('No content found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      content,
    },
  });
});

exports.contentCategory = catchAsync(async (req, res, next) => {
  const content = await Content.find()
    .where('category')
    .equals(req.query.category);

  res.status(200).json({
    status: 'success',
    results: content.length,
    data: {
      data: content,
    },
  });
});

exports.getFlaggedContent = catchAsync(async (req, res, next) => {});

exports.updateContent = catchAsync(async (req, res, next) => {
  const content = await Content.findById(req.params.id);

  if (!content.isOwnedBy(req.user.id)) {
    next(
      new appError('You do not have permission to update this content', 403)
    );
  }
  if (!content) {
    next(new appError('No content found with that ID', 404));
  }

  const { upVote, downVote, flagged, ...updates } = req.body;
  const update = await Content.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!update) {
    next(new appError('No content found with that ID', 404));
  }

  res.status(201).json({
    status: 'success',
    data: {
      data: update,
    },
  });
});

exports.deleteContent = catchAsync(async (req, res, next) => {
  const content = await Content.findById(req.params.id);

  if (!content.isOwnedBy(req.user.id)) {
    next(
      new appError('You do not have permission to update this content', 403)
    );
  }
  if (!content) {
    next(new appError('No content found with that ID', 404));
  }
  const deleteContent = await Content.findByIdAndDelete(req.params.id);
  res.status(201).json({
    status: 'success',
    message: 'Content deleted successfully',
  });
});
