import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AdMob, InterstitialAdPluginEvents } from '@capacitor-community/admob';
import { App as CapApp } from '@capacitor/app';
import testPlayersRaw from './testplayers.json';
import odiPlayersRaw from './odiplayers.json';
import t20PlayersRaw from './t20players.json';

// @ts-ignore
const _googleFont = (() => {
  if (typeof document !== 'undefined' && !document.getElementById('crickle-fonts')) {
    const l = document.createElement('link');
    l.id = 'crickle-fonts';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=DM+Sans:wght@400;500;600&display=swap';
    document.head.appendChild(l);
  }
})();

const MAX_GUESSES = 8;

const ALLOWED_NATIONS = new Set([
  'IND','AUS','ENG','SA','PAK','WI','NZ','SL','BAN','ZIM','AFG','IRE',
]);

const AD_UNIT_ID = 'ca-app-pub-5952766591392144/9128571701';

// Is this running inside a Capacitor native app (not a browser)?
const IS_NATIVE = typeof window !== 'undefined' && !!(window?.Capacitor?.isNativePlatform?.());

const FORMAT_KEY = { Test: 'Test', ODI: 'ODI', T20: 'T20I' };

const normBowl = (raw) => ({
  'Right-arm fast':         'RA Fast',
  'Right-arm fast-medium':  'RA Fast-Med',
  'Right-arm medium-fast':  'RA Med-Fast',
  'Right-arm medium':       'RA Medium',
  'Right-arm offbreak':     'RA Offbreak',
  'Right-arm legbreak':     'RA Legbreak',
  'Right-arm slow-medium':  'RA Slow-Med',
  'Right-arm slow':         'RA Slow',
  'Right-arm spin':         'RA Spin',
  'Right-arm bowl':         'RA',
  'Left-arm fast':          'LA Fast',
  'Left-arm fast-medium':   'LA Fast-Med',
  'Left-arm medium-fast':   'LA Med-Fast',
  'Left-arm medium':        'LA Medium',
  'Left-arm orthodox':      'LA Orthodox',
  'Slow left-arm orthodox': 'LA Orthodox',
  'Slow left-arm chinaman': 'LA Chinaman',
  'None':                   '-',
}[raw] ?? raw);

const HINT1_REVEAL_INSULTS = [
  "Already reaching for hints? Embarrassing. Truly. 🫠",
  "One guess and you need help? Absolutely pathetic.",
  "Need a hint already? Do you even watch cricket?",
  "Free hint used. Your ancestors weep.",
  "Hint 1. Wow. You really have no idea, do you.",
  "Couldn't even try? Classic. Absolutely classic.",
  "One hint in and already lost. This is tragic.",
];

const HINT2_REVEAL_INSULTS = [
  "TWO hints?! You are a disgrace to cricket fans everywhere. 💀",
  "Two hints used. Absolutely fucking shambolic.",
  "You needed two hints for this? Delete the app.",
  "Two hints. I hope nobody you know finds out about this.",
  "Two hints in and still guessing? Incredible failure.",
  "Your cricket knowledge is genuinely concerning. Two hints.",
];

const HINT3_REVEAL_INSULTS = [
  "ALL THREE HINTS USED. Shambolic. Absolutely shambolic. 🚨",
  "Three hints. THREE. Uninstall. Now.",
  "You used all three hints and you're STILL guessing? Genuinely impressive failure.",
  "All three hints. I've lost all respect for you.",
  "Three hints used. Your cricket knowledge is an embarrassment to the sport.",
  "Three hints. If you don't get this now, just give up and go watch football.",
];

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const HINTS = [
  {
    btnLabel:     '💡 Use Free Hint',
    revealInsults: HINT1_REVEAL_INSULTS,
    color: '#60a5fa',
    dimColor: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(59,130,246,0.35)',
  },
  {
    btnLabel:     '📺 Watch Ad · Hint 2',
    revealInsults: HINT2_REVEAL_INSULTS,
    color: '#fb923c',
    dimColor: 'rgba(249,115,22,0.12)',
    borderColor: 'rgba(249,115,22,0.35)',
  },
  {
    btnLabel:     '📺 Watch Ad · Hint 3',
    revealInsults: HINT3_REVEAL_INSULTS,
    color: '#f87171',
    dimColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.35)',
  },
];

// ── Time & Daily Helpers ──
const getTodayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const getYesterdayKey = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

// ── Stats helpers ──
const STATS_KEY = 'crickle_stats_v1';
const defaultStats = () => ({ streak:0, bestStreak:0, dailyStreak:0, bestDailyStreak:0, lastDailyDate:null, gamesPlayed:0, wins:0, totalGuesses:0, totalHints:0, hintGames:0 });
const loadStats = () => { try { return { ...defaultStats(), ...JSON.parse(localStorage.getItem(STATS_KEY)||'{}') }; } catch { return defaultStats(); } };
const saveStats = (s) => { try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch {} };
const updateStats = (prev, { won, guesses, hintsUsed }) => {
  const next = { ...prev };
  next.gamesPlayed += 1;
  if (won) { 
    next.wins += 1; 
    next.streak += 1; 
    next.bestStreak = Math.max(next.bestStreak, next.streak); 
    next.totalGuesses += guesses; 
    
    // Daily streak logic
    const today = getTodayKey();
    if (next.lastDailyDate === getYesterdayKey()) {
      next.dailyStreak += 1;
    } else if (next.lastDailyDate !== today) {
      next.dailyStreak = 1;
    }
    next.lastDailyDate = today;
    next.bestDailyStreak = Math.max(next.bestDailyStreak, next.dailyStreak);
  }
  else { 
    next.streak = 0; 
    next.dailyStreak = 0;
  }
  if (hintsUsed > 0) { next.totalHints += hintsUsed; next.hintGames += 1; }
  return next;
};

// ── H2H Obfuscation ──
const encodeH2H = (name, tries, won) => btoa(encodeURIComponent(`1:${name}:${tries}:${won?1:0}`));
const decodeH2H = (str) => {
  try {
    const [v, name, tries, won] = decodeURIComponent(atob(str)).split(':');
    if (v !== '1') return null;
    return { name, tries: parseInt(tries, 10), won: won === '1' };
  } catch { return null; }
};

// ── Player challenge link encoding ──
const encodeChallenge = (mode, playerName) => {
  const pool = POOL[mode];
  const idx  = pool.findIndex(p => p.name === playerName);
  if (idx < 0) return null;
  const prefix = mode === 'Test' ? 'TE' : mode === 'ODI' ? 'OD' : 'T2';
  return prefix + String(idx).padStart(4, '0');
};
const decodeChallenge = (code) => {
  if (!code || code.length < 6) return null;
  const prefix = code.slice(0, 2);
  const mode   = prefix === 'TE' ? 'Test' : prefix === 'OD' ? 'ODI' : prefix === 'T2' ? 'T20' : null;
  if (!mode) return null;
  const idx    = parseInt(code.slice(2), 10);
  const player = POOL[mode]?.[idx];
  return player ? { mode, player } : null;
};

