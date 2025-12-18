const express = require('express');
const router = express.Router();
const multer = require('multer');

const isAuthenticated = require('../middlewares/isAuthenticated');
const { isSchool } = require('../middlewares/roleChecker');

const studentAttendanceController = require('../controllers/studentAttendanceController');

// CSV Upload Config
const upload = multer({ dest: 'uploads/' });

/* ============================================================
   STUDENT ATTENDANCE ROUTES
============================================================ */

// 1. List all attendance sessions (dates)
router.get(
  '/',
  isAuthenticated,
  isSchool,
  studentAttendanceController.listSessions
);

// 2. Mark attendance (grade → class → date → students)
router.get(
  '/mark',
  isAuthenticated,
  isSchool,
  studentAttendanceController.markAttendancePage
);

// 3. Submit manual attendance
router.post(
  '/mark',
  isAuthenticated,
  isSchool,
  studentAttendanceController.submitAttendance
);

// 4. Upload CSV attendance
router.post(
  '/upload-csv',
  isAuthenticated,
  isSchool,
  upload.single('csv'),
  studentAttendanceController.uploadCSV
);

// 5. View specific attendance by date
router.get(
  '/view/:date',
  isAuthenticated,
  isSchool,
  studentAttendanceController.viewSession
);

module.exports = router;
