import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AdMob, InterstitialAdPluginEvents } from '@capacitor-community/admob';
import { App as CapApp } from '@capacitor/app';
import { Share } from '@capacitor/share';
import { initializeApp as initFirebase } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithCredential, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import testPlayersRaw from './testplayers.json';
import odiPlayersRaw from './odiplayers.json';
import t20PlayersRaw from './t20players.json';
import { CrickleContext } from './context';
import MenuScreen from './MenuScreen';
import GameScreen from './GameScreen';

// ─────────────────────────────────────────────────────────────
// Firebase
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// API URLs  (absolute on native, relative on web)
// ─────────────────────────────────────────────────────────────
export const API_BASE = typeof window !== 'undefined' && window?.Capacitor?.isNativePlatform?.()
  ? 'https://crickle-game.vercel.app'
  : '';
export const FRIENDS_API          = `${API_BASE}/api/h2h/friends`;
export const CHALLENGE_NEW_API    = `${API_BASE}/api/h2h/challenge-new`;
export const CHALLENGE_SUBMIT_API = `${API_BASE}/api/h2h/challenge-submit`;

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
// Load Google Font
// @ts-ignore
const _googleFont = (() => {
  if (typeof document !== 'undefined' && !document.getElementById('crickle-fonts')) {
    const l = document.createElement('link');
    l.id = 'crickle-fonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=DM+Sans:wght@400;500;600&display=swap';
    document.head.appendChild(l);
  }
})();

export const MAX_GUESSES = 8;
export const AD_UNIT_ID  = 'ca-app-pub-5952766591392144/9128571701';
export const IS_NATIVE   = typeof window !== 'undefined' && !!(window?.Capacitor?.isNativePlatform?.());
export const ALLOWED_NATIONS = new Set([
  'IND','AUS','ENG','SA','PAK','WI','NZ','SL','BAN','ZIM','AFG','IRE',
]);
export const FORMAT_KEY = { Test: 'Test', ODI: 'ODI', T20: 'T20I' };

