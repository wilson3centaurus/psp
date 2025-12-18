const express = require('express');
const router = express.Router();

const isAuthenticated = require('../../middlewares/isAuthenticated');
const { isAdmin } = require('../../middlewares/roleChecker');
const schoolController = require('../../controllers/admin/schoolController');

// View all schools
router.get('/', isAuthenticated, isAdmin, schoolController.viewSchools);

// Delete school
router.post('/delete/:id', isAuthenticated, isAdmin, schoolController.deleteSchool);

// View individual school's dashboard
router.get('/dashboard/:id', isAuthenticated, isAdmin, schoolController.viewSchoolDashboard);

module.exports = router;
