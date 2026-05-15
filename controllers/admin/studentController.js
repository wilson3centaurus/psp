const { pool } = require('../../config/db');
const PDFDocument = require('pdfkit');

// Fetch filtered students with school names
async function fetchFiltered(query) {
  const search = query.q ? query.q.trim() : '';
  const filterSchoolId = query.schoolId && query.schoolId !== 'all' ? query.schoolId : null;
  const filterGrade = query.grade && query.grade !== 'all' ? query.grade : null;

  let sql = 'SELECT * FROM students WHERE 1=1';
  const params = [];

  if (filterSchoolId) { sql += ' AND school_id = ?'; params.push(filterSchoolId); }
  if (filterGrade)    { sql += ' AND grade = ?';     params.push(filterGrade); }
  if (search) {
    const w = `%${search}%`;
    sql += ' AND (name LIKE ? OR student_id LIKE ? OR student_class LIKE ? OR gender LIKE ?)';
    params.push(w, w, w, w);
  }
  sql += ' ORDER BY name';

  const [rows] = await pool.query(sql, params);
  const schoolIds = [...new Set(rows.map(s => s.school_id))];
  let schools = [];
  if (schoolIds.length > 0) {
    [schools] = await pool.query('SELECT id, username FROM users WHERE id IN (?)', [schoolIds]);
  }
  const schoolMap = new Map(schools.map(s => [s.id, s.username]));
  return rows.map(s => ({ ...s, school_name: schoolMap.get(s.school_id) || `School #${s.school_id}` }));
}

// View all students with school names
exports.listStudents = async (req, res) => {
  const search = req.query.q ? req.query.q.trim() : '';
  const filterSchoolId = req.query.schoolId && req.query.schoolId !== 'all' ? req.query.schoolId : null;
  const filterGrade = req.query.grade && req.query.grade !== 'all' ? req.query.grade : null;

  try {
    const [[[{ count: totalStudents }]], [schools], [gradesRaw], students] = await Promise.all([
      pool.query('SELECT COUNT(*) AS count FROM students'),
      pool.query("SELECT id, username FROM users WHERE role = 'school' ORDER BY username"),
      pool.query('SELECT DISTINCT grade FROM students ORDER BY grade'),
      fetchFiltered(req.query)
    ]);

    const grades = gradesRaw.map(g => g.grade).filter(Boolean);

    res.render('admin/students/index', {
      students,
      schools,
      grades,
      filters: { search, schoolId: req.query.schoolId || 'all', grade: req.query.grade || 'all' },
      totalStudents,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (err) {
    console.error('[admin/students] listStudents error:', err);
    res.render('admin/students/index', {
      students: [], schools: [], grades: [],
      filters: { search, schoolId: 'all', grade: 'all' },
      totalStudents: 0,
      success_msg: null, error_msg: 'Failed to load students.'
    });
  }
};

// Export filtered list to CSV
exports.exportCSV = async (req, res) => {
  const students = await fetchFiltered(req.query);
  const headers = ['Full Name', 'Grade', 'Class', 'Gender', 'Student ID', 'School'];
  const rows = students.map(s => [
    s.name || '', s.grade || '', s.student_class || '',
    s.gender || '', s.student_id || '', s.school_name || `School #${s.school_id}`
  ]);
  const csvLines = [
    headers.join(','),
    ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
  ];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="students.csv"');
  res.send(csvLines.join('\n'));
};

// Export filtered list to PDF
exports.exportPDF = async (req, res) => {
  const students = await fetchFiltered(req.query);
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
      doc.text([
        s.name || '-', s.grade || '-', s.student_class || '-',
        s.gender || '-', s.student_id || '-', s.school_name || `School #${s.school_id}`
      ].join(' | '));
    });
  }
  doc.end();
};