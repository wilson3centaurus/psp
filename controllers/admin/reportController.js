const { pool } = require('../../config/db');
const PDFDocument = require('pdfkit');

// AI-like recommendation generator based on data analysis
function generateAIRecommendations(data) {
  const recommendations = [];
  const {
    totalStudents, totalTeachers, teacherStudentRatio,
    resourceRows, avgAbsentStudents, avgAbsentTeachers, totalComputers
  } = data;

  if (teacherStudentRatio !== null) {
    if (teacherStudentRatio > 50) {
      recommendations.push({ priority: 'critical', category: 'Staffing', title: 'Critical Teacher Shortage',
        description: `Current ratio of ${teacherStudentRatio.toFixed(0)} students per teacher is severely above recommended limit of 40.`,
        action: 'Urgently hire at least ' + Math.ceil((totalStudents / 40) - totalTeachers) + ' additional teachers.' });
    } else if (teacherStudentRatio > 40) {
      recommendations.push({ priority: 'warning', category: 'Staffing', title: 'High Teacher-Student Ratio',
        description: `Ratio of ${teacherStudentRatio.toFixed(0)}:1 exceeds optimal 40:1 standard.`,
        action: 'Consider hiring additional teaching staff.' });
    } else if (teacherStudentRatio <= 30) {
      recommendations.push({ priority: 'good', category: 'Staffing', title: 'Excellent Teacher Ratio',
        description: `Current ${teacherStudentRatio.toFixed(0)}:1 ratio allows for quality individual attention.`,
        action: 'Maintain current staffing levels and focus on teacher development.' });
    }
  }

  const lowBookSubjects = [];
  resourceRows.forEach(r => {
    const bookRatio = r.total_books > 0 ? r.total_students / r.total_books : Infinity;
    if (bookRatio > 5) {
      lowBookSubjects.push({ subject: r.subject_name || 'Unknown', grade: r.grade || '-', ratio: bookRatio,
        needed: Math.ceil(r.total_students / 3) - r.total_books });
    }
  });

  if (lowBookSubjects.length > 0) {
    const topNeeds = lowBookSubjects.sort((a, b) => b.ratio - a.ratio).slice(0, 3);
    recommendations.push({ priority: 'critical', category: 'Resources', title: 'Book Shortage Identified',
      description: `${lowBookSubjects.length} subjects have critically low book-to-student ratios.`,
      action: `Priority procurement needed for: ${topNeeds.map(s => s.subject + ' Grade ' + s.grade).join(', ')}.` });
  }

  if (totalStudents > 0 && totalComputers !== undefined) {
    const computerRatio = totalStudents / (totalComputers || 1);
    if (computerRatio > 20 || totalComputers === 0) {
      recommendations.push({ priority: 'warning', category: 'Technology', title: 'Digital Infrastructure Gap',
        description: totalComputers === 0 ? 'No computers available.' : `Only ${totalComputers} computers for ${totalStudents} students.`,
        action: `Recommend acquiring ${Math.ceil(totalStudents / 10) - totalComputers} additional devices.` });
    }
  }

  if (avgAbsentStudents > 15) {
    recommendations.push({ priority: 'critical', category: 'Attendance', title: 'High Student Absenteeism',
      description: `Average of ${avgAbsentStudents.toFixed(1)} student absences per week.`,
      action: 'Implement attendance tracking, parental engagement programs.' });
  } else if (avgAbsentStudents > 8) {
    recommendations.push({ priority: 'warning', category: 'Attendance', title: 'Moderate Student Absence Rate',
      description: `${avgAbsentStudents.toFixed(1)} average weekly absences requires attention.`,
      action: 'Establish attendance incentive programs.' });
  } else {
    recommendations.push({ priority: 'good', category: 'Attendance', title: 'Good Attendance Record',
      description: `Low absence rate of ${avgAbsentStudents.toFixed(1)} per week.`,
      action: 'Continue current practices and recognise perfect attendance.' });
  }

  if (avgAbsentTeachers > 3) {
    recommendations.push({ priority: 'warning', category: 'Staff Attendance', title: 'Teacher Absence Concerns',
      description: `Average of ${avgAbsentTeachers.toFixed(1)} teacher absences weekly.`,
      action: 'Review teacher workload and implement a substitute teacher pool.' });
  }

  let performanceScore = 100;
  if (teacherStudentRatio > 40) performanceScore -= 15;
  if (avgAbsentStudents > 10) performanceScore -= 15;
  if (lowBookSubjects.length > 2) performanceScore -= 20;
  if (totalComputers < totalStudents / 20) performanceScore -= 10;
  if (avgAbsentTeachers > 2) performanceScore -= 10;

  recommendations.push({
    priority: performanceScore >= 70 ? 'good' : performanceScore >= 50 ? 'warning' : 'critical',
    category: 'Performance Prediction',
    title: `Predicted Performance Score: ${Math.max(0, performanceScore)}%`,
    description: performanceScore >= 70 ? 'School is on track for good academic outcomes.' : 'Intervention recommended.',
    action: performanceScore < 70 ? 'Address critical and warning issues above.' : 'Maintain current standards.'
  });

  return recommendations;
}

