const express = require('express');
const router = express.Router();

const isAuthenticated = require('../../middlewares/isAuthenticated');
const { isAdmin } = require('../../middlewares/roleChecker');
const reportController = require('../../controllers/admin/reportController');

// Reports landing page
router.get('/', isAuthenticated, isAdmin, reportController.index);

// Generate PDF report for a school
router.get('/generate/:schoolId', isAuthenticated, isAdmin, reportController.generate);

module.exports = router;
