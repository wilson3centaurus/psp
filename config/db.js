const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASS     || '',
  database:         process.env.DB_NAME     || 'psp',
  waitForConnections: true,
  connectionLimit:  10,
});

// Smoke-test: verify we can reach the DB at startup
(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('[DB] MySQL connection OK');
  } catch (err) {
    console.error('[DB] MySQL connection FAILED:', err.message);
  }
})();

module.exports = { pool };