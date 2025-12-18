const db = require('../../config/db');

// Weekly attendance summary across all schools
exports.listWeeklySummary = (req, res) => {
  const weeklySql = `
    SELECT
      w.year_week,
      CONCAT(
        DATE_FORMAT(w.start_date, '%b %e'),
        '-',
        DATE_FORMAT(w.end_date, '%b %e')
      ) AS week_label,
      COALESCE(s.absent_students, 0) AS absent_students,
      COALESCE(t.absent_teachers, 0) AS absent_teachers
    FROM (
      SELECT
        year_week,
        MIN(start_of_week) AS start_date,
        DATE_ADD(MIN(start_of_week), INTERVAL 6 DAY) AS end_date
      FROM (
        SELECT
          YEARWEEK(date, 1) AS year_week,
          DATE_SUB(DATE(date), INTERVAL WEEKDAY(date) DAY) AS start_of_week
        FROM (
          SELECT date FROM student_attendance
          UNION ALL
          SELECT date FROM teacher_attendance
        ) d0
      ) d1
      GROUP BY year_week
    ) w
    LEFT JOIN (
      SELECT
        YEARWEEK(date, 1) AS year_week,
        SUM(CASE WHEN TRIM(LOWER(status)) = 'absent' THEN 1 ELSE 0 END) AS absent_students
      FROM student_attendance
      GROUP BY YEARWEEK(date, 1)
    ) s ON s.year_week = w.year_week
    LEFT JOIN (
      SELECT
        YEARWEEK(date, 1) AS year_week,
        SUM(CASE WHEN TRIM(LOWER(status)) = 'absent' THEN 1 ELSE 0 END) AS absent_teachers
      FROM teacher_attendance
      GROUP BY YEARWEEK(date, 1)
    ) t ON t.year_week = w.year_week
    ORDER BY w.year_week DESC
  `;

  const totalsSql = `
    SELECT
      (SELECT COALESCE(SUM(CASE WHEN TRIM(LOWER(status)) = 'absent' THEN 1 ELSE 0 END), 0) FROM student_attendance) AS absent_students,
      (SELECT COALESCE(SUM(CASE WHEN TRIM(LOWER(status)) = 'absent' THEN 1 ELSE 0 END), 0) FROM teacher_attendance) AS absent_teachers
  `;

  db.query(weeklySql, (weeklyErr, weeklyRows) => {
    if (weeklyErr) {
      console.error('Error fetching weekly attendance summary:', weeklyErr);
      req.flash('error_msg', 'Unable to load attendance summary right now.');
      return res.redirect('/admin/dashboard');
    }

    db.query(totalsSql, (totalsErr, totalsRows) => {
      if (totalsErr) {
        console.error('Error fetching attendance totals:', totalsErr);
        req.flash('error_msg', 'Unable to load attendance totals right now.');
        return res.redirect('/admin/dashboard');
      }

      const totalsRow = totalsRows[0] || {};
      const totals = {
        weeks: weeklyRows.length,
        absentStudents: totalsRow.absent_students || 0,
        absentTeachers: totalsRow.absent_teachers || 0
      };

      res.render('admin/attendance/index', {
        weeks: weeklyRows,
        totals,
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
      });
    });
  });
};
