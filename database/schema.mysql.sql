-- ============================================================
-- Primary School Performance Monitoring System
-- MySQL Schema — import this in phpMyAdmin or run via CLI:
--   mysql -u root psp < database/schema.mysql.sql
-- ============================================================

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS psp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE psp;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS teacher_attendance;
DROP TABLE IF EXISTS student_attendance;
DROP TABLE IF EXISTS resources;
DROP TABLE IF EXISTS teachers;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS users;

-- =============================================
-- 1. USERS TABLE
-- =============================================
CREATE TABLE users (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  username     VARCHAR(100) NOT NULL UNIQUE,
  password     VARCHAR(255) NOT NULL,
  role         ENUM('admin', 'school', 'itadmin') NOT NULL DEFAULT 'school',
  display_name VARCHAR(255) DEFAULT NULL,
  logo         VARCHAR(255) DEFAULT NULL,
  email        VARCHAR(100) DEFAULT NULL,
  phone        VARCHAR(50)  DEFAULT NULL,
  address      TEXT         DEFAULT NULL,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 2. STUDENTS TABLE
-- =============================================
CREATE TABLE students (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  grade           VARCHAR(20)  NOT NULL,
  student_class   VARCHAR(50)  NOT NULL,
  gender          ENUM('Male', 'Female', 'Other') NOT NULL,
  student_id      VARCHAR(50)  NOT NULL,
  dob             DATE         NOT NULL,
  enrollment_date DATE         NOT NULL,
  parent_name     VARCHAR(150) DEFAULT NULL,
  parent_phone    VARCHAR(30)  DEFAULT NULL,
  parent_email    VARCHAR(100) DEFAULT NULL,
  medical_notes   TEXT         DEFAULT NULL,
  school_id       INT NOT NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_students_school_grade_class ON students(school_id, grade, student_class);
CREATE INDEX idx_students_student_id         ON students(student_id);

-- =============================================
-- 3. TEACHERS TABLE
-- =============================================
CREATE TABLE teachers (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  subject    VARCHAR(100),
  gender     ENUM('Male', 'Female', 'Other') NOT NULL,
  email      VARCHAR(100),
  phone      VARCHAR(20),
  teacher_id VARCHAR(50)  NOT NULL,
  school_id  INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_teachers_school     ON teachers(school_id);
CREATE INDEX idx_teachers_teacher_id ON teachers(teacher_id);

-- =============================================
-- 4. STUDENT ATTENDANCE TABLE
-- =============================================
CREATE TABLE student_attendance (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  student_id    INT NOT NULL,
  school_id     INT NOT NULL,
  date          DATE NOT NULL,
  status        ENUM('Present', 'Absent', 'Late', 'Excused', 'Left Early') NOT NULL DEFAULT 'Present',
  reason        TEXT,
  excused       TINYINT  DEFAULT 0,
  late_minutes  INT      DEFAULT 0,
  early_minutes INT      DEFAULT 0,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (school_id)  REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_student_attendance_date         ON student_attendance(date);
CREATE INDEX idx_student_attendance_school_date  ON student_attendance(school_id, date);
CREATE INDEX idx_student_attendance_student_date ON student_attendance(student_id, date);

-- =============================================
-- 5. TEACHER ATTENDANCE TABLE
-- =============================================
CREATE TABLE teacher_attendance (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id    INT NOT NULL,
  school_id     INT NOT NULL,
  date          DATE NOT NULL,
  status        ENUM('Present', 'Absent', 'Late', 'Excused', 'Left Early') NOT NULL DEFAULT 'Present',
  reason        TEXT,
  excused       TINYINT  DEFAULT 0,
  late_minutes  INT      DEFAULT 0,
  early_minutes INT      DEFAULT 0,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  FOREIGN KEY (school_id)  REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_teacher_attendance_date         ON teacher_attendance(date);
CREATE INDEX idx_teacher_attendance_school_date  ON teacher_attendance(school_id, date);
CREATE INDEX idx_teacher_attendance_teacher_date ON teacher_attendance(teacher_id, date);

-- =============================================
-- 6. RESOURCES TABLE
-- =============================================
CREATE TABLE resources (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  subject_id    VARCHAR(50)  NOT NULL,
  subject_name  VARCHAR(100) NOT NULL,
  grade         VARCHAR(20)  NOT NULL,
  num_students  INT DEFAULT 0,
  num_books     INT DEFAULT 0,
  num_computers INT DEFAULT 0,
  school_id     INT NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_resources_school  ON resources(school_id);
CREATE INDEX idx_resources_subject ON resources(subject_name);