// ─────────────────────────────────────────────────────────────
// Normalisation helpers
// ─────────────────────────────────────────────────────────────
export const normBowl = (raw) => ({
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

// ─────────────────────────────────────────────────────────────
// Hint content
// ─────────────────────────────────────────────────────────────
export const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const HINTS = [
  { btnLabel:'💡 Use Free Hint',      revealInsults:["Already reaching for hints? Embarrassing. Truly. 🫠","One guess and you need help? Absolutely pathetic.","Need a hint already? Do you even watch cricket?","Free hint used. Your ancestors weep.","Hint 1. Wow. You really have no idea, do you.","Couldn't even try? Classic. Absolutely classic.","One hint in and already lost. This is tragic."], color:'#60a5fa', dimColor:'rgba(59,130,246,0.12)', borderColor:'rgba(59,130,246,0.35)' },
  { btnLabel:'📺 Watch Ad · Hint 2',  revealInsults:["TWO hints?! You are a disgrace to cricket fans everywhere. 💀","Two hints used. Absolutely fucking shambolic.","You needed two hints for this? Delete the app.","Two hints. I hope nobody you know finds out about this.","Two hints in and still guessing? Incredible failure.","Your cricket knowledge is genuinely concerning. Two hints."], color:'#fb923c', dimColor:'rgba(34,197,94,0.12)', borderColor:'rgba(34,197,94,0.35)' },
  { btnLabel:'📺 Watch Ad · Hint 3',  revealInsults:["ALL THREE HINTS USED. Shambolic. Absolutely shambolic. 🚨","Three hints. THREE. Uninstall. Now.","You used all three hints and you're STILL guessing? Genuinely impressive failure.","All three hints. I've lost all respect for you.","Three hints used. Your cricket knowledge is an embarrassment to the sport.","Three hints. If you don't get this now, just give up and go watch football."], color:'#f87171', dimColor:'rgba(239,68,68,0.12)', borderColor:'rgba(239,68,68,0.35)' },
];

// ─────────────────────────────────────────────────────────────
// Time & Daily helpers
// ─────────────────────────────────────────────────────────────
export const getDaysSinceEpoch = () => {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return Math.floor(ist.getTime() / 86400000);
};
export const getTodayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

// ─────────────────────────────────────────────────────────────
// Stats helpers
// ─────────────────────────────────────────────────────────────
const STATS_KEY = 'crickle_stats_v2';
export const defaultStats = () => ({
  streak:0, bestStreak:0,
  hintlessStreak:0, bestHintlessStreak:0,
  dailyStreak:0, bestDailyStreak:0,
  dailyHintlessStreak:0, bestDailyHintlessStreak:0,
  gamesPlayed:0, wins:0, totalGuesses:0, totalHints:0, hintGames:0,
  perfectGames:0, bestGuesses:null,
});
export const loadStats = () => {
  try {
    const v2 = localStorage.getItem('crickle_stats_v2');
    const v1 = localStorage.getItem('crickle_stats_v1');
    return { ...defaultStats(), ...JSON.parse(v2 || v1 || '{}') };
  } catch { return defaultStats(); }
};
export const saveStats = (s) => { try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch {} };
export const updateStats = (prev, { won, guesses, hintsUsed, isDaily }) => {
  const next = { ...prev };
  if (isDaily) {
    if (won) {
      next.dailyStreak = (next.dailyStreak || 0) + 1;
      next.bestDailyStreak = Math.max(next.bestDailyStreak || 0, next.dailyStreak);
      if (hintsUsed === 0) {
        next.dailyHintlessStreak = (next.dailyHintlessStreak || 0) + 1;
        next.bestDailyHintlessStreak = Math.max(next.bestDailyHintlessStreak || 0, next.dailyHintlessStreak);
      } else { next.dailyHintlessStreak = 0; }
    } else { next.dailyStreak = 0; next.dailyHintlessStreak = 0; }
    return next;
  }
  next.gamesPlayed += 1;
  if (won) {
    next.wins += 1; next.streak += 1;
    next.bestStreak = Math.max(next.bestStreak, next.streak);
    next.totalGuesses += guesses;
    next.bestGuesses = next.bestGuesses === null ? guesses : Math.min(next.bestGuesses, guesses);
    if (guesses === 1) next.perfectGames = (next.perfectGames || 0) + 1;
    if (hintsUsed === 0) {
      next.hintlessStreak = (next.hintlessStreak || 0) + 1;
      next.bestHintlessStreak = Math.max(next.bestHintlessStreak || 0, next.hintlessStreak);
    } else { next.hintlessStreak = 0; }
  } else { next.streak = 0; next.hintlessStreak = 0; }
  if (hintsUsed > 0) { next.totalHints += hintsUsed; next.hintGames += 1; }
  return next;
};

// ─────────────────────────────────────────────────────────────
// H2H score helpers
// ─────────────────────────────────────────────────────────────
export const getH2HWinner = (myScore, theirScore, myName, theirName) => {
  if (!myScore || !theirScore) return null;
  if (myScore.won && !theirScore.won)  return myName;
  if (!myScore.won && theirScore.won)  return theirName;
  if (!myScore.won && !theirScore.won) return 'draw';
  const myH = myScore.hints ?? 0; const thH = theirScore.hints ?? 0;
  if (myH < thH) return myName;  if (thH < myH) return theirName;
  if (myScore.tries < theirScore.tries) return myName;
  if (theirScore.tries < myScore.tries) return theirName;
  return 'draw';
};

export const formatScore = (score) => {
  if (!score) return '?';
  if (score.won) return `${score.tries} ${score.tries === 1 ? 'try' : 'tries'} · ${score.hints ?? 0} hint${(score.hints ?? 0) !== 1 ? 's' : ''}`;
  const t = score.tries ?? 0; const h = score.hints ?? 0;
  if (t === 0) return 'gave up';
  return `gave up (${t} ${t === 1 ? 'try' : 'tries'} · ${h} hint${h !== 1 ? 's' : ''})`;
};

// ─────────────────────────────────────────────────────────────
// Player data
// ─────────────────────────────────────────────────────────────
export const normalizePlayers = (rawPlayers, mode) => {
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
        runs, wickets,
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
      if (mode === 'ODI'  && p.debutYear && p.debutYear <= 1990) return false;
      return true;
    });
};

export const POOL = {
  Test: normalizePlayers(testPlayersRaw, 'Test'),
  ODI:  normalizePlayers(odiPlayersRaw,  'ODI'),
  T20:  normalizePlayers(t20PlayersRaw,  'T20'),
};

const _easyNames = new Set();
export const EASY_POOL = [
  ...POOL.Test.filter(p => ['1','2'].includes(String(p.tier))).map(p => ({ ...p, easyFormat: 'Test' })),
  ...POOL.ODI.filter(p  => ['1','2'].includes(String(p.tier))).map(p => ({ ...p, easyFormat: 'ODI' })),
  ...POOL.T20.filter(p  => ['1','2'].includes(String(p.tier))).map(p => ({ ...p, easyFormat: 'T20' })),
].filter(p => { if (_easyNames.has(p.name)) return false; _easyNames.add(p.name); return true; });

