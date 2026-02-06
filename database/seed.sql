-- Primary School Performance Monitoring System
-- Sample Seed Data

-- =============================================
-- 1. SEED USERS (Passwords are bcrypt hashed)
-- =============================================
-- Default password for all demo accounts: "password123"
-- Bcrypt hash: $2a$10$xQp5V5k5h5K5h5k5h5K5hO5K5h5K5h5K5h5K5h5K5h5K5h5K5h5K5h

INSERT INTO users (username, password, role) VALUES
-- IT Admin Account
('itadmin', '$2a$10$rGHDxCZfFHF9.DhJZY5fQeH5YqP5F5F5F5F5F5F5F5F5F5F5F5F5F5', 'itadmin'),

-- Admin Account
('admin', '$2a$10$rGHDxCZfFHF9.DhJZY5fQeH5YqP5F5F5F5F5F5F5F5F5F5F5F5F5F5', 'admin'),

-- School Accounts
('greenfield_primary', '$2a$10$rGHDxCZfFHF9.DhJZY5fQeH5YqP5F5F5F5F5F5F5F5F5F5F5F5F5F5', 'school'),
('riverside_academy', '$2a$10$rGHDxCZfFHF9.DhJZY5fQeH5YqP5F5F5F5F5F5F5F5F5F5F5F5F5F5', 'school'),
('sunshine_school', '$2a$10$rGHDxCZfFHF9.DhJZY5fQeH5YqP5F5F5F5F5F5F5F5F5F5F5F5F5F5', 'school');

-- =============================================
-- 2. SEED STUDENTS (for first school - ID: 3)
-- =============================================
INSERT INTO students (name, grade, student_class, gender, student_id, school_id) VALUES
-- Grade 1A
('John Smith', '1', '1A', 'Male', 'STU001', 3),
('Emily Johnson', '1', '1A', 'Female', 'STU002', 3),
('Michael Brown', '1', '1A', 'Male', 'STU003', 3),
('Sarah Davis', '1', '1A', 'Female', 'STU004', 3),

-- Grade 1B
('David Wilson', '1', '1B', 'Male', 'STU005', 3),
('Emma Martinez', '1', '1B', 'Female', 'STU006', 3),
('James Anderson', '1', '1B', 'Male', 'STU007', 3),

-- Grade 2A
('Olivia Taylor', '2', '2A', 'Female', 'STU008', 3),
('William Thomas', '2', '2A', 'Male', 'STU009', 3),
('Sophia Jackson', '2', '2A', 'Female', 'STU010', 3),
('Benjamin White', '2', '2A', 'Male', 'STU011', 3),

-- Grade 3A
('Isabella Harris', '3', '3A', 'Female', 'STU012', 3),
('Lucas Martin', '3', '3A', 'Male', 'STU013', 3),
('Mia Thompson', '3', '3A', 'Female', 'STU014', 3),
('Ethan Garcia', '3', '3A', 'Male', 'STU015', 3);

-- =============================================
-- 3. SEED TEACHERS (for first school - ID: 3)
-- =============================================
INSERT INTO teachers (name, subject, gender, email, phone, teacher_id, school_id) VALUES
('Mrs. Jennifer Adams', 'Mathematics', 'Female', 'j.adams@greenfield.edu', '555-0101', 'TCH001', 3),
('Mr. Robert Clark', 'English', 'Male', 'r.clark@greenfield.edu', '555-0102', 'TCH002', 3),
('Ms. Patricia Lewis', 'Science', 'Female', 'p.lewis@greenfield.edu', '555-0103', 'TCH003', 3),
('Mr. Daniel Walker', 'Social Studies', 'Male', 'd.walker@greenfield.edu', '555-0104', 'TCH004', 3),
('Mrs. Linda Hall', 'Art', 'Female', 'l.hall@greenfield.edu', '555-0105', 'TCH005', 3),
('Mr. Christopher Young', 'Physical Education', 'Male', 'c.young@greenfield.edu', '555-0106', 'TCH006', 3);

