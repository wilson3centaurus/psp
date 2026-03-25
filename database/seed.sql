-- ============================================================
-- Primary School Performance Monitoring System
-- Seed Data (PostgreSQL / Supabase) — run AFTER schema.sql
-- ============================================================
-- Default password for all demo accounts: "password123"
-- Hash below is bcrypt cost-10 of "password123"
-- ============================================================

-- =============================================
-- 1. USERS
-- =============================================
INSERT INTO users (username, password, role, display_name, email, phone, address) VALUES
('itadmin',            '$2b$10$byWe4solH2T1nkKZphFX3uEX2F.Mi0T/j4QgrhTJ57tryJgc8Ucqm', 'itadmin', 'IT Administrator',   'itadmin@psp.edu',     '555-0000', NULL),
('admin',              '$2b$10$byWe4solH2T1nkKZphFX3uEX2F.Mi0T/j4QgrhTJ57tryJgc8Ucqm', 'admin',   'System Admin',       'admin@psp.edu',       '555-0001', NULL),
('greenfield_primary', '$2b$10$byWe4solH2T1nkKZphFX3uEX2F.Mi0T/j4QgrhTJ57tryJgc8Ucqm', 'school',  'Greenfield Primary', 'info@greenfield.edu', '555-0100', '123 Green St'),
('riverside_academy',  '$2b$10$byWe4solH2T1nkKZphFX3uEX2F.Mi0T/j4QgrhTJ57tryJgc8Ucqm', 'school',  'Riverside Academy',  'info@riverside.edu',  '555-0200', '45 River Rd'),
('sunshine_school',    '$2b$10$byWe4solH2T1nkKZphFX3uEX2F.Mi0T/j4QgrhTJ57tryJgc8Ucqm', 'school',  'Sunshine School',    'info@sunshine.edu',   '555-0300', '78 Sun Ave');

-- =============================================
-- 2. STUDENTS  (greenfield_primary = id 3)
-- =============================================
INSERT INTO students (name, grade, student_class, gender, student_id, school_id) VALUES
-- Grade 1A
('John Smith',      '1', '1A', 'Male',   'STU001', 3),
('Emily Johnson',   '1', '1A', 'Female', 'STU002', 3),
('Michael Brown',   '1', '1A', 'Male',   'STU003', 3),
('Sarah Davis',     '1', '1A', 'Female', 'STU004', 3),
-- Grade 1B
('David Wilson',    '1', '1B', 'Male',   'STU005', 3),
('Emma Martinez',   '1', '1B', 'Female', 'STU006', 3),
('James Anderson',  '1', '1B', 'Male',   'STU007', 3),
-- Grade 2A
('Olivia Taylor',   '2', '2A', 'Female', 'STU008', 3),
('William Thomas',  '2', '2A', 'Male',   'STU009', 3),
('Sophia Jackson',  '2', '2A', 'Female', 'STU010', 3),
('Benjamin White',  '2', '2A', 'Male',   'STU011', 3),
-- Grade 3A
('Isabella Harris', '3', '3A', 'Female', 'STU012', 3),
('Lucas Martin',    '3', '3A', 'Male',   'STU013', 3),
('Mia Thompson',    '3', '3A', 'Female', 'STU014', 3),
('Ethan Garcia',    '3', '3A', 'Male',   'STU015', 3);

-- =============================================
-- 3. TEACHERS  (greenfield_primary = id 3)
-- =============================================
INSERT INTO teachers (name, subject, gender, email, phone, teacher_id, school_id) VALUES
('Mrs. Jennifer Adams',   'Mathematics',        'Female', 'j.adams@greenfield.edu',  '555-0101', 'TCH001', 3),
('Mr. Robert Clark',      'English',            'Male',   'r.clark@greenfield.edu',  '555-0102', 'TCH002', 3),
('Ms. Patricia Lewis',    'Science',            'Female', 'p.lewis@greenfield.edu',  '555-0103', 'TCH003', 3),
('Mr. Daniel Walker',     'Social Studies',     'Male',   'd.walker@greenfield.edu', '555-0104', 'TCH004', 3),
('Mrs. Linda Hall',       'Art',                'Female', 'l.hall@greenfield.edu',   '555-0105', 'TCH005', 3),
('Mr. Christopher Young', 'Physical Education', 'Male',   'c.young@greenfield.edu',  '555-0106', 'TCH006', 3);

-- =============================================
-- 4. RESOURCES  (greenfield_primary = id 3)
-- =============================================
INSERT INTO resources (subject_id, subject_name, grade, num_students, num_books, num_computers, school_id) VALUES
('MATH1A', 'Mathematics', '1', 25, 30, 5, 3),
('ENG1A',  'English',     '1', 25, 35, 3, 3),
('SCI1A',  'Science',     '1', 25, 28, 2, 3),
('MATH2A', 'Mathematics', '2', 28, 32, 6, 3),
('ENG2A',  'English',     '2', 28, 30, 4, 3),
('SCI2A',  'Science',     '2', 28, 25, 3, 3),
('MATH3A', 'Mathematics', '3', 30, 35, 8, 3),
('ENG3A',  'English',     '3', 30, 32, 5, 3),
('SCI3A',  'Science',     '3', 30, 28, 4, 3);

