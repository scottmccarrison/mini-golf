/**
 * game.js - Game state machine for Mini Golf
 *
 * Exports: createGame(), updateGame(game, rawInput, viewport, dt), getTotalScore(game), getTotalPar(game)
 *          startMultiplayerGame(), applyShot(), applyBallUpdate(), applyTurnComplete(),
 *          applyTurnStart(), applyHoleComplete(), applyGameOver()
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
    chatMessages: [],
    chatOpen: false,
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

    case 'spectating':
      updateSpectating(game, rawInput, dt);
      break;

    default:
      break;
  }

  return game;
}

// ---------------------------------------------------------------------------
// State: spectating (multiplayer - waiting for another player)
// ---------------------------------------------------------------------------

function updateSpectating(game, rawInput, dt) {
  // Physics runs for remote ball updates but local input is disabled
  // Just decay trail and shake for any actively displayed ball
  game.animState.shakeMagnitude *= 0.9;

  // Decay trail alphas for spectated ball
  if (game.trail) {
    for (let i = game.trail.length - 1; i >= 0; i--) {
      game.trail[i].alpha -= 0.02;
      if (game.trail[i].alpha < 0.05) game.trail.splice(i, 1);
    }
  }
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

// ---------------------------------------------------------------------------
// Multiplayer game setup and event handlers
// ---------------------------------------------------------------------------

/**
 * Initialize the game for multiplayer mode.
 * @param {object} game
 * @param {string[]} turnOrder - array of player IDs in turn order
 * @param {string|number} myId - this client's player ID
 * @param {object[]} players - array of {id, name, color}
 */
export function startMultiplayerGame(game, turnOrder, myId, players, roomCode) {
  game.mode = 'mp';
  game.myId = myId;
  game.roomCode = roomCode;
  game.turnOrder = turnOrder;
  game.currentTurnPlayerId = turnOrder[0];
  game.currentHole = 0;
  game.strokes = 0;
  game.scorecard = Array(9).fill(null);
  game.trail = [];
  game._trailStepCount = 0;

  // Build players array with scorecards
  game.players = players.map(p => ({
    id: p.id,
    name: p.name || `P${p.id}`,
    color: p.color,
    scorecard: Array(9).fill(null),
  }));

  // Set local player color from the players list
  const me = game.players.find(p => p.id === myId);
  if (me) game.playerColor = me.color;

  // Remote balls keyed by player ID (for spectating display)
  game.balls = {};

  placeBallAtTee(game, 0);

  if (myId === turnOrder[0]) {
    game.state = 'aiming';
  } else {
    game.state = 'spectating';
  }
}

/**
 * Apply a shot from a remote player (relay from DO).
 */
export function applyShot(game, playerId, angle, power) {
  if (playerId === game.myId) return; // ignore echoed own shot
  const curvedPower = power * power;
  const actualPower = curvedPower * MAX_POWER;
  // Create/update a remote ball entry for this player
  const course = COURSES[game.currentHole];
  if (!game.balls[playerId]) {
    game.balls[playerId] = {
      x: course ? course.tee.x : 0,
      y: course ? course.tee.y : 0,
      vx: 0,
      vy: 0,
    };
  }
  launchBall(game.balls[playerId], angle, actualPower);
}

/**
 * Update a remote player's ball position for smooth spectating.
 */
export function applyBallUpdate(game, playerId, x, y, vx, vy) {
  if (playerId === game.myId) return;
  if (!game.balls[playerId]) game.balls[playerId] = { x, y, vx, vy };
  else {
    game.balls[playerId].x = x;
    game.balls[playerId].y = y;
    game.balls[playerId].vx = vx;
    game.balls[playerId].vy = vy;
  }
}

/**
 * Record a remote player's hole completion.
 */
export function applyTurnComplete(game, playerId, strokes, sunk) {
  if (playerId === game.myId) return;
  const player = game.players.find(p => p.id === playerId);
  if (player) {
    player.scorecard[game.currentHole] = strokes;
  }
}

/**
 * Handle a turnStart event - enable input if it's my turn, else spectate.
 * @param {boolean} isMyTurn - whether this is the local player's turn
 */
export function applyTurnStart(game, playerId, currentHole, isMyTurn) {
  game.currentTurnPlayerId = playerId;
  game.currentHole = currentHole;

  if (isMyTurn) {
    game.strokes = 0;
    game.trail = [];
    game._trailStepCount = 0;
    placeBallAtTee(game, currentHole);
    game.state = 'aiming';
  } else {
    game.state = 'spectating';
    // Reset that player's remote ball to tee position
    const course = COURSES[currentHole];
    if (course && game.balls) {
      game.balls[playerId] = {
        x: course.tee.x,
        y: course.tee.y,
        vx: 0,
        vy: 0,
      };
    }
  }
}

/**
 * Handle holeComplete - all players done, advance to next hole.
 */
export function applyHoleComplete(game, holeIndex, scores, nextHole) {
  // Update all player scorecards from authoritative server scores
  for (const player of game.players) {
    if (scores[player.id] && scores[player.id][holeIndex] !== undefined) {
      player.scorecard[holeIndex] = scores[player.id][holeIndex];
    }
  }
  // Update local scorecard too
  if (scores[game.myId] && scores[game.myId][holeIndex] !== undefined) {
    game.scorecard[holeIndex] = scores[game.myId][holeIndex];
  }
  game.currentHole = nextHole;
  game.strokes = 0;
  game.trail = [];
  game._trailStepCount = 0;
  // Reset local ball and all remote balls to the new tee
  placeBallAtTee(game, nextHole);
  const course = COURSES[nextHole];
  if (course && game.balls) {
    for (const pid of Object.keys(game.balls)) {
      game.balls[pid] = { x: course.tee.x, y: course.tee.y, vx: 0, vy: 0 };
    }
  }
  game.zoom = { level: 1, panX: 0, panY: 0 };
}

/**
 * Add a chat message to the game state.
 */
export function addChatMessage(game, id, name, text) {
  game.chatMessages.push({ id, name, text, time: game.time });
  // Keep last 50 messages
  if (game.chatMessages.length > 50) game.chatMessages.shift();
}

/**
 * Handle gameOver - set final scores and transition to gameover state.
 */
export function applyGameOver(game, finalScores) {
  for (const player of game.players) {
    if (finalScores[player.id]) {
      player.scorecard = finalScores[player.id].slice();
    }
  }
  if (finalScores[game.myId]) {
    game.scorecard = finalScores[game.myId].slice();
  }
  game.state = 'gameover';
}
