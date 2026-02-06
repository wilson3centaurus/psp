const db = require('../../config/db');
const PDFDocument = require('pdfkit');

// Promise wrapper for db.query
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// AI-like recommendation generator based on data analysis
function generateAIRecommendations(data) {
  const recommendations = [];
  const {
    totalStudents,
    totalTeachers,
    teacherStudentRatio,
    resourceRows,
    avgAbsentStudents,
    avgAbsentTeachers,
    totalComputers,
    attendanceTrend,
    genderDistribution
  } = data;

  // Priority levels: critical, warning, good
  
  // 1. Teacher-Student Ratio Analysis
  if (teacherStudentRatio !== null) {
    if (teacherStudentRatio > 50) {
      recommendations.push({
        priority: 'critical',
        category: 'Staffing',
        title: 'Critical Teacher Shortage',
        description: `Current ratio of ${teacherStudentRatio.toFixed(0)} students per teacher is severely above recommended limit of 40. Immediate hiring required.`,
        action: 'Urgently hire at least ' + Math.ceil((totalStudents / 40) - totalTeachers) + ' additional teachers.'
      });
    } else if (teacherStudentRatio > 40) {
      recommendations.push({
        priority: 'warning',
        category: 'Staffing',
        title: 'High Teacher-Student Ratio',
        description: `Ratio of ${teacherStudentRatio.toFixed(0)}:1 exceeds optimal 40:1 standard.`,
        action: 'Consider hiring additional teaching staff to improve individual attention.'
      });
    } else if (teacherStudentRatio <= 30) {
      recommendations.push({
        priority: 'good',
        category: 'Staffing',
        title: 'Excellent Teacher Ratio',
        description: `Current ${teacherStudentRatio.toFixed(0)}:1 ratio allows for quality individual attention.`,
        action: 'Maintain current staffing levels and focus on teacher development.'
      });
    }
  }

  // 2. Resource Analysis - Books
  const lowBookSubjects = [];
  const adequateBookSubjects = [];
  
  resourceRows.forEach((r) => {
    const bookRatio = r.total_books > 0 ? r.total_students / r.total_books : Infinity;
    if (bookRatio > 5) {
      lowBookSubjects.push({
        subject: r.subject_name || 'Unknown',
        grade: r.grade || '-',
        ratio: bookRatio,
        needed: Math.ceil(r.total_students / 3) - r.total_books // Ideal is 3:1
      });
    } else if (bookRatio <= 2) {
      adequateBookSubjects.push(r.subject_name);
    }
  });

  if (lowBookSubjects.length > 0) {
    const topNeeds = lowBookSubjects.sort((a, b) => b.ratio - a.ratio).slice(0, 3);
    recommendations.push({
      priority: 'critical',
      category: 'Resources',
      title: 'Book Shortage Identified',
      description: `${lowBookSubjects.length} subjects have critically low book-to-student ratios.`,
      action: `Priority procurement needed for: ${topNeeds.map(s => s.subject + ' Grade ' + s.grade).join(', ')}. Total ${topNeeds.reduce((sum, s) => sum + Math.max(0, s.needed), 0)} books needed.`
    });
  }

  // 3. Computer/Technology Analysis
  if (totalStudents > 0 && totalComputers !== undefined) {
    const computerRatio = totalStudents / (totalComputers || 1);
    if (computerRatio > 20 || totalComputers === 0) {
      recommendations.push({
        priority: 'warning',
        category: 'Technology',
        title: 'Digital Infrastructure Gap',
        description: totalComputers === 0 
          ? 'No computers available for student use.' 
          : `Only ${totalComputers} computers for ${totalStudents} students (${computerRatio.toFixed(0)}:1 ratio).`,
        action: `Recommend acquiring ${Math.ceil(totalStudents / 10) - totalComputers} additional devices for effective ICT integration.`
      });
    }
  }

  // 4. Attendance Pattern Analysis
  if (avgAbsentStudents > 15) {
    recommendations.push({
      priority: 'critical',
      category: 'Attendance',
      title: 'High Student Absenteeism',
      description: `Average of ${avgAbsentStudents.toFixed(1)} student absences per week indicates serious attendance issues.`,
      action: 'Implement attendance tracking system, parental engagement programs, and investigate root causes (transport, health, etc.).'
    });
  } else if (avgAbsentStudents > 8) {
    recommendations.push({
      priority: 'warning',
      category: 'Attendance',
      title: 'Moderate Student Absence Rate',
      description: `${avgAbsentStudents.toFixed(1)} average weekly absences requires attention.`,
      action: 'Establish attendance incentive programs and regular parent communication.'
    });
  } else {
    recommendations.push({
      priority: 'good',
      category: 'Attendance',
      title: 'Good Attendance Record',
      description: `Low absence rate of ${avgAbsentStudents.toFixed(1)} per week indicates good engagement.`,
      action: 'Continue current practices and recognize students with perfect attendance.'
    });
  }

  // 5. Teacher Attendance Analysis
  if (avgAbsentTeachers > 3) {
    recommendations.push({
      priority: 'warning',
      category: 'Staff Attendance',
      title: 'Teacher Absence Concerns',
      description: `Average of ${avgAbsentTeachers.toFixed(1)} teacher absences weekly affects learning continuity.`,
      action: 'Review teacher workload, implement substitute teacher pool, and address workplace concerns.'
    });
  }

  // 6. Performance Prediction Insights
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
    description: performanceScore >= 70 
      ? 'School is on track for good academic outcomes with current resources.'
      : performanceScore >= 50
      ? 'School may face challenges; targeted improvements recommended.'
      : 'Significant intervention needed to improve learning outcomes.',
    action: performanceScore < 70 
      ? 'Focus on addressing critical and warning issues identified above.'
      : 'Maintain current standards and focus on continuous improvement.'
  });

  return recommendations;
}

