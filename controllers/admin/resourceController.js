const db = require('../../config/db');

// View grouped resource totals by subject (read-only)
exports.listResources = (req, res) => {
  const summarySql = `
    SELECT
      subject_name,
      SUM(num_students) AS total_students,
      SUM(num_books) AS total_books,
      SUM(num_computers) AS total_computers,
      COUNT(*) AS record_count,
      COUNT(DISTINCT school_id) AS school_count
    FROM resources
    GROUP BY subject_name
    ORDER BY subject_name ASC
  `;

  const totalsSql = `
    SELECT
      COUNT(DISTINCT COALESCE(subject_name, 'Unknown')) AS subjects,
      SUM(num_students) AS total_students,
      SUM(num_books) AS total_books,
      SUM(num_computers) AS total_computers,
      COUNT(*) AS total_rows,
      COUNT(DISTINCT school_id) AS total_schools
    FROM resources
  `;

  db.query(summarySql, (summaryErr, summaryRows) => {
    if (summaryErr) {
      console.error('Error fetching resource summary:', summaryErr);
      req.flash('error_msg', 'Unable to load resource data right now.');
      return res.redirect('/admin/dashboard');
    }

    db.query(totalsSql, (totalsErr, totalsRows) => {
      if (totalsErr) {
        console.error('Error fetching resource totals:', totalsErr);
        req.flash('error_msg', 'Unable to load resource totals right now.');
        return res.redirect('/admin/dashboard');
      }

      const totalsRow = totalsRows[0] || {};
      const totals = {
        subjects: totalsRow.subjects || 0,
        totalStudents: totalsRow.total_students || 0,
        totalBooks: totalsRow.total_books || 0,
        totalComputers: totalsRow.total_computers || 0,
        totalRows: totalsRow.total_rows || 0,
        totalSchools: totalsRow.total_schools || 0
      };

      res.render('admin/resources/index', {
        summary: summaryRows,
        totals,
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
      });
    });
  });
};
