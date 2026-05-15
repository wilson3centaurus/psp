const { pool } = require('../config/db');
const fs = require('fs');
const csv = require('csv-parser');

/* ===========================
   1. LIST TEACHERS
=========================== */
exports.listTeachers = async (req, res) => {
  const schoolId = req.session.user.id;
  try {
    const [rows] = await pool.query('SELECT * FROM teachers WHERE school_id = ? ORDER BY name', [schoolId]);
    res.render('school/teachers', { teachers: rows, query: '' });
  } catch (err) {
    console.error('[teachers] list error:', err);
    res.render('school/teachers', { teachers: [], query: '' });
  }
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

  try {
    await pool.query(
      'INSERT INTO teachers (name, subject, gender, email, phone, teacher_id, school_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, subject, gender, email, phone, teacher_id, schoolId]
    );
    req.flash('success_msg', 'Teacher added');
  } catch (err) {
    console.error('[teachers] insert error:', err);
    req.flash('error_msg', 'Could not add teacher');
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

      try {
        for (const r of rows) {
          await pool.query(
            'INSERT INTO teachers (name, subject, gender, email, phone, teacher_id, school_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              r.name || '',
              r.subject || '',
              r.gender || r.Gender || r.GENDER || r.sex || r.Sex || r.SEX || '',
              r.email || '',
              r.phone || '',
              r.teacher_id || '',
              schoolId
            ]
          );
        }
        req.flash('success_msg', 'CSV imported successfully');
      } catch (err) {
        console.error('CSV import error:', err);
        req.flash('error_msg', 'CSV import failed');
      }
      res.redirect('/teacher');
    });
};

/* ===========================
   5. EDIT TEACHER PAGE
=========================== */
exports.editTeacherPage = async (req, res) => {
  const id = req.params.id;
  try {
    const [rows] = await pool.query('SELECT * FROM teachers WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) {
      req.flash('error_msg', 'Teacher not found');
      return res.redirect('/teacher');
    }
    res.render('school/editTeacher', { teacher: rows[0] });
  } catch (err) {
    req.flash('error_msg', 'Teacher not found');
    return res.redirect('/teacher');
  }
};

/* ===========================
   6. UPDATE TEACHER
=========================== */
exports.updateTeacher = async (req, res) => {
  const { id } = req.params;
  const { name, subject, gender, email, phone, teacher_id } = req.body;

  try {
    await pool.query(
      'UPDATE teachers SET name=?, subject=?, gender=?, email=?, phone=?, teacher_id=? WHERE id=?',
      [name, subject, gender, email, phone, teacher_id, id]
    );
    req.flash('success_msg', 'Teacher updated');
  } catch (err) {
    console.error('[teachers] update error:', err);
    req.flash('error_msg', 'Could not update teacher');
  }
  res.redirect('/teacher');
};

/* ===========================
   7. DELETE TEACHER
=========================== */
exports.deleteTeacher = async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('DELETE FROM teachers WHERE id=?', [id]);
    req.flash('success_msg', 'Teacher deleted');
  } catch (err) {
    console.error('[teachers] delete error:', err);
    req.flash('error_msg', 'Delete failed');
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
  try {
    const [rows] = await pool.query(
      'SELECT * FROM teachers WHERE school_id = ? AND (name LIKE ? OR subject LIKE ? OR teacher_id LIKE ? OR email LIKE ? OR phone LIKE ?) ORDER BY name',
      [schoolId, w, w, w, w, w]
    );
    res.render('school/teachers', {
      teachers: rows,
      query: q,
      success_msg: rows.length === 0 ? 'No matches found' : null,
      error_msg: null
    });
  } catch (err) {
    return res.render('school/teachers', { teachers: [], query: q, error_msg: 'Search error', success_msg: null });
  }
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

  try {
    await pool.query(
      'DELETE FROM teachers WHERE id IN (?) AND school_id = ?',
      [ids.map(Number), schoolId]
    );
    req.flash('success_msg', `${ids.length} teacher(s) deleted`);
  } catch (err) {
    console.error('[teachers] bulk delete error:', err);
    req.flash('error_msg', 'Failed to delete teachers');
  }
  res.redirect('/teacher');
};