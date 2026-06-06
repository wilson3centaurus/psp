const { pool } = require('../config/db');
const fs = require('fs');
const csv = require('csv-parser');

function normalizeDateInput(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

async function getAttendanceDates(schoolId, searchDate) {
  let sql = 'SELECT DISTINCT date FROM teacher_attendance WHERE school_id = ? ORDER BY date DESC';
  const params = [schoolId];
  if (searchDate) {
    sql = 'SELECT DISTINCT date FROM teacher_attendance WHERE school_id = ? AND date = ? ORDER BY date DESC';
    params.push(searchDate);
  }
  const [rows] = await pool.query(sql, params);
  return rows.map((r) => ({ date: (r.date instanceof Date ? r.date.toISOString() : String(r.date)).slice(0, 10) }));
}

async function upsertTeacherAttendanceRecord({
  teacherId,
  schoolId,
  date,
  status,
  reason = '',
  excused = 0,
  lateMinutes = 0,
  earlyMinutes = 0
}) {
  const [existing] = await pool.query(
    'SELECT id FROM teacher_attendance WHERE teacher_id = ? AND school_id = ? AND date = ? ORDER BY id DESC LIMIT 1',
    [teacherId, schoolId, date]
  );

  if (existing.length > 0) {
    await pool.query(
      `UPDATE teacher_attendance
       SET status = ?, reason = ?, excused = ?, late_minutes = ?, early_minutes = ?
       WHERE id = ?`,
      [status, reason, excused, lateMinutes, earlyMinutes, existing[0].id]
    );
    return existing[0].id;
  }

  const [result] = await pool.query(
    `INSERT INTO teacher_attendance
      (teacher_id, school_id, date, status, reason, excused, late_minutes, early_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [teacherId, schoolId, date, status, reason, excused, lateMinutes, earlyMinutes]
  );

  return result.insertId;
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
      sessions: [],
      searchDate,
      teachers: [],
      selectedDate: selectedMarkDate,
      schoolDisplayName: null,
      schoolLogo: null
    });
  }
};

/* ===========================
   2. MARK ATTENDANCE PAGE
=========================== */
exports.markAttendancePage = async (req, res) => {
  const schoolId = req.session.user.id;
  const selectedDate = normalizeDateInput(req.query.date) || new Date().toISOString().slice(0, 10);

  try {
    const [[schoolInfo]] = await pool.query('SELECT display_name, logo FROM users WHERE id = ? LIMIT 1', [schoolId]);
    const schoolDisplayName = schoolInfo?.display_name || null;
    const schoolLogo = schoolInfo?.logo || null;

    const [teacherRows] = await pool.query(
      `SELECT
         t.*,
         ta.status AS attendance_status,
         ta.reason AS attendance_reason,
         ta.excused AS attendance_excused,
         ta.late_minutes AS attendance_late_minutes,
         ta.early_minutes AS attendance_early_minutes
       FROM teachers t
       LEFT JOIN teacher_attendance ta
         ON ta.teacher_id = t.id
        AND ta.school_id = t.school_id
        AND ta.date = ?
       WHERE t.school_id = ?
       ORDER BY t.name`,
      [selectedDate, schoolId]
    );

    res.render('school/teacherAttendance/mark', {
      teachers: teacherRows,
      selectedDate,
      schoolDisplayName,
      schoolLogo
    });
  } catch (err) {
    console.error('[teacherAttendance] markPage error:', err);
    res.render('school/teacherAttendance/mark', {
      teachers: [],
      selectedDate,
      schoolDisplayName: null,
      schoolLogo: null
    });
  }
};

/* ===========================
   3. SUBMIT MANUAL ATTENDANCE
=========================== */
exports.submitAttendance = async (req, res) => {
  const schoolId = req.session.user.id;
  const date = normalizeDateInput(req.body.date);

  if (!date) {
    req.flash('error_msg', 'Please select a date.');
    return res.redirect('/teacher-attendance');
  }

  const submittedKeys = Object.keys(req.body).filter((k) => k.startsWith('status_'));
  if (submittedKeys.length === 0) {
    req.flash('error_msg', 'No attendance submitted.');
    return res.redirect('/teacher-attendance');
  }

  try {
    const validKeys = submittedKeys.filter((key) => req.body[key] && req.body[key].trim() !== '');
    for (const key of validKeys) {
      const teacherId = key.split('_')[1];
      const status = req.body[key] || 'Absent';
      await upsertTeacherAttendanceRecord({
        teacherId,
        schoolId,
        date,
        status,
        reason: req.body[`reason_${teacherId}`] || '',
        excused: req.body[`excused_${teacherId}`] ? 1 : 0,
        lateMinutes: status === 'Late' ? (Number(req.body[`late_${teacherId}`]) || 1) : (Number(req.body[`late_${teacherId}`]) || 0),
        earlyMinutes: Number(req.body[`early_${teacherId}`]) || 0
      });
    }
    req.flash('success_msg', 'Attendance recorded.');
  } catch (err) {
    console.error('[teacherAttendance] submit error:', err);
    req.flash('error_msg', 'Failed to save attendance.');
  }
  res.redirect('/teacher-attendance');
};

/* ===========================
   4. FACE RECOGNITION AUTO-MARK
=========================== */
exports.markAttendanceByFace = async (req, res) => {
  const schoolId = req.session.user.id;
  const teacherId = Number(req.body.teacherId);
  const date = normalizeDateInput(req.body.date);

  if (!teacherId || !date) {
    return res.status(400).json({ ok: false, message: 'Missing facial recognition attendance fields.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, name
       FROM teachers
       WHERE id = ? AND school_id = ? AND face_descriptor IS NOT NULL
       LIMIT 1`,
      [teacherId, schoolId]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, message: 'Recognized teacher does not have an enrolled face.' });
    }

    await upsertTeacherAttendanceRecord({
      teacherId,
      schoolId,
      date,
      status: 'Present',
      reason: 'Facial recognition',
      excused: 0,
      lateMinutes: 0,
      earlyMinutes: 0
    });

    return res.json({
      ok: true,
      teacherId,
      name: rows[0].name,
      status: 'Present',
      reason: 'Facial recognition',
      date
    });
  } catch (err) {
    console.error('[teacherAttendance] face mark error:', err);
    return res.status(500).json({ ok: false, message: 'Facial recognition attendance failed.' });
  }
};

