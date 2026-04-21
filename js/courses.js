// courses.js - Mini Golf course data definitions
// Each hole defines playfield geometry used by the physics engine.
// Logical canvas: 600x800 pixels. Tee near bottom, hole near top generally.
//
// Supported course fields:
//   walls          - static line segments (outer boundary + interior walls)
//   bumpers        - circular bouncy obstacles that boost velocity
//   sandTraps      - polygon regions that slow the ball (high friction)
//   waterHazards   - polygon regions that reset the ball to last position (+1 stroke)
//   movingObstacles- windmills etc, see getMovingObstacleState
//   slopes         - polygon regions that apply a constant acceleration to the ball
//                    shape: { points: [...], ax: number, ay: number }
//                    Force is in px/s^2. Typical values 5-20. Used to create subtle
//                    curving putts and funnel effects without raising difficulty.

// ---------------------------------------------------------------------------
// Hole 1: "Straight Shot" (Par 2)
// Hourglass corridor - narrow tee approach, wide courtyard mid, narrow neck at hole.
// Still a straight-line putt but not a featureless pipe.
// ---------------------------------------------------------------------------
const hole1 = {
  name: 'Straight Shot',
  par: 2,
  tee: { x: 300, y: 700 },
  hole: { x: 300, y: 120 },
  holeRadius: 12,
  bounds: { width: 600, height: 800 },
  walls: [
    { x1: 200, y1: 80,  x2: 400, y2: 80  }, // top of neck
    { x1: 400, y1: 80,  x2: 400, y2: 200 }, // right of neck
    { x1: 400, y1: 200, x2: 450, y2: 200 }, // right step out to courtyard
    { x1: 450, y1: 200, x2: 450, y2: 600 }, // right of courtyard
    { x1: 450, y1: 600, x2: 350, y2: 600 }, // right step in to tee corridor
    { x1: 350, y1: 600, x2: 350, y2: 760 }, // right of tee corridor
    { x1: 350, y1: 760, x2: 250, y2: 760 }, // bottom
    { x1: 250, y1: 760, x2: 250, y2: 600 }, // left of tee corridor
    { x1: 250, y1: 600, x2: 150, y2: 600 }, // left step out
    { x1: 150, y1: 600, x2: 150, y2: 200 }, // left of courtyard
    { x1: 150, y1: 200, x2: 200, y2: 200 }, // left step in
    { x1: 200, y1: 200, x2: 200, y2: 80  }, // left of neck
  ],
  bumpers: [],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
};

// ---------------------------------------------------------------------------
// Hole 2: "Gentle Bend" (Par 2)
// Slight L-shape with a gravity slope at the corner that gently nudges the
// ball up-and-right. Teaches that the floor isn't always flat.
// ---------------------------------------------------------------------------
const hole2 = {
  name: 'Gentle Bend',
  par: 2,
  tee: { x: 175, y: 700 },
  hole: { x: 430, y: 120 },
  holeRadius: 12,
  bounds: { width: 600, height: 800 },
  walls: [
    { x1: 50,  y1: 80,  x2: 550, y2: 80  }, // top
    { x1: 550, y1: 80,  x2: 550, y2: 280 }, // right of horizontal leg
    { x1: 550, y1: 280, x2: 300, y2: 280 }, // inner bottom of horizontal leg
    { x1: 300, y1: 280, x2: 300, y2: 760 }, // right of vertical leg
    { x1: 300, y1: 760, x2: 50,  y2: 760 }, // bottom
    { x1: 50,  y1: 760, x2: 50,  y2: 80  }, // left
  ],
  bumpers: [],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
  slopes: [
    {
      points: [
        { x: 80,  y: 200 },
        { x: 300, y: 200 },
        { x: 300, y: 400 },
        { x: 80,  y: 400 },
      ],
      ax: 15,
      ay: -10,
    },
  ],
};

// ---------------------------------------------------------------------------
// Hole 3: "The Dogleg" (Par 3)
// Right-angle L-shape, narrower corridor (180px).
// Unchanged - already the right amount of interesting.
// ---------------------------------------------------------------------------
const hole3 = {
  name: 'The Dogleg',
  par: 3,
  tee: { x: 175, y: 680 },
  hole: { x: 450, y: 130 },
  holeRadius: 12,
  bounds: { width: 600, height: 800 },
  walls: [
    { x1: 86,  y1: 80,  x2: 540, y2: 80  },
    { x1: 540, y1: 80,  x2: 540, y2: 280 },
    { x1: 540, y1: 280, x2: 266, y2: 280 },
    { x1: 266, y1: 280, x2: 266, y2: 760 },
    { x1: 266, y1: 760, x2: 86,  y2: 760 },
    { x1: 86,  y1: 760, x2: 86,  y2: 80  },
  ],
  bumpers: [],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
};

