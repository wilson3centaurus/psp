const { supabase } = require('../config/db');
const bcrypt = require('bcryptjs');

exports.loginPage = (req, res) => res.render('login');

exports.loginUser = async (req, res) => {
  const { username, password } = req.body;
  const safeUser = (username || '').trim();

  const { data: users } = await supabase
    .from('users')
    .select('*')
    .ilike('username', safeUser)
    .limit(1);

  if (!users || users.length === 0) {
    req.flash('error_msg', 'Invalid username or password');
    return res.redirect('/login');
  }

  const user = users[0];
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    req.flash('error_msg', 'Invalid username or password');
    return res.redirect('/login');
  }

  req.session.user = user;
  if (user.role === 'admin') return res.redirect('/admin/dashboard');
  if (user.role === 'school') return res.redirect('/school/dashboard');
  res.redirect('/login');
};

exports.logoutUser = (req, res) => req.session.destroy(() => res.redirect('/login'));

