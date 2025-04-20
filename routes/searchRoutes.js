const express = require('express');
const searchController = require('../controllers/searchController');

const router = express.Router();

router.get('/search', searchController.searchAll);
router.get('/search/users', searchController.searchUsers);
router.get('/search/contents', searchController.searchContents);
router.get('/search/suggestions', searchController.getSearchSuggestions);

module.exports = router;
