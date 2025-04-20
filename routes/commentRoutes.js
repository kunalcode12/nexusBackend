const express = require('express');
const authController = require('../controllers/authController');
const commentController = require('../controllers/commentController');

const router = express.Router();

router.use(authController.protect);
router.route('/:contentId/createComment').post(commentController.createComment);
// router
//   .route('/getComments/:contentId')
//   .get(commentController.getCommentsWithReplies);

router.route('/getComments/:contentId').get(commentController.getAllComments);
router.route('/reply/:commentId').patch(commentController.addReplyToComment);
router
  .route('/:commentId/reply/:replyId')
  .delete(commentController.deleteReplyComment);

router
  .route('/getComment/:commentId')
  .get(commentController.getComments)
  .delete(commentController.deleteComment);

module.exports = router;
