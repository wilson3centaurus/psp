-- ============================================================
-- Primary School Performance Monitoring System
-- PostgreSQL Schema (Supabase compatible)
-- ============================================================

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS teacher_attendance CASCADE;
DROP TABLE IF EXISTS student_attendance CASCADE;
DROP TABLE IF EXISTS resources CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop custom types if they exist
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS attendance_status CASCADE;
DROP TYPE IF EXISTS gender_type CASCADE;

-- ============================================================
-- Custom ENUM types
-- ============================================================
CREATE TYPE user_role AS ENUM ('admin', 'school', 'itadmin');
CREATE TYPE attendance_status AS ENUM ('Present', 'Absent', 'Late', 'Excused', 'Left Early');
CREATE TYPE gender_type AS ENUM ('Male', 'Female', 'Other');

-- ============================================================
-- 1. USERS TABLE
-- ============================================================
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
);

-- ============================================================
-- 2. STUDENTS TABLE
-- ============================================================
CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  grade VARCHAR(20) NOT NULL,
  student_class VARCHAR(50) NOT NULL,
  gender gender_type NOT NULL,
  student_id VARCHAR(50) NOT NULL,
  school_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_students_school_grade_class ON students(school_id, grade, student_class);
CREATE INDEX idx_students_student_id ON students(student_id);

-- ============================================================
-- 3. TEACHERS TABLE
-- ============================================================
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
);

CREATE INDEX idx_teachers_school ON teachers(school_id);
CREATE INDEX idx_teachers_teacher_id ON teachers(teacher_id);

-- ============================================================
-- 4. STUDENT ATTENDANCE TABLE
-- ============================================================
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
);

CREATE INDEX idx_student_attendance_date ON student_attendance(date);
CREATE INDEX idx_student_attendance_school_date ON student_attendance(school_id, date);
CREATE INDEX idx_student_attendance_student_date ON student_attendance(student_id, date);

-- ============================================================
-- 5. TEACHER ATTENDANCE TABLE
-- ============================================================
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
);

CREATE INDEX idx_teacher_attendance_date ON teacher_attendance(date);
CREATE INDEX idx_teacher_attendance_school_date ON teacher_attendance(school_id, date);
CREATE INDEX idx_teacher_attendance_teacher_date ON teacher_attendance(teacher_id, date);

-- ============================================================
-- 6. RESOURCES TABLE
-- ============================================================
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
);

CREATE INDEX idx_resources_school ON resources(school_id);
CREATE INDEX idx_resources_subject ON resources(subject_name);

-- Trigger: keep updated_at current on resources
CREATE OR REPLACE FUNCTION trg_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER resources_updated_at
  BEFORE UPDATE ON resources
  FOR EACH ROW
  EXECUTE FUNCTION trg_update_updated_at();
