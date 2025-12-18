const db = require('../config/db');
const fs = require('fs');
const csv = require('csv-parser');

/* ===========================
   1. LIST ATTENDANCE SESSIONS
=========================== */
exports.listSessions = (req, res) => {
  const schoolId = req.session.user.id;
  const searchDate = req.query.date || "";

  let sql = `
    SELECT DISTINCT DATE_FORMAT(date, '%Y-%m-%d') AS date
    FROM student_attendance
    WHERE school_id = ?
  `;
  const params = [schoolId];

  if (searchDate) {
    sql += " AND DATE(date) = ?";
    params.push(searchDate);
  }

  sql += " ORDER BY date DESC";

  db.query(sql, params, (err, rows) => {
    if (err) throw err;

    res.render('school/studentAttendance/sessions', {
      sessions: rows,
      searchDate,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  });
};


/* ===========================
   2. MARK PAGE (GRADE → CLASS + DATE)
=========================== */
exports.markAttendancePage = (req, res) => {
  const schoolId = req.session.user.id;

  const selectedGrade = req.query.grade || "";
  const selectedClass = req.query.class || "";
  const selectedDate = req.query.date || "";

  const gradeQuery = `
    SELECT DISTINCT grade FROM students 
    WHERE school_id = ? ORDER BY grade ASC
  `;

  db.query(gradeQuery, [schoolId], (err, gradeRows) => {
    if (err) throw err;
    const grades = gradeRows.map(r => r.grade);

    if (!selectedGrade) {
      return res.render("school/studentAttendance/mark", {
        grades,
        classes: [],
        students: [],
        selectedGrade: "",
        selectedClass: "",
        selectedDate: "",
        success_msg: req.flash("success_msg"),
        error_msg: req.flash("error_msg")
      });
    }

    const classQuery = `
      SELECT DISTINCT student_class FROM students
      WHERE school_id = ? AND grade = ?
      ORDER BY student_class ASC
    `;

    db.query(classQuery, [schoolId, selectedGrade], (err2, classRows) => {
      if (err2) throw err2;
      const classes = classRows.map(r => r.student_class);

      if (!selectedClass) {
        return res.render("school/studentAttendance/mark", {
          grades,
          classes,
          students: [],
          selectedGrade,
          selectedClass: "",
          selectedDate: "",
          success_msg: req.flash("success_msg"),
          error_msg: req.flash("error_msg")
        });
      }

      const studentQuery = `
        SELECT * FROM students
        WHERE school_id = ? AND grade = ? AND student_class = ?
        ORDER BY name ASC
      `;

      db.query(studentQuery, [schoolId, selectedGrade, selectedClass], (err3, studentRows) => {
        if (err3) throw err3;

        res.render("school/studentAttendance/mark", {
          grades,
          classes,
          students: studentRows,
          selectedGrade,
          selectedClass,
          selectedDate,
          success_msg: req.flash("success_msg"),
          error_msg: req.flash("error_msg")
        });
      });
    });
  });
};


/* ===========================
   3. SUBMIT MANUAL ATTENDANCE (Radio Inputs)
=========================== */
exports.submitAttendance = (req, res) => {
  const schoolId = req.session.user.id;
  const { grade, student_class, date } = req.body;

  if (!date) {
    req.flash('error_msg', 'Date is required.');
    return res.redirect('/student-attendance');
  }

  const query = `
    SELECT id FROM students
    WHERE school_id = ? AND grade = ? AND student_class = ?
  `;

  db.query(query, [schoolId, grade, student_class], (err, students) => {
    if (err) throw err;

    const attendanceData = students.map(s => {
      const status = req.body[`status_${s.id}`];
      const reason = req.body[`reason_${s.id}`] || '';
      const excused = req.body[`excused_${s.id}`] ? 1 : 0;
      const lateMinutes = Number(req.body[`late_${s.id}`]) || 0;
      const earlyMinutes = Number(req.body[`early_${s.id}`]) || 0;

      return [
        s.id,
        schoolId,
        date,
        status === 'Present' ? 'Present' : 'Absent',
        reason,
        excused,
        lateMinutes,
        earlyMinutes
      ];
    });

    const insertSQL = `
      INSERT INTO student_attendance (student_id, school_id, date, status, reason, excused, late_minutes, early_minutes)
      VALUES ?
    `;

    db.query(insertSQL, [attendanceData], (err2) => {
      if (err2) {
        console.error(err2);
        req.flash('error_msg', 'Failed to record attendance.');
      } else {
        req.flash('success_msg', 'Attendance saved successfully.');
      }
      res.redirect('/student-attendance');
    });
  });
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

  const date = new Date().toISOString().split("T")[0];
  const attendanceRows = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (row) => {
      if (row.student_id && row.status) {
        const status = row.status.trim();
        attendanceRows.push([
          row.student_id,
          schoolId,
          date,
          status,
          row.reason ? String(row.reason).trim() : '',
          row.excused ? 1 : 0,
          row.late_minutes ? Number(row.late_minutes) || 0 : 0,
          row.early_minutes ? Number(row.early_minutes) || 0 : 0
        ]);
      }
    })
    .on("end", () => {
      const sql = `
        INSERT INTO student_attendance (student_id, school_id, date, status, reason, excused, late_minutes, early_minutes)
        VALUES ?
      `;
      db.query(sql, [attendanceRows], (err) => {
        if (err) {
          console.log(err);
          req.flash('error_msg', 'CSV upload failed.');
        } else {
          req.flash('success_msg', 'CSV attendance imported.');
        }
        res.redirect('/student-attendance');
      });
    });
};


/* ===========================
   5. VIEW ATTENDANCE SESSION
=========================== */
exports.viewSession = (req, res) => {
  const schoolId = req.session.user.id;
  const date = req.params.date;

  const sql = `
    SELECT 
      s.name,
      s.grade,
      s.student_class,
      a.status,
      a.reason,
      a.excused,
      a.late_minutes,
      a.early_minutes
    FROM student_attendance a
    JOIN students s ON a.student_id = s.id
    WHERE a.school_id = ? AND DATE(a.date) = ?
    ORDER BY s.grade, s.student_class, s.name
  `;

  db.query(sql, [schoolId, date], (err, rows) => {
    if (err) throw err;

    res.render("school/studentAttendance/view", {
      records: rows,
      date
    });
  });
};
