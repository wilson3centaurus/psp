# PSP System Guide

## 1. What This System Is
Primary School Performance (PSP) is a Node.js + Express web system for school operations:
- User authentication and role-based access (`admin`, `school`, `itadmin`)
- Student and teacher management
- Student and teacher attendance tracking
- Resource tracking
- Admin analytics and reports
- Face ID enrollment + attendance auto-marking (browser camera + local models)

## 2. Languages and Their Purpose
- JavaScript (Node.js): backend server, controllers, routes, middleware, DB access, utility logic.
- EJS (Embedded JavaScript Templates): server-rendered HTML views for login, admin, school pages.
- CSS: UI styling (`public/css/style.css`).
- Client-side JavaScript: browser interactivity, validation, theme controls, Face ID capture and recognition.
- SQL (MySQL/PostgreSQL scripts): schema, migrations, seed data.
- JSON: package/dependency manifests, deployment config, local settings.
- Plain text/Markdown: system overview and setup docs.

## 3. Architecture and How It Works
- Entry point: `server.js`
- Pattern: MVC-style organization
  - Routes -> Controllers -> Database (`mysql2` pool)
  - Views rendered with EJS
- Session auth: `express-session`
- Flash messages: `connect-flash`
- Static assets: `public/`
- Upload serving: `/uploads`

### Main Roles
- `itadmin`: creates school/admin accounts via access code (`ITADMIN_SECRET`)
- `admin`: system-wide dashboards, schools, reports, analytics
- `school`: manages own students, teachers, attendance, resources

### Face ID Flow
- Enrollment:
  - Add/Edit student/teacher captures 128-length descriptor in browser.
  - Descriptor stored in DB (`face_descriptor`, `face_enrolled_at`).
- Recognition on attendance pages:
  - Browser camera + `face-api` compares detected descriptor to enrolled profiles.
  - On match, status is automatically set to `Present`.
- Local assets used (no CDN dependency for core models/libs):
  - `/public/vendor/tf.min.js`
  - `/public/vendor/face-api.min.js`
  - `/public/models/*`

## 4. Environment Variables
Create a `.env` file in project root.

Required/used values:
- `DB_HOST` (default `localhost`)
- `DB_USER` (default `root`)
- `DB_PASS` (default empty)
- `DB_NAME` (default `psp`)
- `SESSION_SECRET` (recommended custom secret)
- `ITADMIN_SECRET` (required for `/itadmin` account creation flow)
- `PORT` (default `3000`)

Example:
```env
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=psp
SESSION_SECRET=change_me
ITADMIN_SECRET=change_me_too
PORT=3000
```

## 5. How to Launch (Step by Step)

### Step 1: Install prerequisites (one-time)
- Install Node.js 18+ (LTS recommended)
- Install XAMPP (for MySQL + phpMyAdmin)

### Step 2: Start database services in XAMPP
1. Open **XAMPP Control Panel**
2. Click **Start** next to **MySQL**
3. Confirm MySQL shows green/running
4. Optional: click **Admin** to open phpMyAdmin (`http://localhost/phpmyadmin`)

### Step 3: Open project in VS Code
1. Open **Visual Studio Code**
2. Click **File -> Open Folder...**
3. Select:
`C:\Users\CyberFlacx\Desktop\nikisi`
4. Open a terminal in VS Code:
   - **Terminal -> New Terminal**
   - Ensure terminal path is the project root

### Step 4: Install Node dependencies
Run in VS Code terminal:
```bash
npm install
```

### Step 5: Create `.env` file (if missing)
Create `.env` in project root with:
```env
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=psp
SESSION_SECRET=change_me
ITADMIN_SECRET=change_me_too
PORT=3000
```

### Step 6: Create and seed database
Use one method.

Method A (phpMyAdmin):
1. Open `http://localhost/phpmyadmin`
2. Create DB `psp` if it does not exist
3. Run `database/schema.sql`
4. Run `database/seed.sql`

Method B (terminal SQL import):
```bash
mysql -u root -p psp < database/schema.sql
mysql -u root -p psp < database/seed.sql
```

Method C (all-in-one):
```bash
mysql -u root -p < database/setup.sql
```

### Step 7: Run optional migrations for old databases
If this DB was created from an older version:
```bash
mysql -u root -p psp < database/migration_v2_student_fields.sql
mysql -u root -p psp < database/migration_v3_face_biometrics.sql
```

### Step 8: Start the application
In VS Code terminal:
```bash
npm start
```

Expected output includes:
- `Server running on:`
- `http://localhost:3000`
- `[DB] MySQL connection OK`

### Step 9: Open system in browser
- Open `http://localhost:3000`
- You should see the login page

### Step 10: Login credentials (seed defaults)
- IT Admin: `itadmin` / `password123`
- Admin: `admin` / `password123`
- Schools:
  - `greenfield_primary` / `password123`
  - `riverside_academy` / `password123`
  - `sunshine_school` / `password123`

