const express = require('express');
const authController = require('../controllers/authController');
const contentController = require('../controllers/contentController');

const router = express.Router();

router
  .route('/')
  //.get(contentController.getAllContent)
  .get(contentController.contentDiscovery);

router.use(authController.protect);

router.route('/category').get(contentController.contentCategory);
router.route('/my-content/:id').get(contentController.getUserContent);

router.route('/trending').get(contentController.contentDiscovery);

router.route('/deleteContent/:id').delete(contentController.deleteContent);

router
  .route('/')
  //.get(contentController.getAllContent)
  //.get(contentController.contentDiscovery)
  .post(contentController.CreateContent)
  .patch(contentController.updateContent);

router
  .route('/:id')
  .get(contentController.getContent)
  .patch(authController.restrictTo('user'), contentController.updateContent);

module.exports = router;
