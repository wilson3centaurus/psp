'use strict';

require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const PASSWORD_PLAIN = 'Demo@1234';

const DEMO_USERS = [
  {
    username: 'demo_admin',
    role: 'admin',
    display_name: 'Demo Administrator',
    email: 'demo.admin@psp.local',
    phone: '+263771000001',
    address: 'Mutare, Zimbabwe'
  },
  {
    username: 'demo_greenfield',
    role: 'school',
    display_name: 'Greenfield Demo School',
    email: 'greenfield.demo@psp.local',
    phone: '+263771000101',
    address: 'Greenfield Avenue, Mutare, Zimbabwe'
  },
  {
    username: 'demo_riverside',
    role: 'school',
    display_name: 'Riverside Demo School',
    email: 'riverside.demo@psp.local',
    phone: '+263771000102',
    address: 'Riverside Road, Mutare, Zimbabwe'
  },
  {
    username: 'demo_sunshine',
    role: 'school',
    display_name: 'Sunshine Demo School',
    email: 'sunshine.demo@psp.local',
    phone: '+263771000103',
    address: 'Sunshine Drive, Mutare, Zimbabwe'
  }
];

const GRADES = ['1', '2', '3', '4', '5', '6', '7'];
const CLASSES = ['A', 'B', 'C'];
const SUBJECTS = [
  'Mathematics',
  'English',
  'Chishona',
  'Social Science',
  'Physical Education and Arts',
  'Science and Technology'
];

const MALE_NAMES = [
  'Tinashe Moyo', 'Farai Ncube', 'Takudzwa Dube', 'Blessing Nyathi', 'Kudakwashe Mutasa',
  'Tapiwa Chikore', 'Anotida Mlambo', 'Munashe Zuze', 'Simbarashe Gatsi', 'Tanaka Mucheche'
];

const FEMALE_NAMES = [
  'Rutendo Moyo', 'Shamiso Ncube', 'Tatenda Dube', 'Nyasha Mutasa', 'Chipo Chikore',
  'Ruvimbo Zuze', 'Kundai Mlambo', 'Faith Nyathi', 'Loveness Gatsi', 'Tendai Mucheche'
];

const TEACHER_NAMES = [
  { name: 'Mrs Tariro Moyo', gender: 'Female' },
  { name: 'Mr Farai Ncube', gender: 'Male' },
  { name: 'Mrs Rudo Dube', gender: 'Female' },
  { name: 'Mr Tawanda Mutasa', gender: 'Male' },
  { name: 'Mrs Memory Chikore', gender: 'Female' },
  { name: 'Mr Prosper Zuze', gender: 'Male' }
];

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (items) => items[Math.floor(Math.random() * items.length)];

