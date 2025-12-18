const express = require('express');
const router = express.Router();
const multer = require('multer');

const { isSchool } = require('../middlewares/roleChecker');
const isAuthenticated = require('../middlewares/isAuthenticated');
const resourceController = require('../controllers/resourceController');

// Multer setup for CSV uploads
const upload = multer({ dest: 'uploads/' });

// View all resources
router.get('/', isAuthenticated, isSchool, resourceController.listResources);

// Add new resource
router.get('/add', isAuthenticated, isSchool, resourceController.addResourcePage);
router.post('/add', isAuthenticated, isSchool, resourceController.addResource);

// Edit existing resource
router.get('/edit/:id', isAuthenticated, isSchool, resourceController.editResourcePage);
router.post('/edit/:id', isAuthenticated, isSchool, resourceController.editResource);

// Upload resources via CSV
router.post('/upload-csv', isAuthenticated, isSchool, upload.single('csv'), resourceController.uploadCSV);

// Delete resource
router.post('/delete/:id', isAuthenticated, isSchool, resourceController.deleteResource);

module.exports = router;
