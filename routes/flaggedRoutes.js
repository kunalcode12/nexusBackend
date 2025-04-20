const express = require('express');
const authController = require('../controllers/authController');
const flagController = require('../controllers/flagController');
const router = express.Router();

router.route('/pending-content').get(flagController.getflaggedContent);
router
  .route('/moderate/:id')
  .post(
    authController.protect,
    authController.restrictTo('admin'),
    flagController.moderatorResult
  );

router.route('/').post(flagController.flagTheContent);

module.exports = router;
