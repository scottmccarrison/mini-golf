// golf-api worker (also used by golfdev-api via wrangler.dev.toml).
// Path prefix is read from env.PATH_PREFIX (defaults to "/golf") so the same
// code can serve mccarrison.me/golf (prod) and mccarrison.me/golfdev (dev).

export { Room } from './room.js';

const MAX_NAME_LEN = 16;
const MAX_SCORE = 200; // 9 holes, even terrible play shouldn't exceed this

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const prefix = (env.PATH_PREFIX || '/golf');

    if (url.pathname === prefix) {
      return Response.redirect(url.origin + prefix + '/', 301);
    }

    let path = url.pathname;
    if (path.startsWith(prefix + '/')) path = path.slice(prefix.length) || '/';

    // --- Leaderboard v2: daily + alltime + top ever ---
    if (path === '/api/leaderboard/v2' && request.method === 'GET') {
      return getLeaderboardV2(env);
    }

    // --- Leaderboard v1 (simple) ---
    if (path === '/api/leaderboard' && request.method === 'GET') {
      return getLeaderboard(env);
    }

    // --- Submit score ---
    if (path === '/api/score' && request.method === 'POST') {
      return postScore(request, env);
    }

    // --- Feedback ---
    if (path === '/api/feedback' && request.method === 'POST') {
      return handleFeedback(request, env);
    }

    // --- Editor: save hole ---
    if (path === '/api/edit/save-hole' && request.method === 'POST') {
      return saveHole(request, env);
    }

    // --- Room create ---
    if (path === '/api/room' && request.method === 'POST') {
      const code = generateRoomCode();
      const id = env.ROOMS.idFromName(code);
      const stub = env.ROOMS.get(id);
      await stub.fetch('https://room/init', {
        method: 'POST',
        body: JSON.stringify({ code }),
        headers: { 'content-type': 'application/json' },
      });
      return json({ code });
    }

    // --- Room WebSocket ---
    const roomMatch = path.match(/^\/api\/room\/([A-Z]{4})$/);
    if (roomMatch && request.headers.get('Upgrade') === 'websocket') {
      const code = roomMatch[1];
      const id = env.ROOMS.idFromName(code);
      const stub = env.ROOMS.get(id);
      return stub.fetch(request);
    }

    // --- Static assets ---
    const assetUrl = new URL(request.url);
    assetUrl.pathname = path;
    return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
  },
};

// ---------------------------------------------------------------------------
// Leaderboard helpers
// ---------------------------------------------------------------------------

async function getLeaderboard(env) {
  const { results } = await env.DB.prepare(
    `SELECT name, score, created_at FROM scores ORDER BY score ASC LIMIT 10`
  ).all();
  return json({ scores: results || [] });
}

async function getLeaderboardV2(env) {
  const now = new Date();
  const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const nextResetMs = utcMidnight + 24 * 60 * 60 * 1000;

  const [dailyRes, allRes, topRes] = await Promise.all([
    env.DB.prepare(
      `SELECT name, score, created_at FROM scores
       WHERE created_at >= ? ORDER BY score ASC LIMIT 10`
    ).bind(utcMidnight).all(),
    env.DB.prepare(
      `SELECT name, score, created_at FROM scores ORDER BY score ASC LIMIT 10`
    ).all(),
    env.DB.prepare(
      `SELECT name, score, created_at FROM scores ORDER BY score ASC LIMIT 1`
    ).all(),
  ]);

  return json({
    daily: dailyRes.results || [],
    alltime: allRes.results || [],
    topEver: (topRes.results && topRes.results[0]) || null,
    resetsAt: nextResetMs,
    serverNow: Date.now(),
  });
}

async function postScore(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }

  const name = String(body.name ?? '').trim().slice(0, MAX_NAME_LEN) || 'anon';
  const score = Math.floor(Number(body.score));
  if (!Number.isFinite(score) || score < 1 || score > MAX_SCORE) {
    return json({ error: 'invalid score' }, 400);
  }

  const coursePar = Math.floor(Number(body.coursePar)) || 30;

  await env.DB.prepare(
    `INSERT INTO scores (name, score, course_par, created_at) VALUES (?, ?, ?, ?)`
  ).bind(name, score, coursePar, Date.now()).run();

  return getLeaderboardV2(env);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function generateRoomCode() {
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const buf = crypto.getRandomValues(new Uint8Array(4));
  let s = '';
  for (let i = 0; i < 4; i++) s += ALPHABET[buf[i] % ALPHABET.length];
  return s;
}

async function handleFeedback(request, env) {
  const body = await request.json().catch(() => ({}));
  const message = String(body.message ?? '').trim().slice(0, 4000);
  if (message.length < 3) {
    return json({ error: 'message too short' }, 400);
  }

  if (!env.GITHUB_TOKEN) {
    return json({ error: 'feedback not configured' }, 500);
  }

  const firstLine = message.split('\n')[0].slice(0, 60);
  const title = `feedback: ${firstLine}`;
  const issueBody =
    `${message}\n\n---\n_submitted via in-game feedback button_`;

  const r = await fetch(
    'https://api.github.com/repos/scottmccarrison/mini-golf/issues',
    {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'accept': 'application/vnd.github+json',
        'user-agent': 'mini-golf-feedback',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ title, body: issueBody, labels: ['feedback'] }),
    }
  );

  if (!r.ok) {
    const text = await r.text();
    return json({ error: 'github error', status: r.status, detail: text.slice(0, 500) }, 502);
  }
  const data = await r.json();
  return json({ ok: true, url: data.html_url });
}

