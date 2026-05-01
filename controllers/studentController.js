const { supabase } = require('../config/db');
const fs = require('fs');
const csv = require('csv-parser');

// View all students
exports.listStudents = async (req, res) => {
  const schoolId = req.session.user.id;
  const { data: rows, error } = await supabase
    .from('students')
    .select('*')
    .eq('school_id', schoolId);

  if (error) {
    console.error('[students] list error:', error);
    req.flash('error_msg', 'Failed to load students.');
  }

  res.render('school/students', {
    students: rows || [],
    query: ''
  });
};

// Show add student form
exports.addStudentPage = (req, res) => res.render('school/addstudent');

// Add single student
exports.addStudent = async (req, res) => {
  const { name, grade, student_class, gender, student_id } = req.body;
  const schoolId = req.session.user.id;

  const { error } = await supabase.from('students').insert({ name, grade, student_class, gender, student_id, school_id: schoolId });
  if (error) {
    console.error('[students] insert error:', error);
    req.flash('error_msg', `Failed to add student: ${error.message}`);
  } else {
    req.flash('success_msg', 'Student added successfully.');
  }
  res.redirect('/student');
};

// Bulk CSV upload
exports.uploadCSV = (req, res) => {
  if (!req.file) {
    req.flash('error_msg', 'No CSV file uploaded.');
    return res.redirect('/student');
  }

  const schoolId = req.session.user.id;
  const results = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', data => results.push(data))
    .on('end', async () => {
      if (results.length === 0) {
        req.flash('error_msg', 'CSV file is empty.');
        return res.redirect('/student');
      }
      const rows = results.map(row => ({
        name: row.name,
        grade: row.grade,
        student_class: row.student_class,
        gender: row.gender,
        student_id: row.student_id,
        school_id: schoolId
      }));
      const { error } = await supabase.from('students').insert(rows);
      if (error) {
        console.error('[students] CSV insert error:', error);
        req.flash('error_msg', `CSV upload failed: ${error.message}`);
      } else {
        req.flash('success_msg', `${rows.length} student(s) uploaded successfully.`);
      }
      res.redirect('/student');
    })
    .on('error', err => {
      console.error('[students] CSV read error:', err);
      req.flash('error_msg', 'Error reading CSV file.');
      res.redirect('/student');
    });
};

// Edit page
exports.editStudentPage = async (req, res) => {
  const { id } = req.params;
  const { data } = await supabase.from('students').select('*').eq('id', id).maybeSingle();
  if (!data) return res.redirect('/student');
  res.render('school/editStudent', { student: data });
};

// Update student
exports.updateStudent = async (req, res) => {
  const { id } = req.params;
  const { name, grade, student_class, gender, student_id } = req.body;
  const { error } = await supabase.from('students').update({ name, grade, student_class, gender, student_id }).eq('id', id);
  if (error) {
    console.error('[students] update error:', error);
    req.flash('error_msg', `Failed to update student: ${error.message}`);
  } else {
    req.flash('success_msg', 'Student updated successfully.');
  }
  res.redirect('/student');
};

// Delete student
exports.deleteStudent = async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('students').delete().eq('id', id);
  if (error) {
    console.error('[students] delete error:', error);
    req.flash('error_msg', `Failed to delete student: ${error.message}`);
  } else {
    req.flash('success_msg', 'Student deleted successfully.');
  }
  res.redirect('/student');
};

// Bulk delete students
exports.bulkDelete = async (req, res) => {
  const schoolId = req.session.user.id;
  let ids = req.body.ids;

  if (!ids || ids.length === 0) {
    req.flash('error_msg', 'No students selected');
    return res.redirect('/student');
  }

  if (!Array.isArray(ids)) ids = [ids];

  const { error, count } = await supabase
    .from('students')
    .delete({ count: 'exact' })
    .in('id', ids.map(Number))
    .eq('school_id', schoolId);

  if (error) {
    req.flash('error_msg', 'Failed to delete students');
  } else {
    req.flash('success_msg', `${count || ids.length} student(s) deleted`);
  }
  res.redirect('/student');
};

// SEARCH students
exports.searchStudents = async (req, res) => {
  const schoolId = req.session.user.id;
  const query = req.query.q ? req.query.q.trim() : '';

  if (!query) return res.redirect('/student');

  const w = `%${query}%`;
  const { data: rows, error } = await supabase
    .from('students')
    .select('*')
    .eq('school_id', schoolId)
    .or(`name.ilike.${w},student_class.ilike.${w},student_id.ilike.${w},grade.ilike.${w}`);

  if (error) {
    return res.status(500).render('error', { message: 'Search failed. Try again.' });
  }

  res.render('school/students', {
    students: rows || [],
    success_msg: (!rows || rows.length === 0) ? 'No matching students found.' : null,
    error_msg: null,
    query
  });
};

