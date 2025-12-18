// server.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const flash = require('connect-flash');
const os = require('os');
const app = express();
const PORT = process.env.PORT || 3000;
const morgan = require('morgan');
// DB connection
require('./config/db');

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'psp_secret_key',
  resave: false,
  saveUninitialized: false
}));
app.use(flash());

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//Global variables
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.user = req.session.user;
  next();
});

// Logging every request
app.use((req, res, next) => {
  const now = new Date().toISOString();
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log(`[${now}] ${req.method} ${req.originalUrl} from ${ip}`);
  next();
});

// Routes
app.get('/', (req, res) => res.redirect('/login'));
app.use('/', require('./routes/authRoutes'));
app.use('/school', require('./routes/schoolRoutes'));
app.use('/admin/schools', require('./routes/admin/schoolRoutes'));
app.use('/admin/teachers', require('./routes/admin/teacherRoutes'));
app.use('/admin/students', require('./routes/admin/studentRoutes'));
app.use('/admin/resources', require('./routes/admin/resourceRoutes'));
app.use('/admin/attendance', require('./routes/admin/attendanceRoutes'));
app.use('/admin/analytics', require('./routes/admin/analyticsRoutes'));
app.use('/admin/reports', require('./routes/admin/reportRoutes'));
app.use('/admin', require('./routes/adminRoutes'));
// Legacy singular path safeguard
app.get('/admin/report', (req, res) => res.redirect('/admin/reports'));
app.use('/teacher', require('./routes/teacherRoutes'));
app.use('/student', require('./routes/studentRoutes'));
app.use('/resources', require('./routes/resourceRoutes'));
app.use('/student-attendance', require('./routes/studentAttendanceRoutes'));
app.use('/teacher-attendance', require('./routes/teacherAttendanceRoutes'));
app.use('/itadmin', require('./routes/itadminRoutes'));
app.use(morgan('dev'));
// 404
app.use((req, res) => res.status(404).render('error', { msg: 'Page not found' }));

// Show all network IPs
function listNetworkIPs(port) {
  const nets = os.networkInterfaces();
  const links = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        links.push(`http://${net.address}:${port}`);
      }
    }
  }
  return links;
}



// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on:`);
  console.log(`   - Localhost:   http://localhost:${PORT}`);
  listNetworkIPs(PORT).forEach(link => console.log(`   - Mobile/Local: ${link}`));
});
