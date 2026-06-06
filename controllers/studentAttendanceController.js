const { pool } = require('../config/db');
const fs = require('fs');
const csv = require('csv-parser');

function normalizeDateInput(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

async function upsertStudentAttendanceRecord({
  studentId,
  schoolId,
  date,
  status,
  reason = '',
  excused = 0,
  lateMinutes = 0,
  earlyMinutes = 0
}) {
  const [existing] = await pool.query(
    'SELECT id FROM student_attendance WHERE student_id = ? AND school_id = ? AND date = ? ORDER BY id DESC LIMIT 1',
    [studentId, schoolId, date]
  );

  if (existing.length > 0) {
    await pool.query(
      `UPDATE student_attendance
       SET status = ?, reason = ?, excused = ?, late_minutes = ?, early_minutes = ?
       WHERE id = ?`,
      [status, reason, excused, lateMinutes, earlyMinutes, existing[0].id]
    );
    return existing[0].id;
  }

  const [result] = await pool.query(
    `INSERT INTO student_attendance
      (student_id, school_id, date, status, reason, excused, late_minutes, early_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [studentId, schoolId, date, status, reason, excused, lateMinutes, earlyMinutes]
  );

  return result.insertId;
}

// Helper: get distinct attendance dates for a school
async function getAttendanceDates(schoolId, searchDate) {
  let sql = 'SELECT DISTINCT date FROM student_attendance WHERE school_id = ? ORDER BY date DESC';
  const params = [schoolId];
  if (searchDate) {
    sql = 'SELECT DISTINCT date FROM student_attendance WHERE school_id = ? AND date = ? ORDER BY date DESC';
    params.push(searchDate);
  }
  const [rows] = await pool.query(sql, params);
  return rows.map(r => ({ date: (r.date instanceof Date ? r.date.toISOString() : String(r.date)).slice(0, 10) }));
}

// Helper: get classes with counts from students table
async function getClasses(schoolId) {
  const [rows] = await pool.query(
    'SELECT grade, student_class, COUNT(*) as count FROM students WHERE school_id = ? GROUP BY grade, student_class ORDER BY grade, student_class',
    [schoolId]
  );
  return rows;
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

  try {
    const [[schoolInfo]] = await pool.query('SELECT display_name, logo FROM users WHERE id = ? LIMIT 1', [schoolId]);
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
        schoolDisplayName, schoolLogo
      });
    }

    const [studentRows] = await pool.query(
      'SELECT * FROM students WHERE school_id = ? AND grade = ? AND student_class = ? ORDER BY name',
      [schoolId, selectedGrade, selectedClass]
    );

    res.render('school/studentAttendance/sessions', {
      sessions, searchDate, allClasses, students: studentRows,
      selectedGrade, selectedClass, selectedDate: selectedMarkDate,
      schoolDisplayName, schoolLogo
    });
  } catch (err) {
    console.error('[studentAttendance] listSessions error:', err);
    res.render('school/studentAttendance/sessions', {
      sessions: [], searchDate, allClasses: [], students: [],
      selectedGrade: '', selectedClass: '', selectedDate: selectedMarkDate,
      schoolDisplayName: null, schoolLogo: null
    });
  }
};

/* ===========================
   2. MARK PAGE
=========================== */
exports.markAttendancePage = async (req, res) => {
  const schoolId = req.session.user.id;
  const selectedGrade = req.query.grade || '';
  const selectedClass = req.query.class || '';
  const selectedDate = normalizeDateInput(req.query.date) || new Date().toISOString().slice(0, 10);

  try {
    const [[schoolInfo]] = await pool.query('SELECT display_name, logo FROM users WHERE id = ? LIMIT 1', [schoolId]);
    const schoolDisplayName = schoolInfo?.display_name || null;
    const schoolLogo = schoolInfo?.logo || null;

    const allClasses = await getClasses(schoolId);

    if (!selectedGrade || !selectedClass) {
      return res.render('school/studentAttendance/mark', {
        allClasses, students: [], selectedGrade: '', selectedClass: '', selectedDate,
        schoolDisplayName, schoolLogo
      });
    }

    const [studentRows] = await pool.query(
      `SELECT
         s.*,
         sa.status AS attendance_status,
         sa.reason AS attendance_reason,
         sa.excused AS attendance_excused,
         sa.late_minutes AS attendance_late_minutes,
         sa.early_minutes AS attendance_early_minutes
       FROM students s
       LEFT JOIN student_attendance sa
         ON sa.student_id = s.id
        AND sa.school_id = s.school_id
        AND sa.date = ?
       WHERE s.school_id = ? AND s.grade = ? AND s.student_class = ?
       ORDER BY s.name`,
      [selectedDate, schoolId, selectedGrade, selectedClass]
    );

    res.render('school/studentAttendance/mark', {
      allClasses, students: studentRows,
      selectedGrade, selectedClass, selectedDate,
      schoolDisplayName, schoolLogo
    });
  } catch (err) {
    console.error('[studentAttendance] markPage error:', err);
    res.render('school/studentAttendance/mark', {
      allClasses: [], students: [], selectedGrade: '', selectedClass: '', selectedDate,
      schoolDisplayName: null, schoolLogo: null
    });
  }
};

/* ===========================
   3. SUBMIT MANUAL ATTENDANCE
=========================== */
exports.submitAttendance = async (req, res) => {
  const schoolId = req.session.user.id;
  const { grade, student_class, date } = req.body;
  const normalizedDate = normalizeDateInput(date);

  if (!normalizedDate) {
    req.flash('error_msg', 'Date is required.');
    return res.redirect('/student-attendance');
  }

  try {
    const [students] = await pool.query(
      'SELECT id FROM students WHERE school_id = ? AND grade = ? AND student_class = ?',
      [schoolId, grade, student_class]
    );

    if (!students || students.length === 0) {
      req.flash('error_msg', 'No students found for this class.');
      return res.redirect('/student-attendance');
    }

    for (const s of students) {
      const status = req.body[`status_${s.id}`] || 'Absent';
      await upsertStudentAttendanceRecord({
        studentId: s.id,
        schoolId,
        date: normalizedDate,
        status,
        reason: req.body[`reason_${s.id}`] || '',
        excused: req.body[`excused_${s.id}`] ? 1 : 0,
        lateMinutes: status === 'Late' ? (Number(req.body[`late_${s.id}`]) || 1) : (Number(req.body[`late_${s.id}`]) || 0),
        earlyMinutes: Number(req.body[`early_${s.id}`]) || 0
      });
    }
    req.flash('success_msg', 'Attendance saved successfully.');
  } catch (err) {
    console.error('[studentAttendance] submit error:', err);
    req.flash('error_msg', 'Failed to record attendance.');
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
      try {
        for (const r of attendanceRows) {
          await upsertStudentAttendanceRecord({
            studentId: r.student_id,
            schoolId: r.school_id,
            date: r.date,
            status: r.status,
            reason: r.reason,
            excused: r.excused,
            lateMinutes: r.late_minutes,
            earlyMinutes: r.early_minutes
          });
        }
        req.flash('success_msg', 'CSV attendance imported.');
      } catch (err) {
        console.error('[studentAttendance] CSV upload error:', err);
        req.flash('error_msg', 'CSV upload failed.');
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

  try {
    const [attRows] = await pool.query(
      'SELECT * FROM student_attendance WHERE school_id = ? AND date = ?',
      [schoolId, date]
    );

    const studentIds = [...new Set(attRows.map(r => r.student_id))];
    let students = [];
    if (studentIds.length > 0) {
      [students] = await pool.query(
        'SELECT id, name, grade, student_class FROM students WHERE id IN (?)',
        [studentIds]
      );
    }

    const studentMap = new Map(students.map(s => [s.id, s]));

    const records = attRows.map(a => ({
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
  } catch (err) {
    console.error('[studentAttendance] viewSession error:', err);
    res.render('school/studentAttendance/view', { records: [], date });
  }
};

/* ===========================
   6. FACE ID AUTO-MARK
=========================== */
exports.markAttendanceByFace = async (req, res) => {
  const schoolId = req.session.user.id;
  const studentId = Number(req.body.studentId);
  const grade = String(req.body.grade || '').trim();
  const studentClass = String(req.body.studentClass || '').trim();
  const date = normalizeDateInput(req.body.date);

  if (!studentId || !grade || !studentClass || !date) {
    return res.status(400).json({ ok: false, message: 'Missing facial recognition attendance fields.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, name
       FROM students
       WHERE id = ? AND school_id = ? AND grade = ? AND student_class = ? AND face_descriptor IS NOT NULL
       LIMIT 1`,
      [studentId, schoolId, grade, studentClass]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, message: 'Recognized student is not enrolled for this class.' });
    }

    await upsertStudentAttendanceRecord({
      studentId,
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
      studentId,
      name: rows[0].name,
      status: 'Present',
      reason: 'Facial recognition',
      date
    });
  } catch (err) {
    console.error('[studentAttendance] face mark error:', err);
    return res.status(500).json({ ok: false, message: 'Facial recognition attendance failed.' });
  }
};
