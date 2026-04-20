import React, { useContext } from 'react';
import { CrickleContext } from './context';
import {
  IS_NATIVE, MAX_GUESSES, HINTS,
  boxColor, arrowFor, useWindowWidth,
} from './App';

export default function GameScreen() {
  const {
    game, displayMode, activeTab, activeH2HChallenge,
    authUser, stats, search, setSearch,
    showHintDrop, setShowHintDrop, showHintWarning, setShowHintWarning,
    showConfetti, confettiRef, suggestions, hintTexts, cols,
    screen, setScreen, menuTab, setMenuTab, setPlayFlow,
    patchGame, resetGame, handleGuess, handleGiveUp,
    requestHint, handleGameShare,
  } = useContext(CrickleContext);

  const winWidth = useWindowWidth();
  const isMobile = winWidth < 768;

  // ── Header ──
  const fmtColors = { Test:'#7dd3fc', ODI:'#86efac', T20:'#fde68a' };
  const isDaily = game?.isDaily;
  const isH2H   = game?.isH2H;
  const oppName = isH2H
    ? (activeH2HChallenge?.sender_uid === authUser?.uid
        ? activeH2HChallenge?.receiver_name
        : activeH2HChallenge?.sender_name) || 'Friend'
    : null;

  return (
    <div style={{
      minHeight:'100vh', color:'#ffffff',
      fontFamily:"'Outfit', 'DM Sans', system-ui, sans-serif",
      display:'flex', flexDirection:'column', alignItems:'center',
      padding:'16px 16px 60px',
      background:"url('/BG.jpg') center/cover no-repeat fixed",
      position:'relative', overflow:'hidden',
    }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,10,5,0.72)', zIndex:0, pointerEvents:'none' }} />
      <div style={{ position:'relative', zIndex:1, width:'100%', display:'flex', flexDirection:'column', alignItems:'center' }}>

        {/* Header bar */}
        <div style={{ width:'100%', maxWidth:'480px', display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
          <button onClick={() => { setScreen('menu'); setPlayFlow('main'); }} style={{
            background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)',
            borderRadius:'8px', padding:'6px 12px', color:'rgba(210,240,255,0.85)',
            fontSize:'0.75rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:'6px',
          }}>☰ Menu</button>
          <div style={{ textAlign:'center' }}>
            <span style={{
              fontSize:'1.5rem', fontWeight:900, letterSpacing:'-0.04em',
              background:'linear-gradient(135deg, #22c55e 0%, #50a0dc 100%)',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            }}>CRICKLE</span>
          </div>
          {isH2H ? (
            <div style={{
              display:'flex', flexDirection:'column', alignItems:'center',
              background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.4)',
              borderRadius:'8px', padding:'5px 10px', minWidth:'64px',
            }}>
              <span style={{ fontSize:'0.6rem', fontWeight:700, color:'rgba(34,197,94,0.9)', letterSpacing:'0.1em', textTransform:'uppercase' }}>⚔️ vs {oppName}</span>
              <span style={{ fontSize:'0.9rem', fontWeight:900, color: fmtColors[displayMode] ?? '#fff', lineHeight:1.2 }}>{displayMode}</span>
            </div>
          ) : isDaily ? (
            <div style={{
              display:'flex', flexDirection:'column', alignItems:'center',
              background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.4)',
              borderRadius:'8px', padding:'5px 10px', minWidth:'64px',
            }}>
              <span style={{ fontSize:'0.6rem', fontWeight:700, color:'rgba(34,197,94,0.8)', letterSpacing:'0.1em', textTransform:'uppercase' }}>📅 Daily</span>
              <span style={{ fontSize:'0.9rem', fontWeight:900, color: fmtColors[displayMode] ?? '#fff', lineHeight:1.2 }}>{displayMode}</span>
            </div>
          ) : (
            <div style={{
              background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)',
              borderRadius:'8px', padding:'6px 12px', fontSize:'0.75rem', fontWeight:800,
              color: fmtColors[displayMode] ?? '#fff',
            }}>
              {activeTab === 'easy' ? 'EASY' : displayMode}
            </div>
          )}
        </div>

        {/* Already-done daily banner */}
        {game.isDaily && game.status !== 'playing' && (
          <div style={{
            width:'100%', maxWidth:'480px', marginBottom:'16px',
            background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.35)',
            borderRadius:'14px', padding:'14px 18px',
            display:'flex', alignItems:'center', gap:'12px',
          }}>
            <span style={{ fontSize:'1.4rem' }}>📅</span>
            <div>
              <div style={{ fontWeight:800, fontSize:'0.88rem', color:'#fbbf24' }}>
                Today's {displayMode} puzzle — already done!
              </div>
              <div style={{ fontSize:'0.75rem', color:'rgba(210,240,255,0.55)', marginTop:2 }}>
                Your guesses are below. Come back tomorrow for a new one.
              </div>
            </div>
          </div>
        )}

        {/* Confetti */}
        {showConfetti && (
          <canvas ref={confettiRef} style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:999 }} />
        )}

        {/* Grand Win Overlay */}
        {game.status === 'won' && (
          <div style={{
            position:'fixed', inset:0, zIndex:200,
            display:'flex', alignItems:'center', justifyContent:'center',
            background:'rgba(0,0,0,0.75)', padding:'20px',
          }} onClick={() => patchGame({ status:'won_dismissed' })}>
            <div onClick={e => e.stopPropagation()} style={{
              background:'linear-gradient(135deg, rgba(0,40,15,0.98) 0%, rgba(0,20,8,0.98) 100%)',
              border:'2px solid rgba(34,197,94,0.5)',
              borderRadius:'24px', padding:'36px 28px',
              maxWidth:'360px', width:'100%', textAlign:'center',
              boxShadow:'0 0 80px rgba(34,197,94,0.25), 0 20px 60px rgba(0,0,0,0.8)',
            }}>
              <div style={{ fontSize:'4rem', marginBottom:'8px', lineHeight:1 }}>🏏</div>
              <div style={{
                fontSize:'2.2rem', fontWeight:900, letterSpacing:'-0.03em',
                background:'linear-gradient(135deg,#22c55e,#86efac)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                marginBottom:'6px', lineHeight:1.1,
              }}>
                {game.guesses.length === 1 ? 'FIRST BALL!' : game.guesses.length <= 3 ? 'NAILED IT!' : 'GOT IT!'}
              </div>
              <div style={{ fontSize:'1.4rem', fontWeight:800, color:'#fff', marginBottom:'4px' }}>
                {game.target.name}
              </div>
              <div style={{ fontSize:'0.8rem', color:'rgba(210,240,255,0.5)', marginBottom:'24px' }}>
                {game.guesses.length} / 8 guess{game.guesses.length !== 1 ? 'es' : ''}
                {game.hintsUsed > 0 ? ` · ${game.hintsUsed} hint${game.hintsUsed > 1 ? 's' : ''}` : ' · No hints 🎯'}
              </div>

              {game.isH2H && activeH2HChallenge && (
                <div style={{
                  background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.3)',
                  borderRadius:'12px', padding:'14px', marginBottom:'24px', textAlign:'center',
                }}>
                  <div style={{ fontSize:'0.8rem', fontWeight:700, color:'rgba(34,197,94,0.9)', marginBottom:'4px' }}>
                    ⚔️ Score submitted — {displayMode} · {game.guesses.length} {game.guesses.length === 1 ? 'try' : 'tries'} · {game.hintsUsed} hint{game.hintsUsed !== 1 ? 's' : ''}
                  </div>
                  <div style={{ fontSize:'0.72rem', color:'rgba(210,240,255,0.5)' }}>
                    Result revealed when your opponent plays.
                  </div>
                </div>
              )}

              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {!game.isEasy && !game.isH2H && (
                  <button onClick={handleGameShare} style={{
                    width:'100%', padding:'14px',
                    background:'linear-gradient(135deg,#22c55e,#16a34a)',
                    border:'none', borderRadius:'12px', color:'#fff',
                    fontWeight:900, fontSize:'0.95rem', cursor:'pointer',
                    boxShadow:'0 4px 20px rgba(34,197,94,0.4)',
                    fontFamily:"'Outfit',system-ui,sans-serif",
                  }}>📤 Share</button>
                )}
                {game.isH2H && (
                  <button onClick={() => { setScreen('menu'); setMenuTab('challenges'); patchGame({ status:'won_dismissed' }); }} style={{
                    width:'100%', padding:'14px',
                    background:'linear-gradient(135deg,#22c55e,#16a34a)',
                    border:'none', borderRadius:'12px', color:'#fff',
                    fontWeight:900, fontSize:'0.95rem', cursor:'pointer',
                    fontFamily:"'Outfit',system-ui,sans-serif",
                  }}>⚔️ Back to H2H</button>
                )}
                {(activeTab === 'endless' || activeTab === 'easy') && (
                  <button onClick={resetGame} style={{
                    width:'100%', padding:'12px',
                    background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)',
                    borderRadius:'12px', color:'rgba(210,240,255,0.8)',
                    fontWeight:800, fontSize:'0.88rem', cursor:'pointer',
                    fontFamily:"'Outfit',system-ui,sans-serif",
                  }}>🎮 New Game</button>
                )}
                <button onClick={() => patchGame({ status:'won_dismissed' })} style={{
                  background:'none', border:'none', color:'rgba(210,240,255,0.35)',
                  fontSize:'0.75rem', cursor:'pointer', padding:'4px',
                  fontFamily:"'Outfit',system-ui,sans-serif",
                }}>See board</button>
              </div>
            </div>
          </div>
        )}

        {/* Game Over banner */}
        {game.status === 'lost' && (
          <div style={{
            width:'100%', maxWidth:'480px',
            background:'rgba(185,28,28,0.12)', border:'1px solid rgba(239,68,68,0.3)',
            borderRadius:'14px', padding:'18px 20px', marginBottom:'20px',
          }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontWeight:800, fontSize:'0.95rem', color:'#fff' }}>💀 Better luck next time.</div>
                <div style={{ fontSize:'0.78rem', color:'rgba(210,240,255,0.6)', marginTop:2 }}>The answer was {game.target.name}</div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {!game.isEasy && !game.isH2H && (
                  <button onClick={handleGameShare} style={{
                    background:'rgba(34,197,94,0.2)', border:'1px solid rgba(34,197,94,0.4)',
                    borderRadius:'8px', padding:'8px 14px', color:'#22c55e', fontWeight:800, fontSize:'0.8rem', cursor:'pointer',
                  }}>📤 Share</button>
                )}
                {(activeTab === 'endless' || activeTab === 'easy' || activeTab === 'h2h') && (
                  <button onClick={() => { if (activeTab === 'h2h') { setScreen('menu'); setMenuTab('challenges'); } else resetGame(); }} style={{
                    background:'#22c55e', color:'#fff', border:'none',
                    borderRadius:'8px', padding:'8px 14px', fontWeight:800, cursor:'pointer', fontSize:'0.8rem',
                    boxShadow:'0 0 12px rgba(34,197,94,0.3)',
                  }}>{activeTab === 'h2h' ? 'Back to H2H' : 'New Game'}</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Won-dismissed compact bar */}
        {game.status === 'won_dismissed' && (
          <div style={{
            width:'100%', maxWidth:'480px',
            background:'rgba(22,163,74,0.12)', border:'1px solid rgba(34,197,94,0.3)',
            borderRadius:'14px', padding:'14px 20px',
            display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px',
          }}>
            <div>
              <div style={{ fontWeight:800, fontSize:'0.9rem', color:'#22c55e' }}>✅ {game.target.name}</div>
              <div style={{ fontSize:'0.75rem', color:'rgba(210,240,255,0.5)', marginTop:2 }}>
                {game.guesses.length}/8 {game.hintsUsed > 0 ? `· ${game.hintsUsed} hint${game.hintsUsed > 1 ? 's' : ''}` : ''}
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {!game.isEasy && !game.isH2H && (
                <button onClick={handleGameShare} style={{
                  background:'rgba(34,197,94,0.2)', border:'1px solid rgba(34,197,94,0.4)',
                  borderRadius:'8px', padding:'8px 14px', color:'#22c55e', fontWeight:800, fontSize:'0.8rem', cursor:'pointer',
                }}>📤 Share</button>
              )}
              {(activeTab === 'endless' || activeTab === 'easy') && (
                <button onClick={resetGame} style={{
                  background:'#22c55e', color:'#fff', border:'none',
                  borderRadius:'8px', padding:'8px 14px', fontWeight:800, cursor:'pointer', fontSize:'0.8rem',
                }}>New Game</button>
              )}
              {activeTab === 'h2h' && (
                <button onClick={() => { setScreen('menu'); setMenuTab('challenges'); }} style={{
                  background:'#22c55e', color:'#fff', border:'none',
                  borderRadius:'8px', padding:'8px 14px', fontWeight:800, cursor:'pointer', fontSize:'0.8rem',
                }}>Back to H2H</button>
              )}
            </div>
          </div>
        )}

        {/* Info bar — guess counter + legend */}
        <div style={{ width:'100%', maxWidth:'480px', marginBottom:'10px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
            <span style={{ color:'rgba(210,240,255,0.92)', fontSize:'0.8rem', fontWeight:600 }}>
              {game.isH2H
                ? `H2H vs ${activeH2HChallenge?.sender_uid === authUser?.uid ? activeH2HChallenge?.receiver_name : activeH2HChallenge?.sender_name || 'Friend'}`
                : `Guess the ${displayMode} Cricketer`}
            </span>
            <span style={{
              color: game.guesses.length >= 6 ? '#f87171' : '#7dd3fc',
              fontWeight:800, fontSize:'0.82rem',
              background: game.guesses.length >= 6 ? 'rgba(239,68,68,0.3)' : 'rgba(125,211,252,0.15)',
              padding:'2px 10px', borderRadius:'20px',
              border: `1px solid ${game.guesses.length >= 6 ? 'rgba(239,68,68,0.3)' : 'rgba(135,195,240,0.25)'}`,
            }}>
              {game.guesses.length} / {MAX_GUESSES}
            </span>
          </div>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', padding:'8px 12px', background:'rgba(0,30,10,0.9)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'8px' }}>
            {[
              { bg:'#14532d', border:'#16a34a', color:'#86efac', label:'Exact match' },
              { bg:'#713f12', border:'#d97706', color:'#fde68a', label:'Close — ↑ higher  ↓ lower' },
              { bg:'#1e2025', border:'#35373f', color:'#9ca3af', label:'No match' },
            ].map(({ bg, border, color, label }) => (
              <div key={label} style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                <div style={{ width:'16px', height:'16px', borderRadius:'4px', flexShrink:0, background:bg, border:`1px solid ${border}` }} />
                <span style={{ fontSize:'0.7rem', color:'rgba(210,240,255,0.92)', whiteSpace:'nowrap' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Search */}
        <div style={{ position:'relative', width:'100%', maxWidth:'480px', marginBottom:'12px', zIndex:30 }}>
          <input
            type="text"
            placeholder={game.status !== 'playing'
              ? (game.isDaily ? 'Puzzle complete. Come back tomorrow!' : 'Game over')
              : 'Search for a player…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            disabled={game.status !== 'playing'}
            style={{
              width:'100%', boxSizing:'border-box', padding:'13px 16px',
              background:'rgba(0,30,10,0.92)', border:'1px solid rgba(255,255,255,0.2)',
              borderRadius:'12px', color:'#ffffff',
              fontSize:'0.95rem', fontWeight:600, outline:'none',
              opacity: game.status !== 'playing' ? 0.4 : 1,
            }}
          />
          {search && suggestions.length > 0 && game.status === 'playing' && (
            <div style={{
              position:'absolute', top:'100%', left:0, right:0,
              background:'rgba(0,25,10,0.94)', border:'1px solid rgba(255,255,255,0.2)',
              borderRadius:'10px', marginTop:'4px', overflow:'hidden',
              boxShadow:'0 20px 40px rgba(0,0,0,0.7)',
            }}>
              {suggestions.map((p, i) => (
                <div key={i} onClick={() => handleGuess(p)}
                  style={{ padding:'11px 16px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom: i < suggestions.length - 1 ? '1px solid #0f172a' : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontWeight:700, fontSize:'0.9rem' }}>{p.name}</span>
                  <span style={{ fontSize:'0.72rem', background:'rgba(0,25,10,0.7)', color:'rgba(200,230,255,0.8)', padding:'3px 8px', borderRadius:'6px' }}>{p.nation}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hint dropdown click-outside dismisser */}
        {showHintDrop && (
          <div onClick={() => setShowHintDrop(false)} style={{ position:'fixed', inset:0, zIndex:24, background:'transparent' }} />
        )}

        {/* Hints + Give Up row */}
        {game.status === 'playing' && (
          <div style={{ width:'100%', maxWidth:'480px', marginBottom:'12px', position:'relative', zIndex:25 }}>
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              <div style={{ position:'relative', flex:1 }}>
                <button onClick={() => setShowHintDrop(v => !v)} style={{
                  width:'100%', padding:'9px 14px',
                  background: game.hintsUsed > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(0,30,10,0.9)',
                  border:`1px solid ${game.hintsUsed > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.15)'}`,
                  borderRadius:'10px', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  fontFamily:"'Outfit',system-ui,sans-serif",
                }}>
                  <span style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <span style={{ fontSize:'0.9rem' }}>💡</span>
                    <span style={{ fontSize:'0.8rem', fontWeight:700, color: game.hintsUsed > 0 ? '#f87171' : 'rgba(210,240,255,0.8)' }}>
                      {game.hintsUsed === 0 ? 'Hints' : `${game.hintsUsed}/3 hint${game.hintsUsed > 1 ? 's' : ''} used`}
                    </span>
                  </span>
                  <span style={{ fontSize:'0.65rem', color:'rgba(210,240,255,0.4)', transition:'transform 0.15s', display:'inline-block', transform: showHintDrop ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                </button>

                {showHintDrop && (
                  <div style={{
                    position:'absolute', top:'calc(100% + 6px)', left:0, right:0,
                    background:'rgba(0,18,8,0.97)', border:'1px solid rgba(255,255,255,0.15)',
                    borderRadius:'12px', padding:'14px',
                    boxShadow:'0 16px 40px rgba(0,0,0,0.8)',
                  }}>
                    {game.revealBanner && (
                      <div style={{ background:'rgba(120,0,0,0.5)', borderLeft:'3px solid #ef4444', borderRadius:'0 8px 8px 0', padding:'8px 12px', marginBottom:'10px' }}>
                        <p style={{ margin:0, fontSize:'0.78rem', fontWeight:700, fontStyle:'italic', color:'#f87171', lineHeight:1.4 }}>
                          {game.revealBanner}
                        </p>
                      </div>
                    )}

                    {game.hintsUsed > 0 && (
                      <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'10px' }}>
                        {hintTexts.map((text, i) => (
                          <div key={i} style={{
                            borderRadius:'10px', border:`1px solid ${HINTS[i].borderColor}`,
                            background: HINTS[i].dimColor, padding:'9px 12px',
                            display:'flex', gap:'10px', alignItems:'flex-start',
                          }}>
                            <div style={{
                              width:'18px', height:'18px', borderRadius:'50%', flexShrink:0,
                              background: HINTS[i].color, display:'flex', alignItems:'center', justifyContent:'center',
                              fontSize:'0.62rem', fontWeight:900, color:'#0a1a0a', marginTop:'1px',
                            }}>{i+1}</div>
                            <p style={{ margin:0, fontSize:'0.82rem', lineHeight:1.5, color:'#ffffff', fontWeight:500 }}>{text}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {showHintWarning && game.hintsUsed === 0 && (
                      <div style={{ background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.4)', borderRadius:'10px', padding:'10px 12px', marginBottom:'10px' }}>
                        <p style={{ margin:'0 0 8px', fontSize:'0.78rem', fontWeight:700, color:'#fbbf24', lineHeight:1.4 }}>
                          {game.isH2H
                            ? `⚠️ Using a hint gives your opponent an advantage — if they guess without hints and you don't, they win.`
                            : (() => {
                                const streak = game.isDaily ? (stats.dailyHintlessStreak || 0) : (stats.hintlessStreak || 0);
                                return streak > 0
                                  ? `⚠️ Using a hint will break your ${streak}-game hintless streak.`
                                  : `💡 Using a hint means no hintless bonus this game.`;
                              })()
                          }
                        </p>
                        <div style={{ display:'flex', gap:'8px' }}>
                          <button onClick={() => { setShowHintWarning(false); requestHint(); }} style={{
                            flex:1, padding:'6px', background:'rgba(251,191,36,0.2)',
                            border:'1px solid rgba(251,191,36,0.5)', borderRadius:'7px',
                            color:'#fbbf24', fontWeight:800, fontSize:'0.78rem', cursor:'pointer',
                            fontFamily:"'Outfit',system-ui,sans-serif",
                          }}>Use hint anyway</button>
                          <button onClick={() => setShowHintWarning(false)} style={{
                            flex:1, padding:'6px', background:'transparent',
                            border:'1px solid rgba(255,255,255,0.15)', borderRadius:'7px',
                            color:'rgba(210,240,255,0.6)', fontWeight:700, fontSize:'0.78rem', cursor:'pointer',
                            fontFamily:"'Outfit',system-ui,sans-serif",
                          }}>Keep going</button>
                        </div>
                      </div>
                    )}

                    {game.hintsUsed < 3 && (
                      <button onClick={requestHint} style={{
                        width:'100%', padding:'10px',
                        background: HINTS[game.hintsUsed].dimColor,
                        border:`1px solid ${HINTS[game.hintsUsed].borderColor}`,
                        borderRadius:'8px', cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                        fontFamily:"'Outfit',system-ui,sans-serif",
                      }}>
                        <span>{game.hintsUsed === 0 ? '💡' : '📺'}</span>
                        <span style={{ fontSize:'0.82rem', fontWeight:800, color: HINTS[game.hintsUsed].color }}>
                          {game.hintsUsed === 0 ? 'Use Free Hint' : `Watch Ad · Hint ${game.hintsUsed + 1}`}
                        </span>
                      </button>
                    )}
                    {game.hintsUsed >= 3 && (
                      <p style={{ margin:0, textAlign:'center', fontSize:'0.75rem', color:'rgba(239,68,68,0.7)', fontStyle:'italic' }}>
                        All hints used. You are on your own now.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <button onClick={handleGiveUp} style={{
                padding:'9px 14px', flexShrink:0,
                border:'1px solid rgba(255,255,255,0.15)',
                background:'rgba(0,30,10,0.9)', color:'rgba(210,240,255,0.6)',
                fontWeight:700, fontSize:'0.8rem',
                borderRadius:'10px', cursor:'pointer',
                fontFamily:"'Outfit',system-ui,sans-serif",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(248,113,113,0.4)'; e.currentTarget.style.color='#f87171'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.15)'; e.currentTarget.style.color='rgba(210,240,255,0.6)'; }}
              >🏳 Give Up</button>
            </div>
          </div>
        )}

        {/* Guess Grid */}
        <div style={{ width:'100%', paddingBottom:'32px' }}>
          {isMobile ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {game.guesses.map((g, ri) => (
                <div key={ri} style={{ background:'rgba(0,35,12,0.93)', border:'1px solid rgba(255,255,255,0.22)', borderRadius:'14px', overflow:'hidden' }}>
                  <div style={{ padding:'10px 14px', borderBottom:'1px solid #071c30', fontWeight:800, fontSize:'0.9rem', color:'#ffffff', background:'rgba(255,255,255,0.05)' }}>
                    {g.name}
                  </div>
                  <div style={{ padding:'8px 10px', display:'flex', flexDirection:'column', gap:'5px' }}>
                    {cols.map(({ key, label }) => {
                      const gVal   = g[key];
                      const tVal   = game.target[key];
                      const colors = boxColor(key, gVal, tVal, g, game.target);
                      const arr    = arrowFor(key, gVal, tVal, g, game.target);
                      return (
                        <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px' }}>
                          <span style={{ fontSize:'0.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'rgba(210,240,255,0.92)', flexShrink:0 }}>
                            {label}
                          </span>
                          <div style={{
                            background: colors.bg, border:`1px solid ${colors.border}`,
                            borderRadius:'6px', padding:'3px 10px',
                            fontSize:'0.8rem', fontWeight:700, color: colors.color,
                            minWidth:'60px', textAlign:'center',
                          }}>
                            {gVal == null ? '—' : gVal}{arr}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {game.status === 'playing' && Array.from({ length: MAX_GUESSES - game.guesses.length }).map((_, i) => (
                <div key={`e${i}`} style={{ height:'44px', background:'rgba(0,25,10,0.92)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'12px', opacity:0.2 }} />
              ))}
            </div>
          ) : (
            (() => {
              const nameW  = 176;
              const colW   = 86;
              const gap    = 6;
              const rowH   = 46;
              const totalW = nameW + cols.length * colW + cols.length * gap;
              const Row    = ({ children, faded }) => (
                <div style={{ display:'flex', gap:`${gap}px`, width: totalW, margin:`0 auto 5px`, opacity: faded ? 0.55 : 1 }}>
                  {children}
                </div>
              );
              return (
                <div>
                  {game.guesses.length > 0 && (
                    <div style={{ display:'flex', gap:`${gap}px`, width: totalW, margin:'0 auto 6px', fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'rgba(255,255,255,0.5)' }}>
                      <div style={{ width:nameW, flexShrink:0 }}>Name</div>
                      {cols.map(c => <div key={c.key} style={{ width:colW, flexShrink:0, textAlign:'center' }}>{c.label}</div>)}
                    </div>
                  )}
                  {game.guesses.map((g, ri) => (
                    <Row key={ri}>
                      <div style={{ width:nameW, flexShrink:0, background:'rgba(0,35,12,0.93)', border:'1px solid rgba(255,255,255,0.22)', borderRadius:'8px', padding:'0 12px', height:rowH, display:'flex', alignItems:'center', fontWeight:700, fontSize:'0.82rem', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                        {g.name}
                      </div>
                      {cols.map(({ key }) => {
                        const gVal   = g[key];
                        const tVal   = game.target[key];
                        const colors = boxColor(key, gVal, tVal, g, game.target);
                        const arr    = arrowFor(key, gVal, tVal, g, game.target);
                        return (
                          <div key={key} style={{
                            width:colW, flexShrink:0, height:rowH,
                            background:colors.bg, border:`1px solid ${colors.border}`,
                            borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:'0.78rem', fontWeight:700, color:colors.color,
                            textAlign:'center', padding:'0 4px', lineHeight:1.2,
                          }}>
                            {gVal == null ? '—' : gVal}{arr}
                          </div>
                        );
                      })}
                    </Row>
                  ))}
                  {game.status === 'playing' && Array.from({ length: MAX_GUESSES - game.guesses.length }).map((_, i) => (
                    <Row key={`e${i}`} faded>
                      <div style={{ width:nameW, flexShrink:0, height:rowH, background:'rgba(0,35,12,0.92)', border:'1px solid rgba(255,255,255,0.22)', borderRadius:'8px' }} />
                      {cols.map(c => <div key={c.key} style={{ width:colW, flexShrink:0, height:rowH, background:'rgba(0,35,12,0.92)', border:'1px solid rgba(255,255,255,0.22)', borderRadius:'8px' }} />)}
                    </Row>
                  ))}
                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
}