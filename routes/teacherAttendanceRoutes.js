const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middlewares/isAuthenticated');
const { isSchool } = require('../middlewares/roleChecker');
const teacherAttendanceController = require('../controllers/teacherAttendanceController');

// List all teacher attendance sessions
router.get('/', isAuthenticated, isSchool, teacherAttendanceController.listSessions);

// Show the mark attendance page
router.get('/mark', isAuthenticated, isSchool, teacherAttendanceController.markAttendancePage);

// Submit attendance manually
router.post('/mark', isAuthenticated, isSchool, teacherAttendanceController.submitAttendance);

// Upload attendance from CSV
router.post('/upload-csv', isAuthenticated, isSchool, teacherAttendanceController.uploadCSV);

// View attendance for a specific date
router.get('/view/:date', isAuthenticated, isSchool, teacherAttendanceController.viewSession);

module.exports = router;
