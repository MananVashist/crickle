import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET /api/h2h/friends?uid=xxx
  // Returns all accepted friends for a user
  if (req.method === 'GET') {
    const { uid, token } = req.query;

    // Resolve a friend request token (used when receiver opens the link)
    if (token) {
      const { data, error } = await supabase
        .from('crickle_friendships')
        .select('*')
        .eq('token', token)
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Friend request not found' });
      return res.json(data);
    }

    if (!uid) return res.status(400).json({ error: 'uid required' });

    const { data, error } = await supabase
      .from('crickle_friendships')
      .select('*')
      .or(`user_a_uid.eq.${uid},user_b_uid.eq.${uid}`)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  }

  // POST /api/h2h/friends
  if (req.method === 'POST') {
    const { action } = req.body;

    // action: 'request' — create a friend request link
    // Body: { action: 'request', sender_uid, sender_name }
    if (action === 'request') {
      const { sender_uid, sender_name } = req.body;
      if (!sender_uid || !sender_name) {
        return res.status(400).json({ error: 'sender_uid and sender_name required' });
      }

      // Return existing pending request if one already exists
      const { data: existing } = await supabase
        .from('crickle_friendships')
        .select('id, token')
        .eq('user_a_uid', sender_uid)
        .eq('status', 'pending')
        .maybeSingle();

      if (existing) {
        return res.json({ token: existing.token, id: existing.id });
      }

      const token = randomBytes(16).toString('hex');
      const { data, error } = await supabase
        .from('crickle_friendships')
        .insert({
          user_a_uid: sender_uid,
          user_a_name: sender_name,
          user_b_uid: 'pending',
          user_b_name: 'pending',
          status: 'pending',
          token,
        })
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ token, id: data.id });
    }

    // action: 'accept' — receiver accepts the friend request
    // Body: { action: 'accept', token, receiver_uid, receiver_name }
    if (action === 'accept') {
      const { token, receiver_uid, receiver_name } = req.body;
      if (!token || !receiver_uid || !receiver_name) {
        return res.status(400).json({ error: 'token, receiver_uid and receiver_name required' });
      }

      // Look up the pending request
      const { data: existing, error: fetchErr } = await supabase
        .from('crickle_friendships')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .maybeSingle();

      if (fetchErr) return res.status(500).json({ error: fetchErr.message });
      if (!existing) return res.status(404).json({ error: 'Friend request not found or already accepted' });

      // Prevent self-friending
      if (existing.user_a_uid === receiver_uid) {
        return res.status(400).json({ error: 'Cannot add yourself as a friend' });
      }

      // Check if already friends (in either direction)
      const { data: alreadyFriends } = await supabase
        .from('crickle_friendships')
        .select('id')
        .or(
          `and(user_a_uid.eq.${existing.user_a_uid},user_b_uid.eq.${receiver_uid}),` +
          `and(user_a_uid.eq.${receiver_uid},user_b_uid.eq.${existing.user_a_uid})`
        )
        .eq('status', 'friends')
        .maybeSingle();

      if (alreadyFriends) {
        return res.status(200).json({ alreadyFriends: true, id: alreadyFriends.id });
      }

      // Accept — update the pending row with receiver details
      const { data, error } = await supabase
        .from('crickle_friendships')
        .update({
          user_b_uid: receiver_uid,
          user_b_name: receiver_name,
          status: 'friends',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    }

    return res.status(400).json({ error: 'Invalid action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}