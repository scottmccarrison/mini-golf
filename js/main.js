// Mini Golf - main entry point
// Wires together physics, input, rendering, and game state machine.

import { COURSES } from './courses.js';
import { DT } from './physics.js';
import { initInput, getInput, resetInput, setEnabled } from './input.js';
import { render, worldToScreen, screenToWorld } from './render.js';
import { createGame, updateGame, startMultiplayerGame, applyShot, applyBallUpdate, applyTurnComplete, applyTurnStart, applyHoleComplete, applyGameOver, addChatMessage } from './game.js';
import { createSession } from './net.js';
import { fetchLeaderboard, submitScore, recordPersonalBest, getPersonalBests } from './leaderboard.js';
import { CHANGELOG } from './changelog.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let viewport = { w: 0, h: 0, dpr: 1 };
let game = createGame();

// Debug: expose game for console inspection. Remove before prod deploy.
window._dbg = {
  get game() { return game; },
  jumpToHole(n) {
    game.state = 'aiming';
    game.currentHole = n;
    game.strokes = 0;
    game.trail = [];
    const c = COURSES[n];
    if (c) { game.ball = { x: c.tee.x, y: c.tee.y, vx: 0, vy: 0 }; }
    game.zoom = { level: 1, panX: 0, panY: 0 };
  },
};
let lastTime = 0;
let accumulator = 0;

// ---------------------------------------------------------------------------
// Leaderboard - fetch on load
// ---------------------------------------------------------------------------

fetchLeaderboard().then(board => {
  if (board) game._leaderboard = board;
});
game._personalBests = getPersonalBests();

// ---------------------------------------------------------------------------
// Player name persistence
// ---------------------------------------------------------------------------

const nameInput = document.getElementById('name-input');
const savedName = localStorage.getItem('golf-name') || '';
nameInput.value = savedName;
game.playerName = savedName;
nameInput.addEventListener('input', () => {
  const name = nameInput.value.slice(0, 10);
  nameInput.value = name;
  game.playerName = name;
  localStorage.setItem('golf-name', name);
});

// ---------------------------------------------------------------------------
// Multiplayer session state
// ---------------------------------------------------------------------------

let session = null;

// Ball update throttle - send ~10 updates/sec during rolling
let _ballUpdateTick = 0;
const BALL_UPDATE_INTERVAL = 6; // every 6 physics steps at 60fps = 10/sec

// Track when we've sent turnComplete for the current turn (avoid double-send)
let _sentTurnComplete = false;

// ---------------------------------------------------------------------------
// Multiplayer UI helpers
// ---------------------------------------------------------------------------

function showMpModal() {
  document.getElementById('mp-modal').classList.remove('hidden');
}

function hideMpModal() {
  document.getElementById('mp-modal').classList.add('hidden');
}

function resetMpModal() {
  document.getElementById('mp-pre-join').classList.remove('hidden');
  document.getElementById('mp-roster-wrap').classList.add('hidden');
  document.getElementById('mp-code-row').classList.add('hidden');
  document.getElementById('mp-ready').classList.add('hidden');
  document.getElementById('mp-ready').disabled = true;
  document.getElementById('mp-status').textContent = '\u00a0';
  document.getElementById('mp-code-display').textContent = '';
  document.getElementById('mp-roster').innerHTML = '';
  document.getElementById('mp-roster-count').textContent = '0';
}

function renderMpRoster(roster, myId) {
  const container = document.getElementById('mp-roster');
  const countEl = document.getElementById('mp-roster-count');
  countEl.textContent = `${roster.length}`;
  container.innerHTML = '';
  for (const player of roster) {
    const row = document.createElement('div');
    row.className = 'mp-row' + (player.id === myId ? ' mp-row-self' : '');
    row.dataset.playerId = player.id;

    const swatch = document.createElement('span');
    swatch.className = 'mp-swatch';
    swatch.style.background = player.color;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'mp-name';
    nameSpan.textContent = player.name || `anon${player.id}`;

    const hostTag = player.isHost ? ' <span class="mp-tag">(host)</span>' : '';

    const readyIcon = document.createElement('span');
    readyIcon.className = 'mp-ready-icon';
    readyIcon.textContent = player.ready ? '\u2713' : '';

    row.appendChild(swatch);
    row.appendChild(nameSpan);
    if (player.isHost) {
      const tag = document.createElement('span');
      tag.className = 'mp-tag';
      tag.textContent = '(host)';
      row.appendChild(tag);
    }
    row.appendChild(readyIcon);
    container.appendChild(row);
  }
}

