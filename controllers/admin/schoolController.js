const db = require('../../config/db');
const fs = require('fs');
const path = require('path');

// 1. View all schools
exports.viewSchools = (req, res) => {
  const sql = `SELECT id, username, display_name, logo, email, phone, address FROM users WHERE role = 'school' ORDER BY username`;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error('❌ Error fetching schools:', err);
      req.flash('error_msg', 'Failed to load schools.');
      return res.redirect('/admin/dashboard');
    }

    res.render('admin/schools/index', {
      schools: rows,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  });
};

// 2. Edit school page
exports.editSchoolPage = (req, res) => {
  const id = req.params.id;

  const sql = 'SELECT * FROM users WHERE id = ? AND role = "school"';

  db.query(sql, [id], (err, results) => {
    if (err || results.length === 0) {
      console.error('❌ School not found:', err);
      req.flash('error_msg', 'School not found.');
      return res.redirect('/admin/schools');
    }

    res.render('admin/schools/edit', {
      school: results[0],
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  });
};

// 3. Update school
exports.updateSchool = (req, res) => {
  const id = req.params.id;
  const { display_name, email, phone, address } = req.body;
  
  let logoFilename = null;
  
  // If a new logo was uploaded
  if (req.file) {
    logoFilename = req.file.filename;
    
    // Delete old logo if exists
    const getOldLogo = 'SELECT logo FROM users WHERE id = ?';
    db.query(getOldLogo, [id], (err, results) => {
      if (!err && results[0] && results[0].logo) {
        const oldLogoPath = path.join(__dirname, '../../uploads', results[0].logo);
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
        }
      }
    });
  }

  let sql, params;
  
  if (logoFilename) {
    sql = 'UPDATE users SET display_name = ?, email = ?, phone = ?, address = ?, logo = ? WHERE id = ? AND role = \'school\'';
    params = [display_name, email, phone, address, logoFilename, id];
  } else {
    sql = 'UPDATE users SET display_name = ?, email = ?, phone = ?, address = ? WHERE id = ? AND role = \'school\'';
    params = [display_name, email, phone, address, id];
  }

  db.query(sql, params, (err) => {
    if (err) {
      console.error('❌ Update error:', err);
      req.flash('error_msg', 'Failed to update school.');
    } else {
      req.flash('success_msg', 'School updated successfully.');
    }
    res.redirect('/admin/schools');
  });
};

// 4. Delete a school
exports.deleteSchool = (req, res) => {
  const id = req.params.id;

  // Delete logo file if exists
  const getLogo = 'SELECT logo FROM users WHERE id = ?';
  db.query(getLogo, [id], (err, results) => {
    if (!err && results[0] && results[0].logo) {
      const logoPath = path.join(__dirname, '../../uploads', results[0].logo);
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }
    }
  });

  const sql = 'DELETE FROM users WHERE id = ? AND role = \'school\'';

  db.query(sql, [id], (err) => {
    if (err) {
      console.error('❌ Delete error:', err);
      req.flash('error_msg', 'Failed to delete school.');
    } else {
      req.flash('success_msg', 'School deleted successfully.');
    }
    res.redirect('/admin/schools');
  });
};

// 5. View school dashboard (impersonate session)
exports.viewSchoolDashboard = (req, res) => {
  const id = req.params.id;

  const sql = 'SELECT * FROM users WHERE id = ? AND role = "school"';

  db.query(sql, [id], (err, results) => {
    if (err || results.length === 0) {
      console.error('❌ School not found:', err);
      req.flash('error_msg', 'School not found.');
      return res.redirect('/admin/schools');
    }

    req.session.user = {
      id: results[0].id,
      role: results[0].role,
      username: results[0].username
    };

    res.redirect('/school/dashboard');
  });
};