export const getDailyPlayer = (format) => {
  const pool = POOL[format];
  return pool[getDaysSinceEpoch() % pool.length];
};

export const freshGameState = (format, isDaily = false) => {
  const pool = POOL[format];
  if (!pool.length) return null;
  return {
    target:       isDaily ? getDailyPlayer(format) : pool[Math.floor(Math.random() * pool.length)],
    guesses:      [],
    status:       'playing',
    hintsUsed:    0,
    revealBanner: null,
    isDaily,
    isEasy:       false,
  };
};

export const freshEasyGame = () => {
  const target = EASY_POOL[Math.floor(Math.random() * EASY_POOL.length)];
  return { target, guesses: [], status: 'playing', hintsUsed: 0, revealBanner: null,
           isDaily: false, isEasy: true, isH2H: false, format: target.easyFormat };
};

// ─────────────────────────────────────────────────────────────
// Colour / arrow helpers (exported for GameScreen)
// ─────────────────────────────────────────────────────────────
export const boxColor = (key, gVal, tVal, g, t) => {
  if (key === 'runs') {
    if (gVal === tVal && gVal != null) return { bg:'#166534', border:'#22c55e', color:'#bbf7d0' };
    if (gVal == null && tVal == null)  return { bg:'#166534', border:'#22c55e', color:'#bbf7d0' };
    if (gVal == null || tVal == null)  return { bg:'#1e2025', border:'#35373f', color:'#9ca3af' };
    return Math.abs(gVal - tVal) <= tVal * 0.15
      ? { bg:'#713f12', border:'#d97706', color:'#fde68a' }
      : { bg:'#1e2025', border:'#35373f', color:'#9ca3af' };
  }
  if (key === 'wickets') {
    if (gVal === tVal && gVal != null) return { bg:'#166534', border:'#22c55e', color:'#bbf7d0' };
    if (gVal == null && tVal == null)  return { bg:'#166534', border:'#22c55e', color:'#bbf7d0' };
    if (gVal == null || tVal == null)  return { bg:'#1e2025', border:'#35373f', color:'#9ca3af' };
    return Math.abs(gVal - tVal) <= tVal * 0.20
      ? { bg:'#713f12', border:'#d97706', color:'#fde68a' }
      : { bg:'#1e2025', border:'#35373f', color:'#9ca3af' };
  }
  if (key === 'keyStat') {
    if (g.keyStatType !== t.keyStatType) return { bg:'#1e2025', border:'#35373f', color:'#9ca3af' };
    if (gVal === tVal)                   return { bg:'#166534', border:'#22c55e', color:'#bbf7d0' };
    if (gVal == null || tVal == null)    return { bg:'#1e2025', border:'#35373f', color:'#9ca3af' };
    const threshold = t.keyStatType === 'runs' ? tVal * 0.15 : tVal * 0.20;
    return Math.abs(gVal - tVal) <= threshold
      ? { bg:'#713f12', border:'#d97706', color:'#fde68a' }
      : { bg:'#1e2025', border:'#35373f', color:'#9ca3af' };
  }
  if (gVal == null && tVal == null) return { bg:'#166534', border:'#22c55e', color:'#bbf7d0' };
  if (gVal == null || tVal == null) return { bg:'#1e2025', border:'#35373f', color:'#9ca3af' };
  if (gVal === tVal)                return { bg:'#166534', border:'#22c55e', color:'#bbf7d0' };
  const diff  = Math.abs(gVal - tVal);
  const close = (key === 'debutYear' && diff <= 3) || (key === 'matches' && diff / tVal <= 0.15);
  return close
    ? { bg:'#713f12', border:'#d97706', color:'#fde68a' }
    : { bg:'#1e2025', border:'#35373f', color:'#9ca3af' };
};

export const arrowFor = (key, gVal, tVal, g, t) => {
  if (key === 'keyStat'  && g.keyStatType !== t.keyStatType) return '';
  if (key === 'runs'     && (gVal == null || tVal == null))   return '';
  if (key === 'wickets'  && (gVal == null || tVal == null))   return '';
  if (typeof gVal !== 'number' || typeof tVal !== 'number' || gVal === tVal) return '';
  return gVal < tVal ? ' ↑' : ' ↓';
};

export const COLS = [
  { key:'runs',      baseLabel:'Runs'    },
  { key:'wickets',   baseLabel:'Wkts'    },
  { key:'debutYear', baseLabel:'Debut'   },
  { key:'matches',   baseLabel:'Matches' },
  { key:'nation',    baseLabel:'Nation'  },
  { key:'batting',   baseLabel:'Bat'     },
  { key:'bowling',   baseLabel:'Bowl'    },
];

