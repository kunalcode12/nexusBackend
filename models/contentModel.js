const mongoose = require('mongoose');
const validator = require('validator');
const Vote = require('./voteModel');

const contentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'A content must have some title'],
    },
    url: {
      type: String,
      validate: [validator.isURL, 'Provide a valid URL'],
    },
    image: {
      type: String,
      validate: [validator.isURL, 'Provide a valid image URL'],
      required: [false, 'A content must have an image URL'],
    },
    video: {
      type: String,
      validate: [validator.isURL, 'Provide a valid video URL'],
      required: [false], // Optional if not all content has a video
    },
    description: {
      type: String,
      required: [true, 'A content must have some description'],
    },
    upVote: {
      type: Number,
      default: 0,
    },
    downVote: {
      type: Number,
      default: 0,
    },
    commentCount: {
      type: Number,
      default: 0,
    },
    flagged: {
      type: Boolean,
      default: false,
    },
    mediaId: String,
    uploadId: String,

    createdAt: {
      type: Date,
      default: Date.now(),
    },
    category: {
      type: String,
      required: [true, 'A content must have some category'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'A content must have been posted by a user'],
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

contentSchema.methods.isOwnedBy = function (userId) {
  return this.user._id.toString() === userId;
};

const Content = mongoose.model('Content', contentSchema);
module.exports = Content;
