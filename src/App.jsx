import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AdMob, InterstitialAdPluginEvents } from '@capacitor-community/admob';
import { App as CapApp } from '@capacitor/app';
import { Share } from '@capacitor/share';
import { initializeApp as initFirebase } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithCredential, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import testPlayersRaw from './testplayers.json';
import odiPlayersRaw from './odiplayers.json';
import t20PlayersRaw from './t20players.json';

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDTAe0i-2WoHS_hXyB-opHilVPhLcPuwIY",
  authDomain: "crickle-1b6a7.firebaseapp.com",
  projectId: "crickle-1b6a7",
  storageBucket: "crickle-1b6a7.firebasestorage.app",
  messagingSenderId: "760750442981",
  appId: "1:760750442981:web:eea06347644f171ce8470c"
};
const firebaseApp = initFirebase(FIREBASE_CONFIG);
const firebaseAuth = getAuth(firebaseApp);

const H2H_API             = '/api/h2h/challenge';
const FRIENDS_API         = '/api/h2h/friends';
const CHALLENGE_NEW_API   = '/api/h2h/challenge-new';
const CHALLENGE_SUBMIT_API = '/api/h2h/challenge-submit';

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
  { btnLabel: '💡 Use Free Hint', revealInsults: HINT1_REVEAL_INSULTS, color: '#60a5fa', dimColor: 'rgba(59,130,246,0.12)', borderColor: 'rgba(59,130,246,0.35)' },
  { btnLabel: '📺 Watch Ad · Hint 2', revealInsults: HINT2_REVEAL_INSULTS, color: '#fb923c', dimColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.35)' },
  { btnLabel: '📺 Watch Ad · Hint 3', revealInsults: HINT3_REVEAL_INSULTS, color: '#f87171', dimColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.35)' },
];

// ── Time & Daily Helpers ──
const getDaysSinceEpoch = () => {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return Math.floor(ist.getTime() / 86400000);
};
const getTodayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

// ── Stats helpers ──
const STATS_KEY = 'crickle_stats_v2';
const defaultStats = () => ({
  streak:0, bestStreak:0,
  hintlessStreak:0, bestHintlessStreak:0,
  dailyStreak:0, bestDailyStreak:0,
  dailyHintlessStreak:0, bestDailyHintlessStreak:0,
  gamesPlayed:0, wins:0, totalGuesses:0, totalHints:0, hintGames:0,
  perfectGames:0, bestGuesses:null,
});
const loadStats = () => {
  try {
    const v2 = localStorage.getItem('crickle_stats_v2');
    const v1 = localStorage.getItem('crickle_stats_v1');
    return { ...defaultStats(), ...JSON.parse(v2 || v1 || '{}') };
  } catch { return defaultStats(); }
};
const saveStats = (s) => { try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch {} };
const updateStats = (prev, { won, guesses, hintsUsed, isDaily }) => {
  const next = { ...prev };

  if (isDaily) {
    // Daily stats are completely separate — never touch endless counters
    if (won) {
      next.dailyStreak = (next.dailyStreak || 0) + 1;
      next.bestDailyStreak = Math.max(next.bestDailyStreak || 0, next.dailyStreak);
      if (hintsUsed === 0) {
        next.dailyHintlessStreak = (next.dailyHintlessStreak || 0) + 1;
        next.bestDailyHintlessStreak = Math.max(next.bestDailyHintlessStreak || 0, next.dailyHintlessStreak);
      } else {
        next.dailyHintlessStreak = 0;
      }
    } else {
      next.dailyStreak = 0;
      next.dailyHintlessStreak = 0;
    }
    return next;
  }

  // ── Endless-only stats ──
  next.gamesPlayed += 1;
  if (won) {
    next.wins += 1;
    next.streak += 1;
    next.bestStreak = Math.max(next.bestStreak, next.streak);
    next.totalGuesses += guesses;
    next.bestGuesses = next.bestGuesses === null ? guesses : Math.min(next.bestGuesses, guesses);
    if (guesses === 1) next.perfectGames = (next.perfectGames || 0) + 1;
    if (hintsUsed === 0) {
      next.hintlessStreak = (next.hintlessStreak || 0) + 1;
      next.bestHintlessStreak = Math.max(next.bestHintlessStreak || 0, next.hintlessStreak);
    } else {
      next.hintlessStreak = 0;
    }
  } else {
    next.streak = 0;
    next.hintlessStreak = 0;
  }
  if (hintsUsed > 0) { next.totalHints += hintsUsed; next.hintGames += 1; }
  return next;
};

// ── H2H Obfuscation ──
const encodeH2H = (name, tries, hints, won) => btoa(encodeURIComponent(`2:${name}:${tries}:${hints}:${won?1:0}`));
const decodeH2H = (str) => {
  try {
    const parts = decodeURIComponent(atob(str)).split(':');
    if (parts[0] === '2') {
      const [, name, tries, hints, won] = parts;
      return { name, tries: parseInt(tries, 10), hints: parseInt(hints, 10), won: won === '1' };
    }
    if (parts[0] === '1') {
      const [, name, tries, won] = parts;
      return { name, tries: parseInt(tries, 10), hints: 0, won: won === '1' };
    }
    return null;
  } catch { return null; }
};

// won > gave up. Among both won: fewer hints > fewer tries. Both gave up = draw.
const getH2HWinner = (myScore, theirScore, myName, theirName) => {
  if (!myScore || !theirScore) return null;
  if (myScore.won && !theirScore.won)  return myName;
  if (!myScore.won && theirScore.won)  return theirName;
  if (!myScore.won && !theirScore.won) return 'draw';
  const myH = myScore.hints ?? 0;
  const thH = theirScore.hints ?? 0;
  if (myH < thH) return myName;
  if (thH < myH) return theirName;
  if (myScore.tries < theirScore.tries) return myName;
  if (theirScore.tries < myScore.tries) return theirName;
  return 'draw';
};

