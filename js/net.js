// Multiplayer session: wraps the WebSocket connection to a Room DO.
//
// Usage:
//   const session = createSession();
//   await session.host();   // or session.join('CODE')
//   session.on('welcome', e => ...);
//   session.on('peerJoined', e => ...);
//   session.on('peerReady', e => ...);
//   session.on('start', e => ...);
//   session.on('turnStart', e => ...);
//   session.on('shot', e => ...);
//   session.on('ballUpdate', e => ...);
//   session.on('turnComplete', e => ...);
//   session.on('holeComplete', e => ...);
//   session.on('gameOver', e => ...);
//   session.on('peerLeft', e => ...);
//   session.on('kicked', e => ...);
//   session.on('error', e => ...);
//   session.on('close', e => ...);
//   session.sendReady();
//   session.sendShot(angle, power);
//   session.sendBallUpdate(x, y, vx, vy);
//   session.sendTurnComplete(strokes, sunk);
//   session.sendKick(targetId);
//   session.close();

export function createSession() {
  const listeners = {};
  let ws = null;
  let code = null;
  let id = null;
  let isHost = false;
  let color = '#4ecdc4';
  let roster = [];
  let closed = false;

  function emit(event, payload) {
    (listeners[event] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } });
  }

  // Detect the URL prefix the page is served under (e.g. "/golf" or "/golfdev")
  // by taking the first path segment. Empty string if served from root.
  function urlPrefix() {
    const m = location.pathname.match(/^\/[^/]+/);
    return m ? m[0] : '';
  }

  function buildWsUrl(roomCode) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}${urlPrefix()}/api/room/${roomCode}`;
  }

  function buildHttpUrl(path) {
    return `${urlPrefix()}${path}`;
  }

  function attachSocket(roomCode) {
    code = roomCode;
    ws = new WebSocket(buildWsUrl(roomCode));
    ws.addEventListener('open', () => {
      const nameEl = document.getElementById('name-input');
      const name = nameEl && nameEl.value ? nameEl.value.trim().slice(0, 16) : '';
      ws.send(JSON.stringify({ type: 'hello', name }));
    });
    ws.addEventListener('message', e => {
      let data;
      try { data = JSON.parse(e.data); } catch { return; }
      switch (data.type) {
        case 'welcome':
          id = data.id;
          isHost = !!data.isHost;
          color = data.color || '#4ecdc4';
          roster = Array.isArray(data.roster) ? data.roster.slice() : [];
          emit('welcome', data);
          break;
        case 'peerJoined':
          if (!roster.some(p => p.id === data.id)) {
            roster.push({
              id: data.id,
              name: data.name || `anon${data.id}`,
              color: data.color || '#4ecdc4',
              isHost: false,
              ready: false,
            });
          }
          emit('peerJoined', data);
          break;
        case 'peerReady':
          {
            const r = roster.find(p => p.id === data.id);
            if (r) r.ready = true;
          }
          emit('peerReady', data);
          break;
        case 'peerLeft':
          roster = roster.filter(p => p.id !== data.id);
          emit('peerLeft', data);
          break;
        case 'start':
          for (const r of roster) r.ready = false;
          emit('start', data);
          break;
        case 'turnStart':
          emit('turnStart', data);
          break;
        case 'shot':
          emit('shot', data);
          break;
        case 'ballUpdate':
          emit('ballUpdate', data);
          break;
        case 'turnComplete':
          emit('turnComplete', data);
          break;
        case 'holeComplete':
          emit('holeComplete', data);
          break;
        case 'gameOver':
          emit('gameOver', data);
          break;
        case 'kicked':
          emit('kicked', data);
          break;
        case 'chat':
          emit('chat', data);
          break;
        case 'ballReset':
          emit('ballReset', data);
          break;
      }
    });
    ws.addEventListener('error', e => emit('error', e));
    ws.addEventListener('close', e => { closed = true; emit('close', e); });
  }

  return {
    on(event, fn) {
      (listeners[event] = listeners[event] || []).push(fn);
    },
    async host() {
      const resp = await fetch(buildHttpUrl('/api/room'), { method: 'POST' });
      if (!resp.ok) throw new Error('failed to create room');
      const body = await resp.json();
      attachSocket(body.code);
      return body.code;
    },
    join(roomCode) {
      attachSocket(roomCode);
    },
    sendReady() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ready' }));
        return true;
      }
      return false;
    },
    sendShot(angle, power) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'shot', angle, power }));
      }
    },
    sendBallUpdate(x, y, vx, vy) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ballUpdate', x, y, vx, vy }));
      }
    },
    sendTurnComplete(strokes, sunk) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'turnComplete', strokes, sunk }));
      }
    },
    sendKick(targetId) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'kick', targetId }));
      }
    },
    sendChat(text) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'chat', text }));
      }
    },
    sendReset(x, y) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ballReset', x, y }));
      }
    },
    close() {
      if (ws) { try { ws.close(); } catch {} }
    },
    get code() { return code; },
    get id() { return id; },
    get isHost() { return isHost; },
    get color() { return color; },
    get roster() { return roster.slice(); },
    get closed() { return closed; },
  };
}
