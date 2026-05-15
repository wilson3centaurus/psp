const { pool } = require('../config/db');

exports.analyticsPage = async (req, res) => {
  try {
    const [[[schools]], [[students]], [[teachers]], [[resources]]] = await Promise.all([
      pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'school'"),
      pool.query('SELECT COUNT(*) AS count FROM students'),
      pool.query('SELECT COUNT(*) AS count FROM teachers'),
      pool.query('SELECT COUNT(*) AS count FROM resources')
    ]);
    res.render('admin/analytics', {
      stats: {
        schools:   schools.count   || 0,
        students:  students.count  || 0,
        teachers:  teachers.count  || 0,
        resources: resources.count || 0
      }
    });
  } catch (err) {
    console.error('[analytics] error:', err);
    res.render('admin/analytics', { stats: { schools: 0, students: 0, teachers: 0, resources: 0 } });
  }
};
