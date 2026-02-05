const db = require('../../config/db');

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

// Admin analytics dashboard + insights
exports.index = async (req, res) => {
  const lookbackDays = 30;

  try {
    const teacherStudentSql = `
      SELECT
        u.id,
        COALESCE(u.username, CONCAT('School #', u.id)) AS school_name,
        COALESCE(stu.total_students, 0) AS total_students,
        COALESCE(tch.total_teachers, 0) AS total_teachers
      FROM users u
      LEFT JOIN (
        SELECT school_id, COUNT(*) AS total_students
        FROM students
        GROUP BY school_id
      ) stu ON stu.school_id = u.id
      LEFT JOIN (
        SELECT school_id, COUNT(*) AS total_teachers
        FROM teachers
        GROUP BY school_id
      ) tch ON tch.school_id = u.id
      WHERE u.role = 'school'
      ORDER BY u.username ASC
    `;

    const resourceRatioSql = `
      SELECT
        r.school_id,
        COALESCE(u.username, CONCAT('School #', r.school_id)) AS school_name,
        r.subject_name,
        r.grade,
        SUM(r.num_students) AS total_students,
        SUM(r.num_books) AS total_books
      FROM resources r
      LEFT JOIN users u ON u.id = r.school_id AND u.role = 'school'
      GROUP BY r.school_id, u.username, r.subject_name, r.grade
      ORDER BY school_name ASC, r.subject_name ASC, r.grade ASC
    `;

    const resourceTotalsSql = `
      SELECT
        r.school_id,
        SUM(r.num_books) AS total_books,
        SUM(r.num_computers) AS total_computers,
        SUM(r.num_students) AS resource_students
      FROM resources r
      GROUP BY r.school_id
    `;

    const studentTrendSql = `
      SELECT
        DATE(date) AS date,
        SUM(CASE WHEN LOWER(status) = 'present' THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN LOWER(status) = 'absent' THEN 1 ELSE 0 END) AS absent
      FROM student_attendance
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(date)
      ORDER BY DATE(date)
    `;

    const teacherTrendSql = `
      SELECT
        DATE(date) AS date,
        SUM(CASE WHEN LOWER(status) = 'present' THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN LOWER(status) = 'absent' THEN 1 ELSE 0 END) AS absent
      FROM teacher_attendance
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(date)
      ORDER BY DATE(date)
    `;

    const studentAttendanceBySchoolSql = `
      SELECT
        school_id,
        SUM(CASE WHEN LOWER(status) = 'present' THEN 1 ELSE 0 END) AS present,
        COUNT(*) AS total
      FROM student_attendance
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY school_id
    `;

    const teacherAttendanceBySchoolSql = `
      SELECT
        school_id,
        SUM(CASE WHEN LOWER(status) = 'present' THEN 1 ELSE 0 END) AS present,
        COUNT(*) AS total
      FROM teacher_attendance
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY school_id
    `;

    const studentRateSql = `
      SELECT
        SUM(CASE WHEN LOWER(status) = 'present' THEN 1 ELSE 0 END) AS present,
        COUNT(*) AS total
      FROM student_attendance
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `;

    const teacherRateSql = `
      SELECT
        SUM(CASE WHEN LOWER(status) = 'present' THEN 1 ELSE 0 END) AS present,
        COUNT(*) AS total
      FROM teacher_attendance
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `;

    const latenessHeatmapSql = `
      SELECT
        WEEKDAY(date) AS weekday,
        SUM(COALESCE(late_minutes, 0)) AS total_late,
        SUM(COALESCE(early_minutes, 0)) AS total_early
      FROM student_attendance
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY WEEKDAY(date)
      ORDER BY WEEKDAY(date)
    `;

    const chronicSql = `
      SELECT
        s.name,
        s.grade,
        s.student_class,
        COALESCE(u.username, CONCAT('School #', s.school_id)) AS school_name,
        COUNT(*) AS absent_days,
        SUM(COALESCE(a.excused, 0)) AS excused_days
      FROM student_attendance a
      JOIN students s ON a.student_id = s.id
      LEFT JOIN users u ON u.id = a.school_id
      WHERE LOWER(a.status) = 'absent'
        AND a.date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY s.id, s.name, s.grade, s.student_class, s.school_id, u.username
      HAVING absent_days >= 3
      ORDER BY absent_days DESC, s.grade ASC
      LIMIT 15
    `;

    const [
      teacherStudentRows,
      resourceRows,
      studentTrend,
      teacherTrend,
      studentRateRows,
      teacherRateRows,
      latenessRows,
      chronicRows,
      resourceTotalsRows,
      studentAttendanceBySchool,
      teacherAttendanceBySchool
    ] = await Promise.all([
      runQuery(teacherStudentSql),
      runQuery(resourceRatioSql),
      runQuery(studentTrendSql, [lookbackDays]),
      runQuery(teacherTrendSql, [lookbackDays]),
      runQuery(studentRateSql, [lookbackDays]),
      runQuery(teacherRateSql, [lookbackDays]),
      runQuery(latenessHeatmapSql, [lookbackDays]),
      runQuery(chronicSql, [lookbackDays]),
      runQuery(resourceTotalsSql),
      runQuery(studentAttendanceBySchoolSql, [lookbackDays]),
      runQuery(teacherAttendanceBySchoolSql, [lookbackDays])
    ]);

    const chartLabels = teacherStudentRows.map(r => r.school_name);
    const chartValues = teacherStudentRows.map(r => Number(r.total_students) || 0);

    const studentRate = studentRateRows?.[0] || { present: 0, total: 0 };
    const teacherRate = teacherRateRows?.[0] || { present: 0, total: 0 };
    const attendanceRates = {
      students: studentRate.total ? Math.round((studentRate.present / studentRate.total) * 1000) / 10 : 0,
      teachers: teacherRate.total ? Math.round((teacherRate.present / teacherRate.total) * 1000) / 10 : 0
    };
    const attendanceCounts = {
      students: {
        present: Number(studentRate.present || 0),
        total: Number(studentRate.total || 0),
        absent: Math.max(0, Number(studentRate.total || 0) - Number(studentRate.present || 0))
      },
      teachers: {
        present: Number(teacherRate.present || 0),
        total: Number(teacherRate.total || 0),
        absent: Math.max(0, Number(teacherRate.total || 0) - Number(teacherRate.present || 0))
      }
    };

    const trends = {
      students: studentTrend,
      teachers: teacherTrend
    };

    // Build feature set per school for client-side prediction (brain.js in browser)
    const resTotalsMap = new Map(resourceTotalsRows.map(r => [r.school_id, r]));
    const stuAttMap = new Map(studentAttendanceBySchool.map(r => [r.school_id, r]));
    const tchAttMap = new Map(teacherAttendanceBySchool.map(r => [r.school_id, r]));

    const performanceFeatures = teacherStudentRows.map(row => {
      const schoolId = row.id;
      const resTotals = resTotalsMap.get(schoolId) || {};
      const stuAtt = stuAttMap.get(schoolId) || { present: 0, total: 0 };
      const tchAtt = tchAttMap.get(schoolId) || { present: 0, total: 0 };

      const studentAttendanceRate = stuAtt.total ? stuAtt.present / stuAtt.total : 0;
      const teacherAttendanceRate = tchAtt.total ? tchAtt.present / tchAtt.total : 0;
      const booksPerStudent = row.total_students ? (Number(resTotals.total_books || 0) / row.total_students) : 0;
      const computersPerStudent = row.total_students ? (Number(resTotals.total_computers || 0) / row.total_students) : 0;
      const teacherStudentRatio = row.total_teachers ? (row.total_students / row.total_teachers) : row.total_students;

      return {
        schoolId,
        schoolName: row.school_name,
        studentAttendanceRate,
        teacherAttendanceRate,
        booksPerStudent,
        computersPerStudent,
        teacherStudentRatio
      };
    });

    res.render('admin/analytics/index', {
      teacherStudent: teacherStudentRows,
      resourceRatios: resourceRows,
      chartData: { labels: chartLabels, values: chartValues },
      attendanceTrend: trends,
      attendanceRates,
      attendanceCounts,
      latenessHeatmap: latenessRows,
      chronicAbsentees: chronicRows,
      performanceFeatures,
      lookbackDays,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (err) {
    console.error('Error loading analytics:', err);
    req.flash('error_msg', 'Unable to load analytics right now.');
    return res.redirect('/admin/dashboard');
  }
};
