// courses.js - Mini Golf course data definitions
// Each hole defines playfield geometry used by the physics engine.
// Logical canvas is now 600x2400 - tall vertical courses that require
// pinch-to-zoom to see fine detail.
//
// Supported course fields:
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

const BOUNDS = { width: 600, height: 2400 };

// ---------------------------------------------------------------------------
// Hole 1: "Serpent" (Par 5)
// Five alternating wall dividers create a snake path from tee to hole.
// Ball must zigzag: right, left, right, left, right through the gaps.
// ---------------------------------------------------------------------------
const hole1 = {
  name: 'Serpent',
  par: 5,
  tee: { x: 300, y: 2320 },
  hole: { x: 300, y: 120 },
  holeRadius: 12,
  bounds: BOUNDS,
  walls: [
    // Outer
    { x1: 80,  y1: 80,   x2: 520, y2: 80   },
    { x1: 520, y1: 80,   x2: 520, y2: 2360 },
    { x1: 520, y1: 2360, x2: 80,  y2: 2360 },
    { x1: 80,  y1: 2360, x2: 80,  y2: 80   },
    // Dividers alternating from each side
    { x1: 80,  y1: 2000, x2: 380, y2: 2000 }, // L, gap right
    { x1: 520, y1: 1600, x2: 220, y2: 1600 }, // R, gap left
    { x1: 80,  y1: 1200, x2: 380, y2: 1200 }, // L, gap right
    { x1: 520, y1: 800,  x2: 220, y2: 800  }, // R, gap left
    { x1: 80,  y1: 400,  x2: 380, y2: 400  }, // L, gap right
  ],
  bumpers: [],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
};

// ---------------------------------------------------------------------------
// Hole 2: "Slope Staircase" (Par 5)
// Tall corridor with three stepped wall platforms and strong slopes in
// between each. Ball funnels down each slope into the next step's gap.
// ---------------------------------------------------------------------------
const hole2 = {
  name: 'Slope Staircase',
  par: 5,
  tee: { x: 150, y: 2320 },
  hole: { x: 300, y: 120 },
  holeRadius: 12,
  bounds: BOUNDS,
  walls: [
    { x1: 80,  y1: 80,   x2: 520, y2: 80   },
    { x1: 520, y1: 80,   x2: 520, y2: 2360 },
    { x1: 520, y1: 2360, x2: 80,  y2: 2360 },
    { x1: 80,  y1: 2360, x2: 80,  y2: 80   },
    // Staircase step 1 (lower): wall from right, gap on left (tee side)
    { x1: 520, y1: 1900, x2: 240, y2: 1900 },
    // Staircase step 2 (middle): wall from left, gap on right
    { x1: 80,  y1: 1300, x2: 360, y2: 1300 },
    // Staircase step 3 (upper): wall from right, gap on left
    { x1: 520, y1: 700,  x2: 240, y2: 700  },
  ],
  bumpers: [
    { x: 450, y: 300, r: 14, bounciness: 1.3 },
  ],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
  slopes: [
    // After step 1 gap, slope pushes ball up-right
    {
      points: [
        { x: 90,  y: 1910 },
        { x: 510, y: 1910 },
        { x: 510, y: 2350 },
        { x: 90,  y: 2350 },
      ],
      ax: 120,
      ay: -80,
    },
    // Between step 1 and step 2, slope pushes up-left
    {
      points: [
        { x: 90,  y: 1310 },
        { x: 510, y: 1310 },
        { x: 510, y: 1890 },
        { x: 90,  y: 1890 },
      ],
      ax: -100,
      ay: -90,
    },
    // Between step 2 and step 3, slope pushes up-right
    {
      points: [
        { x: 90,  y: 710 },
        { x: 510, y: 710 },
        { x: 510, y: 1290 },
        { x: 90,  y: 1290 },
      ],
      ax: 100,
      ay: -90,
    },
  ],
};

