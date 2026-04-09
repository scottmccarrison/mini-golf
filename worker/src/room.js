// Room: Durable Object that manages a mini golf multiplayer room.
// Hibernatable WS so the DO sleeps between messages.
//
// Message protocol (JSON):
//   client -> DO: { type: 'hello', name? }
//   DO -> client: { type: 'welcome', id, isHost, color, roster, inProgress }
//   DO -> peers : { type: 'peerJoined', id, name, color }
//   client -> DO: { type: 'ready' }
//   DO -> all   : { type: 'peerReady', id }
//   DO -> all   : { type: 'start', turnOrder, currentHole }  (when all ready, >=2 players)
//   DO -> all   : { type: 'turnStart', playerId, currentHole }
//   client -> DO: { type: 'shot', angle, power }  (only current turn player)
//   DO -> all   : { type: 'shot', id, angle, power }
//   client -> DO: { type: 'ballUpdate', x, y, vx, vy }
//   DO -> others: { type: 'ballUpdate', id, x, y, vx, vy }
//   client -> DO: { type: 'turnComplete', strokes, sunk }
//   DO -> all   : { type: 'turnComplete', id, strokes, sunk }
//   DO -> all   : { type: 'holeComplete', holeIndex, scores, nextHole }  (when all done)
//   DO -> all   : { type: 'gameOver', finalScores }  (after hole 9)
//   client -> DO: { type: 'kick', targetId }  (host only)
//   DO -> target: { type: 'kicked', reason }
//   DO -> peers : { type: 'peerLeft', id, wasHost }  (on close)

