const db = require('../config/db');
const fs = require('fs');
const csv = require('csv-parser');

/* ===========================
   1. LIST TEACHER SESSIONS
=========================== */
exports.listSessions = (req, res) => {
  const schoolId = req.session.user.id;
  const searchDate = req.query.searchDate || "";

  let sql = `
    SELECT DISTINCT DATE_FORMAT(date, '%Y-%m-%d') AS date
    FROM teacher_attendance
    WHERE school_id = ?
  `;
  const params = [schoolId];

  if (searchDate) {
    sql += ` AND date = ?`;
    params.push(searchDate);
  }

  sql += ` ORDER BY date DESC`;

  db.query(sql, params, (err, rows) => {
    if (err) throw err;

    res.render("school/teacherAttendance/sessions", {
      sessions: rows,
      searchDate,
      success_msg: req.flash("success_msg"),
      error_msg: req.flash("error_msg")
    });
  });
};

/* ===========================
   2. MARK ATTENDANCE PAGE
=========================== */
exports.markAttendancePage = (req, res) => {
  const schoolId = req.session.user.id;
  const selectedDate = req.query.date || "";

  const sql = `
    SELECT *
    FROM teachers
    WHERE school_id = ?
    ORDER BY name ASC
  `;

  db.query(sql, [schoolId], (err, teacherRows) => {
    if (err) throw err;

    res.render("school/teacherAttendance/mark", {
      teachers: teacherRows,
      selectedDate,
      success_msg: req.flash("success_msg"),
      error_msg: req.flash("error_msg")
    });
  });
};

/* ===========================
   3. SUBMIT MANUAL ATTENDANCE
=========================== */
exports.submitAttendance = (req, res) => {
  const schoolId = req.session.user.id;
  const { date } = req.body;

  if (!date) {
    req.flash("error_msg", "Please select a date.");
    return res.redirect("/teacher-attendance");
  }

  const submittedKeys = Object.keys(req.body).filter(k => k.startsWith("status_"));
  if (submittedKeys.length === 0) {
    req.flash("error_msg", "No attendance submitted.");
    return res.redirect("/teacher-attendance");
  }

  const attendanceRows = submittedKeys.map(key => {
    const teacherId = key.split("_")[1];
    const status = req.body[key];
    const reason = req.body[`reason_${teacherId}`] || '';
    const excused = req.body[`excused_${teacherId}`] ? 1 : 0;
    const lateMinutes = Number(req.body[`late_${teacherId}`]) || 0;
    const earlyMinutes = Number(req.body[`early_${teacherId}`]) || 0;

    return [teacherId, schoolId, date, status, reason, excused, lateMinutes, earlyMinutes];
  });

  const sql = `
    INSERT INTO teacher_attendance (teacher_id, school_id, date, status, reason, excused, late_minutes, early_minutes)
    VALUES ?
  `;

  db.query(sql, [attendanceRows], err => {
    if (err) {
      console.error("Manual insert error:", err);
      req.flash("error_msg", "Failed to save attendance.");
    } else {
      req.flash("success_msg", "Attendance recorded.");
    }
    res.redirect("/teacher-attendance");
  });
};

/* ===========================
   4. UPLOAD CSV
=========================== */
exports.uploadCSV = (req, res) => {
  const schoolId = req.session.user.id;
  const date = req.body.date; // ✅ FIXED: use form date

  if (!req.file) {
    req.flash("error_msg", "No CSV file uploaded.");
    return res.redirect("/teacher-attendance");
  }

  if (!date) {
    req.flash("error_msg", "Please select a date before uploading.");
    return res.redirect("/teacher-attendance");
  }

  db.query(`SELECT id, teacher_id FROM teachers WHERE school_id = ?`, [schoolId], (err, teacherRows) => {
    if (err) {
      console.error("Teacher lookup failed:", err);
      req.flash("error_msg", "Server error.");
      return res.redirect("/teacher-attendance");
    }

    const codeToId = {};
    teacherRows.forEach(t => {
      if (t.teacher_id) codeToId[t.teacher_id.trim()] = t.id;
    });

    const parsedRows = [];

    // Read CSV rows
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on("data", row => {
        const code = row.teacher_id?.trim();
        const status = row.status?.trim();

        if (!code || !status) return;
        if (!["Present", "Absent"].includes(status)) return;

        const teacherDbId = codeToId[code];
        if (!teacherDbId) {
          console.warn(`⚠️ Unknown teacher_id: ${code}`);
          return;
        }

        parsedRows.push([
          teacherDbId,
          schoolId,
          date,
          status,
          row.reason ? String(row.reason).trim() : '',
          row.excused ? 1 : 0,
          row.late_minutes ? Number(row.late_minutes) || 0 : 0,
          row.early_minutes ? Number(row.early_minutes) || 0 : 0
        ]);
      })
      .on("end", () => {
        if (parsedRows.length === 0) {
          req.flash("error_msg", "No valid rows found in CSV.");
          return res.redirect("/teacher-attendance");
        }

        const sql = `
          INSERT INTO teacher_attendance (teacher_id, school_id, date, status, reason, excused, late_minutes, early_minutes)
          VALUES ?
        `;

        db.query(sql, [parsedRows], err => {
          if (err) {
            console.error("Insert error:", err);
            req.flash("error_msg", "Failed to upload CSV.");
          } else {
            req.flash("success_msg", "Teacher attendance uploaded successfully.");
          }
          return res.redirect("/teacher-attendance");
        });
      })
      .on("error", err => {
        console.error("CSV read error:", err);
        req.flash("error_msg", "Failed to read CSV file.");
        return res.redirect("/teacher-attendance");
      });
  });
};


/* ===========================
   5. VIEW SESSION
=========================== */
exports.viewSession = (req, res) => {
  const schoolId = req.session.user.id;
  const date = req.params.date;

  const sql = `
    SELECT 
      t.teacher_id AS teacherCode,
      t.name,
      t.email,
      t.phone,
      t.subject,
      a.status,
      a.reason,
      a.excused,
      a.late_minutes,
      a.early_minutes
    FROM teacher_attendance a
    JOIN teachers t ON a.teacher_id = t.id
    WHERE a.school_id = ? AND a.date = ?
    ORDER BY t.name ASC
  `;

  db.query(sql, [schoolId, date], (err, rows) => {
    if (err) throw err;

    res.render("school/teacherAttendance/view", {
      records: rows,
      date
    });
  });
};
