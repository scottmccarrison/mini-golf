// courses.js - Mini Golf course data definitions
// Each hole defines playfield geometry used by the physics engine.
// Logical canvas size is per-hole (bounds field below).
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

// ---------------------------------------------------------------------------
// Hole 1: "Slingshot" (Par 2)
// Signature: Off-axis magnet - tugs a straight putt off the line.
// Outer shape: octagonal (chamfered rectangle).
// ---------------------------------------------------------------------------
const hole1 = {
  name: 'Slingshot',
  par: 2,
  tee: { x: 100, y: 300 },
  hole: { x: 700, y: 300 },
  holeRadius: 12,
  bounds: { width: 800, height: 600 },
  walls: [
    // Chamfered rectangle - top side
    { x1: 160, y1: 80,  x2: 640, y2: 80  },
    // Top-right diagonal
    { x1: 640, y1: 80,  x2: 720, y2: 160 },
    // Right side
    { x1: 720, y1: 160, x2: 720, y2: 440 },
    // Bottom-right diagonal
    { x1: 720, y1: 440, x2: 640, y2: 520 },
    // Bottom side
    { x1: 640, y1: 520, x2: 160, y2: 520 },
    // Bottom-left diagonal
    { x1: 160, y1: 520, x2: 80,  y2: 440 },
    // Left side
    { x1: 80,  y1: 440, x2: 80,  y2: 160 },
    // Top-left diagonal
    { x1: 80,  y1: 160, x2: 160, y2: 80  },
  ],
  bumpers: [],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
  slopes: [],
  speedPads: [],
  magnets: [
    // Magnet sits 80px above the hole - a dead-straight putt gets tugged
    // upward and misses high. Player has to compensate by aiming low or
    // banking off the bottom wall.
    { x: 700, y: 220, strength: 500, radius: 220 },
  ],
  oneWayGates: [],
  teleporters: [],
};

// ---------------------------------------------------------------------------
// Hole 2: "The Crescent" (Par 3)
// Signature: Kidney-bean shape - bank the outer arc, avoid inner sand bite.
// ---------------------------------------------------------------------------
const hole2 = {
  name: 'The Crescent',
  par: 3,
  tee: { x: 150, y: 500 },
  hole: { x: 750, y: 500 },
  holeRadius: 12,
  bounds: { width: 900, height: 600 },
  walls: [
    // Outer arc - left tip up
    { x1: 150, y1: 500, x2: 100, y2: 400 },
    // Up-left
    { x1: 100, y1: 400, x2: 150, y2: 250 },
    // Up-right
    { x1: 150, y1: 250, x2: 300, y2: 150 },
    // Top
    { x1: 300, y1: 150, x2: 600, y2: 150 },
    // Down-right
    { x1: 600, y1: 150, x2: 750, y2: 250 },
    // More down
    { x1: 750, y1: 250, x2: 800, y2: 400 },
    // Right tip
    { x1: 800, y1: 400, x2: 750, y2: 500 },
    // Inner bottom-right
    { x1: 750, y1: 500, x2: 600, y2: 480 },
    // Inner bottom curve up
    { x1: 600, y1: 480, x2: 450, y2: 420 },
    // Inner bottom curve down
    { x1: 450, y1: 420, x2: 300, y2: 480 },
    // Inner bottom-left close
    { x1: 300, y1: 480, x2: 150, y2: 500 },
  ],
  bumpers: [],
  sandTraps: [
    // Fill the inner "bite" of the crescent
    {
      points: [
        { x: 280, y: 470 },
        { x: 350, y: 400 },
        { x: 450, y: 360 },
        { x: 550, y: 390 },
        { x: 620, y: 460 },
        { x: 600, y: 475 },
        { x: 450, y: 415 },
        { x: 300, y: 475 },
      ],
    },
  ],
  waterHazards: [],
  movingObstacles: [],
  slopes: [],
  speedPads: [],
  magnets: [],
  oneWayGates: [],
  teleporters: [],
};

