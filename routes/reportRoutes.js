// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middlewares/isAuthenticated');
const { isAdmin } = require('../middlewares/roleChecker');
const reportController = require('../controllers/reportController');

router.get('/admin/export/excel', isAuthenticated, isAdmin, reportController.exportExcel);
router.get('/admin/export/pdf', isAuthenticated, isAdmin, reportController.exportPDF);

module.exports = router;

