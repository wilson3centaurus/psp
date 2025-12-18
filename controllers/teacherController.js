const db = require('../config/db');
const fs = require('fs');
const csv = require('csv-parser');

/* ===========================
   1. LIST TEACHERS
=========================== */
exports.listTeachers = (req, res) => {
  const schoolId = req.session.user.id;

  const sql = `SELECT * FROM teachers WHERE school_id = ? ORDER BY name ASC`;

  db.query(sql, [schoolId], (err, rows) => {
    if (err) throw err;

    res.render('school/teachers', {
      teachers: rows,
      query: "",
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  });
};



/* ===========================
   2. ADD TEACHER PAGE
=========================== */
exports.addTeacherPage = (req, res) => {
  res.render('school/addTeacher', {
    success_msg: req.flash('success_msg'),
    error_msg: req.flash('error_msg')
  });
};



/* ===========================
   3. ADD A TEACHER
=========================== */
exports.addTeacher = (req, res) => {
  const { name, subject, gender, email, phone, teacher_id } = req.body;
  const schoolId = req.session.user.id;

  const sql = `
    INSERT INTO teachers (name, subject, gender, email, phone, teacher_id, school_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [name, subject, gender, email, phone, teacher_id, schoolId], err => {
    if (err) {
      req.flash('error_msg', 'Could not add teacher');
      return res.redirect('/teacher');
    }

    req.flash('success_msg', 'Teacher added');
    res.redirect('/teacher');
  });
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
    .on('end', () => {
      if (rows.length === 0) {
        req.flash('error_msg', 'CSV file empty');
        return res.redirect('/teacher');
      }

      rows.forEach(r => {
        // FIX: Normalize GENDER column
        const gender =
          r.gender ||
          r.Gender ||
          r.GENDER ||
          r.sex ||
          r.Sex ||
          r.SEX ||
          '';

        const sql = `
          INSERT INTO teachers (name, subject, gender, email, phone, teacher_id, school_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(sql, [
          r.name || '',
          r.subject || '',
          gender,
          r.email || '',
          r.phone || '',
          r.teacher_id || '',
          schoolId
        ]);
      });

      req.flash('success_msg', 'CSV imported successfully');
      res.redirect('/teacher');
    });
};



/* ===========================
   5. EDIT TEACHER PAGE
=========================== */
exports.editTeacherPage = (req, res) => {
  const id = req.params.id;

  db.query('SELECT * FROM teachers WHERE id = ?', [id], (err, rows) => {
    if (err || rows.length === 0) {
      req.flash('error_msg', 'Teacher not found');
      return res.redirect('/teacher');
    }

    res.render('school/editTeacher', {
      teacher: rows[0],
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  });
};



/* ===========================
   6. UPDATE TEACHER
=========================== */
exports.updateTeacher = (req, res) => {
  const { id } = req.params;
  const { name, subject, gender, email, phone, teacher_id } = req.body;

  const sql = `
    UPDATE teachers
    SET name=?, subject=?, gender=?, email=?, phone=?, teacher_id=?
    WHERE id=?
  `;

  db.query(sql, [name, subject, gender, email, phone, teacher_id, id], err => {
    if (err) {
      req.flash('error_msg', 'Could not update teacher');
      return res.redirect('/teacher');
    }

    req.flash('success_msg', 'Teacher updated');
    res.redirect('/teacher');
  });
};



/* ===========================
   7. DELETE TEACHER
=========================== */
exports.deleteTeacher = (req, res) => {
  const id = req.params.id;

  db.query('DELETE FROM teachers WHERE id = ?', [id], err => {
    if (err) {
      req.flash('error_msg', 'Delete failed');
      return res.redirect('/teacher');
    }

    req.flash('success_msg', 'Teacher deleted');
    res.redirect('/teacher');
  });
};



/* ===========================
   8. SEARCH TEACHERS
=========================== */
exports.searchTeachers = (req, res) => {
  const schoolId = req.session.user.id;
  const q = req.query.q ? req.query.q.trim() : "";

  if (!q) return res.redirect('/teacher');

  const wildcard = `%${q}%`;

  const sql = `
    SELECT *
    FROM teachers
    WHERE school_id = ?
      AND (
        name LIKE ? OR
        subject LIKE ? OR
        teacher_id LIKE ? OR
        email LIKE ? OR
        phone LIKE ?
      )
    ORDER BY name ASC
  `;

  db.query(sql, [schoolId, wildcard, wildcard, wildcard, wildcard, wildcard], (err, rows) => {
    if (err) {
      return res.render('school/teachers', {
        teachers: [],
        query: q,
        error_msg: 'Search error',
        success_msg: null
      });
    }

    res.render('school/teachers', {
      teachers: rows,
      query: q,
      success_msg: rows.length === 0 ? 'No matches found' : null,
      error_msg: null
    });
  });
};
