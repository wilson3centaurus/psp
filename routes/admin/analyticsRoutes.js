const express = require('express');
const router = express.Router();

const isAuthenticated = require('../../middlewares/isAuthenticated');
const { isAdmin } = require('../../middlewares/roleChecker');
const analyticsController = require('../../controllers/admin/analyticsController');

// Admin analytics dashboard
router.get('/', isAuthenticated, isAdmin, analyticsController.index);

module.exports = router;