// ---------------------------------------------------------------------------
// Hole 3: "Funnel" (Par 3)
// Signature: Triangle with slopes pushing OUTWARD toward the diagonal walls,
// where notch baffles deflect the ball. Triangle still narrows so apex is
// reachable, but you can't just roll straight up the centerline.
// ---------------------------------------------------------------------------
const hole3 = {
  name: 'Funnel',
  par: 3,
  tee: { x: 350, y: 800 },
  hole: { x: 350, y: 130 },
  holeRadius: 12,
  bounds: { width: 700, height: 900 },
  walls: [
    // Triangle: wide base at bottom, point at top
    { x1: 100, y1: 850, x2: 600, y2: 850 },
    { x1: 600, y1: 850, x2: 350, y2: 100 },
    { x1: 350, y1: 100, x2: 100, y2: 850 },
    // Right-diagonal notch baffles (jut inward from the right wall)
    { x1: 562, y1: 737, x2: 515, y2: 753 },
    { x1: 525, y1: 625, x2: 478, y2: 641 },
    { x1: 488, y1: 512, x2: 440, y2: 528 },
    { x1: 450, y1: 400, x2: 402, y2: 416 },
    // Left-diagonal notch baffles (jut inward from the left wall)
    { x1: 275, y1: 325, x2: 322, y2: 341 },
    { x1: 238, y1: 437, x2: 285, y2: 453 },
    { x1: 200, y1: 550, x2: 248, y2: 566 },
    { x1: 162, y1: 662, x2: 210, y2: 678 },
  ],
  bumpers: [
    { x: 350, y: 500, r: 14, bounciness: 1.3 },
  ],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
  slopes: [
    // Left half: push LEFT toward the left diagonal wall (and slightly up)
    {
      points: [
        { x: 100, y: 300 },
        { x: 350, y: 300 },
        { x: 350, y: 850 },
        { x: 100, y: 850 },
      ],
      ax: -50,
      ay: -30,
    },
    // Right half: push RIGHT toward the right diagonal wall (and slightly up)
    {
      points: [
        { x: 350, y: 300 },
        { x: 600, y: 300 },
        { x: 600, y: 850 },
        { x: 350, y: 850 },
      ],
      ax: 50,
      ay: -30,
    },
  ],
  speedPads: [],
  magnets: [],
  oneWayGates: [],
  teleporters: [],
};

// ---------------------------------------------------------------------------
// Hole 4: "Conveyor" (Par 4)
// Signature: Plus-shaped course with a diamond island in the junction that
// deflects the straight tee->hole shot into the side arms, where conveyors
// take over and route the ball back toward the top arm and hole.
// ---------------------------------------------------------------------------
const hole4 = {
  name: 'Conveyor',
  par: 4,
  tee: { x: 450, y: 850 },
  hole: { x: 450, y: 50 },
  holeRadius: 12,
  bounds: { width: 900, height: 900 },
  walls: [
    // Outer perimeter of the plus shape - traced clockwise
    // Bottom arm left edge up to junction
    { x1: 350, y1: 870, x2: 350, y2: 650 },
    // Junction bottom-left corner
    { x1: 350, y1: 650, x2: 30,  y2: 650 },
    // Left arm outer bottom
    { x1: 30,  y1: 650, x2: 30,  y2: 350 },
    // Left arm outer top
    { x1: 30,  y1: 350, x2: 350, y2: 350 },
    // Junction top-left corner
    { x1: 350, y1: 350, x2: 350, y2: 30  },
    // Top arm left edge
    { x1: 350, y1: 30,  x2: 550, y2: 30  },
    // Top arm right edge
    { x1: 550, y1: 30,  x2: 550, y2: 350 },
    // Junction top-right corner
    { x1: 550, y1: 350, x2: 870, y2: 350 },
    // Right arm outer top
    { x1: 870, y1: 350, x2: 870, y2: 650 },
    // Right arm outer bottom
    { x1: 870, y1: 650, x2: 550, y2: 650 },
    // Junction bottom-right corner
    { x1: 550, y1: 650, x2: 550, y2: 870 },
    // Bottom arm right edge
    { x1: 550, y1: 870, x2: 350, y2: 870 },
    // Diamond island in the center of the junction - large enough that
    // straight-up shots cannot squeeze past on either side. Forces deflection
    // into the side arms where conveyors take over.
    { x1: 450, y1: 410, x2: 540, y2: 500 },
    { x1: 540, y1: 500, x2: 450, y2: 590 },
    { x1: 450, y1: 590, x2: 360, y2: 500 },
    { x1: 360, y1: 500, x2: 450, y2: 410 },
  ],
  bumpers: [],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
  slopes: [],
  speedPads: [
    // Right arm - push outward (east), launches ball into the dead-end wall
    // where it bounces back into the junction with new energy
    {
      points: [
        { x: 650, y: 450 },
        { x: 860, y: 450 },
        { x: 860, y: 550 },
        { x: 650, y: 550 },
      ],
      ax: 1200,
      ay: 0,
    },
    // Left arm - push outward (west), mirrors right arm
    {
      points: [
        { x: 40,  y: 450 },
        { x: 250, y: 450 },
        { x: 250, y: 550 },
        { x: 40,  y: 550 },
      ],
      ax: -1200,
      ay: 0,
    },
    // Top arm - push toward hole (down-center funnels ball to cup)
    {
      points: [
        { x: 360, y: 40  },
        { x: 540, y: 40  },
        { x: 540, y: 130 },
        { x: 360, y: 130 },
      ],
      ax: 0,
      ay: -600,
    },
  ],
  magnets: [],
  oneWayGates: [],
  teleporters: [],
};