// Format a score for display — shows tries+hints even on gave up
const formatScore = (score) => {
  if (!score) return '?';
  if (score.won) return `${score.tries} ${score.tries === 1 ? 'try' : 'tries'} · ${score.hints ?? 0} hint${(score.hints ?? 0) !== 1 ? 's' : ''}`;
  const t = score.tries ?? 0;
  const h = score.hints ?? 0;
  if (t === 0) return 'gave up';
  return `gave up (${t} ${t === 1 ? 'try' : 'tries'} · ${h} hint${h !== 1 ? 's' : ''})`;
};
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
    .map((p) => {
      const isFlat = p.player_name !== undefined || p.hints !== undefined;
      const fmt    = isFlat ? null : p.formats?.[fmtKey];

      const runsRaw    = isFlat ? p.runs    : fmt?.runs;
      const wicketsRaw = isFlat ? p.wickets : fmt?.wickets;
      const runs    = runsRaw    != null && runsRaw    !== '' ? parseInt(runsRaw,    10) : null;
      const wickets = wicketsRaw != null && wicketsRaw !== '' ? parseInt(wicketsRaw, 10) : null;

      return {
        name:      isFlat ? p.player_name : p.name,
        nation:    p.nation ? p.nation.split('/')[0] : 'UNK',
        batting:   isFlat ? (p.batsman_type  ?? '-') : (p.battingStyle ?? '-'),
        bowling:   isFlat ? (p.bowling_type  ?? '-') : normBowl(p.bowlingStyle ?? 'None'),
        debutYear: isFlat ? (parseInt(p.debut_year, 10) || null) : (fmt?.debutYear ?? null),
        matches:   isFlat ? (p.matches != null && p.matches !== '' ? parseInt(p.matches, 10) : null) : (fmt?.matches ?? null),
        runs:        runs,
        wickets:     wickets,
        keyStat:     runs    != null ? runs    : wickets != null ? wickets : null,
        keyStatType: runs    != null ? 'runs'  : wickets != null ? 'wickets' : null,
        tier:      isFlat ? (p._tier || p.tier || 1) : (fmt?.tier || p.tier || p._tier || 1),
        trivia: isFlat
          ? { hint1: p.hints?.[0] ?? '', hint2: p.hints?.[1] ?? '', hint3: p.hints?.[2] ?? '' }
          : { hint1: p.trivia?.hint1 ?? '', hint2: p.trivia?.hint2 ?? '', hint3: p.trivia?.hint3 ?? '' },
      };
    })
    .filter((p) => {
      const nat = p.nation || '';
      const isAllowed = nat.length > 0 && nat.split('/').some(n => ALLOWED_NATIONS.has(n));
      if (!isAllowed) return false;
      
      const t = String(p.tier);
      if (t === '1') return true; 
      if (mode === 'Test' && p.debutYear && p.debutYear <= 1980) return false;
      if (mode === 'ODI' && p.debutYear && p.debutYear <= 1990) return false;
      return true;
    });
};

const POOL = {
  Test: normalizePlayers(testPlayersRaw, 'Test'),
  ODI:  normalizePlayers(odiPlayersRaw,  'ODI'),
  T20:  normalizePlayers(t20PlayersRaw,  'T20'),
};

// Deduplicated tier-1/2 players from all formats — used for Easy mode
const _easyNames = new Set();
const EASY_POOL = [
  ...POOL.Test.filter(p => ['1','2'].includes(String(p.tier))).map(p => ({ ...p, easyFormat: 'Test' })),
  ...POOL.ODI.filter(p  => ['1','2'].includes(String(p.tier))).map(p => ({ ...p, easyFormat: 'ODI' })),
  ...POOL.T20.filter(p  => ['1','2'].includes(String(p.tier))).map(p => ({ ...p, easyFormat: 'T20' })),
].filter(p => { if (_easyNames.has(p.name)) return false; _easyNames.add(p.name); return true; });

const getDailyPlayer = (format) => {
  const pool = POOL[format];
  return pool[getDaysSinceEpoch() % pool.length];
};

const freshGameState = (format, isDaily = false, isEasy = false) => {
  const pool = POOL[format];
  let targetPool = pool;
  if (isEasy) {
    targetPool = pool.filter(p => String(p.tier) === '1' || String(p.tier) === '2');
    if (!targetPool.length) targetPool = pool;
  }
  if (!pool.length) return null;
  return {
    target:       isDaily ? getDailyPlayer(format) : targetPool[Math.floor(Math.random() * targetPool.length)],
    guesses:      [],
    status:       'playing',
    hintsUsed:    0,
    revealBanner: null,
    isDaily:      isDaily,
    isEasy:       isEasy,
  };
};

