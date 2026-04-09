/**
 * game.js - Game state machine for Mini Golf
 *
 * Exports: createGame(), updateGame(game, rawInput, viewport, dt), getTotalScore(game), getTotalPar(game)
 */

import { COURSES } from './courses.js';
import { launchBall, stepBall, MAX_POWER, DT } from './physics.js';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a fresh initial game state.
 */
export function createGame() {
  return {
    state: 'title',
    currentHole: 0,
    strokes: 0,
    scorecard: Array(9).fill(null),
    ball: { x: 0, y: 0, vx: 0, vy: 0 },
    lastBallPos: { x: 0, y: 0 },
    trail: [],
    time: 0,
    mode: 'solo',
    players: [],
    balls: [],
    myId: null,
    currentTurnPlayerId: null,
    roomCode: null,
    input: {
      aiming: false,
      aimStart: null,
      aimCurrent: null,
      released: false,
      shotAngle: 0,
      shotPower: 0,
      dragAngle: 0,
      dragDistance: 0,
    },
    animState: {
      sinkTimer: 0,
      holeTransition: 0,
      holeTransitionPhase: 'out',
      hazardTimer: 0,
      shakeMagnitude: 0,
    },
    zoom: { level: 1, panX: 0, panY: 0 },
    playerColor: '#4ecdc4',
    playerName: '',
    titleStart: false,
    _trailStepCount: 0,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Position the ball at the tee for the given hole index.
 */
function placeBallAtTee(game, holeIndex) {
  const course = COURSES[holeIndex];
  if (!course) return;
  game.ball.x = course.tee.x;
  game.ball.y = course.tee.y;
  game.ball.vx = 0;
  game.ball.vy = 0;
}

// ---------------------------------------------------------------------------
// Main update
// ---------------------------------------------------------------------------

/**
 * Update game state for one physics step.
 * @param {object} game
 * @param {object} rawInput - from getInput()
 * @param {object} viewport - { w, h, dpr }
 * @param {number} dt - frame delta (fixed DT = 1/60)
 * @returns {object} updated game
 */
export function updateGame(game, rawInput, viewport, dt) {
  // Always increment time
  game.time += dt;

  switch (game.state) {
    case 'title':
      updateTitle(game, rawInput);
      break;

    case 'aiming':
      updateAiming(game, rawInput);
      break;

    case 'rolling':
      updateRolling(game, rawInput, dt);
      break;

    case 'sunk':
      updateSunk(game, dt);
      break;

    case 'hazard':
      updateHazard(game, dt);
      break;

    case 'nextHole':
      updateNextHole(game, dt);
      break;

    case 'gameover':
      updateGameOver(game, rawInput);
      break;

    default:
      break;
  }

  return game;
}

// ---------------------------------------------------------------------------
// State: title
// ---------------------------------------------------------------------------

function updateTitle(game, rawInput) {
  if (rawInput.released || game.titleStart) {
    game.titleStart = false;
    game.state = 'aiming';
    game.currentHole = 0;
    game.strokes = 0;
    game.scorecard = Array(9).fill(null);
    game.trail = [];
    game._trailStepCount = 0;
    placeBallAtTee(game, 0);
  }
}

// ---------------------------------------------------------------------------
// State: aiming
// ---------------------------------------------------------------------------

function updateAiming(game, rawInput) {
  // Always mirror input into game so renderer can draw aim line
  game.input = rawInput;

  if (rawInput.released && rawInput.shotPower > 0) {
    // Quadratic power curve: low drags stay gentle, long drags ramp up aggressively
    const curvedPower = rawInput.shotPower * rawInput.shotPower;
    const actualPower = curvedPower * MAX_POWER;
    launchBall(game.ball, rawInput.shotAngle, actualPower);
    game.strokes += 1;
    game.lastBallPos = { x: game.ball.x, y: game.ball.y };
    game.animState.shakeMagnitude = curvedPower * 3;
    game.state = 'rolling';
    // resetInput() is called by main.js after this returns
  }
}

// ---------------------------------------------------------------------------
// State: rolling
// ---------------------------------------------------------------------------

function updateRolling(game, rawInput, dt) {
  const courseWithTime = { ...COURSES[game.currentHole], time: game.time };

  const result = stepBall(game.ball, courseWithTime, DT);
  const { sunk, water } = result;

  // Trail management - push every 3 physics steps
  game._trailStepCount = (game._trailStepCount || 0) + 1;
  if (game._trailStepCount >= 3) {
    game._trailStepCount = 0;
    game.trail.push({ x: game.ball.x, y: game.ball.y, alpha: 1.0 });
    if (game.trail.length > 30) {
      game.trail.shift();
    }
  }

  // Decay trail alphas
  for (let i = game.trail.length - 1; i >= 0; i--) {
    game.trail[i].alpha -= 0.02;
    if (game.trail[i].alpha < 0.05) {
      game.trail.splice(i, 1);
    }
  }

  // Decay screen shake
  game.animState.shakeMagnitude *= 0.9;

  // Mirror input for renderer
  game.input = rawInput;

  if (sunk) {
    game.state = 'sunk';
    game.animState.sinkTimer = 0;
  } else if (water) {
    game.state = 'hazard';
    game.animState.hazardTimer = 0;
  } else if (game.ball.vx === 0 && game.ball.vy === 0) {
    game.state = 'aiming';
  }
}

// ---------------------------------------------------------------------------
// State: sunk
// ---------------------------------------------------------------------------

function updateSunk(game, dt) {
  game.animState.sinkTimer += dt / 1.5;

  if (game.animState.sinkTimer >= 1) {
    game.scorecard[game.currentHole] = game.strokes;

    if (game.currentHole < 8) {
      game.state = 'nextHole';
      game.animState.holeTransition = 0;
      game.animState.holeTransitionPhase = 'out';
    } else {
      game.state = 'gameover';
    }
  }
}

// ---------------------------------------------------------------------------
// State: hazard
// ---------------------------------------------------------------------------

function updateHazard(game, dt) {
  game.animState.hazardTimer += dt / 1.0;

  if (game.animState.hazardTimer >= 1) {
    game.ball.x = game.lastBallPos.x;
    game.ball.y = game.lastBallPos.y;
    game.ball.vx = 0;
    game.ball.vy = 0;
    game.strokes += 1;
    game.state = 'aiming';
  }
}

// ---------------------------------------------------------------------------
// State: nextHole
// ---------------------------------------------------------------------------

function updateNextHole(game, dt) {
  game.animState.holeTransition += dt / 2.0;

  if (game.animState.holeTransitionPhase === 'out' && game.animState.holeTransition >= 0.5) {
    game.currentHole++;
    game.strokes = 0;
    game.trail = [];
    game._trailStepCount = 0;
    placeBallAtTee(game, game.currentHole);
    game.animState.holeTransitionPhase = 'in';
    // Reset zoom for new hole
    game.zoom = { level: 1, panX: 0, panY: 0 };
  }

  if (game.animState.holeTransition >= 1) {
    game.state = 'aiming';
  }
}

// ---------------------------------------------------------------------------
// State: gameover
// ---------------------------------------------------------------------------

function updateGameOver(game, rawInput) {
  if (rawInput.released || game.titleStart) {
    game.titleStart = false;
    // Return a fresh game state by mutating in place (replace all fields)
    const fresh = createGame();
    Object.assign(game, fresh);
  }
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

/**
 * Return total strokes across all completed holes.
 */
export function getTotalScore(game) {
  return game.scorecard.reduce((sum, s) => sum + (s !== null ? s : 0), 0);
}

/**
 * Return sum of par for all completed holes.
 */
export function getTotalPar(game) {
  let total = 0;
  for (let i = 0; i < game.scorecard.length; i++) {
    if (game.scorecard[i] !== null && COURSES[i]) {
      total += COURSES[i].par;
    }
  }
  return total;
}
