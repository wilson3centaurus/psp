const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // For handling CSV file uploads

const isAuthenticated = require('../middlewares/isAuthenticated');
const { isSchool } = require('../middlewares/roleChecker');

const teacherController = require('../controllers/teacherController');

// ==========================
// Teacher Management Routes
// ==========================

// List all teachers
router.get('/', isAuthenticated, isSchool, teacherController.listTeachers);

// Add teacher (form + submit)
router.get('/add', isAuthenticated, isSchool, teacherController.addTeacherPage);
router.post('/add', isAuthenticated, isSchool, teacherController.addTeacher);

// Edit teacher (form + update)
router.get('/edit/:id', isAuthenticated, isSchool, teacherController.editTeacherPage);
router.post('/edit/:id', isAuthenticated, isSchool, teacherController.updateTeacher);

// Delete teacher
router.post('/delete/:id', isAuthenticated, isSchool, teacherController.deleteTeacher);

// Search teachers
router.get('/search', isAuthenticated, isSchool, teacherController.searchTeachers);

// ==========================
// CSV Upload Route
// ==========================
router.post('/upload-csv', isAuthenticated, isSchool, upload.single('csv'), teacherController.uploadCSV);

module.exports = router;
