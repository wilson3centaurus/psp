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
  const { username, password, role, accessCode, display_name, email, phone, address } = req.body;

  console.log('User registration attempt:', { username, role });

  // Access code check
  if (accessCode !== ACCESS_CODE) {
    return res.render('admin/itadmin_register', {
      error: 'Invalid access code',
      success: null
    });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  // If creating a school, include display_name, email, phone, address
  const sql = 'INSERT INTO users (username, password, role, display_name, email, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?)';
  const params = [
    username, 
    hashedPassword, 
    role,
    (role === 'school' && display_name) ? display_name : null,
    (role === 'school' && email) ? email : null,
    (role === 'school' && phone) ? phone : null,
    (role === 'school' && address) ? address : null
  ];

  db.query(sql, params, (err) => {
      if (err) {
        console.error('DB insert error:', err);
        return res.render('admin/itadmin_register', {
          error: 'Database error or duplicate username',
          success: null
        });
      }

      return res.render('admin/itadmin_register', {
        error: null,
        success: `${role === 'school' ? 'School' : 'Admin'} account "${username}" created successfully!`
      });
    }
  );
};
