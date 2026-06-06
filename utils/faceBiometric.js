function normalizeDescriptor(input) {
  if (input == null) return null;

  let parsed = input;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch (_) {
      return null;
    }
  }

  if (!Array.isArray(parsed) || parsed.length !== 128) return null;
  const numeric = parsed.map((v) => Number(v));
  if (numeric.some((v) => !Number.isFinite(v))) return null;
  return numeric;
}

function stringifyDescriptor(input) {
  const normalized = normalizeDescriptor(input);
  return normalized ? JSON.stringify(normalized) : null;
}

module.exports = {
  normalizeDescriptor,
  stringifyDescriptor
};

