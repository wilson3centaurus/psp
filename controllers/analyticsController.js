const { supabase } = require('../config/db');

exports.analyticsPage = async (req, res) => {
  const [schoolsRes, studentsRes, teachersRes, resourcesRes] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'school'),
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('teachers').select('*', { count: 'exact', head: true }),
    supabase.from('resources').select('*', { count: 'exact', head: true })
  ]);

  res.render('admin/analytics', {
    stats: {
      schools: schoolsRes.count || 0,
      students: studentsRes.count || 0,
      teachers: teachersRes.count || 0,
      resources: resourcesRes.count || 0
    }
  });
};