// Render reports page with school list
exports.index = async (req, res) => {
  try {
    const schools = await query(
      `SELECT id, username FROM users WHERE role = 'school' ORDER BY username`
    );

    res.render('admin/reports/index', {
      schools,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (err) {
    console.error('Error loading reports page:', err);
    req.flash('error_msg', 'Unable to load reports page right now.');
    res.redirect('/admin/dashboard');
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
    const schoolRows = await query(
      `SELECT id, username FROM users WHERE id = ? AND role = 'school'`,
      [schoolId]
    );

    if (!schoolRows.length) {
      req.flash('error_msg', 'School not found.');
      return res.redirect('/admin/reports');
    }

    const school = schoolRows[0];

    const studentRows = await query(
      `SELECT COUNT(*) AS total FROM students WHERE school_id = ?`,
      [schoolId]
    );
    const teacherRows = await query(
      `SELECT COUNT(*) AS total FROM teachers WHERE school_id = ?`,
      [schoolId]
    );

    const totalStudents = studentRows[0]?.total || 0;
    const totalTeachers = teacherRows[0]?.total || 0;
    const teacherStudentRatio =
      totalTeachers > 0 ? totalStudents / totalTeachers : null;

    const resourceRows = await query(
      `
        SELECT
          subject_name,
          grade,
          SUM(num_students) AS total_students,
          SUM(num_books) AS total_books,
          SUM(num_computers) AS total_computers
        FROM resources
        WHERE school_id = ?
        GROUP BY subject_name, grade
        ORDER BY subject_name, grade
      `,
      [schoolId]
    );

    // Calculate total computers
    const totalComputers = resourceRows.reduce((sum, r) => sum + (r.total_computers || 0), 0);

    const weeklyStudentAbsences = await query(
      `
        SELECT
          YEARWEEK(date, 1) AS year_week,
          SUM(CASE WHEN LOWER(status) = 'absent' THEN 1 ELSE 0 END) AS absences
        FROM student_attendance
        WHERE school_id = ?
        GROUP BY YEARWEEK(date, 1)
      `,
      [schoolId]
    );

    const weeklyTeacherAbsences = await query(
      `
        SELECT
          YEARWEEK(date, 1) AS year_week,
          SUM(CASE WHEN LOWER(status) = 'absent' THEN 1 ELSE 0 END) AS absences
        FROM teacher_attendance
        WHERE school_id = ?
        GROUP BY YEARWEEK(date, 1)
      `,
      [schoolId]
    );

    const avgAbsentStudents = weeklyStudentAbsences.length
      ? weeklyStudentAbsences.reduce((sum, r) => sum + (r.absences || 0), 0) /
        weeklyStudentAbsences.length
      : 0;

    const avgAbsentTeachers = weeklyTeacherAbsences.length
      ? weeklyTeacherAbsences.reduce((sum, r) => sum + (r.absences || 0), 0) /
        weeklyTeacherAbsences.length
      : 0;

    // Generate AI recommendations
    const aiRecommendations = generateAIRecommendations({
      totalStudents,
      totalTeachers,
      teacherStudentRatio,
      resourceRows,
      avgAbsentStudents,
      avgAbsentTeachers,
      totalComputers
    });

    const doc = new PDFDocument({ margin: 40 });
    const filename = `school-report-${schoolId}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('School Performance Report', { align: 'center' });
    doc.moveDown(0.25);
    doc.fontSize(12).font('Helvetica').text(
      `School: ${school.username || 'School #' + school.id}`,
      { align: 'center' }
    );
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown();

    // Draw a line
    doc.strokeColor('#2563eb').lineWidth(2)
       .moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown();

    // Summary Section
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#2563eb').text('📊 Summary', { underline: false });
    doc.fillColor('black').font('Helvetica');
    doc.fontSize(11);
    doc.text(`• Total Students: ${totalStudents}`);
    doc.text(`• Total Teachers: ${totalTeachers}`);
    doc.text(`• Teacher-Student Ratio: ${teacherStudentRatio !== null ? '1:' + teacherStudentRatio.toFixed(1) : 'N/A'}`);
    doc.text(`• Total Computers/Devices: ${totalComputers}`);
    doc.text(`• Average Weekly Student Absences: ${avgAbsentStudents.toFixed(1)}`);
    doc.text(`• Average Weekly Teacher Absences: ${avgAbsentTeachers.toFixed(1)}`);
    doc.moveDown();

    // Student-Resource Ratios
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#2563eb').text('📚 Resource Analysis by Subject');
    doc.fillColor('black').font('Helvetica').fontSize(10);
    if (!resourceRows.length) {
      doc.text('No resource data available for this school.');
    } else {
      resourceRows.forEach((r) => {
        const bookRatio = r.total_books > 0 ? (r.total_students / r.total_books).toFixed(1) : 'No books';
        const status = r.total_books > 0 && r.total_students / r.total_books <= 3 ? '✓' : '⚠';
        doc.text(
          `${status} ${r.subject_name || 'Unknown'} | Grade ${r.grade || '-'} | Students: ${r.total_students || 0} | Books: ${r.total_books || 0} | Ratio: ${bookRatio}:1`
        );
      });
    }
    doc.moveDown();

    // AI Recommendations Section
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#2563eb').text('🤖 AI-Powered Recommendations');
    doc.moveDown(0.5);
    doc.fillColor('black').font('Helvetica').fontSize(10);

    aiRecommendations.forEach((rec, index) => {
      const prioritySymbol = rec.priority === 'critical' ? '🔴' : rec.priority === 'warning' ? '🟡' : '🟢';
      doc.font('Helvetica-Bold').text(`${prioritySymbol} ${rec.category}: ${rec.title}`);
      doc.font('Helvetica').text(`   ${rec.description}`);
      doc.font('Helvetica-Oblique').fillColor('#666666').text(`   → Action: ${rec.action}`);
      doc.fillColor('black');
      if (index < aiRecommendations.length - 1) doc.moveDown(0.5);
    });

    doc.moveDown();
    
    // Footer
    doc.strokeColor('#e2e8f0').lineWidth(1)
       .moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#666666').text(
      'This report was generated by the PSP (Primary School Performance) System using data-driven analysis.',
      { align: 'center' }
    );

    doc.end();
  } catch (err) {
    console.error('Error generating report:', err);
    req.flash('error_msg', 'Failed to generate report.');
    res.redirect('/admin/reports');
  }
};
