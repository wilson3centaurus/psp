// controllers/reportController.js
const db = require('../config/db');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

exports.exportExcel = (req, res) => {
  db.query('SELECT * FROM users WHERE role = "school"', (err, rows) => {
    if (err) throw err;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Schools');
    ws.columns = [
      { header: 'ID', key: 'id' },
      { header: 'Username', key: 'username' },
      { header: 'Role', key: 'role' }
    ];
    rows.forEach(row => ws.addRow(row));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=schools.xlsx');
    wb.xlsx.write(res);
  });
};

exports.exportPDF = (req, res) => {
  db.query('SELECT * FROM users WHERE role = "school"', (err, rows) => {
    if (err) throw err;
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=schools.pdf');
    doc.pipe(res);
    doc.fontSize(16).text('School Report', { align: 'center' });
    doc.moveDown();
    rows.forEach(s => {
      doc.text(`ID: ${s.id} | Username: ${s.username} | Role: ${s.role}`);
    });
    doc.end();
  });
};