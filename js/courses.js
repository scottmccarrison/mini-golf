// courses.js - Loader + dynamic helpers for hole data.
//
// Hole data lives in /data/courses.json (one source of truth for renderer,
// physics, editor, and the preview tool). This file is a thin wrapper:
// fetch the JSON at module init, then re-export COURSES.
//
// Supported course fields (see data/courses.json _notes for per-hole context):
//   walls          - static line segments (outer boundary + interior walls)
//   bumpers        - circular bouncy obstacles that boost velocity
//   sandTraps      - polygon regions that slow the ball dramatically
//   waterHazards   - polygon regions; entering = +1 stroke, reset to prev pos
//   movingObstacles- windmills, see getMovingObstacleState
//   slopes         - polygon regions that apply constant acceleration to ball
//                    shape: { points: [...], ax: number, ay: number }
//   speedPads      - polygon regions; on ball entry, one-shot velocity boost
//                    shape: { points: [...], ax: number, ay: number }
//   magnets        - point sources with radial pull
//                    shape: { x, y, strength, radius }
//                    Force in px/s^2, falls off linearly to 0 at radius
//   oneWayGates    - walls that only block from one direction
//                    shape: { x1, y1, x2, y2, nx, ny }
//                    (nx, ny) is the unit vector in the PASS direction
//   teleporters    - paired pads; ball entering one teleports to the other
//                    shape: { a: { x, y, r }, b: { x, y, r } }

// Resolve the JSON URL relative to this module file so the loader works from
// any HTML entry point (index.html at /, tools/preview.html at /tools/, etc.).
const coursesUrl = new URL('../data/courses.json', import.meta.url);
const res = await fetch(coursesUrl);
if (!res.ok) {
  throw new Error(`Failed to load courses.json: ${res.status} ${res.statusText}`);
}
export const COURSES = await res.json();

// ---------------------------------------------------------------------------
// getMovingObstacleState(obstacle, time)
// Returns the current world-space line segment for a moving obstacle.
// `time` is elapsed seconds.
// ---------------------------------------------------------------------------
export function getMovingObstacleState(obstacle, time) {
  if (obstacle.type === 'windmill') {
    const angle = (obstacle.phase + obstacle.rpm * time * 2 * Math.PI / 60) % (2 * Math.PI);
    return {
      x1: obstacle.pivot.x - Math.cos(angle) * obstacle.armLength,
      y1: obstacle.pivot.y - Math.sin(angle) * obstacle.armLength,
      x2: obstacle.pivot.x + Math.cos(angle) * obstacle.armLength,
      y2: obstacle.pivot.y + Math.sin(angle) * obstacle.armLength,
      angle,
      pivot: obstacle.pivot,
      armLength: obstacle.armLength,
      armWidth: obstacle.armWidth,
    };
  }
}

// Test fixture (not in COURSES array): used to manually verify all 4 new
// primitives render and trigger correctly. Import as { TEST_COURSE } if needed.
export const TEST_COURSE = {
  name: 'Primitive Test',
  par: 4,
  tee: { x: 100, y: 700 },
  hole: { x: 700, y: 100 },
  holeRadius: 12,
  bounds: { width: 800, height: 800 },
  walls: [
    { x1: 50, y1: 50, x2: 750, y2: 50 },
    { x1: 750, y1: 50, x2: 750, y2: 750 },
    { x1: 750, y1: 750, x2: 50, y2: 750 },
    { x1: 50, y1: 750, x2: 50, y2: 50 },
  ],
  bumpers: [],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
  speedPads: [{
    points: [{x:200,y:600},{x:300,y:600},{x:300,y:700},{x:200,y:700}],
    ax: 800, ay: -800,
  }],
  magnets: [{ x: 500, y: 400, strength: 600, radius: 200 }],
  oneWayGates: [{ x1: 400, y1: 200, x2: 600, y2: 200, nx: 0, ny: -1 }],
  teleporters: [{ a: {x:150,y:300,r:25}, b: {x:650,y:600,r:25} }],
};
