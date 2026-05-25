const { pool } = require('../config/db');
const fs = require('fs');
const csv = require('csv-parser');
const v = require('../utils/validate');

// ─── Shared field validation ──────────────────────────────────────────────────
function validateTeacherFields(body) {
  return v.runAll([
    v.validateName(body.name, 'Full name'),
    v.validateSubject(body.subject),
    v.validateGender(body.gender),
    v.validateECNumber(body.teacher_id),
    v.validatePhone(body.phone, 'Phone number', false),
    v.validateEmail(body.email, 'Email', false),
  ]);
}

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

  const result = validateTeacherFields(req.body);
  if (!result.valid) {
    req.flash('error_msg', result.message);
    return res.redirect('/teacher/add');
  }

  try {
    await pool.query(
      'INSERT INTO teachers (name, subject, gender, email, phone, teacher_id, school_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        name.trim(), subject, gender,
        (email || '').trim() || null,
        (phone || '').trim() || null,
        teacher_id.trim().toUpperCase(),
        schoolId
      ]
    );
    req.flash('success_msg', 'Teacher added successfully.');
    res.redirect('/teacher');
  } catch (err) {
    console.error('[teachers] insert error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      req.flash('error_msg', `A teacher with EC Number "${teacher_id}" already exists in this school.`);
    } else {
      req.flash('error_msg', `Could not add teacher: ${err.message}`);
    }
    res.redirect('/teacher/add');
  }
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

      let inserted = 0;
      const rowErrors = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rowNum = i + 2;
        const gender = r.gender || r.Gender || r.GENDER || r.sex || r.Sex || r.SEX || '';

        const check = validateTeacherFields({
          name: r.name,
          subject: r.subject,
          gender,
          teacher_id: r.teacher_id,
          phone: r.phone,
          email: r.email,
        });

        if (!check.valid) {
          rowErrors.push(`Row ${rowNum} (${r.name || 'unnamed'}): ${check.message}`);
          continue;
        }

        try {
          await pool.query(
            'INSERT INTO teachers (name, subject, gender, email, phone, teacher_id, school_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              r.name.trim(), r.subject, gender,
              (r.email || '').trim() || null,
              (r.phone || '').trim() || null,
              r.teacher_id.trim().toUpperCase(),
              schoolId
            ]
          );
          inserted++;
        } catch (dbErr) {
          const msg = dbErr.code === 'ER_DUP_ENTRY'
            ? `Duplicate EC Number "${r.teacher_id}"`
            : dbErr.message;
          rowErrors.push(`Row ${rowNum}: ${msg}`);
        }
      }

      if (rowErrors.length > 0) {
        req.flash('error_msg', `${rowErrors.length} row(s) skipped — ${rowErrors.slice(0, 3).join('; ')}${rowErrors.length > 3 ? '…' : ''}`);
      }
      if (inserted > 0) {
        req.flash('success_msg', `${inserted} teacher(s) imported successfully.`);
      }
      res.redirect('/teacher');
    })
    .on('error', err => {
      console.error('[teachers] CSV read error:', err);
      req.flash('error_msg', 'Error reading CSV file.');
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

  const result = validateTeacherFields(req.body);
  if (!result.valid) {
    req.flash('error_msg', result.message);
    return res.redirect(`/teacher/edit/${id}`);
  }

  try {
    await pool.query(
      'UPDATE teachers SET name=?, subject=?, gender=?, email=?, phone=?, teacher_id=? WHERE id=?',
      [
        name.trim(), subject, gender,
        (email || '').trim() || null,
        (phone || '').trim() || null,
        teacher_id.trim().toUpperCase(),
        id
      ]
    );
    req.flash('success_msg', 'Teacher updated successfully.');
  } catch (err) {
    console.error('[teachers] update error:', err);
    req.flash('error_msg', `Could not update teacher: ${err.message}`);
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