function updatePlayerReadyIcon(playerId, isReady) {
  const row = document.querySelector(`[data-player-id="${playerId}"] .mp-ready-icon`);
  if (row) row.textContent = isReady ? '\u2713' : '';
}

// ---------------------------------------------------------------------------
// Wire a session to game events
// ---------------------------------------------------------------------------

function wireSession(sess) {
  sess.on('welcome', data => {
    document.getElementById('mp-pre-join').classList.add('hidden');
    document.getElementById('mp-roster-wrap').classList.remove('hidden');
    document.getElementById('mp-ready').classList.remove('hidden');
    document.getElementById('mp-ready').disabled = false;
    document.getElementById('mp-status').textContent = 'Waiting for players...';
    renderMpRoster(data.roster, data.id);
  });

  sess.on('peerJoined', () => {
    renderMpRoster(sess.roster, sess.id);
  });

  sess.on('peerLeft', () => {
    renderMpRoster(sess.roster, sess.id);
  });

  sess.on('peerReady', data => {
    updatePlayerReadyIcon(data.id, true);
    document.getElementById('mp-status').textContent = 'Some players are ready...';
  });

  sess.on('start', data => {
    hideMpModal();
    _sentTurnComplete = false;

    const players = sess.roster.map(p => ({
      id: p.id,
      name: p.name || `anon${p.id}`,
      color: p.color,
    }));

    startMultiplayerGame(game, data.turnOrder, sess.id, players, sess.code);

    // Clear chat for new game
    chatMessages.innerHTML = '';
    game.chatMessages = [];
  });

  sess.on('turnStart', data => {
    _sentTurnComplete = false;
    applyTurnStart(game, data.playerId, data.currentHole, data.playerId === sess.id);
  });

  sess.on('shot', data => {
    applyShot(game, data.id, data.angle, data.power);
  });

  sess.on('ballUpdate', data => {
    applyBallUpdate(game, data.id, data.x, data.y, data.vx, data.vy);
  });

  sess.on('turnComplete', data => {
    applyTurnComplete(game, data.id, data.strokes, data.sunk);
  });

  sess.on('holeComplete', data => {
    applyHoleComplete(game, data.holeIndex, data.scores, data.nextHole);
  });

  sess.on('gameOver', data => {
    applyGameOver(game, data.finalScores);
    session = null;
  });

  sess.on('kicked', () => {
    hideMpModal();
    resetMpModal();
    session = null;
    game = createGame();
  });

  sess.on('close', () => {
    if (session === sess) {
      session = null;
    }
  });

  sess.on('error', () => {
    document.getElementById('mp-status').textContent = 'Connection error. Please try again.';
  });

  sess.on('chat', data => {
    // Skip own messages - already added optimistically in sendChatMessage()
    if (data.id === sess.id) return;
    addChatMessage(game, data.id, data.name, data.text);
    appendChatMessageToDOM(data.name, data.text, data.id);
    // Flash unread indicator if chat is closed
    if (!chatOpen) {
      document.getElementById('chat-toggle').classList.add('has-unread');
    }
  });

  sess.on('ballReset', data => {
    // Skip own reset - already applied locally
    if (data.id === sess.id) return;
    // Apply reset to the remote player's ball
    if (game.balls && game.balls[data.id]) {
      game.balls[data.id].x = data.x;
      game.balls[data.id].y = data.y;
      game.balls[data.id].vx = 0;
      game.balls[data.id].vy = 0;
    }
  });
}

// ---------------------------------------------------------------------------
// Multiplayer button handlers
// ---------------------------------------------------------------------------

const mpModal = document.getElementById('mp-modal');
const titleButtons = document.getElementById('title-buttons');
const btnSolo = document.getElementById('btn-solo');
const btnMulti = document.getElementById('btn-multi');

function showTitleButtons() { titleButtons.classList.remove('hidden'); }
function hideTitleButtons() { titleButtons.classList.add('hidden'); }

btnSolo.addEventListener('click', () => {
  game.titleStart = true;
  hideTitleButtons();
});

btnMulti.addEventListener('click', () => {
  hideTitleButtons();
  resetMpModal();
  showMpModal();
});

