const { pool } = require('../../config/db');

// Admin analytics dashboard — all data fetched via MySQL, aggregated in JS
exports.index = async (req, res) => {
  const lookbackDays = 30;
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - lookbackDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  try {
    const [
      [schools], [students], [teachers], [resources],
      [stuAtt], [tchAtt]
    ] = await Promise.all([
      pool.query("SELECT id, username FROM users WHERE role = 'school' ORDER BY username"),
      pool.query('SELECT id, school_id FROM students'),
      pool.query('SELECT id, school_id FROM teachers'),
      pool.query('SELECT school_id, subject_name, grade, num_students, num_books, num_computers FROM resources'),
      pool.query('SELECT student_id, school_id, date, status, late_minutes, early_minutes FROM student_attendance WHERE date >= ?', [cutoffStr]),
      pool.query('SELECT teacher_id, school_id, date, status FROM teacher_attendance WHERE date >= ?', [cutoffStr])
    ]);

    // --- Teacher-student per school ---
    const stuCountBySchool = new Map();
    students.forEach(s => stuCountBySchool.set(s.school_id, (stuCountBySchool.get(s.school_id) || 0) + 1));
    const tchCountBySchool = new Map();
    teachers.forEach(t => tchCountBySchool.set(t.school_id, (tchCountBySchool.get(t.school_id) || 0) + 1));

    const teacherStudentRows = schools.map(s => ({
      id: s.id,
      school_name: s.username || `School #${s.id}`,
      total_students: stuCountBySchool.get(s.id) || 0,
      total_teachers: tchCountBySchool.get(s.id) || 0
    }));

    // --- Resource ratios ---
    const resourceRatios = resources.map(r => {
      const school = schools.find(s => s.id === r.school_id);
      return {
        school_id: r.school_id,
        school_name: school?.username || `School #${r.school_id}`,
        subject_name: r.subject_name,
        grade: r.grade,
        total_students: Number(r.num_students) || 0,
        total_books: Number(r.num_books) || 0
      };
    });

    // Resource totals by school
    const resTotalsMap = new Map();
    resources.forEach(r => {
      if (!resTotalsMap.has(r.school_id)) resTotalsMap.set(r.school_id, { total_books: 0, total_computers: 0, resource_students: 0 });
      const e = resTotalsMap.get(r.school_id);
      e.total_books     += Number(r.num_books)     || 0;
      e.total_computers += Number(r.num_computers) || 0;
      e.resource_students += Number(r.num_students) || 0;
    });

    // Helper for date formatting (MySQL DATE columns come as Date objects or strings)
    const toDateStr = val => (val instanceof Date ? val.toISOString() : String(val || '')).slice(0, 10);

    // --- Attendance trends by date ---
    const stuTrendMap = new Map();
    stuAtt.forEach(a => {
      const d = toDateStr(a.date);
      if (!stuTrendMap.has(d)) stuTrendMap.set(d, { date: d, present: 0, absent: 0 });
      const e = stuTrendMap.get(d);
      if ((a.status || '').toLowerCase() === 'present') e.present++;
      else e.absent++;
    });
    const studentTrend = [...stuTrendMap.values()].sort((a, b) => a.date.localeCompare(b.date));

    const tchTrendMap = new Map();
    tchAtt.forEach(a => {
      const d = toDateStr(a.date);
      if (!tchTrendMap.has(d)) tchTrendMap.set(d, { date: d, present: 0, absent: 0 });
      const e = tchTrendMap.get(d);
      if ((a.status || '').toLowerCase() === 'present') e.present++;
      else e.absent++;
    });
    const teacherTrend = [...tchTrendMap.values()].sort((a, b) => a.date.localeCompare(b.date));

    // --- Attendance rates ---
    const stuPresent = stuAtt.filter(a => (a.status || '').toLowerCase() === 'present').length;
    const stuTotal   = stuAtt.length;
    const tchPresent = tchAtt.filter(a => (a.status || '').toLowerCase() === 'present').length;
    const tchTotal   = tchAtt.length;

    const attendanceRates = {
      students: stuTotal ? Math.round((stuPresent / stuTotal) * 1000) / 10 : 0,
      teachers: tchTotal ? Math.round((tchPresent / tchTotal) * 1000) / 10 : 0
    };
    const attendanceCounts = {
      students: { present: stuPresent, total: stuTotal, absent: stuTotal - stuPresent },
      teachers: { present: tchPresent, total: tchTotal, absent: tchTotal - tchPresent }
    };

    // --- Lateness heatmap by weekday ---
    const heatmap = [0, 1, 2, 3, 4].map(d => ({ weekday: d, total_late: 0, total_early: 0 }));
    stuAtt.forEach(a => {
      if (!a.date) return;
      const dow = new Date(toDateStr(a.date)).getUTCDay();
      const idx = dow === 0 ? 6 : dow - 1;
      if (idx >= 0 && idx < 5) {
        heatmap[idx].total_late  += Number(a.late_minutes)  || 0;
        heatmap[idx].total_early += Number(a.early_minutes) || 0;
      }
    });

    // --- Chronic absentees ---
    const absByStudent = new Map();
    stuAtt.forEach(a => {
      if ((a.status || '').toLowerCase() !== 'absent') return;
      absByStudent.set(a.student_id, (absByStudent.get(a.student_id) || 0) + 1);
    });
    const chronicIds = [...absByStudent.entries()]
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([id]) => id);

    let chronicAbsentees = [];
    if (chronicIds.length > 0) {
      const [chronicStudents] = await pool.query(
        'SELECT id, name, grade, student_class, school_id FROM students WHERE id IN (?)',
        [chronicIds]
      );
      chronicAbsentees = chronicStudents.map(s => {
        const school = schools.find(sc => sc.id === s.school_id);
        return {
          name: s.name,
          grade: s.grade,
          student_class: s.student_class,
          school_name: school?.username || `School #${s.school_id}`,
          absent_days: absByStudent.get(s.id) || 0,
          excused_days: 0
        };
      }).sort((a, b) => b.absent_days - a.absent_days);
    }

    // --- Attendance by school ---
    const stuAttBySchool = new Map();
    stuAtt.forEach(a => {
      if (!stuAttBySchool.has(a.school_id)) stuAttBySchool.set(a.school_id, { present: 0, total: 0 });
      const e = stuAttBySchool.get(a.school_id);
      e.total++;
      if ((a.status || '').toLowerCase() === 'present') e.present++;
    });
    const tchAttBySchool = new Map();
    tchAtt.forEach(a => {
      if (!tchAttBySchool.has(a.school_id)) tchAttBySchool.set(a.school_id, { present: 0, total: 0 });
      const e = tchAttBySchool.get(a.school_id);
      e.total++;
      if ((a.status || '').toLowerCase() === 'present') e.present++;
    });

    // --- Performance features ---
    const performanceFeatures = teacherStudentRows.map(row => {
      const schoolId = row.id;
      const resTotals = resTotalsMap.get(schoolId) || {};
      const stuAttSch = stuAttBySchool.get(schoolId) || { present: 0, total: 0 };
      const tchAttSch = tchAttBySchool.get(schoolId) || { present: 0, total: 0 };
      const studentAttendanceRate = stuAttSch.total ? stuAttSch.present / stuAttSch.total : 0;
      const teacherAttendanceRate = tchAttSch.total ? tchAttSch.present / tchAttSch.total : 0;
      const booksPerStudent = row.total_students ? (Number(resTotals.total_books || 0) / row.total_students) : 0;
      const computersPerStudent = row.total_students ? (Number(resTotals.total_computers || 0) / row.total_students) : 0;
      const teacherStudentRatio = row.total_teachers ? (row.total_students / row.total_teachers) : row.total_students;
      return { schoolId, schoolName: row.school_name, studentAttendanceRate, teacherAttendanceRate, booksPerStudent, computersPerStudent, teacherStudentRatio };
    });

    res.render('admin/analytics/index', {
      teacherStudent: teacherStudentRows,
      resourceRatios,
      chartData: {
        labels: teacherStudentRows.map(r => r.school_name),
        values: teacherStudentRows.map(r => r.total_students)
      },
      attendanceTrend: { students: studentTrend, teachers: teacherTrend },
      attendanceRates,
      attendanceCounts,
      latenessHeatmap: heatmap,
      chronicAbsentees,
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