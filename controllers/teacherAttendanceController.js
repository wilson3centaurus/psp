const { supabase } = require('../config/db');
const fs = require('fs');
const csv = require('csv-parser');

// Helper: get distinct teacher attendance dates for a school
async function getAttendanceDates(schoolId, searchDate) {
  let query = supabase
    .from('teacher_attendance')
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

/* ===========================
   1. LIST TEACHER SESSIONS
=========================== */
exports.listSessions = async (req, res) => {
  const schoolId = req.session.user.id;
  const searchDate = req.query.searchDate || '';
  const selectedMarkDate = req.query.markDate || '';

  const { data: schoolInfo } = await supabase
    .from('users').select('display_name, logo').eq('id', schoolId).maybeSingle();
  const schoolDisplayName = schoolInfo?.display_name || null;
  const schoolLogo = schoolInfo?.logo || null;

  const [sessions, teacherRes] = await Promise.all([
    getAttendanceDates(schoolId, searchDate),
    supabase.from('teachers').select('*').eq('school_id', schoolId).order('name')
  ]);

  res.render('school/teacherAttendance/sessions', {
    sessions,
    searchDate,
    teachers: teacherRes.data || [],
    selectedDate: selectedMarkDate,
    schoolDisplayName,
    schoolLogo,
    success_msg: req.flash('success_msg'),
    error_msg: req.flash('error_msg')
  });
};

/* ===========================
   2. MARK ATTENDANCE PAGE
=========================== */
exports.markAttendancePage = async (req, res) => {
  const schoolId = req.session.user.id;
  const selectedDate = req.query.date || '';

  const { data: teacherRows } = await supabase
    .from('teachers').select('*').eq('school_id', schoolId).order('name');

  res.render('school/teacherAttendance/mark', {
    teachers: teacherRows || [],
    selectedDate,
    success_msg: req.flash('success_msg'),
    error_msg: req.flash('error_msg')
  });
};

/* ===========================
   3. SUBMIT MANUAL ATTENDANCE
=========================== */
exports.submitAttendance = async (req, res) => {
  const schoolId = req.session.user.id;
  const { date } = req.body;

  if (!date) {
    req.flash('error_msg', 'Please select a date.');
    return res.redirect('/teacher-attendance');
  }

  const submittedKeys = Object.keys(req.body).filter(k => k.startsWith('status_'));
  if (submittedKeys.length === 0) {
    req.flash('error_msg', 'No attendance submitted.');
    return res.redirect('/teacher-attendance');
  }

  // Delete existing records for this date to allow updates
  await supabase.from('teacher_attendance')
    .delete()
    .eq('school_id', schoolId)
    .eq('date', date);

  const attendanceRows = submittedKeys
    .filter(key => req.body[key] && req.body[key].trim() !== '')
    .map(key => {
      const teacherId = key.split('_')[1];
      return {
        teacher_id: teacherId,
        school_id: schoolId,
        date,
        status: req.body[key] || 'Absent',
        reason: req.body[`reason_${teacherId}`] || '',
        excused: req.body[`excused_${teacherId}`] ? 1 : 0,
        late_minutes: Number(req.body[`late_${teacherId}`]) || 0,
        early_minutes: Number(req.body[`early_${teacherId}`]) || 0
      };
    });

  const { error } = await supabase.from('teacher_attendance').insert(attendanceRows);
  if (error) {
    console.error('Manual insert error:', error);
    req.flash('error_msg', 'Failed to save attendance.');
  } else {
    req.flash('success_msg', 'Attendance recorded.');
  }
  res.redirect('/teacher-attendance');
};

/* ===========================
   4. UPLOAD CSV
=========================== */
exports.uploadCSV = async (req, res) => {
  const schoolId = req.session.user.id;
  const date = req.body.date;

  if (!req.file) {
    req.flash('error_msg', 'No CSV file uploaded.');
    return res.redirect('/teacher-attendance');
  }
  if (!date) {
    req.flash('error_msg', 'Please select a date before uploading.');
    return res.redirect('/teacher-attendance');
  }

  const { data: teacherRows } = await supabase
    .from('teachers').select('id, teacher_id').eq('school_id', schoolId);

  const codeToId = {};
  (teacherRows || []).forEach(t => {
    if (t.teacher_id) codeToId[t.teacher_id.trim()] = t.id;
  });

  const parsedRows = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', row => {
        const code = row.teacher_id?.trim();
        const status = row.status?.trim();
        if (!code || !status) return;
        if (!['Present', 'Absent'].includes(status)) return;
        const teacherDbId = codeToId[code];
        if (!teacherDbId) { console.warn(`Unknown teacher_id: ${code}`); return; }
        parsedRows.push({
          teacher_id: teacherDbId,
          school_id: schoolId,
          date,
          status,
          reason: row.reason ? String(row.reason).trim() : '',
          excused: row.excused ? 1 : 0,
          late_minutes: Number(row.late_minutes) || 0,
          early_minutes: Number(row.early_minutes) || 0
        });
      })
      .on('end', resolve)
      .on('error', reject);
  });

  if (parsedRows.length === 0) {
    req.flash('error_msg', 'No valid rows found in CSV.');
    return res.redirect('/teacher-attendance');
  }

  const { error } = await supabase.from('teacher_attendance').insert(parsedRows);
  if (error) {
    console.error('Insert error:', error);
    req.flash('error_msg', 'Failed to upload CSV.');
  } else {
    req.flash('success_msg', 'Teacher attendance uploaded successfully.');
  }
  res.redirect('/teacher-attendance');
};

/* ===========================
   5. VIEW SESSION
=========================== */
exports.viewSession = async (req, res) => {
  const schoolId = req.session.user.id;
  const date = req.params.date;

  const { data: attRows } = await supabase
    .from('teacher_attendance').select('*')
    .eq('school_id', schoolId)
    .eq('date', date);

  const teacherIds = [...new Set((attRows || []).map(r => r.teacher_id))];
  const { data: teachers } = teacherIds.length
    ? await supabase.from('teachers').select('id, teacher_id, name, email, phone, subject').in('id', teacherIds)
    : { data: [] };

  const teacherMap = new Map((teachers || []).map(t => [t.id, t]));

  const records = (attRows || []).map(a => {
    const t = teacherMap.get(a.teacher_id) || {};
    return {
      teacherCode: t.teacher_id || '',
      name: t.name || 'Unknown',
      email: t.email || '',
      phone: t.phone || '',
      subject: t.subject || '',
      status: a.status,
      reason: a.reason,
      excused: a.excused,
      late_minutes: a.late_minutes,
      early_minutes: a.early_minutes
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  res.render('school/teacherAttendance/view', { records, date });
};
