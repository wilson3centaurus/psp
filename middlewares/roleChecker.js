// middlewares/roleChecker.js
exports.isSchool = function (req, res, next) {
  if (req.session.user && req.session.user.role === 'school') {
    return next();
  }
  res.redirect('/login');
};

exports.isAdmin = function (req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  res.redirect('/login');
};
