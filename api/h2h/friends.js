import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { requireUid } from '../_lib/firebaseAuth.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  // SERVICE ROLE, required for RLS - see the other h2h routes.
  //
  // This is server-side code, so the anon key bought nothing here - and it was
  // what made locking these tables down impossible. On 2026-09-05 the public
  // anon key was found able to read crickle_user_tokens (FCM push tokens keyed
  // to uids), crickle_friendships and crickle_challenges straight through
  // PostgREST, because RLS was off on all three. It could not simply be turned
  // on: Crickle authenticates with Firebase, so auth.uid() is NULL on every
  // request and no owner policy can be written - and these routes would have
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

  // GET /api/h2h/friends?uid=xxx
  // Returns all accepted friends for a user
  if (req.method === 'GET') {
    // The uid comes from the VERIFIED token, never from the query string.
    // `GET /api/h2h/friends?uid=<anyone>` used to return that person's friend
    // list to an unauthenticated caller. RLS cannot fix this: these routes run
    // as service_role and bypass it by design, so the route itself is the only
    // thing that can decide who a caller is allowed to be.
    const callerUid = await requireUid(req, res);
    if (!callerUid) return;
    const { token } = req.query;
    const uid = callerUid;

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
    const callerUid = await requireUid(req, res);
    if (!callerUid) return;
    const { action } = req.body;

    // action: 'request' — create a friend request link
    // Body: { action: 'request', sender_uid, sender_name }
    if (action === 'request') {
      // sender_uid is the CALLER. It used to be taken from the body, which
      // let anyone create a friend request as anybody else.
      const sender_uid = callerUid;
      const { sender_name } = req.body;
      if (!sender_name) {
        return res.status(400).json({ error: 'sender_name required' });
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
      // receiver_uid is the CALLER, for the same reason as above: accepting a
      // friend request on someone else's behalf should not be possible.
      const receiver_uid = callerUid;
      const { token, receiver_name } = req.body;
      if (!token || !receiver_name) {
        return res.status(400).json({ error: 'token and receiver_name required' });
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