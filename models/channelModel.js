const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const channelSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  members: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
  ],
  admin: {
    type: mongoose.Schema.ObjectId,
    ref: 'Users',
    required: true,
  },
  messages: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'Messages',
      required: false,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now(),
  },
  updatedAt: {
    type: Date,
    default: Date.now(),
  },
});

channelSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

channelSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updatedAt: Date.now() });
  next();
});

const Channel = mongoose.model('Channels', channelSchema);

module.exports = Channel;
