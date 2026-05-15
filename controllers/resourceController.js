const { pool } = require('../config/db');
const fs = require('fs');
const csv = require('csv-parser');

// 1. List all resources
exports.listResources = async (req, res) => {
  const schoolId = req.session.user.id;
  try {
    const [rows] = await pool.query('SELECT * FROM resources WHERE school_id = ? ORDER BY subject_name', [schoolId]);
    res.render('school/resources/index', {
      resources: rows,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (err) {
    console.error('[resources] list error:', err);
    res.render('school/resources/index', { resources: [], success_msg: null, error_msg: 'Failed to load resources.' });
  }
};

// 2. Show Add Resource Form
exports.addResourcePage = (req, res) => res.render('school/resources/add');

// 3. Add Resource Manually
exports.addResource = async (req, res) => {
  const { subject_id, subject_name, grade, num_students, num_books, num_computers } = req.body;
  const schoolId = req.session.user.id;

  try {
    await pool.query(
      'INSERT INTO resources (subject_id, subject_name, grade, num_students, num_books, num_computers, school_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [subject_id, subject_name, grade, parseInt(num_students) || 0, parseInt(num_books) || 0, parseInt(num_computers) || 0, schoolId]
    );
    req.flash('success_msg', 'Resource added successfully.');
  } catch (err) {
    console.error('[resources] insert error:', err);
    req.flash('error_msg', 'Failed to add resource.');
  }
  res.redirect('/resources');
};

// 4. Show Edit Resource Page
exports.editResourcePage = async (req, res) => {
  const id = req.params.id;
  try {
    const [rows] = await pool.query('SELECT * FROM resources WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) {
      req.flash('error_msg', 'Resource not found.');
      return res.redirect('/resources');
    }
    res.render('school/resources/edit', { resource: rows[0] });
  } catch (err) {
    req.flash('error_msg', 'Resource not found.');
    return res.redirect('/resources');
  }
};

// 5. Submit Resource Update
exports.editResource = async (req, res) => {
  const id = req.params.id;
  const { subject_id, subject_name, grade, num_students, num_books, num_computers } = req.body;

  try {
    await pool.query(
      'UPDATE resources SET subject_id=?, subject_name=?, grade=?, num_students=?, num_books=?, num_computers=? WHERE id=?',
      [subject_id, subject_name, grade, parseInt(num_students) || 0, parseInt(num_books) || 0, parseInt(num_computers) || 0, id]
    );
    req.flash('success_msg', 'Resource updated successfully.');
  } catch (err) {
    console.error('[resources] update error:', err);
    req.flash('error_msg', 'Failed to update resource.');
  }
  res.redirect('/resources');
};

// 6. Upload Resources via CSV
exports.uploadCSV = (req, res) => {
  const schoolId = req.session.user.id;

  if (!req.file) {
    req.flash('error_msg', 'No CSV file uploaded.');
    return res.redirect('/resources');
  }

  const parsedRows = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', row => {
      const { subject_id, subject_name, grade, num_students, num_books, num_computers } = row;
      if (!subject_id || !subject_name || !grade) return;
      parsedRows.push([
        subject_id.trim(),
        subject_name.trim(),
        grade.trim(),
        parseInt(num_students) || 0,
        parseInt(num_books) || 0,
        parseInt(num_computers) || 0,
        schoolId
      ]);
    })
    .on('end', async () => {
      if (parsedRows.length === 0) {
        req.flash('error_msg', 'No valid rows found in CSV.');
        return res.redirect('/resources');
      }
      try {
        for (const r of parsedRows) {
          await pool.query(
            'INSERT INTO resources (subject_id, subject_name, grade, num_students, num_books, num_computers, school_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            r
          );
        }
        req.flash('success_msg', 'CSV uploaded successfully.');
      } catch (err) {
        console.error('[resources] CSV insert error:', err);
        req.flash('error_msg', 'Failed to upload CSV.');
      }
      res.redirect('/resources');
    })
    .on('error', err => {
      console.error('[resources] CSV read error:', err);
      req.flash('error_msg', 'Error reading CSV.');
      res.redirect('/resources');
    });
};

// 7. Delete Resource
exports.deleteResource = async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('DELETE FROM resources WHERE id=?', [id]);
    req.flash('success_msg', 'Resource deleted successfully.');
  } catch (err) {
    console.error('[resources] delete error:', err);
    req.flash('error_msg', 'Failed to delete resource.');
  }
  res.redirect('/resources');
};
