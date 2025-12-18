const db = require('../../config/db');
const PDFDocument = require('pdfkit');

// Helper: build WHERE clause + params for filters/search
function buildFilters(query) {
  const filters = [];
  const params = [];

  const search = query.q ? query.q.trim() : '';
  const schoolId = query.schoolId ? query.schoolId.trim() : '';

  if (schoolId && schoolId !== 'all') {
    filters.push('t.school_id = ?');
    params.push(schoolId);
  }

  if (search) {
    const wildcard = `%${search}%`;
    filters.push(`
      (t.name LIKE ? OR t.subject LIKE ? OR t.email LIKE ? OR t.phone LIKE ? OR t.teacher_id LIKE ? OR s.username LIKE ?)
    `);
    params.push(wildcard, wildcard, wildcard, wildcard, wildcard, wildcard);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  return { whereClause, params, search, schoolId };
}

// Helper: fetch teacher rows with school name fallback
function fetchTeachers(whereClause, params, cb) {
  const sql = `
    SELECT
      t.id,
      t.name,
      t.subject,
      t.email,
      t.phone,
      t.teacher_id,
      t.school_id,
      COALESCE(s.username, CONCAT('School #', t.school_id)) AS school_name
    FROM teachers t
    LEFT JOIN users s ON s.id = t.school_id AND s.role = 'school'
    ${whereClause}
    ORDER BY t.name ASC
  `;

  db.query(sql, params, cb);
}

// Helper: fetch schools for filter dropdown
function fetchSchools(cb) {
  const sql = `SELECT id, username FROM users WHERE role = 'school' ORDER BY username`;
  db.query(sql, cb);
}

// View all teachers (read-only)
exports.listTeachers = (req, res) => {
  const { whereClause, params, search, schoolId } = buildFilters(req.query);

  db.query('SELECT COUNT(*) AS total FROM teachers', (countErr, countRows) => {
    if (countErr) {
      console.error('Error counting teachers:', countErr);
      req.flash('error_msg', 'Unable to load teachers right now.');
      return res.redirect('/admin/dashboard');
    }

    const totalTeachers = countRows[0]?.total || 0;

    fetchSchools((schoolErr, schoolRows) => {
      if (schoolErr) {
        console.error('Error fetching schools:', schoolErr);
        req.flash('error_msg', 'Unable to load schools list.');
        return res.redirect('/admin/dashboard');
      }

      fetchTeachers(whereClause, params, (listErr, teachers) => {
        if (listErr) {
          console.error('Error fetching teachers:', listErr);
          req.flash('error_msg', 'Unable to load teachers.');
          return res.redirect('/admin/dashboard');
        }

        res.render('admin/teachers/index', {
          teachers,
          schools: schoolRows,
          filters: {
            search,
            schoolId: schoolId || 'all'
          },
          totalTeachers,
          success_msg: req.flash('success_msg'),
          error_msg: req.flash('error_msg')
        });
      });
    });
  });
};

// Export filtered list to CSV
exports.exportCSV = (req, res) => {
  const { whereClause, params } = buildFilters(req.query);

  fetchTeachers(whereClause, params, (err, teachers) => {
    if (err) {
      console.error('CSV export error:', err);
      req.flash('error_msg', 'Could not export CSV.');
      return res.redirect('/admin/teachers');
    }

    const headers = ['Full Name', 'Subject', 'Email', 'Phone', 'Teacher ID', 'School'];
    const rows = teachers.map(t => [
      t.name || '',
      t.subject || '',
      t.email || '',
      t.phone || '',
      t.teacher_id || '',
      t.school_name || `School #${t.school_id}`
    ]);

    const csvLines = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="teachers.csv"');
    res.send(csvLines.join('\n'));
  });
};

// Export filtered list to PDF
exports.exportPDF = (req, res) => {
  const { whereClause, params } = buildFilters(req.query);

  fetchTeachers(whereClause, params, (err, teachers) => {
    if (err) {
      console.error('PDF export error:', err);
      req.flash('error_msg', 'Could not export PDF.');
      return res.redirect('/admin/teachers');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="teachers.pdf"');

    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    doc.pipe(res);

    doc.fontSize(18).text('Teacher List', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`);
    doc.moveDown();

    const headers = ['Name', 'Subject', 'Email', 'Phone', 'Teacher ID', 'School'];
    doc.fontSize(11).text(headers.join(' | '));
    doc.moveDown(0.5);
    doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
    doc.moveDown(0.5);

    if (teachers.length === 0) {
      doc.text('No teachers found for the current filters.');
    } else {
      teachers.forEach(t => {
        const line = [
          t.name || '-',
          t.subject || '-',
          t.email || '-',
          t.phone || '-',
          t.teacher_id || '-',
          t.school_name || `School #${t.school_id}`
        ].join(' | ');
        doc.text(line);
      });
    }

    doc.end();
  });
};
