const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const moderationSchema = new Schema(
  {
    contentId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Content',
      required: true,
    },
    flaggedBy: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
    flagReasons: [
      {
        type: String,
        enum: ['Inappropriate Content', 'Spam', 'Copyright Violation', 'Other'],
      },
    ],
    moderationStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
    },
    moderatedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
    moderationNotes: {
      type: String,
    },
  },
  { timestamps: true }
);

const Moderation = mongoose.model('Moderation', moderationSchema);

module.exports = Moderation;
