/**
 * physics.js - Core physics engine for mini golf
 *
 * Pure functions only. No DOM/Canvas dependencies.
 * Fully deterministic - no Math.random.
 * Fixed timestep: DT = 1/60
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BALL_RADIUS = 6;
export const HOLE_RADIUS = 16;
export const SINK_SPEED = 120;      // px/s - ball sinks if slower than this near hole
export const FRICTION = 0.985;      // velocity multiplier per frame (green)
export const SAND_FRICTION = 0.80;  // velocity multiplier per frame (sand, very punishing)
export const STOP_SPEED = 5;        // px/s - ball stops below this
export const MAX_POWER = 1800;      // px/s max initial velocity
export const BUMPER_BOUNCINESS = 1.3;
export const GRAVITY_PULL = 30;     // px/s^2 - pull toward hole when nearby
export const DT = 1 / 60;          // fixed timestep

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Euclidean distance between two points.
 */
export function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find the closest point on a line segment to a given point.
 * Returns { x, y, t } where t is the parameter along the segment [0, 1].
 */
export function closestPointOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // Degenerate segment - both endpoints are the same point
    return { x: x1, y: y1, t: 0 };
  }

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return {
    x: x1 + t * dx,
    y: y1 + t * dy,
    t,
  };
}

/**
 * Point-in-polygon test using ray casting.
 * polygon is an array of { x, y } points.
 * Returns boolean.
 */
export function pointInPolygon(px, py, polygon) {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersects =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

// ---------------------------------------------------------------------------
// Collision: walls
// ---------------------------------------------------------------------------

/**
 * Check and resolve ball collision against a wall segment.
 * Wall: { x1, y1, x2, y2 }
 * Modifies ball in place. Returns true if a collision occurred.
 */
export function checkWallCollision(ball, wall) {
  const closest = closestPointOnSegment(
    ball.x, ball.y,
    wall.x1, wall.y1,
    wall.x2, wall.y2
  );

  const dist = distance(ball.x, ball.y, closest.x, closest.y);
  const radius = ball.radius !== undefined ? ball.radius : BALL_RADIUS;

  if (dist >= radius) {
    return false;
  }

  // Normal pointing from wall toward ball center
  let nx, ny;
  if (dist < 1e-9) {
    // Ball center is exactly on the wall - use a fallback normal
    const wx = wall.x2 - wall.x1;
    const wy = wall.y2 - wall.y1;
    const len = Math.sqrt(wx * wx + wy * wy);
    if (len < 1e-9) return false;
    nx = -wy / len;
    ny = wx / len;
  } else {
    nx = (ball.x - closest.x) / dist;
    ny = (ball.y - closest.y) / dist;
  }

  // Push ball out of wall
  const overlap = radius - dist;
  ball.x += nx * overlap;
  ball.y += ny * overlap;

  // Reflect velocity: v' = v - 2(v.n)n
  const dot = ball.vx * nx + ball.vy * ny;
  ball.vx = (ball.vx - 2 * dot * nx) * 0.8;
  ball.vy = (ball.vy - 2 * dot * ny) * 0.8;

  return true;
}

// ---------------------------------------------------------------------------
// Collision: bumpers
// ---------------------------------------------------------------------------

/**
 * Check and resolve ball collision against a circular bumper.
 * Bumper: { x, y, r, bounciness? }
 * Modifies ball in place. Returns true if a collision occurred.
 */
export function checkBumperCollision(ball, bumper) {
  const ballRadius = ball.radius !== undefined ? ball.radius : BALL_RADIUS;
  const bounciness = bumper.bounciness !== undefined ? bumper.bounciness : BUMPER_BOUNCINESS;
  const minDist = ballRadius + bumper.r;

  const dx = ball.x - bumper.x;
  const dy = ball.y - bumper.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist >= minDist) {
    return false;
  }

  // Normal from bumper center toward ball
  let nx, ny;
  if (dist < 1e-9) {
    // Ball center exactly at bumper center - push upward as fallback
    nx = 0;
    ny = -1;
  } else {
    nx = dx / dist;
    ny = dy / dist;
  }

  // Push ball out so it no longer overlaps
  const overlap = minDist - dist;
  ball.x += nx * overlap;
  ball.y += ny * overlap;

  // Reflect velocity along the collision normal
  const dot = ball.vx * nx + ball.vy * ny;
  ball.vx = ball.vx - 2 * dot * nx;
  ball.vy = ball.vy - 2 * dot * ny;

  // Scale up speed by bounciness
  ball.vx *= bounciness;
  ball.vy *= bounciness;

  return true;
}

