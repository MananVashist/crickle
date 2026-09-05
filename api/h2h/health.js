import { createClient } from '@supabase/supabase-js';

/**
 * Is the server's Supabase credential actually usable?
 *
 * WHY THIS EXISTS. Every other h2h route checks the caller's identity before it
 * touches the database, which is correct — and it means no request from outside
 * can tell a working server credential from a broken one. Both produce 401.
 *
 * That gap was real on 2026-09-06: SUPABASE_SERVICE_ROLE_KEY had already been
 * created once with an EMPTY value (the CLI prompt took a newline before the
 * paste), and a wrong-but-non-empty key behaves the same way — createClient
 * succeeds, the module loads, and the first actual query is where it dies. With
 * no traffic on a low-use app, that could sit undiscovered for days, and the
 * only proposed check was "ask a human to open the app and look at the logs".
 *
 * So: one endpoint whose entire job is to run the cheapest possible real query
 * and report whether the credential worked.
 *
 * IT RETURNS NO DATA, deliberately. `head: true` with `count: 'exact'` asks
 * Postgres for a row count and no rows at all, so this leaks nothing about
 * players even though it runs as service_role — the count is of a table whose
 * size is not sensitive, and the body carries only ok/false and an error
 * message. It is safe to leave unauthenticated, which is the point: an
 * authenticated health check cannot answer the question it exists to answer.
 */
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const env = {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_SERVICE_ACCOUNT_KEY: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
  };

  // Presence is reported separately from usability, because "set" and "correct"
  // are different failures and the empty-value incident was the first one.
  const { error, count } = await supabase
    .from('crickle_friendships')
    .select('id', { count: 'exact', head: true });

  if (error) {
    return res.status(500).json({
      ok: false,
      // The likely cause first: if RLS is on and this key is not really
      // service_role, the query is refused rather than merely empty.
      supabase: 'query failed — the service-role key is missing, empty or not a service-role key',
      error: error.message,
      env,
    });
  }

  return res.status(200).json({ ok: true, supabase: 'service-role query succeeded', rows: count, env });
}