const MAX_CLIENTS = 8;
const COLORS = ['#4ecdc4', '#ff6b6b', '#f9d423', '#a78bfa', '#f97316', '#06b6d4', '#ec4899', '#84cc16'];
const IDLE_TTL_MS = 10 * 60 * 1000; // 10 min before first start
const EMPTY_TTL_MS = 60 * 1000;     // 60s after empty

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // Transient cache - restored from storage on first message after hibernation
    this._hostId = null;
    this._nextId = null;
    this._inProgress = null;
    this._turnOrder = null;
    this._currentTurnIndex = null;
    this._currentHole = null;
    this._scores = null;         // { [playerId]: [strokes per hole] }
    this._holeDone = null;       // Set of playerIds who completed the current hole
  }

  // -------------------------------------------------------------------------
  // Storage helpers
  // -------------------------------------------------------------------------

  async _loadState() {
    if (this._hostId === null) {
      this._hostId = (await this.state.storage.get('hostId')) ?? null;
    }
    if (this._nextId === null) {
      this._nextId = (await this.state.storage.get('nextId')) ?? 1;
    }
    if (this._inProgress === null) {
      this._inProgress = (await this.state.storage.get('inProgress')) ?? false;
    }
    if (this._turnOrder === null) {
      this._turnOrder = (await this.state.storage.get('turnOrder')) ?? [];
    }
    if (this._currentTurnIndex === null) {
      this._currentTurnIndex = (await this.state.storage.get('currentTurnIndex')) ?? 0;
    }
    if (this._currentHole === null) {
      this._currentHole = (await this.state.storage.get('currentHole')) ?? 0;
    }
    if (this._scores === null) {
      this._scores = (await this.state.storage.get('scores')) ?? {};
    }
    if (this._holeDone === null) {
      const arr = (await this.state.storage.get('holeDone')) ?? [];
      this._holeDone = new Set(arr);
    }
  }

  async _saveGameState() {
    await this.state.storage.put('turnOrder', this._turnOrder);
    await this.state.storage.put('currentTurnIndex', this._currentTurnIndex);
    await this.state.storage.put('currentHole', this._currentHole);
    await this.state.storage.put('scores', this._scores);
    await this.state.storage.put('holeDone', [...this._holeDone]);
    await this.state.storage.put('inProgress', this._inProgress);
  }

  // -------------------------------------------------------------------------
  // HTTP fetch handler
  // -------------------------------------------------------------------------

  async fetch(request) {
    const url = new URL(request.url);

    // Internal init endpoint: POST /init { code }
    if (url.pathname.endsWith('/init') && request.method === 'POST') {
      const body = await request.json();
      await this.state.storage.put('code', body.code);
      await this.state.storage.setAlarm(Date.now() + IDLE_TTL_MS);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    await this._loadState();

    const existing = this.state.getWebSockets();
    if (existing.length >= MAX_CLIENTS) {
      return new Response('room full', { status: 409 });
    }

    // Pick lowest unused color index
    const usedColors = new Set();
    for (const ws of existing) {
      const m = ws.deserializeAttachment() || {};
      if (typeof m.colorIndex === 'number') usedColors.add(m.colorIndex);
    }
    let colorIndex = 0;
    while (colorIndex < COLORS.length && usedColors.has(colorIndex)) colorIndex++;
    if (colorIndex >= COLORS.length) colorIndex = 0;

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const id = this._nextId++;
    await this.state.storage.put('nextId', this._nextId);

    if (this._hostId === null) {
      this._hostId = id;
      await this.state.storage.put('hostId', id);
    }

    this.state.acceptWebSocket(server);
    server.serializeAttachment({
      id,
      name: null,
      colorIndex,
      color: COLORS[colorIndex],
      ready: false,
      isHost: id === this._hostId,
      turnDone: false,
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  // -------------------------------------------------------------------------
  // WebSocket message handler
  // -------------------------------------------------------------------------

  async webSocketMessage(ws, msg) {
    let data;
    try { data = JSON.parse(msg); } catch { return; }

    await this._loadState();
    const meta = ws.deserializeAttachment() || {};

    switch (data.type) {

      case 'hello': {
        let name = (typeof data.name === 'string' && data.name.trim())
          ? data.name.trim().slice(0, 16)
          : null;
        if (!name) name = `anon${meta.id}`;
        meta.name = name;
        ws.serializeAttachment(meta);

        const roster = this._buildRoster();

        ws.send(JSON.stringify({
          type: 'welcome',
          id: meta.id,
          isHost: meta.isHost,
          color: meta.color,
          roster,
          inProgress: this._inProgress,
        }));

        this._broadcastExcept(meta.id, {
          type: 'peerJoined',
          id: meta.id,
          name,
          color: meta.color,
        });
        break;
      }

      case 'ready': {
        meta.ready = true;
        ws.serializeAttachment(meta);
        this._broadcast({ type: 'peerReady', id: meta.id });
        await this._maybeStart();
        break;
      }

      case 'shot': {
        // Only the active turn player can shoot
        const activeTurnId = this._turnOrder[this._currentTurnIndex];
        if (meta.id !== activeTurnId) break;
        if (typeof data.angle !== 'number' || typeof data.power !== 'number') break;
        this._broadcast({ type: 'shot', id: meta.id, angle: data.angle, power: data.power });
        break;
      }

      case 'ballUpdate': {
        if (typeof data.x !== 'number') break;
        this._broadcastExcept(meta.id, {
          type: 'ballUpdate',
          id: meta.id,
          x: data.x,
          y: data.y,
          vx: data.vx,
          vy: data.vy,
        });
        break;
      }

      case 'turnComplete': {
        if (typeof data.strokes !== 'number') break;
        const sunk = !!data.sunk;
        const strokes = Math.max(1, Math.round(data.strokes));

        // Record score for this player on the current hole
        if (!this._scores[meta.id]) this._scores[meta.id] = [];
        this._scores[meta.id][this._currentHole] = strokes;

        // Mark this player as done for the hole
        this._holeDone.add(meta.id);

        // Relay to all clients
        this._broadcast({ type: 'turnComplete', id: meta.id, strokes, sunk });

        // Find all connected player IDs
        const connectedIds = this._getConnectedIds();

        // Advance turn to next player who hasn't finished this hole yet
        const remaining = this._turnOrder.filter(pid => connectedIds.has(pid) && !this._holeDone.has(pid));

        if (remaining.length > 0) {
          // Find next player in turn order who hasn't finished
          let nextIndex = (this._currentTurnIndex + 1) % this._turnOrder.length;
          let attempts = 0;
          while (attempts < this._turnOrder.length) {
            const candidateId = this._turnOrder[nextIndex];
            if (connectedIds.has(candidateId) && !this._holeDone.has(candidateId)) {
              break;
            }
            nextIndex = (nextIndex + 1) % this._turnOrder.length;
            attempts++;
          }
          this._currentTurnIndex = nextIndex;
          await this._saveGameState();
          this._broadcast({
            type: 'turnStart',
            playerId: this._turnOrder[this._currentTurnIndex],
            currentHole: this._currentHole,
          });
        } else {
          // All players have completed this hole
          const holeIndex = this._currentHole;
          const scores = { ...this._scores };

          if (holeIndex >= 8) {
            // Game over after hole 9 (index 8)
            await this._saveGameState();
            this._broadcast({ type: 'gameOver', finalScores: scores });
          } else {
            // Advance to next hole
            this._currentHole++;
            this._holeDone = new Set();
            // Reset turn order to first player
            this._currentTurnIndex = 0;
            await this._saveGameState();

            this._broadcast({
              type: 'holeComplete',
              holeIndex,
              scores,
              nextHole: this._currentHole,
            });

            // Start first turn on new hole
            const firstPlayerId = this._turnOrder[0];
            if (connectedIds.has(firstPlayerId)) {
              this._broadcast({
                type: 'turnStart',
                playerId: firstPlayerId,
                currentHole: this._currentHole,
              });
            }
          }
        }
        break;
      }

      case 'chat': {
        if (typeof data.text !== 'string') break;
        const text = data.text.trim().slice(0, 200);
        if (!text) break;
        // Rate limit: 1 message per second per client
        const now = Date.now();
        if (meta.lastChatAt && now - meta.lastChatAt < 1000) break;
        meta.lastChatAt = now;
        ws.serializeAttachment(meta);
        this._broadcast({ type: 'chat', id: meta.id, name: meta.name, text });
        break;
      }

      case 'kick': {
        if (!meta.isHost) break;
        const targetId = data.targetId;
        if (typeof targetId !== 'number') break;
        for (const ws2 of this.state.getWebSockets()) {
          const m2 = ws2.deserializeAttachment() || {};
          if (m2.id === targetId && !m2.isHost) {
            try { ws2.send(JSON.stringify({ type: 'kicked', reason: 'host' })); } catch {}
            try { ws2.close(1000, 'kicked'); } catch {}
            break;
          }
        }
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // WebSocket close handler
  // -------------------------------------------------------------------------

  async webSocketClose(ws, code, reason, wasClean) {
    const meta = ws.deserializeAttachment() || {};
    const wasHost = meta.isHost === true;
    try { ws.close(); } catch {}
    this._broadcast({ type: 'peerLeft', id: meta.id, wasHost });

    if (this.state.getWebSockets().length === 0) {
      await this.state.storage.setAlarm(Date.now() + EMPTY_TTL_MS);
      return;
    }

    // If a leaver tips ready state, try to start
    await this._maybeStart();
  }

  async webSocketError(ws, err) {
    try { ws.close(); } catch {}
  }

  // -------------------------------------------------------------------------
  // Alarm handler - clean up idle/empty rooms
  // -------------------------------------------------------------------------

  async alarm() {
    if (this.state.getWebSockets().length === 0) {
      await this.state.storage.deleteAll();
    }
  }

  // -------------------------------------------------------------------------
  // Game start logic
  // -------------------------------------------------------------------------

  async _maybeStart() {
    const all = this._getAllMeta();
    if (all.length < 2 || !all.every(m => m.ready)) return;

    // Reset ready flags
    for (const ws of this.state.getWebSockets()) {
      const m = ws.deserializeAttachment() || {};
      m.ready = false;
      ws.serializeAttachment(m);
    }

    // Build randomized turn order
    const ids = all.map(m => m.id);
    // Fisher-Yates shuffle
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }

    this._turnOrder = ids;
    this._currentTurnIndex = 0;
    this._currentHole = 0;
    this._scores = {};
    this._holeDone = new Set();
    this._inProgress = true;

    await this._saveGameState();
    await this.state.storage.deleteAlarm();

    this._broadcast({ type: 'start', turnOrder: this._turnOrder, currentHole: 0 });
    this._broadcast({
      type: 'turnStart',
      playerId: this._turnOrder[0],
      currentHole: 0,
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  _getAllMeta() {
    return this.state.getWebSockets().map(ws => ws.deserializeAttachment() || {});
  }

  _buildRoster() {
    return this._getAllMeta()
      .sort((a, b) => a.id - b.id)
      .map(m => ({
        id: m.id,
        name: m.name,
        color: m.color,
        isHost: !!m.isHost,
        ready: !!m.ready,
      }));
  }

  _getConnectedIds() {
    return new Set(this._getAllMeta().map(m => m.id));
  }

  _broadcast(obj) {
    const msg = JSON.stringify(obj);
    for (const ws of this.state.getWebSockets()) {
      try { ws.send(msg); } catch {}
    }
  }

  _broadcastExcept(excludeId, obj) {
    const msg = JSON.stringify(obj);
    for (const ws of this.state.getWebSockets()) {
      const m = ws.deserializeAttachment() || {};
      if (m.id !== excludeId) {
        try { ws.send(msg); } catch {}
      }
    }
  }
}
