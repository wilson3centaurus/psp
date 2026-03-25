const { supabase } = require('../../config/db');

// View grouped resource totals by subject (aggregated in JS)
exports.listResources = async (req, res) => {
  const { data: rows, error } = await supabase.from('resources').select('*');

  if (error) {
    console.error('Error fetching resources:', error);
    req.flash('error_msg', 'Unable to load resource data right now.');
    return res.redirect('/admin/dashboard');
  }

  // Aggregate by subject_name in JS
  const subjectMap = new Map();
  const totals = { subjects: 0, totalStudents: 0, totalBooks: 0, totalComputers: 0, totalRows: 0, totalSchools: 0 };
  const allSchoolIds = new Set();

  for (const r of (rows || [])) {
    const subj = r.subject_name || 'Unknown';
    if (!subjectMap.has(subj)) {
      subjectMap.set(subj, {
        subject_name: subj,
        total_students: 0, total_books: 0, total_computers: 0,
        record_count: 0, school_ids: new Set()
      });
    }
    const entry = subjectMap.get(subj);
    entry.total_students += Number(r.num_students) || 0;
    entry.total_books += Number(r.num_books) || 0;
    entry.total_computers += Number(r.num_computers) || 0;
    entry.record_count++;
    entry.school_ids.add(r.school_id);

    totals.totalStudents += Number(r.num_students) || 0;
    totals.totalBooks += Number(r.num_books) || 0;
    totals.totalComputers += Number(r.num_computers) || 0;
    totals.totalRows++;
    allSchoolIds.add(r.school_id);
  }

  const summary = [...subjectMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => ({
      subject_name: v.subject_name,
      total_students: v.total_students,
      total_books: v.total_books,
      total_computers: v.total_computers,
      record_count: v.record_count,
      school_count: v.school_ids.size
    }));

  totals.subjects = subjectMap.size;
  totals.totalSchools = allSchoolIds.size;

  res.render('admin/resources/index', {
    summary,
    totals,
    success_msg: req.flash('success_msg'),
    error_msg: req.flash('error_msg')
  });
};

