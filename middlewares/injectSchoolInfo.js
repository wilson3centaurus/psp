const db = require('../config/db');

/**
 * Middleware to inject school information (logo, display_name) 
 * into res.locals for all school-related pages
 */
const injectSchoolInfo = (req, res, next) => {
  // Only inject for authenticated school users
  if (req.session && req.session.user && req.session.user.role === 'school') {
    const sql = 'SELECT display_name, logo FROM users WHERE id = ?';
    db.query(sql, [req.session.user.id], (err, results) => {
      if (!err && results.length > 0) {
        res.locals.schoolDisplayName = results[0].display_name;
        res.locals.schoolLogo = results[0].logo;
      }
      next();
    });
  } else {
    next();
  }
};

module.exports = injectSchoolInfo;