// ---------------------------------------------------------------------------
// Hole 3: "Z-Path" (Par 6)
// Giant Z shape:
//   - Upper chamber (hole side):    x=360..520, y=80..1000
//   - Middle connector (horizontal): x=80..520,  y=1000..1400
//   - Lower chamber (tee side):     x=80..240,  y=1400..2360
// Sand island sits in the middle connector with lanes around all four sides.
// ---------------------------------------------------------------------------
const hole3 = {
  name: 'Z-Path',
  par: 6,
  tee: { x: 160, y: 2300 },
  hole: { x: 450, y: 150 },
  holeRadius: 12,
  bounds: BOUNDS,
  walls: [
    // Top of upper chamber
    { x1: 360, y1: 80,   x2: 520, y2: 80   },
    // Right wall (upper chamber + middle connector, continuous)
    { x1: 520, y1: 80,   x2: 520, y2: 1400 },
    // Bottom of middle connector (right portion - gap on left for lower chamber)
    { x1: 520, y1: 1400, x2: 240, y2: 1400 },
    // Right wall of lower chamber
    { x1: 240, y1: 1400, x2: 240, y2: 2360 },
    // Bottom of lower chamber
    { x1: 240, y1: 2360, x2: 80,  y2: 2360 },
    // Left wall (lower chamber + middle connector, continuous)
    { x1: 80,  y1: 2360, x2: 80,  y2: 1000 },
    // Top of middle connector (left portion - gap on right for upper chamber)
    { x1: 80,  y1: 1000, x2: 360, y2: 1000 },
    // Left wall of upper chamber
    { x1: 360, y1: 1000, x2: 360, y2: 80   },
  ],
  bumpers: [
    { x: 440, y: 400, r: 14, bounciness: 1.3 },
    { x: 420, y: 700, r: 14, bounciness: 1.3 },
  ],
  sandTraps: [
    // Sand island in the middle connector - leaves ~110px lanes top/bottom
    // and ~120px lanes left/right
    {
      points: [
        { x: 260, y: 1130 },
        { x: 360, y: 1110 },
        { x: 400, y: 1170 },
        { x: 400, y: 1230 },
        { x: 360, y: 1290 },
        { x: 260, y: 1280 },
        { x: 220, y: 1240 },
        { x: 220, y: 1170 },
      ],
    },
  ],
  waterHazards: [],
  movingObstacles: [],
};

// ---------------------------------------------------------------------------
// Hole 4: "Pinball" (Par 7)
// Massive open chamber with 3 wall islands arranged vertically, 12 bumpers
// scattered between them, and slope fields to add unpredictable deflection.
// ---------------------------------------------------------------------------
const hole4 = {
  name: 'Pinball',
  par: 7,
  tee: { x: 300, y: 2320 },
  hole: { x: 300, y: 130 },
  holeRadius: 12,
  bounds: BOUNDS,
  walls: [
    { x1: 80,  y1: 80,   x2: 520, y2: 80   },
    { x1: 520, y1: 80,   x2: 520, y2: 2360 },
    { x1: 520, y1: 2360, x2: 80,  y2: 2360 },
    { x1: 80,  y1: 2360, x2: 80,  y2: 80   },
    // Wall island 1 (lower)
    { x1: 200, y1: 1900, x2: 400, y2: 1900 },
    { x1: 400, y1: 1900, x2: 400, y2: 2050 },
    { x1: 400, y1: 2050, x2: 200, y2: 2050 },
    { x1: 200, y1: 2050, x2: 200, y2: 1900 },
    // Wall island 2 (middle)
    { x1: 240, y1: 1200, x2: 360, y2: 1200 },
    { x1: 360, y1: 1200, x2: 360, y2: 1350 },
    { x1: 360, y1: 1350, x2: 240, y2: 1350 },
    { x1: 240, y1: 1350, x2: 240, y2: 1200 },
    // Wall island 3 (upper)
    { x1: 200, y1: 500, x2: 400, y2: 500 },
    { x1: 400, y1: 500, x2: 400, y2: 650 },
    { x1: 400, y1: 650, x2: 200, y2: 650 },
    { x1: 200, y1: 650, x2: 200, y2: 500 },
  ],
  bumpers: [
    // Lower cluster
    { x: 150, y: 2150, r: 14, bounciness: 1.3 },
    { x: 450, y: 2150, r: 14, bounciness: 1.3 },
    { x: 300, y: 1750, r: 14, bounciness: 1.3 },
    // Middle cluster
    { x: 160, y: 1550, r: 14, bounciness: 1.3 },
    { x: 440, y: 1550, r: 14, bounciness: 1.3 },
    { x: 160, y: 1280, r: 14, bounciness: 1.3 },
    { x: 440, y: 1280, r: 14, bounciness: 1.3 },
    { x: 300, y: 1000, r: 14, bounciness: 1.3 },
    // Upper cluster
    { x: 180, y: 850, r: 14, bounciness: 1.3 },
    { x: 420, y: 850, r: 14, bounciness: 1.3 },
    { x: 300, y: 400, r: 14, bounciness: 1.3 },
    { x: 180, y: 220, r: 14, bounciness: 1.3 },
  ],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
};