// ─────────────────────────────────────────────────────────────
// Challenge decode (used by playH2HChallenge)
// ─────────────────────────────────────────────────────────────
export const decodeChallenge = (code) => {
  if (!code || code.length < 6) return null;
  const prefix = code.slice(0, 2);
  const mode   = prefix === 'TE' ? 'Test' : prefix === 'OD' ? 'ODI' : prefix === 'T2' ? 'T20' : null;
  if (!mode) return null;
  const idx    = parseInt(code.slice(2), 10);
  const player = POOL[mode]?.[idx];
  return player ? { mode, player } : null;
};

// ─────────────────────────────────────────────────────────────
// Window-width hook (exported for GameScreen)
// ─────────────────────────────────────────────────────────────
export const useWindowWidth = () => {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
};

// ─────────────────────────────────────────────────────────────
// App — state + logic + context provider
// ─────────────────────────────────────────────────────────────
export default function App() {
  // ── Game state ──
  const [games, setGames] = useState(() => {
    const dMode = ['Test','ODI','T20'][getDaysSinceEpoch() % 3];
    let savedDaily = null;
    try {
      const saved = JSON.parse(localStorage.getItem('crickle_daily_state_v2'));
      if (saved?.date === getTodayKey()) savedDaily = saved.game;
    } catch {}
    let savedEndless = {};
    try { savedEndless = JSON.parse(localStorage.getItem('crickle_endless_state_v1') || '{}'); } catch {}
    const restoreOrFresh = (format) => {
      const s = savedEndless[format];
      if (s && s.status === 'playing' && s.guesses?.length > 0 && s.target) return s;
      return freshGameState(format, false);
    };
    return {
      Test:  restoreOrFresh('Test'),
      ODI:   restoreOrFresh('ODI'),
      T20:   restoreOrFresh('T20'),
      Easy:  freshEasyGame(),
      H2H:   null,
      Daily: savedDaily || freshGameState(dMode, true),
    };
  });

  const [activeTab,    setActiveTab]    = useState('endless');
  const [mode,         setMode]         = useState('Test');
  const [search,       setSearch]       = useState('');
  const [stats,        setStats]        = useState(loadStats);
  const [screen,       setScreen]       = useState('menu');
  const [menuTab,      setMenuTab]      = useState('play');
  const [playFlow,     setPlayFlow]     = useState('main');
  const [showHintDrop, setShowHintDrop] = useState(false);
  const adListenerRef = useRef(null);

  const [userName, setUserName] = useState(() => {
    try { return localStorage.getItem('crickle_username') || ''; } catch { return ''; }
  });
  const [authUser,    setAuthUser]    = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const dMode = ['Test','ODI','T20'][getDaysSinceEpoch() % 3];
  const displayMode = activeTab === 'daily' ? dMode
    : activeTab === 'h2h'   ? (games.H2H?.format  || 'Test')
    : activeTab === 'easy'  ? (games.Easy?.format  || 'Test')
    : mode;
  const game = activeTab === 'daily' ? games.Daily
    : activeTab === 'easy'  ? games.Easy
    : activeTab === 'h2h'   ? games.H2H
    : games[mode];

  // ── AdMob init ──
  useEffect(() => {
    if (!IS_NATIVE) return;
    AdMob.initialize({ initializeForTesting: false })
      .then(() => AdMob.prepareInterstitial({ adId: AD_UNIT_ID }))
      .catch(() => {});
  }, []);

  // ── H2H state ──
  const [signingIn,         setSigningIn]         = useState(false);
  const [friends,           setFriends]           = useState([]);
  const [h2hChallenges,     setH2hChallenges]     = useState([]);
  const [h2hRivalryView,    setH2hRivalryView]    = useState(null);
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

  // ── Auth ──
  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      setAuthUser(user);
      setAuthLoading(false);
      if (user) {
        if (!localStorage.getItem('crickle_username') && user.displayName) {
          setUserName(user.displayName);
          localStorage.setItem('crickle_username', user.displayName);
        }
        fetchFriends(user.uid);
        fetchH2HChallenges(user.uid);
      }
    });
    if (!IS_NATIVE) getRedirectResult(firebaseAuth).catch(() => {});
    return () => unsub();
  }, [fetchFriends, fetchH2HChallenges]);

  // ── FCM token registration (native only) ──
  // Requires: npm install @capacitor/push-notifications && npx cap sync android
  useEffect(() => {
    if (!IS_NATIVE || !authUser) return;
    const registerFCM = async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== 'granted') return;
        await PushNotifications.register();
        PushNotifications.addListener('registration', async ({ value: token }) => {
          try {
            const { createClient } = await import('@supabase/supabase-js');
            const sb = createClient(
              import.meta.env.VITE_SUPABASE_URL,
              import.meta.env.VITE_SUPABASE_ANON_KEY
            );
            await sb.from('crickle_user_tokens').upsert({
              uid: authUser.uid,
              fcm_token: token,
              updated_at: new Date().toISOString(),
            });
          } catch {}
        });
      } catch (e) {
        console.warn('FCM registration error:', e);
      }
    };
    registerFCM();
  }, [authUser]);

  // ── Refresh H2H data when tab opened ──
  useEffect(() => {
    if (menuTab === 'challenges' && authUser) {
      fetchFriends(authUser.uid);
      fetchH2HChallenges(authUser.uid);
    }
  }, [menuTab, authUser, fetchFriends, fetchH2HChallenges]);

  // ── Supabase realtime ──
  useEffect(() => {
    if (!authUser) return;
    let cleanup;
    const setupRealtime = async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const sb  = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
        const uid = authUser.uid;
        const channel = sb.channel('h2h-realtime')
          .on('postgres_changes', { event:'*', schema:'public', table:'crickle_challenges',  filter:`sender_uid=eq.${uid}`   }, () => fetchH2HChallenges(uid))
          .on('postgres_changes', { event:'*', schema:'public', table:'crickle_challenges',  filter:`receiver_uid=eq.${uid}` }, () => fetchH2HChallenges(uid))
          .on('postgres_changes', { event:'*', schema:'public', table:'crickle_friendships', filter:`user_a_uid=eq.${uid}`   }, () => fetchFriends(uid))
          .on('postgres_changes', { event:'*', schema:'public', table:'crickle_friendships', filter:`user_b_uid=eq.${uid}`   }, () => fetchFriends(uid))
          .subscribe();
        cleanup = () => sb.removeChannel(channel);
      } catch {}
    };
    setupRealtime();
    return () => { cleanup?.(); };
  }, [authUser, fetchFriends, fetchH2HChallenges]);

  // ── Google sign-in ──
  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      if (IS_NATIVE) {
        try {
          const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
          const result = await FirebaseAuthentication.signInWithGoogle();
          const idToken = result.credential?.idToken;
          if (!idToken) throw new Error('No idToken');
          await signInWithCredential(firebaseAuth, GoogleAuthProvider.credential(idToken));
        } catch (nativeErr) {
          console.warn('Native Google sign-in failed, trying popup:', nativeErr);
          await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
        }
      } else {
        try {
          await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
        } catch (popupErr) {
          const silentCodes = ['auth/popup-closed-by-user','auth/cancelled-popup-request','auth/user-cancelled'];
          if (silentCodes.includes(popupErr?.code) || popupErr?.message?.toLowerCase().includes('cancel')) return;
          if (popupErr?.code === 'auth/popup-blocked') await signInWithRedirect(firebaseAuth, new GoogleAuthProvider());
          else console.error('Sign in error', popupErr);
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
    setFriends([]);
    setH2hChallenges([]);
  };

  // ── Game helpers ──
  const patchGame = useCallback((patch) => {
    setGames(prev => {
      const key = activeTab === 'daily' ? 'Daily' : activeTab === 'easy' ? 'Easy' : activeTab === 'h2h' ? 'H2H' : mode;
      return { ...prev, [key]: { ...prev[key], ...patch } };
    });
  }, [activeTab, mode]);

  const resetGame = useCallback(() => {
    setActiveH2HChallenge(null);
    setGames(prev => {
      if (activeTab === 'easy')  return { ...prev, Easy: freshEasyGame() };
      if (activeTab === 'h2h')   return { ...prev, H2H: null };
      const targetKey    = activeTab === 'daily' ? 'Daily' : mode;
      const targetFormat = activeTab === 'daily' ? dMode   : mode;
      return { ...prev, [targetKey]: freshGameState(targetFormat, activeTab === 'daily') };
    });
    setSearch('');
  }, [activeTab, mode, dMode]);

  // ── Persistence ──
  useEffect(() => {
    try {
      localStorage.setItem('crickle_endless_state_v1', JSON.stringify({ Test: games.Test, ODI: games.ODI, T20: games.T20 }));
    } catch {}
  }, [games.Test, games.ODI, games.T20]);

  useEffect(() => {
    if (games.Daily) {
      try { localStorage.setItem('crickle_daily_state_v2', JSON.stringify({ date: getTodayKey(), game: games.Daily })); } catch {}
    }
  }, [games.Daily]);

  // Persist H2H in-progress game so it survives browser/app close
  useEffect(() => {
    if (games.H2H && activeH2HChallenge && games.H2H.status === 'playing') {
      try {
        localStorage.setItem('crickle_h2h_state_v1', JSON.stringify({
          challengeId: activeH2HChallenge.id,
          game: games.H2H,
        }));
      } catch {}
    }
  }, [games.H2H, activeH2HChallenge]);

  // ── Deep links ──
  const [pendingFriendReq, setPendingFriendReq] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const frToken = params.get('fr');
      if (frToken) return { token: frToken, senderName: null };
    }
    return null;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params  = new URLSearchParams(window.location.search);
      const frToken = params.get('fr');
      const h2hId   = params.get('h2h');
      if (frToken) {
        setPendingFriendReq({ token: frToken, senderName: null });
        setMenuTab('challenges');
        setScreen('menu');
        window.history.replaceState({}, '', window.location.pathname);
      }
      if (h2hId) {
        setMenuTab('challenges');
        setScreen('menu');
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
    let urlListener;
    if (IS_NATIVE) {
      CapApp.addListener('appUrlOpen', (data) => {
        if (!data?.url) return;
        const search  = data.url.includes('?') ? data.url.slice(data.url.indexOf('?')) : '';
        const params  = new URLSearchParams(search);
        const frToken = params.get('fr');
        const h2hId   = params.get('h2h');
        if (frToken) { setPendingFriendReq({ token: frToken, senderName: null }); setMenuTab('challenges'); setScreen('menu'); }
        if (h2hId)   { setMenuTab('challenges'); setScreen('menu'); }
      }).then(l => { urlListener = l; }).catch(() => {});
    }
    return () => { urlListener?.remove(); };
  }, []);

  // Fetch sender name for pending friend request
  useEffect(() => {
    if (!pendingFriendReq?.token || pendingFriendReq.senderName) return;
    fetch(`${FRIENDS_API}?token=${pendingFriendReq.token}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.user_a_name) setPendingFriendReq(prev => ({ ...prev, senderName: d.user_a_name })); })
      .catch(() => {});
  }, [pendingFriendReq?.token]);

  const handleDailyStart = () => { setActiveTab('daily'); setScreen('game'); };

  // ── Android back button ──
  useEffect(() => {
    if (!IS_NATIVE) return;
    let listener;
    CapApp.addListener('backButton', () => {
      if (screen === 'game') { setShowHintDrop(false); setScreen('menu'); setPlayFlow('main'); }
      else { CapApp.exitApp(); }
    }).then(l => { listener = l; }).catch(() => {});
    return () => { listener?.remove(); };
  }, [screen]);

  // ── Confetti ──
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = useRef(null);

  useEffect(() => {
    if (game?.status === 'won' && !showConfetti) setShowConfetti(true);
    if (game?.status !== 'won') setShowConfetti(false);
  }, [game?.status]);

  useEffect(() => {
    if (!showConfetti || !confettiRef.current) return;
    const canvas = confettiRef.current;
    const ctx    = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width, y: -20 - Math.random() * 100,
      r: 4 + Math.random() * 6, d: 2 + Math.random() * 3,
      color: ['#22c55e','#60a5fa','#fbbf24','#f87171','#a78bfa','#34d399'][Math.floor(Math.random()*6)],
      tilt: Math.random() * 10 - 5, tiltAngle: 0, tiltSpeed: 0.05 + Math.random() * 0.1,
    }));
    let frame;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        p.tiltAngle += p.tiltSpeed; p.y += p.d; p.tilt = Math.sin(p.tiltAngle) * 12;
        if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
        ctx.beginPath(); ctx.fillStyle = p.color;
        ctx.ellipse(p.x, p.y, p.r, p.r * 0.4, p.tilt, 0, Math.PI * 2); ctx.fill();
      });
      frame = requestAnimationFrame(draw);
    };
    draw();
    const t = setTimeout(() => setShowConfetti(false), 4000);
    return () => { cancelAnimationFrame(frame); clearTimeout(t); };
  }, [showConfetti]);

  useEffect(() => { if (screen !== 'game') setShowHintDrop(false); }, [screen]);
  useEffect(() => { if (!showHintDrop) setShowHintWarning(false); }, [showHintDrop]);
  useEffect(() => {
    if (screen === 'game' && !game) { setScreen('menu'); setMenuTab('challenges'); }
  }, [screen, game]);

  // ── Hint reveal ──
  const [showHintWarning, setShowHintWarning] = useState(false);

  const revealHint = useCallback((idx) => {
    patchGame({ hintsUsed: idx + 1, revealBanner: pickRandom(HINTS[idx].revealInsults) });
    if (IS_NATIVE) AdMob.prepareInterstitial({ adId: AD_UNIT_ID }).catch(() => {});
  }, [patchGame]);

  const requestHint = async () => {
    if (!game || game.hintsUsed >= 3 || game.status !== 'playing') return;
    if (game.hintsUsed === 0) {
      if (!showHintWarning) { setShowHintWarning(true); return; }
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
      } catch { revealHint(idx); }
    } else {
      revealHint(idx);
    }
  };

  // ── Share ──
  const handleGameShare = useCallback(async () => {
    if (!game) return;
    const won      = game.status === 'won' || game.status === 'won_dismissed';
    const tries    = game.guesses.length;
    const hintsStr = game.hintsUsed === 0 ? 'no hints' : `${game.hintsUsed} hint${game.hintsUsed > 1 ? 's' : ''}`;
    const BASE     = 'https://crickle-game.vercel.app';
    let text;
    if (game.isDaily) {
      text = won
        ? `Crickle Daily 🏏 — Completed today's ${displayMode} challenge in ${tries}/${MAX_GUESSES} guesses with ${hintsStr}. Can you do better?\n${BASE}`
        : `Crickle Daily 🏏 — Today's ${displayMode} challenge got me. Give it a shot!\n${BASE}`;
    } else {
      text = won
        ? `Crickle 🏏 — Guessed ${game.target.name} in ${tries}/${MAX_GUESSES} guesses with ${hintsStr}. I guess I'm good at this game 😏\n${BASE}`
        : `Crickle 🏏 — Couldn't get this one. The ${displayMode} cricket Wordle, give it a shot!\n${BASE}`;
    }
    if (IS_NATIVE) {
      try { await Share.share({ title:'Crickle 🏏', text, dialogTitle:'Share your score' }); } catch {}
      return;
    }
    if (navigator.share) {
      try { await navigator.share({ title:'Crickle 🏏', text }); return; } catch (e) {
        if (e?.name === 'AbortError') return;
      }
    }
    try { await navigator.clipboard.writeText(text); alert('Copied!'); } catch {}
  }, [game, displayMode]);

  // ── H2H challenge actions ──
  const createH2HChallenge = useCallback(async (friendship) => {
    if (!authUser) return;
    const dailyPlayer  = getDailyPlayer(dMode);
    const allEligible  = [
      ...POOL.Test.map(p => ({ ...p, format:'Test' })),
      ...POOL.ODI.map(p  => ({ ...p, format:'ODI'  })),
      ...POOL.T20.map(p  => ({ ...p, format:'T20'  })),
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
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ friendship_id: friendship.id, sender_uid: myUid, sender_name: myName, receiver_uid: oppUid, receiver_name: oppName, mode: target.format, player_code: playerCode, target_player: target.name }),
      });
      if (!res.ok) return;
      const challenge = await res.json();
      setGames(prev => ({ ...prev, H2H: { target, guesses:[], status:'playing', hintsUsed:0, revealBanner:null, isDaily:false, isEasy:false, isH2H:true, format:target.format } }));
      setActiveH2HChallenge(challenge);
      setActiveTab('h2h');
      setScreen('game');
      fetchH2HChallenges(myUid);
    } catch {}
  }, [authUser, userName, dMode, fetchH2HChallenges]);

  const playH2HChallenge = useCallback((challenge) => {
    const codeToUse = challenge.source_mode || challenge.player_code || challenge.code;
    const decoded   = decodeChallenge(codeToUse);
    if (!decoded) { console.error('playH2HChallenge: could not decode', codeToUse, challenge); return; }

    setGames(prev => {
      // 1. Same challenge already in memory and still playing → keep it
      const existing = prev.H2H;
      if (existing?.isH2H && activeH2HChallenge?.id === challenge.id && existing.status === 'playing') {
        return prev;
      }
      // 2. Check localStorage for persisted in-progress state
      try {
        const saved = JSON.parse(localStorage.getItem('crickle_h2h_state_v1'));
        if (saved?.challengeId === challenge.id && saved?.game?.status === 'playing') {
          return { ...prev, H2H: saved.game };
        }
      } catch {}
      // 3. Fresh game
      return { ...prev, H2H: { target: decoded.player, guesses:[], status:'playing', hintsUsed:0, revealBanner:null, isDaily:false, isEasy:false, isH2H:true, format: decoded.mode } };
    });
    setActiveH2HChallenge(challenge);
    setActiveTab('h2h');
    setScreen('game');
  }, [activeH2HChallenge]);

  const submitH2HScore = useCallback(async (challengeId, score) => {
    if (!authUser) return;
    try {
      await fetch(CHALLENGE_SUBMIT_API, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ challenge_id: challengeId, uid: authUser.uid, score }),
      });
      // Clear persisted H2H state on submit
      try { localStorage.removeItem('crickle_h2h_state_v1'); } catch {}
      fetchH2HChallenges(authUser.uid);
      fetchFriends(authUser.uid);
    } catch {}
  }, [authUser, fetchH2HChallenges, fetchFriends]);

  const generateFriendRequestLink = useCallback(async () => {
    if (!authUser) return null;
    try {
      const body = { action:'request', sender_uid: authUser.uid, sender_name: authUser.displayName || authUser.email?.split('@')[0] || 'Player' };
      const res  = await fetch(FRIENDS_API, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) return null;
      return `https://crickle-game.vercel.app/?fr=${data.token}`;
    } catch { return null; }
  }, [authUser]);

  // ── Guess / give-up ──
  const handleGuess = (player) => {
    if (!game || game.status !== 'playing') return;
    if (game.guesses.some(g => g.name === player.name)) return;
    const nextGuesses = [player, ...game.guesses];
    const newStatus   = player.name === game.target.name ? 'won' : nextGuesses.length >= MAX_GUESSES ? 'lost' : 'playing';
    patchGame({ guesses: nextGuesses, status: newStatus });
    setSearch('');
    if (newStatus !== 'playing') {
      if (game.isH2H && activeH2HChallenge) {
        submitH2HScore(activeH2HChallenge.id, { won: newStatus === 'won', tries: nextGuesses.length, hints: game.hintsUsed });
        return;
      }
      if (!game.isEasy) {
        setStats(prev => { const u = updateStats(prev, { won: newStatus === 'won', guesses: nextGuesses.length, hintsUsed: game.hintsUsed, isDaily: game.isDaily }); saveStats(u); return u; });
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
      setStats(prev => { const u = updateStats(prev, { won: false, guesses: game.guesses.length, hintsUsed: game.hintsUsed, isDaily: game.isDaily }); saveStats(u); return u; });
    }
  };

  // ── Derived values ──
  const pool        = activeTab === 'easy' ? EASY_POOL : activeTab === 'h2h' ? (POOL[games.H2H?.format] || POOL.Test) : POOL[displayMode];
  const suggestions = (pool || []).filter(p => p.name.toLowerCase().includes(search.toLowerCase()) && !game?.guesses?.find(g => g.name === p.name)).slice(0, 8);
  const hintTexts   = !game?.target?.trivia ? [] : ['hint1','hint2','hint3'].slice(0, game.hintsUsed).map(k => game.target.trivia[k] ?? '');
  const cols        = COLS.map(c => ({ ...c, label: c.baseLabel }));

  const pendingCount = authUser ? h2hChallenges.filter(c => {
    const isSender   = c.sender_uid   === authUser.uid;
    const isReceiver = c.receiver_uid === authUser.uid;
    return c.status === 'open' && (
      (isSender   && c.sender_score?.won   === undefined) ||
      (isReceiver && c.receiver_score?.won === undefined)
    );
  }).length : 0;

  // ─────────────────────────────────────────────────────────────
  // Context value — everything screens need
  // ─────────────────────────────────────────────────────────────
  const ctx = {
    // state
    games, setGames, activeTab, setActiveTab, mode, setMode,
    search, setSearch, stats, setStats, screen, setScreen,
    menuTab, setMenuTab, playFlow, setPlayFlow,
    showHintDrop, setShowHintDrop, showHintWarning, setShowHintWarning,
    userName, authUser, authLoading, signingIn,
    friends, h2hChallenges, h2hRivalryView, setH2hRivalryView,
    activeH2HChallenge, pendingFriendReq, setPendingFriendReq,
    showConfetti, confettiRef,
    // derived
    game, displayMode, dMode, suggestions, hintTexts, cols, pendingCount,
    // handlers
    handleGoogleSignIn, handleSignOut,
    handleDailyStart, handleGuess, handleGiveUp,
    requestHint, revealHint, handleGameShare,
    createH2HChallenge, playH2HChallenge, submitH2HScore,
    generateFriendRequestLink, fetchFriends, fetchH2HChallenges,
    patchGame, resetGame,
    // refs
    adListenerRef,
  };

  if (screen === 'game' && !game) return null;

  return (
    <CrickleContext.Provider value={ctx}>
      {screen === 'menu' ? <MenuScreen /> : <GameScreen />}
    </CrickleContext.Provider>
  );
}