## 6. Runtime Notes
- Uploaded files/logos and CSVs are in `uploads/`.
- Face ID camera requires browser permission.
- If not using localhost, camera typically requires HTTPS.
- Deployment config exists for Vercel in `vercel.json`.

## 7. Folder-by-Folder Purpose
- `.claude/`: local AI assistant/tooling settings.
- `config/`: DB and auth configuration.
- `controllers/`: request handlers/business logic.
  - `controllers/admin/`: admin-specific logic.
- `database/`: schema, migrations, seeds, DB docs.
- `middlewares/`: auth/role checks and request context injectors.
- `models/`: data-layer helper modules.
- `public/`: static frontend assets (CSS, JS, logo, face models, vendor libs).
- `routes/`: route definitions (general + admin subroutes).
- `uploads/`: user-uploaded assets + sample CSV templates.
- `utils/`: shared helpers (validation, CSV/report helpers, face descriptor helpers).
- `views/`: EJS templates (admin, school, partials, login, error pages).

## 8. Complete Contents Snapshot (excluding `.git/` and `node_modules/`)
```text.
- .claude/
  - .claude\settings.local.json
- .gitignore
- .railwayignore
- config/
  - config\auth.js
  - config\db.js
- controllers/
  - controllers\admin/
    - controllers\admin\analyticsController.js
    - controllers\admin\attendanceController.js
    - controllers\admin\reportController.js
    - controllers\admin\resourceController.js
    - controllers\admin\schoolController.js
    - controllers\admin\studentController.js
    - controllers\admin\teacherController.js
  - controllers\adminController.js
  - controllers\analyticsController.js
  - controllers\authController.js
  - controllers\itadminController.js
  - controllers\reportController.js
  - controllers\resourceController.js
  - controllers\studentAttendanceController.js
  - controllers\studentController.js
  - controllers\teacherAttendanceController.js
  - controllers\teacherController.js
- database/
  - database\migrate.js
  - database\migration_v2_student_fields.sql
  - database\migration_v3_face_biometrics.sql
  - database\README.md
  - database\schema.mysql.sql
  - database\schema.pg.sql
  - database\schema.sql
  - database\seed.js
  - database\seed.sql
  - database\setup.sql
- middlewares/
  - middlewares\injectSchoolInfo.js
  - middlewares\isAuthenticated.js
  - middlewares\roleChecker.js
- models/
  - models\attendanceModel.js
  - models\resourceModel.js
  - models\studentModel.js
  - models\teacherModel.js
  - models\userModel.js
- package.json
- package-lock.json
- PSP_System_Overview.txt
- public/
  - public\assets/
    - public\assets\logo.png
  - public\css/
    - public\css\style.css
  - public\js/
    - public\js\face-attendance.js
    - public\js\face-enrollment.js
    - public\js\main.js
  - public\models/
    - public\models\face_landmark_68_model-shard1
    - public\models\face_landmark_68_model-weights_manifest.json
    - public\models\face_recognition_model-shard1
    - public\models\face_recognition_model-weights_manifest.json
    - public\models\tiny_face_detector_model-shard1
    - public\models\tiny_face_detector_model-weights_manifest.json
  - public\vendor/
    - public\vendor\face-api.min.js
    - public\vendor\tf.min.js
- routes/
  - routes\admin/
    - routes\admin\analyticsRoutes.js
    - routes\admin\attendanceRoutes.js
    - routes\admin\reportRoutes.js
    - routes\admin\resourceRoutes.js
    - routes\admin\schoolRoutes.js
    - routes\admin\studentRoutes.js
    - routes\admin\teacherRoutes.js
  - routes\adminRoutes.js
  - routes\analyticsRoutes.js
  - routes\authRoutes.js
  - routes\itadminRoutes.js
  - routes\reportRoutes.js
  - routes\resourceRoutes.js
  - routes\schoolRoutes.js
  - routes\studentAttendanceRoutes.js
  - routes\studentRoutes.js
  - routes\teacherAttendanceRoutes.js
  - routes\teacherRoutes.js
- sandbox_write_check.txt
- server.js
- uploads/
  - uploads\2ad4735732ec31939c49c2dcce762409
  - uploads\5ceed57126b5b70d9115c01b3d1e013b
  - uploads\6a3b99c948669d88d4769657183386be
  - uploads\7546ea2a69cf4b2d8c01b358af6c631b
  - uploads\77816dc3de373d6594ea6489f55009dc
  - uploads\85dd75e636215740e7b1183f0bd22063
  - uploads\883a5afa6db9e4dc31f7ccfac5c06af8
  - uploads\bf890c37fb8f00d013213011e3a143f0
  - uploads\c0bb557964c67122171c789152b6039f
  - uploads\cd7ac78c862278aaeead83e14f059135
  - uploads\ce08bad7e81a09ae543cc6a72670d648
  - uploads\ce136a238592e2fb21d07ed9592bccd2
  - uploads\d20588cf0cf17ba1a29e1e4f39e8e33d
  - uploads\d393598a71f44ab6d159b0e445ca9076
  - uploads\e8b3ff70961280b714a3b80fce07b213
  - uploads\f1294123aa79b8e656f7fe4e640de510
  - uploads\f973c6912cda9284c2b836b1fc3ec2c6
  - uploads\logo_1770408332026.png
  - uploads\logo_1770408345413.png
  - uploads\logo_1770425472260.jpg
  - uploads\logo_1770425522008.png
  - uploads\logo_1770484166516.png
  - uploads\logo_1771498976807.png
  - uploads\logo_1771505528325.png
  - uploads\logo_1771505556461.png
  - uploads\logo_1774440233356.png
  - uploads\logo_1774440260612.png
  - uploads\logo_1774440279749.png
  - uploads\logo_1778882651080.png
  - uploads\logo_1778882663159.png
  - uploads\logo_1778882679644.png
  - uploads\sample-templates/
    - uploads\sample-templates\baring/
      - uploads\sample-templates\baring\resources.csv
      - uploads\sample-templates\baring\students.csv
      - uploads\sample-templates\baring\teachers.csv
    - uploads\sample-templates\chikanga/
      - uploads\sample-templates\chikanga\resources.csv
      - uploads\sample-templates\chikanga\students.csv
      - uploads\sample-templates\chikanga\teachers.csv
    - uploads\sample-templates\resource_template.csv
    - uploads\sample-templates\resources_sample.csv
    - uploads\sample-templates\student_template.csv
    - uploads\sample-templates\students_sample.csv
    - uploads\sample-templates\students_sample2.csv
    - uploads\sample-templates\sunshine/
      - uploads\sample-templates\sunshine\resources.csv
      - uploads\sample-templates\sunshine\students.csv
      - uploads\sample-templates\sunshine\teachers.csv
    - uploads\sample-templates\teacher_template.csv
    - uploads\sample-templates\teachers_sample.csv
    - uploads\sample-templates\teachers_sample2.csv
- utils/
  - utils\csvParser.js
  - utils\faceBiometric.js
  - utils\reportGenerator.js
  - utils\validate.js
- vercel.json
- views/
  - views\admin/
    - views\admin\allSchools.ejs
    - views\admin\analytics/
    - views\admin\analytics.ejs
      - views\admin\analytics\index.ejs
    - views\admin\attendance/
      - views\admin\attendance\index.ejs
    - views\admin\dashboard.ejs
    - views\admin\generateReport.ejs
    - views\admin\itadmin_register.ejs
    - views\admin\reports/
      - views\admin\reports\index.ejs
    - views\admin\resources/
      - views\admin\resources\index.ejs
    - views\admin\schools/
      - views\admin\schools\edit.ejs
      - views\admin\schools\index.ejs
    - views\admin\students/
      - views\admin\students\index.ejs
    - views\admin\teachers/
      - views\admin\teachers\index.ejs
  - views\error.ejs
  - views\login.ejs
  - views\partials/
    - views\partials\footer.ejs
    - views\partials\header.ejs
    - views\partials\navbar.ejs
  - views\school/
    - views\school\addstudent.ejs
    - views\school\addTeacher.ejs
    - views\school\dashboard.ejs
    - views\school\editStudent.ejs
    - views\school\editTeacher.ejs
    - views\school\error.ejs
    - views\school\resources/
      - views\school\resources\add.ejs
      - views\school\resources\edit.ejs
      - views\school\resources\index.ejs
    - views\school\studentAttendance/
      - views\school\studentAttendance\mark.ejs
      - views\school\studentAttendance\sessions.ejs
      - views\school\studentAttendance\view.ejs
    - views\school\students.ejs
    - views\school\teacherAttendance/
      - views\school\teacherAttendance\mark.ejs
      - views\school\teacherAttendance\sessions.ejs
      - views\school\teacherAttendance\view.ejs
    - views\school\teachers.ejs
    - views\school\uploadCSV.ejs
    - views\school\uploadStudents.ejs
```

## 9. Purpose of Key Root Files
- `server.js`: express app bootstrap and route mounting.
- `package.json`: scripts and dependencies.
- `package-lock.json`: deterministic dependency lockfile.
- `vercel.json`: Vercel deployment routing/build config.
- `PSP_System_Overview.txt`: narrative architecture/operations summary.
- `.gitignore`: git exclusion rules.
- `.railwayignore`: Railway deployment ignore rules.
- `sandbox_write_check.txt`: workspace write check artifact.

## 10. Quick Troubleshooting
- DB connection failed:
  - verify MySQL service is running
  - verify `.env` DB credentials
- Login fails:
  - confirm users were seeded
  - confirm password hashes are in DB
- Face ID fails:
  - allow camera permission
  - use localhost/HTTPS
  - verify `/public/vendor/*` and `/public/models/*` exist
  - ensure person has enrolled face descriptor first
