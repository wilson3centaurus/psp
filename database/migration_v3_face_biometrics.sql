-- ============================================================
-- Migration: Add Face ID biometric columns
-- Run on existing MySQL PSP database.
--
--   mysql -u root psp < database/migration_v3_face_biometrics.sql
-- ============================================================

USE psp;

-- students.face_descriptor
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'students' AND column_name = 'face_descriptor'
);
SET @sql := IF(@has_col = 0, 'ALTER TABLE students ADD COLUMN face_descriptor LONGTEXT NULL', 'SELECT "students.face_descriptor exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- students.face_enrolled_at
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'students' AND column_name = 'face_enrolled_at'
);
SET @sql := IF(@has_col = 0, 'ALTER TABLE students ADD COLUMN face_enrolled_at DATETIME NULL', 'SELECT "students.face_enrolled_at exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- teachers.face_descriptor
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'teachers' AND column_name = 'face_descriptor'
);
SET @sql := IF(@has_col = 0, 'ALTER TABLE teachers ADD COLUMN face_descriptor LONGTEXT NULL', 'SELECT "teachers.face_descriptor exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- teachers.face_enrolled_at
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'teachers' AND column_name = 'face_enrolled_at'
);
SET @sql := IF(@has_col = 0, 'ALTER TABLE teachers ADD COLUMN face_enrolled_at DATETIME NULL', 'SELECT "teachers.face_enrolled_at exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
