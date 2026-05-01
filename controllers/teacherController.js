const { supabase } = require('../config/db');
const fs = require('fs');
const csv = require('csv-parser');

/* ===========================
   1. LIST TEACHERS
=========================== */
exports.listTeachers = async (req, res) => {
  const schoolId = req.session.user.id;
  const { data: rows } = await supabase
    .from('teachers')
    .select('*')
    .eq('school_id', schoolId)
    .order('name');

  res.render('school/teachers', {
    teachers: rows || [],
    query: ''
  });
};

/* ===========================
   2. ADD TEACHER PAGE
=========================== */
exports.addTeacherPage = (req, res) => {
  res.render('school/addTeacher');
};

/* ===========================
   3. ADD A TEACHER
=========================== */
exports.addTeacher = async (req, res) => {
  const { name, subject, gender, email, phone, teacher_id } = req.body;
  const schoolId = req.session.user.id;

  const { error } = await supabase.from('teachers').insert({
    name, subject, gender, email, phone, teacher_id, school_id: schoolId
  });

  if (error) {
    req.flash('error_msg', 'Could not add teacher');
  } else {
    req.flash('success_msg', 'Teacher added');
  }
  res.redirect('/teacher');
};

/* ===========================
   4. UPLOAD CSV
=========================== */
exports.uploadCSV = (req, res) => {
  const schoolId = req.session.user.id;

  if (!req.file) {
    req.flash('error_msg', 'Upload a CSV file');
    return res.redirect('/teacher');
  }

  const rows = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', row => rows.push(row))
    .on('end', async () => {
      if (rows.length === 0) {
        req.flash('error_msg', 'CSV file empty');
        return res.redirect('/teacher');
      }

      const records = rows.map(r => ({
        name: r.name || '',
        subject: r.subject || '',
        gender: r.gender || r.Gender || r.GENDER || r.sex || r.Sex || r.SEX || '',
        email: r.email || '',
        phone: r.phone || '',
        teacher_id: r.teacher_id || '',
        school_id: schoolId
      }));

      const { error } = await supabase.from('teachers').insert(records);
      if (error) {
        console.error('CSV import error:', error);
        req.flash('error_msg', 'CSV import failed');
      } else {
        req.flash('success_msg', 'CSV imported successfully');
      }
      res.redirect('/teacher');
    });
};

/* ===========================
   5. EDIT TEACHER PAGE
=========================== */
exports.editTeacherPage = async (req, res) => {
  const id = req.params.id;
  const { data, error } = await supabase.from('teachers').select('*').eq('id', id).maybeSingle();

  if (error || !data) {
    req.flash('error_msg', 'Teacher not found');
    return res.redirect('/teacher');
  }

  res.render('school/editTeacher', { teacher: data });
};

/* ===========================
   6. UPDATE TEACHER
=========================== */
exports.updateTeacher = async (req, res) => {
  const { id } = req.params;
  const { name, subject, gender, email, phone, teacher_id } = req.body;

  const { error } = await supabase.from('teachers')
    .update({ name, subject, gender, email, phone, teacher_id })
    .eq('id', id);

  if (error) {
    req.flash('error_msg', 'Could not update teacher');
  } else {
    req.flash('success_msg', 'Teacher updated');
  }
  res.redirect('/teacher');
};

/* ===========================
   7. DELETE TEACHER
=========================== */
exports.deleteTeacher = async (req, res) => {
  const id = req.params.id;
  const { error } = await supabase.from('teachers').delete().eq('id', id);

  if (error) {
    req.flash('error_msg', 'Delete failed');
  } else {
    req.flash('success_msg', 'Teacher deleted');
  }
  res.redirect('/teacher');
};

/* ===========================
   8. SEARCH TEACHERS
=========================== */
exports.searchTeachers = async (req, res) => {
  const schoolId = req.session.user.id;
  const q = req.query.q ? req.query.q.trim() : '';

  if (!q) return res.redirect('/teacher');

  const w = `%${q}%`;
  const { data: rows, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('school_id', schoolId)
    .or(`name.ilike.${w},subject.ilike.${w},teacher_id.ilike.${w},email.ilike.${w},phone.ilike.${w}`)
    .order('name');

  if (error) {
    return res.render('school/teachers', { teachers: [], query: q, error_msg: 'Search error', success_msg: null });
  }

  res.render('school/teachers', {
    teachers: rows || [],
    query: q,
    success_msg: (!rows || rows.length === 0) ? 'No matches found' : null,
    error_msg: null
  });
};

/* ===========================
   9. BULK DELETE TEACHERS
=========================== */
exports.bulkDelete = async (req, res) => {
  const schoolId = req.session.user.id;
  let ids = req.body.ids;

  if (!ids || ids.length === 0) {
    req.flash('error_msg', 'No teachers selected');
    return res.redirect('/teacher');
  }

  if (!Array.isArray(ids)) ids = [ids];

  const { error, count } = await supabase
    .from('teachers')
    .delete({ count: 'exact' })
    .in('id', ids.map(Number))
    .eq('school_id', schoolId);

  if (error) {
    req.flash('error_msg', 'Failed to delete teachers');
  } else {
    req.flash('success_msg', `${count || ids.length} teacher(s) deleted`);
  }
  res.redirect('/teacher');
};
