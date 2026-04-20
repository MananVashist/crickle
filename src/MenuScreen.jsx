import React, { useContext } from 'react';
import { Share } from '@capacitor/share';
import { CrickleContext } from './context';
import {
  IS_NATIVE, POOL, EASY_POOL, defaultStats, saveStats,
  freshEasyGame, formatScore,
} from './App';
import H2HTab from './H2HTab';

const FORMAT_DESC = {
  Test: { emoji:'🏏', sub:'Red ball · 5 days · Pure test of knowledge' },
  ODI:  { emoji:'🔵', sub:'50 overs · Icons of the format' },
  T20:  { emoji:'⚡', sub:'Fastest format · T20 legends' },
};

const HOW_TO_STEPS = [
  { color:'#166534', border:'#22c55e', text:'#bbf7d0', label:'Green', desc:'Exact match — stat is spot on' },
  { color:'#713f12', border:'#d97706', text:'#fde68a', label:'Yellow', desc:'Close — ↑ means higher, ↓ means lower' },
  { color:'#1e2025', border:'#35373f', text:'#9ca3af', label:'Grey',  desc:'No match — way off' },
];

export default function MenuScreen() {
  const {
    games, setGames, activeTab, setActiveTab, mode, setMode,
    stats, setStats, screen, setScreen, menuTab, setMenuTab,
    playFlow, setPlayFlow, pendingCount,
    dMode, games: { Daily: dailyGame },
    handleDailyStart, resetGame,
  } = useContext(CrickleContext);

  const avgGuesses = stats.wins > 0 ? (stats.totalGuesses / stats.wins).toFixed(1) : '—';
  const winRate    = stats.gamesPlayed > 0 ? Math.round(stats.wins / stats.gamesPlayed * 100) : 0;
  const hintRate   = stats.gamesPlayed > 0 ? Math.round(stats.hintGames / stats.gamesPlayed * 100) : 0;

  const TABS = [
    { id:'play',       label:'Play'   },
    { id:'challenges', label:`H2H${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
    { id:'stats',      label:'Stats'  },
    { id:'howto',      label:'How to Play' },
  ];

  return (
    <div style={{
      minHeight:'100vh', color:'#ffffff',
      fontFamily:"'Outfit', 'DM Sans', system-ui, sans-serif",
      display:'flex', flexDirection:'column', alignItems:'center',
      background:"url('/BG.jpg') center/cover no-repeat fixed",
      position:'relative',
    }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,10,5,0.78)', zIndex:0, pointerEvents:'none' }} />

      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:'480px', padding:'40px 20px 60px', display:'flex', flexDirection:'column', alignItems:'center', minHeight:'100vh' }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <h1 style={{
            fontSize:'3.5rem', fontWeight:900, letterSpacing:'-0.05em', margin:'0 0 6px',
            background:'linear-gradient(135deg, #22c55e 0%, #50a0dc 100%)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', lineHeight:1,
          }}>CRICKLE</h1>
          <p style={{ color:'rgba(210,240,255,0.55)', fontSize:'0.78rem', margin:0, letterSpacing:'0.18em', textTransform:'uppercase', fontWeight:600 }}>
            The Cricket Guessing Game
          </p>
        </div>

        {/* Tabs */}
        <div style={{
          display:'flex', gap:'4px', width:'100%',
          background:'rgba(0,25,10,0.9)', border:'1px solid rgba(255,255,255,0.1)',
          borderRadius:'12px', padding:'4px', marginBottom:'24px',
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setMenuTab(t.id); setPlayFlow('main'); }} style={{
              flex:1, padding:'9px 4px', borderRadius:'8px', border:'none',
              cursor:'pointer', fontWeight:700, fontSize:'0.82rem', transition:'all 0.15s',
              background: menuTab === t.id ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'transparent',
              color: menuTab === t.id ? '#fff' : 'rgba(210,240,255,0.55)',
              boxShadow: menuTab === t.id ? '0 2px 12px rgba(34,197,94,0.3)' : 'none',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── PLAY tab ── */}
        {menuTab === 'play' && playFlow === 'main' && (
          <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:'16px' }}>
            {/* Daily */}
            {(() => {
              const dailyDone        = dailyGame && dailyGame.status !== 'playing';
              const dailyBorderColor = dailyDone ? 'rgba(251,191,36,0.5)' : 'rgba(34,197,94,0.4)';
              const dailyBg          = dailyDone ? 'rgba(251,191,36,0.08)' : 'rgba(34,197,94,0.15)';
              return (
                <button onClick={handleDailyStart} style={{
                  width:'100%', padding:'20px', background: dailyBg,
                  border:`2px solid ${dailyBorderColor}`, borderRadius:'14px',
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between',
                  transition:'all 0.15s',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                    <span style={{ fontSize:'1.8rem' }}>📅</span>
                    <div style={{ textAlign:'left' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <span style={{ fontWeight:900, fontSize:'1.1rem', color: dailyDone ? '#fbbf24' : '#22c55e' }}>Daily Puzzle</span>
                        <span style={{
                          fontSize:'0.65rem', fontWeight:800, padding:'2px 7px', borderRadius:'6px',
                          background: dailyDone ? 'rgba(251,191,36,0.2)' : 'rgba(34,197,94,0.2)',
                          border: `1px solid ${dailyDone ? 'rgba(251,191,36,0.4)' : 'rgba(34,197,94,0.4)'}`,
                          color: dailyDone ? '#fbbf24' : '#86efac', letterSpacing:'0.08em',
                        }}>{dMode}</span>
                      </div>
                      <div style={{ fontSize:'0.75rem', color:'rgba(210,240,255,0.6)', marginTop:2 }}>
                        {dailyDone
                          ? `Already done · ${dailyGame.guesses.length} guess${dailyGame.guesses.length !== 1 ? 'es' : ''}${dailyGame.hintsUsed > 0 ? ` · ${dailyGame.hintsUsed} hint${dailyGame.hintsUsed > 1 ? 's' : ''}` : ''}`
                          : `Today's ${dMode} puzzle`}
                      </div>
                    </div>
                  </div>
                  <span style={{ color: dailyDone ? '#fbbf24' : '#22c55e', fontSize:'1.2rem' }}>{dailyDone ? '✓' : '→'}</span>
                </button>
              );
            })()}

            {/* Endless */}
            <button onClick={() => setPlayFlow('endless')} style={{
              width:'100%', padding:'20px', background:'rgba(255,255,255,0.05)',
              border:'2px solid rgba(255,255,255,0.1)', borderRadius:'14px',
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', transition:'all 0.15s',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                <span style={{ fontSize:'1.8rem' }}>♾️</span>
                <div style={{ textAlign:'left' }}>
                  <div style={{ fontWeight:800, fontSize:'1.1rem', color:'#fff' }}>Endless Mode</div>
                  <div style={{ fontSize:'0.75rem', color:'rgba(210,240,255,0.5)', marginTop:2 }}>Play endlessly. Diverse collection of players</div>
                </div>
              </div>
              <span style={{ color:'rgba(255,255,255,0.4)', fontSize:'1.2rem' }}>→</span>
            </button>

            {/* Easy */}
            <button onClick={() => { setActiveTab('easy'); setGames(prev => ({ ...prev, Easy: freshEasyGame() })); setScreen('game'); }} style={{
              width:'100%', padding:'20px', background:'rgba(255,255,255,0.05)',
              border:'2px solid rgba(255,255,255,0.1)', borderRadius:'14px',
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', transition:'all 0.15s',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                <span style={{ fontSize:'1.8rem' }}>🐣</span>
                <div style={{ textAlign:'left' }}>
                  <div style={{ fontWeight:800, fontSize:'1.1rem', color:'#38ef7d' }}>Easy Mode</div>
                  <div style={{ fontSize:'0.75rem', color:'rgba(210,240,255,0.5)', marginTop:2 }}>Popular players from all formats. No stats tracked.</div>
                </div>
              </div>
              <span style={{ color:'rgba(255,255,255,0.4)', fontSize:'1.2rem' }}>→</span>
            </button>
          </div>
        )}

        {/* ── ENDLESS format picker ── */}
        {menuTab === 'play' && playFlow === 'endless' && (
          <div style={{ width:'100%' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
              <button onClick={() => setPlayFlow('main')} style={{ background:'transparent', border:'none', color:'rgba(210,240,255,0.6)', fontWeight:800, cursor:'pointer', padding:0, fontSize:'0.85rem' }}>← Back</button>
              <p style={{ color:'rgba(210,240,255,0.5)', fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', margin:0 }}>Select Format</p>
              <div style={{ width:'40px' }} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'28px' }}>
              {['Test','ODI','T20'].map(f => {
                const isEmpty   = POOL[f].length === 0;
                const active    = mode === f;
                const targetGame = games[f];
                const inProg    = targetGame?.status === 'playing' && targetGame?.guesses?.length > 0 && !targetGame.isDaily;
                return (
                  <button key={f} onClick={() => { if (!isEmpty) setMode(f); }} style={{
                    width:'100%', padding:'16px 20px',
                    background: active ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                    border:`2px solid ${active ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius:'14px', cursor: isEmpty ? 'default' : 'pointer',
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    opacity: isEmpty ? 0.5 : 1, transition:'all 0.15s',
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                      <span style={{ fontSize:'1.6rem' }}>{FORMAT_DESC[f].emoji}</span>
                      <div style={{ textAlign:'left' }}>
                        <div style={{ fontWeight:800, fontSize:'1rem', color: active ? '#22c55e' : '#fff' }}>{f}</div>
                        <div style={{ fontSize:'0.72rem', color:'rgba(210,240,255,0.5)', marginTop:2 }}>{FORMAT_DESC[f].sub}</div>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      {inProg  && <span style={{ fontSize:'0.65rem', background:'rgba(251,191,36,0.2)', border:'1px solid rgba(251,191,36,0.4)', color:'#fbbf24', borderRadius:'6px', padding:'2px 8px', fontWeight:700 }}>IN PROGRESS</span>}
                      {isEmpty && <span style={{ fontSize:'0.65rem', background:'rgba(245,158,11,0.2)', color:'#f59e0b', borderRadius:'6px', padding:'2px 8px', fontWeight:700 }}>SOON</span>}
                      {active && !isEmpty && <span style={{ color:'#22c55e', fontSize:'1rem' }}>✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={() => { setActiveTab('endless'); setScreen('game'); }} style={{
              width:'100%', padding:'16px',
              background:'linear-gradient(135deg,#22c55e,#16a34a)',
              border:'none', borderRadius:'12px', color:'#fff',
              fontWeight:900, fontSize:'1rem', cursor:'pointer',
              fontFamily:"'Outfit',system-ui,sans-serif",
              boxShadow:'0 4px 24px rgba(34,197,94,0.35)',
            }}>
              {games[mode]?.guesses?.length > 0 && !games[mode]?.isDaily ? `Continue ${mode} Game` : `Start ${mode} Game`}
            </button>
            {games[mode]?.guesses?.length > 0 && !games[mode]?.isDaily && (
              <button onClick={() => { setActiveTab('endless'); resetGame(); setScreen('game'); }} style={{
                width:'100%', padding:'12px', marginTop:'8px',
                background:'transparent', border:'1px solid rgba(255,255,255,0.15)',
                borderRadius:'12px', color:'rgba(210,240,255,0.6)',
                fontWeight:700, fontSize:'0.85rem', cursor:'pointer',
                fontFamily:"'Outfit',system-ui,sans-serif",
              }}>New Game</button>
            )}
          </div>
        )}

        {/* ── H2H tab ── */}
        {menuTab === 'challenges' && <H2HTab />}

        {/* ── STATS tab ── */}
        {menuTab === 'stats' && (
          <div style={{ width:'100%' }}>
            <div style={{ marginBottom:'24px' }}>
              <h3 style={{ color:'#22c55e', margin:'0 0 12px', fontSize:'0.9rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>📅 Daily Puzzle</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                {[
                  { label:'Win Streak',      value: stats.dailyStreak + (stats.dailyStreak > 0 ? ' 🔥' : ''), big:true },
                  { label:'Best Streak',     value: stats.bestDailyStreak },
                  { label:'Hintless Streak', value: (stats.dailyHintlessStreak||0) + ((stats.dailyHintlessStreak||0) > 0 ? ' 🎯' : ''), big:true },
                  { label:'Best Hintless',   value: stats.bestDailyHintlessStreak || 0 },
                ].map(({ label, value, big }) => (
                  <div key={label} style={{ background:'rgba(0,30,12,0.85)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'14px', padding:'16px 14px', textAlign:'center' }}>
                    <div style={{ fontSize: big ? '1.8rem' : '1.5rem', fontWeight:900, color:'#fff', lineHeight:1 }}>{value}</div>
                    <div style={{ fontSize:'0.68rem', color:'rgba(210,240,255,0.5)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginTop:6 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom:'16px' }}>
              <h3 style={{ color:'#7dd3fc', margin:'0 0 12px', fontSize:'0.9rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>♾️ Endless Mode</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                {[
                  { label:'Win Streak',     value: stats.streak },
                  { label:'Best Streak',    value: stats.bestStreak },
                  { label:'Hintless Streak',value: (stats.hintlessStreak||0) + ((stats.hintlessStreak||0) > 0 ? ' 🎯' : '') },
                  { label:'Best Hintless',  value: stats.bestHintlessStreak || 0 },
                  { label:'Win Rate',       value: `${winRate}%` },
                  { label:'Avg Guesses',    value: avgGuesses },
                  { label:'Best Guess',     value: stats.bestGuesses ?? '—', sub: stats.bestGuesses === 1 ? '🏆 First ball!' : null },
                  { label:'Perfect Games',  value: stats.perfectGames || 0, sub: (stats.perfectGames||0) > 0 ? '1-guess wins' : null },
                  { label:'Hint Rate',      value: `${hintRate}%`, sub: hintRate > 50 ? 'You lean on hints 🤦' : hintRate > 0 ? 'Occasionally guilty' : 'Pure. Unassisted. 👏' },
                  { label:'Games Played',   value: stats.gamesPlayed },
                ].map(({ label, value, sub, big }) => (
                  <div key={label} style={{ background:'rgba(0,30,12,0.85)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'14px', padding:'16px 14px', textAlign:'center' }}>
                    <div style={{ fontSize: big ? '1.8rem' : '1.5rem', fontWeight:900, color:'#fff', lineHeight:1 }}>{value}</div>
                    <div style={{ fontSize:'0.68rem', color:'rgba(210,240,255,0.5)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginTop:6 }}>{label}</div>
                    {sub && <div style={{ fontSize:'0.65rem', color:'rgba(210,240,255,0.4)', marginTop:4, fontStyle:'italic' }}>{sub}</div>}
                  </div>
                ))}
              </div>
            </div>

            {stats.gamesPlayed > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                <button onClick={async () => {
                  const baseUrl   = typeof window !== 'undefined' ? window.location.origin : 'crickle.app';
                  const statsText = [
                    `I\u2019m playing Crickle 🏏`, ``,
                    stats.streak > 0 ? `🔥 ${stats.streak} game streak` : `No active streak`,
                    `🏆 Win rate: ${winRate}%`,
                    `🎯 Avg guesses: ${avgGuesses}`,
                    `💡 Hint rate: ${hintRate}%`,
                    `🎮 ${stats.gamesPlayed} games played`, ``,
                    `Think you can beat that? Share yours 👇`,
                    baseUrl,
                  ].join('\n');
                  if (IS_NATIVE) {
                    try { await Share.share({ title:'Crickle Stats 🏏', text: statsText, dialogTitle:'Share your stats' }); } catch {}
                  } else {
                    if (navigator.share) { try { await navigator.share({ text: statsText }); return; } catch {} }
                    try { await navigator.clipboard.writeText(statsText); alert('Copied!'); } catch {}
                  }
                }} style={{
                  width:'100%', padding:'13px',
                  background:'linear-gradient(135deg,#22c55e,#16a34a)',
                  border:'none', borderRadius:'10px', color:'#fff',
                  fontWeight:800, fontSize:'0.88rem', cursor:'pointer',
                  fontFamily:"'Outfit',system-ui,sans-serif",
                  boxShadow:'0 4px 16px rgba(34,197,94,0.25)',
                }}>📤 Share My Stats</button>
                <button onClick={() => { const s = defaultStats(); setStats(s); saveStats(s); }} style={{
                  width:'100%', padding:'10px', background:'transparent',
                  border:'1px solid rgba(239,68,68,0.25)', borderRadius:'10px',
                  color:'rgba(239,68,68,0.6)', fontSize:'0.78rem', fontWeight:700,
                  cursor:'pointer', fontFamily:"'Outfit',system-ui,sans-serif",
                }}>Reset Stats</button>
              </div>
            )}
          </div>
        )}

        {/* ── HOW TO PLAY tab ── */}
        {menuTab === 'howto' && (
          <div style={{ width:'100%' }}>
            <p style={{ color:'rgba(210,240,255,0.8)', fontSize:'0.9rem', lineHeight:1.7, margin:'0 0 20px' }}>
              Guess the mystery cricketer in <strong style={{color:'#fff'}}>8 tries</strong>. After each guess, coloured boxes show how close you are.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'20px' }}>
              {HOW_TO_STEPS.map(({ color, border, label, desc }) => (
                <div key={label} style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                  <div style={{ width:'44px', height:'36px', borderRadius:'8px', background:color, border:`1px solid ${border}`, flexShrink:0 }} />
                  <div>
                    <div style={{ color:'#fff', fontWeight:700, fontSize:'0.85rem' }}>{label}</div>
                    <div style={{ color:'rgba(210,240,255,0.55)', fontSize:'0.78rem' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background:'rgba(0,30,12,0.8)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'12px', padding:'14px 16px', marginBottom:'12px' }}>
              <p style={{ margin:'0 0 8px', fontWeight:700, fontSize:'0.85rem', color:'#fff' }}>Stats shown per guess:</p>
              <p style={{ margin:0, color:'rgba(210,240,255,0.6)', fontSize:'0.8rem', lineHeight:1.7 }}>
                Runs · Wickets · Debut Year · Matches · Nation · Batting style · Bowling type
              </p>
            </div>
            <div style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'12px', padding:'14px 16px' }}>
              <p style={{ margin:'0 0 8px', fontWeight:700, fontSize:'0.85rem', color:'#fff' }}>The Player Pool:</p>
              <ul style={{ margin:0, paddingLeft:'20px', color:'rgba(210,240,255,0.6)', fontSize:'0.8rem', lineHeight:1.7 }}>
                <li>Top <strong style={{color:'#fff'}}>350 players</strong> per format — only the greats make the cut.</li>
                <li>Only players from Test-playing nations are included.</li>
                <li><strong>Test:</strong> Debuts after 1980 (unless they are legends).</li>
                <li><strong>ODI:</strong> Debuts after 1990 (unless they are legends).</li>
              </ul>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop:'auto', display:'flex', flexDirection:'column', alignItems:'center', width:'100%' }}>
          {!IS_NATIVE && menuTab === 'play' && playFlow === 'main' && (
            <div style={{ display:'flex', gap:'12px', justifyContent:'center', width:'100%', marginTop:'30px' }}>
              <a href="#" target="_blank" rel="noreferrer">
                <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Get it on Google Play" style={{ height:'42px' }} />
              </a>
            </div>
          )}
          <div style={{ display:'flex', gap:'20px', marginTop:'30px', fontSize:'0.75rem' }}>
            <a href="/privacy.html" target="_blank" style={{ color:'rgba(255,255,255,0.4)', textDecoration:'underline' }}>Privacy Policy</a>
            <a href="/support.html" target="_blank" style={{ color:'rgba(255,255,255,0.4)', textDecoration:'underline' }}>Support</a>
          </div>
        </div>

      </div>
    </div>
  );
}