// Room: Durable Object shell for mini golf multiplayer.
// Handles WebSocket connections between players in a room.
// Full game protocol to be implemented in a future issue.

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Internal init endpoint: POST /init { code }
    if (url.pathname.endsWith('/init') && request.method === 'POST') {
      const body = await request.json();
      await this.state.storage.put('code', body.code);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, msg) {
    // Placeholder - relay protocol to be implemented
  }

  async webSocketClose(ws, code, reason, wasClean) {
    try { ws.close(); } catch {}
  }
}
