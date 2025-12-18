const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middlewares/isAuthenticated');
const { isAdmin } = require('../middlewares/roleChecker');


router.get('/dashboard', isAuthenticated, isAdmin, (req, res) => {
res.render('admin/dashboard', { user: req.session.user });
});


module.exports = router;