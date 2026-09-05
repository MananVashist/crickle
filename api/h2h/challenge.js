import { createClient } from '@supabase/supabase-js';
import { requireUid } from '../_lib/firebaseAuth.js';


const supabase = createClient(
  process.env.SUPABASE_URL,
  // SERVICE ROLE. Server-side, and required for RLS.
  //
  // The crickle_* tables now carry owner policies keyed on the caller's
  // Firebase uid. These routes legitimately need to touch rows that are NOT
  // the caller's: resolving an invite token to a friendship you have not
  // joined yet, and reading your OPPONENT's push token to notify them. Neither
  // is expressible as a per-user policy, and both are exactly what a trusted
  // server is for.
  //
  // Safe because these routes now establish WHO the caller is first
  // (api/_lib/firebaseAuth.js) rather than believing a uid from the request.
  // service_role without that check would just be a bigger version of the hole
  // it replaces.
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
