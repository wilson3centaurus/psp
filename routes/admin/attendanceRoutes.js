const express = require('express');
const router = express.Router();

const isAuthenticated = require('../../middlewares/isAuthenticated');
const { isAdmin } = require('../../middlewares/roleChecker');
const attendanceController = require('../../controllers/admin/attendanceController');

// Weekly attendance summary (read-only)
router.get('/', isAuthenticated, isAdmin, attendanceController.listWeeklySummary);

module.exports = router;