// ---------------------------------------------------------------------------
// Editor: save a single hole by committing data/courses.json on main.
// Auth: shared secret in x-editor-key header (env.EDITOR_KEY).
// Repo write: env.GITHUB_REPO_TOKEN (fine-grained PAT, Contents:Write on
// scottmccarrison/mini-golf). Kept separate from env.GITHUB_TOKEN (which is
// the feedback Issues token) so we can scope blast radius.
// ---------------------------------------------------------------------------
async function saveHole(request, env) {
  if (!env.EDITOR_KEY || request.headers.get('x-editor-key') !== env.EDITOR_KEY) {
    return json({ error: 'unauthorized' }, 401);
  }
  if (!env.GITHUB_REPO_TOKEN) {
    return json({ error: 'editor not configured: GITHUB_REPO_TOKEN missing' }, 500);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }

  const holeIndex = Number(body.holeIndex);
  const hole = body.hole;
  if (!Number.isInteger(holeIndex) || holeIndex < 0 || holeIndex > 8) {
    return json({ error: 'holeIndex must be integer 0..8' }, 400);
  }
  const shapeError = validateHoleShape(hole);
  if (shapeError) return json({ error: shapeError }, 400);

  // 1. Fetch current data/courses.json + its SHA.
  const repo = 'scottmccarrison/mini-golf';
  const filePath = 'data/courses.json';
  const ghHeaders = {
    'authorization': `Bearer ${env.GITHUB_REPO_TOKEN}`,
    'accept': 'application/vnd.github+json',
    'user-agent': 'mini-golf-editor',
  };
  const getRes = await fetch(
    `https://api.github.com/repos/${repo}/contents/${filePath}?ref=main`,
    { headers: ghHeaders }
  );
  if (!getRes.ok) {
    const text = await getRes.text();
    return json({ error: 'github GET failed', status: getRes.status, detail: text.slice(0, 500) }, 502);
  }
  const fileMeta = await getRes.json();
  const currentSha = fileMeta.sha;
  let courses;
  try {
    courses = JSON.parse(base64ToUtf8(fileMeta.content));
  } catch (e) {
    return json({ error: 'failed to parse current courses.json', detail: String(e) }, 500);
  }
  if (!Array.isArray(courses) || courses.length !== 9) {
    return json({ error: 'unexpected courses.json shape' }, 500);
  }

  // 2. Splice in new hole, re-emit pretty JSON (preserves diff readability).
  courses[holeIndex] = hole;
  const newContent = JSON.stringify(courses, null, 2) + '\n';
  const newContentB64 = utf8ToBase64(newContent);

  // 3. PUT updated file to main.
  const safeName = String(hole.name || `hole-${holeIndex + 1}`).slice(0, 80);
  const commitMessage = `editor: update hole ${holeIndex + 1} "${safeName}"`;
  const putRes = await fetch(
    `https://api.github.com/repos/${repo}/contents/${filePath}`,
    {
      method: 'PUT',
      headers: { ...ghHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        message: commitMessage,
        content: newContentB64,
        sha: currentSha,
        branch: 'main',
      }),
    }
  );
  if (!putRes.ok) {
    const text = await putRes.text();
    return json({ error: 'github PUT failed', status: putRes.status, detail: text.slice(0, 500) }, 502);
  }
  const putData = await putRes.json();
  return json({
    ok: true,
    commitSha: putData.commit && putData.commit.sha,
    holeIndex,
    name: hole.name,
  });
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToUtf8(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function validateHoleShape(hole) {
  if (!hole || typeof hole !== 'object') return 'hole must be object';
  if (typeof hole.name !== 'string' || hole.name.length === 0) return 'hole.name required (string)';
  if (!Number.isFinite(hole.par) || hole.par < 1 || hole.par > 20) return 'hole.par must be 1..20';
  if (!Number.isFinite(hole.holeRadius) || hole.holeRadius < 4 || hole.holeRadius > 40) return 'hole.holeRadius must be 4..40';
  if (!hole.bounds || !Number.isFinite(hole.bounds.width) || !Number.isFinite(hole.bounds.height)) return 'hole.bounds.{width,height} required';
  if (hole.bounds.width < 200 || hole.bounds.height < 200) return 'hole.bounds dimensions too small (min 200)';
  if (!hole.tee || !Number.isFinite(hole.tee.x) || !Number.isFinite(hole.tee.y)) return 'hole.tee.{x,y} required';
  if (!hole.hole || !Number.isFinite(hole.hole.x) || !Number.isFinite(hole.hole.y)) return 'hole.hole.{x,y} required';
  if (hole.tee.x < 0 || hole.tee.x > hole.bounds.width) return 'hole.tee.x outside bounds';
  if (hole.tee.y < 0 || hole.tee.y > hole.bounds.height) return 'hole.tee.y outside bounds';
  if (hole.hole.x < 0 || hole.hole.x > hole.bounds.width) return 'hole.hole.x outside bounds';
  if (hole.hole.y < 0 || hole.hole.y > hole.bounds.height) return 'hole.hole.y outside bounds';
  const arrayFields = ['walls', 'bumpers', 'sandTraps', 'waterHazards', 'movingObstacles', 'slopes', 'speedPads', 'magnets', 'oneWayGates', 'teleporters'];
  for (const field of arrayFields) {
    if (hole[field] !== undefined && !Array.isArray(hole[field])) return `hole.${field} must be array`;
  }
  return null;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}