// ---------------------------------------------------------------------------
// Hole 5: "Chicane Gauntlet" (Par 6)
// Long tall corridor with 4 wall chicanes and two windmills.
// Navigate between the walls while timing past the spinning arms.
// ---------------------------------------------------------------------------
const hole5 = {
  name: 'Chicane Gauntlet',
  par: 6,
  tee: { x: 300, y: 2320 },
  hole: { x: 300, y: 120 },
  holeRadius: 12,
  bounds: BOUNDS,
  walls: [
    { x1: 80,  y1: 80,   x2: 520, y2: 80   },
    { x1: 520, y1: 80,   x2: 520, y2: 2360 },
    { x1: 520, y1: 2360, x2: 80,  y2: 2360 },
    { x1: 80,  y1: 2360, x2: 80,  y2: 80   },
    // Chicane 1 (from right, gap left)
    { x1: 520, y1: 2000, x2: 250, y2: 2000 },
    // Chicane 2 (from left, gap right)
    { x1: 80,  y1: 1500, x2: 350, y2: 1500 },
    // Chicane 3 (from right, gap left)
    { x1: 520, y1: 1000, x2: 250, y2: 1000 },
    // Chicane 4 (from left, gap right)
    { x1: 80,  y1: 500, x2: 350, y2: 500  },
  ],
  bumpers: [],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [
    // Windmill between chicane 2 and chicane 3
    {
      type: 'windmill',
      pivot: { x: 300, y: 1250 },
      armLength: 80,
      armWidth: 10,
      rpm: 9,
      phase: 0,
    },
    // Windmill between chicane 4 and hole
    {
      type: 'windmill',
      pivot: { x: 300, y: 280 },
      armLength: 80,
      armWidth: 10,
      rpm: 11,
      phase: Math.PI / 2,
    },
  ],
};

// ---------------------------------------------------------------------------
// Hole 6: "Sand Archipelago" (Par 6)
// Tall corridor with four sand islands positioned in the travel path.
// Sand is brutally punishing now - each sand hit typically costs a stroke.
// ---------------------------------------------------------------------------
const hole6 = {
  name: 'Sand Archipelago',
  par: 6,
  tee: { x: 300, y: 2320 },
  hole: { x: 300, y: 130 },
  holeRadius: 12,
  bounds: BOUNDS,
  walls: [
    { x1: 100, y1: 80,   x2: 500, y2: 80   },
    { x1: 500, y1: 80,   x2: 500, y2: 2360 },
    { x1: 500, y1: 2360, x2: 100, y2: 2360 },
    { x1: 100, y1: 2360, x2: 100, y2: 80   },
  ],
  bumpers: [],
  sandTraps: [
    // Island 1 (lower left-center)
    {
      points: [
        { x: 160, y: 1950 }, { x: 240, y: 1900 }, { x: 320, y: 1920 },
        { x: 360, y: 1980 }, { x: 360, y: 2080 }, { x: 300, y: 2140 },
        { x: 200, y: 2140 }, { x: 130, y: 2070 }, { x: 120, y: 2000 },
      ],
    },
    // Island 2 (right-center)
    {
      points: [
        { x: 320, y: 1500 }, { x: 420, y: 1480 }, { x: 470, y: 1540 },
        { x: 470, y: 1640 }, { x: 400, y: 1700 }, { x: 310, y: 1680 },
        { x: 280, y: 1600 },
      ],
    },
    // Island 3 (center)
    {
      points: [
        { x: 220, y: 1000 }, { x: 380, y: 1000 }, { x: 420, y: 1060 },
        { x: 420, y: 1160 }, { x: 380, y: 1220 }, { x: 220, y: 1220 },
        { x: 180, y: 1160 }, { x: 180, y: 1060 },
      ],
    },
    // Island 4 (upper, tight near hole approach)
    {
      points: [
        { x: 140, y: 400 }, { x: 260, y: 380 }, { x: 330, y: 440 },
        { x: 320, y: 540 }, { x: 240, y: 580 }, { x: 150, y: 540 },
        { x: 110, y: 470 },
      ],
    },
  ],
  waterHazards: [],
  movingObstacles: [],
};