document.getElementById('mp-host').addEventListener('click', async () => {
  if (session) { session.close(); session = null; }
  session = createSession();
  wireSession(session);
  document.getElementById('mp-status').textContent = 'Creating room...';
  try {
    const code = await session.host();
    document.getElementById('mp-code-row').classList.remove('hidden');
    document.getElementById('mp-code-display').textContent = code;
  } catch (e) {
    document.getElementById('mp-status').textContent = 'Failed to create room.';
    session = null;
  }
});

document.getElementById('mp-join-go').addEventListener('click', () => {
  const codeInput = document.getElementById('mp-code-input');
  const code = codeInput.value.toUpperCase().trim();
  if (code.length !== 4) {
    document.getElementById('mp-status').textContent = 'Enter a 4-letter code.';
    return;
  }
  if (session) { session.close(); session = null; }
  session = createSession();
  wireSession(session);
  document.getElementById('mp-status').textContent = 'Joining room...';
  session.join(code);
});

document.getElementById('mp-ready').addEventListener('click', () => {
  if (session) {
    session.sendReady();
    document.getElementById('mp-ready').disabled = true;
    document.getElementById('mp-status').textContent = 'Waiting for others...';
  }
});

document.getElementById('mp-cancel').addEventListener('click', () => {
  if (session) { session.close(); session = null; }
  resetMpModal();
  hideMpModal();
  showTitleButtons();
});

// Force uppercase on join code input
document.getElementById('mp-code-input').addEventListener('input', (e) => {
  e.target.value = e.target.value.toUpperCase();
});

// ---------------------------------------------------------------------------
// Leaderboard modal
// ---------------------------------------------------------------------------

const lbModal = document.getElementById('lb-modal');
const lbList = document.getElementById('lb-list');
let lbActiveTab = 'daily';

document.getElementById('btn-lb').addEventListener('click', () => {
  hideTitleButtons();
  lbModal.classList.remove('hidden');
  refreshLbModal();
});

document.getElementById('lb-close').addEventListener('click', () => {
  lbModal.classList.add('hidden');
  showTitleButtons();
});

// Tab switching
for (const tab of document.querySelectorAll('.lb-tab')) {
  tab.addEventListener('click', () => {
    lbActiveTab = tab.dataset.tab;
    for (const t of document.querySelectorAll('.lb-tab')) t.classList.remove('active');
    tab.classList.add('active');
    renderLbList();
  });
}

function refreshLbModal() {
  // Re-fetch leaderboard when opening
  fetchLeaderboard().then(board => {
    if (board) game._leaderboard = board;
    game._personalBests = getPersonalBests();
    renderLbList();
  });
  renderLbList(); // show cached data immediately
}