// ---------------------------------------------------------------------------
// Hole 5: "Teleport Trio" (Par 4)
// Signature: U/horseshoe shape with three teleporter pairs for route choice.
// ---------------------------------------------------------------------------
const hole5 = {
  name: 'Teleport Trio',
  par: 4,
  tee: { x: 200, y: 700 },
  hole: { x: 800, y: 700 },
  holeRadius: 12,
  bounds: { width: 1000, height: 800 },
  walls: [
    // Left arm outer left
    { x1: 100, y1: 750, x2: 100, y2: 100 },
    // Top connector outer top
    { x1: 100, y1: 100, x2: 900, y2: 100 },
    // Right arm outer right
    { x1: 900, y1: 100, x2: 900, y2: 750 },
    // Right arm bottom cap
    { x1: 900, y1: 750, x2: 700, y2: 750 },
    // Right arm inner right up
    { x1: 700, y1: 750, x2: 700, y2: 300 },
    // Top connector inner bottom
    { x1: 700, y1: 300, x2: 300, y2: 300 },
    // Left arm inner left down
    { x1: 300, y1: 300, x2: 300, y2: 750 },
    // Left arm bottom cap
    { x1: 300, y1: 750, x2: 100, y2: 750 },
  ],
  bumpers: [],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
  slopes: [],
  speedPads: [],
  magnets: [],
  oneWayGates: [],
  teleporters: [
    // Low hop - near the tee end
    { a: { x: 200, y: 600, r: 25 }, b: { x: 800, y: 600, r: 25 } },
    // Mid hop
    { a: { x: 200, y: 400, r: 25 }, b: { x: 800, y: 400, r: 25 } },
    // High hop - near the connector
    { a: { x: 200, y: 200, r: 25 }, b: { x: 800, y: 200, r: 25 } },
  ],
};

// ---------------------------------------------------------------------------
// Hole 6: "One-Way Spiral" (Par 4)
// Signature: Square spiral with gates that block backtracking.
// Path: enter at bottom gap -> clockwise ring 1 -> gap at left -> clockwise
// ring 2 -> open center -> hole.
// ---------------------------------------------------------------------------
const hole6 = {
  name: 'One-Way Spiral',
  par: 4,
  tee: { x: 600, y: 650 },
  hole: { x: 400, y: 400 },
  holeRadius: 12,
  bounds: { width: 800, height: 800 },
  walls: [
    // Outer rectangle
    { x1: 80,  y1: 80,  x2: 720, y2: 80  },
    { x1: 720, y1: 80,  x2: 720, y2: 720 },
    { x1: 720, y1: 720, x2: 80,  y2: 720 },
    { x1: 80,  y1: 720, x2: 80,  y2: 80  },

    // Ring 1 inner wall - entry gap at bottom (x=360..440, y=580)
    // Ball enters gap going UP, then goes clockwise: right side down,
    // bottom across, up left side, across top, then exits left gap to ring 2.
    // Left segment of ring 1 bottom (gap at x=360..440)
    { x1: 160, y1: 580, x2: 360, y2: 580 },
    // Right segment of ring 1 bottom
    { x1: 440, y1: 580, x2: 640, y2: 580 },
    // Ring 1 right side (full)
    { x1: 640, y1: 580, x2: 640, y2: 160 },
    // Ring 1 top (full)
    { x1: 640, y1: 160, x2: 160, y2: 160 },
    // Ring 1 left side - gap at y=460..540 for exit to ring 2
    { x1: 160, y1: 160, x2: 160, y2: 460 },
    // (gap from y=460 to y=540)
    { x1: 160, y1: 540, x2: 160, y2: 580 },

    // Ring 2 inner wall - ball enters from left gap, goes clockwise inward.
    // Ring 2 bottom has a gap at x=360..440 so the direct approach can reach
    // the hole, but the one-way gate blocks retreat.
    // Ring 2 left side - gap at y=380..460 aligns with ring 1 left gap exit
    { x1: 240, y1: 240, x2: 240, y2: 380 },
    // (gap from y=380 to y=460)
    { x1: 240, y1: 460, x2: 240, y2: 500 },
    // Ring 2 bottom - left segment (gap at x=360..440 for direct approach)
    { x1: 240, y1: 500, x2: 360, y2: 500 },
    // Ring 2 bottom - right segment
    { x1: 440, y1: 500, x2: 560, y2: 500 },
    // Ring 2 right side
    { x1: 560, y1: 500, x2: 560, y2: 240 },
    // Ring 2 top
    { x1: 560, y1: 240, x2: 240, y2: 240 },
    // Center is open - hole at (400,400) is reachable from inside ring 2
  ],
  bumpers: [],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
  slopes: [],
  speedPads: [],
  magnets: [
    // Small pull toward hole to guide ball once it's inside ring 2
    { x: 400, y: 400, strength: 300, radius: 150 },
  ],
  oneWayGates: [
    // Gate at ring 1 bottom entry gap - allow passage upward (into spiral), block retreat
    { x1: 360, y1: 580, x2: 440, y2: 580, nx: 0, ny: -1 },
    // Gate at ring 1 left exit gap - allow passage leftward (into ring 2 corridor)
    { x1: 160, y1: 460, x2: 160, y2: 540, nx: -1, ny: 0 },
    // Gate at ring 2 bottom gap - allow passage upward (into center), block retreat
    { x1: 360, y1: 500, x2: 440, y2: 500, nx: 0, ny: -1 },
  ],
  teleporters: [],
};

