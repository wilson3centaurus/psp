const db = require('../../config/db');
const PDFDocument = require('pdfkit');

// Build WHERE clause and params based on filters
function buildFilters(query) {
  const filters = [];
  const params = [];

  const search = query.q ? query.q.trim() : '';
  const schoolId = query.schoolId ? query.schoolId.trim() : '';
  const grade = query.grade ? query.grade.trim() : '';

  if (schoolId && schoolId !== 'all') {
    filters.push('s.school_id = ?');
    params.push(schoolId);
  }

  if (grade && grade !== 'all') {
    filters.push('s.grade = ?');
    params.push(grade);
  }

  if (search) {
    const wildcard = `%${search}%`;
    filters.push(`
      (s.name LIKE ? OR s.student_id LIKE ? OR s.student_class LIKE ? OR s.gender LIKE ?)
    `);
    params.push(wildcard, wildcard, wildcard, wildcard);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  return { whereClause, params, search, schoolId, grade };
}

// Fetch all students with school names
function fetchStudents(whereClause, params, cb) {
  const sql = `
    SELECT
      s.id,
      s.name,
      s.grade,
      s.student_class,
      s.gender,
      s.student_id,
      s.school_id,
      COALESCE(u.username, CONCAT('School #', s.school_id)) AS school_name
    FROM students s
    LEFT JOIN users u ON u.id = s.school_id AND u.role = 'school'
    ${whereClause}
    ORDER BY s.name ASC
  `;
  db.query(sql, params, cb);
}

// Fetch schools for filter dropdown
function fetchSchools(cb) {
  const sql = `SELECT id, username FROM users WHERE role = 'school' ORDER BY username`;
  db.query(sql, cb);
}

// Fetch distinct grades for filter dropdown
function fetchGrades(cb) {
  const sql = `SELECT DISTINCT grade FROM students ORDER BY grade`;
  db.query(sql, cb);
}

// View all students (read-only)
exports.listStudents = (req, res) => {
  const { whereClause, params, search, schoolId, grade } = buildFilters(req.query);

  db.query('SELECT COUNT(*) AS total FROM students', (countErr, countRows) => {
    if (countErr) {
      console.error('Error counting students:', countErr);
      req.flash('error_msg', 'Unable to load students right now.');
      return res.redirect('/admin/dashboard');
    }

    const totalStudents = countRows[0]?.total || 0;

    fetchSchools((schoolErr, schoolRows) => {
      if (schoolErr) {
        console.error('Error fetching schools:', schoolErr);
        req.flash('error_msg', 'Unable to load schools list.');
        return res.redirect('/admin/dashboard');
      }

      fetchGrades((gradeErr, gradeRows) => {
        if (gradeErr) {
          console.error('Error fetching grades:', gradeErr);
          req.flash('error_msg', 'Unable to load grades.');
          return res.redirect('/admin/dashboard');
        }

        fetchStudents(whereClause, params, (listErr, students) => {
          if (listErr) {
            console.error('Error fetching students:', listErr);
            req.flash('error_msg', 'Unable to load students.');
            return res.redirect('/admin/dashboard');
          }

          res.render('admin/students/index', {
            students,
            schools: schoolRows,
            grades: gradeRows.map(g => g.grade).filter(g => g !== null),
            filters: {
              search,
              schoolId: schoolId || 'all',
              grade: grade || 'all'
            },
            totalStudents,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
          });
        });
      });
    });
  });
};

// Export filtered list to CSV
exports.exportCSV = (req, res) => {
  const { whereClause, params } = buildFilters(req.query);

  fetchStudents(whereClause, params, (err, students) => {
    if (err) {
      console.error('CSV export error:', err);
      req.flash('error_msg', 'Could not export CSV.');
      return res.redirect('/admin/students');
    }

    const headers = ['Full Name', 'Grade', 'Class', 'Gender', 'Student ID', 'School'];
    const rows = students.map(s => [
      s.name || '',
      s.grade || '',
      s.student_class || '',
      s.gender || '',
      s.student_id || '',
      s.school_name || `School #${s.school_id}`
    ]);

    const csvLines = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="students.csv"');
    res.send(csvLines.join('\n'));
  });
};

// Export filtered list to PDF
exports.exportPDF = (req, res) => {
  const { whereClause, params } = buildFilters(req.query);

  fetchStudents(whereClause, params, (err, students) => {
    if (err) {
      console.error('PDF export error:', err);
      req.flash('error_msg', 'Could not export PDF.');
      return res.redirect('/admin/students');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="students.pdf"');

    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    doc.pipe(res);

    doc.fontSize(18).text('Student List', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`);
    doc.moveDown();

    const headers = ['Name', 'Grade', 'Class', 'Gender', 'Student ID', 'School'];
    doc.fontSize(11).text(headers.join(' | '));
    doc.moveDown(0.5);
    doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
    doc.moveDown(0.5);

    if (students.length === 0) {
      doc.text('No students found for the current filters.');
    } else {
      students.forEach(s => {
        const line = [
          s.name || '-',
          s.grade || '-',
          s.student_class || '-',
          s.gender || '-',
          s.student_id || '-',
          s.school_name || `School #${s.school_id}`
        ].join(' | ');
        doc.text(line);
      });
    }

    doc.end();
  });
};
