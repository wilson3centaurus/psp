const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middlewares/isAuthenticated');
const { isAdmin } = require('../middlewares/roleChecker');
const analyticsController = require('../controllers/analyticsController');


router.get('/analytics', isAuthenticated, isAdmin, analyticsController.analyticsPage);


module.exports = router;