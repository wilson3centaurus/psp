// controllers/itadminController.js
require('dotenv').config();
const { supabase } = require('../config/db');
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

  const { error } = await supabase.from('users').insert({
    username,
    password: hashedPassword,
    role,
    display_name: isSchool && display_name ? display_name : null,
    email: isSchool && email ? email : null,
    phone: isSchool && phone ? phone : null,
    address: isSchool && address ? address : null
  });

  if (error) {
    console.error('DB insert error:', error);
    return res.render('admin/itadmin_register', {
      error: 'Database error or duplicate username',
      success: null
    });
  }

  return res.render('admin/itadmin_register', {
    error: null,
    success: `${isSchool ? 'School' : 'Admin'} account "${username}" created successfully!`
  });
};

