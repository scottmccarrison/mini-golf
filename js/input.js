// input.js - Slingshot drag-to-aim input system
// Player clicks/touches near ball and drags backward; ball fires in opposite direction.

export const MAX_DRAG = 150;       // max drag distance in px
export const DEAD_ZONE = 10;       // minimum drag to register a shot
export const BALL_HIT_RADIUS = 40; // how close to ball the click must be

// Internal state
let state = {
  aiming: false,
  aimStart: null,
  aimCurrent: null,
  released: false,
  shotAngle: 0,
  shotPower: 0,
  dragAngle: 0,
  dragDistance: 0,
};

let enabled = true;
let activePointerId = null;
let _canvas = null;
let _getBallPos = null;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Convert a page-coordinate pointer event to canvas-relative CSS pixel coordinates.
function toCanvasCoords(event) {
  const rect = _canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function updateDragState(current) {
  state.aimCurrent = current;

  const dx = current.x - state.aimStart.x;
  const dy = current.y - state.aimStart.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  state.dragDistance = dist;
  state.dragAngle = Math.atan2(dy, dx);
  state.shotAngle = state.dragAngle + Math.PI;
  state.shotPower = clamp(
    (dist - DEAD_ZONE) / (MAX_DRAG - DEAD_ZONE),
    0,
    1
  );
}

function onPointerDown(event) {
  if (!enabled) return;

  // Only track the first touch/pointer
  if (activePointerId !== null) return;

  const coords = toCanvasCoords(event);
  const ballPos = _getBallPos();

  if (distance(coords, ballPos) > BALL_HIT_RADIUS) return;

  activePointerId = event.pointerId;
  _canvas.setPointerCapture(event.pointerId);

  state.aiming = true;
  state.aimStart = { x: ballPos.x, y: ballPos.y };
  state.aimCurrent = { x: ballPos.x, y: ballPos.y };
  state.released = false;
  state.shotAngle = 0;
  state.shotPower = 0;
  state.dragAngle = 0;
  state.dragDistance = 0;

  event.preventDefault();
}

function onPointerMove(event) {
  if (!enabled) return;
  if (!state.aiming) return;
  if (event.pointerId !== activePointerId) return;

  updateDragState(toCanvasCoords(event));
  event.preventDefault();
}

function onPointerUp(event) {
  if (!enabled) return;
  if (!state.aiming) return;
  if (event.pointerId !== activePointerId) return;

  activePointerId = null;
  state.aiming = false;

  if (state.dragDistance > DEAD_ZONE) {
    state.released = true;
  } else {
    // Too short - cancel the aim without firing
    state.aimStart = null;
    state.aimCurrent = null;
    state.dragDistance = 0;
    state.shotPower = 0;
  }
}

function onPointerCancel(event) {
  if (event.pointerId !== activePointerId) return;
  cancelAim();
}

function onBlur() {
  cancelAim();
}

function cancelAim() {
  activePointerId = null;
  state.aiming = false;
  state.aimStart = null;
  state.aimCurrent = null;
  state.released = false;
  state.shotAngle = 0;
  state.shotPower = 0;
  state.dragAngle = 0;
  state.dragDistance = 0;
}

/**
 * Attach input event listeners to the canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {() => {x: number, y: number}} getBallPos - returns ball position in canvas CSS pixels
 */
export function initInput(canvas, getBallPos) {
  _canvas = canvas;
  _getBallPos = getBallPos;

  // Reinforce touch-action none (CSS should also set this, but belt-and-suspenders)
  canvas.style.touchAction = 'none';

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);

  // Prevent scroll/zoom on touch
  canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  window.addEventListener('blur', onBlur);
}

/**
 * Returns a snapshot of the current input state.
 * @returns {{
 *   aiming: boolean,
 *   aimStart: {x:number, y:number}|null,
 *   aimCurrent: {x:number, y:number}|null,
 *   released: boolean,
 *   shotAngle: number,
 *   shotPower: number,
 *   dragAngle: number,
 *   dragDistance: number,
 * }}
 */
export function getInput() {
  return { ...state };
}

/**
 * Reset input state after a shot has been processed by the game.
 */
export function resetInput() {
  state.aiming = false;
  state.aimStart = null;
  state.aimCurrent = null;
  state.released = false;
  state.shotAngle = 0;
  state.shotPower = 0;
  state.dragAngle = 0;
  state.dragDistance = 0;
  activePointerId = null;
}

/**
 * Enable or disable input processing (e.g. during multiplayer turns).
 * @param {boolean} isEnabled
 */
export function setEnabled(isEnabled) {
  enabled = isEnabled;
  if (!isEnabled) {
    cancelAim();
  }
}
