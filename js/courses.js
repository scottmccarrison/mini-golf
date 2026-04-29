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
// Signature: Asymmetric U/horseshoe - left arm is wide and open (power side),
// right arm is narrower with a V-funnel + sand collar near the hole
// (precision side). Three teleporter pairs are staggered, not mirrored, so
// each route has a distinct risk/reward profile:
//   Aqua  - short tee putt, lands mid-connector (still a long way home)
//   Magenta - medium putt up left arm, drops at top of right arm (must
//             thread the funnel)
//   Yellow  - long putt up the full left arm, exits below the funnel right
//             at the sand collar (earned shortcut)
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
    // Top connector outer top - shortened to x=860 for asymmetric narrower right side
    { x1: 100, y1: 100, x2: 860, y2: 100 },
    // Right arm outer right (narrower than left arm)
    { x1: 860, y1: 100, x2: 860, y2: 750 },
    // Right arm bottom cap
    { x1: 860, y1: 750, x2: 700, y2: 750 },
    // Right arm inner right up
    { x1: 700, y1: 750, x2: 700, y2: 300 },
    // Top connector inner bottom
    { x1: 700, y1: 300, x2: 300, y2: 300 },
    // Left arm inner left down
    { x1: 300, y1: 300, x2: 300, y2: 750 },
    // Left arm bottom cap
    { x1: 300, y1: 750, x2: 100, y2: 750 },
    // V-funnel walls in upper right arm. Balls dropping from the connector
    // (or from magenta's exit at the top of the right arm) must thread the
    // 60px gap between the wall tips at y=460. Yellow's exit at y=600 is
    // below the funnel - that route bypasses it entirely as the reward for
    // the long initial putt. Roots are offset 8px inward from the arm walls
    // to avoid T-junction double-collision jitter.
    { x1: 708, y1: 380, x2: 755, y2: 460 },
    { x1: 852, y1: 380, x2: 815, y2: 460 },
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
    // Aqua (intro - tee side): short putt to enter, lands in middle of the
    // top connector. Still requires connector traversal + dropping through
    // the V-funnel to finish.
    { a: { x: 200, y: 600, r: 25 }, b: { x: 500, y: 200, r: 25 } },
    // Magenta (mid-arm): medium putt up the left arm, drops at the top of
    // the (narrower) right arm. Must thread the funnel.
    { a: { x: 200, y: 400, r: 25 }, b: { x: 800, y: 200, r: 25 } },
    // Yellow (earned shortcut): long putt up the full left arm, exits in
    // the lower right arm right above the sand collar. Highest risk first
    // stroke, easiest finish - if you have the touch.
    { a: { x: 200, y: 200, r: 25 }, b: { x: 800, y: 600, r: 25 } },
  ],
};

// ---------------------------------------------------------------------------
// Hole 6: "The Maze" (Par 5)
// Signature: Inspired by a kids coloring-book maze. Tee at upper-left, hole
// at bottom-right. Player must navigate around a closed-box arch in the
// upper section, thread a 120px gap in the middle divider, then find the
// 60px channel between two trap pockets in the lower section. Each trap
// pocket has a one-way gate at the top that allows downward entry but
// blocks upward escape - if the ball lands inside, the player resets.
// ---------------------------------------------------------------------------
const hole6 = {
  name: 'The Maze',
  par: 5,
  tee: { x: 200, y: 100 },
  hole: { x: 700, y: 720 },
  holeRadius: 12,
  bounds: { width: 800, height: 800 },
  walls: [
    // Outer perimeter
    { x1: 40,  y1: 40,  x2: 760, y2: 40  },
    { x1: 760, y1: 40,  x2: 760, y2: 760 },
    { x1: 760, y1: 760, x2: 40,  y2: 760 },
    { x1: 40,  y1: 760, x2: 40,  y2: 40  },

    // Closed-box arch hanging from the top wall in the upper section.
    // An obstacle - ball must go around either side.
    { x1: 320, y1: 40,  x2: 320, y2: 240 },  // left leg
    { x1: 440, y1: 40,  x2: 440, y2: 240 },  // right leg
    { x1: 320, y1: 240, x2: 440, y2: 240 },  // bottom of arch

    // Right stub from right wall - narrows the upper-right corridor
    { x1: 600, y1: 200, x2: 760, y2: 200 },

    // Middle divider with central gap (x=320..440, 120px wide)
    { x1: 40,  y1: 420, x2: 320, y2: 420 },
    { x1: 440, y1: 420, x2: 760, y2: 420 },

    // Trap pocket A (lower-left): 3-walled box, top is a one-way gate
    { x1: 120, y1: 540, x2: 120, y2: 700 },  // left wall
    { x1: 320, y1: 540, x2: 320, y2: 700 },  // right wall
    { x1: 120, y1: 700, x2: 320, y2: 700 },  // bottom

    // Trap pocket B (lower-mid): 3-walled box, top is a one-way gate
    { x1: 380, y1: 540, x2: 380, y2: 700 },  // left wall
    { x1: 600, y1: 540, x2: 600, y2: 700 },  // right wall
    { x1: 380, y1: 700, x2: 600, y2: 700 },  // bottom
  ],
  bumpers: [],
  sandTraps: [],
  waterHazards: [],
  movingObstacles: [],
  slopes: [],
  speedPads: [],
  magnets: [],
  oneWayGates: [
    // Trap A entrance - allows downward entry only (ball falls in, stuck)
    { x1: 120, y1: 540, x2: 320, y2: 540, nx: 0, ny: 1 },
    // Trap B entrance - same
    { x1: 380, y1: 540, x2: 600, y2: 540, nx: 0, ny: 1 },
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
// Par: 2+3+3+4+4+5+5+5+6 = 37
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
