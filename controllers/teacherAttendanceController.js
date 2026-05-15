const { pool } = require('../config/db');
const fs = require('fs');
const csv = require('csv-parser');

// Helper: get distinct teacher attendance dates for a school
async function getAttendanceDates(schoolId, searchDate) {
  let sql = 'SELECT DISTINCT date FROM teacher_attendance WHERE school_id = ? ORDER BY date DESC';
  const params = [schoolId];
  if (searchDate) {
    sql = 'SELECT DISTINCT date FROM teacher_attendance WHERE school_id = ? AND date = ? ORDER BY date DESC';
    params.push(searchDate);
  }
  const [rows] = await pool.query(sql, params);
  return rows.map(r => ({ date: (r.date instanceof Date ? r.date.toISOString() : String(r.date)).slice(0, 10) }));
}

/* ===========================
   1. LIST TEACHER SESSIONS
=========================== */
exports.listSessions = async (req, res) => {
  const schoolId = req.session.user.id;
  const searchDate = req.query.searchDate || '';
  const selectedMarkDate = req.query.markDate || '';

  try {
    const [[schoolInfo]] = await pool.query('SELECT display_name, logo FROM users WHERE id = ? LIMIT 1', [schoolId]);
    const schoolDisplayName = schoolInfo?.display_name || null;
    const schoolLogo = schoolInfo?.logo || null;

    const [sessions, [teachers]] = await Promise.all([
      getAttendanceDates(schoolId, searchDate),
      pool.query('SELECT * FROM teachers WHERE school_id = ? ORDER BY name', [schoolId])
    ]);

    res.render('school/teacherAttendance/sessions', {
      sessions,
      searchDate,
      teachers,
      selectedDate: selectedMarkDate,
      schoolDisplayName,
      schoolLogo
    });
  } catch (err) {
    console.error('[teacherAttendance] listSessions error:', err);
    res.render('school/teacherAttendance/sessions', {
      sessions: [], searchDate, teachers: [], selectedDate: selectedMarkDate,
      schoolDisplayName: null, schoolLogo: null
    });
  }
};

/* ===========================
   2. MARK ATTENDANCE PAGE
=========================== */
exports.markAttendancePage = async (req, res) => {
  const schoolId = req.session.user.id;
  const selectedDate = req.query.date || '';

  try {
    const [teacherRows] = await pool.query('SELECT * FROM teachers WHERE school_id = ? ORDER BY name', [schoolId]);
    res.render('school/teacherAttendance/mark', { teachers: teacherRows, selectedDate });
  } catch (err) {
    console.error('[teacherAttendance] markPage error:', err);
    res.render('school/teacherAttendance/mark', { teachers: [], selectedDate });
  }
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

  try {
    // Delete existing records for this date to allow updates
    await pool.query('DELETE FROM teacher_attendance WHERE school_id = ? AND date = ?', [schoolId, date]);

    const validKeys = submittedKeys.filter(key => req.body[key] && req.body[key].trim() !== '');
    for (const key of validKeys) {
      const teacherId = key.split('_')[1];
      await pool.query(
        'INSERT INTO teacher_attendance (teacher_id, school_id, date, status, reason, excused, late_minutes, early_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          teacherId,
          schoolId,
          date,
          req.body[key] || 'Absent',
          req.body[`reason_${teacherId}`] || '',
          req.body[`excused_${teacherId}`] ? 1 : 0,
          Number(req.body[`late_${teacherId}`]) || 0,
          Number(req.body[`early_${teacherId}`]) || 0
        ]
      );
    }
    req.flash('success_msg', 'Attendance recorded.');
  } catch (err) {
    console.error('[teacherAttendance] submit error:', err);
    req.flash('error_msg', 'Failed to save attendance.');
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

  try {
    const [teacherRows] = await pool.query('SELECT id, teacher_id FROM teachers WHERE school_id = ?', [schoolId]);
    const codeToId = {};
    teacherRows.forEach(t => { if (t.teacher_id) codeToId[t.teacher_id.trim()] = t.id; });

    const parsedRows = await new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', row => {
          const code = row.teacher_id?.trim();
          const status = row.status?.trim();
          if (!code || !status) return;
          if (!['Present', 'Absent'].includes(status)) return;
          const teacherDbId = codeToId[code];
          if (!teacherDbId) { console.warn(`Unknown teacher_id: ${code}`); return; }
          results.push({
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
        .on('end', () => resolve(results))
        .on('error', reject);
    });

    if (parsedRows.length === 0) {
      req.flash('error_msg', 'No valid rows found in CSV.');
      return res.redirect('/teacher-attendance');
    }

    for (const r of parsedRows) {
      await pool.query(
        'INSERT INTO teacher_attendance (teacher_id, school_id, date, status, reason, excused, late_minutes, early_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [r.teacher_id, r.school_id, r.date, r.status, r.reason, r.excused, r.late_minutes, r.early_minutes]
      );
    }
    req.flash('success_msg', 'Teacher attendance uploaded successfully.');
  } catch (err) {
    console.error('[teacherAttendance] CSV upload error:', err);
    req.flash('error_msg', 'Failed to upload CSV.');
  }
  res.redirect('/teacher-attendance');
};

/* ===========================
   5. VIEW SESSION
=========================== */
exports.viewSession = async (req, res) => {
  const schoolId = req.session.user.id;
  const date = req.params.date;

  try {
    const [attRows] = await pool.query(
      'SELECT * FROM teacher_attendance WHERE school_id = ? AND date = ?',
      [schoolId, date]
    );

    const teacherIds = [...new Set(attRows.map(r => r.teacher_id))];
    let teachers = [];
    if (teacherIds.length > 0) {
      [teachers] = await pool.query(
        'SELECT id, teacher_id, name, email, phone, subject FROM teachers WHERE id IN (?)',
        [teacherIds]
      );
    }

    const teacherMap = new Map(teachers.map(t => [t.id, t]));

    const records = attRows.map(a => {
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
  } catch (err) {
    console.error('[teacherAttendance] viewSession error:', err);
    res.render('school/teacherAttendance/view', { records: [], date });
  }
};