-- =============================================
-- 5. STUDENT ATTENDANCE  (last 4 days)
-- =============================================
INSERT INTO student_attendance (student_id, school_id, date, status, reason, excused, late_minutes, early_minutes) VALUES
-- 4 days ago
(1, 3, CURRENT_DATE - INTERVAL '4 days', 'Present', NULL, 0, 0,  0),
(2, 3, CURRENT_DATE - INTERVAL '4 days', 'Present', NULL, 0, 0,  0),
(3, 3, CURRENT_DATE - INTERVAL '4 days', 'Late',    NULL, 0, 15, 0),
(4, 3, CURRENT_DATE - INTERVAL '4 days', 'Present', NULL, 0, 0,  0),
(5, 3, CURRENT_DATE - INTERVAL '4 days', 'Absent',  'Sick', 1, 0, 0),
-- 3 days ago
(1, 3, CURRENT_DATE - INTERVAL '3 days', 'Present', NULL, 0, 0,  0),
(2, 3, CURRENT_DATE - INTERVAL '3 days', 'Present', NULL, 0, 0,  0),
(3, 3, CURRENT_DATE - INTERVAL '3 days', 'Present', NULL, 0, 0,  0),
(4, 3, CURRENT_DATE - INTERVAL '3 days', 'Late',    NULL, 0, 10, 0),
(5, 3, CURRENT_DATE - INTERVAL '3 days', 'Present', NULL, 0, 0,  0),
-- 2 days ago
(1, 3, CURRENT_DATE - INTERVAL '2 days', 'Present', NULL, 0, 0, 0),
(2, 3, CURRENT_DATE - INTERVAL '2 days', 'Present', NULL, 0, 0, 0),
(3, 3, CURRENT_DATE - INTERVAL '2 days', 'Present', NULL, 0, 0, 0),
(4, 3, CURRENT_DATE - INTERVAL '2 days', 'Present', NULL, 0, 0, 0),
(5, 3, CURRENT_DATE - INTERVAL '2 days', 'Present', NULL, 0, 0, 0),
-- yesterday
(1, 3, CURRENT_DATE - INTERVAL '1 day',  'Present', NULL, 0, 0, 0),
(2, 3, CURRENT_DATE - INTERVAL '1 day',  'Absent',  'Flu', 1, 0, 0),
(3, 3, CURRENT_DATE - INTERVAL '1 day',  'Present', NULL, 0, 0, 0),
(4, 3, CURRENT_DATE - INTERVAL '1 day',  'Present', NULL, 0, 0, 0),
(5, 3, CURRENT_DATE - INTERVAL '1 day',  'Late',    NULL, 0, 5, 0);

-- =============================================
-- 6. TEACHER ATTENDANCE  (last 4 days)
-- =============================================
INSERT INTO teacher_attendance (teacher_id, school_id, date, status, reason, excused, late_minutes, early_minutes) VALUES
-- 4 days ago
(1, 3, CURRENT_DATE - INTERVAL '4 days', 'Present', NULL, 0, 0,  0),
(2, 3, CURRENT_DATE - INTERVAL '4 days', 'Present', NULL, 0, 0,  0),
(3, 3, CURRENT_DATE - INTERVAL '4 days', 'Present', NULL, 0, 0,  0),
(4, 3, CURRENT_DATE - INTERVAL '4 days', 'Late',    NULL, 0, 20, 0),
(5, 3, CURRENT_DATE - INTERVAL '4 days', 'Present', NULL, 0, 0,  0),
(6, 3, CURRENT_DATE - INTERVAL '4 days', 'Present', NULL, 0, 0,  0),
-- 3 days ago
(1, 3, CURRENT_DATE - INTERVAL '3 days', 'Present', NULL, 0, 0, 0),
(2, 3, CURRENT_DATE - INTERVAL '3 days', 'Present', NULL, 0, 0, 0),
(3, 3, CURRENT_DATE - INTERVAL '3 days', 'Absent',  'Medical Appointment', 1, 0, 0),
(4, 3, CURRENT_DATE - INTERVAL '3 days', 'Present', NULL, 0, 0, 0),
(5, 3, CURRENT_DATE - INTERVAL '3 days', 'Present', NULL, 0, 0, 0),
(6, 3, CURRENT_DATE - INTERVAL '3 days', 'Present', NULL, 0, 0, 0),
-- 2 days ago
(1, 3, CURRENT_DATE - INTERVAL '2 days', 'Present', NULL, 0, 0,  0),
(2, 3, CURRENT_DATE - INTERVAL '2 days', 'Late',    NULL, 0, 10, 0),
(3, 3, CURRENT_DATE - INTERVAL '2 days', 'Present', NULL, 0, 0,  0),
(4, 3, CURRENT_DATE - INTERVAL '2 days', 'Present', NULL, 0, 0,  0),
(5, 3, CURRENT_DATE - INTERVAL '2 days', 'Present', NULL, 0, 0,  0),
(6, 3, CURRENT_DATE - INTERVAL '2 days', 'Present', NULL, 0, 0,  0),
-- yesterday
(1, 3, CURRENT_DATE - INTERVAL '1 day',  'Present', NULL, 0, 0, 0),
(2, 3, CURRENT_DATE - INTERVAL '1 day',  'Present', NULL, 0, 0, 0),
(3, 3, CURRENT_DATE - INTERVAL '1 day',  'Present', NULL, 0, 0, 0),
(4, 3, CURRENT_DATE - INTERVAL '1 day',  'Present', NULL, 0, 0, 0),
(5, 3, CURRENT_DATE - INTERVAL '1 day',  'Absent',  'Family Emergency', 1, 0, 0),
(6, 3, CURRENT_DATE - INTERVAL '1 day',  'Present', NULL, 0, 0, 0);

-- =============================================
-- NOTES
-- =============================================
-- Default password for all accounts: password123
--
-- IT Admin : itadmin
-- Admin    : admin
-- Schools  : greenfield_primary | riverside_academy | sunshine_school
--
-- Sequence: run schema.sql first, then seed.sql
