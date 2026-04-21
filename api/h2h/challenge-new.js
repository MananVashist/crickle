import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import admin from 'firebase-admin';

// 1. Initialize Firebase Admin (runs once per serverless instance)
// 1. Initialize Firebase Admin (runs once per serverless instance)
if (!admin.apps.length) {
  // Safely parse the private key: removes surrounding quotes and fixes escaped newlines
  let formattedPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (formattedPrivateKey) {
    formattedPrivateKey = formattedPrivateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: formattedPrivateKey,
    }),
  });
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET /api/h2h/challenge-new?uid=xxx
  if (req.method === 'GET') {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: 'uid required' });

    const { data, error } = await supabase
      .from('crickle_challenges')
      .select('*')
      .or(`sender_uid.eq.${uid},receiver_uid.eq.${uid}`)
      .not('friendship_id', 'is', null) 
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  }

  // POST /api/h2h/challenge-new
  if (req.method === 'POST') {
    const {
      friendship_id,
      sender_uid, sender_name,
      receiver_uid, receiver_name,
      mode, player_code, target_player,
    } = req.body;

    if (!friendship_id || !sender_uid || !receiver_uid || !player_code) {
      return res.status(400).json({ error: 'friendship_id, sender_uid, receiver_uid and player_code required' });
    }

    // Verify the friendship exists and is accepted
    const { data: friendship, error: friendshipErr } = await supabase
      .from('crickle_friendships')
      .select('id, user_a_uid, user_b_uid, status')
      .eq('id', friendship_id)
      .eq('status', 'friends')
      .maybeSingle();

    if (friendshipErr) return res.status(500).json({ error: friendshipErr.message });
    if (!friendship) return res.status(404).json({ error: 'Friendship not found or not accepted' });

    // Verify sender is part of this friendship
    const isParticipant =
      friendship.user_a_uid === sender_uid ||
      friendship.user_b_uid === sender_uid;
    if (!isParticipant) return res.status(403).json({ error: 'Not part of this friendship' });

    const code = randomBytes(8).toString('hex');

    // Create the challenge in the database
    const { data, error } = await supabase
      .from('crickle_challenges')
      .insert({
        code,
        friendship_id,
        mode,
        target_player,
        sender_uid,
        sender_name,
        sender_score: {},
        receiver_uid,
        receiver_name,
        receiver_score: null,
        status: 'open',
        winner_uid: null,
        source_mode: player_code || '',
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // 2. Fetch the receiver's token and send the Push Notification
    try {
      const { data: tokenData } = await supabase
        .from('crickle_user_tokens')
        .select('fcm_token')
        .eq('uid', receiver_uid)
        .maybeSingle();

      if (tokenData?.fcm_token) {
        await admin.messaging().send({
          token: tokenData.fcm_token,
          notification: {
            title: 'New Crickle Challenge! 🏏',
            body: `${sender_name} has challenged you to a ${mode} game.`,
          },
        });
        console.log(`✅ Push sent to ${receiver_name}`);
      } else {
        console.log(`⚠️ No FCM token found for ${receiver_name}`);
      }
    } catch (pushError) {
      console.error('❌ Failed to send push notification:', pushError);
    }

    // Return the created challenge data to the frontend
    return res.json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}