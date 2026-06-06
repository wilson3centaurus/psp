const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASS     || '',
  database:         process.env.DB_NAME     || 'psp',
  waitForConnections: true,
  connectionLimit:  10,
});

async function ensureColumn(table, column, definition) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  if (rows.length > 0) return false;
  await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  return true;
}

async function runCompatMigrations() {
  const migrations = [
    // users
    ['users', 'display_name', 'VARCHAR(255) NULL'],
    ['users', 'logo', 'VARCHAR(255) NULL'],
    ['users', 'email', 'VARCHAR(100) NULL'],
    ['users', 'phone', 'VARCHAR(50) NULL'],
    ['users', 'address', 'TEXT NULL'],
    ['users', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP'],

    // students
    ['students', 'dob', 'DATE NULL'],
    ['students', 'enrollment_date', 'DATE NULL'],
    ['students', 'parent_name', 'VARCHAR(150) NULL'],
    ['students', 'parent_phone', 'VARCHAR(30) NULL'],
    ['students', 'parent_email', 'VARCHAR(100) NULL'],
    ['students', 'medical_notes', 'TEXT NULL'],
    ['students', 'face_descriptor', 'LONGTEXT NULL'],
    ['students', 'face_enrolled_at', 'DATETIME NULL'],
    ['students', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP'],

    // teachers
    ['teachers', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP'],
    ['teachers', 'face_descriptor', 'LONGTEXT NULL'],
    ['teachers', 'face_enrolled_at', 'DATETIME NULL']
  ];

  let added = 0;
  for (const [table, column, definition] of migrations) {
    try {
      const wasAdded = await ensureColumn(table, column, definition);
      if (wasAdded) added += 1;
    } catch (err) {
      if (/Pool is closed/i.test(err.message || '')) {
        return;
      }
      console.warn(`[DB] Skipped migration ${table}.${column}: ${err.message}`);
    }
  }

  if (added > 0) {
    console.log(`[DB] Compatibility migration complete: ${added} column(s) added.`);
  }
}

// Smoke-test: verify we can reach the DB at startup
(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('[DB] MySQL connection OK');
    await runCompatMigrations();
  } catch (err) {
    console.error('[DB] MySQL connection FAILED:', err.message);
  }
})();

module.exports = { pool };
