/**
 * Central validation utility for the PSP system.
 * All validators return { valid: true } on success or { valid: false, message: '...' } on failure.
 */

const VALID_GRADES = ['1', '2', '3', '4', '5', '6', '7'];
const VALID_CLASSES = ['A', 'B', 'C', 'D', 'E', 'F'];
const VALID_GENDERS = ['Male', 'Female', 'Other'];
const VALID_SUBJECTS = [
  'Mathematics',
  'English',
  'Chishona',
  'Social Science',
  'Physical Education and Arts',
  'Science and Technology'
];
const VALID_ROLES = ['school', 'admin'];

// Primary school age window (Zimbabwe): 3 – 20 years
const MIN_AGE_YEARS = 3;
const MAX_AGE_YEARS = 20;

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function err(message) {
  return { valid: false, message };
}
function ok() {
  return { valid: true };
}

/** Strips leading/trailing whitespace; returns empty string for null/undefined. */
function clean(val) {
  return (val || '').toString().trim();
}

/** Checks if a value is a non-empty string after trimming. */
function notEmpty(val) {
  return clean(val).length > 0;
}

// ─────────────────────────────────────────────
// FIELD VALIDATORS
// ─────────────────────────────────────────────

exports.validateName = function (name, label = 'Name') {
  const v = clean(name);
  if (!v) return err(`${label} is required.`);
  if (v.length < 4)  return err(`${label} is too short — please enter your full name.`);
  if (v.length > 100) return err(`${label} must not exceed 100 characters.`);
  if (!/^[A-Za-z\s'\-\.]+$/.test(v))
    return err(`${label} may only contain letters, spaces, hyphens, apostrophes, and periods — no numbers or symbols.`);
  if (/\s{2,}/.test(v)) return err(`${label} cannot have consecutive spaces.`);
  const words = v.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 2) return err(`${label} must include both first and last name (e.g. "Tendai Moyo").`);
  if (words.some(w => w.length < 2)) return err(`Each part of the ${label.toLowerCase()} must be at least 2 letters.`);
  return ok();
};

exports.validateGrade = function (grade) {
  if (!notEmpty(grade)) return err('Grade is required.');
  if (!VALID_GRADES.includes(clean(grade))) return err('Grade must be between 1 and 7.');
  return ok();
};

exports.validateClass = function (cls) {
  if (!notEmpty(cls)) return err('Class is required.');
  if (!VALID_CLASSES.includes(clean(cls).toUpperCase())) return err('Class must be A, B, C, D, E, or F.');
  return ok();
};

exports.validateGender = function (gender) {
  if (!notEmpty(gender)) return err('Gender is required.');
  if (!VALID_GENDERS.includes(clean(gender))) return err('Gender must be Male, Female, or Other.');
  return ok();
};

exports.validateStudentId = function (id) {
  const v = clean(id);
  if (!v) return err('Student ID is required.');
  if (v.length < 2) return err('Student ID must be at least 2 characters.');
  if (v.length > 50) return err('Student ID must not exceed 50 characters.');
  if (!/^[A-Za-z0-9\-_\/]+$/.test(v))
    return err('Student ID may only contain letters, numbers, hyphens, underscores, and slashes.');
  return ok();
};

/**
 * Validates a student's Date of Birth.
 * Primary school age: 5–18 years (Zimbabwe Grade 1–7 can include older transfer students).
 */
exports.validateStudentDOB = function (dob) {
  if (!notEmpty(dob)) return err('Date of birth is required.');

  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return err('Date of birth is not a valid date.');

  const today = new Date();
  // Age in full years
  let age = today.getFullYear() - birth.getFullYear();
  const mDiff = today.getMonth() - birth.getMonth();
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) age--;

  if (age < MIN_AGE_YEARS)
    return err(`Student must be at least ${MIN_AGE_YEARS} years old to be enrolled.`);
  if (age > MAX_AGE_YEARS)
    return err(`Student age (${age}) exceeds the maximum allowed age of ${MAX_AGE_YEARS} for primary school.`);

  // Must not be a future date
  if (birth > today) return err('Date of birth cannot be in the future.');

  return ok();
};

exports.validateEnrollmentDate = function (date, dob) {
  if (!notEmpty(date)) return err('Enrollment date is required.');
  const d = new Date(date);
  if (isNaN(d.getTime())) return err('Enrollment date is not a valid date.');
  const today = new Date();
  today.setHours(23, 59, 59, 0);
  if (d > today) return err('Enrollment date cannot be in the future.');
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 30);
  if (d < minDate) return err('Enrollment date cannot be more than 30 years in the past.');
  if (dob) {
    const dobDate = new Date(dob);
    if (!isNaN(dobDate.getTime())) {
      const diffYrs = (d - dobDate) / (365.25 * 24 * 3600 * 1000);
      if (diffYrs < 3) return err('Enrollment date must be at least 3 years after the date of birth.');
    }
  }
  return ok();
};

/**
 * Validates a phone number loosely: accepts Zimbabwean mobile and landline formats.
 * Accepts: +263XXXXXXXXX, 07XXXXXXXX, 0XXXXXXXXX, and similar patterns.
 * Min 7, max 20 digits (after stripping spaces/dashes).
 */
