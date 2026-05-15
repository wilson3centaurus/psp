const { pool } = require('../../config/db');
const PDFDocument = require('pdfkit');

// Fetch filtered teachers with school names
async function fetchFiltered(query) {
  const search = query.q ? query.q.trim() : '';
  const filterSchoolId = query.schoolId && query.schoolId !== 'all' ? query.schoolId : null;

  let sql = 'SELECT * FROM teachers WHERE 1=1';
  const params = [];

  if (filterSchoolId) { sql += ' AND school_id = ?'; params.push(filterSchoolId); }
  if (search) {
    const w = `%${search}%`;
    sql += ' AND (name LIKE ? OR subject LIKE ? OR email LIKE ? OR phone LIKE ? OR teacher_id LIKE ?)';
    params.push(w, w, w, w, w);
  }
  sql += ' ORDER BY name';

  const [rows] = await pool.query(sql, params);
  const schoolIds = [...new Set(rows.map(t => t.school_id))];
  let schools = [];
  if (schoolIds.length > 0) {
    [schools] = await pool.query('SELECT id, username FROM users WHERE id IN (?)', [schoolIds]);
  }
  const schoolMap = new Map(schools.map(s => [s.id, s.username]));
  return rows.map(t => ({ ...t, school_name: schoolMap.get(t.school_id) || `School #${t.school_id}` }));
}

// View all teachers
exports.listTeachers = async (req, res) => {
  const search = req.query.q ? req.query.q.trim() : '';

  try {
    const [[[{ count: totalTeachers }]], [schools], teachers] = await Promise.all([
      pool.query('SELECT COUNT(*) AS count FROM teachers'),
      pool.query("SELECT id, username FROM users WHERE role = 'school' ORDER BY username"),
      fetchFiltered(req.query)
    ]);

    res.render('admin/teachers/index', {
      teachers,
      schools,
      filters: { search, schoolId: req.query.schoolId || 'all' },
      totalTeachers,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (err) {
    console.error('[admin/teachers] list error:', err);
    res.render('admin/teachers/index', {
      teachers: [], schools: [],
      filters: { search, schoolId: 'all' },
      totalTeachers: 0,
      success_msg: null, error_msg: 'Failed to load teachers.'
    });
  }
};

// Export filtered list to CSV
exports.exportCSV = async (req, res) => {
  const teachers = await fetchFiltered(req.query);
  const headers = ['Full Name', 'Subject', 'Email', 'Phone', 'Teacher ID', 'School'];
  const rows = teachers.map(t => [
    t.name || '', t.subject || '', t.email || '',
    t.phone || '', t.teacher_id || '', t.school_name || `School #${t.school_id}`
  ]);
  const csvLines = [
    headers.join(','),
    ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
  ];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="teachers.csv"');
  res.send(csvLines.join('\n'));
};

// Export filtered list to PDF
exports.exportPDF = async (req, res) => {
  const teachers = await fetchFiltered(req.query);
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
      doc.text([
        t.name || '-', t.subject || '-', t.email || '-',
        t.phone || '-', t.teacher_id || '-', t.school_name || `School #${t.school_id}`
      ].join(' | '));
    });
  }
  doc.end();
};