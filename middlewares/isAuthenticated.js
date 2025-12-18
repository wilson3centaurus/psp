// middlewares/isAuthenticated.js
module.exports = function (req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/login');
};
