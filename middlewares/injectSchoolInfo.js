const { pool } = require('../config/db');

const injectSchoolInfo = async (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'school') {
    try {
      const [rows] = await pool.query(
        'SELECT display_name, logo FROM users WHERE id = ? LIMIT 1',
        [req.session.user.id]
      );
      if (rows.length > 0) {
        res.locals.schoolDisplayName = rows[0].display_name;
        res.locals.schoolLogo = rows[0].logo;
      }
    } catch (err) {
      console.error('[injectSchoolInfo] error:', err);
    }
  }
  next();
};

module.exports = injectSchoolInfo;

