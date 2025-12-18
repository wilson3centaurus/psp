const db = require('../config/db');
const fs = require('fs');
const csv = require('csv-parser');

// 1. List all resources
exports.listResources = (req, res) => {
  const schoolId = req.session.user.id;

  db.query(
    'SELECT * FROM resources WHERE school_id = ? ORDER BY subject_name',
    [schoolId],
    (err, rows) => {
      if (err) throw err;

      res.render('school/resources/index', {
        resources: rows,
        success_msg: req.flash("success_msg"),
        error_msg: req.flash("error_msg")
      });
    }
  );
};

// 2. Show Add Resource Form
exports.addResourcePage = (req, res) => {
  res.render('school/resources/add');
};

// 3. Add Resource Manually
exports.addResource = (req, res) => {
  const { subject_id, subject_name, grade, num_students, num_books, num_computers } = req.body;
  const schoolId = req.session.user.id;

  const sql = `
    INSERT INTO resources (subject_id, subject_name, grade, num_students, num_books, num_computers, school_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [subject_id, subject_name, grade, num_students, num_books, num_computers, schoolId],
    err => {
      if (err) {
        console.error(err);
        req.flash("error_msg", "Failed to add resource.");
      } else {
        req.flash("success_msg", "Resource added successfully.");
      }
      res.redirect('/resources');
    }
  );
};

// 4. Show Edit Resource Page
exports.editResourcePage = (req, res) => {
  const id = req.params.id;

  db.query('SELECT * FROM resources WHERE id = ?', [id], (err, rows) => {
    if (err) throw err;

    if (rows.length === 0) {
      req.flash("error_msg", "Resource not found.");
      return res.redirect('/resources');
    }

    res.render('school/resources/edit', { resource: rows[0] });
  });
};

// 5. Submit Resource Update
exports.editResource = (req, res) => {
  const id = req.params.id;
  const { subject_id, subject_name, grade, num_students, num_books, num_computers } = req.body;

  const sql = `
    UPDATE resources
    SET subject_id = ?, subject_name = ?, grade = ?, num_students = ?, num_books = ?, num_computers = ?
    WHERE id = ?
  `;

  db.query(
    sql,
    [subject_id, subject_name, grade, num_students, num_books, num_computers, id],
    err => {
      if (err) {
        console.error(err);
        req.flash("error_msg", "Failed to update resource.");
      } else {
        req.flash("success_msg", "Resource updated successfully.");
      }
      res.redirect('/resources');
    }
  );
};

// 6. Upload Resources via CSV
exports.uploadCSV = (req, res) => {
  const schoolId = req.session.user.id;

  if (!req.file) {
    req.flash("error_msg", "No CSV file uploaded.");
    return res.redirect('/resources');
  }

  const parsedRows = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', row => {
      const {
        subject_id,
        subject_name,
        grade,
        num_students,
        num_books,
        num_computers
      } = row;

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
    .on('end', () => {
      if (parsedRows.length === 0) {
        req.flash("error_msg", "No valid rows found in CSV.");
        return res.redirect('/resources');
      }

      const sql = `
        INSERT INTO resources (subject_id, subject_name, grade, num_students, num_books, num_computers, school_id)
        VALUES ?
      `;

      db.query(sql, [parsedRows], err => {
        if (err) {
          console.error("CSV Insert Error:", err);
          req.flash("error_msg", "Failed to upload CSV.");
        } else {
          req.flash("success_msg", "CSV uploaded successfully.");
        }

        res.redirect('/resources');
      });
    })
    .on('error', err => {
      console.error("CSV Read Error:", err);
      req.flash("error_msg", "Error reading CSV.");
      res.redirect('/resources');
    });
};

// 7. Delete Resource
exports.deleteResource = (req, res) => {
  const id = req.params.id;

  db.query('DELETE FROM resources WHERE id = ?', [id], err => {
    if (err) {
      console.error("Delete Error:", err);
      req.flash("error_msg", "Failed to delete resource.");
    } else {
      req.flash("success_msg", "Resource deleted successfully.");
    }
    res.redirect('/resources');
  });
};
