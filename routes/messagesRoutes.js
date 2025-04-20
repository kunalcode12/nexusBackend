const express = require('express');
const messageController = require('../controllers/messageController');
const authController = require('../controllers/authController');
const multer = require('multer');

const upload = multer({ dest: 'uploads/files' });

const router = express.Router();
router.use(authController.protect);

router.route('/get-messages').post(messageController.getMessages);
router.post(
  '/upload-file',
  upload.single('file'),
  messageController.uploadFile
);

module.exports = router;
