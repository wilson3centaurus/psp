const { pool } = require('../config/db');
const fs = require('fs');
const csv = require('csv-parser');

// View all students
exports.listStudents = async (req, res) => {
  const schoolId = req.session.user.id;
  try {
    const [rows] = await pool.query('SELECT * FROM students WHERE school_id = ?', [schoolId]);
    res.render('school/students', { students: rows, query: '' });
  } catch (err) {
    console.error('[students] list error:', err);
    req.flash('error_msg', 'Failed to load students.');
    res.render('school/students', { students: [], query: '' });
  }
};

// Show add student form
exports.addStudentPage = (req, res) => res.render('school/addstudent');

// Add single student
exports.addStudent = async (req, res) => {
  const { name, grade, student_class, gender, student_id } = req.body;
  const schoolId = req.session.user.id;

  try {
    await pool.query(
      'INSERT INTO students (name, grade, student_class, gender, student_id, school_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, grade, student_class, gender, student_id, schoolId]
    );
    req.flash('success_msg', 'Student added successfully.');
  } catch (err) {
    console.error('[students] insert error:', err);
    req.flash('error_msg', `Failed to add student: ${err.message}`);
  }
  res.redirect('/student');
};

// Bulk CSV upload
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
      try {
        for (const row of results) {
          await pool.query(
            'INSERT INTO students (name, grade, student_class, gender, student_id, school_id) VALUES (?, ?, ?, ?, ?, ?)',
            [row.name, row.grade, row.student_class, row.gender, row.student_id, schoolId]
          );
        }
        req.flash('success_msg', `${results.length} student(s) uploaded successfully.`);
      } catch (err) {
        console.error('[students] CSV insert error:', err);
        req.flash('error_msg', `CSV upload failed: ${err.message}`);
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
  try {
    const [rows] = await pool.query('SELECT * FROM students WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return res.redirect('/student');
    res.render('school/editStudent', { student: rows[0] });
  } catch (err) {
    return res.redirect('/student');
  }
};

// Update student
exports.updateStudent = async (req, res) => {
  const { id } = req.params;
  const { name, grade, student_class, gender, student_id } = req.body;
  try {
    await pool.query(
      'UPDATE students SET name=?, grade=?, student_class=?, gender=?, student_id=? WHERE id=?',
      [name, grade, student_class, gender, student_id, id]
    );
    req.flash('success_msg', 'Student updated successfully.');
  } catch (err) {
    console.error('[students] update error:', err);
    req.flash('error_msg', `Failed to update student: ${err.message}`);
  }
  res.redirect('/student');
};

// Delete student
exports.deleteStudent = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM students WHERE id=?', [id]);
    req.flash('success_msg', 'Student deleted successfully.');
  } catch (err) {
    console.error('[students] delete error:', err);
    req.flash('error_msg', `Failed to delete student: ${err.message}`);
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

  try {
    await pool.query(
      'DELETE FROM students WHERE id IN (?) AND school_id = ?',
      [ids.map(Number), schoolId]
    );
    req.flash('success_msg', `${ids.length} student(s) deleted`);
  } catch (err) {
    console.error('[students] bulk delete error:', err);
    req.flash('error_msg', 'Failed to delete students');
  }
  res.redirect('/student');
};

// SEARCH students
exports.searchStudents = async (req, res) => {
  const schoolId = req.session.user.id;
  const query = req.query.q ? req.query.q.trim() : '';

  if (!query) return res.redirect('/student');

  const w = `%${query}%`;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM students WHERE school_id = ? AND (name LIKE ? OR student_class LIKE ? OR student_id LIKE ? OR grade LIKE ?)',
      [schoolId, w, w, w, w]
    );
    res.render('school/students', {
      students: rows,
      success_msg: rows.length === 0 ? 'No matching students found.' : null,
      error_msg: null,
      query
    });
  } catch (err) {
    return res.status(500).render('error', { message: 'Search failed. Try again.' });
  }
};

