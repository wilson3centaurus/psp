const express = require('express');
const router = express.Router();

const isAuthenticated = require('../../middlewares/isAuthenticated');
const { isAdmin } = require('../../middlewares/roleChecker');
const teacherController = require('../../controllers/admin/teacherController');

// View all teachers (read-only)
router.get('/', isAuthenticated, isAdmin, teacherController.listTeachers);

// Export
router.get('/export/csv', isAuthenticated, isAdmin, teacherController.exportCSV);
router.get('/export/pdf', isAuthenticated, isAdmin, teacherController.exportPDF);

module.exports = router;
