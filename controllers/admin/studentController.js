const { supabase } = require('../../config/db');
const PDFDocument = require('pdfkit');

// View all students with school names (joined in JS)
exports.listStudents = async (req, res) => {
  const search = req.query.q ? req.query.q.trim() : '';
  const filterSchoolId = req.query.schoolId && req.query.schoolId !== 'all' ? req.query.schoolId : null;
  const filterGrade = req.query.grade && req.query.grade !== 'all' ? req.query.grade : null;

  const [totalRes, schoolRes, gradeRes, studentRes] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('id, username').eq('role', 'school').order('username'),
    supabase.from('students').select('grade').order('grade'),
    (() => {
      let q = supabase.from('students').select('*').order('name');
      if (filterSchoolId) q = q.eq('school_id', filterSchoolId);
      if (filterGrade) q = q.eq('grade', filterGrade);
      if (search) {
        const w = `%${search}%`;
        q = q.or(`name.ilike.${w},student_id.ilike.${w},student_class.ilike.${w},gender.ilike.${w}`);
      }
      return q;
    })()
  ]);

  const schoolMap = new Map((schoolRes.data || []).map(s => [s.id, s.username]));
  const students = (studentRes.data || []).map(s => ({
    ...s,
    school_name: schoolMap.get(s.school_id) || `School #${s.school_id}`
  }));

  const grades = [...new Set((gradeRes.data || []).map(g => g.grade).filter(Boolean))];

  res.render('admin/students/index', {
    students,
    schools: schoolRes.data || [],
    grades,
    filters: { search, schoolId: req.query.schoolId || 'all', grade: req.query.grade || 'all' },
    totalStudents: totalRes.count || 0,
    success_msg: req.flash('success_msg'),
    error_msg: req.flash('error_msg')
  });
};

// Fetch filtered students helper
async function fetchFiltered(query) {
  const search = query.q ? query.q.trim() : '';
  const filterSchoolId = query.schoolId && query.schoolId !== 'all' ? query.schoolId : null;
  const filterGrade = query.grade && query.grade !== 'all' ? query.grade : null;

  let q = supabase.from('students').select('*').order('name');
  if (filterSchoolId) q = q.eq('school_id', filterSchoolId);
  if (filterGrade) q = q.eq('grade', filterGrade);
  if (search) {
    const w = `%${search}%`;
    q = q.or(`name.ilike.${w},student_id.ilike.${w},student_class.ilike.${w},gender.ilike.${w}`);
  }

  const { data: rows } = await q;
  const schoolIds = [...new Set((rows || []).map(s => s.school_id))];
  const { data: schools } = schoolIds.length
    ? await supabase.from('users').select('id, username').in('id', schoolIds)
    : { data: [] };
  const schoolMap = new Map((schools || []).map(s => [s.id, s.username]));

  return (rows || []).map(s => ({
    ...s,
    school_name: schoolMap.get(s.school_id) || `School #${s.school_id}`
  }));
}

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