const normalizePlayers = (rawPlayers, mode) => {
  const fmtKey = FORMAT_KEY[mode];
  return rawPlayers
    .filter((p) => ALLOWED_NATIONS.has(p.nation))
    .map((p) => {
      const isFlat = p.player_name !== undefined || p.hints !== undefined;
      const fmt    = isFlat ? null : p.formats?.[fmtKey];

      const runsRaw    = isFlat ? p.runs    : fmt?.runs;
      const wicketsRaw = isFlat ? p.wickets : fmt?.wickets;
      const runs    = runsRaw    != null && runsRaw    !== '' ? parseInt(runsRaw,    10) : null;
      const wickets = wicketsRaw != null && wicketsRaw !== '' ? parseInt(wicketsRaw, 10) : null;

      return {
        name:      isFlat ? p.player_name : p.name,
        nation:    p.nation,
        batting:   isFlat ? (p.batsman_type  ?? '-') : (p.battingStyle ?? '-'),
        bowling:   isFlat ? (p.bowling_type  ?? '-') : normBowl(p.bowlingStyle ?? 'None'),
        debutYear: isFlat
          ? (parseInt(p.debut_year, 10) || null)
          : (fmt?.debutYear ?? null),
        matches: isFlat
          ? (p.matches != null && p.matches !== '' ? parseInt(p.matches, 10) : null)
          : (fmt?.matches ?? null),
        runs:        runs,
        wickets:     wickets,
        keyStat:     runs    != null ? runs    : wickets != null ? wickets : null,
        keyStatType: runs    != null ? 'runs'  : wickets != null ? 'wickets' : null,
        trivia: isFlat
          ? { hint1: p.hints?.[0] ?? '', hint2: p.hints?.[1] ?? '', hint3: p.hints?.[2] ?? '' }
          : { hint1: p.trivia?.hint1 ?? '', hint2: p.trivia?.hint2 ?? '', hint3: p.trivia?.hint3 ?? '' },
      };
    });
};

const POOL = {
  Test: normalizePlayers(testPlayersRaw, 'Test'),
  ODI:  normalizePlayers(odiPlayersRaw,  'ODI'),
  T20:  normalizePlayers(t20PlayersRaw,  'T20'),
};

const freshGameState = (mode) => {
  const pool = POOL[mode];
  if (!pool.length) return null;
  return {
    target:       pool[Math.floor(Math.random() * pool.length)],
    guesses:      [],
    status:       'playing',
    hintsUsed:    0,
    revealBanner: null,
  };
};

const boxColor = (key, gVal, tVal, g, t) => {
  if (key === 'runs') {
    if (gVal === tVal && gVal != null) return { bg: '#166534', border: '#22c55e', color: '#bbf7d0' };
    if (gVal == null && tVal == null)  return { bg: '#166534', border: '#22c55e', color: '#bbf7d0' };
    if (gVal == null || tVal == null)  return { bg: '#1e2025', border: '#35373f', color: '#9ca3af' };
    const diff = Math.abs(gVal - tVal);
    return diff <= 1500
      ? { bg: '#713f12', border: '#d97706', color: '#fde68a' }
      : { bg: '#1e2025', border: '#35373f', color: '#9ca3af' };
  }
  if (key === 'wickets') {
    if (gVal === tVal && gVal != null) return { bg: '#166534', border: '#22c55e', color: '#bbf7d0' };
    if (gVal == null && tVal == null)  return { bg: '#166534', border: '#22c55e', color: '#bbf7d0' };
    if (gVal == null || tVal == null)  return { bg: '#1e2025', border: '#35373f', color: '#9ca3af' };
    const diff = Math.abs(gVal - tVal);
    return diff <= 50
      ? { bg: '#713f12', border: '#d97706', color: '#fde68a' }
      : { bg: '#1e2025', border: '#35373f', color: '#9ca3af' };
  }
  if (key === 'keyStat') {
    if (g.keyStatType !== t.keyStatType)
      return { bg: '#1e2025', border: '#35373f', color: '#9ca3af' };
    if (gVal === tVal)
      return { bg: '#166534', border: '#22c55e', color: '#bbf7d0' };
    if (gVal == null || tVal == null)
      return { bg: '#1e2025', border: '#35373f', color: '#9ca3af' };
    const diff = Math.abs(gVal - tVal);
    const close = g.keyStatType === 'runs' ? diff <= 1500 : diff <= 50;
    return close
      ? { bg: '#713f12', border: '#d97706', color: '#fde68a' }
      : { bg: '#1e2025', border: '#35373f', color: '#9ca3af' };
  }
  if (gVal == null && tVal == null) return { bg: '#166534', border: '#22c55e', color: '#bbf7d0' };
  if (gVal == null || tVal == null) return { bg: '#1e2025', border: '#35373f', color: '#9ca3af' };
  if (gVal === tVal)                return { bg: '#166534', border: '#22c55e', color: '#bbf7d0' };
  const diff = Math.abs(gVal - tVal);
  const close = (key === 'debutYear' && diff <= 3) || (key === 'matches' && diff <= 20);
  return close
    ? { bg: '#713f12', border: '#d97706', color: '#fde68a' }
    : { bg: '#1e2025', border: '#35373f', color: '#9ca3af' };
};

const arrowFor = (key, gVal, tVal, g, t) => {
  if (key === 'keyStat' && g.keyStatType !== t.keyStatType) return '';
  if (key === 'runs' && (gVal == null || tVal == null)) return '';
  if (key === 'wickets' && (gVal == null || tVal == null)) return '';
  if (typeof gVal !== 'number' || typeof tVal !== 'number' || gVal === tVal) return '';
  return gVal < tVal ? ' ↑' : ' ↓';
};

const COLS = [
  { key: 'runs',      baseLabel: 'Runs'    },
  { key: 'wickets',   baseLabel: 'Wkts'    },
  { key: 'debutYear', baseLabel: 'Debut'   },
  { key: 'matches',   baseLabel: 'Matches' },
  { key: 'nation',    baseLabel: 'Nation'  },
  { key: 'batting',   baseLabel: 'Bat'     },
  { key: 'bowling',   baseLabel: 'Bowl'    },
];

const useWindowWidth = () => {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
};

