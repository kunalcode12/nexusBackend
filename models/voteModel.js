const mongoose = require('mongoose');
const appError = require('../utils/appError');

const voteSchema = new mongoose.Schema(
  {
    contentId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Content',
    },
    commentId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Comment',
    },
    replyId: {
      // Added for reply votes
      type: mongoose.Schema.ObjectId,
    },
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'A vote must have some user'],
    },
    voteType: {
      type: String,
      enum: ['upvote', 'downvote'],
      required: true,
    },
    flagged: {
      type: Number,
      default: 0,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// voteSchema.pre('save', function (next) {
//   if (!this.commentId && !this.contentId) {
//     next(
//       new appError(
//         'A vote must be associated with content, a comment, or a reply.',
//         400
//       )
//     );
//   }
//   if (this.commentId && this.contentId) {
//     next(
//       new appError(
//         'A vote cannot be associated with both content and a comment.',
//         400
//       )
//     );
//   }

//   next();
// });

voteSchema.pre('save', function (next) {
  // We actually want both commentId and replyId for reply votes
  if (!this.commentId && !this.contentId && !this.replyId) {
    return next(
      new appError(
        'A vote must be associated with content, a comment, or a reply.',
        400
      )
    );
  }

  // For reply votes, we need both commentId and replyId
  if (this.replyId && !this.commentId) {
    return next(
      new appError('A reply vote must have both commentId and replyId.', 400)
    );
  }

  // Cannot have contentId with either commentId or replyId
  if (this.contentId && (this.commentId || this.replyId)) {
    return next(
      new appError(
        'Content votes cannot be combined with comment or reply votes.',
        400
      )
    );
  }

  next();
});

const Vote = mongoose.model('Vote', voteSchema);
module.exports = Vote;
