# Database Setup Guide

## Quick Setup (XAMPP MySQL)

### Option 1: Using phpMyAdmin (Easiest)

1. Open XAMPP Control Panel and start **MySQL**
2. Open **phpMyAdmin** (http://localhost/phpmyadmin)
3. Click on **SQL** tab
4. Copy and paste the contents of `schema.sql` and click **Go**
5. Copy and paste the contents of `seed.sql` and click **Go**

### Option 2: Using MySQL Command Line

1. Open XAMPP Control Panel and start **MySQL**
2. Open Command Prompt/Terminal
3. Navigate to this directory:
   ```bash
   cd c:\Users\XO\Desktop\psp\psp\database
   ```
4. Run MySQL command:
   ```bash
   mysql -u root -p psp < schema.sql
   mysql -u root -p psp < seed.sql
   ```
   (Leave password blank if you haven't set one)

### Option 3: All-in-One Setup

```bash
mysql -u root -p < setup.sql
```

## Database Structure

### Tables Created:
- **users** - Stores admin, school, and IT admin accounts
- **students** - Student records linked to schools
- **teachers** - Teacher records linked to schools
- **student_attendance** - Daily student attendance tracking
- **teacher_attendance** - Daily teacher attendance tracking
- **resources** - Educational resources by subject and grade

## Default Login Credentials

After seeding, you can login with:

### IT Admin
- Username: `itadmin`
- Password: `password123`

### Admin
- Username: `admin`
- Password: `password123`

### Sample Schools
- Username: `greenfield_primary`
- Password: `password123`

- Username: `riverside_academy`
- Password: `password123`

- Username: `sunshine_school`
- Password: `password123`

## Troubleshooting

### "Database doesn't exist" error
Create it first:
```sql
CREATE DATABASE psp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE psp;
```

### "Access denied" error
Make sure XAMPP MySQL is running and check your `.env` file:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=psp
```

### Reset Database
To start fresh:
```sql
DROP DATABASE psp;
CREATE DATABASE psp;
USE psp;
```
Then run schema.sql and seed.sql again.

## What's Included in Seed Data

- 3 school accounts
- 15 sample students (Grades 1-3)
- 6 teachers with different subjects
- 9 resource entries
- Sample attendance data for the last few days

## Next Steps

1. Update your `.env` file with correct database credentials
2. Run the database setup
3. Start the server: `npm start`
4. Visit http://localhost:3000
5. Login with any of the default credentials above
