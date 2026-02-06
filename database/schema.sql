-- Primary School Performance Monitoring System
-- Database Schema

-- Drop tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS teacher_attendance;
DROP TABLE IF EXISTS student_attendance;
DROP TABLE IF EXISTS resources;
DROP TABLE IF EXISTS teachers;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS users;

-- =============================================
-- 1. USERS TABLE (Schools, Admins, IT Admins)
-- =============================================
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'school', 'itadmin') NOT NULL DEFAULT 'school',
  display_name VARCHAR(255) DEFAULT NULL,
  logo VARCHAR(255) DEFAULT NULL,
  email VARCHAR(100) DEFAULT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 2. STUDENTS TABLE
-- =============================================
CREATE TABLE students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  grade VARCHAR(20) NOT NULL,
  student_class VARCHAR(50) NOT NULL,
  gender ENUM('Male', 'Female', 'Other') NOT NULL,
  student_id VARCHAR(50) NOT NULL,
  school_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_school_grade_class (school_id, grade, student_class),
  INDEX idx_student_id (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 3. TEACHERS TABLE
-- =============================================
CREATE TABLE teachers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  subject VARCHAR(100),
  gender ENUM('Male', 'Female', 'Other') NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(20),
  teacher_id VARCHAR(50) NOT NULL,
  school_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_school (school_id),
  INDEX idx_teacher_id (teacher_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 4. STUDENT ATTENDANCE TABLE
-- =============================================
CREATE TABLE student_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  school_id INT NOT NULL,
  date DATE NOT NULL,
  status ENUM('Present', 'Absent', 'Late', 'Excused', 'Left Early') NOT NULL DEFAULT 'Present',
  reason TEXT,
  excused TINYINT(1) DEFAULT 0,
  late_minutes INT DEFAULT 0,
  early_minutes INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (school_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_date (date),
  INDEX idx_school_date (school_id, date),
  INDEX idx_student_date (student_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 5. TEACHER ATTENDANCE TABLE
-- =============================================
CREATE TABLE teacher_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT NOT NULL,
  school_id INT NOT NULL,
  date DATE NOT NULL,
  status ENUM('Present', 'Absent', 'Late', 'Excused', 'Left Early') NOT NULL DEFAULT 'Present',
  reason TEXT,
  excused TINYINT(1) DEFAULT 0,
  late_minutes INT DEFAULT 0,
  early_minutes INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  FOREIGN KEY (school_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_date (date),
  INDEX idx_school_date (school_id, date),
  INDEX idx_teacher_date (teacher_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 6. RESOURCES TABLE
-- =============================================
CREATE TABLE resources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subject_id VARCHAR(50) NOT NULL,
  subject_name VARCHAR(100) NOT NULL,
  grade VARCHAR(20) NOT NULL,
  num_students INT DEFAULT 0,
  num_books INT DEFAULT 0,
  num_computers INT DEFAULT 0,
  school_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_school (school_id),
  INDEX idx_subject (subject_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