// ---------------------------------------------------------------------------
// Moving obstacles
// ---------------------------------------------------------------------------

/**
 * Compute the current state (line segment) of a moving obstacle at a given time.
 * For windmills: { type: 'windmill', pivot: {x,y}, armLength, armWidth, rpm, phase }
 * Returns { x1, y1, x2, y2 } representing the arm as a line segment.
 */
export function getMovingObstacleState(obstacle, time) {
  if (obstacle.type === 'windmill') {
    const { pivot, armLength, rpm, phase } = obstacle;
    const angle = (phase + (rpm * time * 2 * Math.PI) / 60) % (2 * Math.PI);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    return {
      x1: pivot.x - cosA * armLength,
      y1: pivot.y - sinA * armLength,
      x2: pivot.x + cosA * armLength,
      y2: pivot.y + sinA * armLength,
    };
  }

  // Unknown type - return a zero-length segment at origin as fallback
  return { x1: 0, y1: 0, x2: 0, y2: 0 };
}

// ---------------------------------------------------------------------------
// Ball launch
// ---------------------------------------------------------------------------

/**
 * Launch the ball at a given angle and power.
 * power is clamped to MAX_POWER.
 * Modifies ball in place and returns it.
 */
export function launchBall(ball, angle, power) {
  const clampedPower = Math.min(Math.abs(power), MAX_POWER);
  ball.vx = Math.cos(angle) * clampedPower;
  ball.vy = Math.sin(angle) * clampedPower;
  return ball;
}

// ---------------------------------------------------------------------------
// Main physics step
// ---------------------------------------------------------------------------

/**
 * Advance ball physics by one fixed timestep.
 *
 * course: {
 *   walls: Array<{x1,y1,x2,y2}>,
 *   bumpers: Array<{x,y,r,bounciness?}>,
 *   movingObstacles: Array<{type,pivot,...}>,
 *   sandTraps: Array<Array<{x,y}>>,
 *   waterHazards: Array<Array<{x,y}>>,
 *   hole: {x, y},
 *   time?: number   // current simulation time in seconds (for moving obstacles)
 * }
 *
 * Returns { ball, sunk, water, inSand }
 */
