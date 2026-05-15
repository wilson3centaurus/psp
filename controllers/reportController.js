// controllers/reportController.js
const { pool } = require('../config/db');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

exports.exportExcel = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, username, role FROM users WHERE role = 'school'");
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
    await wb.xlsx.write(res);
  } catch (err) {
    console.error('[report] Excel export error:', err);
    res.status(500).send('Export failed');
  }
};

exports.exportPDF = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, username, role FROM users WHERE role = 'school'");
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
  } catch (err) {
    console.error('[report] PDF export error:', err);
    res.status(500).send('Export failed');
  }
};

