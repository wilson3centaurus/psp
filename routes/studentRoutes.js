// routes/studentRoutes.js
const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middlewares/isAuthenticated');
const { isSchool } = require('../middlewares/roleChecker');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const studentController = require('../controllers/studentController');

router.get('/', isAuthenticated, isSchool, studentController.listStudents);
router.get('/add', isAuthenticated, isSchool, studentController.addStudentPage);
router.post('/add', isAuthenticated, isSchool, studentController.addStudent);
router.post('/upload', isAuthenticated, isSchool, upload.single('csv'), studentController.uploadCSV);
router.get('/search', isAuthenticated, isSchool, studentController.searchStudents);
router.get('/edit/:id', isAuthenticated, isSchool, studentController.editStudentPage);
router.post('/edit/:id', isAuthenticated, isSchool, studentController.updateStudent);
router.post('/delete/:id', isAuthenticated, isSchool, studentController.deleteStudent);

module.exports = router;