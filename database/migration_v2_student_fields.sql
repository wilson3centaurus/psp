-- ============================================================
-- Migration: Add extended student fields
-- Run this against your existing 'psp' database to add the
-- new columns without dropping existing data.
--
--   mysql -u root psp < database/migration_v2_student_fields.sql
-- ============================================================

USE psp;

-- Add Date of Birth (required: set a safe default for existing rows, then optionally enforce NOT NULL)
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS dob DATE NULL AFTER student_id;

-- Add enrollment date
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS enrollment_date DATE NULL AFTER dob;

-- Add guardian / parent info
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS parent_name  VARCHAR(150) DEFAULT NULL AFTER enrollment_date,
  ADD COLUMN IF NOT EXISTS parent_phone VARCHAR(30)  DEFAULT NULL AFTER parent_name,
  ADD COLUMN IF NOT EXISTS parent_email VARCHAR(100) DEFAULT NULL AFTER parent_phone,
  ADD COLUMN IF NOT EXISTS medical_notes TEXT         DEFAULT NULL AFTER parent_email;

-- NOTE: After running this migration, populate dob and enrollment_date
-- for all existing records before applying NOT NULL constraints.
-- Once data is populated you can run:
--
--   ALTER TABLE students MODIFY COLUMN dob DATE NOT NULL;
--   ALTER TABLE students MODIFY COLUMN enrollment_date DATE NOT NULL;