exports.validatePhone = function (phone, label = 'Phone number', required = false) {
  const v = clean(phone);
  if (!v) {
    if (required) return err(`${label} is required.`);
    return ok(); // optional, skip
  }
  // Strip spaces, dashes, parentheses for digit count
  const digits = v.replace(/[\s\-\(\)\.]/g, '');
  if (!/^\d{10}$/.test(digits))
    return err(`${label} must be exactly 10 digits (e.g. 0712345678).`);
  return ok();
};

exports.validateEmail = function (email, label = 'Email', required = false) {
  const v = clean(email).toLowerCase();
  if (!v) {
    if (required) return err(`${label} is required.`);
    return ok();
  }
  if (v.length > 254) return err(`${label} is too long (max 254 characters).`);
  const atCount = (v.match(/@/g) || []).length;
  if (atCount === 0) return err(`${label} must contain an @ symbol (e.g. name@gmail.com).`);
  if (atCount > 1)   return err(`${label} must contain only one @ symbol.`);
  const [local, domain] = v.split('@');
  if (!local || local.length === 0) return err(`${label} must have a name before the @ (e.g. john@gmail.com).`);
  if (local.length > 64) return err(`The part before @ in ${label} is too long (max 64 characters).`);
  if (/^[.\-_+]/.test(local)) return err(`${label} username cannot start with "${local[0]}" — remove it.`);
  if (/[.\-_+]$/.test(local)) return err(`${label} username cannot end with "${local[local.length-1]}" — remove it.`);
  if (/[.]{2,}/.test(local)) return err(`${label} username cannot have two dots in a row.`);
  if (!/^[a-zA-Z0-9._%+\-]+$/.test(local)) return err(`${label} username contains an invalid character. Use only letters, numbers, dots, underscores or hyphens.`);
  if (!domain || domain.length === 0) return err(`${label} must have a domain after the @ (e.g. name@gmail.com).`);
  if (!/^[a-zA-Z0-9.\-]+$/.test(domain)) return err(`${label} domain contains an invalid character.`);
  if (/^[\-.]/.test(domain) || /[\-.]$/.test(domain)) return err(`${label} domain cannot start or end with a hyphen or dot.`);
  if (/[.]{2,}/.test(domain)) return err(`${label} domain cannot have two dots in a row.`);
  if (!domain.includes('.')) return err(`${label} domain must include a TLD — e.g. @gmail.com, not just @gmail.`);
  const tld = domain.split('.').pop();
  if (tld.length < 2) return err(`${label} extension is too short — use .com, .org, .zw etc.`);
  if (tld.length > 6) return err(`${label} extension ".${tld}" is too long — use .com, .org, .zw etc.`);
  if (!/^[a-zA-Z]+$/.test(tld)) return err(`${label} extension must be letters only (e.g. .com, .org, .zw).`);
  return ok();
};

exports.validateSubject = function (subject) {
  if (!notEmpty(subject)) return err('Subject is required.');
  if (!VALID_SUBJECTS.includes(clean(subject))) return err('Please select a valid subject from the list.');
  return ok();
};

/**
 * Validates a teacher EC (Employee Code) Number.
 * Zimbabwe ministry format: exactly 7 digits followed by 1 letter (e.g. 1234567G).
 */
exports.validateECNumber = function (ecNum) {
  const v = clean(ecNum);
  if (!v) return err('EC Number is required.');
  if (!/^[0-9]{7}[A-Za-z]$/.test(v))
    return err('EC Number must be exactly 7 digits followed by 1 letter (e.g. 1234567G).');
  return ok();
};

// ─────────────────────────────────────────────
// USER / AUTH VALIDATORS
// ─────────────────────────────────────────────

exports.validateUsername = function (username) {
  const v = clean(username);
  if (!v) return err('Username is required.');
  if (v.length < 4)  return err('Username must be at least 4 characters.');
  if (v.length > 50) return err('Username must not exceed 50 characters.');
  if (!/^[A-Za-z0-9_\-\.]+$/.test(v))
    return err('Username may only contain letters, numbers, underscores, hyphens, and periods.');
  return ok();
};

exports.validatePassword = function (password) {
  const v = password || '';
  if (!v) return err('Password is required.');
  if (v.length < 8) return err('Password must be at least 8 characters long.');
  if (v.length > 128) return err('Password must not exceed 128 characters.');
  if (!/[A-Z]/.test(v)) return err('Password must contain at least one uppercase letter (A–Z).');
  if (!/[a-z]/.test(v)) return err('Password must contain at least one lowercase letter (a–z).');
  if (!/[0-9]/.test(v)) return err('Password must contain at least one number (0–9).');
  if (!/[^A-Za-z0-9]/.test(v))
    return err('Password must contain at least one special character (e.g. @, #, !, $).');
  return ok();
};

exports.validateRole = function (role) {
  if (!notEmpty(role)) return err('Role is required.');
  if (!VALID_ROLES.includes(clean(role))) return err('Role must be "school" or "admin".');
  return ok();
};

// ─────────────────────────────────────────────
// BATCH HELPER
// Runs an array of validator results and collects all error messages.
// Returns { valid: true } if all pass, or { valid: false, message: '...' }
// ─────────────────────────────────────────────
exports.runAll = function (results) {
  const errors = results.filter(r => !r.valid).map(r => r.message);
  if (errors.length === 0) return ok();
  return { valid: false, message: errors.join(' ') };
};
