const { createClient } = require('@supabase/supabase-js');

console.log('[DB] SUPABASE_URL      :', process.env.SUPABASE_URL);
console.log('[DB] SUPABASE_SERVICE_KEY (first 20):', (process.env.SUPABASE_SERVICE_KEY || '').slice(0, 20) + '...');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    db: { schema: 'psp' },
    auth: { persistSession: false },
  }
);

// Smoke-test: verify we can reach the DB at startup
(async () => {
  console.log('[DB] Running startup connectivity check against psp.users ...');
  const { data, error, status, statusText } = await supabase
    .from('users')
    .select('id')
    .limit(1);
  if (error) {
    console.error('[DB] Startup check FAILED:', { status, statusText, error });
  } else {
    console.log('[DB] Startup check OK — rows sampled:', data.length);
  }
})();

module.exports = { supabase };