// ---------------------------------------------------------------------------
// Hole 7: "Water Slalom" (Par 7)
// Five offset water patches create a long S-slalom. Water now correctly
// costs a stroke and resets to the last position.
// ---------------------------------------------------------------------------
const hole7 = {
  name: 'Water Slalom',
  par: 7,
  tee: { x: 300, y: 2320 },
  hole: { x: 300, y: 120 },
  holeRadius: 12,
  bounds: BOUNDS,
  walls: [
    { x1: 100, y1: 80,   x2: 500, y2: 80   },
    { x1: 500, y1: 80,   x2: 500, y2: 2360 },
    { x1: 500, y1: 2360, x2: 100, y2: 2360 },
    { x1: 100, y1: 2360, x2: 100, y2: 80   },
  ],
  bumpers: [],
  sandTraps: [],
  waterHazards: [
    // W1 from left
    {
      points: [
        { x: 100, y: 1980 }, { x: 340, y: 1980 },
        { x: 340, y: 2080 }, { x: 100, y: 2080 },
      ],
    },
    // W2 from right
    {
      points: [
        { x: 260, y: 1600 }, { x: 500, y: 1600 },
        { x: 500, y: 1700 }, { x: 260, y: 1700 },
      ],
    },
    // W3 from left
    {
      points: [
        { x: 100, y: 1200 }, { x: 340, y: 1200 },
        { x: 340, y: 1300 }, { x: 100, y: 1300 },
      ],
    },
    // W4 from right
    {
      points: [
        { x: 260, y: 800 }, { x: 500, y: 800 },
        { x: 500, y: 900 }, { x: 260, y: 900 },
      ],
    },
    // W5 from left
    {
      points: [
        { x: 100, y: 400 }, { x: 340, y: 400 },
        { x: 340, y: 500 }, { x: 100, y: 500 },
      ],
    },
  ],
  movingObstacles: [],
};

// ---------------------------------------------------------------------------
// Hole 8: "Windmill Alley" (Par 7)
// Three windmills at different heights plus chicanes between them.
// Timing and angle both matter.
// ---------------------------------------------------------------------------
const hole8 = {
  name: 'Windmill Alley',
  par: 7,
  tee: { x: 300, y: 2320 },
  hole: { x: 300, y: 120 },
  holeRadius: 12,
  bounds: BOUNDS,
  walls: [
    { x1: 140, y1: 80,   x2: 460, y2: 80   },
    { x1: 460, y1: 80,   x2: 460, y2: 2360 },
    { x1: 460, y1: 2360, x2: 140, y2: 2360 },
    { x1: 140, y1: 2360, x2: 140, y2: 80   },
    // Chicanes between windmills
    { x1: 140, y1: 1650, x2: 340, y2: 1650 }, // from left, gap right
    { x1: 460, y1: 900,  x2: 260, y2: 900  }, // from right, gap left
  ],
  bumpers: [],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [
    {
      type: 'windmill',
      pivot: { x: 300, y: 2000 },
      armLength: 100,
      armWidth: 10,
      rpm: 8,
      phase: 0,
    },
    {
      type: 'windmill',
      pivot: { x: 300, y: 1250 },
      armLength: 100,
      armWidth: 10,
      rpm: 11,
      phase: Math.PI / 3,
    },
    {
      type: 'windmill',
      pivot: { x: 300, y: 450 },
      armLength: 100,
      armWidth: 10,
      rpm: 14,
      phase: Math.PI,
    },
  ],
};