// ---------------------------------------------------------------------------
// Hole 7: "The Roundabout" (Par 5)
// Signature: Octagonal arena with two bumpers forming an island + central magnet.
// Ball curves around the bumper island drawn by the magnet. A second magnet
// at the hole location helps pull it in once the ball reaches the far side.
// ---------------------------------------------------------------------------
const hole7 = {
  name: 'The Roundabout',
  par: 5,
  tee: { x: 450, y: 780 },
  hole: { x: 450, y: 140 },
  holeRadius: 12,
  bounds: { width: 900, height: 900 },
  walls: [
    // Outer octagon
    { x1: 300, y1: 80,  x2: 600, y2: 80  },
    { x1: 600, y1: 80,  x2: 800, y2: 280 },
    { x1: 800, y1: 280, x2: 800, y2: 620 },
    { x1: 800, y1: 620, x2: 600, y2: 820 },
    { x1: 600, y1: 820, x2: 300, y2: 820 },
    { x1: 300, y1: 820, x2: 100, y2: 620 },
    { x1: 100, y1: 620, x2: 100, y2: 280 },
    { x1: 100, y1: 280, x2: 300, y2: 80  },
    // Central diamond island (4 walls)
    { x1: 450, y1: 390, x2: 510, y2: 450 },
    { x1: 510, y1: 450, x2: 450, y2: 510 },
    { x1: 450, y1: 510, x2: 390, y2: 450 },
    { x1: 390, y1: 450, x2: 450, y2: 390 },
  ],
  bumpers: [
    // Bumpers flanking center to redirect orbital balls
    { x: 350, y: 350, r: 12, bounciness: 1.2 },
    { x: 550, y: 350, r: 12, bounciness: 1.2 },
  ],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
  slopes: [],
  speedPads: [],
  magnets: [
    // Gentle central orbital tug - bends trajectory without trapping
    { x: 450, y: 450, strength: 120, radius: 350 },
    // Hole magnet - pulls ball in once it gets into the upper half
    { x: 450, y: 140, strength: 500, radius: 220 },
  ],
  oneWayGates: [],
  teleporters: [],
};

