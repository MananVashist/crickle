import { createClient } from '@supabase/supabase-js';

/**
 * Register a device's FCM push token, server-side.
 *
 * WHY THIS EXISTS. The browser used to write crickle_user_tokens directly with
 * the Supabase ANON key (src/App.jsx, the PushNotifications 'registration'
 * listener). That single call was the only reason the anon role needed any
 * access to that table — and because it was an UPSERT, it could not be secured
 * from the client side at all.
 *
 * That is worth stating precisely, because it was measured rather than assumed
 * on 2026-09-05. PostgREST's upsert is INSERT ... ON CONFLICT DO UPDATE, which
 * must READ the row it updates. Two attempts to keep the client writing while
 * hiding the token both failed:
 *
 *   RLS on, INSERT+UPDATE policies, no SELECT policy   -> refresh 401
 *   RLS on, SELECT re-granted on (uid, updated_at) only -> refresh 401
 *
 * A client that can write its own token can always read it. So the write moves
 * here instead, the client loses all direct table access, and RLS can be
 * enabled on crickle_user_tokens with no policies at all.
 *
 * REMAINING GAP, stated rather than hidden: this endpoint trusts the uid in the
 * request body. Someone who knows another player's Firebase uid can still
 * overwrite that player's token and redirect their push notifications. That is
 * strictly better than before — uids are no longer enumerable, because reading
 * the table is now impossible from a browser — but it is not closed.
 *
 * Closing it means verifying the caller's Firebase ID token here (the client
 * already holds one; send it as a bearer and check it against Google's public
 * keys) and taking the uid from the verified token instead of the body. That is
 * the same change that would let Supabase accept Firebase JWTs directly and
 * give every crickle_* table a real owner policy, so it is worth doing once,
 * properly, rather than half here.
 */
const supabase = createClient(
  process.env.SUPABASE_URL,
  // service_role: this is server-side, and it is what lets RLS stay fully
  // closed on the table while this route keeps working.
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { uid, fcm_token: fcmToken } = req.body ?? {};
  if (typeof uid !== 'string' || !uid.trim() || typeof fcmToken !== 'string' || !fcmToken.trim()) {
    return res.status(400).json({ error: 'uid and fcm_token are required' });
  }

  const { error } = await supabase
    .from('crickle_user_tokens')
    .upsert({ uid, fcm_token: fcmToken, updated_at: new Date().toISOString() });

  if (error) {
    // Logged rather than returned verbatim: this runs as service_role, and a
    // raw Postgres error is more detail than an unauthenticated caller should
    // get back.
    console.error('[register-token] upsert failed:', error.message);
    return res.status(500).json({ error: 'Could not register token' });
  }
  return res.status(200).json({ ok: true });
}