function renderLbList() {
  const board = game._leaderboard;
  let entries = [];

  if (lbActiveTab === 'daily') {
    entries = board ? board.daily : [];
  } else if (lbActiveTab === 'alltime') {
    entries = board ? board.alltime : [];
  } else {
    entries = (game._personalBests || []).map(e => ({ name: game.playerName || 'You', score: e.score }));
  }

  if (!entries || entries.length === 0) {
    lbList.innerHTML = '<div class="lb-empty">No scores yet</div>';
    return;
  }

  lbList.innerHTML = entries.slice(0, 10).map((e, i) => `
    <div class="lb-row">
      <span class="lb-rank">${i + 1}.</span>
      <span class="lb-row-name">${escapeHtml(e.name || 'anon')}</span>
      <span class="lb-row-score">${e.score}</span>
    </div>
  `).join('');
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// How to Play modal
// ---------------------------------------------------------------------------

const htpModal = document.getElementById('htp-modal');

document.getElementById('btn-htp').addEventListener('click', () => {
  hideTitleButtons();
  htpModal.classList.remove('hidden');
});

document.getElementById('htp-close').addEventListener('click', () => {
  htpModal.classList.add('hidden');
  showTitleButtons();
});

// ---------------------------------------------------------------------------
// Feedback / What's New modal
// ---------------------------------------------------------------------------

const fbModal = document.getElementById('feedback-modal');
const fbText = document.getElementById('fb-text');
const fbStatus = document.getElementById('fb-status');
const fbSend = document.getElementById('fb-send');
const fbCancel = document.getElementById('fb-cancel');
const clBody = document.getElementById('changelog-body');

// Render changelog
function renderChangelog() {
  if (!clBody) return;
  clBody.innerHTML = CHANGELOG.map(v => {
    const items = v.items.map(i => `<li>${escapeHtml(i)}</li>`).join('');
    return `<div class="cl-version"><div class="cl-ver">${escapeHtml(v.version)}</div><ul>${items}</ul></div>`;
  }).join('');
}
renderChangelog();

function openFeedback() {
  fbModal.classList.remove('hidden');
  fbText.value = '';
  fbStatus.textContent = '';
  fbSend.disabled = false;
  fbCancel.disabled = false;
}

function closeFeedback() {
  fbModal.classList.add('hidden');
}

document.getElementById('help-btn').addEventListener('click', openFeedback);
fbCancel.addEventListener('click', closeFeedback);
fbModal.addEventListener('click', (e) => { if (e.target === fbModal) closeFeedback(); });

fbSend.addEventListener('click', async () => {
  const message = fbText.value.trim();
  if (message.length < 3) {
    fbStatus.textContent = 'add a few more words first';
    return;
  }
  fbSend.disabled = true;
  fbCancel.disabled = true;
  fbStatus.textContent = 'sending...';
  try {
    const seg = location.pathname.split('/')[1] || '';
    const apiBase = (seg === 'golf' || seg === 'golfdev') ? `/${seg}/api` : '/api';
    const r = await fetch(`${apiBase}/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (!r.ok) throw new Error('http ' + r.status);
    fbStatus.textContent = 'thanks! sent.';
    setTimeout(closeFeedback, 900);
  } catch (e) {
    fbStatus.textContent = 'failed to send - try again later';
    fbSend.disabled = false;
    fbCancel.disabled = false;
  }
});

// ---------------------------------------------------------------------------
// Reset button
// ---------------------------------------------------------------------------

const resetBtn = document.getElementById('reset-btn');

function doResetBall() {
  const course = COURSES[game.currentHole];
  if (!course) return;
  const tee = course.tee;
  game.ball.x = tee.x;
  game.ball.y = tee.y;
  game.ball.vx = 0;
  game.ball.vy = 0;
  game.trail = [];
  game._trailStepCount = 0;
  // C2: keep game.balls[myId] in sync with game.ball in MP mode
  if (game.balls && game.myId != null) {
    game.balls[game.myId] = { x: tee.x, y: tee.y, vx: 0, vy: 0 };
  }
  // H3: clear animation timers so hazard/sink can't overwrite the reset position
  game.animState.sinkTimer = 0;
  game.animState.hazardTimer = 0;
  game.animState.shakeMagnitude = 0;
  // M3: update lastBallPos so hazard recovery restores to the tee, not the old position
  game.lastBallPos = { x: tee.x, y: tee.y };
  // Cancel any active aim gesture
  resetInput();
}

resetBtn.addEventListener('click', () => {
  if (resetBtn.disabled) return;

  if (game.mode === 'mp') {
    // MP: only allowed when it's our turn and the ball is at rest
    const isMyTurn = game.currentTurnPlayerId === (session && session.id);
    const atRest = game.ball.vx === 0 && game.ball.vy === 0;
    if (!isMyTurn || !atRest) return;
    const course = COURSES[game.currentHole];
    if (course) {
      doResetBall();
      session.sendReset(course.tee.x, course.tee.y);
    }
  } else {
    // Solo: always allowed during play
    doResetBall();
  }
});

// ---------------------------------------------------------------------------
// Chat UI
// ---------------------------------------------------------------------------

const chatToggle = document.getElementById('chat-toggle');
const chatPanel = document.getElementById('chat-panel');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const chatMessages = document.getElementById('chat-messages');
let chatOpen = false;

chatToggle.addEventListener('click', () => {
  chatOpen = !chatOpen;
  chatPanel.classList.toggle('hidden', !chatOpen);
  chatToggle.classList.remove('has-unread');
  if (chatOpen) {
    chatInput.focus();
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
});

function sendChatMessage() {
  const text = chatInput.value.trim();
  if (!text || !session) return;
  session.sendChat(text);
  // Optimistic local echo
  addChatMessage(game, session.id, game.playerName || 'You', text);
  appendChatMessageToDOM(game.playerName || 'You', text, session.id);
  chatInput.value = '';
}

chatSend.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendChatMessage();
  }
  // Prevent game input while typing
  e.stopPropagation();
});

function appendChatMessageToDOM(name, text, playerId) {
  const div = document.createElement('div');
  div.className = 'chat-msg';
  const nameSpan = document.createElement('span');
  nameSpan.className = 'chat-name';
  // Find player color
  const player = (game.players || []).find(p => p.id === playerId);
  nameSpan.style.color = player ? player.color : '#4ecdc4';
  nameSpan.textContent = name;
  div.appendChild(nameSpan);
  div.appendChild(document.createTextNode(text));
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  // Trim old DOM messages
  while (chatMessages.children.length > 50) {
    chatMessages.removeChild(chatMessages.firstChild);
  }
}

// ---------------------------------------------------------------------------
// Viewport resize
// ---------------------------------------------------------------------------

function resize() {
  const dpr = window.devicePixelRatio || 1;
  viewport.w = window.innerWidth;
  viewport.h = window.innerHeight;
  viewport.dpr = dpr;
  canvas.width = Math.floor(viewport.w * dpr);
  canvas.height = Math.floor(viewport.h * dpr);
  canvas.style.width = viewport.w + 'px';
  canvas.style.height = viewport.h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ---------------------------------------------------------------------------
// Input initialization
// ---------------------------------------------------------------------------

// getBallPos returns ball position in screen CSS pixels for the input system
initInput(canvas, () => {
  if (!game.ball) return { x: viewport.w / 2, y: viewport.h / 2 };
  return worldToScreen(game.ball.x, game.ball.y, game, viewport);
});

// Spacebar starts solo from title, restarts from gameover
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    if (game.state === 'title') {
      game.titleStart = true;
      hideTitleButtons();
      e.preventDefault();
    } else if (game.state === 'gameover') {
      game.titleStart = true;
      e.preventDefault();
    }
  }
});

// Show title buttons when returning to title or gameover
canvas.addEventListener('pointerdown', () => {
  if (game.state === 'gameover') {
    game.titleStart = true;
  }
});

// ---------------------------------------------------------------------------
// Game loop
// ---------------------------------------------------------------------------

function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const frameTime = Math.min((timestamp - lastTime) / 1000, 0.1); // cap at 100ms
  lastTime = timestamp;

  accumulator += frameTime;

  const rawInput = getInput();

  // Enable input only when the player can aim
  setEnabled(game.state === 'aiming');

  // Capture shot before updateGame transitions state from aiming to rolling
  const wasAiming = game.state === 'aiming';
  const shotFired = wasAiming && rawInput.released && rawInput.shotPower > 0;
  const capturedAngle = rawInput.shotAngle;
  const capturedPower = rawInput.shotPower;

  // Fixed-timestep physics updates
  while (accumulator >= DT) {
    game = updateGame(game, rawInput, viewport, DT);
    accumulator -= DT;

    // Multiplayer: send ball position while rolling (~10/sec)
    if (session && game.mode === 'mp' && game.state === 'rolling') {
      _ballUpdateTick++;
      if (_ballUpdateTick >= BALL_UPDATE_INTERVAL) {
        _ballUpdateTick = 0;
        session.sendBallUpdate(game.ball.x, game.ball.y, game.ball.vx, game.ball.vy);
      }
    }
  }

  // Multiplayer: send shot after state transitions to rolling
  if (session && game.mode === 'mp' && shotFired && game.state === 'rolling') {
    session.sendShot(capturedAngle, capturedPower);
    _ballUpdateTick = 0;
  }

  // Multiplayer: detect when our ball has stopped or sunk (rolling -> aiming/sunk/hazard)
  if (session && game.mode === 'mp' && !_sentTurnComplete) {
    const wasRolling = wasAiming === false; // slightly roundabout but safe
    // Check if we just transitioned OUT of rolling
    if (game.state === 'aiming' || game.state === 'sunk' || game.state === 'hazard') {
      // We came from rolling if we got here (updateGame transitions rolling -> these)
      // Use a flag on game to track this
      if (game._wasRolling) {
        game._wasRolling = false;
        _sentTurnComplete = true;
        const sunk = game.state === 'sunk';
        session.sendTurnComplete(game.strokes, sunk);
      }
    }
    if (game.state === 'rolling') {
      game._wasRolling = true;
    }
  }

  // Reset input AFTER processing a released shot so the state machine saw it
  if (rawInput.released) {
    resetInput();
  }

  // Sync title button visibility
  if (game.state === 'title') {
    showTitleButtons();
    document.body.classList.remove('game-active');
  } else if (game.state === 'gameover' && game.mode === 'solo') {
    showTitleButtons();
    document.body.classList.remove('game-active');
  } else {
    hideTitleButtons();
    document.body.classList.add('game-active');
  }

  // Auto-submit score on game over (solo only, once)
  if (game.state === 'gameover' && !game._scoreSubmitted) {
    game._scoreSubmitted = true;
    const totalScore = game.scorecard.reduce((s, v) => s + (v || 0), 0);
    const totalPar = COURSES.reduce((s, c) => s + c.par, 0);
    const name = game.playerName || 'anon';
    if (totalScore > 0) {
      recordPersonalBest(totalScore);
      submitScore(name, totalScore, totalPar).then(board => {
        if (board) game._leaderboard = board;
      });
    }
  }

  // Show chat toggle only in multiplayer during active game
  const chatToggleEl = document.getElementById('chat-toggle');
  if (game.mode === 'mp' && game.state !== 'title' && game.state !== 'gameover') {
    chatToggleEl.classList.remove('hidden');
  } else {
    chatToggleEl.classList.add('hidden');
    chatPanel.classList.add('hidden');
    chatOpen = false;
  }

  // Show reset button only when the ball is at rest and the player can act.
  // Blocked during animations/transitions: sunk, nextHole, flyover, hazard, rolling.
  const activePlay = game.state === 'aiming';
  if (activePlay) {
    resetBtn.classList.remove('hidden');
    if (game.mode === 'mp') {
      // MP: enabled only on our turn while ball is at rest
      const isMyTurn = game.currentTurnPlayerId === (session && session.id);
      const atRest = game.ball.vx === 0 && game.ball.vy === 0;
      resetBtn.disabled = !(isMyTurn && atRest);
    } else {
      resetBtn.disabled = false;
    }
  } else {
    resetBtn.classList.add('hidden');
    resetBtn.disabled = true;
  }

  // Render current frame
  render(ctx, game, viewport);

  requestAnimationFrame(gameLoop);
}

// ---------------------------------------------------------------------------
// Pinch-to-zoom and pan
// ---------------------------------------------------------------------------

let pinchStartDist = 0;
let pinchStartZoom = 1;
let pinchStartPan = { x: 0, y: 0 };
let pinchStartMid = { x: 0, y: 0 };

function getTouchDist(t1, t2) {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getTouchMid(t1, t2) {
  return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
}

canvas.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    pinchStartDist = getTouchDist(e.touches[0], e.touches[1]);
    pinchStartZoom = game.zoom.level;
    pinchStartPan = { x: game.zoom.panX, y: game.zoom.panY };
    pinchStartMid = getTouchMid(e.touches[0], e.touches[1]);
    e.preventDefault();
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2) {
    const dist = getTouchDist(e.touches[0], e.touches[1]);
    const mid = getTouchMid(e.touches[0], e.touches[1]);
    const scaleFactor = dist / pinchStartDist;
    game.zoom.level = Math.max(1, Math.min(4, pinchStartZoom * scaleFactor));
    game.zoom.panX = pinchStartPan.x + (mid.x - pinchStartMid.x);
    game.zoom.panY = pinchStartPan.y + (mid.y - pinchStartMid.y);
    e.preventDefault();
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  // Snap back to 1x if barely zoomed
  if (e.touches.length < 2 && game.zoom.level < 1.1) {
    game.zoom.level = 1;
    game.zoom.panX = 0;
    game.zoom.panY = 0;
  }
}, { passive: false });

// Double-tap to reset zoom
let lastTapTime = 0;
canvas.addEventListener('touchend', (e) => {
  if (e.touches.length === 0 && e.changedTouches.length === 1) {
    const now = Date.now();
    if (now - lastTapTime < 300 && game.zoom.level > 1) {
      game.zoom.level = 1;
      game.zoom.panX = 0;
      game.zoom.panY = 0;
      e.preventDefault();
    }
    lastTapTime = now;
  }
}, { passive: false });

// ---------------------------------------------------------------------------
// iOS gesture prevention
// ---------------------------------------------------------------------------

document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);

resize();
requestAnimationFrame(gameLoop);
