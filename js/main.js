// Mini Golf - main entry point
// Wires together physics, input, rendering, and game state machine.

import { COURSES } from './courses.js';
import { DT } from './physics.js';
import { initInput, getInput, resetInput, setEnabled } from './input.js';
import { render, worldToScreen, screenToWorld } from './render.js';
import { createGame, updateGame } from './game.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let viewport = { w: 0, h: 0, dpr: 1 };
let game = createGame();
let lastTime = 0;
let accumulator = 0;

// ---------------------------------------------------------------------------
// Player name persistence
// ---------------------------------------------------------------------------

const nameInput = document.getElementById('name-input');
const savedName = localStorage.getItem('golf-name') || '';
nameInput.value = savedName;
game.playerName = savedName;
nameInput.addEventListener('input', () => {
  const name = nameInput.value.slice(0, 4).toUpperCase();
  nameInput.value = name;
  game.playerName = name;
  localStorage.setItem('golf-name', name);
});

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

// Title/gameover tap-to-start handler (canvas click)
canvas.addEventListener('pointerdown', () => {
  if (game.state === 'title' || game.state === 'gameover') {
    game.titleStart = true;
  }
});

// Spacebar to start from title or gameover
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && (game.state === 'title' || game.state === 'gameover')) {
    game.titleStart = true;
    e.preventDefault();
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

  // Fixed-timestep physics updates
  while (accumulator >= DT) {
    game = updateGame(game, rawInput, viewport, DT);
    accumulator -= DT;
  }

  // Reset input AFTER processing a released shot so the state machine saw it
  if (rawInput.released) {
    resetInput();
  }

  // Render current frame
  render(ctx, game, viewport);

  requestAnimationFrame(gameLoop);
}

// ---------------------------------------------------------------------------
// iOS gesture prevention
// ---------------------------------------------------------------------------

document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// Block iOS double-tap zoom
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd < 350) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);

resize();
requestAnimationFrame(gameLoop);
