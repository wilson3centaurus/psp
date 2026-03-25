// controllers/reportController.js
const { supabase } = require('../config/db');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

exports.exportExcel = async (req, res) => {
  const { data: rows } = await supabase
    .from('users')
    .select('id, username, role')
    .eq('role', 'school');

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Schools');
  ws.columns = [
    { header: 'ID', key: 'id' },
    { header: 'Username', key: 'username' },
    { header: 'Role', key: 'role' }
  ];
  (rows || []).forEach(row => ws.addRow(row));
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=schools.xlsx');
  await wb.xlsx.write(res);
};

exports.exportPDF = async (req, res) => {
  const { data: rows } = await supabase
    .from('users')
    .select('id, username, role')
    .eq('role', 'school');

  const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=schools.pdf');
  doc.pipe(res);
  doc.fontSize(16).text('School Report', { align: 'center' });
  doc.moveDown();
  (rows || []).forEach(s => {
    doc.text(`ID: ${s.id} | Username: ${s.username} | Role: ${s.role}`);
  });
  doc.end();
};