// ---------------------------------------------------------------------------
// Hole 4: "Bumper Funnel" (Par 3)
// Bumpers arranged as a V-shaped funnel near the hole plus an off-center
// redirect bumper lower down. Good shots get pinball-style funneled into the
// cup; off-line shots get corrected rather than deflected away.
// ---------------------------------------------------------------------------
const hole4 = {
  name: 'Bumper Funnel',
  par: 3,
  tee: { x: 300, y: 700 },
  hole: { x: 300, y: 120 },
  holeRadius: 12,
  bounds: { width: 600, height: 800 },
  walls: [
    { x1: 190, y1: 80,  x2: 410, y2: 80  },
    { x1: 410, y1: 80,  x2: 410, y2: 760 },
    { x1: 410, y1: 760, x2: 190, y2: 760 },
    { x1: 190, y1: 760, x2: 190, y2: 80  },
  ],
  bumpers: [
    { x: 235, y: 260, r: 14, bounciness: 1.3 }, // left funnel gate
    { x: 365, y: 260, r: 14, bounciness: 1.3 }, // right funnel gate
    { x: 360, y: 470, r: 14, bounciness: 1.3 }, // lower redirect, off-center
  ],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
};

// ---------------------------------------------------------------------------
// Hole 5: "The L with Teeth" (Par 4)
// L-shape with interior wall island. Added a gentle slope in the vertical
// leg that nudges shots up and slightly toward center, helping clean lines
// navigate around the island chicane.
// ---------------------------------------------------------------------------
const hole5 = {
  name: 'The L with Teeth',
  par: 4,
  tee: { x: 160, y: 680 },
  hole: { x: 460, y: 130 },
  holeRadius: 12,
  bounds: { width: 600, height: 800 },
  walls: [
    { x1: 80,  y1: 80,  x2: 550, y2: 80  },
    { x1: 550, y1: 80,  x2: 550, y2: 280 },
    { x1: 550, y1: 280, x2: 280, y2: 280 },
    { x1: 280, y1: 280, x2: 280, y2: 760 },
    { x1: 280, y1: 760, x2: 80,  y2: 760 },
    { x1: 80,  y1: 760, x2: 80,  y2: 80  },
    { x1: 140, y1: 340, x2: 220, y2: 340 },
    { x1: 220, y1: 340, x2: 220, y2: 440 },
    { x1: 220, y1: 440, x2: 140, y2: 440 },
    { x1: 140, y1: 440, x2: 140, y2: 340 },
  ],
  bumpers: [
    { x: 420, y: 200, r: 14, bounciness: 1.3 },
    { x: 320, y: 200, r: 14, bounciness: 1.3 },
  ],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
  slopes: [
    {
      points: [
        { x: 90,  y: 470 },
        { x: 275, y: 470 },
        { x: 275, y: 650 },
        { x: 90,  y: 650 },
      ],
      ax: 8,
      ay: -14,
    },
  ],
};

// ---------------------------------------------------------------------------
// Hole 6: "Sand Island" (Par 3)
// Was a forced wall-to-wall sand band. Now the sand is an island in the
// middle of a widened corridor with ~80px lanes on either side. Direct
// shot = risky through-sand; around shot = clean par line.
// ---------------------------------------------------------------------------
const hole6 = {
  name: 'Sand Island',
  par: 3,
  tee: { x: 300, y: 700 },
  hole: { x: 300, y: 130 },
  holeRadius: 12,
  bounds: { width: 600, height: 800 },
  walls: [
    { x1: 140, y1: 80,  x2: 460, y2: 80  },
    { x1: 460, y1: 80,  x2: 460, y2: 760 },
    { x1: 460, y1: 760, x2: 140, y2: 760 },
    { x1: 140, y1: 760, x2: 140, y2: 80  },
  ],
  bumpers: [],
  sandTraps: [
    {
      points: [
        { x: 220, y: 420 },
        { x: 240, y: 370 },
        { x: 300, y: 355 },
        { x: 360, y: 370 },
        { x: 380, y: 420 },
        { x: 380, y: 465 },
        { x: 360, y: 515 },
        { x: 300, y: 530 },
        { x: 240, y: 515 },
        { x: 220, y: 465 },
      ],
    },
  ],
  waterHazards: [],
  movingObstacles: [],
};

