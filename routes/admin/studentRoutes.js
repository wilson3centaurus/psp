const express = require('express');
const router = express.Router();

const isAuthenticated = require('../../middlewares/isAuthenticated');
const { isAdmin } = require('../../middlewares/roleChecker');
const studentController = require('../../controllers/admin/studentController');

// View all students (read-only)
router.get('/', isAuthenticated, isAdmin, studentController.listStudents);

// Exports
router.get('/export/csv', isAuthenticated, isAdmin, studentController.exportCSV);
router.get('/export/pdf', isAuthenticated, isAdmin, studentController.exportPDF);

module.exports = router;
