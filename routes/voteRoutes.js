const express = require('express');
const authController = require('../controllers/authController');
const voteController = require('../controllers/voteController');

const router = express.Router();

router.use(authController.protect);

router.route('/contentVote').get(voteController.getVoteContent);

router
  .route('/commentVote/:commentId')
  .post(voteController.createVoteOnComment);

router
  .route('/comments/:commentId/replies/:replyId/vote')
  .post(voteController.createVoteOnReply);

router
  .route('/contentVote/:contentId')
  .get(voteController.getUserUpvotedContent);

// router
//   .route('/commentVoteReply/:commentId')
//   .post(voteController.createVoteOnCommentReply);

router
  .route('/userCommentVotes/:userId')
  .get(voteController.getUserCommentAndReplyVotes);

router
  .route('/')
  .get(voteController.getAlltheVote)
  .post(authController.restrictTo('user'), voteController.createVote);

router
  .route('/:id')
  .post(authController.restrictTo('user'), voteController.createVote);

module.exports = router;
