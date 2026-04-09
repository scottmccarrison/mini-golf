// courses.js - Mini Golf course data definitions
// Each hole defines playfield geometry used by the physics engine.
// Logical canvas: 600x800 pixels. Tee near bottom, hole near top generally.

// ---------------------------------------------------------------------------
// Hole 1: "Straight Shot" (Par 2)
// Simple rectangular corridor - pure introduction hole, no obstacles.
// ---------------------------------------------------------------------------
const hole1 = {
  name: 'Straight Shot',
  par: 2,
  tee: { x: 300, y: 700 },
  hole: { x: 300, y: 120 },
  holeRadius: 12,
  bounds: { width: 600, height: 800 },
  // Closed rectangle: 200px wide corridor centered at x=300
  // Corners: (200,80) -> (400,80) -> (400,760) -> (200,760) -> back to start
  walls: [
    { x1: 200, y1: 80,  x2: 400, y2: 80  }, // top
    { x1: 400, y1: 80,  x2: 400, y2: 760 }, // right
    { x1: 400, y1: 760, x2: 200, y2: 760 }, // bottom
    { x1: 200, y1: 760, x2: 200, y2: 80  }, // left
  ],
  bumpers: [],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
};

// ---------------------------------------------------------------------------
// Hole 2: "Gentle Bend" (Par 2)
// Slight L-shape - wider corridor (250px) so it is forgiving.
// Teaches that angles matter.
// ---------------------------------------------------------------------------
const hole2 = {
  name: 'Gentle Bend',
  par: 2,
  tee: { x: 175, y: 700 },
  hole: { x: 430, y: 120 },
  holeRadius: 12,
  bounds: { width: 600, height: 800 },
  // L-shape: vertical leg on left, horizontal leg at top-right
  // Vertical leg: x=50..300, y=280..760
  // Horizontal leg: x=50..550, y=80..280
  // Closed perimeter (clockwise from top-left):
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
};

// ---------------------------------------------------------------------------
// Hole 3: "The Dogleg" (Par 3)
// Right-angle L-shape, narrower corridor (180px).
// Ball must bank or take two shots around the corner.
// ---------------------------------------------------------------------------
const hole3 = {
  name: 'The Dogleg',
  par: 3,
  tee: { x: 175, y: 680 },
  hole: { x: 450, y: 130 },
  holeRadius: 12,
  bounds: { width: 600, height: 800 },
  // Vertical leg: x=86..266, y=480..760
  // Horizontal leg: x=86..540, y=80..280
  // Corner connector: x=86..266, y=280..480
  walls: [
    { x1: 86,  y1: 80,  x2: 540, y2: 80  }, // top
    { x1: 540, y1: 80,  x2: 540, y2: 280 }, // right of horizontal leg
    { x1: 540, y1: 280, x2: 266, y2: 280 }, // inner step
    { x1: 266, y1: 280, x2: 266, y2: 760 }, // inner right of vertical+corner
    { x1: 266, y1: 760, x2: 86,  y2: 760 }, // bottom
    { x1: 86,  y1: 760, x2: 86,  y2: 80  }, // left
  ],
  bumpers: [],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
};

// ---------------------------------------------------------------------------
// Hole 4: "Bumper Alley" (Par 3)
// Straight corridor with 3 bumpers scattered in the path.
// ---------------------------------------------------------------------------
const hole4 = {
  name: 'Bumper Alley',
  par: 3,
  tee: { x: 300, y: 700 },
  hole: { x: 300, y: 120 },
  holeRadius: 12,
  bounds: { width: 600, height: 800 },
  // Wider corridor: x=190..410, y=80..760
  walls: [
    { x1: 190, y1: 80,  x2: 410, y2: 80  },
    { x1: 410, y1: 80,  x2: 410, y2: 760 },
    { x1: 410, y1: 760, x2: 190, y2: 760 },
    { x1: 190, y1: 760, x2: 190, y2: 80  },
  ],
  bumpers: [
    { x: 260, y: 580, r: 14, bounciness: 1.3 },
    { x: 340, y: 420, r: 14, bounciness: 1.3 },
    { x: 260, y: 260, r: 14, bounciness: 1.3 },
  ],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
};

