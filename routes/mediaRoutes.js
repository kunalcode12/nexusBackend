const express = require('express');
const mediaController = require('../controllers/mediaController');
const authController = require('../controllers/authController');
const mediaProcessing = require('../utils/mediaProcessing');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 5MB max file size
});

const router = express.Router();

// router.route('/feed').get(mediaController.getFeed);
router.use(authController.protect);

// router.route('/user/:userId').get(mediaController.getUserMedia);
// router.route('/search').get(mediaController.searchMedia);

router.route('/initialize').post(mediaController.initializeUpload);
router.post('/chunk', upload.single('chunk'), mediaController.uploadChunk);
router.get('/status/:uploadId', mediaController.getUploadStatus);
// router.get('/stream/:id', mediaController.streamMedia);
router.put('/:id', upload.single('file'), mediaController.updateMedia);
router.delete('/:id', mediaController.deleteMedia);

module.exports = router;
