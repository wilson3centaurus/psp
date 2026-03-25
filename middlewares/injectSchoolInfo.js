const { supabase } = require('../config/db');

/**
 * Middleware to inject school information (logo, display_name)
 * into res.locals for all school-related pages
 */
const injectSchoolInfo = async (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'school') {
    const { data } = await supabase
      .from('users')
      .select('display_name, logo')
      .eq('id', req.session.user.id)
      .maybeSingle();

    if (data) {
      res.locals.schoolDisplayName = data.display_name;
      res.locals.schoolLogo = data.logo;
    }
  }
  next();
};

module.exports = injectSchoolInfo;