-- =============================================
-- 4. SEED RESOURCES (for first school - ID: 3)
-- =============================================
INSERT INTO resources (subject_id, subject_name, grade, num_students, num_books, num_computers, school_id) VALUES
('MATH1A', 'Mathematics', '1', 25, 30, 5, 3),
('ENG1A', 'English', '1', 25, 35, 3, 3),
('SCI1A', 'Science', '1', 25, 28, 2, 3),
('MATH2A', 'Mathematics', '2', 28, 32, 6, 3),
('ENG2A', 'English', '2', 28, 30, 4, 3),
('SCI2A', 'Science', '2', 28, 25, 3, 3),
('MATH3A', 'Mathematics', '3', 30, 35, 8, 3),
('ENG3A', 'English', '3', 30, 32, 5, 3),
('SCI3A', 'Science', '3', 30, 28, 4, 3);

-- =============================================
-- 5. SEED SAMPLE ATTENDANCE DATA
-- =============================================
-- Student Attendance (last 5 days)
INSERT INTO student_attendance (student_id, school_id, date, status, reason, excused, late_minutes, early_minutes) VALUES
-- Day 1
(1, 3, DATE_SUB(CURDATE(), INTERVAL 4 DAY), 'Present', NULL, 0, 0, 0),
(2, 3, DATE_SUB(CURDATE(), INTERVAL 4 DAY), 'Present', NULL, 0, 0, 0),
(3, 3, DATE_SUB(CURDATE(), INTERVAL 4 DAY), 'Late', NULL, 0, 15, 0),
(4, 3, DATE_SUB(CURDATE(), INTERVAL 4 DAY), 'Present', NULL, 0, 0, 0),
(5, 3, DATE_SUB(CURDATE(), INTERVAL 4 DAY), 'Absent', 'Sick', 1, 0, 0),

-- Day 2
(1, 3, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'Present', NULL, 0, 0, 0),
(2, 3, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'Present', NULL, 0, 0, 0),
(3, 3, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'Present', NULL, 0, 0, 0),
(4, 3, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'Late', NULL, 0, 10, 0),
(5, 3, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'Present', NULL, 0, 0, 0),

-- Day 3
(1, 3, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'Present', NULL, 0, 0, 0),
(2, 3, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'Present', NULL, 0, 0, 0),
(3, 3, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'Present', NULL, 0, 0, 0),
(4, 3, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'Present', NULL, 0, 0, 0),
(5, 3, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'Present', NULL, 0, 0, 0);

-- Teacher Attendance (last 5 days)
INSERT INTO teacher_attendance (teacher_id, school_id, date, status, reason, excused, late_minutes, early_minutes) VALUES
-- Day 1
(1, 3, DATE_SUB(CURDATE(), INTERVAL 4 DAY), 'Present', NULL, 0, 0, 0),
(2, 3, DATE_SUB(CURDATE(), INTERVAL 4 DAY), 'Present', NULL, 0, 0, 0),
(3, 3, DATE_SUB(CURDATE(), INTERVAL 4 DAY), 'Present', NULL, 0, 0, 0),
(4, 3, DATE_SUB(CURDATE(), INTERVAL 4 DAY), 'Late', NULL, 0, 20, 0),
(5, 3, DATE_SUB(CURDATE(), INTERVAL 4 DAY), 'Present', NULL, 0, 0, 0),
(6, 3, DATE_SUB(CURDATE(), INTERVAL 4 DAY), 'Present', NULL, 0, 0, 0),

-- Day 2
(1, 3, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'Present', NULL, 0, 0, 0),
(2, 3, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'Present', NULL, 0, 0, 0),
(3, 3, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'Absent', 'Medical Appointment', 1, 0, 0),
(4, 3, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'Present', NULL, 0, 0, 0),
(5, 3, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'Present', NULL, 0, 0, 0),
(6, 3, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'Present', NULL, 0, 0, 0);

-- =============================================
-- NOTES:
-- =============================================
-- Default Login Credentials:
-- 
-- IT Admin:
--   Username: itadmin
--   Password: password123
--
-- Admin:
--   Username: admin
--   Password: password123
--
-- Schools:
--   Username: greenfield_primary | riverside_academy | sunshine_school
--   Password: password123
--
-- To create a new password hash, use bcrypt with cost factor 10
-- Example in Node.js: bcrypt.hashSync('your_password', 10)
