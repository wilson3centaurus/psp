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
          SUM(num_books) AS total_books
        FROM resources
        WHERE school_id = ?
        GROUP BY subject_name, grade
        ORDER BY subject_name, grade
      `,
      [schoolId]
    );

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

    const suggestions = [];

    resourceRows.forEach((r) => {
      const ratio =
        r.total_books > 0 ? r.total_students / r.total_books : null;
      if (ratio !== null && ratio > 5) {
        suggestions.push(
          `Provide more books for subject ${r.subject_name || 'N/A'} in grade ${
            r.grade || '-'
          } (students per book: ${ratio.toFixed(2)}).`
        );
      }
    });

    if (avgAbsentStudents > 10) {
      suggestions.push(
        'Improve attendance through parental engagement (average student absences exceed 10 per week).'
      );
    }

    if (teacherStudentRatio !== null && teacherStudentRatio > 40) {
      suggestions.push(
        'Hire more teachers to balance the teacher-student ratio (currently above 40).'
      );
    }

    const doc = new PDFDocument({ margin: 40 });
    const filename = `school-report-${schoolId}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    doc.pipe(res);

    // Header
    doc.fontSize(18).text('School Performance Report', { align: 'center' });
    doc.moveDown(0.25);
    doc
      .fontSize(12)
      .text(
        `School: ${school.username || 'School #' + school.id}`,
        { align: 'center' }
      );
    doc
      .fontSize(12)
      .text(`Generated: ${new Date().toLocaleString()}`, {
        align: 'center'
      });
    doc.moveDown();

    // Summary
    doc.fontSize(14).text('Summary', { underline: true });
    doc.fontSize(12).text(`Total students: ${totalStudents}`);
    doc.text(`Total teachers: ${totalTeachers}`);
    doc.text(
      `Teacher-student ratio: ${
        teacherStudentRatio !== null
          ? teacherStudentRatio.toFixed(2)
          : 'N/A'
      }`
    );
    doc.text(
      `Average absent students per week: ${avgAbsentStudents.toFixed(2)}`
    );
    doc.text(
      `Average absent teachers per week: ${avgAbsentTeachers.toFixed(2)}`
    );
    doc.moveDown();

    // Student-resource ratios
    doc.fontSize(14).text('Student-Resource Ratios', { underline: true });
    if (!resourceRows.length) {
      doc.fontSize(12).text('No resource data available for this school.');
    } else {
      resourceRows.forEach((r) => {
        const ratio =
          r.total_books > 0
            ? (r.total_students / r.total_books).toFixed(2)
            : 'N/A';
        doc
          .fontSize(12)
          .text(
            `${r.subject_name || 'Unknown subject'} | Grade: ${
              r.grade || '-'
            } | Students: ${r.total_students || 0} | Books: ${
              r.total_books || 0
            } | Students per book: ${ratio}`
          );
      });
    }
    doc.moveDown();

    // Suggestions
    doc.fontSize(14).text('Suggested Improvements', { underline: true });
    if (!suggestions.length) {
      doc.fontSize(12).text('No critical suggestions at this time.');
    } else {
      suggestions.forEach((s) => doc.fontSize(12).text(`- ${s}`));
    }

    doc.end();
  } catch (err) {
    console.error('Error generating report:', err);
    req.flash('error_msg', 'Failed to generate report.');
    res.redirect('/admin/reports');
  }
};
