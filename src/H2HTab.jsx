import React, { useContext } from 'react';
import { Share } from '@capacitor/share';
import { CrickleContext } from './context';
import { IS_NATIVE, FRIENDS_API, formatScore } from './App';

const GoogleBtn = ({ onPress, signingIn }) => (
  <button onPointerDown={onPress} disabled={signingIn} style={{
    width:'100%', padding:'14px',
    background: signingIn ? 'rgba(255,255,255,0.7)' : '#fff',
    border:'none', borderRadius:'12px', color:'#1a1a1a',
    fontWeight:800, fontSize:'0.95rem',
    cursor: signingIn ? 'default' : 'pointer',
    fontFamily:"'Outfit',system-ui,sans-serif",
    display:'flex', alignItems:'center', justifyContent:'center', gap:'10px',
    touchAction:'manipulation', userSelect:'none',
  }}>
    {signingIn ? <span>Signing in…</span> : (
      <>
        <svg width="20" height="20" viewBox="0 0 24 24" style={{ pointerEvents:'none', flexShrink:0 }}>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span style={{ pointerEvents:'none' }}>Continue with Google</span>
      </>
    )}
  </button>
);

export default function H2HTab() {
  const {
    authUser, authLoading, signingIn, userName,
    friends, h2hChallenges, h2hRivalryView, setH2hRivalryView,
    pendingFriendReq, setPendingFriendReq,
    handleGoogleSignIn, handleSignOut,
    createH2HChallenge, playH2HChallenge,
    generateFriendRequestLink, fetchFriends, fetchH2HChallenges,
  } = useContext(CrickleContext);

  if (authLoading) return (
    <div style={{ textAlign:'center', padding:'40px 20px', color:'rgba(210,240,255,0.5)' }}>Loading…</div>
  );

  // ── Pending friend request card ── (shown BEFORE sign-in check so non-authed users see it)
  if (pendingFriendReq) {
    const acceptFriend = async () => {
      if (!authUser) return;
      try {
        const res = await fetch(FRIENDS_API, {
          method: 'POST',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({
            action: 'accept',
            token: pendingFriendReq.token,
            receiver_uid: authUser.uid,
            receiver_name: authUser.displayName || userName,
          }),
        });
        if (res.ok) {
          fetchFriends(authUser.uid);
          setPendingFriendReq(null);
        }
      } catch {}
    };

    return (
      <div style={{ width:'100%' }}>
        <div style={{
          background:'rgba(34,197,94,0.12)', border:'2px solid rgba(34,197,94,0.5)',
          borderRadius:'16px', padding:'24px', textAlign:'center',
        }}>
          <div style={{ fontSize:'2rem', marginBottom:'10px' }}>🤝</div>
          <div style={{ fontSize:'1rem', fontWeight:800, color:'#fff', marginBottom:'6px' }}>
            {pendingFriendReq.senderName
              ? `${pendingFriendReq.senderName} wants to be your Crickle friend!`
              : 'Friend request received!'}
          </div>
          <p style={{ fontSize:'0.8rem', color:'rgba(210,240,255,0.6)', marginBottom:'20px' }}>
            Accept to challenge each other and track your rivalry.
          </p>
          {!authUser ? (
            <>
              <p style={{ fontSize:'0.78rem', color:'rgba(210,240,255,0.5)', marginBottom:'14px' }}>Sign in first to accept.</p>
              <GoogleBtn onPress={handleGoogleSignIn} signingIn={signingIn} />
            </>
          ) : (
            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={acceptFriend} style={{
                flex:1, padding:'13px',
                background:'linear-gradient(135deg,#22c55e,#16a34a)',
                border:'none', borderRadius:'12px', color:'#fff',
                fontWeight:900, fontSize:'0.95rem', cursor:'pointer',
                fontFamily:"'Outfit',system-ui,sans-serif",
              }}>✅ Accept</button>
              <button onClick={() => setPendingFriendReq(null)} style={{
                flex:1, padding:'13px', background:'transparent',
                border:'1px solid rgba(255,255,255,0.2)', borderRadius:'12px',
                color:'rgba(210,240,255,0.6)', fontWeight:700, fontSize:'0.9rem',
                cursor:'pointer', fontFamily:"'Outfit',system-ui,sans-serif",
              }}>Decline</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!authUser) return (
    <div style={{ textAlign:'center', padding:'40px 20px' }}>
      <div style={{ fontSize:'2.5rem', marginBottom:'16px' }}>⚔️</div>
      <div style={{ fontSize:'1rem', fontWeight:800, color:'#fff', marginBottom:'8px' }}>Sign in to play H2H</div>
      <p style={{ fontSize:'0.8rem', color:'rgba(210,240,255,0.55)', marginBottom:'24px', lineHeight:1.6 }}>
        Add friends, challenge them to the same puzzle, and track your rivalry score.
      </p>
      <GoogleBtn onPress={handleGoogleSignIn} signingIn={signingIn} />
    </div>
  );

  const myUid  = authUser.uid;
  const myName = authUser.displayName || userName;

  // ── Rivalry drill-in view ──
  if (h2hRivalryView) {
    const friendship = friends.find(f => f.id === h2hRivalryView);
    if (!friendship) { setH2hRivalryView(null); return null; }

    const oppName = friendship.user_a_uid === myUid ? friendship.user_b_name : friendship.user_a_name;
    const aWins   = friendship.user_a_uid === myUid ? friendship.a_wins : friendship.b_wins;
    const bWins   = friendship.user_a_uid === myUid ? friendship.b_wins : friendship.a_wins;

    const rivalChallenges = h2hChallenges.filter(c => c.friendship_id === friendship.id);
    const open      = rivalChallenges.filter(c => c.status === 'open');
    const completed = rivalChallenges.filter(c => c.status === 'completed');

    return (
      <div style={{ width:'100%' }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px' }}>
          <button onClick={() => setH2hRivalryView(null)} style={{ background:'transparent', border:'none', color:'rgba(210,240,255,0.6)', fontWeight:800, cursor:'pointer', fontSize:'0.85rem', padding:0 }}>← Back</button>
          <button onClick={() => { fetchH2HChallenges(myUid); fetchFriends(myUid); }} style={{
            marginLeft:'auto', background:'transparent', border:'1px solid rgba(255,255,255,0.15)',
            borderRadius:'8px', padding:'5px 12px', color:'rgba(210,240,255,0.6)',
            fontSize:'0.75rem', fontWeight:700, cursor:'pointer',
          }}>↻ Refresh</button>
        </div>

        {/* Score header */}
        <div style={{ background:'rgba(0,30,10,0.9)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:'16px', padding:'16px', marginBottom:'16px', textAlign:'center' }}>
          <div style={{ fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(210,240,255,0.4)', marginBottom:'10px' }}>Head to Head</div>
          <div style={{ display:'flex', justifyContent:'space-around', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.5)', marginBottom:'4px' }}>{myName}</div>
              <div style={{ fontSize:'2.2rem', fontWeight:900, color: aWins > bWins ? '#22c55e' : aWins < bWins ? '#f87171' : '#fff', lineHeight:1 }}>{aWins}</div>
            </div>
            <div style={{ fontSize:'0.8rem', fontWeight:900, color:'rgba(255,255,255,0.3)' }}>VS</div>
            <div>
              <div style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.5)', marginBottom:'4px' }}>{oppName}</div>
              <div style={{ fontSize:'2.2rem', fontWeight:900, color: bWins > aWins ? '#22c55e' : bWins < aWins ? '#f87171' : '#fff', lineHeight:1 }}>{bWins}</div>
            </div>
          </div>
        </div>

        {/* Challenge button */}
        <button onClick={() => createH2HChallenge(friendship)} style={{
          width:'100%', padding:'14px', marginBottom:'16px',
          background:'linear-gradient(135deg,#22c55e,#16a34a)', border:'none',
          borderRadius:'12px', color:'#fff', fontWeight:900, fontSize:'0.95rem',
          cursor:'pointer', fontFamily:"'Outfit',system-ui,sans-serif",
          boxShadow:'0 4px 20px rgba(34,197,94,0.35)',
        }}>⚔️ Challenge {oppName}</button>

        {/* Open challenges */}
        {open.length > 0 && (
          <div style={{ marginBottom:'16px' }}>
            <div style={{ fontSize:'0.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'rgba(251,191,36,0.8)', marginBottom:'8px' }}>Open ({open.length})</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {open.map(c => {
                const isSender   = c.sender_uid === myUid;
                const myPlayed   = isSender ? (c.sender_score?.won !== undefined) : (c.receiver_score?.won !== undefined);
                const theyPlayed = isSender ? (c.receiver_score?.won !== undefined) : (c.sender_score?.won !== undefined);
                return (
                  <div key={c.id} style={{ background:'rgba(0,30,15,0.8)', border:'1px solid rgba(251,191,36,0.25)', borderRadius:'12px', padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontSize:'0.82rem', fontWeight:800, color:'#fff' }}>
                        {c.mode} {myPlayed ? `· ${c.target_player}` : '· ???'}
                      </div>
                      <div style={{ fontSize:'0.7rem', color:'rgba(210,240,255,0.5)', marginTop:'2px' }}>
                        {myPlayed ? '✅ You played' : '⏳ Your turn'} · {theyPlayed ? `✅ ${oppName} played` : `⏳ ${oppName} pending`}
                      </div>
                    </div>
                    {!myPlayed && (
                      <button onClick={() => playH2HChallenge(c)} style={{
                        background:'#22c55e', color:'#fff', border:'none', borderRadius:'8px',
                        padding:'7px 14px', fontWeight:800, cursor:'pointer', fontSize:'0.8rem',
                        fontFamily:"'Outfit',system-ui,sans-serif",
                      }}>Play</button>
                    )}
                    {myPlayed && !theyPlayed && (
                      <button onClick={async () => {
                        const link = `https://crickle-game.vercel.app/?h2h=${c.id}`;
                        const text = `${myName} challenged you to a Crickle ${c.mode} puzzle 🏏 — open your H2H tab to play!\n${link}`;
                        if (IS_NATIVE) { try { await Share.share({ title:'Crickle H2H', text, dialogTitle:'Nudge your friend' }); } catch {} }
                        else if (navigator.share) { try { await navigator.share({ text }); } catch {} }
                        else { try { await navigator.clipboard.writeText(text); } catch {} }
                      }} style={{
                        background:'rgba(251,191,36,0.2)', border:'1px solid rgba(251,191,36,0.4)',
                        color:'#fbbf24', borderRadius:'8px', padding:'7px 12px',
                        fontWeight:700, cursor:'pointer', fontSize:'0.75rem',
                        fontFamily:"'Outfit',system-ui,sans-serif",
                      }}>Nudge 👋</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Completed challenges */}
        {completed.length > 0 && (
          <div>
            <div style={{ fontSize:'0.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'rgba(210,240,255,0.5)', marginBottom:'8px' }}>Completed ({completed.length})</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {completed.map(c => {
                const isSender   = c.sender_uid === myUid;
                const myScore    = isSender ? c.sender_score   : c.receiver_score;
                const theirScore = isSender ? c.receiver_score : c.sender_score;
                const iWon       = c.winner_uid === myUid;
                const theyWon    = c.winner_uid && c.winner_uid !== myUid;
                return (
                  <div key={c.id} style={{
                    background:'rgba(0,30,15,0.8)',
                    border:`1px solid ${iWon ? 'rgba(34,197,94,0.25)' : theyWon ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius:'12px', padding:'12px 14px',
                  }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div>
                        <div style={{ fontSize:'0.82rem', fontWeight:800, color:'#fff' }}>{c.mode} · {c.target_player}</div>
                        <div style={{ fontSize:'0.7rem', fontWeight:700, marginTop:'3px', color: iWon ? '#22c55e' : theyWon ? '#f87171' : '#fbbf24' }}>
                          {iWon ? '🏆 You won' : theyWon ? `${oppName} won` : '🤝 Draw'}
                        </div>
                      </div>
                      <div style={{ textAlign:'right', fontSize:'0.7rem', color:'rgba(210,240,255,0.5)' }}>
                        <div>You: {formatScore(myScore)}</div>
                        <div>{oppName}: {formatScore(theirScore)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {open.length === 0 && completed.length === 0 && (
          <div style={{ textAlign:'center', padding:'30px', color:'rgba(255,255,255,0.4)', fontSize:'0.85rem' }}>
            No challenges yet. Challenge {oppName} above!
          </div>
        )}
      </div>
    );
  }

  // ── Friends list ──
  return (
    <div style={{ width:'100%' }}>
      {/* Add a Friend */}
      <button onClick={async () => {
        const link = await generateFriendRequestLink();
        if (!link) { alert('Friend request API unavailable. Make sure the app is deployed to Vercel.'); return; }
        const text = `${myName} wants to be your Crickle friend 🏏 — accept here:\n${link}`;
        if (IS_NATIVE) { try { await Share.share({ title:'Crickle Friend Request', text, dialogTitle:'Share friend request' }); } catch {} }
        else if (navigator.share) { try { await navigator.share({ text }); } catch {} }
        else { try { await navigator.clipboard.writeText(text); alert('Link copied! Share it with your friend.'); } catch {} }
      }} style={{
        width:'100%', padding:'14px', marginBottom:'16px',
        background:'linear-gradient(135deg,#22c55e,#16a34a)', border:'none',
        borderRadius:'12px', color:'#fff', fontWeight:900, fontSize:'0.95rem',
        cursor:'pointer', fontFamily:"'Outfit',system-ui,sans-serif",
        boxShadow:'0 4px 20px rgba(34,197,94,0.25)',
      }}>👤 Add a Friend</button>

      {friends.length === 0 ? (
        <div style={{ textAlign:'center', padding:'30px 20px', color:'rgba(255,255,255,0.4)' }}>
          <div style={{ fontSize:'2rem', marginBottom:'8px' }}>🤝</div>
          <p style={{ fontSize:'0.85rem' }}>No friends yet. Share an invite link above!</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {friends.map(f => {
            const oppName = f.user_a_uid === myUid ? f.user_b_name : f.user_a_name;
            const myWins  = f.user_a_uid === myUid ? f.a_wins : f.b_wins;
            const thWins  = f.user_a_uid === myUid ? f.b_wins : f.a_wins;
            const pending = h2hChallenges.filter(c =>
              c.friendship_id === f.id && c.status === 'open' && (
                (c.sender_uid   === myUid && c.sender_score?.won   === undefined) ||
                (c.receiver_uid === myUid && c.receiver_score?.won === undefined)
              )
            ).length;
            return (
              <button key={f.id} onClick={() => setH2hRivalryView(f.id)} style={{
                width:'100%', background:'rgba(0,30,15,0.8)',
                border:`1px solid ${pending > 0 ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius:'14px', padding:'16px',
                display:'flex', alignItems:'center', justifyContent:'space-between',
                cursor:'pointer', fontFamily:"'Outfit',system-ui,sans-serif",
              }}>
                <div style={{ textAlign:'left' }}>
                  <div style={{ fontSize:'0.95rem', fontWeight:800, color:'#fff', marginBottom:'3px' }}>
                    {myName} vs {oppName}
                  </div>
                  <div style={{ fontSize:'0.72rem', color:'rgba(210,240,255,0.5)' }}>
                    {myWins + thWins === 0 ? 'No games played yet' : `${myWins + thWins} game${myWins + thWins !== 1 ? 's' : ''} played`}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  {(myWins + thWins) > 0 && (
                    <div style={{ fontSize:'1.4rem', fontWeight:900, lineHeight:1, color: myWins > thWins ? '#22c55e' : myWins < thWins ? '#f87171' : '#fbbf24' }}>
                      {myWins}–{thWins}
                    </div>
                  )}
                  {pending > 0 && (
                    <span style={{ background:'rgba(251,191,36,0.2)', border:'1px solid rgba(251,191,36,0.4)', color:'#fbbf24', borderRadius:'6px', padding:'3px 8px', fontSize:'0.65rem', fontWeight:700 }}>
                      {pending} pending
                    </span>
                  )}
                  <span style={{ color:'rgba(255,255,255,0.3)' }}>→</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <button onClick={handleSignOut} style={{
        marginTop:'20px', background:'transparent', border:'none',
        color:'rgba(210,240,255,0.3)', fontSize:'0.72rem', cursor:'pointer',
        width:'100%', textAlign:'center', padding:'6px',
      }}>Signed in as {authUser.displayName || myName} · Sign out</button>
    </div>
  );
}