const express = require('express');
const router = express.Router();

const isAuthenticated = require('../../middlewares/isAuthenticated');
const { isAdmin } = require('../../middlewares/roleChecker');
const resourceController = require('../../controllers/admin/resourceController');

// Read-only grouped resources view
router.get('/', isAuthenticated, isAdmin, resourceController.listResources);

module.exports = router;