function randomDobForGrade(grade) {
  const approxAge = 5 + Number(grade);
  const year = new Date().getFullYear() - approxAge;
  const month = String(rand(1, 12)).padStart(2, '0');
  const day = String(rand(1, 28)).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function schoolDays(count) {
  const days = [];
  const date = new Date();
  while (days.length < count) {
    date.setDate(date.getDate() - 1);
    const weekday = date.getDay();
    if (weekday !== 0 && weekday !== 6) {
      days.push(date.toISOString().slice(0, 10));
    }
  }
  return days;
}

function attendanceStatus() {
  const roll = Math.random();
  if (roll < 0.82) return { status: 'Present', late: 0, early: 0, reason: null, excused: 0 };
  if (roll < 0.9) return { status: 'Absent', late: 0, early: 0, reason: 'Sick', excused: 1 };
  if (roll < 0.95) return { status: 'Late', late: rand(5, 30), early: 0, reason: null, excused: 0 };
  if (roll < 0.98) return { status: 'Left Early', late: 0, early: rand(10, 45), reason: 'Family errand', excused: 1 };
  return { status: 'Excused', late: 0, early: 0, reason: 'Approved leave', excused: 1 };
}

async function upsertDemoUser(pool, user, hashedPassword) {
  const [rows] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [user.username]);

  if (rows.length) {
    await pool.query(
      `UPDATE users
       SET password = ?, role = ?, display_name = ?, email = ?, phone = ?, address = ?
       WHERE id = ?`,
      [hashedPassword, user.role, user.display_name, user.email, user.phone, user.address, rows[0].id]
    );
    return rows[0].id;
  }

  const [result] = await pool.query(
    `INSERT INTO users (username, password, role, display_name, email, phone, address)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [user.username, hashedPassword, user.role, user.display_name, user.email, user.phone, user.address]
  );
  return result.insertId;
}

async function seedSchoolData(pool, schoolId, school) {
  const [[studentCountRow]] = await pool.query('SELECT COUNT(*) AS count FROM students WHERE school_id = ?', [schoolId]);
  if (studentCountRow.count > 0) {
    console.log(`- ${school.username}: demo data already exists, skipped`);
    return;
  }

  const studentIds = [];
  const teacherIds = [];
  let studentSequence = 1;

  for (const grade of GRADES) {
    for (const studentClass of CLASSES) {
      const totalStudents = rand(8, 12);

      for (let index = 0; index < totalStudents; index += 1) {
        const isMale = Math.random() < 0.5;
        const name = isMale ? pick(MALE_NAMES) : pick(FEMALE_NAMES);
        const studentId = `${school.username.replace('demo_', '').slice(0, 3).toUpperCase()}-${grade}${studentClass}-${String(studentSequence).padStart(3, '0')}`;
        studentSequence += 1;

        const [result] = await pool.query(
          `INSERT INTO students
            (name, grade, student_class, gender, student_id, dob, enrollment_date,
             parent_name, parent_phone, parent_email, medical_notes, school_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            name,
            grade,
            studentClass,
            isMale ? 'Male' : 'Female',
            studentId,
            randomDobForGrade(grade),
            '2026-01-13',
            `${pick(['Mr', 'Mrs', 'Ms'])} ${name.split(' ').slice(-1)[0]}`,
            `+26377${rand(1000000, 9999999)}`,
            `${studentId.toLowerCase()}@family.demo`,
            index % 7 === 0 ? 'Monitor reading support progress.' : null,
            schoolId
          ]
        );
        studentIds.push(result.insertId);
      }
    }
  }

  for (let index = 0; index < TEACHER_NAMES.length; index += 1) {
    const teacher = TEACHER_NAMES[index];
    const [result] = await pool.query(
      `INSERT INTO teachers
        (name, subject, gender, email, phone, teacher_id, school_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        teacher.name,
        SUBJECTS[index % SUBJECTS.length],
        teacher.gender,
        `${school.username}.teacher${index + 1}@psp.local`,
        `+26378${rand(1000000, 9999999)}`,
        `${school.username.replace('demo_', '').toUpperCase()}EC${String(index + 1).padStart(3, '0')}`,
        schoolId
      ]
    );
    teacherIds.push(result.insertId);
  }

  for (const grade of GRADES) {
    for (const subject of SUBJECTS) {
      await pool.query(
        `INSERT INTO resources
          (subject_id, subject_name, grade, num_students, num_books, num_computers, school_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          `${subject.slice(0, 3).toUpperCase()}-${grade}`,
          subject,
          grade,
          rand(28, 38),
          rand(18, 35),
          rand(1, 8),
          schoolId
        ]
      );
    }
  }

  const attendanceDays = schoolDays(10);
  for (const date of attendanceDays) {
    for (const studentId of studentIds) {
      const status = attendanceStatus();
      await pool.query(
        `INSERT INTO student_attendance
          (student_id, school_id, date, status, reason, excused, late_minutes, early_minutes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [studentId, schoolId, date, status.status, status.reason, status.excused, status.late, status.early]
      );
    }

    for (const teacherId of teacherIds) {
      const status = attendanceStatus();
      await pool.query(
        `INSERT INTO teacher_attendance
          (teacher_id, school_id, date, status, reason, excused, late_minutes, early_minutes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [teacherId, schoolId, date, status.status, status.reason, status.excused, status.late, status.early]
      );
    }
  }

  console.log(`- ${school.username}: ${studentIds.length} students, ${teacherIds.length} teachers, ${GRADES.length * SUBJECTS.length} resources`);
}

async function seed() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'psp',
    waitForConnections: true,
    connectionLimit: 5
  });

  try {
    const hashedPassword = await bcrypt.hash(PASSWORD_PLAIN, 10);

    console.log('Creating or refreshing demo users...');
    for (const user of DEMO_USERS) {
      const id = await upsertDemoUser(pool, user, hashedPassword);
      if (user.role === 'school') {
        await seedSchoolData(pool, id, user);
      } else {
        console.log(`- ${user.username}: admin account ready`);
      }
    }

    console.log('\nDemo credentials');
    console.log(`- Admin:  demo_admin / ${PASSWORD_PLAIN}`);
    console.log(`- School: demo_greenfield / ${PASSWORD_PLAIN}`);
    console.log(`- School: demo_riverside / ${PASSWORD_PLAIN}`);
    console.log(`- School: demo_sunshine / ${PASSWORD_PLAIN}`);
  } finally {
    await pool.end();
  }
}

seed().catch((error) => {
  console.error('Demo seed failed:', error.message);
  process.exit(1);
});
