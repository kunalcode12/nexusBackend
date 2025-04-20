const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'A reply must be by some user'],
  },
  commentId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Comment',
    required: true,
  },
  reply: {
    type: String,
    required: true,
  },
  upVoteReply: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const commentSchema = new mongoose.Schema(
  {
    contentId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Content',
      required: [true, 'A comment must be on some content'],
    },
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'A comment must be by some user'],
    },
    comment: {
      type: String,
      required: true,
    },
    upVote: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    replies: [replySchema],
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    timestamps: true,
  }
);

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment;
