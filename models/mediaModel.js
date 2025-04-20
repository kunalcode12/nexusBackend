const mongoose = require('mongoose');

const chunkSchema = new mongoose.Schema({
  index: Number,
  data: Buffer,
  size: Number,
});

const mediaSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['image', 'video'],
    required: true,
  },
  url: {
    type: String,
  },
  chunks: [
    {
      type: Buffer,
    },
  ],
  cloudinaryId: {
    type: String,
  },
  status: {
    type: String,
    enum: ['uploading', 'processing', 'completed', 'failed'],
    default: 'uploading',
  },
  uploadId: {
    type: String,
    unique: true,
  },
  chunks: [chunkSchema],
  uploadedChunks: [
    {
      chunkIndex: {
        type: Number,
        required: true,
      },
      chunkData: {
        type: Buffer,
        required: true,
      },
    },
  ],
  totalChunks: Number,

  metadata: {
    size: Number,
    format: String,
    duration: Number,
    width: Number,
    height: Number,
    contentType: String,
    filename: String,
  },
  // References to other schemas
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  originalname: String,
  finalFileUrl: String,
  cloudinaryPublicId: String,
  content: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

mediaSchema.index({ title: 'text' });
mediaSchema.index({ uploadId: 1 });
mediaSchema.index({ user: 1 });
mediaSchema.index({ content: 1 });

module.exports = mongoose.model('Media', mediaSchema);
