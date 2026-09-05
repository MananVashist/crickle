import { createClient } from '@supabase/supabase-js';
import { requireUid } from '../_lib/firebaseAuth.js';


const supabase = createClient(
  process.env.SUPABASE_URL,
  // SERVICE ROLE, not the anon key.
  //
  // This is server-side code, so the anon key bought nothing here — and it was
  // what made locking these tables down impossible. On 2026-09-05 the public
  // anon key was found able to read crickle_user_tokens (FCM push tokens keyed
  // to uids), crickle_friendships and crickle_challenges straight through
  // PostgREST, because RLS was off on all three. It could not simply be turned
  // on: Crickle authenticates with Firebase, so auth.uid() is NULL on every
  // request and no owner policy can be written — and these routes would have
  // been denied along with the attacker.
  //
  // Reading as service_role bypasses RLS, so RLS can now be enabled with NO
  // policies: the browser gets nothing, these routes keep working unchanged.
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    // uid from the VERIFIED token, never the query string. This endpoint used
    // to return any player's data to anyone who passed their uid.
    const callerUid = await requireUid(req, res);
    if (!callerUid) return;
    const uid = callerUid;
    if (!uid) return res.status(400).json({ error: 'uid required' });
    const { data, error } = await supabase
      .from('crickle_challenges')
      .select('*')
      .or(`sender_uid.eq.${uid},receiver_uid.eq.${uid}`)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  }

  if (req.method === 'POST') {
    const {
      code, mode, target_player,
      sender_name, sender_score,
      receiver_uid, receiver_name, receiver_score
    } = req.body;
    // The sender is whoever holds the token, not whoever the body names.
    const postUid = await requireUid(req, res);
    if (!postUid) return;
    const sender_uid = postUid;

    if (!code) return res.status(400).json({ error: 'code required' });

    // Check if challenge exists
    const { data: existing } = await supabase
      .from('crickle_challenges')
      .select('id, sender_uid')
      .eq('code', code)
      .maybeSingle();

    if (existing) {
      // Only update receiver fields (don't overwrite sender data)
      const updates = { updated_at: new Date().toISOString() };
      if (receiver_uid) updates.receiver_uid = receiver_uid;
      if (receiver_name) updates.receiver_name = receiver_name;
      if (receiver_score) updates.receiver_score = receiver_score;

      const { data, error } = await supabase
        .from('crickle_challenges')
        .update(updates)
        .eq('code', code)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    } else {
      // Insert new challenge
      const { data, error } = await supabase
        .from('crickle_challenges')
        .insert({
          code, mode, target_player,
          sender_uid, sender_name, sender_score,
          receiver_uid: receiver_uid || null,
          receiver_name: receiver_name || null,
          receiver_score: receiver_score || null,
        })
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
