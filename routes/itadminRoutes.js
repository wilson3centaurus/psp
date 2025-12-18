// routes/itadminRoutes.js
const express = require('express');
const router = express.Router();
const itadminController = require('../controllers/itadminController');

router.get('/', itadminController.showRegisterPage);
router.post('/', itadminController.registerUser);

module.exports = router;
