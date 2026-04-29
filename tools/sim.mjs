/**
 * sim.mjs - Bot trial simulator for mini golf course tuning
 *
 * Runs N=200 bot trials per hole and reports stroke distribution.
 * Bot strategy: aim toward hole with +-20deg noise, power scaled to distance.
 *
 * Usage: node tools/sim.mjs
 */

import { COURSES } from '../js/courses.js';
import { stepBall, MAX_POWER } from '../js/physics.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const N_TRIALS = 200;
const MAX_STROKES = 15;
const MAX_RANGE = 1500; // rough max effective range given friction
const ANGLE_NOISE = Math.PI / 9; // +-20 degrees

// ---------------------------------------------------------------------------
// Bot helpers
// ---------------------------------------------------------------------------

function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Simulate a single bot trial on a given course.
 * Returns { strokes, sunk, waterHits, sandHits }
 */
function runTrial(course) {
  // Fresh ball at tee
  const ball = {
    x: course.tee.x,
    y: course.tee.y,
    vx: 0,
    vy: 0,
    radius: 6,
  };

  let strokes = 0;
  let waterHits = 0;
  let sandHits = 0;

  while (strokes < MAX_STROKES) {
    // Save position before shot for water reset
    const lastX = ball.x;
    const lastY = ball.y;

    // --- Compute shot ---
    const dx = course.hole.x - ball.x;
    const dy = course.hole.y - ball.y;
    const angleToHole = Math.atan2(dy, dx);
    const noise = (Math.random() * 2 - 1) * ANGLE_NOISE;
    const angle = angleToHole + noise;

    const distToHole = dist(ball.x, ball.y, course.hole.x, course.hole.y);
    const powerFraction = clamp(
      (distToHole / MAX_RANGE) * (0.5 + Math.random() * 0.5),
      0,
      1
    );
    const power = powerFraction * MAX_POWER;

    ball.vx = Math.cos(angle) * power;
    ball.vy = Math.sin(angle) * power;

    strokes++;

    // --- Step ball until it stops, sinks, or hits water ---
    let stepCount = 0;
    let hitSand = false;
    let hitWater = false;
    let sunk = false;

    while (true) {
      const courseWithTime = { ...course, time: stepCount / 60 };
      const result = stepBall(ball, courseWithTime);

      if (result.inSand) {
        hitSand = true;
      }

      if (result.water) {
        hitWater = true;
        break;
      }

      if (result.sunk) {
        sunk = true;
        break;
      }

      // Ball stopped (vx and vy both 0 means it stopped in stepBall)
      if (ball.vx === 0 && ball.vy === 0) {
        break;
      }

      stepCount++;

      // Safety: bail after 20 seconds of sim time (1200 steps)
      if (stepCount > 1200) {
        break;
      }
    }

    if (hitSand) {
      sandHits++;
    }

    if (hitWater) {
      waterHits++;
      // Reset to last position, count the stroke already added above
      ball.x = lastX;
      ball.y = lastY;
      ball.vx = 0;
      ball.vy = 0;
      continue;
    }

    if (sunk) {
      return { strokes, sunk: true, waterHits, sandHits };
    }

    // Ball stopped on the green - next stroke
  }

  // Failed to sink within MAX_STROKES
  return { strokes: MAX_STROKES, sunk: false, waterHits, sandHits };
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

function median(sorted) {
  if (sorted.length === 0) return null;
  return sorted[Math.floor(sorted.length / 2)];
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  return sorted[Math.floor(sorted.length * p)];
}

function fmt(v, decimals = 2) {
  if (v === null) return 'N/A';
  return typeof v === 'number' ? v.toFixed(decimals) : v;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const results = [];

  for (let hi = 0; hi < COURSES.length; hi++) {
    const course = COURSES[hi];
    const holeNum = hi + 1;

    const strokes = [];  // only for successful sinks
    let totalWaterHits = 0;
    let totalSandHits = 0;
    let failures = 0;

    for (let t = 0; t < N_TRIALS; t++) {
      const trial = runTrial(course);
      if (trial.sunk) {
        strokes.push(trial.strokes);
      } else {
        failures++;
      }
      totalWaterHits += trial.waterHits;
      totalSandHits += trial.sandHits;
    }

    strokes.sort((a, b) => a - b);

    const sinkRate = ((N_TRIALS - failures) / N_TRIALS * 100).toFixed(1) + '%';
    const med = median(strokes);
    const p25 = percentile(strokes, 0.25);
    const p75 = percentile(strokes, 0.75);
    const waterPerTrial = (totalWaterHits / N_TRIALS).toFixed(2);
    const sandPerTrial = (totalSandHits / N_TRIALS).toFixed(2);

    results.push({
      holeNum,
      name: course.name,
      par: course.par,
      med,
      p25,
      p75,
      sinkRate,
      waterPerTrial,
      sandPerTrial,
    });
  }

  // Print markdown table
  const header = '| Hole | Name | Par | Median | p25 | p75 | Sink Rate | Water Hits/trial | Sand Stalls/trial |';
  const sep    = '|------|------|-----|--------|-----|-----|-----------|-----------------|-------------------|';

  console.log(header);
  console.log(sep);

  for (const r of results) {
    const row = [
      `| ${r.holeNum}`,
      r.name,
      r.par,
      fmt(r.med, 1),
      fmt(r.p25, 1),
      fmt(r.p75, 1),
      r.sinkRate,
      r.waterPerTrial,
      r.sandPerTrial + ' |',
    ].join(' | ');
    console.log(row);
  }
}

main();