export function stepBall(ball, course, dt = DT) {
  const ballRadius = ball.radius !== undefined ? ball.radius : BALL_RADIUS;

  // Determine substep count to prevent tunneling through thin walls.
  // If the ball would move more than BALL_RADIUS in one step, subdivide.
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  const moveDistance = speed * dt;
  const substeps = moveDistance > ballRadius
    ? Math.ceil(moveDistance / ballRadius)
    : 1;
  const subDt = dt / substeps;

  let sunk = false;
  let water = false;
  let inSand = false;

  for (let s = 0; s < substeps; s++) {
    // --- Step 0: Apply slope forces ---
    if (course.slopes) {
      for (const slope of course.slopes) {
        if (pointInPolygon(ball.x, ball.y, slope.points)) {
          ball.vx += slope.ax * subDt;
          ball.vy += slope.ay * subDt;
          break;
        }
      }
    }

    // --- Step 0.5: Speed pad entry trigger ---
    if (course.speedPads) {
      if (!ball._padState) ball._padState = [];
      for (let i = 0; i < course.speedPads.length; i++) {
        const pad = course.speedPads[i];
        const inside = pointInPolygon(ball.x, ball.y, pad.points);
        const wasInside = ball._padState[i] || false;
        if (inside && !wasInside) {
          ball.vx += pad.ax;
          ball.vy += pad.ay;
        }
        ball._padState[i] = inside;
      }
    }

    // --- Step 0.6: Magnet pull ---
    if (course.magnets) {
      for (const m of course.magnets) {
        const dx = m.x - ball.x;
        const dy = m.y - ball.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 0 && dist < m.radius) {
          const falloff = 1 - dist / m.radius;
          const ax = (dx / dist) * m.strength * falloff;
          const ay = (dy / dist) * m.strength * falloff;
          ball.vx += ax * subDt;
          ball.vy += ay * subDt;
        }
      }
    }

    // --- Step 1: Apply velocity ---
    ball.x += ball.vx * subDt;
    ball.y += ball.vy * subDt;

    // --- Step 2: Wall collisions ---
    if (course.walls) {
      for (const wall of course.walls) {
        checkWallCollision(ball, wall);
      }
    }

    // --- Step 2.5: One-way gate collisions ---
    if (course.oneWayGates) {
      for (const gate of course.oneWayGates) {
        // Only block if ball is moving against the pass direction
        const dot = ball.vx * gate.nx + ball.vy * gate.ny;
        if (dot < 0) {
          // Ball moving against pass direction: treat as wall
          checkWallCollision(ball, { x1: gate.x1, y1: gate.y1, x2: gate.x2, y2: gate.y2 });
        }
        // Otherwise (dot >= 0): ball passes through freely
      }
    }

    // --- Step 3: Bumper collisions ---
    if (course.bumpers) {
      for (const bumper of course.bumpers) {
        checkBumperCollision(ball, bumper);
      }
    }

    // --- Step 4: Moving obstacle collisions ---
    if (course.movingObstacles) {
      const time = course.time !== undefined ? course.time : 0;
      for (const obstacle of course.movingObstacles) {
        const seg = getMovingObstacleState(obstacle, time);
        // Treat the arm as a wall segment for collision purposes
        checkWallCollision(ball, seg);
      }
    }

    // --- Step 5: Sand trap check ---
    inSand = false;
    if (course.sandTraps) {
      for (const trap of course.sandTraps) {
        if (pointInPolygon(ball.x, ball.y, trap.points)) {
          inSand = true;
          break;
        }
      }
    }

    // --- Step 6: Water hazard check ---
    if (course.waterHazards) {
      for (const hazard of course.waterHazards) {
        if (pointInPolygon(ball.x, ball.y, hazard.points)) {
          water = true;
          return { ball, sunk: false, water: true, inSand: false };
        }
      }
    }

    // --- Step 7: Apply friction ---
    const frictionMultiplier = inSand ? SAND_FRICTION : FRICTION;
    // Per-frame friction; for substeps we apply it proportionally.
    // friction per substep = frictionMultiplier ^ (subDt / DT)
    const frictionPerSubstep = Math.pow(frictionMultiplier, subDt / DT);
    ball.vx *= frictionPerSubstep;
    ball.vy *= frictionPerSubstep;

    // --- Step 8: Hole proximity ---
    if (course.hole) {
      const distToHole = distance(ball.x, ball.y, course.hole.x, course.hole.y);
      const currentSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);

      if (distToHole < HOLE_RADIUS) {
        if (currentSpeed < SINK_SPEED) {
          sunk = true;
          ball.vx = 0;
          ball.vy = 0;
          return { ball, sunk: true, water: false, inSand };
        } else {
          // Ball is near hole but moving too fast - apply gentle gravity pull
          const pullDx = course.hole.x - ball.x;
          const pullDy = course.hole.y - ball.y;
          const pullDist = Math.sqrt(pullDx * pullDx + pullDy * pullDy);
          if (pullDist > 1e-9) {
            ball.vx += (pullDx / pullDist) * GRAVITY_PULL * subDt;
            ball.vy += (pullDy / pullDist) * GRAVITY_PULL * subDt;
          }
        }
      }
    }

    // --- Step 8.5: Teleporter check ---
    if (course.teleporters) {
      if (!ball._teleState) ball._teleState = [];
      for (let i = 0; i < course.teleporters.length; i++) {
        const tp = course.teleporters[i];
        const distA = Math.sqrt((ball.x - tp.a.x)**2 + (ball.y - tp.a.y)**2);
        const distB = Math.sqrt((ball.x - tp.b.x)**2 + (ball.y - tp.b.y)**2);
        const inA = distA < tp.a.r;
        const inB = distB < tp.b.r;
        const lastSide = ball._teleState[i]; // 'a', 'b', or undefined
        if (inA && lastSide !== 'a') {
          ball.x = tp.b.x;
          ball.y = tp.b.y;
          ball._teleState[i] = 'b';
        } else if (inB && lastSide !== 'b') {
          ball.x = tp.a.x;
          ball.y = tp.a.y;
          ball._teleState[i] = 'a';
        } else if (!inA && !inB) {
          ball._teleState[i] = undefined;
        }
      }
    }

    // --- Step 9: Stop check ---
    const finalSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (finalSpeed < STOP_SPEED) {
      ball.vx = 0;
      ball.vy = 0;
      // Once stopped, no need to continue substeps
      break;
    }
  }

  return { ball, sunk, water, inSand };
}
