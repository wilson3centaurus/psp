const { supabase } = require('../../config/db');
const PDFDocument = require('pdfkit');

// Fetch filtered teachers with school names (joined in JS)
async function fetchFiltered(query) {
  const search = query.q ? query.q.trim() : '';
  const filterSchoolId = query.schoolId && query.schoolId !== 'all' ? query.schoolId : null;

  let q = supabase.from('teachers').select('*').order('name');
  if (filterSchoolId) q = q.eq('school_id', filterSchoolId);
  if (search) {
    const w = `%${search}%`;
    q = q.or(`name.ilike.${w},subject.ilike.${w},email.ilike.${w},phone.ilike.${w},teacher_id.ilike.${w}`);
  }

  const { data: rows } = await q;
  const schoolIds = [...new Set((rows || []).map(t => t.school_id))];
  const { data: schools } = schoolIds.length
    ? await supabase.from('users').select('id, username').in('id', schoolIds)
    : { data: [] };
  const schoolMap = new Map((schools || []).map(s => [s.id, s.username]));

  return (rows || []).map(t => ({
    ...t,
    school_name: schoolMap.get(t.school_id) || `School #${t.school_id}`
  }));
}

// View all teachers
exports.listTeachers = async (req, res) => {
  const search = req.query.q ? req.query.q.trim() : '';
  const filterSchoolId = req.query.schoolId && req.query.schoolId !== 'all' ? req.query.schoolId : null;

  const [totalRes, schoolRes] = await Promise.all([
    supabase.from('teachers').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('id, username').eq('role', 'school').order('username')
  ]);

  const teachers = await fetchFiltered(req.query);

  res.render('admin/teachers/index', {
    teachers,
    schools: schoolRes.data || [],
    filters: { search, schoolId: req.query.schoolId || 'all' },
    totalTeachers: totalRes.count || 0,
    success_msg: req.flash('success_msg'),
    error_msg: req.flash('error_msg')
  });
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

