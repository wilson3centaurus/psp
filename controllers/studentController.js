const { pool } = require('../config/db');
const fs = require('fs');
const csv = require('csv-parser');
const v = require('../utils/validate');
const { normalizeDescriptor, stringifyDescriptor } = require('../utils/faceBiometric');

// ─── Auto-generate unique student ID ─────────────────────────────────────────
function generateStudentId() {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `PSP-${year}-${suffix}`;
}

// ─── Shared field validation ──────────────────────────────────────────────────
function validateStudentFields(body) {
  const checks = [
    v.validateName(body.name, 'Full name'),
    v.validateGrade(body.grade),
    v.validateClass(body.student_class),
    v.validateGender(body.gender),
    v.validateStudentDOB(body.dob),
    v.validateEnrollmentDate(body.enrollment_date),
    v.validatePhone(body.parent_phone, 'Parent phone', false),
    v.validateEmail(body.parent_email, 'Parent email', false),
  ];
  const pName = (body.parent_name || '').trim();
  if (pName) checks.push(v.validateName(pName, 'Parent/guardian name'));
  return v.runAll(checks);
}

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
  const {
    name, grade, student_class, gender,
    dob, enrollment_date, parent_name, parent_phone, parent_email, medical_notes, face_descriptor
  } = req.body;
  const schoolId = req.session.user.id;

  const result = validateStudentFields(req.body);
  if (!result.valid) {
    req.flash('error_msg', result.message);
    return res.redirect('/student/add');
  }

  const descriptor = normalizeDescriptor(face_descriptor);
  if (!descriptor) {
    req.flash('error_msg', 'Face enrollment is required. Capture a clear face before saving.');
    return res.redirect('/student/add');
  }

  // Generate unique student ID (retry up to 5 times on collision)
  let studentId;
  let inserted = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    studentId = generateStudentId();
    try {
      await pool.query(
        `INSERT INTO students
          (name, grade, student_class, gender, student_id, dob, enrollment_date,
           parent_name, parent_phone, parent_email, medical_notes, school_id, face_descriptor, face_enrolled_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          name.trim(), grade, student_class, gender, studentId,
          dob, enrollment_date,
          (parent_name || '').trim() || null,
          (parent_phone || '').trim() || null,
          (parent_email || '').trim() || null,
          (medical_notes || '').trim() || null,
          schoolId,
          stringifyDescriptor(descriptor)
        ]
      );
      inserted = true;
      break;
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY' && attempt < 4) continue;
      console.error('[students] insert error:', err);
      req.flash('error_msg', `Failed to add student: ${err.message}`);
      return res.redirect('/student/add');
    }
  }

  if (inserted) {
    req.flash('success_msg', `Student added successfully. ID: ${studentId}`);
    res.redirect('/student');
  } else {
    req.flash('error_msg', 'Could not generate a unique student ID. Please try again.');
    res.redirect('/student/add');
  }
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

      let inserted = 0;
      const rowErrors = [];

      for (let i = 0; i < results.length; i++) {
        const row = results[i];
        const rowNum = i + 2;

        const check = validateStudentFields({
          name: row.name,
          grade: row.grade,
          student_class: row.student_class,
          gender: row.gender,
          dob: row.dob,
          enrollment_date: row.enrollment_date,
          parent_name: row.parent_name,
          parent_phone: row.parent_phone,
          parent_email: row.parent_email,
        });

        if (!check.valid) {
          rowErrors.push(`Row ${rowNum} (${row.name || 'unnamed'}): ${check.message}`);
          continue;
        }

        // Auto-generate ID if not provided in CSV
        const rowStudentId = (row.student_id || '').trim() || generateStudentId();

        try {
          await pool.query(
            `INSERT INTO students
              (name, grade, student_class, gender, student_id, dob, enrollment_date,
               parent_name, parent_phone, parent_email, medical_notes, school_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              row.name.trim(), row.grade, row.student_class, row.gender, rowStudentId,
              row.dob, row.enrollment_date,
              (row.parent_name || '').trim() || null,
              (row.parent_phone || '').trim() || null,
              (row.parent_email || '').trim() || null,
              (row.medical_notes || '').trim() || null,
              schoolId
            ]
          );
          inserted++;
        } catch (dbErr) {
          const msg = dbErr.code === 'ER_DUP_ENTRY'
            ? `Duplicate student ID for row ${rowNum}`
            : dbErr.message;
          rowErrors.push(`Row ${rowNum}: ${msg}`);
        }
      }

      if (rowErrors.length > 0) {
        req.flash('error_msg', `${rowErrors.length} row(s) skipped — ${rowErrors.slice(0, 3).join('; ')}${rowErrors.length > 3 ? '…' : ''}`);
      }
      if (inserted > 0) {
        req.flash('success_msg', `${inserted} student(s) uploaded successfully.`);
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
  const {
    name, grade, student_class, gender,
    dob, enrollment_date, parent_name, parent_phone, parent_email, medical_notes, face_descriptor
  } = req.body;

  const result = validateStudentFields(req.body);
  if (!result.valid) {
    req.flash('error_msg', result.message);
    return res.redirect(`/student/edit/${id}`);
  }

  try {
    const setParts = [
      'name=?', 'grade=?', 'student_class=?', 'gender=?',
      'dob=?', 'enrollment_date=?', 'parent_name=?', 'parent_phone=?', 'parent_email=?', 'medical_notes=?'
    ];
    const params = [
      name.trim(), grade, student_class, gender,
      dob, enrollment_date,
      (parent_name || '').trim() || null,
      (parent_phone || '').trim() || null,
      (parent_email || '').trim() || null,
      (medical_notes || '').trim() || null
    ];

    const descriptor = normalizeDescriptor(face_descriptor);
    if (descriptor) {
      setParts.push('face_descriptor=?', 'face_enrolled_at=NOW()');
      params.push(stringifyDescriptor(descriptor));
    }

    params.push(id);
    await pool.query(`UPDATE students SET ${setParts.join(', ')} WHERE id=?`, params);
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