// Render reports page with school list
exports.index = async (req, res) => {
  try {
    const [schools] = await pool.query("SELECT id, username FROM users WHERE role = 'school' ORDER BY username");
    res.render('admin/reports/index', {
      schools,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (err) {
    console.error('[admin/reports] index error:', err);
    res.render('admin/reports/index', { schools: [], success_msg: null, error_msg: 'Failed to load schools.' });
  }
};

// Generate PDF report for a school
exports.generate = async (req, res) => {
  const schoolId = req.params.schoolId;

  if (!schoolId) {
    req.flash('error_msg', 'Please select a school.');
    return res.redirect('/admin/reports');
  }

  try {
    const [schoolRows] = await pool.query("SELECT id, username FROM users WHERE id = ? AND role = 'school' LIMIT 1", [schoolId]);
    if (!schoolRows.length) {
      req.flash('error_msg', 'School not found.');
      return res.redirect('/admin/reports');
    }
    const school = schoolRows[0];

    const sid = Number(schoolId);

    const toDateStr = val => (val instanceof Date ? val.toISOString() : String(val || '')).slice(0, 10);

    const [
      [[{ count: totalStudents }]],
      [[{ count: totalTeachers }]],
      [resourceData],
      [stuAttData],
      [tchAttData]
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) AS count FROM students WHERE school_id = ?', [sid]),
      pool.query('SELECT COUNT(*) AS count FROM teachers WHERE school_id = ?', [sid]),
      pool.query('SELECT subject_name, grade, num_students, num_books, num_computers FROM resources WHERE school_id = ?', [sid]),
      pool.query('SELECT date, status FROM student_attendance WHERE school_id = ?', [sid]),
      pool.query('SELECT date, status FROM teacher_attendance WHERE school_id = ?', [sid])
    ]);

    const teacherStudentRatio = totalTeachers > 0 ? totalStudents / totalTeachers : null;

    // Aggregate resources by subject+grade
    const resMap = new Map();
    for (const r of resourceData) {
      const key = `${r.subject_name}|${r.grade}`;
      if (!resMap.has(key)) resMap.set(key, { subject_name: r.subject_name, grade: r.grade, total_students: 0, total_books: 0, total_computers: 0 });
      const e = resMap.get(key);
      e.total_students  += Number(r.num_students)  || 0;
      e.total_books     += Number(r.num_books)     || 0;
      e.total_computers += Number(r.num_computers) || 0;
    }
    const resourceRows = [...resMap.values()].sort((a, b) =>
      (a.subject_name + a.grade).localeCompare(b.subject_name + b.grade));
    const totalComputers = resourceRows.reduce((sum, r) => sum + (r.total_computers || 0), 0);

    // Group attendance by week, count absences
    function weekStart(dateStr) {
      const d = new Date(dateStr);
      const day = d.getUTCDay();
      d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
      return d.toISOString().slice(0, 10);
    }

    const stuWeeks = new Map();
    for (const r of stuAttData) {
      if (!r.date) continue;
      const ws = weekStart(toDateStr(r.date));
      if (!stuWeeks.has(ws)) stuWeeks.set(ws, 0);
      if ((r.status || '').toLowerCase() === 'absent') stuWeeks.set(ws, stuWeeks.get(ws) + 1);
    }
    const tchWeeks = new Map();
    for (const r of tchAttData) {
      if (!r.date) continue;
      const ws = weekStart(toDateStr(r.date));
      if (!tchWeeks.has(ws)) tchWeeks.set(ws, 0);
      if ((r.status || '').toLowerCase() === 'absent') tchWeeks.set(ws, tchWeeks.get(ws) + 1);
    }

    const stuAbsValues = [...stuWeeks.values()];
    const tchAbsValues = [...tchWeeks.values()];
    const avgAbsentStudents = stuAbsValues.length
      ? stuAbsValues.reduce((s, v) => s + v, 0) / stuAbsValues.length : 0;
    const avgAbsentTeachers = tchAbsValues.length
      ? tchAbsValues.reduce((s, v) => s + v, 0) / tchAbsValues.length : 0;

    const aiRecommendations = generateAIRecommendations({
      totalStudents, totalTeachers, teacherStudentRatio,
      resourceRows, avgAbsentStudents, avgAbsentTeachers, totalComputers
    });

    const doc = new PDFDocument({ margin: 40 });
    const filename = `school-report-${schoolId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    doc.fontSize(20).font('Helvetica-Bold').text('School Performance Report', { align: 'center' });
    doc.moveDown(0.25);
    doc.fontSize(12).font('Helvetica').text(`School: ${school.username || 'School #' + school.id}`, { align: 'center' });
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown();
    doc.strokeColor('#2563eb').lineWidth(2).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown();

    doc.fontSize(14).font('Helvetica-Bold').fillColor('#2563eb').text('Summary');
    doc.fillColor('black').font('Helvetica').fontSize(11);
    doc.text(`- Total Students: ${totalStudents}`);
    doc.text(`- Total Teachers: ${totalTeachers}`);
    doc.text(`- Teacher-Student Ratio: ${teacherStudentRatio !== null ? '1:' + teacherStudentRatio.toFixed(1) : 'N/A'}`);
    doc.text(`- Total Computers/Devices: ${totalComputers}`);
    doc.text(`- Average Weekly Student Absences: ${avgAbsentStudents.toFixed(1)}`);
    doc.text(`- Average Weekly Teacher Absences: ${avgAbsentTeachers.toFixed(1)}`);
    doc.moveDown();

    doc.fontSize(14).font('Helvetica-Bold').fillColor('#2563eb').text('Resource Analysis by Subject');
    doc.fillColor('black').font('Helvetica').fontSize(10);
    if (!resourceRows.length) {
      doc.text('No resource data available for this school.');
    } else {
      resourceRows.forEach(r => {
        const bookRatio = r.total_books > 0 ? (r.total_students / r.total_books).toFixed(1) : 'No books';
        const status = r.total_books > 0 && r.total_students / r.total_books <= 3 ? '[OK]' : '[!]';
        doc.text(`${status} ${r.subject_name || 'Unknown'} | Grade ${r.grade || '-'} | Students: ${r.total_students || 0} | Books: ${r.total_books || 0} | Ratio: ${bookRatio}:1`);
      });
    }
    doc.moveDown();

    doc.fontSize(14).font('Helvetica-Bold').fillColor('#2563eb').text('AI-Powered Recommendations');
    doc.moveDown(0.5);
    doc.fillColor('black').font('Helvetica').fontSize(10);
    aiRecommendations.forEach((rec, index) => {
      const sym = rec.priority === 'critical' ? '[CRITICAL]' : rec.priority === 'warning' ? '[WARNING]' : '[GOOD]';
      doc.font('Helvetica-Bold').text(`${sym} ${rec.category}: ${rec.title}`);
      doc.font('Helvetica').text(`   ${rec.description}`);
      doc.font('Helvetica-Oblique').fillColor('#666666').text(`   -> Action: ${rec.action}`);
      doc.fillColor('black');
      if (index < aiRecommendations.length - 1) doc.moveDown(0.5);
    });
    doc.moveDown();
    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#666666').text(
      'This report was generated by the PSP (Primary School Performance) System.',
      { align: 'center' }
    );
    doc.end();

  } catch (err) {
    console.error('Error generating report:', err);
    req.flash('error_msg', 'Failed to generate report.');
    res.redirect('/admin/reports');
  }
};

