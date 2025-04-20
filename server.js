const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { cleanupTempUploads } = require('./utils/fileCleanup');
const setupSocket = require('./socket');

// process.on('uncaughtException', (err) => {
//   console.log('UNCAUGHT EXCEPTION!!  Shutting down...');
//   console.log(err.name, err.message);
//   process.exit(1);
// });

dotenv.config({ path: './config.env' });

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);
mongoose.connect(DB, {}).then((con) => {
  console.log('DB connection successful');
});

const app = require('./app');

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`App Running on port ${port}`);

  cleanupTempUploads();
  setInterval(cleanupTempUploads, 12 * 60 * 60 * 1000);
});

setupSocket(server);

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION!!  Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
