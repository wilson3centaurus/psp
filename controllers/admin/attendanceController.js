const { pool } = require('../../config/db');

// Weekly attendance summary across all schools (aggregated in JS)
exports.listWeeklySummary = async (req, res) => {
  try {
    const [[stuRows], [tchRows]] = await Promise.all([
      pool.query('SELECT date, status FROM student_attendance'),
      pool.query('SELECT date, status FROM teacher_attendance')
    ]);

    // Get ISO week start (Monday) for a date string
    function weekStart(dateStr) {
      const d = new Date(dateStr);
      const day = d.getUTCDay(); // 0=Sun
      const diff = (day === 0 ? -6 : 1 - day);
      d.setUTCDate(d.getUTCDate() + diff);
      return d.toISOString().slice(0, 10);
    }

    // Aggregate student absences by week
    const stuByWeek = new Map();
    let totalAbsentStudents = 0;
    for (const r of stuRows) {
      if (!r.date) continue;
      const ws = weekStart(r.date instanceof Date ? r.date.toISOString() : String(r.date));
      if (!stuByWeek.has(ws)) stuByWeek.set(ws, 0);
      if ((r.status || '').toLowerCase().trim() === 'absent') {
        stuByWeek.set(ws, stuByWeek.get(ws) + 1);
        totalAbsentStudents++;
      }
    }

    // Aggregate teacher absences by week
    const tchByWeek = new Map();
    let totalAbsentTeachers = 0;
    for (const r of tchRows) {
      if (!r.date) continue;
      const ws = weekStart(r.date instanceof Date ? r.date.toISOString() : String(r.date));
      if (!tchByWeek.has(ws)) tchByWeek.set(ws, 0);
      if ((r.status || '').toLowerCase().trim() === 'absent') {
        tchByWeek.set(ws, tchByWeek.get(ws) + 1);
        totalAbsentTeachers++;
      }
    }

    // Build combined set of all weeks
    const allWeeks = new Set([...stuByWeek.keys(), ...tchByWeek.keys()]);

    const weeks = [...allWeeks]
      .sort((a, b) => b.localeCompare(a))
      .map(ws => {
        const start = new Date(ws);
        const end = new Date(ws);
        end.setUTCDate(end.getUTCDate() + 6);
        const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' });
        return {
          week_start: ws,
          week_label: `${fmt(start)}-${fmt(end)}`,
          absent_students: stuByWeek.get(ws) || 0,
          absent_teachers: tchByWeek.get(ws) || 0
        };
      });

    const totals = {
      weeks: weeks.length,
      absentStudents: totalAbsentStudents,
      absentTeachers: totalAbsentTeachers
    };

    res.render('admin/attendance/index', {
      weeks,
      totals,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (err) {
    console.error('Error fetching attendance:', err);
    req.flash('error_msg', 'Unable to load attendance summary right now.');
    return res.redirect('/admin/dashboard');
  }
};
