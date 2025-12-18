const db = require('../../config/db');

// 1. View all schools
exports.viewSchools = (req, res) => {
  const sql = `SELECT id, username FROM users WHERE role = 'school' ORDER BY username`;

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

// 2. Delete a school
exports.deleteSchool = (req, res) => {
  const id = req.params.id;

  const sql = 'DELETE FROM users WHERE id = ? AND role = "school"';

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

// 3. View school dashboard (impersonate session)
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
