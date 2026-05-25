const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');

exports.loginPage = (req, res) => res.render('login');

exports.loginUser = async (req, res) => {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';

  // Basic presence check — keep error vague to avoid user enumeration
  if (!username || !password) {
    req.flash('error_msg', 'Please enter your username and password.');
    return res.redirect('/login');
  }

  // Reject obviously oversized inputs before hitting the DB
  if (username.length > 100 || password.length > 256) {
    req.flash('error_msg', 'Invalid username or password.');
    return res.redirect('/login');
  }

  console.log('[LOGIN] Attempt for username:', username);

  try {
    const [users] = await pool.query(
      'SELECT * FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1',
      [username]
    );
    console.log('[LOGIN] Rows returned:', users.length);

    if (!users || users.length === 0) {
      console.log('[LOGIN] No matching user found');
      req.flash('error_msg', 'Invalid username or password.');
      return res.redirect('/login');
    }

    const user = users[0];
    console.log('[LOGIN] User found — id:', user.id, 'role:', user.role);

    const match = await bcrypt.compare(password, user.password);
    console.log('[LOGIN] Password match:', match);
    if (!match) {
      req.flash('error_msg', 'Invalid username or password.');
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
  } catch (err) {
    console.error('[LOGIN] DB error:', err);
    req.flash('error_msg', 'Login failed. Please try again.');
    res.redirect('/login');
  }
};

exports.logoutUser = (req, res) => req.session.destroy(() => res.redirect('/login'));

