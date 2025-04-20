const { Server } = require('socket.io');
const Message = require('./models/messagesModel');
const Channel = require('./models/channelModel');

const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  const userSocketMap = new Map();

  const disconnect = (socket) => {
    console.log(`Client Disconnected: ${socket.id}`);
    for (const [userId, socketId] of userSocketMap.entries()) {
      if (socketId === socket.id) {
        userSocketMap.delete(userId);
        break;
      }
    }
  };

  const sendMessage = async (message) => {
    try {
      const createdMessage = await Message.create(message);
      const messageData = await Message.findById(createdMessage._id)
        .populate('senders', 'id email name profilePicture')
        .populate('recipient', 'id email name profilePicture');

      const senderSocketId = userSocketMap.get(message.senders);
      const recipientSocketId = userSocketMap.get(message.recipient);

      console.log('Sender Socket ID:', senderSocketId);
      console.log('Recipient Socket ID:', recipientSocketId);

      if (recipientSocketId) {
        io.to(recipientSocketId).emit('recieveMessage', messageData);
      }

      if (senderSocketId) {
        io.to(senderSocketId).emit('recieveMessage', messageData);
      }

      // return messageData;
    } catch (error) {
      console.error('Error in sendMessage:', error);
      throw error;
    }
  };

  const sendChannelMessage = async (message) => {
    console.log('Messages:', message);
    const { channelId, senders, content, messageType, fileUrl } = message;

    const createdMessage = await Message.create({
      senders: senders,
      recipient: null,
      content: content,
      messageType: messageType,
      timestamp: new Date(),
      fileUrl: fileUrl,
    });

    const messageData = await Message.findById(createdMessage._id)
      .populate('senders', 'id name profilePicture')
      .exec();

    await Channel.findByIdAndUpdate(channelId, {
      $push: { messages: createdMessage._id },
    });

    const channel = await Channel.findById(channelId).populate('members');

    const finalData = { ...messageData._doc, channelId: channel._id };

    if (channel && channel.members) {
      channel.members.forEach((member) => {
        const memberScoketId = userSocketMap.get(member._id.toString());
        if (memberScoketId) {
          io.to(memberScoketId).emit('recieve-channel-message', finalData);
        }
      });
      const adminSocketId = userSocketMap.get(channel.admin._id.toString());
      if (adminSocketId) {
        io.to(adminSocketId).emit('recieve-channel-message', finalData);
      }
    }
  };

  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;

    if (userId) {
      userSocketMap.set(userId, socket.id);
      console.log(`User connected: ${userId} with socket ID: ${socket.id}`);
    } else {
      console.log('User Id not provided during connection.');
    }

    socket.on('sendMessage', sendMessage);
    socket.on('send-channel-message', sendChannelMessage);
    socket.on('disconnect', () => disconnect(socket));
  });
};

module.exports = setupSocket;