// ---------------------------------------------------------------------------
// Hole 5: "The L with Teeth" (Par 4)
// L-shaped course with bumpers at the corner and a wall island creating
// a chicane. Tee at bottom-left, hole at top-right.
// ---------------------------------------------------------------------------
const hole5 = {
  name: 'The L with Teeth',
  par: 4,
  tee: { x: 160, y: 680 },
  hole: { x: 460, y: 130 },
  holeRadius: 12,
  bounds: { width: 600, height: 800 },
  // Outer boundary (L-shape):
  // Horizontal leg: x=80..550, y=80..280
  // Vertical leg: x=80..280, y=280..760
  walls: [
    { x1: 80,  y1: 80,  x2: 550, y2: 80  }, // top
    { x1: 550, y1: 80,  x2: 550, y2: 280 }, // right of horizontal leg
    { x1: 550, y1: 280, x2: 280, y2: 280 }, // inner step
    { x1: 280, y1: 280, x2: 280, y2: 760 }, // inner right of vertical leg
    { x1: 280, y1: 760, x2: 80,  y2: 760 }, // bottom
    { x1: 80,  y1: 760, x2: 80,  y2: 80  }, // left
    // Wall island (chicane) in the corner area - forces players to route around
    { x1: 140, y1: 340, x2: 220, y2: 340 }, // top of island
    { x1: 220, y1: 340, x2: 220, y2: 440 }, // right of island
    { x1: 220, y1: 440, x2: 140, y2: 440 }, // bottom of island
    { x1: 140, y1: 440, x2: 140, y2: 340 }, // left of island
  ],
  bumpers: [
    { x: 420, y: 200, r: 14, bounciness: 1.3 },
    { x: 320, y: 200, r: 14, bounciness: 1.3 },
  ],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
};

// ---------------------------------------------------------------------------
// Hole 6: "Sandy Approach" (Par 3)
// Straight path with sand trap guarding the hole approach.
// Player must power through sand or curve around it.
// ---------------------------------------------------------------------------
const hole6 = {
  name: 'Sandy Approach',
  par: 3,
  tee: { x: 300, y: 700 },
  hole: { x: 300, y: 130 },
  holeRadius: 12,
  bounds: { width: 600, height: 800 },
  // Corridor: x=170..430, y=80..760
  walls: [
    { x1: 170, y1: 80,  x2: 430, y2: 80  },
    { x1: 430, y1: 80,  x2: 430, y2: 760 },
    { x1: 430, y1: 760, x2: 170, y2: 760 },
    { x1: 170, y1: 760, x2: 170, y2: 80  },
  ],
  bumpers: [],
  // Sand trap: wide band across the corridor below the hole
  sandTraps: [
    {
      points: [
        { x: 180, y: 200 },
        { x: 240, y: 185 },
        { x: 300, y: 180 },
        { x: 360, y: 185 },
        { x: 420, y: 200 },
        { x: 420, y: 280 },
        { x: 360, y: 295 },
        { x: 300, y: 300 },
        { x: 240, y: 295 },
        { x: 180, y: 280 },
      ],
    },
  ],
  waterHazards: [],
  movingObstacles: [],
};

