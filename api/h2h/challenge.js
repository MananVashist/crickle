import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { uid } = req.query;
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
      sender_uid, sender_name, sender_score,
      receiver_uid, receiver_name, receiver_score
    } = req.body;

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
