const express = require('express');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const router = express.Router();
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post('/signup', authController.signUp);
router.post('/signin', authController.signin);

router.post('/forgotPassword', authController.forgetPassword);
router.patch('/resetPassword/:token', authController.resetPassword);

router.use(authController.protect);

router.patch('/updateMyPassword', authController.updatePassword);
router.route('/get-contacts-for-dm').get(userController.getContactForDMList);
router.route('/get-all-contacts').get(userController.getAllContact);

router
  .route('/profilePicture')
  .post(upload.single('profilePicture'), userController.createProfilePicture)
  .patch(upload.single('file'), userController.updateProfilePicture)
  .delete(userController.deleteProfilePicture);

router
  .route('/:userId/followersAndFollowAndUnfollow')
  .get(userController.getFollowers)
  .post(userController.followUser);

router.route('/:userId/unfollow').delete(userController.unfollowUser);

router.route('/:userId/following').get(userController.getFollowing);
router.route('/:userid/follower-stats').get(userController.getFollowerStats);

router
  .route('/bookmark/:contentId')
  .post(userController.addBookmarks)
  .delete(userController.removeBookmarks);

router.route('/searchUser').get(userController.searchuser);

router.get('/me', userController.getMe, userController.getMeUser);
router.patch('/updateMe', userController.updateMe);
router.delete('/deleteMe', userController.deleteMe);

router.route('/:id').get(userController.getUser);
router.use(authController.restrictTo('admin'));
router.route('/').get(userController.getAllUser);

module.exports = router;