// ---------------------------------------------------------------------------
// Hole 8: "Island Hop" (Par 5)
// Signature: Four platforms in water, teleporters chain them together.
// ---------------------------------------------------------------------------
const hole8 = {
  name: 'Island Hop',
  par: 5,
  tee: { x: 150, y: 850 },
  hole: { x: 850, y: 150 },
  holeRadius: 12,
  bounds: { width: 1000, height: 1000 },
  walls: [
    // Island 1 (bottom-left, tee): x=50..250, y=750..950
    { x1: 50,  y1: 750, x2: 250, y2: 750 },
    { x1: 250, y1: 750, x2: 250, y2: 950 },
    { x1: 250, y1: 950, x2: 50,  y2: 950 },
    { x1: 50,  y1: 950, x2: 50,  y2: 750 },
    // Island 2 (center-left): x=250..450, y=450..650
    { x1: 250, y1: 450, x2: 450, y2: 450 },
    { x1: 450, y1: 450, x2: 450, y2: 650 },
    { x1: 450, y1: 650, x2: 250, y2: 650 },
    { x1: 250, y1: 650, x2: 250, y2: 450 },
    // Island 3 (center-right): x=550..750, y=350..550
    { x1: 550, y1: 350, x2: 750, y2: 350 },
    { x1: 750, y1: 350, x2: 750, y2: 550 },
    { x1: 750, y1: 550, x2: 550, y2: 550 },
    { x1: 550, y1: 550, x2: 550, y2: 350 },
    // Island 4 (top-right, hole): x=750..950, y=50..250
    { x1: 750, y1: 50,  x2: 950, y2: 50  },
    { x1: 950, y1: 50,  x2: 950, y2: 250 },
    { x1: 950, y1: 250, x2: 750, y2: 250 },
    { x1: 750, y1: 250, x2: 750, y2: 50  },
  ],
  bumpers: [],
  sandTraps: [],
  waterHazards: [
    // Water covers the gaps between islands - two large rectangles
    // Bottom-right + lower-center area
    {
      points: [
        { x: 250, y: 650 },
        { x: 1000, y: 650 },
        { x: 1000, y: 1000 },
        { x: 250, y: 1000 },
      ],
    },
    // Top-left + upper-center area
    {
      points: [
        { x: 0,   y: 0   },
        { x: 750, y: 0   },
        { x: 750, y: 350 },
        { x: 0,   y: 350 },
      ],
    },
    // Middle gap between islands 2 and 3
    {
      points: [
        { x: 450, y: 350 },
        { x: 550, y: 350 },
        { x: 550, y: 650 },
        { x: 450, y: 650 },
      ],
    },
  ],
  movingObstacles: [],
  slopes: [],
  speedPads: [],
  magnets: [],
  oneWayGates: [],
  teleporters: [
    // Island 1 -> Island 2
    { a: { x: 220, y: 780, r: 25 }, b: { x: 280, y: 620, r: 25 } },
    // Island 2 -> Island 3
    { a: { x: 420, y: 480, r: 25 }, b: { x: 580, y: 520, r: 25 } },
    // Island 3 -> Island 4
    { a: { x: 720, y: 380, r: 25 }, b: { x: 780, y: 220, r: 25 } },
  ],
};

// ---------------------------------------------------------------------------
// Hole 9: "The Gauntlet" (Par 6)
// Signature: T-shaped finale - speed pad up the stem, one-way gate commits
// you to the top arm, magnet at the hole pulls you home.
// ---------------------------------------------------------------------------
const hole9 = {
  name: 'The Gauntlet',
  par: 6,
  tee: { x: 600, y: 850 },
  hole: { x: 1100, y: 200 },
  holeRadius: 12,
  bounds: { width: 1200, height: 900 },
  walls: [
    // Stem left edge up to junction
    { x1: 500, y1: 870, x2: 500, y2: 300 },
    // Stem bottom cap
    { x1: 500, y1: 870, x2: 700, y2: 870 },
    // Stem right edge up to junction
    { x1: 700, y1: 870, x2: 700, y2: 300 },
    // Top arm - left section from stem junction
    { x1: 500, y1: 300, x2: 80,  y2: 300 },
    // Top arm - left wall
    { x1: 80,  y1: 300, x2: 80,  y2: 80  },
    // Top arm - top
    { x1: 80,  y1: 80,  x2: 1120, y2: 80  },
    // Top arm - right wall
    { x1: 1120, y1: 80,  x2: 1120, y2: 300 },
    // Top arm - right section from stem junction
    { x1: 1120, y1: 300, x2: 700, y2: 300 },
  ],
  bumpers: [],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
  slopes: [],
  speedPads: [
    // Stage 1: Speed pad in stem pushing ball upward
    {
      points: [
        { x: 510, y: 600 },
        { x: 690, y: 600 },
        { x: 690, y: 800 },
        { x: 510, y: 800 },
      ],
      ax: 0,
      ay: -1500,
    },
  ],
  magnets: [
    // Stage 3: Magnet at hole end pulls toward the cup
    { x: 1100, y: 200, strength: 500, radius: 300 },
  ],
  oneWayGates: [
    // Stage 2: Gate at top of stem - ball must commit upward into the T arm
    { x1: 500, y1: 300, x2: 700, y2: 300, nx: 0, ny: -1 },
  ],
  teleporters: [],
};

// ---------------------------------------------------------------------------
// Exported course list
// Par: 2+3+3+4+4+4+5+5+6 = 36
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
