/**
 * Supabase Migration + Seed Script
 * Run: node database/migrate.js
 *
 * This script:
 *  1. Creates all tables (PostgreSQL schema)
 *  2. Seeds demo users, students, teachers, resources, and attendance data
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  console.log('✅ Connected to Supabase PostgreSQL');

  try {
    await client.query('BEGIN');

    // ─── SCHEMA ────────────────────────────────────────────────────────────────
    console.log('📐 Creating schema...');

    await client.query(`DROP TABLE IF EXISTS teacher_attendance CASCADE`);
    await client.query(`DROP TABLE IF EXISTS student_attendance CASCADE`);
    await client.query(`DROP TABLE IF EXISTS resources CASCADE`);
    await client.query(`DROP TABLE IF EXISTS teachers CASCADE`);
    await client.query(`DROP TABLE IF EXISTS students CASCADE`);
    await client.query(`DROP TABLE IF EXISTS users CASCADE`);
    await client.query(`DROP TYPE IF EXISTS user_role CASCADE`);
    await client.query(`DROP TYPE IF EXISTS attendance_status CASCADE`);
    await client.query(`DROP TYPE IF EXISTS gender_type CASCADE`);

    await client.query(`CREATE TYPE user_role AS ENUM ('admin', 'school', 'itadmin')`);
    await client.query(`CREATE TYPE attendance_status AS ENUM ('Present', 'Absent', 'Late', 'Excused', 'Left Early')`);
    await client.query(`CREATE TYPE gender_type AS ENUM ('Male', 'Female', 'Other')`);

    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role user_role NOT NULL DEFAULT 'school',
        display_name VARCHAR(255) DEFAULT NULL,
        logo VARCHAR(255) DEFAULT NULL,
        email VARCHAR(100) DEFAULT NULL,
        phone VARCHAR(50) DEFAULT NULL,
        address TEXT DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE students (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        grade VARCHAR(20) NOT NULL,
        student_class VARCHAR(50) NOT NULL,
        gender gender_type NOT NULL,
        student_id VARCHAR(50) NOT NULL,
        school_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX idx_students_school_grade_class ON students(school_id, grade, student_class)`);
    await client.query(`CREATE INDEX idx_students_student_id ON students(student_id)`);

    await client.query(`
      CREATE TABLE teachers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        subject VARCHAR(100),
        gender gender_type NOT NULL,
        email VARCHAR(100),
        phone VARCHAR(20),
        teacher_id VARCHAR(50) NOT NULL,
        school_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX idx_teachers_school ON teachers(school_id)`);
    await client.query(`CREATE INDEX idx_teachers_teacher_id ON teachers(teacher_id)`);

    await client.query(`
      CREATE TABLE student_attendance (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        school_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        status attendance_status NOT NULL DEFAULT 'Present',
        reason TEXT,
        excused SMALLINT DEFAULT 0,
        late_minutes INT DEFAULT 0,
        early_minutes INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX idx_student_attendance_date ON student_attendance(date)`);
    await client.query(`CREATE INDEX idx_student_attendance_school_date ON student_attendance(school_id, date)`);
    await client.query(`CREATE INDEX idx_student_attendance_student_date ON student_attendance(student_id, date)`);

    await client.query(`
      CREATE TABLE teacher_attendance (
        id SERIAL PRIMARY KEY,
        teacher_id INT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        school_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        status attendance_status NOT NULL DEFAULT 'Present',
        reason TEXT,
        excused SMALLINT DEFAULT 0,
        late_minutes INT DEFAULT 0,
        early_minutes INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX idx_teacher_attendance_date ON teacher_attendance(date)`);
    await client.query(`CREATE INDEX idx_teacher_attendance_school_date ON teacher_attendance(school_id, date)`);
    await client.query(`CREATE INDEX idx_teacher_attendance_teacher_date ON teacher_attendance(teacher_id, date)`);

    await client.query(`
      CREATE TABLE resources (
        id SERIAL PRIMARY KEY,
        subject_id VARCHAR(50) NOT NULL,
        subject_name VARCHAR(100) NOT NULL,
        grade VARCHAR(20) NOT NULL,
        num_students INT DEFAULT 0,
        num_books INT DEFAULT 0,
        num_computers INT DEFAULT 0,
        school_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX idx_resources_school ON resources(school_id)`);
    await client.query(`CREATE INDEX idx_resources_subject ON resources(subject_name)`);

    await client.query(`
      CREATE OR REPLACE FUNCTION trg_update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
      $$ LANGUAGE plpgsql
    `);
    await client.query(`
      CREATE TRIGGER resources_updated_at
        BEFORE UPDATE ON resources
        FOR EACH ROW EXECUTE FUNCTION trg_update_updated_at()
    `);

    console.log('✅ Schema created');

    // ─── SEED ──────────────────────────────────────────────────────────────────
    console.log('🌱 Seeding data...');

    const hash = bcrypt.hashSync('password123', 10);
    console.log('   Generated bcrypt hash for password123');

    // 1. Users
    const userRes = await client.query(`
      INSERT INTO users (username, password, role, display_name, email, phone, address)
      VALUES
        ('itadmin',           $1, 'itadmin', 'IT Administrator',   'itadmin@psp.edu',           '555-0000', NULL),
        ('admin',             $1, 'admin',   'System Admin',       'admin@psp.edu',             '555-0001', NULL),
        ('greenfield_primary',$1, 'school',  'Greenfield Primary', 'info@greenfield.edu',       '555-0100', '123 Green St'),
        ('riverside_academy', $1, 'school',  'Riverside Academy',  'info@riverside.edu',        '555-0200', '45 River Rd'),
        ('sunshine_school',   $1, 'school',  'Sunshine School',    'info@sunshine.edu',         '555-0300', '78 Sun Ave')
      RETURNING id, username
    `, [hash]);

    const userMap = {};
    userRes.rows.forEach(r => { userMap[r.username] = r.id; });
    const schoolId = userMap['greenfield_primary'];
    console.log(`   Users seeded. greenfield_primary id = ${schoolId}`);

    // 2. Students (for greenfield_primary)
    const studentRes = await client.query(`
      INSERT INTO students (name, grade, student_class, gender, student_id, school_id)
      VALUES
        ('John Smith',       '1', '1A', 'Male',   'STU001', $1),
        ('Emily Johnson',    '1', '1A', 'Female', 'STU002', $1),
        ('Michael Brown',    '1', '1A', 'Male',   'STU003', $1),
        ('Sarah Davis',      '1', '1A', 'Female', 'STU004', $1),
        ('David Wilson',     '1', '1B', 'Male',   'STU005', $1),
        ('Emma Martinez',    '1', '1B', 'Female', 'STU006', $1),
        ('James Anderson',   '1', '1B', 'Male',   'STU007', $1),
        ('Olivia Taylor',    '2', '2A', 'Female', 'STU008', $1),
        ('William Thomas',   '2', '2A', 'Male',   'STU009', $1),
        ('Sophia Jackson',   '2', '2A', 'Female', 'STU010', $1),
        ('Benjamin White',   '2', '2A', 'Male',   'STU011', $1),
        ('Isabella Harris',  '3', '3A', 'Female', 'STU012', $1),
        ('Lucas Martin',     '3', '3A', 'Male',   'STU013', $1),
        ('Mia Thompson',     '3', '3A', 'Female', 'STU014', $1),
        ('Ethan Garcia',     '3', '3A', 'Male',   'STU015', $1)
      RETURNING id
    `, [schoolId]);
    const studentIds = studentRes.rows.map(r => r.id);
    console.log(`   ${studentIds.length} students seeded`);

    // 3. Teachers (for greenfield_primary)
    const teacherRes = await client.query(`
      INSERT INTO teachers (name, subject, gender, email, phone, teacher_id, school_id)
      VALUES
        ('Mrs. Jennifer Adams',    'Mathematics',       'Female', 'j.adams@greenfield.edu',  '555-0101', 'TCH001', $1),
        ('Mr. Robert Clark',       'English',           'Male',   'r.clark@greenfield.edu',  '555-0102', 'TCH002', $1),
        ('Ms. Patricia Lewis',     'Science',           'Female', 'p.lewis@greenfield.edu',  '555-0103', 'TCH003', $1),
        ('Mr. Daniel Walker',      'Social Studies',    'Male',   'd.walker@greenfield.edu', '555-0104', 'TCH004', $1),
        ('Mrs. Linda Hall',        'Art',               'Female', 'l.hall@greenfield.edu',   '555-0105', 'TCH005', $1),
        ('Mr. Christopher Young',  'Physical Education','Male',   'c.young@greenfield.edu',  '555-0106', 'TCH006', $1)
      RETURNING id
    `, [schoolId]);
    const teacherIds = teacherRes.rows.map(r => r.id);
    console.log(`   ${teacherIds.length} teachers seeded`);

    // 4. Resources (for greenfield_primary)
    await client.query(`
      INSERT INTO resources (subject_id, subject_name, grade, num_students, num_books, num_computers, school_id)
      VALUES
        ('MATH1A', 'Mathematics', '1', 25, 30, 5,  $1),
        ('ENG1A',  'English',     '1', 25, 35, 3,  $1),
        ('SCI1A',  'Science',     '1', 25, 28, 2,  $1),
        ('MATH2A', 'Mathematics', '2', 28, 32, 6,  $1),
        ('ENG2A',  'English',     '2', 28, 30, 4,  $1),
        ('SCI2A',  'Science',     '2', 28, 25, 3,  $1),
        ('MATH3A', 'Mathematics', '3', 30, 35, 8,  $1),
        ('ENG3A',  'English',     '3', 30, 32, 5,  $1),
        ('SCI3A',  'Science',     '3', 30, 28, 4,  $1)
    `, [schoolId]);
    console.log('   Resources seeded');

    // 5. Student attendance (last 5 days)
    const s = studentIds;  // shorthand
    await client.query(`
      INSERT INTO student_attendance (student_id, school_id, date, status, reason, excused, late_minutes, early_minutes)
      VALUES
        ($1,  $7, CURRENT_DATE - INTERVAL '4 days', 'Present', NULL, 0,  0,  0),
        ($2,  $7, CURRENT_DATE - INTERVAL '4 days', 'Present', NULL, 0,  0,  0),
        ($3,  $7, CURRENT_DATE - INTERVAL '4 days', 'Late',    NULL, 0,  15, 0),
        ($4,  $7, CURRENT_DATE - INTERVAL '4 days', 'Present', NULL, 0,  0,  0),
        ($5,  $7, CURRENT_DATE - INTERVAL '4 days', 'Absent',  'Sick', 1, 0, 0),
        ($1,  $7, CURRENT_DATE - INTERVAL '3 days', 'Present', NULL, 0,  0,  0),
        ($2,  $7, CURRENT_DATE - INTERVAL '3 days', 'Present', NULL, 0,  0,  0),
        ($3,  $7, CURRENT_DATE - INTERVAL '3 days', 'Present', NULL, 0,  0,  0),
        ($4,  $7, CURRENT_DATE - INTERVAL '3 days', 'Late',    NULL, 0,  10, 0),
        ($5,  $7, CURRENT_DATE - INTERVAL '3 days', 'Present', NULL, 0,  0,  0),
        ($1,  $7, CURRENT_DATE - INTERVAL '2 days', 'Present', NULL, 0,  0,  0),
        ($2,  $7, CURRENT_DATE - INTERVAL '2 days', 'Present', NULL, 0,  0,  0),
        ($3,  $7, CURRENT_DATE - INTERVAL '2 days', 'Present', NULL, 0,  0,  0),
        ($4,  $7, CURRENT_DATE - INTERVAL '2 days', 'Present', NULL, 0,  0,  0),
        ($5,  $7, CURRENT_DATE - INTERVAL '2 days', 'Present', NULL, 0,  0,  0),
        ($1,  $7, CURRENT_DATE - INTERVAL '1 day',  'Present', NULL, 0,  0,  0),
        ($2,  $7, CURRENT_DATE - INTERVAL '1 day',  'Absent',  'Flu', 1,  0, 0),
        ($3,  $7, CURRENT_DATE - INTERVAL '1 day',  'Present', NULL, 0,  0,  0),
        ($4,  $7, CURRENT_DATE - INTERVAL '1 day',  'Present', NULL, 0,  0,  0),
        ($5,  $7, CURRENT_DATE - INTERVAL '1 day',  'Late',    NULL, 0,  5,  0),
        ($6,  $7, CURRENT_DATE - INTERVAL '1 day',  'Present', NULL, 0,  0,  0),
        ($7,  $7, CURRENT_DATE - INTERVAL '1 day',  'Present', NULL, 0,  0,  0),
        ($8,  $7, CURRENT_DATE - INTERVAL '1 day',  'Present', NULL, 0,  0,  0),
        ($9,  $7, CURRENT_DATE - INTERVAL '1 day',  'Present', NULL, 0,  0,  0),
        ($10, $7, CURRENT_DATE - INTERVAL '1 day',  'Absent',  NULL, 0,  0,  0)
    `, [s[0], s[1], s[2], s[3], s[4], s[5], schoolId, s[7], s[8], s[9]]);
    console.log('   Student attendance seeded');

    // 6. Teacher attendance (last 4 days)
    const t = teacherIds;
    await client.query(`
      INSERT INTO teacher_attendance (teacher_id, school_id, date, status, reason, excused, late_minutes, early_minutes)
      VALUES
        ($1, $7, CURRENT_DATE - INTERVAL '4 days', 'Present', NULL, 0, 0,  0),
        ($2, $7, CURRENT_DATE - INTERVAL '4 days', 'Present', NULL, 0, 0,  0),
        ($3, $7, CURRENT_DATE - INTERVAL '4 days', 'Present', NULL, 0, 0,  0),
        ($4, $7, CURRENT_DATE - INTERVAL '4 days', 'Late',    NULL, 0, 20, 0),
        ($5, $7, CURRENT_DATE - INTERVAL '4 days', 'Present', NULL, 0, 0,  0),
        ($6, $7, CURRENT_DATE - INTERVAL '4 days', 'Present', NULL, 0, 0,  0),
        ($1, $7, CURRENT_DATE - INTERVAL '3 days', 'Present', NULL, 0, 0,  0),
        ($2, $7, CURRENT_DATE - INTERVAL '3 days', 'Present', NULL, 0, 0,  0),
        ($3, $7, CURRENT_DATE - INTERVAL '3 days', 'Absent',  'Medical Appointment', 1, 0, 0),
        ($4, $7, CURRENT_DATE - INTERVAL '3 days', 'Present', NULL, 0, 0,  0),
        ($5, $7, CURRENT_DATE - INTERVAL '3 days', 'Present', NULL, 0, 0,  0),
        ($6, $7, CURRENT_DATE - INTERVAL '3 days', 'Present', NULL, 0, 0,  0),
        ($1, $7, CURRENT_DATE - INTERVAL '2 days', 'Present', NULL, 0, 0,  0),
        ($2, $7, CURRENT_DATE - INTERVAL '2 days', 'Late',    NULL, 0, 10, 0),
        ($3, $7, CURRENT_DATE - INTERVAL '2 days', 'Present', NULL, 0, 0,  0),
        ($4, $7, CURRENT_DATE - INTERVAL '2 days', 'Present', NULL, 0, 0,  0),
        ($5, $7, CURRENT_DATE - INTERVAL '2 days', 'Present', NULL, 0, 0,  0),
        ($6, $7, CURRENT_DATE - INTERVAL '2 days', 'Present', NULL, 0, 0,  0),
        ($1, $7, CURRENT_DATE - INTERVAL '1 day',  'Present', NULL, 0, 0,  0),
        ($2, $7, CURRENT_DATE - INTERVAL '1 day',  'Present', NULL, 0, 0,  0),
        ($3, $7, CURRENT_DATE - INTERVAL '1 day',  'Present', NULL, 0, 0,  0),
        ($4, $7, CURRENT_DATE - INTERVAL '1 day',  'Present', NULL, 0, 0,  0),
        ($5, $7, CURRENT_DATE - INTERVAL '1 day',  'Absent',  'Family Emergency', 1, 0, 0),
        ($6, $7, CURRENT_DATE - INTERVAL '1 day',  'Present', NULL, 0, 0,  0)
    `, [t[0], t[1], t[2], t[3], t[4], t[5], schoolId]);
    console.log('   Teacher attendance seeded');

    await client.query('COMMIT');
    console.log('\n🎉 Migration complete!');
    console.log('\nDemo login credentials (all use password: password123):');
    console.log('  IT Admin  → username: itadmin');
    console.log('  Admin     → username: admin');
    console.log('  School    → username: greenfield_primary | riverside_academy | sunshine_school');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
