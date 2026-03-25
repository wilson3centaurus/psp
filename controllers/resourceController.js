const { supabase } = require('../config/db');
const fs = require('fs');
const csv = require('csv-parser');

// 1. List all resources
exports.listResources = async (req, res) => {
  const schoolId = req.session.user.id;
  const { data: rows } = await supabase
    .from('resources')
    .select('*')
    .eq('school_id', schoolId)
    .order('subject_name');

  res.render('school/resources/index', {
    resources: rows || [],
    success_msg: req.flash('success_msg'),
    error_msg: req.flash('error_msg')
  });
};

// 2. Show Add Resource Form
exports.addResourcePage = (req, res) => res.render('school/resources/add');

// 3. Add Resource Manually
exports.addResource = async (req, res) => {
  const { subject_id, subject_name, grade, num_students, num_books, num_computers } = req.body;
  const schoolId = req.session.user.id;

  const { error } = await supabase.from('resources').insert({
    subject_id,
    subject_name,
    grade,
    num_students: parseInt(num_students) || 0,
    num_books: parseInt(num_books) || 0,
    num_computers: parseInt(num_computers) || 0,
    school_id: schoolId
  });

  if (error) {
    console.error(error);
    req.flash('error_msg', 'Failed to add resource.');
  } else {
    req.flash('success_msg', 'Resource added successfully.');
  }
  res.redirect('/resources');
};

// 4. Show Edit Resource Page
exports.editResourcePage = async (req, res) => {
  const id = req.params.id;
  const { data, error } = await supabase.from('resources').select('*').eq('id', id).maybeSingle();

  if (error || !data) {
    req.flash('error_msg', 'Resource not found.');
    return res.redirect('/resources');
  }
  res.render('school/resources/edit', { resource: data });
};

// 5. Submit Resource Update
exports.editResource = async (req, res) => {
  const id = req.params.id;
  const { subject_id, subject_name, grade, num_students, num_books, num_computers } = req.body;

  const { error } = await supabase.from('resources').update({
    subject_id,
    subject_name,
    grade,
    num_students: parseInt(num_students) || 0,
    num_books: parseInt(num_books) || 0,
    num_computers: parseInt(num_computers) || 0
  }).eq('id', id);

  if (error) {
    console.error(error);
    req.flash('error_msg', 'Failed to update resource.');
  } else {
    req.flash('success_msg', 'Resource updated successfully.');
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
      parsedRows.push({
        subject_id: subject_id.trim(),
        subject_name: subject_name.trim(),
        grade: grade.trim(),
        num_students: parseInt(num_students) || 0,
        num_books: parseInt(num_books) || 0,
        num_computers: parseInt(num_computers) || 0,
        school_id: schoolId
      });
    })
    .on('end', async () => {
      if (parsedRows.length === 0) {
        req.flash('error_msg', 'No valid rows found in CSV.');
        return res.redirect('/resources');
      }
      const { error } = await supabase.from('resources').insert(parsedRows);
      if (error) {
        console.error('CSV Insert Error:', error);
        req.flash('error_msg', 'Failed to upload CSV.');
      } else {
        req.flash('success_msg', 'CSV uploaded successfully.');
      }
      res.redirect('/resources');
    })
    .on('error', err => {
      console.error('CSV Read Error:', err);
      req.flash('error_msg', 'Error reading CSV.');
      res.redirect('/resources');
    });
};

// 7. Delete Resource
exports.deleteResource = async (req, res) => {
  const id = req.params.id;
  const { error } = await supabase.from('resources').delete().eq('id', id);
  if (error) {
    console.error('Delete Error:', error);
    req.flash('error_msg', 'Failed to delete resource.');
  } else {
    req.flash('success_msg', 'Resource deleted successfully.');
  }
  res.redirect('/resources');
};

