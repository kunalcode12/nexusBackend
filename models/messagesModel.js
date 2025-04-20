const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
  senders: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },

  messageType: {
    type: String,
    enum: ['text', 'file'],
    required: true,
  },

  content: {
    type: String,
    required: function () {
      return this.messageType === 'text';
    },
  },
  fileUrl: {
    type: String,
    required: function () {
      return this.messageType === 'file';
    },
  },

  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const Message = mongoose.model('Messages', messageSchema);

module.exports = Message;
