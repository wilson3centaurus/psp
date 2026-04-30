const { supabase } = require('../config/db');
const bcrypt = require('bcryptjs');

exports.loginPage = (req, res) => res.render('login');

exports.loginUser = async (req, res) => {
  const { username, password } = req.body;
  const safeUser = (username || '').trim();

  console.log('[LOGIN] Attempt for username:', safeUser);

  const { data: users, error: dbError, status, statusText } = await supabase
    .from('users')
    .select('*')
    .ilike('username', safeUser)
    .limit(1);

  console.log('[LOGIN] DB query result — status:', status, statusText);
  if (dbError) console.error('[LOGIN] DB error:', dbError);
  console.log('[LOGIN] Rows returned:', users ? users.length : 'null');

  if (!users || users.length === 0) {
    console.log('[LOGIN] No matching user found');
    req.flash('error_msg', 'Invalid username or password');
    return res.redirect('/login');
  }

  const user = users[0];
  console.log('[LOGIN] User found — id:', user.id, 'role:', user.role);

  const match = await bcrypt.compare(password, user.password);
  console.log('[LOGIN] Password match:', match);
  if (!match) {
    req.flash('error_msg', 'Invalid username or password');
    return res.redirect('/login');
  }

  req.session.user = user;
  req.session.save((err) => {
    if (err) {
      console.error('[LOGIN] Session save error:', err);
      req.flash('error_msg', 'Login failed. Please try again.');
      return res.redirect('/login');
    }
    console.log('[LOGIN] Session saved, redirecting role:', user.role);
    if (user.role === 'admin') return res.redirect('/admin/dashboard');
    if (user.role === 'school') return res.redirect('/school/dashboard');
    res.redirect('/login');
  });
};

exports.logoutUser = (req, res) => req.session.destroy(() => res.redirect('/login'));

