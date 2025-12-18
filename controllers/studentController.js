const db = require('../config/db');
const fs = require('fs');
const csv = require('csv-parser');

// View all students
exports.listStudents = (req, res) => {
  const schoolId = req.session.user.id;
  db.query('SELECT * FROM students WHERE school_id = ?', [schoolId], (err, rows) => {
    if (err) throw err;
    res.render('school/students', {
      students: rows,
      query: "",
      success_msg: null,
      error_msg: null
    });
  });
};

// Show add student form
exports.addStudentPage = (req, res) => {
  res.render('school/addStudent');
};

// Add single student
exports.addStudent = (req, res) => {
  const { name, grade, student_class, gender, student_id } = req.body;
  const schoolId = req.session.user.id;

  db.query(
    'INSERT INTO students (name, grade, student_class, gender, student_id, school_id) VALUES (?, ?, ?, ?, ?, ?)',
    [name, grade, student_class, gender, student_id, schoolId],
    (err) => {
      if (err) throw err;
      req.flash('success_msg', 'Student added');
      res.redirect('/student');
    }
  );
};

// Bulk CSV upload
exports.uploadCSV = (req, res) => {
  const schoolId = req.session.user.id;
  const results = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      results.forEach(row => {
        db.query(
          'INSERT INTO students (name, grade, student_class, gender, student_id, school_id) VALUES (?, ?, ?, ?, ?, ?)',
          [row.name, row.grade, row.student_class, row.gender, row.student_id, schoolId]
        );
      });
      req.flash('success_msg', 'Students uploaded');
      res.redirect('/student');
    });
};

// Edit page
exports.editStudentPage = (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM students WHERE id = ?', [id], (err, rows) => {
    if (err) throw err;
    if (rows.length === 0) return res.redirect('/student');
    res.render('school/editStudent', { student: rows[0] });
  });
};

// Update student
exports.updateStudent = (req, res) => {
  const { id } = req.params;
  const { name, grade, student_class, gender, student_id } = req.body;

  db.query(
    'UPDATE students SET name = ?, grade = ?, student_class = ?, gender = ?, student_id = ? WHERE id = ?',
    [name, grade, student_class, gender, student_id, id],
    (err) => {
      if (err) throw err;
      req.flash('success_msg', 'Student updated');
      res.redirect('/student');
    }
  );
};

// Delete student
exports.deleteStudent = (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM students WHERE id = ?', [id], (err) => {
    if (err) throw err;
    req.flash('success_msg', 'Student deleted');
    res.redirect('/student');
  });
};

// SEARCH students (FIXED)
exports.searchStudents = (req, res) => {
  const schoolId = req.session.user.id;
  const query = req.query.q ? req.query.q.trim() : "";

  if (!query) return res.redirect('/student');

const sql = `
  SELECT * FROM students 
  WHERE school_id = ? AND (
    BINARY name LIKE BINARY ? OR
    CAST(grade AS CHAR) LIKE BINARY ? OR 
    BINARY student_class LIKE BINARY ? OR 
    BINARY student_id LIKE BINARY ?
  )
`;


  const wildcard = `%${query}%`;

  db.query(sql, [schoolId, wildcard, wildcard, wildcard, wildcard], (err, rows) => {
    if (err) {
      console.error("Search error:", err);
      return res.status(500).render('error', { message: "Search failed. Try again." });
    }

    res.render('school/students', {
      students: rows,
      success_msg: rows.length === 0 ? "No matching students found." : null,
      error_msg: null,
      query
    });
  });
};
