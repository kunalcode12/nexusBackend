const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const userRouter = require('./routes/userRoutes');
const contentRouter = require('./routes/contentRoutes');
const voteRouter = require('./routes/voteRoutes');
const flaggedRoutes = require('./routes/flaggedRoutes');
const commentsRouter = require('./routes/commentRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const searchRoutes = require('./routes/searchRoutes');
const messageRoutes = require('./routes/messagesRoutes');
const channelRoutes = require('./routes/channelRoutes');
const AppError = require('./utils/appError');
const app = express();
const globalErrorHandler = require('./controllers/errorController');
const cookieParser = require('cookie-parser');

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(cors());

app.use('/uploads/files', express.static('uploads/files'));

app.use(cookieParser());
app.use(express.json());

app.use('/api/v1/users', userRouter);
app.use('/api/v1/content', contentRouter);
app.use('/api/v1/votes', voteRouter);
app.use('/api/v1/flagged', flaggedRoutes);
app.use('/api/v1/comment', commentsRouter);
app.use('/api/v1/media', mediaRoutes);
app.use('/api/v1/searching', searchRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/channel', channelRoutes);

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
