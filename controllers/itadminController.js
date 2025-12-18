// controllers/itadminController.js
require('dotenv').config();
const db = require('../config/db');
const bcrypt = require('bcryptjs');

// Load access code from .env
const ACCESS_CODE = process.env.ITADMIN_SECRET;

exports.showRegisterPage = (req, res) => {
  // Always define error and success to prevent EJS crashes
  res.render('admin/itadmin_register', { error: null, success: null });
};

exports.registerUser = (req, res) => {
  const { username, password, role, accessCode } = req.body;

  console.log('User registration attempt:', { username, role });

  // Access code check
  if (accessCode !== ACCESS_CODE) {
    return res.render('admin/itadmin_register', {
      error: 'Invalid access code',
      success: null
    });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.query(
    'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
    [username, hashedPassword, role],
    (err) => {
      if (err) {
        console.error('DB insert error:', err);
        return res.render('admin/itadmin_register', {
          error: 'Database error or duplicate username',
          success: null
        });
      }

      return res.render('admin/itadmin_register', {
        error: null,
        success: 'User registered successfully'
      });
    }
  );
};
