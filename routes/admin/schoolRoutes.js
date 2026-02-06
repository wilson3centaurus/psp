const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const isAuthenticated = require('../../middlewares/isAuthenticated');
const { isAdmin } = require('../../middlewares/roleChecker');
const schoolController = require('../../controllers/admin/schoolController');

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = 'logo_' + Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// View all schools
router.get('/', isAuthenticated, isAdmin, schoolController.viewSchools);

// Edit school page
router.get('/edit/:id', isAuthenticated, isAdmin, schoolController.editSchoolPage);

// Update school
router.post('/edit/:id', isAuthenticated, isAdmin, upload.single('logo'), schoolController.updateSchool);

// Delete school
router.post('/delete/:id', isAuthenticated, isAdmin, schoolController.deleteSchool);

// View individual school's dashboard
router.get('/dashboard/:id', isAuthenticated, isAdmin, schoolController.viewSchoolDashboard);

module.exports = router;
