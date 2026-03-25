const { supabase } = require('../../config/db');
const fs = require('fs');
const path = require('path');

// 1. View all schools
exports.viewSchools = async (req, res) => {
  const { data: rows, error } = await supabase
    .from('users')
    .select('id, username, display_name, logo, email, phone, address')
    .eq('role', 'school')
    .order('username');

  if (error) {
    console.error('Error fetching schools:', error);
    req.flash('error_msg', 'Failed to load schools.');
    return res.redirect('/admin/dashboard');
  }

  res.render('admin/schools/index', {
    schools: rows || [],
    success_msg: req.flash('success_msg'),
    error_msg: req.flash('error_msg')
  });
};

// 2. Edit school page
exports.editSchoolPage = async (req, res) => {
  const id = req.params.id;
  const { data, error } = await supabase
    .from('users').select('*').eq('id', id).eq('role', 'school').maybeSingle();

  if (error || !data) {
    req.flash('error_msg', 'School not found.');
    return res.redirect('/admin/schools');
  }

  res.render('admin/schools/edit', {
    school: data,
    success_msg: req.flash('success_msg'),
    error_msg: req.flash('error_msg')
  });
};

// 3. Update school
exports.updateSchool = async (req, res) => {
  const id = req.params.id;
  const { display_name, email, phone, address } = req.body;

  const updateData = { display_name, email, phone, address };

  if (req.file) {
    const logoFilename = req.file.filename;
    // Delete old logo file if exists
    const { data: existing } = await supabase
      .from('users').select('logo').eq('id', id).maybeSingle();
    if (existing?.logo) {
      const oldPath = path.join(__dirname, '../../uploads', existing.logo);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    updateData.logo = logoFilename;
  }

  const { error } = await supabase
    .from('users').update(updateData).eq('id', id).eq('role', 'school');

  if (error) {
    console.error('Update error:', error);
    req.flash('error_msg', 'Failed to update school.');
  } else {
    req.flash('success_msg', 'School updated successfully.');
  }
  res.redirect('/admin/schools');
};

// 4. Delete a school
exports.deleteSchool = async (req, res) => {
  const id = req.params.id;

  const { data: existing } = await supabase
    .from('users').select('logo').eq('id', id).maybeSingle();
  if (existing?.logo) {
    const logoPath = path.join(__dirname, '../../uploads', existing.logo);
    if (fs.existsSync(logoPath)) fs.unlinkSync(logoPath);
  }

  const { error } = await supabase
    .from('users').delete().eq('id', id).eq('role', 'school');

  if (error) {
    console.error('Delete error:', error);
    req.flash('error_msg', 'Failed to delete school.');
  } else {
    req.flash('success_msg', 'School deleted successfully.');
  }
  res.redirect('/admin/schools');
};

// 5. View school dashboard (impersonate session)
exports.viewSchoolDashboard = async (req, res) => {
  const id = req.params.id;
  const { data, error } = await supabase
    .from('users').select('*').eq('id', id).eq('role', 'school').maybeSingle();

  if (error || !data) {
    req.flash('error_msg', 'School not found.');
    return res.redirect('/admin/schools');
  }

  req.session.user = { id: data.id, role: data.role, username: data.username };
  res.redirect('/school/dashboard');
};