// ---------------------------------------------------------------------------
// Hole 7: "Water Slalom" (Par 4)
// Was a symmetric water wall with a center gap ("aim at the gap"). Now two
// offset water patches create an S-slalom: go right of the first, left of
// the second. Both lanes are generous (~180px) so it's interesting, not hard.
// ---------------------------------------------------------------------------
const hole7 = {
  name: 'Water Slalom',
  par: 4,
  tee: { x: 300, y: 700 },
  hole: { x: 300, y: 120 },
  holeRadius: 12,
  bounds: { width: 600, height: 800 },
  walls: [
    { x1: 100, y1: 80,  x2: 500, y2: 80  },
    { x1: 500, y1: 80,  x2: 500, y2: 760 },
    { x1: 500, y1: 760, x2: 100, y2: 760 },
    { x1: 100, y1: 760, x2: 100, y2: 80  },
  ],
  bumpers: [],
  sandTraps: [],
  waterHazards: [
    {
      points: [
        { x: 100, y: 440 },
        { x: 320, y: 440 },
        { x: 320, y: 520 },
        { x: 100, y: 520 },
      ],
    },
    {
      points: [
        { x: 280, y: 280 },
        { x: 500, y: 280 },
        { x: 500, y: 360 },
        { x: 280, y: 360 },
      ],
    },
  ],
  movingObstacles: [],
};

// ---------------------------------------------------------------------------
// Hole 8: "Windmill" (Par 4)
// Classic windmill in a straight corridor. Unchanged - already interesting.
// ---------------------------------------------------------------------------
const hole8 = {
  name: 'Windmill',
  par: 4,
  tee: { x: 300, y: 700 },
  hole: { x: 300, y: 120 },
  holeRadius: 12,
  bounds: { width: 600, height: 800 },
  walls: [
    { x1: 180, y1: 80,  x2: 420, y2: 80  },
    { x1: 420, y1: 80,  x2: 420, y2: 760 },
    { x1: 420, y1: 760, x2: 180, y2: 760 },
    { x1: 180, y1: 760, x2: 180, y2: 80  },
  ],
  bumpers: [],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [
    {
      type: 'windmill',
      pivot: { x: 300, y: 420 },
      armLength: 90,
      armWidth: 10,
      rpm: 8,
      phase: 0,
    },
  ],
};

// ---------------------------------------------------------------------------
// Hole 9: "The Gauntlet" (Par 5)
// S-curve with hazards placed INSIDE the natural shot path so they actually
// matter. Sand trap in the lower-chamber approach. A small windmill guards
// the sand. Water moat guards the hole in the upper chamber. A gentle slope
// in the upper chamber funnels shots toward the cup as reward for surviving.
// Multiple viable routes: left around the moat, or bank off the top wall
// past it.
// ---------------------------------------------------------------------------
const hole9 = {
  name: 'The Gauntlet',
  par: 5,
  tee: { x: 160, y: 730 },
  hole: { x: 440, y: 160 },
  holeRadius: 12,
  bounds: { width: 600, height: 800 },
  walls: [
    { x1: 280, y1: 80,  x2: 550, y2: 80  },
    { x1: 550, y1: 80,  x2: 550, y2: 400 },
    { x1: 550, y1: 400, x2: 320, y2: 400 },
    { x1: 320, y1: 400, x2: 320, y2: 760 },
    { x1: 320, y1: 760, x2: 50,  y2: 760 },
    { x1: 50,  y1: 760, x2: 50,  y2: 380 },
    { x1: 50,  y1: 380, x2: 280, y2: 380 },
    { x1: 280, y1: 380, x2: 280, y2: 80  },
  ],
  bumpers: [
    { x: 380, y: 110, r: 14, bounciness: 1.3 },
    { x: 340, y: 210, r: 14, bounciness: 1.3 },
  ],
  sandTraps: [
    {
      points: [
        { x: 130, y: 500 },
        { x: 230, y: 490 },
        { x: 265, y: 540 },
        { x: 230, y: 610 },
        { x: 150, y: 615 },
        { x: 105, y: 555 },
      ],
    },
  ],
  waterHazards: [
    {
      points: [
        { x: 330, y: 230 },
        { x: 500, y: 230 },
        { x: 500, y: 310 },
        { x: 330, y: 310 },
      ],
    },
  ],
  movingObstacles: [
    {
      type: 'windmill',
      pivot: { x: 200, y: 450 },
      armLength: 40,
      armWidth: 8,
      rpm: 10,
      phase: 0,
    },
  ],
  slopes: [
    {
      points: [
        { x: 300, y: 100 },
        { x: 540, y: 100 },
        { x: 540, y: 220 },
        { x: 300, y: 220 },
      ],
      ax: 8,
      ay: -4,
    },
  ],
};

// ---------------------------------------------------------------------------
// Exported course list (total par: 2+2+3+3+4+3+4+4+5 = 30)
// ---------------------------------------------------------------------------
export const COURSES = [
  hole1,
  hole2,
  hole3,
  hole4,
  hole5,
  hole6,
  hole7,
  hole8,
  hole9,
];

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