const freshEasyGame = () => {
  const target = EASY_POOL[Math.floor(Math.random() * EASY_POOL.length)];
  return { target, guesses: [], status: 'playing', hintsUsed: 0, revealBanner: null,
           isDaily: false, isEasy: true, isH2H: false, format: target.easyFormat };
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

  const [games, setGames] = useState(() => {
    let savedDaily = null;
    const dMode = ['Test', 'ODI', 'T20'][getDaysSinceEpoch() % 3];
    try {
      const saved = JSON.parse(localStorage.getItem('crickle_daily_state_v2'));
      if (saved && saved.date === getTodayKey()) savedDaily = saved.game;
    } catch {}

    // Restore in-progress endless games
    let savedEndless = {};
    try {
      savedEndless = JSON.parse(localStorage.getItem('crickle_endless_state_v1') || '{}');
    } catch {}
    const restoreOrFresh = (format) => {
      const s = savedEndless[format];
      if (s && s.status === 'playing' && s.guesses?.length > 0 && s.target) return s;
      return freshGameState(format, false);
    };

    return {
      Test: restoreOrFresh('Test'),
      ODI:  restoreOrFresh('ODI'),
      T20:  restoreOrFresh('T20'),
      Easy:  freshEasyGame(),
      H2H:   null,
      Daily: savedDaily || freshGameState(dMode, true)
    };
  });

  const [activeTab, setActiveTab] = useState('endless'); 
  const [mode,   setMode]   = useState('Test');
  const [search, setSearch] = useState('');

  const [stats,          setStats]          = useState(loadStats);
  const [screen,         setScreen]         = useState('menu');
  const [menuTab,        setMenuTab]        = useState('play');
  const [playFlow,       setPlayFlow]       = useState('main'); 
  const [showHintDrop,   setShowHintDrop]   = useState(false);
  const adListenerRef = useRef(null);

  const [userName, setUserName] = useState(() => { try { return localStorage.getItem('crickle_username') || ''; } catch { return ''; } });
  const [savedChallenges, setSavedChallenges] = useState(() => { try { return JSON.parse(localStorage.getItem('crickle_challenges') || '[]'); } catch { return []; } });
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [webChallengePrompt, setWebChallengePrompt] = useState(null);
  const [rivalryView, setRivalryView] = useState(null);
  const [rivalryTab, setRivalryTab] = useState('open');
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [serverChallenges, setServerChallenges] = useState([]);

  const dMode = ['Test', 'ODI', 'T20'][getDaysSinceEpoch() % 3];
  const displayMode = activeTab === 'daily' ? dMode
    : activeTab === 'h2h'  ? (games.H2H?.format  || 'Test')
    : activeTab === 'easy' ? (games.Easy?.format || 'Test')
    : mode;
  const game = activeTab === 'daily' ? games.Daily
    : activeTab === 'easy' ? games.Easy
    : activeTab === 'h2h'  ? games.H2H
    : games[mode];

  useEffect(() => {
    if (!IS_NATIVE) return;
    const init = async () => {
      try {
        await AdMob.initialize({ initializeForTesting: false });
        await AdMob.prepareInterstitial({ adId: AD_UNIT_ID });
      } catch (e) {}
    };
    init();
  }, []);

  // ── Firebase Auth ──
  const fetchServerChallenges = useCallback(async (uid) => {
    try {
      const res = await fetch(`${H2H_API}?uid=${encodeURIComponent(uid)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setServerChallenges(data);
    } catch {}
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      setAuthUser(user);
      setAuthLoading(false);
      if (user) {
        if (!localStorage.getItem('crickle_username') && user.displayName) {
          setUserName(user.displayName);
          localStorage.setItem('crickle_username', user.displayName);
        }
        fetchServerChallenges(user.uid);
      } else {
        setServerChallenges([]);
      }
    });
    // Handle redirect result on page load (web sign-in)
    if (!IS_NATIVE) {
      getRedirectResult(firebaseAuth).catch(() => {});
    }
    return () => unsub();
  }, [fetchServerChallenges]);

  const [signingIn, setSigningIn]   = useState(false);

  // ── H2H friends + challenges state ──
  const [friends,          setFriends]          = useState([]);
  const [h2hChallenges,    setH2hChallenges]    = useState([]);
  const [h2hRivalryView,   setH2hRivalryView]   = useState(null);
  const [activeH2HChallenge, setActiveH2HChallenge] = useState(null);

  const fetchFriends = useCallback(async (uid) => {
    try {
      const res = await fetch(`${FRIENDS_API}?uid=${encodeURIComponent(uid)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setFriends(data.filter(f => f.status === 'friends'));
    } catch {}
  }, []);

  const fetchH2HChallenges = useCallback(async (uid) => {
    try {
      const res = await fetch(`${CHALLENGE_NEW_API}?uid=${encodeURIComponent(uid)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setH2hChallenges(data);
    } catch {}
  }, []);

  // Refresh H2H data when tab opened
  useEffect(() => {
    if (menuTab === 'challenges' && authUser) {
      fetchFriends(authUser.uid);
      fetchH2HChallenges(authUser.uid);
      fetchServerChallenges(authUser.uid);
    }
  }, [menuTab, authUser, fetchFriends, fetchH2HChallenges, fetchServerChallenges]);

  // Supabase realtime — instant updates when challenges/friendships change
  // Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
  useEffect(() => {
    if (!authUser) return;
    let cleanup;
    const setupRealtime = async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const sb = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY
        );
        const uid = authUser.uid;
        const channel = sb.channel('h2h-realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'crickle_challenges',   filter: `sender_uid=eq.${uid}` },   () => fetchH2HChallenges(uid))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'crickle_challenges',   filter: `receiver_uid=eq.${uid}` }, () => fetchH2HChallenges(uid))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'crickle_friendships',  filter: `user_a_uid=eq.${uid}` },   () => fetchFriends(uid))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'crickle_friendships',  filter: `user_b_uid=eq.${uid}` },   () => fetchFriends(uid))
          .subscribe();
        cleanup = () => sb.removeChannel(channel);
      } catch {}
    };
    setupRealtime();
    return () => { cleanup?.(); };
  }, [authUser, fetchFriends, fetchH2HChallenges]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      if (IS_NATIVE) {
        try {
          const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
          const result = await FirebaseAuthentication.signInWithGoogle();
          const idToken = result.credential?.idToken;
          if (!idToken) throw new Error('No idToken from native plugin');
          const credential = GoogleAuthProvider.credential(idToken);
          await signInWithCredential(firebaseAuth, credential);
        } catch (nativeErr) {
          console.warn('Native Google sign-in failed, trying web popup:', nativeErr);
          const provider = new GoogleAuthProvider();
          await signInWithPopup(firebaseAuth, provider);
        }
      } else {
        const provider = new GoogleAuthProvider();
        try {
          await signInWithPopup(firebaseAuth, provider);
        } catch (popupErr) {
          // User dismissed the popup — silent cancel, do NOT redirect
          const silentCodes = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'];
          if (silentCodes.includes(popupErr?.code) || popupErr?.message?.toLowerCase().includes('cancel')) {
            pendingShareRef.current = false; // clear pending share if they bailed
            return;
          }
          // Only redirect if popup was actually blocked by the browser
          if (popupErr?.code === 'auth/popup-blocked') {
            await signInWithRedirect(firebaseAuth, provider);
          } else {
            console.error('Sign in error', popupErr);
          }
        }
      }
    } catch (e) {
      console.error('Sign in error', e);
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await firebaseSignOut(firebaseAuth);
    setServerChallenges([]);
  };

  const postChallengeToServer = useCallback(async (challengeData) => {
    if (!authUser) return;
    try {
      await fetch(H2H_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(challengeData),
      });
      fetchServerChallenges(authUser.uid);
    } catch {}
  }, [authUser, fetchServerChallenges]);

  const patchGame = useCallback((patch) => {
    setGames((prev) => {
      const targetKey = activeTab === 'daily' ? 'Daily' : activeTab === 'easy' ? 'Easy' : activeTab === 'h2h' ? 'H2H' : mode;
      return { ...prev, [targetKey]: { ...prev[targetKey], ...patch } };
    });
  }, [activeTab, mode]);

  const resetGame = useCallback(() => {
    setActiveH2HChallenge(null);
    setGames((prev) => {
      if (activeTab === 'easy') return { ...prev, Easy: freshEasyGame() };
      if (activeTab === 'h2h')  return { ...prev, H2H: null };
      const targetKey    = activeTab === 'daily' ? 'Daily' : mode;
      const targetFormat = activeTab === 'daily' ? dMode : mode;
      return { ...prev, [targetKey]: freshGameState(targetFormat, activeTab === 'daily') };
    });
    setSearch('');
  }, [activeTab, mode, dMode]);

  // Sync storage
  useEffect(() => { try { localStorage.setItem('crickle_challenges', JSON.stringify(savedChallenges)); } catch {} }, [savedChallenges]);
  
  // Persist endless game states (so in-progress guesses survive app close)
  useEffect(() => {
    try {
      const endless = { Test: games.Test, ODI: games.ODI, T20: games.T20 };
      localStorage.setItem('crickle_endless_state_v1', JSON.stringify(endless));
    } catch {}
  }, [games.Test, games.ODI, games.T20]);
  
  // Persist Daily Game State strictly
  useEffect(() => {
    if (games.Daily) {
      localStorage.setItem('crickle_daily_state_v2', JSON.stringify({ date: getTodayKey(), game: games.Daily }));
    }
  }, [games.Daily]);

  // Deep link parsing — friend requests (?fr=token) and H2H challenges (?h2h=id)
  useEffect(() => {
    const tryFriendRequest = async (urlString) => {
      try {
        const search = urlString.includes('?') ? urlString.slice(urlString.indexOf('?')) : urlString;
        const params = new URLSearchParams(search);
        const frToken = params.get('fr');
        const h2hId   = params.get('h2h');

        if (frToken && authUser) {
          // Accept friend request
          const res = await fetch(FRIENDS_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'accept', token: frToken, receiver_uid: authUser.uid, receiver_name: authUser.displayName || userName }),
          });
          if (res.ok) {
            fetchFriends(authUser.uid);
            setMenuTab('challenges');
            setScreen('menu');
          }
          if (!IS_NATIVE && typeof window !== 'undefined' && window.location.search) {
            window.history.replaceState({}, '', window.location.pathname);
          }
        }

        if (h2hId) {
          // Navigate to H2H tab showing the challenge
          setMenuTab('challenges');
          setScreen('menu');
          if (!IS_NATIVE && typeof window !== 'undefined' && window.location.search) {
            window.history.replaceState({}, '', window.location.pathname);
          }
        }
      } catch {}
    };

    if (typeof window !== 'undefined' && window.location.search) {
      tryFriendRequest(window.location.search);
    }
    let urlListener;
    if (IS_NATIVE) {
      CapApp.addListener('appUrlOpen', (data) => {
        if (data?.url) tryFriendRequest(data.url);
      }).then(l => { urlListener = l; }).catch(() => {});
    }
    return () => { urlListener?.remove(); };
  }, [authUser, userName, fetchFriends]);

  const handleDailyStart = () => {
    setActiveTab('daily');
    setScreen('game');
  };

  // Deep link parsing — old ?c= challenge links (kept for backwards compat)
  useEffect(() => {
    const tryChallenge = (urlString) => {
      try {
        const search = urlString.includes('?') ? urlString.slice(urlString.indexOf('?')) : urlString;
        const params = new URLSearchParams(search);
        const code = params.get('c');
        const xParam = params.get('x');
        const mParam = params.get('m');
        const sourceMode = mParam === 'd' ? 'Daily' : mParam === 'e' ? 'Endless' : '';
        if (!code) return;

        const decoded = decodeChallenge(code);
        if (!decoded) return;
        const { mode: cMode, player } = decoded;

        let incomingScore = null;
        let incomingName = 'A friend';
        if (xParam) {
          incomingScore = decodeH2H(xParam);
          if (incomingScore) incomingName = incomingScore.name;
        }

        // Clear URL params so refresh doesn't re-trigger
        if (!IS_NATIVE && typeof window !== 'undefined' && window.location.search) {
          window.history.replaceState({}, '', window.location.pathname);
        }

        setSavedChallenges(prev => {
          // Check if this is a return result for an outgoing challenge I sent
          const outgoing = prev.find(c => c.code === code && c.outgoing === true);
          if (outgoing && incomingName !== outgoing.sender) {
            // This is Dhruv responding to Manan's challenge — update receiver score
            return prev.map(c =>
              c.id === outgoing.id
                ? { ...c, status: 'returned', receiverName: incomingName, receiverScore: incomingScore }
                : c
            );
            // No popup needed — it's just a stats update
          }

          // Incoming challenge — check not already added or already completed
          const existing = prev.find(c => c.code === code && c.sender === incomingName);
          if (existing) {
            // Don't re-add, but if pending show prompt again on native
            // On web: don't re-show if already completed
            if (existing.status === 'completed' || existing.status === 'pending') return prev;
            return prev;
          }

          const newChall = {
            id: Date.now(), sender: incomingName, senderScore: incomingScore,
            mode: cMode, code, status: 'pending', targetPlayer: player.name,
            outgoing: false,
            sourceMode,
          };
          return [newChall, ...prev];
        });

        // Show prompt only for new incoming challenges (not return results, not already completed)
        setSavedChallenges(prev => {
          const outgoing = prev.find(c => c.code === code && c.outgoing === true);
          if (outgoing) return prev; // return result, no prompt

          const existing = prev.find(c => c.code === code && c.sender === incomingName);
          if (!existing || existing.status === 'completed') return prev;

          if (!IS_NATIVE) {
            setWebChallengePrompt(existing);
            setScreen('game');
          } else {
            setMenuTab('challenges');
            setScreen('menu');
          }
          return prev;
        });

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

  // ── Native Android back button ──
  useEffect(() => {
    if (!IS_NATIVE) return;
    let listener;
    CapApp.addListener('backButton', () => {
      if (screen === 'game') {
        setShowHintDrop(false);
        setScreen('menu');
        setPlayFlow('main');
      } else {
        CapApp.exitApp();
      }
    }).then(l => { listener = l; }).catch(() => {});
    return () => { listener?.remove(); };
  }, [screen]);

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
  useEffect(() => { if (!showHintDrop) setShowHintWarning(false); }, [showHintDrop]);
  // Redirect to menu if we land on game screen with no game (e.g. H2H not started)
  useEffect(() => {
    if (screen === 'game' && !game) {
      setScreen('menu');
      setMenuTab('challenges');
    }
  }, [screen, game]);

  const revealHint = useCallback((idx) => {
    patchGame({
      hintsUsed:    idx + 1,
      revealBanner: pickRandom(HINTS[idx].revealInsults),
    });
    if (IS_NATIVE) {
      AdMob.prepareInterstitial({ adId: AD_UNIT_ID }).catch(() => {});
    }
  }, [patchGame]);

  const [showShareAuthPrompt, setShowShareAuthPrompt] = useState(false);
  const pendingShareRef = useRef(false);

  // Auto-fire share once auth state lands after signing in from share prompt
  useEffect(() => {
    if (authUser && pendingShareRef.current) {
      pendingShareRef.current = false;
      setShowShareAuthPrompt(false);
      handleGameShare();
    }
  }, [authUser]);

  const handleGameShare = useCallback(async () => {
    if (!game) return;
    // Require Google sign-in so the share message says their real name
    if (!authUser) {
      setShowShareAuthPrompt(true);
      return;
    }

    const displayName = authUser.displayName || userName || 'A Crickle player';
    const won   = game.status === 'won' || game.status === 'won_dismissed';
    const tries = game.guesses.length;

    const code = (() => {
      const pool = POOL[displayMode];
      const idx  = pool.findIndex(p => p.name === game.target.name);
      if (idx < 0) return null;
      const pfx  = displayMode === 'Test' ? 'TE' : displayMode === 'ODI' ? 'OD' : 'T2';
      return pfx + String(idx).padStart(4, '0');
    })();

    const BASE     = 'https://crickle-game.vercel.app';
    const h2h      = code ? encodeH2H(displayName, tries, game.hintsUsed, won) : null;
    const sourceModeStr = game.isDaily ? 'd' : 'e';
    const shareUrl = code ? `${BASE}/?c=${code}&x=${h2h}&m=${sourceModeStr}` : BASE;

    const hintsStr = game.hintsUsed === 0
      ? '0 hints'
      : `${game.hintsUsed} hint${game.hintsUsed > 1 ? 's' : ''}`;
    const triesStr = won
      ? `${tries} ${tries === 1 ? 'try' : 'tries'}`
      : 'gave up';

    let text;
    if (activeChallenge) {
      const theirResult = formatScore(activeChallenge.senderScore);
      text = won
        ? `I beat ${activeChallenge.sender}'s Crickle challenge 🏏\nThey ${theirResult}. I got it in ${triesStr} with ${hintsStr}.\nThink you can beat both of us? Bet you can't.`
        : `I tried ${activeChallenge.sender}'s Crickle challenge 🏏\nThey ${theirResult}. I ${triesStr}.\nBet you can't get it either.`;
    } else if (game.isDaily) {
      text = won
        ? `Try today's daily mode, I guessed it in ${tries} tries with ${game.hintsUsed} hints.`
        : `Try today's daily mode, I gave up on this one.`;
    } else {
      text = won
        ? `I'm playing Crickle 🏏 — the cricket Wordle.\nI guessed this player in ${triesStr} with ${hintsStr}. Can you do better? Bet you can't.`
        : `I'm playing Crickle 🏏 — the cricket Wordle.\nI gave up on this one. Think you can get it?`;
    }

    if (IS_NATIVE) {
      try {
        await Share.share({ title: 'Crickle 🏏', text: text + '\n' + shareUrl, dialogTitle: 'Challenge a friend' });
        // Save outgoing record locally and to server
        if (code && !activeChallenge) {
          const outgoingRecord = {
            id: Date.now(), sender: displayName,
            senderScore: { won, tries, hints: game.hintsUsed },
            mode: displayMode, code, status: 'outgoing',
            targetPlayer: game.target.name, outgoing: true,
            receiverName: null, receiverScore: null,
            sourceMode: game.isDaily ? 'Daily' : 'Endless',
          };
          setSavedChallenges(prev => {
            if (prev.find(c => c.code === code && c.outgoing === true)) return prev;
            return [outgoingRecord, ...prev];
          });
          postChallengeToServer({
            code, mode: displayMode, target_player: game.target.name,
            sender_uid: authUser.uid, sender_name: displayName,
            sender_score: { won, tries, hints: game.hintsUsed },
            source_mode: game.isDaily ? 'Daily' : 'Endless',
          });
        }
      } catch (e) {
        if (!e?.message?.toLowerCase().includes('cancel')) {
          try { await navigator.clipboard.writeText(text + '\n' + shareUrl); } catch {}
        }
      }
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Crickle 🏏', text: text + '\n', url: shareUrl });
        if (code && !activeChallenge) {
          const outgoingRecord = {
            id: Date.now(), sender: displayName,
            senderScore: { won, tries, hints: game.hintsUsed },
            mode: displayMode, code, status: 'outgoing',
            targetPlayer: game.target.name, outgoing: true,
            receiverName: null, receiverScore: null,
            sourceMode: game.isDaily ? 'Daily' : 'Endless',
          };
          setSavedChallenges(prev => {
            if (prev.find(c => c.code === code && c.outgoing === true)) return prev;
            return [outgoingRecord, ...prev];
          });
          postChallengeToServer({
            code, mode: displayMode, target_player: game.target.name,
            sender_uid: authUser.uid, sender_name: displayName,
            sender_score: { won, tries, hints: game.hintsUsed },
            source_mode: game.isDaily ? 'Daily' : 'Endless',
          });
        }
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
      }
    }
    try { await navigator.clipboard.writeText(text + '\n' + shareUrl); alert('Link copied!'); } catch {}
  }, [game, displayMode, userName, authUser, activeChallenge, postChallengeToServer]);

  const playSavedChallenge = (chall) => {
    setMode(chall.mode);
    setActiveTab('endless');
    const decoded = decodeChallenge(chall.code);
    if (decoded) {
      setGames(prev => ({
        ...prev,
        [chall.mode]: { target: decoded.player, guesses: [], status: 'playing', hintsUsed: 0, revealBanner: null, isDaily: false, isEasy: false }
      }));
      setActiveChallenge(chall);
      setScreen('game');
    }
  };

  const createH2HChallenge = useCallback(async (friendship) => {
    if (!authUser) return;
    // Random player from all formats, excluding today's daily
    const dailyPlayer = getDailyPlayer(dMode);
    const allEligible = [
      ...POOL.Test.map(p => ({ ...p, format: 'Test' })),
      ...POOL.ODI.map(p  => ({ ...p, format: 'ODI'  })),
      ...POOL.T20.map(p  => ({ ...p, format: 'T20'  })),
    ].filter(p => p.name !== dailyPlayer.name);
    const target = allEligible[Math.floor(Math.random() * allEligible.length)];

    const myUid  = authUser.uid;
    const myName = authUser.displayName || userName;
    const oppUid  = friendship.user_a_uid === myUid ? friendship.user_b_uid  : friendship.user_a_uid;
    const oppName = friendship.user_a_uid === myUid ? friendship.user_b_name : friendship.user_a_name;

    const pool  = POOL[target.format];
    const idx   = pool.findIndex(p => p.name === target.name);
    const pfx   = target.format === 'Test' ? 'TE' : target.format === 'ODI' ? 'OD' : 'T2';
    const playerCode = pfx + String(idx).padStart(4, '0');

    try {
      const res = await fetch(CHALLENGE_NEW_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          friendship_id: friendship.id,
          sender_uid: myUid, sender_name: myName,
          receiver_uid: oppUid, receiver_name: oppName,
          mode: target.format, player_code: playerCode, target_player: target.name,
        }),
      });
      if (!res.ok) return;
      const challenge = await res.json();
      setGames(prev => ({ ...prev, H2H: {
        target, guesses: [], status: 'playing', hintsUsed: 0, revealBanner: null,
        isDaily: false, isEasy: false, isH2H: true, format: target.format,
      }}));
      setActiveH2HChallenge(challenge);
      setActiveTab('h2h');
      setScreen('game');
      fetchH2HChallenges(myUid);
    } catch {}
  }, [authUser, userName, dMode, fetchH2HChallenges]);

  const playH2HChallenge = useCallback((challenge) => {
    const decoded = decodeChallenge(challenge.code);
    if (!decoded) return;
    setGames(prev => ({ ...prev, H2H: {
      target: decoded.player, guesses: [], status: 'playing', hintsUsed: 0, revealBanner: null,
      isDaily: false, isEasy: false, isH2H: true, format: decoded.mode,
    }}));
    setActiveH2HChallenge(challenge);
    setActiveTab('h2h');
    setScreen('game');
  }, []);

  const submitH2HScore = useCallback(async (challengeId, score) => {
    if (!authUser) return;
    try {
      await fetch(CHALLENGE_SUBMIT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId, uid: authUser.uid, score }),
      });
      fetchH2HChallenges(authUser.uid);
      fetchFriends(authUser.uid);
    } catch {}
  }, [authUser, fetchH2HChallenges, fetchFriends]);

  const generateFriendRequestLink = useCallback(async () => {
    if (!authUser) return null;
    try {
      const res = await fetch(FRIENDS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', sender_uid: authUser.uid, sender_name: authUser.displayName || userName }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return `https://crickle-game.vercel.app/?fr=${data.token}`;
    } catch { return null; }
  }, [authUser, userName]);

  const handleGuess = (player) => {
    if (!game || game.status !== 'playing') return;
    if (game.guesses.some((g) => g.name === player.name)) return;
    const nextGuesses = [player, ...game.guesses];
    const newStatus = player.name === game.target.name
      ? 'won'
      : nextGuesses.length >= MAX_GUESSES ? 'lost' : 'playing';
    patchGame({ guesses: nextGuesses, status: newStatus });
    setSearch('');
    if (newStatus !== 'playing') {
      // H2H — submit to backend, no stats affected
      if (game.isH2H && activeH2HChallenge) {
        submitH2HScore(activeH2HChallenge.id, { won: newStatus === 'won', tries: nextGuesses.length, hints: game.hintsUsed });
        return;
      }
      if (!game.isEasy) {
        setStats(prev => {
          const updated = updateStats(prev, {
            won: newStatus === 'won',
            guesses: nextGuesses.length,
            hintsUsed: game.hintsUsed,
            isDaily: game.isDaily,
          });
          saveStats(updated);
          return updated;
        });
      }

      if (activeChallenge) {
        const myScore = { won: newStatus === 'won', tries: nextGuesses.length, hints: game.hintsUsed };
        setSavedChallenges(prev => prev.map(c =>
          c.id === activeChallenge.id ? { ...c, status: 'completed', myScore } : c
        ));
        if (authUser) {
          postChallengeToServer({
            code: activeChallenge.code,
            receiver_uid: authUser.uid,
            receiver_name: userName,
            receiver_score: myScore,
          });
        }
      }
    }
  };

  const handleGiveUp = () => {
    if (!game || game.status !== 'playing') return;
    patchGame({ status: 'lost' });
    if (game.isH2H && activeH2HChallenge) {
      submitH2HScore(activeH2HChallenge.id, { won: false, tries: game.guesses.length, hints: game.hintsUsed });
      return;
    }
    if (!game.isEasy) {
      setStats(prev => {
        const updated = updateStats(prev, { won: false, guesses: game.guesses.length, hintsUsed: game.hintsUsed, isDaily: game.isDaily });
        saveStats(updated);
        return updated;
      });
    }
    if (activeChallenge) {
      const myScore = { won: false, tries: game.guesses.length, hints: game.hintsUsed };
      setSavedChallenges(prev => prev.map(c =>
        c.id === activeChallenge.id ? { ...c, status: 'completed', myScore } : c
      ));
      if (authUser) {
        postChallengeToServer({
          code: activeChallenge.code,
          receiver_uid: authUser.uid,
          receiver_name: userName,
          receiver_score: myScore,
        });
      }
    }
  };

  const [showHintWarning, setShowHintWarning] = useState(false);

  const requestHint = async () => {
    if (!game || game.hintsUsed >= 3 || game.status !== 'playing') return;
    if (game.hintsUsed === 0) {
      // Always warn before first hint — user should make a conscious choice
      if (!showHintWarning) {
        setShowHintWarning(true);
        return;
      }
      setShowHintWarning(false);
      patchGame({ hintsUsed: 1, revealBanner: pickRandom(HINTS[0].revealInsults) });
      return;
    }

    const idx = game.hintsUsed;
    if (IS_NATIVE) {
      try {
        if (adListenerRef.current) { adListenerRef.current.remove(); }
        adListenerRef.current = await AdMob.addListener(
          InterstitialAdPluginEvents.Dismissed,
          () => { adListenerRef.current?.remove(); adListenerRef.current = null; revealHint(idx); }
        );
        await AdMob.showInterstitial();
      } catch (e) { revealHint(idx); }
    } else {
      revealHint(idx);
    }
  };

  const pool = activeTab === 'easy'
    ? EASY_POOL
    : activeTab === 'h2h'
      ? (POOL[games.H2H?.format] || POOL.Test)
      : POOL[displayMode];

  const suggestions = (pool || [])
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) && !game?.guesses?.find((g) => g.name === p.name))
    .slice(0, 8);

  const hintTexts = !game?.target?.trivia ? [] :
    ['hint1','hint2','hint3'].slice(0, game.hintsUsed).map((k) => game.target.trivia[k] ?? '');

  const cols = COLS.map((c) => ({ ...c, label: c.baseLabel }));

  // If somehow we reach game screen with no game, bail to menu
  if (screen === 'game' && !game) {
    return null; // useEffect below will redirect
  }

  function renderGameHeader() {
    const fmtColors = { Test:'#7dd3fc', ODI:'#86efac', T20:'#fde68a' };
    const isDaily = game?.isDaily;
    const isH2H   = game?.isH2H;
    const oppName = isH2H
      ? (activeH2HChallenge?.sender_uid === authUser?.uid
          ? activeH2HChallenge?.receiver_name
          : activeH2HChallenge?.sender_name) || 'Friend'
      : null;
    return (
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
    );
  }

  const avgGuesses = stats.wins > 0 ? (stats.totalGuesses / stats.wins).toFixed(1) : '—';
  const winRate    = stats.gamesPlayed > 0 ? Math.round(stats.wins / stats.gamesPlayed * 100) : 0;
  const hintRate   = stats.gamesPlayed > 0 ? Math.round(stats.hintGames / stats.gamesPlayed * 100) : 0;
  // Pending = challenges where it's my turn (sender with no score, or receiver with no score)
  const pendingCount = h2hChallenges.filter(c => {
    if (!authUser) return false;
    const isSender   = c.sender_uid   === authUser.uid;
    const isReceiver = c.receiver_uid === authUser.uid;
    return c.status === 'open' && (
      (isSender   && !c.sender_score) ||
      (isReceiver && !c.receiver_score)
    );
  }).length + savedChallenges.filter(c => c.status === 'pending').length;

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

          {/* Menu tabs */}
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
              {(() => {
                const dailyDone = games.Daily && games.Daily.status !== 'playing';
                const dailyBorderColor = dailyDone ? 'rgba(251,191,36,0.5)' : 'rgba(34,197,94,0.4)';
                const dailyBg = dailyDone ? 'rgba(251,191,36,0.08)' : 'rgba(34,197,94,0.15)';
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
                            color: dailyDone ? '#fbbf24' : '#86efac',
                            letterSpacing:'0.08em',
                          }}>{dMode}</span>
                        </div>
                        <div style={{ fontSize:'0.75rem', color:'rgba(210,240,255,0.6)', marginTop:2 }}>
                          {dailyDone
                            ? `Already done · ${games.Daily.guesses.length} guess${games.Daily.guesses.length !== 1 ? 'es' : ''}${games.Daily.hintsUsed > 0 ? ` · ${games.Daily.hintsUsed} hint${games.Daily.hintsUsed > 1 ? 's' : ''}` : ''}`
                            : `Today's ${dMode} puzzle`}
                        </div>
                      </div>
                    </div>
                    <span style={{ color: dailyDone ? '#fbbf24' : '#22c55e', fontSize:'1.2rem' }}>{dailyDone ? '✓' : '→'}</span>
                  </button>
                );
              })()}

              <button onClick={() => setPlayFlow('endless')} style={{
                width:'100%', padding:'20px', background:'rgba(255,255,255,0.05)',
                border:'2px solid rgba(255,255,255,0.1)', borderRadius:'14px',
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between',
                transition:'all 0.15s',
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

              <button onClick={() => { setActiveTab('easy'); setGames(prev => ({ ...prev, Easy: freshEasyGame() })); setScreen('game'); }} style={{
                width:'100%', padding:'20px', background:'rgba(255,255,255,0.05)',
                border:'2px solid rgba(255,255,255,0.1)', borderRadius:'14px',
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between',
                transition:'all 0.15s',
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

          {menuTab === 'play' && playFlow === 'endless' && (
            <div style={{ width:'100%' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
                <button onClick={() => setPlayFlow('main')} style={{ background:'transparent', border:'none', color:'rgba(210,240,255,0.6)', fontWeight:800, cursor:'pointer', padding:0, fontSize:'0.85rem' }}>← Back</button>
                <p style={{ color:'rgba(210,240,255,0.5)', fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', margin:0 }}>Select Format</p>
                <div style={{ width:'40px' }} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'28px' }}>
                {['Test','ODI','T20'].map(f => {
                  const isEmpty = POOL[f].length === 0;
                  const active  = mode === f;
                  const targetGame = games[f];
                  const inProg  = targetGame?.status === 'playing' && targetGame?.guesses?.length > 0 && !targetGame.isDaily;
                  return (
                    <button key={f} onClick={() => { if(!isEmpty) { setMode(f); } }} style={{
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

          {/* ── CHALLENGES tab ── */}
          {menuTab === 'challenges' && (() => {
            const GoogleBtn = ({ onPress }) => (
              <button onPointerDown={onPress} disabled={signingIn} style={{
                width:'100%', padding:'14px', background: signingIn ? 'rgba(255,255,255,0.7)' : '#fff',
                border:'none', borderRadius:'12px', color:'#1a1a1a', fontWeight:800, fontSize:'0.95rem',
                cursor: signingIn ? 'default' : 'pointer', fontFamily:"'Outfit',system-ui,sans-serif",
                display:'flex', alignItems:'center', justifyContent:'center', gap:'10px',
                touchAction:'manipulation', userSelect:'none',
              }}>
                {signingIn ? <span>Signing in…</span> : (<>
                  <svg width="20" height="20" viewBox="0 0 24 24" style={{ pointerEvents:'none', flexShrink:0 }}><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  <span style={{ pointerEvents:'none' }}>Continue with Google</span>
                </>)}
              </button>
            );

            if (authLoading) return <div style={{ textAlign:'center', padding:'40px 20px', color:'rgba(210,240,255,0.5)' }}>Loading…</div>;

            if (!authUser) return (
              <div style={{ textAlign:'center', padding:'40px 20px' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:'16px' }}>⚔️</div>
                <div style={{ fontSize:'1rem', fontWeight:800, color:'#fff', marginBottom:'8px' }}>Sign in to play H2H</div>
                <p style={{ fontSize:'0.8rem', color:'rgba(210,240,255,0.55)', marginBottom:'24px', lineHeight:1.6 }}>
                  Add friends, challenge them to the same puzzle, and track your rivalry score.
                </p>
                <GoogleBtn onPress={handleGoogleSignIn} />
              </div>
            );

            const myUid  = authUser.uid;
            const myName = authUser.displayName || userName;

            // ── Rivalry drill-in view ──
            if (h2hRivalryView) {
              const friendship = friends.find(f => f.id === h2hRivalryView);
              if (!friendship) { setH2hRivalryView(null); return null; }
              const oppName = friendship.user_a_uid === myUid ? friendship.user_b_name : friendship.user_a_name;
              const aWins = friendship.user_a_uid === myUid ? friendship.a_wins : friendship.b_wins;
              const bWins = friendship.user_a_uid === myUid ? friendship.b_wins : friendship.a_wins;

              const rivalChallenges = h2hChallenges.filter(c => c.friendship_id === friendship.id);
              const open      = rivalChallenges.filter(c => c.status === 'open');
              const completed = rivalChallenges.filter(c => c.status === 'completed');

              return (
                <div style={{ width:'100%' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px' }}>
                    <button onClick={() => setH2hRivalryView(null)} style={{ background:'transparent', border:'none', color:'rgba(210,240,255,0.6)', fontWeight:800, cursor:'pointer', fontSize:'0.85rem', padding:0 }}>← Back</button>
                  </div>

                  {/* Rivalry score header */}
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
                          const isSender   = c.sender_uid   === myUid;
                          const myPlayed   = isSender ? !!c.sender_score   : !!c.receiver_score;
                          const theyPlayed = isSender ? !!c.receiver_score : !!c.sender_score;
                          return (
                            <div key={c.id} style={{ background:'rgba(0,30,15,0.8)', border:'1px solid rgba(251,191,36,0.25)', borderRadius:'12px', padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                              <div>
                                <div style={{ fontSize:'0.82rem', fontWeight:800, color:'#fff' }}>{c.mode} · {c.target_player}</div>
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

                  {/* Completed */}
                  {completed.length > 0 && (
                    <div>
                      <div style={{ fontSize:'0.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'rgba(210,240,255,0.5)', marginBottom:'8px' }}>Completed ({completed.length})</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                        {completed.map(c => {
                          const isSender  = c.sender_uid === myUid;
                          const myScore   = isSender ? c.sender_score   : c.receiver_score;
                          const theirScore= isSender ? c.receiver_score : c.sender_score;
                          const iWon      = c.winner_uid === myUid;
                          const theyWon   = c.winner_uid && c.winner_uid !== myUid;
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
                    <div style={{ textAlign:'center', padding:'30px', color:'rgba(255,255,255,0.4)', fontSize:'0.85rem' }}>No challenges yet. Challenge {oppName} above!</div>
                  )}
                </div>
              );
            }

            // ── Friends list ──
            return (
              <div style={{ width:'100%' }}>
                {/* Add friend button */}
                <button onClick={async () => {
                  let link = await generateFriendRequestLink();
                  // Fallback for local dev or API failure
                  if (!link) {
                    alert('Friend request API unavailable. Make sure the app is deployed to Vercel.');
                    return;
                  }
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
                      const pending = h2hChallenges.filter(c => c.friendship_id === f.id && c.status === 'open' && (
                        (c.sender_uid   === myUid && !c.sender_score) ||
                        (c.receiver_uid === myUid && !c.receiver_score)
                      )).length;
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
                }}>Signed in as {authUser.displayName} · Sign out</button>
              </div>
            );
          })()}
          {/* ── STATS tab ── */}
          {menuTab === 'stats' && (
            <div style={{ width:'100%' }}>
              
              {/* Daily Section */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ color: '#22c55e', margin: '0 0 12px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📅 Daily Puzzle</h3>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                  {[
                    { label:'Win Streak', value: stats.dailyStreak + (stats.dailyStreak > 0 ? ' 🔥' : ''), big:true },
                    { label:'Best Streak', value: stats.bestDailyStreak },
                    { label:'Hintless Streak', value: (stats.dailyHintlessStreak||0) + ((stats.dailyHintlessStreak||0) > 0 ? ' 🎯' : ''), big:true },
                    { label:'Best Hintless', value: stats.bestDailyHintlessStreak || 0 },
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
                    { label:'Win Streak', value: stats.streak },
                    { label:'Best Streak', value: stats.bestStreak },
                    { label:'Hintless Streak', value: (stats.hintlessStreak||0) + ((stats.hintlessStreak||0) > 0 ? ' 🎯' : '') },
                    { label:'Best Hintless', value: stats.bestHintlessStreak || 0 },
                    { label:'Win Rate', value: `${winRate}%` },
                    { label:'Avg Guesses', value: avgGuesses },
                    { label:'Best Guess', value: stats.bestGuesses ?? '—', sub: stats.bestGuesses === 1 ? '🏆 First ball!' : null },
                    { label:'Perfect Games', value: stats.perfectGames || 0, sub: (stats.perfectGames||0) > 0 ? '1-guess wins' : null },
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
                    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'crickle.app';
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
                      baseUrl,
                    ].join('\n');
                    if (IS_NATIVE) {
                      try { await Share.share({ title: 'Crickle Stats 🏏', text: statsText, dialogTitle: 'Share your stats' }); } catch {}
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

          {/* Web App Store Badges + Footer Links */}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            {!IS_NATIVE && menuTab === 'play' && playFlow === 'main' && (
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', width: '100%', marginTop: '30px' }}>
                
                <a href="#" target="_blank" rel="noreferrer">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Get it on Google Play" style={{ height: '42px' }} />
                </a>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '20px', marginTop: '30px', fontSize: '0.75rem' }}>
              <a href="/privacy.html" target="_blank" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'underline' }}>Privacy Policy</a>
              <a href="/support.html" target="_blank" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'underline' }}>Support</a>
            </div>
          </div>

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
      <div style={{ position:'absolute', inset:0, background:'rgba(0,10,5,0.72)', zIndex:0, pointerEvents:'none' }} />
      <div style={{ position:'relative', zIndex:1, width:'100%', display:'flex', flexDirection:'column', alignItems:'center' }}>
      {renderGameHeader()}

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

      {/* Confetti canvas */}
      {showConfetti && (
        <canvas ref={confettiRef} style={{
          position:'fixed', inset:0, pointerEvents:'none', zIndex:999,
        }} />
      )}

      {/* Share Sign-in Prompt Modal */}
      {showShareAuthPrompt && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.85)', padding:'20px' }}
          onClick={() => setShowShareAuthPrompt(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background:'rgba(0,25,10,0.98)', border:'1px solid rgba(34,197,94,0.4)', borderRadius:'20px', padding:'28px 24px', width:'100%', maxWidth:'320px', textAlign:'center' }}>
            <div style={{ fontSize:'2rem', marginBottom:'10px' }}>📤</div>
            <h3 style={{ margin:'0 0 8px', fontSize:'1.1rem', color:'#fff' }}>Sign in to share</h3>
            <p style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.6)', marginBottom:'24px', lineHeight:1.6 }}>
              Sign in with Google so the challenge says your name — "{authUser?.displayName || 'Your Name'} has challenged you."
            </p>
            <button
              onPointerDown={async () => { pendingShareRef.current = true; await handleGoogleSignIn(); }}
              disabled={signingIn}
              style={{
                width:'100%', padding:'13px',
                background: signingIn ? 'rgba(255,255,255,0.7)' : '#fff',
                border:'none', borderRadius:'12px',
                color:'#1a1a1a', fontWeight:800, fontSize:'0.95rem',
                cursor: signingIn ? 'default' : 'pointer',
                fontFamily:"'Outfit',system-ui,sans-serif",
                display:'flex', alignItems:'center', justifyContent:'center', gap:'10px',
                touchAction:'manipulation', userSelect:'none',
              }}
            >
              {signingIn ? <span>Signing in…</span> : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" style={{ pointerEvents:'none', flexShrink:0 }}><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  <span style={{ pointerEvents:'none' }}>Sign in with Google</span>
                </>
              )}
            </button>
            <button onClick={() => setShowShareAuthPrompt(false)} style={{ marginTop:'10px', background:'none', border:'none', color:'rgba(255,255,255,0.35)', fontSize:'0.78rem', cursor:'pointer' }}>Cancel</button>
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
        }} onClick={() => patchGame({ status: 'won_dismissed' })}>
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

            {/* H2H pending result note — shown immediately, full result visible in H2H tab once opponent plays */}
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
                <button onClick={() => { setScreen('menu'); setMenuTab('challenges'); patchGame({ status: 'won_dismissed' }); }} style={{
                  width:'100%', padding:'14px',
                  background:'linear-gradient(135deg,#22c55e,#16a34a)',
                  border:'none', borderRadius:'12px', color:'#fff',
                  fontWeight:900, fontSize:'0.95rem', cursor:'pointer',
                  fontFamily:"'Outfit',system-ui,sans-serif",
                }}>⚔️ Back to H2H</button>
              )}
              {(activeTab === 'endless' || activeTab === 'easy') && (
                <button onClick={() => { resetGame(); }} style={{
                  width:'100%', padding:'12px',
                  background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)',
                  borderRadius:'12px', color:'rgba(210,240,255,0.8)',
                  fontWeight:800, fontSize:'0.88rem', cursor:'pointer',
                  fontFamily:"'Outfit',system-ui,sans-serif",
                }}>🎮 New Game</button>
              )}
              <button onClick={() => patchGame({ status: 'won_dismissed' })} style={{
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
          background:'rgba(185,28,28,0.12)', border:'1px solid rgba(239,68,68,0.3)',
          borderRadius:'14px', padding:'18px 20px', marginBottom:'20px',
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontWeight:800, fontSize:'0.95rem', color:'#fff' }}>💀 Better luck next time.</div>
              <div style={{ fontSize:'0.78rem', color:'rgba(210,240,255,0.6)', marginTop:2 }}>
                The answer was {game.target.name}
              </div>
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
              <button onClick={() => resetGame()} style={{
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

      {/* Info bar — legend + guess counter */}
      <div style={{ width:'100%', maxWidth:'480px', marginBottom:'10px' }}>
        {/* Guess counter */}
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'center',
          marginBottom:'8px',
        }}>
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
          placeholder={game.status !== 'playing'
            ? (game.isDaily ? 'Puzzle complete. Come back tomorrow!' : 'Game over')
            : 'Search for a player…'}
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

      {/* Hint dropdown click-outside dismisser */}
      {showHintDrop && (
        <div onClick={() => setShowHintDrop(false)} style={{
          position:'fixed', inset:0, zIndex:24, background:'transparent',
        }} />
      )}

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

                  {/* Hintless streak warning */}
                  {showHintWarning && game.hintsUsed === 0 && (
                    <div style={{
                      background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.4)',
                      borderRadius:'10px', padding:'10px 12px', marginBottom:'10px',
                    }}>
                      <p style={{ margin:'0 0 8px', fontSize:'0.78rem', fontWeight:700, color:'#fbbf24', lineHeight:1.4 }}>
                        {(() => {
                          const streak = game.isDaily ? (stats.dailyHintlessStreak || 0) : (stats.hintlessStreak || 0);
                          return streak > 0
                            ? `⚠️ Using a hint will break your ${streak}-game hintless streak.`
                            : `💡 Using a hint means no hintless bonus this game.`;
                        })()}
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