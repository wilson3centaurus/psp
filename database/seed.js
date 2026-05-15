/**
 * PSP System — Seed Script
 * Seeds 3 primary schools in Mutare, Zimbabwe with realistic data.
 *
 * Usage:  node database/seed.js
 *
 * Run AFTER importing schema.mysql.sql and creating your admin account.
 * The script is SAFE to re-run — it skips schools that already exist.
 */

'use strict';

require('dotenv').config();
const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// ── helpers ──────────────────────────────────────────────────────────────────

const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick  = arr => arr[Math.floor(Math.random() * arr.length)];

function randDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/** Last N school days (Mon–Fri) going back from today */
function schoolDays(n) {
  const days = [];
  const d = new Date();
  while (days.length < n) {
    d.setDate(d.getDate() - 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function attendanceStatus() {
  const r = Math.random();
  if (r < 0.78) return { status: 'Present',    late_minutes: 0,        early_minutes: 0 };
  if (r < 0.88) return { status: 'Absent',      late_minutes: 0,        early_minutes: 0 };
  if (r < 0.93) return { status: 'Late',        late_minutes: rand(5,40), early_minutes: 0 };
  if (r < 0.97) return { status: 'Left Early',  late_minutes: 0,        early_minutes: rand(10,60) };
  return           { status: 'Excused',      late_minutes: 0,        early_minutes: 0 };
}

// ── static data ───────────────────────────────────────────────────────────────

const SCHOOLS = [
  {
    username:     'mutareprimary1',
    display_name: 'Mutare Primary School No.1',
    email:        'admin@mutareprimary1.ac.zw',
    phone:        '+263 20 260 1234',
    address:      '12 Herbert Chitepo St, Mutare, Zimbabwe',
  },
  {
    username:     'sakubareps',
    display_name: 'Sakubva Primary School',
    email:        'info@sakubareps.ac.zw',
    phone:        '+263 20 260 5678',
    address:      '45 Sakubva Road, Mutare, Zimbabwe',
  },
  {
    username:     'chikangups',
    display_name: 'Chikanga Primary School',
    email:        'contact@chikangaps.ac.zw',
    phone:        '+263 20 260 9012',
    address:      '88 Chikanga Drive, Mutare, Zimbabwe',
  },
];

const PASSWORD_PLAIN = 'School@1234';

const GRADES = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'];
const CLASSES = ['A', 'B', 'C'];

const MALE_NAMES = [
  'Takudzwa Moyo','Farai Ncube','Tinashe Dube','Blessing Mhuru','Tonderai Chikwanda',
  'Simbarashe Banda','Munashe Mutasa','Tapiwa Nyamande','Kudakwashe Gombera','Rudo Choto',
  'Anesu Makoni','Brian Zindi','Clive Mupfiga','Donald Mawire','Emmanuel Chimhanda',
  'Felix Mushore','Garikai Chigumba','Hardlife Maramba','Innocent Musiyiwa','Justice Nhamba',
  'Kelvin Mazarura','Lovemore Chipindu','Maxwell Chidawu','Nelson Machaya','Oscar Mudenge',
  'Patrick Nyakudya','Quinton Murota','Ronald Mushayabasa','Stanley Chiremba','Thomas Mupondi',
];

const FEMALE_NAMES = [
  'Rutendo Moyo','Shamiso Ncube','Tatenda Dube','Nyasha Mhuru','Chipo Chikwanda',
  'Memory Banda','Ruvimbo Mutasa','Patience Nyamande','Loveness Gombera','Faith Choto',
  'Grace Makoni','Hope Zindi','Irene Mupfiga','Josephine Mawire','Kudzai Chimhanda',
  'Linda Mushore','Mercy Chigumba','Nadine Maramba','Olive Musiyiwa','Priscilla Nhamba',
  'Queen Mazarura','Rachel Chipindu','Sharon Chidawu','Tendai Machaya','Unity Mudenge',
  'Violet Nyakudya','Winnie Murota','Xenia Mushayabasa','Yolanda Chiremba','Zanele Mupondi',
];

const TEACHER_MALE = [
  'Mr T. Chizemo','Mr F. Mupedzisi','Mr B. Nyatoro','Mr S. Chiguma','Mr K. Dondo',
  'Mr M. Zvinavashe','Mr A. Muchena','Mr R. Mandaza','Mr L. Chasakara','Mr P. Gwenzi',
];

const TEACHER_FEMALE = [
  'Mrs G. Mapuranga','Mrs N. Murwisi','Mrs C. Mutsvairo','Mrs T. Shuro','Mrs P. Chiutsi',
  'Miss R. Bvunzawabaya','Mrs F. Mhondoro','Mrs A. Chimwemwe','Mrs B. Sithole','Mrs E. Hove',
];

const SUBJECTS = [
  { id: 'MATH',   name: 'Mathematics' },
  { id: 'ENG',    name: 'English' },
  { id: 'SHONA',  name: 'Shona' },
  { id: 'SCI',    name: 'General Science' },
  { id: 'SST',    name: 'Social Studies' },
  { id: 'AGRI',   name: 'Agriculture' },
  { id: 'FML',    name: 'Family and Religious Studies' },
];

const TEACHER_SUBJECTS = ['Mathematics','English','Shona','General Science','Social Studies','Agriculture','Physical Education','Art and Craft'];

// ── main ──────────────────────────────────────────────────────────────────────

async function seed() {
  const pool = await mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASS     || '',
    database: process.env.DB_NAME     || 'psp',
    waitForConnections: true,
    connectionLimit: 5,
  });

  console.log('\n🌱  PSP Seed Script — Mutare Primary Schools\n');

  const hashedPwd = await bcrypt.hash(PASSWORD_PLAIN, 10);
  const days = schoolDays(20); // last 20 school days for attendance

  for (const school of SCHOOLS) {
    // ── 1. Insert school user (skip if exists) ────────────────────────────
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE username = ? LIMIT 1', [school.username]
    );
    let schoolId;

    if (existing.length > 0) {
      schoolId = existing[0].id;
      console.log(`⚠️  School "${school.display_name}" already exists (id=${schoolId}), skipping user insert.`);
    } else {
      const [res] = await pool.query(
        `INSERT INTO users (username, password, role, display_name, email, phone, address)
         VALUES (?, ?, 'school', ?, ?, ?, ?)`,
        [school.username, hashedPwd, school.display_name, school.email, school.phone, school.address]
      );
      schoolId = res.insertId;
      console.log(`✅  Created school "${school.display_name}" (id=${schoolId})`);
    }

    // Skip further seeding if students already exist for this school
    const [[{ cnt }]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM students WHERE school_id = ?', [schoolId]
    );
    if (cnt > 0) {
      console.log(`   ↳  Already has ${cnt} students — skipping data seed.\n`);
      continue;
    }

    // ── 2. Students ───────────────────────────────────────────────────────
    const studentIds = [];  // DB ids
    let sCounter = 1;

    for (const grade of GRADES) {
      for (const cls of CLASSES) {
        const numStudents = rand(18, 35);
        for (let i = 0; i < numStudents; i++) {
          const isMale  = Math.random() < 0.52;
          const name    = isMale ? pick(MALE_NAMES) : pick(FEMALE_NAMES);
          const gender  = isMale ? 'Male' : 'Female';
          const sid     = `${school.username.slice(0,3).toUpperCase()}${grade.replace('Grade ','G')}${cls}${String(sCounter).padStart(3,'0')}`;
          sCounter++;

          const [res] = await pool.query(
            `INSERT INTO students (name, grade, student_class, gender, student_id, school_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, grade, cls, gender, sid, schoolId]
          );
          studentIds.push(res.insertId);
        }
      }
    }
    console.log(`   ↳  Inserted ${studentIds.length} students`);

    // ── 3. Teachers ────────────────────────────────────────────────────────
    const teacherIds = [];
    const numTeachers = rand(12, 18);
    for (let i = 0; i < numTeachers; i++) {
      const isMale = Math.random() < 0.45;
      const name   = isMale ? TEACHER_MALE[i % TEACHER_MALE.length] : TEACHER_FEMALE[i % TEACHER_FEMALE.length];
      const subj   = TEACHER_SUBJECTS[i % TEACHER_SUBJECTS.length];
      const tid    = `TCH-${school.username.slice(0,3).toUpperCase()}-${String(i+1).padStart(3,'0')}`;
      const gender = isMale ? 'Male' : 'Female';
      const email  = `teacher${i+1}@${school.username}.ac.zw`;

      const [res] = await pool.query(
        `INSERT INTO teachers (name, subject, gender, email, teacher_id, school_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, subj, gender, email, tid, schoolId]
      );
      teacherIds.push(res.insertId);
    }
    console.log(`   ↳  Inserted ${teacherIds.length} teachers`);

    // ── 4. Student attendance (last 20 school days) ────────────────────────
    let stuAttCount = 0;
    for (const date of days) {
      // Randomly attend only a subset of students per day (realistic partial records)
      const subset = studentIds.filter(() => Math.random() > 0.05);
      for (const sid of subset) {
        const { status, late_minutes, early_minutes } = attendanceStatus();
        await pool.query(
          `INSERT INTO student_attendance (student_id, school_id, date, status, late_minutes, early_minutes)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [sid, schoolId, date, status, late_minutes, early_minutes]
        );
        stuAttCount++;
      }
    }
    console.log(`   ↳  Inserted ${stuAttCount} student attendance records`);

    // ── 5. Teacher attendance (last 20 school days) ────────────────────────
    let tchAttCount = 0;
    for (const date of days) {
      for (const tid of teacherIds) {
        const { status, late_minutes, early_minutes } = attendanceStatus();
        await pool.query(
          `INSERT INTO teacher_attendance (teacher_id, school_id, date, status, late_minutes, early_minutes)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [tid, schoolId, date, status, late_minutes, early_minutes]
        );
        tchAttCount++;
      }
    }
    console.log(`   ↳  Inserted ${tchAttCount} teacher attendance records`);

    // ── 6. Resources ───────────────────────────────────────────────────────
    let resCount = 0;
    for (const subj of SUBJECTS) {
      for (const grade of GRADES) {
        const numStudents  = rand(20, 40);
        const numBooks     = rand(10, numStudents);
        const numComputers = rand(0, 5);
        await pool.query(
          `INSERT INTO resources (subject_id, subject_name, grade, num_students, num_books, num_computers, school_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [subj.id, subj.name, grade, numStudents, numBooks, numComputers, schoolId]
        );
        resCount++;
      }
    }
    console.log(`   ↳  Inserted ${resCount} resource records\n`);
  }

  await pool.end();
  console.log(`✅  Seeding complete!`);
  console.log(`\nSchool login credentials:`);
  SCHOOLS.forEach(s => console.log(`   ${s.username}  /  ${PASSWORD_PLAIN}`));
  console.log('');
}

seed().catch(err => {
  console.error('❌  Seed failed:', err.message);
  process.exit(1);
});