// ---------------------------------------------------------------------------
// Hole 9: "The Gauntlet" (Par 9)
// Finale. Every hazard type across a 3-stage journey:
//   Stage 1 (lower): sand islands + windmill
//   Stage 2 (middle): water slalom with slope assist
//   Stage 3 (upper): pinball cluster + water moat + funnel slope to hole
// ---------------------------------------------------------------------------
const hole9 = {
  name: 'The Gauntlet',
  par: 9,
  tee: { x: 300, y: 2320 },
  hole: { x: 300, y: 130 },
  holeRadius: 12,
  bounds: BOUNDS,
  walls: [
    { x1: 80,  y1: 80,   x2: 520, y2: 80   },
    { x1: 520, y1: 80,   x2: 520, y2: 2360 },
    { x1: 520, y1: 2360, x2: 80,  y2: 2360 },
    { x1: 80,  y1: 2360, x2: 80,  y2: 80   },
    // Wall island near hole (blocks straight approach)
    { x1: 220, y1: 300, x2: 380, y2: 300 },
    { x1: 380, y1: 300, x2: 380, y2: 400 },
    { x1: 380, y1: 400, x2: 220, y2: 400 },
    { x1: 220, y1: 400, x2: 220, y2: 300 },
  ],
  bumpers: [
    // Upper cluster - pinball near hole
    { x: 150, y: 250, r: 14, bounciness: 1.3 },
    { x: 450, y: 250, r: 14, bounciness: 1.3 },
    { x: 150, y: 450, r: 14, bounciness: 1.3 },
    { x: 450, y: 450, r: 14, bounciness: 1.3 },
  ],
  sandTraps: [
    // Stage 1 (lower chamber) sand islands
    {
      points: [
        { x: 130, y: 1950 }, { x: 240, y: 1930 },
        { x: 300, y: 2000 }, { x: 280, y: 2100 },
        { x: 180, y: 2140 }, { x: 110, y: 2080 },
      ],
    },
    {
      points: [
        { x: 340, y: 1800 }, { x: 460, y: 1800 },
        { x: 490, y: 1880 }, { x: 440, y: 1960 },
        { x: 330, y: 1920 },
      ],
    },
  ],
  waterHazards: [
    // Stage 2 (middle chamber) water slalom
    {
      points: [
        { x: 80,  y: 1400 }, { x: 340, y: 1400 },
        { x: 340, y: 1480 }, { x: 80,  y: 1480 },
      ],
    },
    {
      points: [
        { x: 260, y: 1100 }, { x: 520, y: 1100 },
        { x: 520, y: 1180 }, { x: 260, y: 1180 },
      ],
    },
    // Stage 3 - moat near hole
    {
      points: [
        { x: 200, y: 600 }, { x: 400, y: 600 },
        { x: 400, y: 680 }, { x: 200, y: 680 },
      ],
    },
  ],
  movingObstacles: [
    // Windmill at Stage 1 exit
    {
      type: 'windmill',
      pivot: { x: 300, y: 1700 },
      armLength: 90,
      armWidth: 10,
      rpm: 10,
      phase: 0,
    },
  ],
  slopes: [
    // Slope helps ball through Stage 2 water slalom
    {
      points: [
        { x: 90, y: 1200 }, { x: 510, y: 1200 },
        { x: 510, y: 1400 }, { x: 90, y: 1400 },
      ],
      ax: -60,
      ay: -80,
    },
    // Funnel slope near hole pulls toward cup
    {
      points: [
        { x: 90, y: 100 }, { x: 510, y: 100 },
        { x: 510, y: 280 }, { x: 90, y: 280 },
      ],
      ax: 0,
      ay: -40,
    },
  ],
};

// ---------------------------------------------------------------------------
// Exported course list
// Par: 5+5+6+7+6+6+7+7+9 = 58
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