// ---------------------------------------------------------------------------
// Hole 7: "Water Crossing" (Par 4)
// Water hazard across the middle with a narrow bridge gap (~80px) to aim
// through. Also possible to bank off side walls around the water.
// ---------------------------------------------------------------------------
const hole7 = {
  name: 'Water Crossing',
  par: 4,
  tee: { x: 300, y: 700 },
  hole: { x: 300, y: 120 },
  holeRadius: 12,
  bounds: { width: 600, height: 800 },
  // Wide corridor: x=100..500, y=80..760
  walls: [
    { x1: 100, y1: 80,  x2: 500, y2: 80  },
    { x1: 500, y1: 80,  x2: 500, y2: 760 },
    { x1: 500, y1: 760, x2: 100, y2: 760 },
    { x1: 100, y1: 760, x2: 100, y2: 80  },
  ],
  bumpers: [],
  sandTraps: [],
  // Water hazard across the middle, leaving a bridge gap at center (x=260..340)
  waterHazards: [
    {
      points: [
        { x: 100, y: 360 },
        { x: 260, y: 360 },
        { x: 260, y: 480 },
        { x: 100, y: 480 },
      ],
    },
    {
      points: [
        { x: 340, y: 360 },
        { x: 500, y: 360 },
        { x: 500, y: 480 },
        { x: 340, y: 480 },
      ],
    },
  ],
  movingObstacles: [],
};

// ---------------------------------------------------------------------------
// Hole 8: "Windmill" (Par 4)
// Classic windmill obstacle in a straight corridor. Timing is key.
// ---------------------------------------------------------------------------
const hole8 = {
  name: 'Windmill',
  par: 4,
  tee: { x: 300, y: 700 },
  hole: { x: 300, y: 120 },
  holeRadius: 12,
  bounds: { width: 600, height: 800 },
  // Corridor: x=180..420, y=80..760
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
// S-curve path combining bumpers, sand trap, water hazard, and a windmill.
// Grand finale - multiple paths possible.
//
// Layout: two connected rectangular chambers forming an S-path
//   Upper-right chamber: x=280..550, y=80..400
//   Lower-left chamber: x=50..320, y=380..760
//   Connection gap: x=280..320, y=380..400 (overlap area)
// ---------------------------------------------------------------------------
const hole9 = {
  name: 'The Gauntlet',
  par: 5,
  tee: { x: 160, y: 730 },
  hole: { x: 440, y: 160 },
  holeRadius: 12,
  bounds: { width: 600, height: 800 },
  // S-curve boundary: two chambers connected at the center
  walls: [
    // Upper-right chamber
    { x1: 280, y1: 80,  x2: 550, y2: 80  }, // top
    { x1: 550, y1: 80,  x2: 550, y2: 400 }, // right
    { x1: 550, y1: 400, x2: 320, y2: 400 }, // bottom of upper chamber
    // Right side of lower chamber (below the connection gap)
    { x1: 320, y1: 400, x2: 320, y2: 760 }, // right wall of lower chamber
    { x1: 320, y1: 760, x2: 50,  y2: 760 }, // bottom
    { x1: 50,  y1: 760, x2: 50,  y2: 380 }, // left wall of lower chamber
    { x1: 50,  y1: 380, x2: 280, y2: 380 }, // top of lower chamber (left side)
    // Left side of upper chamber (above the connection gap)
    { x1: 280, y1: 380, x2: 280, y2: 80  }, // left wall of upper chamber
  ],
  bumpers: [
    { x: 430, y: 300, r: 14, bounciness: 1.3 },
    { x: 370, y: 180, r: 14, bounciness: 1.3 },
  ],
  sandTraps: [
    {
      points: [
        { x: 70,  y: 500 },
        { x: 140, y: 490 },
        { x: 180, y: 500 },
        { x: 180, y: 570 },
        { x: 140, y: 580 },
        { x: 70,  y: 570 },
      ],
    },
  ],
  waterHazards: [
    {
      points: [
        { x: 80,  y: 600 },
        { x: 220, y: 600 },
        { x: 220, y: 690 },
        { x: 80,  y: 690 },
      ],
    },
  ],
  movingObstacles: [
    {
      type: 'windmill',
      pivot: { x: 415, y: 300 },
      armLength: 60,
      armWidth: 8,
      rpm: 10,
      phase: 0,
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
