// golf-api worker (also used by golfdev-api via wrangler.dev.toml).
// Path prefix is read from env.PATH_PREFIX (defaults to "/golf") so the same
// code can serve mccarrison.me/golf (prod) and mccarrison.me/golfdev (dev).
// Routes (relative to the prefix):
//   POST /api/room             -> create room, returns { code }
//   GET  /api/room/{CODE}      -> WebSocket upgrade to Room DO
//   GET  /api/leaderboard      -> top 10 scores (placeholder)
//   POST /api/score            -> submit score (placeholder)
//   POST /api/feedback         -> submit feedback (placeholder)
//   *                          -> serves static assets from ../

export { Room } from './room.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const prefix = (env.PATH_PREFIX || '/golf');

    // Redirect bare prefix to prefix + '/' so relative asset paths resolve.
    if (url.pathname === prefix) {
      return Response.redirect(url.origin + prefix + '/', 301);
    }

    // Strip the configured prefix when bound to mccarrison.me/<prefix>/*
    let path = url.pathname;
    if (path.startsWith(prefix + '/')) path = path.slice(prefix.length) || '/';

    if (path === '/api/leaderboard' && request.method === 'GET') {
      return json({ scores: [] });
    }

    if (path === '/api/score' && request.method === 'POST') {
      return json({ ok: true });
    }

    if (path === '/api/feedback' && request.method === 'POST') {
      return json({ ok: true });
    }

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

    const roomMatch = path.match(/^\/api\/room\/([A-Z]{4})$/);
    if (roomMatch && request.headers.get('Upgrade') === 'websocket') {
      const code = roomMatch[1];
      const id = env.ROOMS.idFromName(code);
      const stub = env.ROOMS.get(id);
      return stub.fetch(request);
    }

    // Static assets - rewrite the request URL so the asset bundle (which
    // has files at /js/main.js, /css/style.css, etc.) is asked for the
    // stripped path, not the /golf-prefixed one.
    const assetUrl = new URL(request.url);
    assetUrl.pathname = path;
    return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
  },
};

function generateRoomCode() {
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const buf = crypto.getRandomValues(new Uint8Array(4));
  let s = '';
  for (let i = 0; i < 4; i++) s += ALPHABET[buf[i] % ALPHABET.length];
  return s;
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
