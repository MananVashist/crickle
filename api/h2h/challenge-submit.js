import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Determine winner from two scores
// won > gave up. Among both won: fewer hints > fewer tries. Both gave up = draw.
function resolveWinner(senderUid, receiverUid, senderScore, receiverScore) {
  const sPlayed = senderScore   && senderScore.won   !== undefined;
  const rPlayed = receiverScore && receiverScore.won !== undefined;
  if (!sPlayed || !rPlayed) return null; // both haven't played yet

  if (senderScore.won && !receiverScore.won) return senderUid;
  if (!senderScore.won && receiverScore.won) return receiverUid;
  if (!senderScore.won && !receiverScore.won) return 'draw';

  // Both won — fewer hints wins
  const sh = senderScore.hints ?? 0;
  const rh = receiverScore.hints ?? 0;
  if (sh < rh) return senderUid;
  if (rh < sh) return receiverUid;

  // Same hints — fewer tries wins
  if (senderScore.tries < receiverScore.tries) return senderUid;
  if (receiverScore.tries < senderScore.tries) return receiverUid;

  return 'draw';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // POST /api/h2h/challenge-submit
  // Body: { challenge_id, uid, score: { won, tries, hints } }
  if (req.method === 'POST') {
    const { challenge_id, uid, score } = req.body;

    if (!challenge_id || !uid || !score) {
      return res.status(400).json({ error: 'challenge_id, uid and score required' });
    }

    // Fetch the challenge
    const { data: challenge, error: fetchErr } = await supabase
      .from('crickle_challenges')
      .select('*')
      .eq('id', challenge_id)
      .not('friendship_id', 'is', null) // only new-flow challenges
      .maybeSingle();

    if (fetchErr) return res.status(500).json({ error: fetchErr.message });
    if (!challenge) return res.status(404).json({ error: 'Challenge not found' });
    if (challenge.status === 'completed') {
      return res.status(400).json({ error: 'Challenge already completed' });
    }

    // Determine if this user is sender or receiver
    const isSender   = challenge.sender_uid === uid;
    const isReceiver = challenge.receiver_uid === uid;
    if (!isSender && !isReceiver) {
      return res.status(403).json({ error: 'Not a participant in this challenge' });
    }

    // Prevent overwriting an already submitted score
    // Empty object {} means not yet played; a real score has 'won' property
    if (isSender && challenge.sender_score && challenge.sender_score.won !== undefined) {
      return res.status(400).json({ error: 'Score already submitted' });
    }
    if (isReceiver && challenge.receiver_score && challenge.receiver_score.won !== undefined) {
      return res.status(400).json({ error: 'Score already submitted' });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (isSender)   updates.sender_score   = score;
    if (isReceiver) updates.receiver_score = score;

    // Check if this completes the challenge
    const newSenderScore   = isSender   ? score : challenge.sender_score;
    const newReceiverScore = isReceiver ? score : challenge.receiver_score;

    const winner = resolveWinner(
      challenge.sender_uid,
      challenge.receiver_uid,
      newSenderScore,
      newReceiverScore
    );

    if (winner !== null) {
      // Both have played — mark completed
      updates.status = 'completed';
      updates.winner_uid = winner === 'draw' ? null : winner;

      // Update rivalry tally on the friendship
      const { data: friendship, error: friendshipErr } = await supabase
        .from('crickle_friendships')
        .select('id, user_a_uid, user_b_uid, a_wins, b_wins')
        .eq('id', challenge.friendship_id)
        .maybeSingle();

      if (!friendshipErr && friendship && winner !== 'draw') {
        const tallyUpdate = {};
        if (winner === friendship.user_a_uid) {
          tallyUpdate.a_wins = (friendship.a_wins || 0) + 1;
        } else if (winner === friendship.user_b_uid) {
          tallyUpdate.b_wins = (friendship.b_wins || 0) + 1;
        }
        if (Object.keys(tallyUpdate).length > 0) {
          tallyUpdate.updated_at = new Date().toISOString();
          await supabase
            .from('crickle_friendships')
            .update(tallyUpdate)
            .eq('id', challenge.friendship_id);
        }
      }
    }

    // Apply updates to challenge
    const { data, error } = await supabase
      .from('crickle_challenges')
      .update(updates)
      .eq('id', challenge_id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}