/* ===========================
   5. UPLOAD CSV
=========================== */
exports.uploadCSV = async (req, res) => {
  const schoolId = req.session.user.id;
  const date = normalizeDateInput(req.body.date);

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
    teacherRows.forEach((t) => { if (t.teacher_id) codeToId[t.teacher_id.trim()] = t.id; });

    const parsedRows = await new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (row) => {
          const code = row.teacher_id?.trim();
          const status = row.status?.trim();
          if (!code || !status) return;
          if (!['Present', 'Absent', 'Late', 'Excused', 'Left Early'].includes(status)) return;
          const teacherDbId = codeToId[code];
          if (!teacherDbId) {
            console.warn(`Unknown teacher_id: ${code}`);
            return;
          }
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

    for (const row of parsedRows) {
      await upsertTeacherAttendanceRecord({
        teacherId: row.teacher_id,
        schoolId: row.school_id,
        date: row.date,
        status: row.status,
        reason: row.reason,
        excused: row.excused,
        lateMinutes: row.late_minutes,
        earlyMinutes: row.early_minutes
      });
    }
    req.flash('success_msg', 'Teacher attendance uploaded successfully.');
  } catch (err) {
    console.error('[teacherAttendance] CSV upload error:', err);
    req.flash('error_msg', 'Failed to upload CSV.');
  }
  res.redirect('/teacher-attendance');
};

/* ===========================
   6. VIEW SESSION
=========================== */
exports.viewSession = async (req, res) => {
  const schoolId = req.session.user.id;
  const date = req.params.date;

  try {
    const [attRows] = await pool.query(
      'SELECT * FROM teacher_attendance WHERE school_id = ? AND date = ?',
      [schoolId, date]
    );

    const teacherIds = [...new Set(attRows.map((r) => r.teacher_id))];
    let teachers = [];
    if (teacherIds.length > 0) {
      [teachers] = await pool.query(
        'SELECT id, teacher_id, name, email, phone, subject FROM teachers WHERE id IN (?)',
        [teacherIds]
      );
    }

    const teacherMap = new Map(teachers.map((t) => [t.id, t]));

    const records = attRows.map((a) => {
      const teacher = teacherMap.get(a.teacher_id) || {};
      return {
        teacherCode: teacher.teacher_id || '',
        name: teacher.name || 'Unknown',
        email: teacher.email || '',
        phone: teacher.phone || '',
        subject: teacher.subject || '',
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
