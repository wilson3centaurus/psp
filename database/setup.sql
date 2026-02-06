-- Complete Setup Script
-- Run this file to create and populate the database

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS psp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Use the database
USE psp;

-- Source the schema file
SOURCE schema.sql;

-- Source the seed file
SOURCE seed.sql;

-- Verify setup
SELECT 'Database setup completed successfully!' AS status;
SELECT COUNT(*) AS total_users FROM users;
SELECT COUNT(*) AS total_students FROM students;
SELECT COUNT(*) AS total_teachers FROM teachers;
SELECT COUNT(*) AS total_resources FROM resources;
