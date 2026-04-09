// leaderboard.js - Fetch, submit, and store leaderboard data.
// Golf: lowest score wins. Personal bests stored in localStorage.

const NAME_KEY = 'golf-name';
const PERSONAL_BESTS_KEY = 'golf-personal-bests';
const PERSONAL_BESTS_MAX = 10;

function urlPrefix() {
  const m = location.pathname.match(/^\/[^/]+/);
  return m ? m[0] : '';
}

const API_BASE = urlPrefix() + '/api';

// ---------------------------------------------------------------------------
// Personal bests (localStorage)
// ---------------------------------------------------------------------------

export function getStoredName() {
  return localStorage.getItem(NAME_KEY) || '';
}

export function setStoredName(name) {
  localStorage.setItem(NAME_KEY, name);
}

export function getPersonalBests() {
  try {
    const raw = localStorage.getItem(PERSONAL_BESTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function recordPersonalBest(score) {
  const s = Math.floor(score);
  if (s <= 0) return getPersonalBests();
  const list = getPersonalBests();
  list.push({ score: s, at: Date.now() });
  list.sort((a, b) => a.score - b.score); // lowest first for golf
  const trimmed = list.slice(0, PERSONAL_BESTS_MAX);
  try {
    localStorage.setItem(PERSONAL_BESTS_KEY, JSON.stringify(trimmed));
  } catch {}
  return trimmed;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

function normalizeBoard(data) {
  if (data.daily || data.alltime || data.topEver) {
    return {
      daily: data.daily || [],
      alltime: data.alltime || data.scores || [],
      topEver: data.topEver || null,
      resetsAt: data.resetsAt || null,
      serverNow: data.serverNow || Date.now(),
    };
  }
  const scores = data.scores || [];
  return {
    daily: [],
    alltime: scores,
    topEver: scores[0] || null,
    resetsAt: null,
    serverNow: Date.now(),
  };
}

export async function fetchLeaderboard() {
  try {
    const r = await fetch(`${API_BASE}/leaderboard/v2`);
    if (!r.ok) throw new Error('http ' + r.status);
    const data = await r.json();
    return normalizeBoard(data);
  } catch (e) {
    console.warn('leaderboard v2 fetch failed, trying v1', e);
    try {
      const r = await fetch(`${API_BASE}/leaderboard`);
      if (!r.ok) throw new Error('http ' + r.status);
      const data = await r.json();
      return normalizeBoard({ scores: data.scores || [] });
    } catch (e2) {
      console.warn('leaderboard v1 fetch failed', e2);
      return null;
    }
  }
}

export async function submitScore(name, score, coursePar) {
  try {
    const r = await fetch(`${API_BASE}/score`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, score: Math.floor(score), coursePar: coursePar || 30 }),
    });
    if (!r.ok) throw new Error('http ' + r.status);
    const data = await r.json();
    return normalizeBoard(data);
  } catch (e) {
    console.warn('score submit failed', e);
    return null;
  }
}
