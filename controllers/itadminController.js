// controllers/itadminController.js
require('dotenv').config();
const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const v = require('../utils/validate');

const ACCESS_CODE = process.env.ITADMIN_SECRET;

exports.showRegisterPage = (req, res) => {
  res.render('admin/itadmin_register', { error: null, success: null });
};

exports.registerUser = async (req, res) => {
  const { username, password, role, accessCode, display_name, email, phone, address } = req.body;

  // 1. Access code first (fail fast, don't leak info about other checks)
  if (!accessCode || accessCode !== ACCESS_CODE) {
    return res.render('admin/itadmin_register', { error: 'Invalid access code.', success: null });
  }

  // 2. Validate username
  const usernameCheck = v.validateUsername(username);
  if (!usernameCheck.valid) {
    return res.render('admin/itadmin_register', { error: usernameCheck.message, success: null });
  }

  // 3. Validate password strength
  const pwCheck = v.validatePassword(password);
  if (!pwCheck.valid) {
    return res.render('admin/itadmin_register', { error: pwCheck.message, success: null });
  }

  // 4. Validate role
  const roleCheck = v.validateRole(role);
  if (!roleCheck.valid) {
    return res.render('admin/itadmin_register', { error: roleCheck.message, success: null });
  }

  const isSchool = role === 'school';

  // 5. Validate school-specific fields if role = school
  if (isSchool) {
    if (display_name && display_name.trim().length < 2) {
      return res.render('admin/itadmin_register', { error: 'School display name must be at least 2 characters.', success: null });
    }
    if (email && email.trim()) {
      const emailCheck = v.validateEmail(email, 'Email', false);
      if (!emailCheck.valid) {
        return res.render('admin/itadmin_register', { error: emailCheck.message, success: null });
      }
    }
    if (phone && phone.trim()) {
      const phoneCheck = v.validatePhone(phone, 'Phone number', false);
      if (!phoneCheck.valid) {
        return res.render('admin/itadmin_register', { error: phoneCheck.message, success: null });
      }
    }
  }

  const hashedPassword = bcrypt.hashSync(password, 12);

  console.log('[REGISTER] Attempting insert for username:', username, 'role:', role);

  try {
    await pool.query(
      'INSERT INTO users (username, password, role, display_name, email, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        username.trim(),
        hashedPassword,
        role,
        isSchool && display_name ? display_name.trim() : null,
        isSchool && email ? email.trim() : null,
        isSchool && phone ? phone.trim() : null,
        isSchool && address ? address.trim() : null
      ]
    );
    return res.render('admin/itadmin_register', {
      error: null,
      success: `${isSchool ? 'School' : 'Admin'} account "${username.trim()}" created successfully!`
    });
  } catch (err) {
    console.error('[REGISTER] DB insert error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.render('admin/itadmin_register', {
        error: `Username "${username}" is already taken. Choose a different username.`,
        success: null
      });
    }
    return res.render('admin/itadmin_register', {
      error: 'A database error occurred. Please try again.',
      success: null
    });
  }
};

