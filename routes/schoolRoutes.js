const express = require('express');
const router = express.Router();

const isAuthenticated = require('../middlewares/isAuthenticated');
const { isSchool } = require('../middlewares/roleChecker');

// Redirect base /school to dashboard
router.get('/', isAuthenticated, isSchool, (req, res) => {
  res.redirect('/school/dashboard');
});

// School dashboard
router.get('/dashboard', isAuthenticated, isSchool, (req, res) => {
  res.render('school/dashboard', { user: req.session.user });
});

module.exports = router;
