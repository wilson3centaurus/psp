const { supabase } = require('../config/db');
const fs = require('fs');
const csv = require('csv-parser');

// Helper: get distinct attendance dates for a school (deduplicated in JS)
async function getAttendanceDates(schoolId, searchDate) {
  let query = supabase
    .from('student_attendance')
    .select('date')
    .eq('school_id', schoolId)
    .order('date', { ascending: false });

  if (searchDate) query = query.eq('date', searchDate);

  const { data } = await query;
  const seen = new Set();
  const sessions = [];
  for (const r of (data || [])) {
    const d = (r.date || '').slice(0, 10);
    if (d && !seen.has(d)) { seen.add(d); sessions.push({ date: d }); }
  }
  return sessions;
}

// Helper: get classes with counts from students table (grouped in JS)
async function getClasses(schoolId) {
  const { data } = await supabase
    .from('students')
    .select('grade, student_class')
    .eq('school_id', schoolId)
    .order('grade')
    .order('student_class');

  const map = new Map();
  for (const s of (data || [])) {
    const key = `${s.grade}|${s.student_class}`;
    if (!map.has(key)) map.set(key, { grade: s.grade, student_class: s.student_class, count: 0 });
    map.get(key).count++;
  }
  return Array.from(map.values());
}

/* ===========================
   1. LIST ATTENDANCE SESSIONS
=========================== */
exports.listSessions = async (req, res) => {
  const schoolId = req.session.user.id;
  const searchDate = req.query.date || '';
  const selectedGrade = req.query.grade || '';
  const selectedClass = req.query.class || '';
  const selectedMarkDate = req.query.markDate || '';

  const { data: schoolInfo } = await supabase
    .from('users').select('display_name, logo').eq('id', schoolId).maybeSingle();
  const schoolDisplayName = schoolInfo?.display_name || null;
  const schoolLogo = schoolInfo?.logo || null;

  const [sessions, allClasses] = await Promise.all([
    getAttendanceDates(schoolId, searchDate),
    getClasses(schoolId)
  ]);

  if (!selectedGrade || !selectedClass) {
    return res.render('school/studentAttendance/sessions', {
      sessions, searchDate, allClasses, students: [],
      selectedGrade: '', selectedClass: '', selectedDate: selectedMarkDate,
      schoolDisplayName, schoolLogo,
      success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
  }

  const { data: studentRows } = await supabase
    .from('students').select('*')
    .eq('school_id', schoolId)
    .eq('grade', selectedGrade)
    .eq('student_class', selectedClass)
    .order('name');

  res.render('school/studentAttendance/sessions', {
    sessions, searchDate, allClasses, students: studentRows || [],
    selectedGrade, selectedClass, selectedDate: selectedMarkDate,
    schoolDisplayName, schoolLogo,
    success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
  });
};

/* ===========================
   2. MARK PAGE
=========================== */
exports.markAttendancePage = async (req, res) => {
  const schoolId = req.session.user.id;
  const selectedGrade = req.query.grade || '';
  const selectedClass = req.query.class || '';
  const selectedDate = req.query.date || '';

  const { data: schoolInfo } = await supabase
    .from('users').select('display_name, logo').eq('id', schoolId).maybeSingle();
  const schoolDisplayName = schoolInfo?.display_name || null;
  const schoolLogo = schoolInfo?.logo || null;

  const allClasses = await getClasses(schoolId);

  if (!selectedGrade || !selectedClass) {
    return res.render('school/studentAttendance/mark', {
      allClasses, students: [], selectedGrade: '', selectedClass: '', selectedDate,
      schoolDisplayName, schoolLogo,
      success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
  }

  const { data: studentRows } = await supabase
    .from('students').select('*')
    .eq('school_id', schoolId)
    .eq('grade', selectedGrade)
    .eq('student_class', selectedClass)
    .order('name');

  res.render('school/studentAttendance/mark', {
    allClasses, students: studentRows || [],
    selectedGrade, selectedClass, selectedDate,
    schoolDisplayName, schoolLogo,
    success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
  });
};

/* ===========================
   3. SUBMIT MANUAL ATTENDANCE
=========================== */
exports.submitAttendance = async (req, res) => {
  const schoolId = req.session.user.id;
  const { grade, student_class, date } = req.body;

  if (!date) {
    req.flash('error_msg', 'Date is required.');
    return res.redirect('/student-attendance');
  }

  const { data: students } = await supabase
    .from('students').select('id')
    .eq('school_id', schoolId)
    .eq('grade', grade)
    .eq('student_class', student_class);

  if (!students || students.length === 0) {
    req.flash('error_msg', 'No students found for this class.');
    return res.redirect('/student-attendance');
  }

  const attendanceData = (students || []).map(s => ({
    student_id: s.id,
    school_id: schoolId,
    date,
    status: req.body[`status_${s.id}`] || 'Absent',
    reason: req.body[`reason_${s.id}`] || '',
    excused: req.body[`excused_${s.id}`] ? 1 : 0,
    late_minutes: req.body[`status_${s.id}`] === 'Late' ? 1 : (Number(req.body[`late_${s.id}`]) || 0),
    early_minutes: Number(req.body[`early_${s.id}`]) || 0
  }));

  const { error } = await supabase.from('student_attendance').insert(attendanceData);
  if (error) {
    console.error(error);
    req.flash('error_msg', 'Failed to record attendance.');
  } else {
    req.flash('success_msg', 'Attendance saved successfully.');
  }
  res.redirect('/student-attendance');
};

/* ===========================
   4. CSV UPLOAD ATTENDANCE
=========================== */
exports.uploadCSV = (req, res) => {
  const schoolId = req.session.user.id;

  if (!req.file) {
    req.flash('error_msg', 'CSV file missing.');
    return res.redirect('/student-attendance');
  }

  const date = new Date().toISOString().split('T')[0];
  const attendanceRows = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', row => {
      if (row.student_id && row.status) {
        attendanceRows.push({
          student_id: row.student_id,
          school_id: schoolId,
          date,
          status: row.status.trim(),
          reason: row.reason ? String(row.reason).trim() : '',
          excused: row.excused ? 1 : 0,
          late_minutes: Number(row.late_minutes) || 0,
          early_minutes: Number(row.early_minutes) || 0
        });
      }
    })
    .on('end', async () => {
      const { error } = await supabase.from('student_attendance').insert(attendanceRows);
      if (error) {
        console.error(error);
        req.flash('error_msg', 'CSV upload failed.');
      } else {
        req.flash('success_msg', 'CSV attendance imported.');
      }
      res.redirect('/student-attendance');
    });
};

/* ===========================
   5. VIEW ATTENDANCE SESSION
=========================== */
exports.viewSession = async (req, res) => {
  const schoolId = req.session.user.id;
  const date = req.params.date;

  const { data: attRows } = await supabase
    .from('student_attendance').select('*')
    .eq('school_id', schoolId)
    .eq('date', date);

  const studentIds = [...new Set((attRows || []).map(r => r.student_id))];
  const { data: students } = studentIds.length
    ? await supabase.from('students').select('id, name, grade, student_class').in('id', studentIds)
    : { data: [] };

  const studentMap = new Map((students || []).map(s => [s.id, s]));

  const records = (attRows || []).map(a => ({
    name: studentMap.get(a.student_id)?.name || 'Unknown',
    grade: studentMap.get(a.student_id)?.grade || '',
    student_class: studentMap.get(a.student_id)?.student_class || '',
    status: a.status,
    reason: a.reason,
    excused: a.excused,
    late_minutes: a.late_minutes,
    early_minutes: a.early_minutes
  })).sort((a, b) =>
    (a.grade + a.student_class + a.name).localeCompare(b.grade + b.student_class + b.name)
  );

  res.render('school/studentAttendance/view', { records, date });
};

