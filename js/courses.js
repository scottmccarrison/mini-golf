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
//                    Force is in px/s^2. 50-150 is noticeable; 100+ strongly curves putts.

// ---------------------------------------------------------------------------
// Hole 1: "Serpent" (Par 3)
// Two offset wall dividers protruding from opposite sides. Ball must snake:
// right past the first gap at y=540, then left past the second at y=300.
// No straight-line shot possible.
// ---------------------------------------------------------------------------
const hole1 = {
  name: 'Serpent',
  par: 3,
  tee: { x: 300, y: 720 },
  hole: { x: 300, y: 120 },
  holeRadius: 12,
  bounds: { width: 600, height: 800 },
  walls: [
    // Outer corridor
    { x1: 80,  y1: 80,  x2: 520, y2: 80  },
    { x1: 520, y1: 80,  x2: 520, y2: 760 },
    { x1: 520, y1: 760, x2: 80,  y2: 760 },
    { x1: 80,  y1: 760, x2: 80,  y2: 80  },
    // Lower divider protruding from left wall (gap on the right, x=380..520)
    { x1: 80,  y1: 540, x2: 380, y2: 540 },
    // Upper divider protruding from right wall (gap on the left, x=80..220)
    { x1: 520, y1: 300, x2: 220, y2: 300 },
  ],
  bumpers: [],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
};

// ---------------------------------------------------------------------------
// Hole 2: "Slope Bend" (Par 3)
// L-shape with a strong slope pulling the ball up-and-right through the
// vertical leg, plus a wall island in the corner that blocks a direct
// diagonal. A bumper in the horizontal leg adds a redirect near the hole.
// ---------------------------------------------------------------------------
const hole2 = {
  name: 'Slope Bend',
  par: 3,
  tee: { x: 175, y: 720 },
  hole: { x: 470, y: 150 },
  holeRadius: 12,
  bounds: { width: 600, height: 800 },
  walls: [
    { x1: 50,  y1: 80,  x2: 550, y2: 80  },
    { x1: 550, y1: 80,  x2: 550, y2: 280 },
    { x1: 550, y1: 280, x2: 300, y2: 280 },
    { x1: 300, y1: 280, x2: 300, y2: 760 },
    { x1: 300, y1: 760, x2: 50,  y2: 760 },
    { x1: 50,  y1: 760, x2: 50,  y2: 80  },
    // Wall island in the corner - blocks diagonal shortcut
    { x1: 130, y1: 330, x2: 230, y2: 330 },
    { x1: 230, y1: 330, x2: 230, y2: 430 },
    { x1: 230, y1: 430, x2: 130, y2: 430 },
    { x1: 130, y1: 430, x2: 130, y2: 330 },
  ],
  bumpers: [
    { x: 400, y: 180, r: 14, bounciness: 1.3 },
  ],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
  slopes: [
    {
      points: [
        { x: 60,  y: 460 },
        { x: 290, y: 460 },
        { x: 290, y: 700 },
        { x: 60,  y: 700 },
      ],
      ax: 100,
      ay: -60,
    },
  ],
};

// ---------------------------------------------------------------------------
// Hole 3: "Z-Path" (Par 4)
// Double-dogleg Z-shape. Bottom chamber (tee) -> middle connector ->
// top chamber (hole). A bumper at the inner corner adds chaos on the
// transition between middle and top chambers.
// ---------------------------------------------------------------------------
const hole3 = {
  name: 'Z-Path',
  par: 4,
  tee: { x: 160, y: 720 },
  hole: { x: 450, y: 150 },
  holeRadius: 12,
  bounds: { width: 600, height: 800 },
  walls: [
    // Top chamber
    { x1: 360, y1: 80,  x2: 520, y2: 80  },
    { x1: 520, y1: 80,  x2: 520, y2: 400 },
    // Bottom of middle connector (right half)
    { x1: 520, y1: 400, x2: 240, y2: 400 },
    // Right of bottom chamber
    { x1: 240, y1: 400, x2: 240, y2: 760 },
    // Bottom
    { x1: 240, y1: 760, x2: 80,  y2: 760 },
    // Left of bottom chamber
    { x1: 80,  y1: 760, x2: 80,  y2: 320 },
    // Top of middle connector (left half)
    { x1: 80,  y1: 320, x2: 360, y2: 320 },
    // Left of top chamber
    { x1: 360, y1: 320, x2: 360, y2: 80  },
  ],
  bumpers: [
    { x: 370, y: 360, r: 14, bounciness: 1.3 },
  ],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
};

// ---------------------------------------------------------------------------
// Hole 4: "Pinball" (Par 4)
// Open chamber with a wall island dead-center on the tee-to-hole line, and
// 6 scattered bumpers. Straight shot is impossible; ball pinballs around
// the obstacles.
// ---------------------------------------------------------------------------
const hole4 = {
  name: 'Pinball',
  par: 4,
  tee: { x: 300, y: 720 },
  hole: { x: 300, y: 130 },
  holeRadius: 12,
  bounds: { width: 600, height: 800 },
  walls: [
    { x1: 80,  y1: 80,  x2: 520, y2: 80  },
    { x1: 520, y1: 80,  x2: 520, y2: 760 },
    { x1: 520, y1: 760, x2: 80,  y2: 760 },
    { x1: 80,  y1: 760, x2: 80,  y2: 80  },
    // Wall island blocking direct tee-to-hole line
    { x1: 240, y1: 360, x2: 360, y2: 360 },
    { x1: 360, y1: 360, x2: 360, y2: 480 },
    { x1: 360, y1: 480, x2: 240, y2: 480 },
    { x1: 240, y1: 480, x2: 240, y2: 360 },
  ],
  bumpers: [
    { x: 180, y: 300, r: 14, bounciness: 1.3 },
    { x: 450, y: 320, r: 14, bounciness: 1.3 },
    { x: 150, y: 560, r: 14, bounciness: 1.3 },
    { x: 440, y: 550, r: 14, bounciness: 1.3 },
    { x: 300, y: 630, r: 14, bounciness: 1.3 },
    { x: 300, y: 220, r: 14, bounciness: 1.3 },
  ],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
};

// ---------------------------------------------------------------------------
// Hole 5: "The L with Teeth" (Par 4)
// L-shape with interior wall island. Strong slope in the vertical leg
// pushes the ball up past the chicane.
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
      ax: 60,
      ay: -110,
    },
  ],
};

// ---------------------------------------------------------------------------
// Hole 6: "Sand Island" (Par 3)
// Sand island in the middle of a widened corridor with ~80px lanes on
// either side. Direct = risky through-sand; around = clean par line.
// Sand now slows dramatically - plan on losing a stroke if you go in.
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
// Two offset water patches force an S-slalom: right of the first, left of
// the second. Both lanes ~180px wide. Water = +1 stroke, reset to prev pos.
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
// Classic windmill in a straight corridor. Unchanged.
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
// S-curve with hazards placed in the natural shot path. Sand in the lower
// chamber approach, windmill guarding sand, water moat in the upper chamber
// guarding the hole, and a strong slope funnel toward the cup.
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
        { x: 540, y: 230 },
        { x: 300, y: 230 },
      ],
      ax: 80,
      ay: -40,
    },
  ],
};

// ---------------------------------------------------------------------------
// Exported course list (total par: 3+3+4+4+4+3+4+4+5 = 34)
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
