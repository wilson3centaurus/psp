const { pool } = require('../../config/db');
const fs = require('fs');
const path = require('path');

async function getUserColumns() {
  const [rows] = await pool.query('SHOW COLUMNS FROM users');
  return new Set(rows.map((r) => r.Field));
}

function optionalSelect(columns, name) {
  if (columns.has(name)) return `\`${name}\` AS \`${name}\``;
  return `NULL AS \`${name}\``;
}

// 1. View all schools
exports.viewSchools = async (req, res) => {
  try {
    const userColumns = await getUserColumns();
    const [rows] = await pool.query(
      `SELECT id, username,
              ${optionalSelect(userColumns, 'display_name')},
              ${optionalSelect(userColumns, 'logo')},
              ${optionalSelect(userColumns, 'email')},
              ${optionalSelect(userColumns, 'phone')},
              ${optionalSelect(userColumns, 'address')}
       FROM users
       WHERE role = 'school'
       ORDER BY username`
    );

    res.render('admin/schools/index', {
      schools: rows,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (err) {
    console.error('Error fetching schools:', err);
    req.flash('error_msg', 'Failed to load schools.');
    return res.redirect('/admin/dashboard');
  }
};

// 2. Edit school page
exports.editSchoolPage = async (req, res) => {
  const id = req.params.id;
  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE id = ? AND role = 'school' LIMIT 1", [id]);
    if (!rows.length) {
      req.flash('error_msg', 'School not found.');
      return res.redirect('/admin/schools');
    }
    res.render('admin/schools/edit', {
      school: rows[0],
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (err) {
    req.flash('error_msg', 'School not found.');
    return res.redirect('/admin/schools');
  }
};

// 3. Update school
exports.updateSchool = async (req, res) => {
  const id = req.params.id;
  const { display_name, email, phone, address } = req.body;

  try {
    const userColumns = await getUserColumns();
    const canStoreLogo = userColumns.has('logo');
    let logoFilename = null;

    if (req.file && canStoreLogo) {
      logoFilename = req.file.filename;
      const [existing] = await pool.query('SELECT logo FROM users WHERE id = ? LIMIT 1', [id]);
      if (existing.length && existing[0].logo) {
        const oldPath = path.join(__dirname, '../../uploads', existing[0].logo);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    } else if (req.file && !canStoreLogo) {
      const uploadedPath = path.join(__dirname, '../../uploads', req.file.filename);
      if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
    }

    const setClauses = [];
    const params = [];

    if (userColumns.has('display_name')) {
      setClauses.push('display_name=?');
      params.push(display_name || null);
    }
    if (userColumns.has('email')) {
      setClauses.push('email=?');
      params.push(email || null);
    }
    if (userColumns.has('phone')) {
      setClauses.push('phone=?');
      params.push(phone || null);
    }
    if (userColumns.has('address')) {
      setClauses.push('address=?');
      params.push(address || null);
    }
    if (logoFilename) {
      setClauses.push('logo=?');
      params.push(logoFilename);
    }

    if (!setClauses.length) {
      req.flash('error_msg', 'Your current database schema does not support editable school profile fields.');
      return res.redirect('/admin/schools');
    }

    params.push(id);
    await pool.query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id=? AND role='school'`,
      params
    );

    req.flash('success_msg', 'School updated successfully.');
  } catch (err) {
    console.error('Update error:', err);
    req.flash('error_msg', 'Failed to update school.');
  }
  res.redirect('/admin/schools');
};

// 4. Delete a school
exports.deleteSchool = async (req, res) => {
  const id = req.params.id;

  try {
    const userColumns = await getUserColumns();
    if (userColumns.has('logo')) {
      const [existing] = await pool.query('SELECT logo FROM users WHERE id = ? LIMIT 1', [id]);
      if (existing.length && existing[0].logo) {
        const logoPath = path.join(__dirname, '../../uploads', existing[0].logo);
        if (fs.existsSync(logoPath)) fs.unlinkSync(logoPath);
      }
    }

    await pool.query("DELETE FROM users WHERE id=? AND role='school'", [id]);
    req.flash('success_msg', 'School deleted successfully.');
  } catch (err) {
    console.error('Delete error:', err);
    req.flash('error_msg', 'Failed to delete school.');
  }
  res.redirect('/admin/schools');
};

// 5. View school dashboard (impersonate session)
exports.viewSchoolDashboard = async (req, res) => {
  const id = req.params.id;
  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE id = ? AND role = 'school' LIMIT 1", [id]);
    if (!rows.length) {
      req.flash('error_msg', 'School not found.');
      return res.redirect('/admin/schools');
    }
    const data = rows[0];
    req.session.adminUser = req.session.user;
    req.session.user = { id: data.id, role: data.role, username: data.username };
    req.session.save((err) => {
      if (err) {
        req.flash('error_msg', 'Session error. Please try again.');
        return res.redirect('/admin/schools');
      }
      res.redirect('/school/dashboard');
    });
  } catch (err) {
    req.flash('error_msg', 'School not found.');
    return res.redirect('/admin/schools');
  }
};

// 6. Return from school preview back to admin
exports.returnToAdmin = (req, res) => {
  if (!req.session.adminUser) {
    return res.redirect('/login');
  }
  req.session.user = req.session.adminUser;
  delete req.session.adminUser;
  req.session.save((err) => {
    if (err) return res.redirect('/login');
    res.redirect('/admin/schools');
  });
};