export default function App() {
  const winWidth = useWindowWidth();
  const isMobile = winWidth < 768;

  const [games, setGames] = useState(() => ({
    Test: freshGameState('Test'),
    ODI:  freshGameState('ODI'),
    T20:  freshGameState('T20'),
  }));
  const [mode,   setMode]   = useState('Test');
  const [search, setSearch] = useState('');

  const [stats,          setStats]          = useState(loadStats);
  const [screen,         setScreen]         = useState('menu');
  const [menuTab,        setMenuTab]        = useState('play');
  const [showHintDrop,   setShowHintDrop]   = useState(false);
  const adListenerRef = useRef(null);

  // H2H states
  const [userName, setUserName] = useState(() => { try { return localStorage.getItem('crickle_username') || ''; } catch { return ''; } });
  const [savedChallenges, setSavedChallenges] = useState(() => { try { return JSON.parse(localStorage.getItem('crickle_challenges') || '[]'); } catch { return []; } });
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [webChallengePrompt, setWebChallengePrompt] = useState(null);

  useEffect(() => {
    if (!IS_NATIVE) return;
    const init = async () => {
      try {
        await AdMob.initialize({ initializeForTesting: false });
        await AdMob.prepareInterstitial({ adId: AD_UNIT_ID });
      } catch (e) {
        console.warn('AdMob init failed:', e);
      }
    };
    init();
  }, []);

  const game = games[mode];

  const patchGame = useCallback((mode, patch) => {
    setGames((prev) => ({
      ...prev,
      [mode]: { ...prev[mode], ...patch },
    }));
  }, []);

  const resetGame = useCallback((m) => {
    setActiveChallenge(null);
    setGames((prev) => ({ ...prev, [m]: freshGameState(m) }));
    setSearch('');
  }, []);

  const handleModeChange = (m) => {
    setMode(m);
    setSearch('');
  };

  // Sync storage
  useEffect(() => { saveStats(stats); }, [stats]);
  useEffect(() => { try { localStorage.setItem('crickle_challenges', JSON.stringify(savedChallenges)); } catch {} }, [savedChallenges]);

  // Deep link parsing
  useEffect(() => {
    const tryChallenge = (urlString) => {
      try {
        const search = urlString.includes('?') ? urlString.slice(urlString.indexOf('?')) : urlString;
        const params = new URLSearchParams(search);
        const code = params.get('c');
        const xParam = params.get('x');
        if (!code) return;
        
        const decoded = decodeChallenge(code);
        if (!decoded) return;
        const { mode: cMode, player } = decoded;

        let senderName = 'A friend';
        let challengeScore = null;
        if (xParam) {
          challengeScore = decodeH2H(xParam);
          if (challengeScore) senderName = challengeScore.name;
        }

        const newChall = {
          id: Date.now(), sender: senderName, senderScore: challengeScore,
          mode: cMode, code: code, status: 'pending', targetPlayer: player.name
        };

        setSavedChallenges(prev => {
          if (prev.find(c => c.code === code && c.sender === senderName)) return prev;
          return [newChall, ...prev];
        });
        
        if (!IS_NATIVE) {
          setWebChallengePrompt(newChall);
        } else {
          setMenuTab('challenges');
        }
      } catch {}
    };

    if (typeof window !== 'undefined' && window.location.search) {
      tryChallenge(window.location.search);
    }

    let listener;
    if (IS_NATIVE) {
      CapApp.getLaunchUrl().then((result) => {
        if (result?.url) tryChallenge(result.url);
      }).catch(() => {});
      CapApp.addListener('appUrlOpen', (data) => {
        if (data?.url) tryChallenge(data.url);
      }).then((l) => { listener = l; }).catch(() => {});
    }

    return () => { listener?.remove(); };
  }, []);

  // Confetti state
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = useRef(null);

  useEffect(() => {
    if (game?.status === 'won' && !showConfetti) {
      setShowConfetti(true);
    }
    if (game?.status !== 'won') {
      setShowConfetti(false);
    }
  }, [game?.status]);

  useEffect(() => {
    if (!showConfetti || !confettiRef.current) return;
    const canvas = confettiRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 100,
      r: 4 + Math.random() * 6,
      d: 2 + Math.random() * 3,
      color: ['#22c55e','#60a5fa','#fbbf24','#f87171','#a78bfa','#34d399'][Math.floor(Math.random()*6)],
      tilt: Math.random() * 10 - 5,
      tiltAngle: 0,
      tiltSpeed: 0.05 + Math.random() * 0.1,
    }));
    let frame;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        p.tiltAngle += p.tiltSpeed;
        p.y += p.d;
        p.tilt = Math.sin(p.tiltAngle) * 12;
        if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.ellipse(p.x, p.y, p.r, p.r * 0.4, p.tilt, 0, Math.PI * 2);
        ctx.fill();
      });
      frame = requestAnimationFrame(draw);
    };
    draw();
    const t = setTimeout(() => { setShowConfetti(false); }, 4000);
    return () => { cancelAnimationFrame(frame); clearTimeout(t); };
  }, [showConfetti]);

  useEffect(() => { if (screen !== 'game') setShowHintDrop(false); }, [screen]);

  const revealHint = useCallback((idx) => {
    patchGame(mode, {
      hintsUsed:    idx + 1,
      revealBanner: pickRandom(HINTS[idx].revealInsults),
    });
    if (IS_NATIVE) {
      AdMob.prepareInterstitial({ adId: AD_UNIT_ID }).catch(() => {});
    }
  }, [mode, patchGame]);

  const handleGameShare = useCallback(async () => {
    if (!game) return;
    if (!userName) {
      setShowNamePrompt(true);
      return;
    }

    const won      = game.status === 'won' || game.status === 'won_dismissed';
    const tries    = game.guesses.length;
    const RCOLS    = ['runs','wickets','debutYear','matches','nation','batting','bowling'];
    const boxR = (key, gVal, tVal, g) => {
      if (key==='runs')    { if(gVal==null&&tVal==null)return'🟩'; if(gVal==null||tVal==null)return'⬛'; if(gVal===tVal)return'🟩'; return Math.abs(gVal-tVal)<=1500?'🟨':'⬛'; }
      if (key==='wickets') { if(gVal==null&&tVal==null)return'🟩'; if(gVal==null||tVal==null)return'⬛'; if(gVal===tVal)return'🟩'; return Math.abs(gVal-tVal)<=50?'🟨':'⬛'; }
      if (gVal==null&&tVal==null) return '🟩';
      if (gVal==null||tVal==null) return '⬛';
      if (gVal===tVal) return '🟩';
      const d = Math.abs(gVal-tVal);
      return ((key==='debutYear'&&d<=3)||(key==='matches'&&d<=20))?'🟨':'⬛';
    };
    const grid = [...game.guesses].reverse()
      .map(g => RCOLS.map(k => boxR(k, g[k], game.target[k], g)).join(''))
      .join('\n');

    const code = (() => {
      const pool = POOL[mode];
      const idx  = pool.findIndex(p => p.name === game.target.name);
      if (idx < 0) return null;
      const pfx  = mode==='Test'?'TE':mode==='ODI'?'OD':'T2';
      return pfx + String(idx).padStart(4,'0');
    })();
    
    let shareUrl = code ? `https://crickle.app/?c=${code}` : 'https://crickle.app';
    if (code) {
      const h2h = encodeH2H(userName, tries, won);
      shareUrl += `&x=${h2h}`;
    }

    const scoreStr = won ? `${tries}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
    
    const text = activeChallenge
      ? `🏏 Crickle H2H\nPlayed ${activeChallenge.sender}'s challenge (${scoreStr})\n\n${grid}\n\nCan you beat us? 👇`
      : `🏏 Crickle ${mode} (${scoreStr})\n\n${grid}\n\nCan you beat me? 👇`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Crickle 🏏', text, url: shareUrl });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
      }
    }
    try { await navigator.clipboard.writeText(text + '\n' + shareUrl); alert('Copied!'); } catch {}
  }, [game, mode, userName, activeChallenge]);

  const playSavedChallenge = (chall) => {
    setMode(chall.mode);
    const decoded = decodeChallenge(chall.code);
    if (decoded) {
      setGames(prev => ({
        ...prev,
        [chall.mode]: { target: decoded.player, guesses: [], status: 'playing', hintsUsed: 0, revealBanner: null }
      }));
      setActiveChallenge(chall);
      setScreen('game');
    }
  };

  const handleGuess = (player) => {
    if (!game || game.status !== 'playing') return;
    if (game.guesses.some((g) => g.name === player.name)) return;
    const next = [player, ...game.guesses];
    const newStatus = player.name === game.target.name
      ? 'won'
      : next.length >= MAX_GUESSES ? 'lost' : 'playing';
    patchGame(mode, { guesses: next, status: newStatus });
    setSearch('');
    if (newStatus !== 'playing') {
      setStats(prev => updateStats(prev, {
        won: newStatus === 'won',
        guesses: next.length,
        hintsUsed: game.hintsUsed,
      }));

      if (activeChallenge) {
        setSavedChallenges(prev => prev.map(c => 
          c.id === activeChallenge.id ? { ...c, status: 'completed', myScore: { won: newStatus === 'won', tries: next.length } } : c
        ));
      }
    }
  };

  const handleGiveUp = () => {
    if (!game || game.status !== 'playing') return;
    patchGame(mode, { status: 'lost' });
    setStats(prev => updateStats(prev, { won: false, guesses: game.guesses.length, hintsUsed: game.hintsUsed }));
    if (activeChallenge) {
      setSavedChallenges(prev => prev.map(c => 
        c.id === activeChallenge.id ? { ...c, status: 'completed', myScore: { won: false, tries: game.guesses.length } } : c
      ));
    }
  };

  const requestHint = async () => {
    if (!game || game.hintsUsed >= 3 || game.status !== 'playing') return;
    if (game.hintsUsed === 0) {
      patchGame(mode, { hintsUsed: 1, revealBanner: pickRandom(HINTS[0].revealInsults) });
      return;
    }
    
    const idx = game.hintsUsed;

    if (IS_NATIVE) {
      try {
        if (adListenerRef.current) { adListenerRef.current.remove(); }
        adListenerRef.current = await AdMob.addListener(
          InterstitialAdPluginEvents.Dismissed,
          () => {
            adListenerRef.current?.remove();
            adListenerRef.current = null;
            revealHint(idx);
          }
        );
        await AdMob.showInterstitial();
      } catch (e) {
        console.warn('AdMob show failed:', e);
        revealHint(idx);
      }
    } else {
      // Web: Instant hint, no countdown
      revealHint(idx);
    }
  };

  const pool = POOL[mode];
  const suggestions = pool
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) && !game.guesses.find((g) => g.name === p.name))
    .slice(0, 8);

  const hintTexts = !game.target?.trivia ? [] :
    ['hint1','hint2','hint3'].slice(0, game.hintsUsed).map((k) => game.target.trivia[k] ?? '');

  const cols = COLS.map((c) => ({ ...c, label: c.baseLabel }));

  function renderGameHeader() {
    const fmtColors = { Test:'#7dd3fc', ODI:'#86efac', T20:'#fde68a' };
    return (
      <div style={{
        width:'100%', maxWidth:'480px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:'14px',
      }}>
        <button onClick={() => setScreen('menu')} style={{
          background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)',
          borderRadius:'8px', padding:'6px 12px', color:'rgba(210,240,255,0.85)',
          fontSize:'0.75rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:'6px',
        }}>
          ☰ Menu
        </button>
        <div style={{ textAlign:'center' }}>
          <span style={{
            fontSize:'1.5rem', fontWeight:900, letterSpacing:'-0.04em',
            background:'linear-gradient(135deg, #22c55e 0%, #50a0dc 100%)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
          }}>CRICKLE</span>
        </div>
        <div style={{
          background:'rgba(255,255,255,0.08)', border:`1px solid rgba(255,255,255,0.15)`,
          borderRadius:'8px', padding:'6px 12px',
          fontSize:'0.75rem', fontWeight:800,
          color: fmtColors[mode] ?? '#fff',
        }}>
          {mode}
        </div>
      </div>
    );
  }

  // ── Menu screen ──────────────────────────────────────────────
  const avgGuesses = stats.wins > 0 ? (stats.totalGuesses / stats.wins).toFixed(1) : '—';
  const winRate    = stats.gamesPlayed > 0 ? Math.round(stats.wins / stats.gamesPlayed * 100) : 0;
  const hintRate   = stats.gamesPlayed > 0 ? Math.round(stats.hintGames / stats.gamesPlayed * 100) : 0;
  const pendingCount = savedChallenges.filter(c => c.status === 'pending').length;

  const FORMAT_DESC = {
    Test: { emoji:'🏏', sub:'Red ball · 5 days · Pure test of knowledge' },
    ODI:  { emoji:'🔵', sub:'50 overs · Icons of the format' },
    T20:  { emoji:'⚡', sub:'Fastest format · T20 legends' },
  };

  const HOW_TO_STEPS = [
    { color:'#166534', border:'#22c55e', text:'#bbf7d0', label:'Green', desc:'Exact match — stat is spot on' },
    { color:'#713f12', border:'#d97706', text:'#fde68a', label:'Yellow', desc:'Close — ↑ means higher, ↓ means lower' },
    { color:'#1e2025', border:'#35373f', text:'#9ca3af', label:'Grey', desc:'No match — way off' },
  ];

  if (screen === 'menu') {
    const TABS = [
      { id:'play',   label:'Play'   },
      { id:'challenges', label:`H2H ${pendingCount > 0 ? `(${pendingCount})` : ''}` },
      { id:'stats',  label:'Stats'  },
      { id:'howto',  label:'How to Play' },
    ];
    return (
      <div style={{
        minHeight:'100vh', color:'#ffffff',
        fontFamily:"'Outfit', 'DM Sans', system-ui, sans-serif",
        display:'flex', flexDirection:'column', alignItems:'center',
        background:"url('/BG.jpg') center/cover no-repeat fixed",
        position:'relative',
      }}>
        <div style={{ position:'absolute', inset:0, background:'rgba(0,10,5,0.78)', zIndex:0 }} />

        {/* Top Right Store Links (Web Only) */}
        {!IS_NATIVE && (
          <div style={{ position:'absolute', top:'16px', right:'16px', display:'flex', gap:'10px', zIndex:10 }}>
            <a href="YOUR_APP_STORE_LINK" target="_blank" rel="noreferrer" title="Get it on the App Store" style={{ width:'38px', height:'38px', borderRadius:'10px', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none', fontSize:'1.2rem', boxShadow:'0 4px 12px rgba(0,0,0,0.3)' }}>🍏</a>
            <a href="YOUR_PLAY_STORE_LINK" target="_blank" rel="noreferrer" title="Get it on Google Play" style={{ width:'38px', height:'38px', borderRadius:'10px', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none', fontSize:'1.2rem', boxShadow:'0 4px 12px rgba(0,0,0,0.3)' }}>▶️</a>
          </div>
        )}

        <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:'480px', padding:'40px 20px 60px', display:'flex', flexDirection:'column', alignItems:'center' }}>

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

          {/* Menu tabs */}
          <div style={{
            display:'flex', gap:'4px', width:'100%',
            background:'rgba(0,25,10,0.9)', border:'1px solid rgba(255,255,255,0.1)',
            borderRadius:'12px', padding:'4px', marginBottom:'24px',
          }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setMenuTab(t.id)} style={{
                flex:1, padding:'9px 4px', borderRadius:'8px', border:'none',
                cursor:'pointer', fontWeight:700, fontSize:'0.82rem', transition:'all 0.15s',
                background: menuTab === t.id ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'transparent',
                color: menuTab === t.id ? '#fff' : 'rgba(210,240,255,0.55)',
                boxShadow: menuTab === t.id ? '0 2px 12px rgba(34,197,94,0.3)' : 'none',
              }}>{t.label}</button>
            ))}
          </div>

          {/* ── PLAY tab ── */}
          {menuTab === 'play' && (
            <div style={{ width:'100%' }}>
              <p style={{ color:'rgba(210,240,255,0.5)', fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 12px' }}>Select Format</p>
              <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'28px' }}>
                {['Test','ODI','T20'].map(f => {
                  const isEmpty = POOL[f].length === 0;
                  const active  = mode === f;
                  const inProg  = games[f]?.status === 'playing' && games[f]?.guesses?.length > 0;
                  return (
                    <button key={f} onClick={() => !isEmpty && handleModeChange(f)} style={{
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
                        {inProg && <span style={{ fontSize:'0.65rem', background:'rgba(251,191,36,0.2)', border:'1px solid rgba(251,191,36,0.4)', color:'#fbbf24', borderRadius:'6px', padding:'2px 8px', fontWeight:700 }}>IN PROGRESS</span>}
                        {isEmpty && <span style={{ fontSize:'0.65rem', background:'rgba(245,158,11,0.2)', color:'#f59e0b', borderRadius:'6px', padding:'2px 8px', fontWeight:700 }}>SOON</span>}
                        {active && !isEmpty && <span style={{ color:'#22c55e', fontSize:'1rem' }}>✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setScreen('game')} style={{
                width:'100%', padding:'16px',
                background:'linear-gradient(135deg,#22c55e,#16a34a)',
                border:'none', borderRadius:'12px', color:'#fff',
                fontWeight:900, fontSize:'1rem', cursor:'pointer',
                fontFamily:"'Outfit',system-ui,sans-serif",
                boxShadow:'0 4px 24px rgba(34,197,94,0.35)',
              }}>
                {games[mode]?.guesses?.length > 0 ? `Continue ${mode} Game` : `Start ${mode} Game`}
              </button>
              {games[mode]?.guesses?.length > 0 && (
                <button onClick={() => { resetGame(mode); setScreen('game'); }} style={{
                  width:'100%', padding:'12px', marginTop:'8px',
                  background:'transparent', border:'1px solid rgba(255,255,255,0.15)',
                  borderRadius:'12px', color:'rgba(210,240,255,0.6)',
                  fontWeight:700, fontSize:'0.85rem', cursor:'pointer',
                  fontFamily:"'Outfit',system-ui,sans-serif",
                }}>New Game</button>
              )}
            </div>
          )}

          {/* ── CHALLENGES tab ── */}
          {menuTab === 'challenges' && (
             <div style={{ width:'100%' }}>
               {savedChallenges.length === 0 ? (
                 <div style={{ textAlign:'center', padding:'40px 20px', color:'rgba(255,255,255,0.5)' }}>
                    <div style={{ fontSize:'2rem', marginBottom:'10px' }}>📭</div>
                    <p style={{ fontSize:'0.9rem', fontWeight:600 }}>No challenges yet.</p>
                    <p style={{ fontSize:'0.75rem' }}>Send a challenge to a friend after you finish a game!</p>
                 </div>
               ) : (
                 <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                   {savedChallenges.map((c) => (
                     <div key={c.id} style={{ background:'rgba(0,30,15,0.8)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'12px', padding:'14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div>
                          <div style={{ fontSize:'0.9rem', fontWeight:800, color:'#fff' }}>{c.sender}'s {c.mode}</div>
                          <div style={{ fontSize:'0.7rem', color: c.status === 'pending' ? '#fbbf24' : 'rgba(255,255,255,0.5)', marginTop:'4px' }}>
                            {c.status === 'pending' ? 'Pending Challenge' : 'Completed'}
                          </div>
                        </div>
                        {c.status === 'pending' ? (
                          <button onClick={() => playSavedChallenge(c)} style={{ background:'#22c55e', color:'#fff', border:'none', borderRadius:'8px', padding:'8px 16px', fontWeight:800, cursor:'pointer' }}>Play</button>
                        ) : (
                          <div style={{ textAlign:'right', fontSize:'0.75rem', fontWeight:700 }}>
                            <span style={{ color: c.myScore.won ? '#22c55e' : '#ef4444' }}>{c.myScore.won ? `${c.myScore.tries} tries` : 'Lost'}</span>
                            <br/>
                            <span style={{ color:'rgba(255,255,255,0.5)' }}>vs {c.senderScore?.won ? `${c.senderScore.tries} tries` : 'Lost'}</span>
                          </div>
                        )}
                     </div>
                   ))}
                 </div>
               )}
             </div>
          )}

          {/* ── STATS tab ── */}
          {menuTab === 'stats' && (
            <div style={{ width:'100%' }}>
              
              {/* Daily Section */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ color: '#22c55e', margin: '0 0 12px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📅 Daily Puzzle</h3>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                  {[
                    { label:'Current Streak', value: stats.dailyStreak + (stats.dailyStreak > 0 ? ' 🔥' : ''), big:true },
                    { label:'Best Streak', value: stats.bestDailyStreak },
                  ].map(({ label, value, big }) => (
                    <div key={label} style={{
                      background:'rgba(0,30,12,0.85)', border:'1px solid rgba(255,255,255,0.1)',
                      borderRadius:'14px', padding:'16px 14px', textAlign:'center',
                    }}>
                      <div style={{ fontSize: big ? '1.8rem' : '1.5rem', fontWeight:900, color:'#fff', lineHeight:1 }}>{value}</div>
                      <div style={{ fontSize:'0.68rem', color:'rgba(210,240,255,0.5)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginTop:6 }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Endless Section */}
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ color: '#7dd3fc', margin: '0 0 12px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>♾️ Endless Mode</h3>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                  {[
                    { label:'Session Streak', value: stats.streak },
                    { label:'Best Streak', value: stats.bestStreak },
                    { label:'Win Rate', value: `${winRate}%` },
                    { label:'Avg Guesses', value: avgGuesses },
                    { label:'Hint Rate', value: `${hintRate}%`, sub: hintRate > 50 ? 'You lean on hints 🤦' : hintRate > 0 ? 'Occasionally guilty' : 'Pure. Unassisted. 👏' },
                    { label:'Games Played', value: stats.gamesPlayed },
                  ].map(({ label, value, sub, big }) => (
                    <div key={label} style={{
                      background:'rgba(0,30,12,0.85)', border:'1px solid rgba(255,255,255,0.1)',
                      borderRadius:'14px', padding:'16px 14px', textAlign:'center',
                    }}>
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
                    const streakLine = stats.streak > 0 ? `🔥 ${stats.streak} game streak` : `No active streak`;
                    const statsText = [
                      `I\u2019m playing Crickle 🏏`,
                      ``,
                      streakLine,
                      `🏆 Win rate: ${stats.gamesPlayed > 0 ? Math.round(stats.wins / stats.gamesPlayed * 100) : 0}%`,
                      `🎯 Avg guesses: ${stats.wins > 0 ? (stats.totalGuesses / stats.wins).toFixed(1) : '\u2014'}`,
                      `💡 Hint rate: ${stats.gamesPlayed > 0 ? Math.round(stats.hintGames / stats.gamesPlayed * 100) : 0}%`,
                      `🎮 ${stats.gamesPlayed} games played`,
                      ``,
                      `Think you can beat that? Share yours 👇`,
                      `crickle.app`,
                    ].join('\n');
                    if (navigator.share) { try { await navigator.share({ text: statsText }); return; } catch {} }
                    try { await navigator.clipboard.writeText(statsText); alert('Copied!'); } catch {}
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
                {HOW_TO_STEPS.map(({ color, border, text, label, desc }) => (
                  <div key={label} style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                    <div style={{ width:'44px', height:'36px', borderRadius:'8px', background:color, border:`1px solid ${border}`, flexShrink:0 }} />
                    <div>
                      <div style={{ color:'#fff', fontWeight:700, fontSize:'0.85rem' }}>{label}</div>
                      <div style={{ color:'rgba(210,240,255,0.55)', fontSize:'0.78rem' }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background:'rgba(0,30,12,0.8)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'12px', padding:'14px 16px' }}>
                <p style={{ margin:'0 0 8px', fontWeight:700, fontSize:'0.85rem', color:'#fff' }}>Stats shown per guess:</p>
                <p style={{ margin:0, color:'rgba(210,240,255,0.6)', fontSize:'0.8rem', lineHeight:1.7 }}>
                  Runs · Wickets · Debut Year · Matches · Nation · Batting style · Bowling type
                </p>
              </div>
              <div style={{ background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:'12px', padding:'14px 16px', marginTop:'12px' }}>
                <p style={{ margin:0, color:'rgba(210,240,255,0.7)', fontSize:'0.8rem', lineHeight:1.7 }}>
                  💡 First hint is always free. Hints 2 and 3 require watching a short ad.
                  The more hints you use, the more the game will judge you.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  // ── Game screen ───────────────────────────────────────────────
  return (
    <div style={{
      minHeight:'100vh', color:'#ffffff',
      fontFamily:"'Outfit', 'DM Sans', system-ui, sans-serif",
      display:'flex', flexDirection:'column', alignItems:'center',
      padding:'16px 16px 60px',
      background:"url('/BG.jpg') center/cover no-repeat fixed",
      position:'relative', overflow:'hidden',
    }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,10,5,0.72)', zIndex:0 }} />
      <div style={{ position:'relative', zIndex:1, width:'100%', display:'flex', flexDirection:'column', alignItems:'center' }}>
      {renderGameHeader()}

      {/* Web Challenge Interceptor Modal */}
      {webChallengePrompt && !IS_NATIVE && (
        <div style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,15,5,0.95)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
          <div style={{ background:'rgba(0,30,10,0.9)', border:'1px solid rgba(34,197,94,0.4)', borderRadius:'24px', padding:'32px', textAlign:'center', maxWidth:'340px', width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.8)' }}>
            <div style={{ fontSize:'3rem', marginBottom:'16px' }}>🏏</div>
            <h2 style={{ margin:'0 0 8px', color:'#fff', fontSize:'1.4rem' }}>{webChallengePrompt.sender} challenged you!</h2>
            <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'0.9rem', marginBottom:'24px' }}>Get the ultimate experience in the app, or play right here in your browser.</p>
            
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              <a href="#" style={{ background:'#fff', color:'#000', padding:'14px', borderRadius:'12px', fontWeight:800, textDecoration:'none', fontSize:'0.95rem' }}>Download the App</a>
              <button onClick={() => {
                playSavedChallenge(webChallengePrompt);
                setWebChallengePrompt(null);
              }} style={{ background:'#22c55e', color:'#fff', padding:'14px', borderRadius:'12px', border:'none', fontWeight:800, cursor:'pointer', fontSize:'0.95rem' }}>Play in Browser</button>
            </div>
          </div>
        </div>
      )}

      {/* Confetti canvas */}
      {showConfetti && (
        <canvas ref={confettiRef} style={{
          position:'fixed', inset:0, pointerEvents:'none', zIndex:999,
        }} />
      )}

      {/* Name Prompt Modal */}
      {showNamePrompt && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.85)', padding:'20px' }}>
          <div style={{ background:'rgba(0,25,10,0.98)', border:'1px solid rgba(34,197,94,0.4)', borderRadius:'20px', padding:'24px', width:'100%', maxWidth:'320px', textAlign:'center' }}>
            <h3 style={{ margin:'0 0 10px', fontSize:'1.2rem', color:'#fff' }}>Who's challenging?</h3>
            <p style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.6)', marginBottom:'20px' }}>Enter a name so your friends know who is crushing them.</p>
            <input 
              autoFocus
              type="text" 
              placeholder="Your Name" 
              value={userName} 
              onChange={e => setUserName(e.target.value)}
              style={{ width:'100%', padding:'12px', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.2)', background:'rgba(0,0,0,0.3)', color:'#fff', marginBottom:'16px', boxSizing:'border-box', textAlign:'center', fontSize:'1rem' }}
            />
            <button onClick={() => {
               if(userName.trim().length > 0) {
                 localStorage.setItem('crickle_username', userName.trim());
                 setShowNamePrompt(false);
                 handleGameShare(); // Retry sharing
               }
            }} style={{ width:'100%', padding:'12px', background:'#22c55e', border:'none', borderRadius:'10px', color:'#fff', fontWeight:800, fontSize:'1rem', cursor:'pointer' }}>Save & Share</button>
          </div>
        </div>
      )}

      {/* Grand Win Overlay */}
      {game.status === 'won' && (
        <div style={{
          position:'fixed', inset:0, zIndex:200,
          display:'flex', alignItems:'center', justifyContent:'center',
          background:'rgba(0,0,0,0.75)',
          padding:'20px',
        }} onClick={() => patchGame(mode, { status: 'won_dismissed' })}>
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

            {/* H2H Scoreboard Comparison */}
            {activeChallenge && (
              <div style={{ background:'rgba(0,0,0,0.4)', borderRadius:'12px', border:'1px solid rgba(255,255,255,0.1)', padding:'14px', marginBottom:'24px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ textAlign:'left' }}>
                  <div style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.5)', textTransform:'uppercase' }}>{activeChallenge.sender}</div>
                  <div style={{ fontSize:'1.1rem', fontWeight:800, color: activeChallenge.senderScore?.won ? '#fff' : '#ef4444' }}>
                    {activeChallenge.senderScore?.won ? `${activeChallenge.senderScore.tries} tries` : 'Lost'}
                  </div>
                </div>
                <div style={{ fontSize:'0.8rem', fontWeight:800, color:'rgba(34,197,94,0.8)', fontStyle:'italic' }}>VS</div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.5)', textTransform:'uppercase' }}>You</div>
                  <div style={{ fontSize:'1.1rem', fontWeight:800, color:'#22c55e' }}>{game.guesses.length} tries</div>
                </div>
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              <button onClick={handleGameShare} style={{
                width:'100%', padding:'14px',
                background:'linear-gradient(135deg,#22c55e,#16a34a)',
                border:'none', borderRadius:'12px', color:'#fff',
                fontWeight:900, fontSize:'0.95rem', cursor:'pointer',
                boxShadow:'0 4px 20px rgba(34,197,94,0.4)',
                fontFamily:"'Outfit',system-ui,sans-serif",
              }}>📤 Challenge a Friend</button>
              <button onClick={() => { resetGame(mode); }} style={{
                width:'100%', padding:'12px',
                background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)',
                borderRadius:'12px', color:'rgba(210,240,255,0.8)',
                fontWeight:800, fontSize:'0.88rem', cursor:'pointer',
                fontFamily:"'Outfit',system-ui,sans-serif",
              }}>🎮 New Game</button>
              <button onClick={() => patchGame(mode, { status: 'won_dismissed' })} style={{
                background:'none', border:'none', color:'rgba(210,240,255,0.35)',
                fontSize:'0.75rem', cursor:'pointer', padding:'4px',
                fontFamily:"'Outfit',system-ui,sans-serif",
              }}>See board</button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over (lost) banner */}
      {game.status === 'lost' && (
        <div style={{
          width:'100%', maxWidth:'480px',
          background:'rgba(185,28,28,0.12)',
          border:'1px solid rgba(239,68,68,0.3)',
          borderRadius:'14px', padding:'18px 20px',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          marginBottom:'20px',
        }}>
          <div>
            <div style={{ fontWeight:800, fontSize:'0.95rem', color:'#fff' }}>💀 Better luck next time.</div>
            <div style={{ fontSize:'0.78rem', color:'rgba(210,240,255,0.6)', marginTop:2 }}>
              The answer was {game.target.name}
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={handleGameShare} style={{
              background:'rgba(34,197,94,0.2)', border:'1px solid rgba(34,197,94,0.4)',
              borderRadius:'8px', padding:'8px 14px',
              color:'#22c55e', fontWeight:800, fontSize:'0.8rem', cursor:'pointer',
            }}>📤 Share</button>
            <button onClick={() => resetGame(mode)} style={{
              background:'#22c55e', color:'#fff', border:'none',
              borderRadius:'8px', padding:'8px 14px',
              fontWeight:800, cursor:'pointer', fontSize:'0.8rem',
              boxShadow:'0 0 12px rgba(34,197,94,0.3)',
            }}>New Game</button>
          </div>
        </div>
      )}

      {/* Won-dismissed compact bar */}
      {game.status === 'won_dismissed' && (
        <div style={{
          width:'100%', maxWidth:'480px',
          background:'rgba(22,163,74,0.12)',
          border:'1px solid rgba(34,197,94,0.3)',
          borderRadius:'14px', padding:'14px 20px',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          marginBottom:'20px',
        }}>
          <div>
            <div style={{ fontWeight:800, fontSize:'0.9rem', color:'#22c55e' }}>✅ {game.target.name}</div>
            <div style={{ fontSize:'0.75rem', color:'rgba(210,240,255,0.5)', marginTop:2 }}>
              {game.guesses.length}/8 {game.hintsUsed > 0 ? `· ${game.hintsUsed} hint${game.hintsUsed > 1 ? 's' : ''}` : ''}
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={handleGameShare} style={{
              background:'rgba(34,197,94,0.2)', border:'1px solid rgba(34,197,94,0.4)',
              borderRadius:'8px', padding:'8px 14px',
              color:'#22c55e', fontWeight:800, fontSize:'0.8rem', cursor:'pointer',
            }}>📤 Share</button>
            <button onClick={() => resetGame(mode)} style={{
              background:'#22c55e', color:'#fff', border:'none',
              borderRadius:'8px', padding:'8px 14px',
              fontWeight:800, cursor:'pointer', fontSize:'0.8rem',
            }}>New Game</button>
          </div>
        </div>
      )}

      {/* Info bar — legend + guess counter */}
      <div style={{ width:'100%', maxWidth:'480px', marginBottom:'10px' }}>
        {/* Guess counter */}
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'center',
          marginBottom:'8px',
        }}>
          <span style={{ color:'rgba(210,240,255,0.92)', fontSize:'0.8rem', fontWeight:600 }}>
            {activeChallenge ? `Beat ${activeChallenge.sender}'s Score` : `Guess the ${mode} Cricketer`}
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
        {/* Legend */}
        <div style={{
          display:'flex', gap:'6px', flexWrap:'wrap',
          padding:'8px 12px',
          background:'rgba(0,30,10,0.9)',
          border:'1px solid rgba(255,255,255,0.15)',
          borderRadius:'8px',
        }}>
          {[
            { bg:'#14532d', border:'#16a34a', color:'#86efac', label:'Exact match' },
            { bg:'#713f12', border:'#d97706', color:'#fde68a', label:'Close — ↑ higher  ↓ lower' },
            { bg:'#1e2025', border:'#35373f', color:'#9ca3af', label:'No match' },
          ].map(({bg,border,color,label}) => (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:'5px' }}>
              <div style={{
                width:'16px', height:'16px', borderRadius:'4px', flexShrink:0,
                background:bg, border:`1px solid ${border}`,
              }}/>
              <span style={{ fontSize:'0.7rem', color:'rgba(210,240,255,0.92)', whiteSpace:'nowrap' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div style={{ position:'relative', width:'100%', maxWidth:'480px', marginBottom:'12px', zIndex:30 }}>
        <input
          type="text"
          placeholder={game.status !== 'playing' ? 'Game over — start a new game' : 'Search for a player…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
                style={{
                  padding:'11px 16px', cursor:'pointer',
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  borderBottom: i < suggestions.length - 1 ? '1px solid #0f172a' : 'none',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontWeight:700, fontSize:'0.9rem' }}>{p.name}</span>
                <span style={{ fontSize:'0.72rem', background:'rgba(0,25,10,0.7)', color:'rgba(200,230,255,0.8)', padding:'3px 8px', borderRadius:'6px' }}>
                  {p.nation}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hints dropdown + Give Up row */}
      {(game.status === 'playing' || game.status === 'won_dismissed') && game.status === 'playing' && (
        <div style={{ width:'100%', maxWidth:'480px', marginBottom:'12px', position:'relative', zIndex:25 }}>
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>

            {/* Hint toggle button */}
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

              {/* Dropdown panel */}
              {showHintDrop && (
                <div style={{
                  position:'absolute', top:'calc(100% + 6px)', left:0, right:0,
                  background:'rgba(0,18,8,0.97)', border:'1px solid rgba(255,255,255,0.15)',
                  borderRadius:'12px', padding:'14px',
                  boxShadow:'0 16px 40px rgba(0,0,0,0.8)',
                }}>
                  {/* Insult callout */}
                  {game.revealBanner && (
                    <div style={{
                      background:'rgba(120,0,0,0.5)', borderLeft:'3px solid #ef4444',
                      borderRadius:'0 8px 8px 0', padding:'8px 12px', marginBottom:'10px',
                    }}>
                      <p style={{ margin:0, fontSize:'0.78rem', fontWeight:700, fontStyle:'italic', color:'#f87171', lineHeight:1.4 }}>
                        {game.revealBanner}
                      </p>
                    </div>
                  )}

                  {/* Revealed hints */}
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

                  {/* Next hint button */}
                  {game.hintsUsed < 3 && (
                    <button onClick={() => { requestHint(); }} style={{
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

            {/* Give Up button */}
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
          /* ── MOBILE: each guess is a card with labeled stat rows ── */
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {game.guesses.map((g, ri) => (
              <div key={ri} style={{
                background:'rgba(0,35,12,0.93)', border:'1px solid rgba(255,255,255,0.22)',
                borderRadius:'14px', overflow:'hidden',
              }}>
                {/* Card header — player name */}
                <div style={{
                  padding:'10px 14px',
                  borderBottom:'1px solid #071c30',
                  fontWeight:800, fontSize:'0.9rem', color:'#ffffff',
                  background:'rgba(255,255,255,0.05)',
                }}>
                  {g.name}
                </div>
                {/* Stat rows: label on left, colored value on right */}
                <div style={{ padding:'8px 10px', display:'flex', flexDirection:'column', gap:'5px' }}>
                  {cols.map(({ key, label }) => {
                    const gVal   = g[key];
                    const tVal   = game.target[key];
                    const colors = boxColor(key, gVal, tVal, g, game.target);
                    const arr    = arrowFor(key, gVal, tVal, g, game.target);
                    return (
                      <div key={key} style={{
                        display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px',
                      }}>
                        <span style={{
                          fontSize:'0.72rem', fontWeight:600,
                          textTransform:'uppercase', letterSpacing:'0.06em',
                          color:'rgba(210,240,255,0.92)', flexShrink:0,
                        }}>
                          {label}
                        </span>
                        <div style={{
                          background: colors.bg,
                          border: `1px solid ${colors.border}`,
                          borderRadius:'6px',
                          padding:'3px 10px',
                          fontSize:'0.8rem', fontWeight:700,
                          color: colors.color,
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

            {/* Remaining guess placeholders */}
            {game.status === 'playing' && Array.from({ length: MAX_GUESSES - game.guesses.length }).map((_, i) => (
              <div key={`e${i}`} style={{
                height:'44px', background:'rgba(0,25,10,0.92)', border:'1px solid rgba(255,255,255,0.12)',
                borderRadius:'12px', opacity:0.2,
              }} />
            ))}
          </div>

        ) : (
          /* ── DESKTOP: classic centered table layout ── */
          (() => {
            const nameW  = 176;
            const colW   = 86;
            const gap    = 6;
            const rowH   = 46;
            const totalW = nameW + cols.length * colW + cols.length * gap;

            const Row = ({ children, faded }) => (
              <div style={{
                display:'flex', gap:`${gap}px`,
                width: totalW, margin:`0 auto 5px`,
                opacity: faded ? 0.55 : 1,
              }}>
                {children}
              </div>
            );

            return (
              <div>
                {/* Headers */}
                {game.guesses.length > 0 && (
                  <div style={{
                    display:'flex', gap:`${gap}px`,
                    width: totalW, margin:'0 auto 6px',
                    fontSize:'0.65rem', fontWeight:700,
                    textTransform:'uppercase', letterSpacing:'0.07em', color:'rgba(255,255,255,0.5)',
                  }}>
                    <div style={{ width:nameW, flexShrink:0 }}>Name</div>
                    {cols.map((c) => (
                      <div key={c.key} style={{ width:colW, flexShrink:0, textAlign:'center' }}>
                        {c.label}
                      </div>
                    ))}
                  </div>
                )}

                {game.guesses.map((g, ri) => (
                  <Row key={ri}>
                    <div style={{
                      width:nameW, flexShrink:0,
                      background:'rgba(0,35,12,0.93)', border:'1px solid rgba(255,255,255,0.22)',
                      borderRadius:'8px', padding:'0 12px', height:rowH,
                      display:'flex', alignItems:'center',
                      fontWeight:700, fontSize:'0.82rem',
                      overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
                    }}>
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
                          borderRadius:'8px',
                          display:'flex', alignItems:'center', justifyContent:'center',
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
                    {cols.map((c) => (
                      <div key={c.key} style={{ width:colW, flexShrink:0, height:rowH, background:'rgba(0,35,12,0.92)', border:'1px solid rgba(255,255,255,0.22)', borderRadius:'8px' }} />
                    ))}
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