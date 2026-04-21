import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Match the exact winning logic from your App.js
function getWinnerUid(senderScore, receiverScore, senderUid, receiverUid) {
  if (!senderScore || !receiverScore) return null;
  if (senderScore.won && !receiverScore.won) return senderUid;
  if (!senderScore.won && receiverScore.won) return receiverUid;
  if (!senderScore.won && !receiverScore.won) return 'draw';

  const sH = senderScore.hints ?? 0;
  const rH = receiverScore.hints ?? 0;
  if (sH < rH) return senderUid;
  if (rH < sH) return receiverUid;

  const sT = senderScore.tries ?? 0;
  const rT = receiverScore.tries ?? 0;
  if (sT < rT) return senderUid;
  if (rT < sT) return receiverUid;

  return 'draw';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { challenge_id, uid, score } = req.body;

    if (!challenge_id || !uid || !score) {
      return res.status(400).json({ error: 'challenge_id, uid, and score required' });
    }

    // 1. Fetch current challenge state
    const { data: challenge, error: fetchErr } = await supabase
      .from('crickle_challenges')
      .select('*')
      .eq('id', challenge_id)
      .single();

    if (fetchErr) return res.status(500).json({ error: fetchErr.message });
    if (!challenge) return res.status(404).json({ error: 'Challenge not found' });

    const isSender = challenge.sender_uid === uid;
    const isReceiver = challenge.receiver_uid === uid;
    if (!isSender && !isReceiver) return res.status(403).json({ error: 'Not part of this challenge' });

    // 2. Prepare the database updates
    const updates = {};
    if (isSender) updates.sender_score = score;
    if (isReceiver) updates.receiver_score = score;

    // Check if BOTH players have now submitted valid scores
    const finalSenderScore = isSender ? score : challenge.sender_score;
    const finalReceiverScore = isReceiver ? score : challenge.receiver_score;

    // A score is valid if it has the 'won' property (ignores the empty {} default)
    const senderFinished = finalSenderScore && typeof finalSenderScore.won !== 'undefined';
    const receiverFinished = finalReceiverScore && typeof finalReceiverScore.won !== 'undefined';

    let winnerUid = challenge.winner_uid;
    let matchJustFinished = false;

    // 3. If both are finished, calculate the winner and close the match
    if (senderFinished && receiverFinished && challenge.status !== 'completed') {
      winnerUid = getWinnerUid(finalSenderScore, finalReceiverScore, challenge.sender_uid, challenge.receiver_uid);
      updates.status = 'completed';
      updates.winner_uid = winnerUid;
      matchJustFinished = true;
    }

    // Save updates to Supabase
    const { data: updatedData, error: updateErr } = await supabase
      .from('crickle_challenges')
      .update(updates)
      .eq('id', challenge_id)
      .select()
      .single();

    if (updateErr) return res.status(500).json({ error: updateErr.message });

    // 4. ISOLATED PUSH NOTIFICATION
    if (matchJustFinished) {
      try {
        const adminModule = await import('firebase-admin');
        const admin = adminModule.default || adminModule;

        if (!admin.apps.length) {
          let certConfig;
          try {
            certConfig = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          } catch (e) {
            let formattedPrivateKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
            if (formattedPrivateKey) {
              formattedPrivateKey = formattedPrivateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
            }
            certConfig = {
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: formattedPrivateKey,
            };
          }
          admin.initializeApp({ credential: admin.credential.cert(certConfig) });
        }

        // Figure out who we are notifying (the person who did NOT just submit the score)
        const opponentUid = isSender ? challenge.receiver_uid : challenge.sender_uid;
        const myName = isSender ? challenge.sender_name : challenge.receiver_name;

        // Draft the custom message based on who won
        let pushTitle = "Match Finished! 🏏";
        let pushBody = `${myName} finished the challenge.`;

        if (winnerUid === opponentUid) {
          pushTitle = "You Won! 🏆";
          pushBody = `You beat ${myName} in your Crickle challenge!`;
        } else if (winnerUid === 'draw') {
          pushTitle = "It's a Draw! 🤝";
          pushBody = `You and ${myName} tied!`;
        } else {
          pushTitle = "You Lost! 😢";
          pushBody = `${myName} beat you in your Crickle challenge.`;
        }

        // Fetch opponent's token and send
        const { data: tokenData } = await supabase
          .from('crickle_user_tokens')
          .select('fcm_token')
          .eq('uid', opponentUid)
          .maybeSingle();

        if (tokenData?.fcm_token) {
          await admin.messaging().send({
            token: tokenData.fcm_token,
            notification: {
              title: pushTitle,
              body: pushBody,
            },
          });
          console.log(`✅ Result push sent to ${opponentUid}`);
        }
      } catch (pushError) {
        console.error('❌ Result notification error safely caught:', pushError.message);
      }
    }

    return res.json(updatedData);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}