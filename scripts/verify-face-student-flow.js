const { chromium } = require('playwright-core');
const mysql = require('mysql2/promise');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const TEST_STUDENT_ID = Number(process.env.FACE_TEST_STUDENT_ID || 31);
const TEST_DATE = process.env.FACE_TEST_DATE || '2026-06-06';
const TEST_DESCRIPTOR = Array(128).fill(0.42);

async function main() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'psp'
  });

  await pool.query('UPDATE students SET face_descriptor = NULL, face_enrolled_at = NULL WHERE id = ?', [TEST_STUDENT_ID]);
  await pool.query('DELETE FROM student_attendance WHERE student_id = ? AND date = ?', [TEST_STUDENT_ID, TEST_DATE]);

  const browser = await chromium.launch({
    headless: true,
    executablePath: EDGE,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  });

  const page = await browser.newPage();

  page.on('console', (msg) => console.log(`console:${msg.type()}:${msg.text()}`));
  page.on('pageerror', (err) => console.log(`pageerror:${err.message}`));

  await page.goto('http://localhost:3000/login');
  await page.fill('input[name="username"]', 'demo_greenfield');
  await page.fill('input[name="password"]', 'Demo@1234');
  await page.locator('.login-btn').click();
  await page.waitForURL('**/school/dashboard');

  await page.goto(`http://localhost:3000/student/edit/${TEST_STUDENT_ID}`);
  await page.waitForTimeout(3000);
  await injectTestFace(page);
  await page.locator('[data-face-start]').click();
  await page.waitForFunction(() => document.querySelector('[data-face-status]')?.textContent.includes('Camera ready'));
  await page.locator('[data-face-capture]').click();
  await page.waitForFunction(() => document.querySelector('[data-face-status]')?.textContent.includes('Face captured successfully'));
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/student');

  const [faceRows] = await pool.query(
    'SELECT face_descriptor IS NOT NULL AS enrolled FROM students WHERE id = ?',
    [TEST_STUDENT_ID]
  );
  if (!faceRows[0] || !faceRows[0].enrolled) {
    throw new Error('Face enrollment was not saved to the database.');
  }

  await page.goto(`http://localhost:3000/student-attendance/mark?grade=1&class=A&date=${TEST_DATE}`);
  await page.waitForTimeout(3000);
  await injectTestFace(page);
  await page.locator('#start-face-scan').click();
  await page.waitForFunction(
    () => document.querySelector('#face-status')?.textContent.includes('Recognized'),
    null,
    { timeout: 15000 }
  );

  const badge = await page.locator(`#status-badge-${TEST_STUDENT_ID}`).textContent();
  if (!badge || !badge.includes('Present')) {
    throw new Error('Attendance UI was not updated to Present.');
  }

  const [attendanceRows] = await pool.query(
    'SELECT status, reason FROM student_attendance WHERE student_id = ? AND date = ? ORDER BY id DESC LIMIT 1',
    [TEST_STUDENT_ID, TEST_DATE]
  );
  if (!attendanceRows[0] || attendanceRows[0].status !== 'Present') {
    throw new Error('Attendance was not saved as Present.');
  }

  console.log(`PASS: student ${TEST_STUDENT_ID} enrolled and marked present on ${TEST_DATE}`);
  console.log(`DB attendance: ${JSON.stringify(attendanceRows[0])}`);

  await browser.close();
  await pool.end();
}

async function injectTestFace(page) {
  await page.evaluate((descriptor) => {
    window.faceapi.nets.tinyFaceDetector.loadFromUri = async () => {};
    window.faceapi.nets.faceLandmark68Net.loadFromUri = async () => {};
    window.faceapi.nets.faceRecognitionNet.loadFromUri = async () => {};
    window.faceapi.detectSingleFace = () => ({
      withFaceLandmarks() {
        return {
          async withFaceDescriptor() {
            return { descriptor: Float32Array.from(descriptor) };
          }
        };
      }
    });
    window.faceapi.TinyFaceDetectorOptions = function TinyFaceDetectorOptions() {};
    window.PSPFaceVision.analyzeVideoFrame = async () => ({ brightness: 120, sharpness: 120 });
  }, TEST_DESCRIPTOR);
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
