// controllers/itadminController.js
require('dotenv').config();
const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');

const ACCESS_CODE = process.env.ITADMIN_SECRET;

exports.showRegisterPage = (req, res) => {
  res.render('admin/itadmin_register', { error: null, success: null });
};

exports.registerUser = async (req, res) => {
  const { username, password, role, accessCode, display_name, email, phone, address } = req.body;

  if (accessCode !== ACCESS_CODE) {
    return res.render('admin/itadmin_register', { error: 'Invalid access code', success: null });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const isSchool = role === 'school';

  console.log('[REGISTER] Attempting insert for username:', username, 'role:', role);

  try {
    await pool.query(
      'INSERT INTO users (username, password, role, display_name, email, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        username,
        hashedPassword,
        role,
        isSchool && display_name ? display_name : null,
        isSchool && email ? email : null,
        isSchool && phone ? phone : null,
        isSchool && address ? address : null
      ]
    );
    return res.render('admin/itadmin_register', {
      error: null,
      success: `${isSchool ? 'School' : 'Admin'} account "${username}" created successfully!`
    });
  } catch (err) {
    console.error('[REGISTER] DB insert error:', err);
    return res.render('admin/itadmin_register', {
      error: 'Database error or duplicate username',
      success: null
    });
  }
};

