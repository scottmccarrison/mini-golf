// render.js - Canvas rendering system for Mini Golf
// Exports: render(ctx, game, viewport), worldToScreen(wx, wy, game, viewport), screenToWorld(sx, sy, game, viewport)

import { COURSES, getMovingObstacleState } from './courses.js';
import { BALL_RADIUS, HOLE_RADIUS } from './physics.js';

// ---------------------------------------------------------------------------
// Transform helpers
// ---------------------------------------------------------------------------

/**
 * Compute the course-to-screen transform parameters.
 * Returns { scale, offsetX, offsetY }
 */
function getCourseTransform(course, viewport, zoom) {
  const sidePad = 12;
  const topPad = 54;   // HUD top bar (48px) + margin
  const botPad = 46;   // HUD score ticker (40px) + margin
  const availW = viewport.w - sidePad * 2;
  const availH = viewport.h - topPad - botPad;
  const scaleX = availW / course.bounds.width;
  const scaleY = availH / course.bounds.height;
  const baseScale = Math.min(scaleX, scaleY);
  const z = zoom || { level: 1, panX: 0, panY: 0 };
  const scale = baseScale * z.level;
  const offsetX = sidePad + (availW - course.bounds.width * scale) / 2 + z.panX;
  const offsetY = topPad + (availH - course.bounds.height * scale) / 2 + z.panY;
  return { scale, offsetX, offsetY };
}

/**
 * Convert world (course) coordinates to screen coordinates.
 */
export function worldToScreen(wx, wy, game, viewport) {
  const course = COURSES[game.currentHole || 0];
  const { scale, offsetX, offsetY } = getCourseTransform(course, viewport, game.zoom);
  return {
    x: wx * scale + offsetX,
    y: wy * scale + offsetY,
  };
}

/**
 * Convert screen coordinates to world (course) coordinates.
 */
export function screenToWorld(sx, sy, game, viewport) {
  const course = COURSES[game.currentHole || 0];
  const { scale, offsetX, offsetY } = getCourseTransform(course, viewport, game.zoom);
  return {
    x: (sx - offsetX) / scale,
    y: (sy - offsetY) / scale,
  };
}

// ---------------------------------------------------------------------------
// Polygon path helper
// ---------------------------------------------------------------------------

function tracePolygon(ctx, points) {
  if (!points || points.length < 2) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Layer: Course floor
// ---------------------------------------------------------------------------

function drawCourseFloor(ctx, course) {
  if (!course.walls || course.walls.length === 0) return;

  // Build a rough bounding polygon from the wall segments
  // Collect unique points to form an approximate playable outline
  const pts = [];
  for (const w of course.walls) {
    pts.push({ x: w.x1, y: w.y1 });
    pts.push({ x: w.x2, y: w.y2 });
  }

  // Use a convex-hull-like ordered path: sort by angle from centroid
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  pts.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));

  // Build a connected path from wall segments preserving order
  // Use the raw wall sequence instead - create a polygon by tracing walls in order
  const wallPts = [];
  for (const w of course.walls) {
    wallPts.push({ x: w.x1, y: w.y1 });
  }

  // Fill main floor
  ctx.beginPath();
  ctx.moveTo(wallPts[0].x, wallPts[0].y);
  for (let i = 1; i < wallPts.length; i++) {
    ctx.lineTo(wallPts[i].x, wallPts[i].y);
  }
  ctx.closePath();

  // Create a gradient for depth
  const grad = ctx.createLinearGradient(0, 0, course.bounds.width * 0.3, course.bounds.height);
  grad.addColorStop(0, '#3aad61');
  grad.addColorStop(0.5, '#35a05a');
  grad.addColorStop(1, '#2d8a4e');
  ctx.fillStyle = grad;
  ctx.fill();

  // Subtle felt texture: grid lines
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.03)';
  ctx.lineWidth = 0.5;
  for (let gx = 0; gx <= course.bounds.width; gx += 20) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, course.bounds.height);
    ctx.stroke();
  }
  for (let gy = 0; gy <= course.bounds.height; gy += 20) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(course.bounds.width, gy);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Layer: Sand traps
// ---------------------------------------------------------------------------

function drawSandTraps(ctx, course) {
  if (!course.sandTraps) return;
  for (const trap of course.sandTraps) {
    if (!trap.points || trap.points.length < 3) continue;

    ctx.save();

    // Fill sand color
    ctx.beginPath();
    tracePolygon(ctx, trap.points);
    ctx.fillStyle = '#d4b896';
    ctx.fill();

    // Clip to trap polygon for stipple dots
    ctx.beginPath();
    tracePolygon(ctx, trap.points);
    ctx.clip();

    // Deterministic stipple dots using position-based pseudo-random
    ctx.fillStyle = 'rgba(180,150,110,0.55)';
    const bx = Math.min(...trap.points.map(p => p.x));
    const by = Math.min(...trap.points.map(p => p.y));
    const bw = Math.max(...trap.points.map(p => p.x)) - bx;
    const bh = Math.max(...trap.points.map(p => p.y)) - by;

    const dotSpacing = 10;
    for (let di = 0; di < bw; di += dotSpacing) {
      for (let dj = 0; dj < bh; dj += dotSpacing) {
        // Deterministic offset based on grid position
        const seed1 = (di * 7 + dj * 13) % 100;
        const seed2 = (di * 11 + dj * 17) % 100;
        const ox = (seed1 / 100) * dotSpacing;
        const oy = (seed2 / 100) * dotSpacing;
        const dotX = bx + di + ox;
        const dotY = by + dj + oy;
        const dotR = 0.8 + ((seed1 + seed2) % 30) / 30;
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // Outline
    ctx.beginPath();
    tracePolygon(ctx, trap.points);
    ctx.strokeStyle = 'rgba(180,150,100,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Layer: Water hazards
// ---------------------------------------------------------------------------

function drawWaterHazards(ctx, course, time) {
  if (!course.waterHazards) return;
  for (const hazard of course.waterHazards) {
    if (!hazard.points || hazard.points.length < 3) continue;

    ctx.save();
    ctx.beginPath();
    tracePolygon(ctx, hazard.points);

    // Base fill with gradient
    const bx = Math.min(...hazard.points.map(p => p.x));
    const by = Math.min(...hazard.points.map(p => p.y));
    const bw = Math.max(...hazard.points.map(p => p.x)) - bx;
    const bh = Math.max(...hazard.points.map(p => p.y)) - by;
    const waterGrad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
    waterGrad.addColorStop(0, '#4a9fc7');
    waterGrad.addColorStop(0.5, '#3b8bba');
    waterGrad.addColorStop(1, '#2d6f99');
    ctx.fillStyle = waterGrad;
    ctx.fill();

    // Clip for wave lines
    ctx.beginPath();
    tracePolygon(ctx, hazard.points);
    ctx.clip();

    // Animated wave lines using time
    const waveOffset = (time || 0) * 30;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    for (let wy = by; wy < by + bh + 20; wy += 12) {
      ctx.beginPath();
      const waveY = wy + Math.sin((wy + waveOffset) * 0.08) * 3;
      ctx.moveTo(bx - 5, waveY);
      for (let wx = bx; wx <= bx + bw + 5; wx += 8) {
        const wv = waveY + Math.sin((wx + waveOffset * 1.3) * 0.15) * 2.5;
        ctx.lineTo(wx, wv);
      }
      ctx.stroke();
    }

    ctx.restore();

    // Outline
    ctx.beginPath();
    tracePolygon(ctx, hazard.points);
    ctx.strokeStyle = 'rgba(80,160,220,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Layer: Walls
// ---------------------------------------------------------------------------

function drawWalls(ctx, course) {
  if (!course.walls) return;
  for (const wall of course.walls) {
    // Shadow
    ctx.beginPath();
    ctx.moveTo(wall.x1 + 1, wall.y1 + 2);
    ctx.lineTo(wall.x2 + 1, wall.y2 + 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Main wall
    ctx.beginPath();
    ctx.moveTo(wall.x1, wall.y1);
    ctx.lineTo(wall.x2, wall.y2);
    ctx.strokeStyle = '#5c3a1e';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Highlight (slightly offset toward top-left)
    ctx.beginPath();
    ctx.moveTo(wall.x1, wall.y1 - 2);
    ctx.lineTo(wall.x2, wall.y2 - 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Layer: Bumpers
// ---------------------------------------------------------------------------

function drawBumpers(ctx, course) {
  if (!course.bumpers) return;
  for (const bumper of course.bumpers) {
    const { x, y, r } = bumper;

    // Radial glow
    const glow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.2);
    glow.addColorStop(0, 'rgba(255,100,100,0.3)');
    glow.addColorStop(1, 'rgba(255,100,100,0)');
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Body gradient
    const bodyGrad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    bodyGrad.addColorStop(0, '#ff8f8f');
    bodyGrad.addColorStop(0.6, '#ff6b6b');
    bodyGrad.addColorStop(1, '#cc4444');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Border
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#cc4444';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Highlight dot at top-left
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Layer: Moving obstacles
// ---------------------------------------------------------------------------

function drawMovingObstacles(ctx, course, time) {
  if (!course.movingObstacles) return;
  for (const obstacle of course.movingObstacles) {
    const state = getMovingObstacleState(obstacle, time || 0);
    if (!state) continue;

    const { x1, y1, x2, y2, pivot, armWidth } = state;
    const pw = pivot || obstacle.pivot;
    const aw = armWidth || obstacle.armWidth || 10;

    // Shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = '#5a2d0a';
    ctx.lineWidth = aw + 4;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();

    // Arm body
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = aw;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Arm highlight strip
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = aw * 0.3;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Pivot point
    if (pw) {
      ctx.beginPath();
      ctx.arc(pw.x, pw.y, aw * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = '#3a1a00';
      ctx.fill();
      ctx.strokeStyle = '#5c3a1e';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------------------
// Layer: Hole
// ---------------------------------------------------------------------------

function drawHole(ctx, course) {
  const { x, y } = course.hole;
  const r = course.holeRadius || HOLE_RADIUS;

  // Shadow ellipse
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 2, r, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();

  // Outer ring
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();

  // Inner dark
  ctx.beginPath();
  ctx.arc(x, y, r * 0.65, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0a0a';
  ctx.fill();

  // Subtle inner gradient to give depth
  const holeGrad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r * 0.65);
  holeGrad.addColorStop(0, 'rgba(255,255,255,0.04)');
  holeGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath();
  ctx.arc(x, y, r * 0.65, 0, Math.PI * 2);
  ctx.fillStyle = holeGrad;
  ctx.fill();

  // Flag pole
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 38);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'butt';
  ctx.stroke();

  // Pennant (red triangle)
  ctx.beginPath();
  ctx.moveTo(x, y - 38);
  ctx.lineTo(x + 14, y - 30);
  ctx.lineTo(x, y - 22);
  ctx.closePath();
  ctx.fillStyle = '#ff4444';
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Layer: Tee marker
// ---------------------------------------------------------------------------

function drawTee(ctx, course, strokes) {
  if (strokes !== 0) return;
  const { x, y } = course.tee;
  const w = 14;
  const h = 8;
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Layer: Ball trail
// ---------------------------------------------------------------------------

function drawTrail(ctx, trail) {
  if (!trail || trail.length === 0) return;
  for (let i = 0; i < trail.length; i++) {
    const pt = trail[i];
    if (!pt) continue;
    const alpha = pt.alpha !== undefined ? pt.alpha : (i / trail.length) * 0.4;
    const radius = BALL_RADIUS * 0.5 * (i / trail.length);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, Math.max(1, radius), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Layer: Other players' balls (multiplayer)
// ---------------------------------------------------------------------------

function drawOtherBalls(ctx, balls) {
  if (!balls || !Array.isArray(balls) || balls.length === 0) return;
  for (const ball of balls) {
    if (!ball || ball.x === undefined) continue;
    const color = ball.color || '#4ecdc4';

    // Shadow
    ctx.beginPath();
    ctx.ellipse(ball.x + 2, ball.y + 3, BALL_RADIUS, BALL_RADIUS * 0.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fill();

    // Body - semi-transparent white
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();

    // Colored ring
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// Layer: Player ball
// ---------------------------------------------------------------------------

function drawBall(ctx, ball, playerColor) {
  if (!ball) return;
  const color = playerColor || '#4ecdc4';
  const r = BALL_RADIUS;

  // Shadow ellipse
  ctx.beginPath();
  ctx.ellipse(ball.x + 2, ball.y + 3, r, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fill();

  // Body gradient
  const ballGrad = ctx.createRadialGradient(
    ball.x - r * 0.3, ball.y - r * 0.35, r * 0.1,
    ball.x, ball.y, r
  );
  ballGrad.addColorStop(0, '#ffffff');
  ballGrad.addColorStop(0.7, '#f0f0f0');
  ballGrad.addColorStop(1, '#d8d8d8');
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
  ctx.fillStyle = ballGrad;
  ctx.fill();

  // Color ring
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Highlight dot at top-left
  ctx.beginPath();
  ctx.arc(ball.x - r * 0.3, ball.y - r * 0.35, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Layer: Sink animation
// ---------------------------------------------------------------------------

function drawSinkAnimation(ctx, ball, course, sinkTimer) {
  if (!ball || sinkTimer >= 1) return;
  const t = sinkTimer; // 0 to 1

  // Interpolate ball toward hole center while shrinking
  const hx = course.hole.x;
  const hy = course.hole.y;
  const bx = ball.x + (hx - ball.x) * t;
  const by = ball.y + (hy - ball.y) * t;
  const r = BALL_RADIUS * (1 - t);

  if (r <= 0) return;

  // Draw spiraling/shrinking ball
  ctx.save();
  ctx.globalAlpha = 1 - t * 0.3;

  // Shadow
  ctx.beginPath();
  ctx.arc(bx + 1, by + 2, r * 0.8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fill();

  // Body
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#4ecdc4';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Layer: Aim line and power meter
// ---------------------------------------------------------------------------

function drawAimLine(ctx, ball, input) {
  if (!ball || !input || !input.aiming) return;

  const { shotAngle, shotPower, aimCurrent } = input;
  if (aimCurrent === null) return;

  const bx = ball.x;
  const by = ball.y;
  const aimLength = 120;

  // Dotted aim direction line
  const endX = bx + Math.cos(shotAngle) * aimLength;
  const endY = by + Math.sin(shotAngle) * aimLength;

  ctx.save();
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(endX, endY);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.setLineDash([]);

  // Power line - color shows absolute power level, not stretched gradient
  // Apply quadratic curve to match actual power feel
  const curvedPower = (shotPower || 0) * (shotPower || 0);
  const maxBarLen = 120;
  const powerLen = curvedPower * maxBarLen;
  if (powerLen > 2) {
    const pEndX = bx + Math.cos(shotAngle) * powerLen;
    const pEndY = by + Math.sin(shotAngle) * powerLen;

    // Gradient spans the full max length so color reflects absolute power
    const fullEndX = bx + Math.cos(shotAngle) * maxBarLen;
    const fullEndY = by + Math.sin(shotAngle) * maxBarLen;
    const powerGrad = ctx.createLinearGradient(bx, by, fullEndX, fullEndY);
    powerGrad.addColorStop(0, '#4ecdc4');
    powerGrad.addColorStop(0.5, '#f9d423');
    powerGrad.addColorStop(1, '#ff6b6b');

    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(pEndX, pEndY);
    ctx.strokeStyle = powerGrad;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Arrow head - color matches gradient position at current power level
    let arrowColor;
    if (curvedPower < 0.25) {
      arrowColor = '#4ecdc4'; // teal at low power
    } else if (curvedPower < 0.6) {
      arrowColor = '#f9d423'; // yellow at medium power
    } else {
      arrowColor = '#ff6b6b'; // red at high power
    }
    const arrowSize = 8;
    const arrowAngle = shotAngle;
    ctx.beginPath();
    ctx.moveTo(pEndX, pEndY);
    ctx.lineTo(
      pEndX - Math.cos(arrowAngle - 0.4) * arrowSize,
      pEndY - Math.sin(arrowAngle - 0.4) * arrowSize
    );
    ctx.lineTo(
      pEndX - Math.cos(arrowAngle + 0.4) * arrowSize,
      pEndY - Math.sin(arrowAngle + 0.4) * arrowSize
    );
    ctx.closePath();
    ctx.fillStyle = arrowColor;
    ctx.fill();
  }

  // Slingshot line from ball backward to drag position
  if (aimCurrent) {
    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(aimCurrent.x, aimCurrent.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);

    // Drag handle circle
    ctx.beginPath();
    ctx.arc(aimCurrent.x, aimCurrent.y, 8, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// HUD: Top bar
// ---------------------------------------------------------------------------

function drawTopBar(ctx, game, viewport) {
  const barH = 48;
  const { w } = viewport;

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, w, barH);

  // Subtle bottom border
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(0, barH - 1, w, 1);

  const course = COURSES[game.currentHole || 0];
  const holeNum = (game.currentHole || 0) + 1;
  const par = course ? course.par : '-';
  const strokes = game.strokes || 0;

  ctx.textBaseline = 'middle';
  const midY = barH / 2;

  // Left: HOLE N + Par N
  ctx.textAlign = 'left';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`HOLE ${holeNum}`, 16, midY - 5);
  ctx.font = '13px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = '#aaaaaa';
  ctx.fillText(`Par ${par}`, 16, midY + 9);

  // Center: STROKE N
  ctx.textAlign = 'center';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#4ecdc4';
  ctx.fillText(`STROKE ${strokes}`, w / 2, midY);

  // Right: room code only (multiplayer) or player name (solo)
  ctx.textAlign = 'right';
  const rightX = w - 16;

  if (game.mode === 'mp' && game.roomCode) {
    // Show room code small on far right - no player name (player list panel shows that)
    ctx.font = '12px -apple-system, system-ui, monospace';
    ctx.fillStyle = '#888888';
    ctx.fillText(`#${game.roomCode}`, rightX, midY);
  } else if (game.playerName) {
    // Solo mode - show player name
    ctx.font = '13px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText(game.playerName, rightX, midY);
  }
}

// ---------------------------------------------------------------------------
// HUD: Multiplayer player list panel
// ---------------------------------------------------------------------------

function drawPlayerList(ctx, game, viewport) {
  if (game.mode !== 'mp') return;
  if (!game.players || game.players.length === 0) return;

  const { w } = viewport;
  const panelW = Math.min(140, Math.floor(w * 0.28));
  const rowH = 28;
  const padX = 10;
  const panelX = w - panelW - 8;
  const panelY = 56;
  const panelH = game.players.length * rowH + 8;

  // Panel background
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, panelX, panelY, panelW, panelH, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();

  for (let i = 0; i < game.players.length; i++) {
    const player = game.players[i];
    const rowY = panelY + 4 + i * rowH;
    const isActive = player.id === game.currentTurnPlayerId;
    const isMe = player.id === game.myId;

    if (isActive) {
      // Highlight row
      ctx.beginPath();
      roundRect(ctx, panelX + 2, rowY, panelW - 4, rowH - 2, 5);
      ctx.fillStyle = 'rgba(78,205,196,0.2)';
      ctx.fill();
      // Left accent bar
      ctx.fillStyle = '#4ecdc4';
      ctx.fillRect(panelX + 2, rowY, 2, rowH - 2);
    }

    // Color dot
    const dotX = panelX + padX + 6;
    const dotY = rowY + rowH / 2;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
    ctx.fillStyle = player.color || '#4ecdc4';
    ctx.fill();

    // Player name (truncated)
    const nameX = dotX + 10;
    const maxNameW = panelW - padX - 10 - 14 - 8; // leave room for score
    ctx.font = isMe ? 'bold 11px -apple-system, system-ui, sans-serif' : '11px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = isActive ? '#4ecdc4' : '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    // Truncate name to fit
    let displayName = player.name || `P${player.id}`;
    while (displayName.length > 1 && ctx.measureText(displayName).width > maxNameW) {
      displayName = displayName.slice(0, -1);
    }
    ctx.fillText(displayName, nameX, dotY);

    // Score: sum of scorecard or current strokes
    let score = 0;
    if (player.scorecard) {
      score = player.scorecard.reduce((s, v) => s + (v !== null ? v : 0), 0);
    }
    if (player.id === game.myId) {
      score += game.strokes || 0;
    }
    ctx.font = '10px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = isActive ? '#4ecdc4' : 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'right';
    ctx.fillText(score > 0 ? score : '-', panelX + panelW - 6, dotY);
  }

  ctx.restore();
}

// Helper: draw a rounded rect path
function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// HUD: Multiplayer turn indicator
// ---------------------------------------------------------------------------

function drawMpTurnIndicator(ctx, game, viewport) {
  if (!game.players || game.players.length === 0) return;
  if (game.mode !== 'mp') return;

  const { w } = viewport;
  const isMyTurn = game.currentTurnPlayerId === game.myId;
  const time = game.time || 0;

  if (isMyTurn) {
    // Prominent "YOUR TURN" banner
    const bannerH = 34;
    const bannerY = 48; // just below top bar

    // Background strip
    ctx.fillStyle = 'rgba(78, 205, 196, 0.18)';
    ctx.fillRect(0, bannerY, w, bannerH);

    // Bottom border accent
    ctx.fillStyle = 'rgba(78, 205, 196, 0.5)';
    ctx.fillRect(0, bannerY + bannerH - 1, w, 1);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#4ecdc4';
    ctx.fillText('YOUR TURN', w / 2, bannerY + bannerH / 2);
  } else {
    // Waiting indicator with pulse
    const waitPlayer = game.players.find(p => p.id === game.currentTurnPlayerId);
    if (!waitPlayer) return;

    const bannerH = 30;
    const bannerY = 48;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, bannerY, w, bannerH);

    // Pulsing opacity based on time
    const pulse = 0.55 + Math.sin(time * 3.5) * 0.2;
    const playerName = waitPlayer.name || 'Player';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText(`Waiting for ${playerName}...`, w / 2, bannerY + bannerH / 2);
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// HUD: Bottom score ticker
// ---------------------------------------------------------------------------

function drawScoreTicker(ctx, game, viewport) {
  const { w, h } = viewport;

  if (game.mode === 'mp' && game.players && game.players.length > 0) {
    drawMpBottomBar(ctx, game, viewport);
  } else {
    drawSoloBottomBar(ctx, game, viewport);
  }
}

function drawMpBottomBar(ctx, game, viewport) {
  const { w, h } = viewport;
  const players = game.players;
  const barH = 44;
  const barY = h - barH;

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, barY, w, barH);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(0, barY, w, 1);

  const totalPar = COURSES.reduce((s, c) => s + c.par, 0);
  const slotW = w / players.length;

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const isActive = player.id === game.currentTurnPlayerId;
    const isMe = player.id === game.myId;
    const slotX = i * slotW;
    const centerX = slotX + slotW / 2;

    // Active turn highlight
    if (isActive) {
      ctx.fillStyle = 'rgba(78,205,196,0.15)';
      ctx.fillRect(slotX, barY + 1, slotW, barH - 2);
      // Top accent line
      ctx.fillStyle = '#4ecdc4';
      ctx.fillRect(slotX + 4, barY + 1, slotW - 8, 2);
    }

    // Color dot - left of center
    const dotR = 4;
    ctx.beginPath();
    ctx.arc(slotX + 12, barY + 15, dotR, 0, Math.PI * 2);
    ctx.fillStyle = player.color || '#4ecdc4';
    ctx.fill();

    // Name - after dot
    let name = player.name || `P${player.id}`;
    if (name.length > 8) name = name.slice(0, 7) + '.';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = (isMe ? 'bold ' : '') + '11px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = isActive ? '#4ecdc4' : (isMe ? '#ffffff' : 'rgba(255,255,255,0.7)');
    ctx.fillText(name, slotX + 22, barY + 15);

    // Total score below
    let total = (player.scorecard || []).reduce((s, v) => s + (v !== null ? v : 0), 0);
    if (isMe) total += (game.strokes || 0);
    const scoreStr = total > 0 ? String(total) : '-';

    ctx.textAlign = 'center';
    ctx.font = 'bold 13px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = isActive ? '#4ecdc4' : '#ffffff';
    ctx.fillText(scoreStr, centerX, barY + 32);
  }

  // Dividers between slots
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 1; i < players.length; i++) {
    ctx.fillRect(i * slotW, barY + 6, 1, barH - 12);
  }
}

function drawSoloBottomBar(ctx, game, viewport) {
  const barH = 40;
  const { w, h } = viewport;
  const barY = h - barH;

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, barY, w, barH);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(0, barY, w, 1);

  const totalHoles = 9;
  const currentHole = game.currentHole || 0;
  const scorecard = game.scorecard || [];

  let totalPar = 0;
  for (const course of COURSES) totalPar += course.par;
  let totalScore = 0;
  for (const s of scorecard) if (s !== null && s !== undefined) totalScore += s;

  // Right: total summary
  const summaryText = `Total: ${totalScore}  (Par ${totalPar})`;
  ctx.font = 'bold 12px -apple-system, system-ui, sans-serif';
  const summaryW = ctx.measureText(summaryText).width + 24;

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#aaaaaa';
  ctx.fillText(summaryText, w - 16, barY + barH / 2);

  // Hole numbers 1-9
  const availW = w - summaryW;
  const holeSlotW = availW / totalHoles;

  for (let i = 0; i < totalHoles; i++) {
    const slotX = i * holeSlotW + holeSlotW / 2;
    const isCurrentHole = i === currentHole;
    const score = scorecard[i];
    const holePar = COURSES[i] ? COURSES[i].par : 3;

    ctx.textAlign = 'center';
    ctx.font = isCurrentHole
      ? 'bold 11px -apple-system, system-ui, sans-serif'
      : '10px -apple-system, system-ui, sans-serif';

    if (isCurrentHole) {
      ctx.fillStyle = 'rgba(78,205,196,0.2)';
      ctx.fillRect(i * holeSlotW, barY + 1, holeSlotW, barH - 2);
      ctx.fillStyle = '#4ecdc4';
    } else {
      ctx.fillStyle = '#888888';
    }
    ctx.fillText(String(i + 1), slotX, barY + 12);

    if (score !== null && score !== undefined) {
      const diff = score - holePar;
      ctx.font = 'bold 12px -apple-system, system-ui, sans-serif';
      ctx.fillStyle = diff < 0 ? '#4ecdc4' : diff > 0 ? '#ff6b6b' : '#ffffff';
      ctx.fillText(String(score), slotX, barY + 28);
    } else if (isCurrentHole) {
      const strokes = game.strokes || 0;
      if (strokes > 0) {
        ctx.font = '11px -apple-system, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(78,205,196,0.7)';
        ctx.fillText(String(strokes), slotX, barY + 28);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Screen: Title
// ---------------------------------------------------------------------------

function drawTitleScreen(ctx, game, viewport) {
  const { w, h } = viewport;

  // Subtle animated background
  const time = game.time || 0;
  const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.8);
  bgGrad.addColorStop(0, '#2d3a5e');
  bgGrad.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Green course patch in center as decoration
  ctx.save();
  ctx.translate(w / 2, h * 0.44);
  const patchR = Math.min(w, h) * 0.18;
  const courseGrad = ctx.createRadialGradient(0, 0, patchR * 0.2, 0, 0, patchR);
  courseGrad.addColorStop(0, '#3aad61');
  courseGrad.addColorStop(1, '#2d8a4e');
  ctx.beginPath();
  ctx.arc(0, 0, patchR, 0, Math.PI * 2);
  ctx.fillStyle = courseGrad;
  ctx.fill();

  // Hole in patch
  ctx.beginPath();
  ctx.arc(patchR * 0.25, -patchR * 0.15, HOLE_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0a0a';
  ctx.fill();
  // Flag
  ctx.beginPath();
  ctx.moveTo(patchR * 0.25, -patchR * 0.15);
  ctx.lineTo(patchR * 0.25, -patchR * 0.15 - 28);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(patchR * 0.25, -patchR * 0.15 - 28);
  ctx.lineTo(patchR * 0.25 + 12, -patchR * 0.15 - 22);
  ctx.lineTo(patchR * 0.25, -patchR * 0.15 - 16);
  ctx.closePath();
  ctx.fillStyle = '#ff4444';
  ctx.fill();

  // Animated ball rolling
  const ballAngle = time * 1.2;
  const ballOrbitR = patchR * 0.55;
  const ballX = Math.cos(ballAngle) * ballOrbitR;
  const ballY = Math.sin(ballAngle) * ballOrbitR * 0.4;
  // Ball shadow
  ctx.beginPath();
  ctx.ellipse(ballX + 2, ballY + 3, BALL_RADIUS, BALL_RADIUS * 0.55, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fill();
  // Ball
  ctx.beginPath();
  ctx.arc(ballX, ballY, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#4ecdc4';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();

  // Title text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 20;
  ctx.font = `bold ${Math.min(72, w / 5)}px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('MINI GOLF', w / 2, h * 0.28);
  ctx.shadowBlur = 0;

  // (subtitle removed)

  // Buttons are rendered via HTML overlay (#title-buttons)
}

// ---------------------------------------------------------------------------
// Screen: Game over
// ---------------------------------------------------------------------------

function drawGameOver(ctx, game, viewport) {
  const { w, h } = viewport;

  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(10,10,20,0.85)';
  ctx.fillRect(0, 0, w, h);

  const cardW = Math.min(w - 40, 520);
  const cardX = (w - cardW) / 2;
  const cardY = 40;

  // Card background
  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, h - 40);
  cardGrad.addColorStop(0, 'rgba(30,40,70,0.95)');
  cardGrad.addColorStop(1, 'rgba(20,25,50,0.95)');
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, h - 80, 16);
  ctx.fillStyle = cardGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(78,205,196,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const isSolo = game.mode === 'solo' || !game.players || game.players.length <= 1;

  // Compute totals for solo rating
  const totalPar0 = COURSES.reduce((s, c) => s + c.par, 0);
  const soloScorecard = game.scorecard || [];
  const soloTotal = soloScorecard.reduce((s, v) => s + (v || 0), 0);
  const soloDiff = soloTotal - totalPar0;

  if (isSolo) {
    // Solo: "GAME COMPLETE" header with rating
    ctx.font = `${Math.min(48, w / 8)}px serif`;
    ctx.fillText('\u26F3', w / 2, cardY + 52); // golf flag emoji

    ctx.font = `bold ${Math.min(26, w / 16)}px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('GAME COMPLETE', w / 2, cardY + 100);

    // Score vs par
    const diffLabel = soloDiff === 0 ? 'Even par' : (soloDiff < 0 ? `${Math.abs(soloDiff)} under par` : `${soloDiff} over par`);
    let ratingText, ratingColor;
    if (soloDiff < 0) {
      ratingText = 'Under Par!';
      ratingColor = '#4ecdc4';
    } else if (soloDiff === 0) {
      ratingText = 'Par';
      ratingColor = '#ffffff';
    } else {
      ratingText = 'Over Par';
      ratingColor = '#ff6b6b';
    }

    ctx.font = `bold ${Math.min(20, w / 20)}px -apple-system, system-ui, sans-serif`;
    ctx.fillStyle = ratingColor;
    ctx.fillText(ratingText, w / 2, cardY + 130);

    ctx.font = `${Math.min(14, w / 26)}px -apple-system, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(`${soloTotal} strokes - ${diffLabel}`, w / 2, cardY + 152);
  } else {
    // Multiplayer: trophy + "FINAL SCORES" + winner
    ctx.font = `${Math.min(48, w / 8)}px serif`;
    ctx.fillText('\u{1F3C6}', w / 2, cardY + 52);

    ctx.font = `bold ${Math.min(28, w / 16)}px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('FINAL SCORES', w / 2, cardY + 100);

    // Winner determination
    let winners = [];
    let minScore = Infinity;
    for (const p of game.players) {
      const total = (p.scorecard || []).reduce((s, v) => s + (v || 0), 0);
      if (total < minScore) minScore = total;
    }
    winners = game.players.filter(p => {
      const total = (p.scorecard || []).reduce((s, v) => s + (v || 0), 0);
      return total === minScore;
    });

    if (winners.length > 0) {
      const winnerName = winners.map(p => p.name || 'Player').join(' & ');
      ctx.font = `${Math.min(16, w / 24)}px -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = '#f9d423';
      ctx.fillText(`Winner: ${winnerName}`, w / 2, cardY + 130);
    }
  }

  // Scorecard table
  const players = game.players && game.players.length > 0
    ? game.players
    : [{ name: 'You', color: '#4ecdc4', scorecard: game.scorecard || [] }];

  const tableY = cardY + 160;
  const colW = (cardW - 40) / 10; // 9 holes + total
  const rowH = 28;

  // Header row
  ctx.font = `bold 11px -apple-system, system-ui, sans-serif`;
  ctx.fillStyle = '#888888';
  ctx.textAlign = 'center';
  ctx.fillText('PLAYER', cardX + 20 + colW * 0.5, tableY + rowH / 2);
  for (let i = 0; i < 9; i++) {
    ctx.fillText(String(i + 1), cardX + 20 + colW * (i + 1) + colW / 2, tableY + rowH / 2);
  }
  // Total label
  ctx.fillStyle = '#4ecdc4';
  ctx.fillText('TOT', cardX + 20 + colW * 9 + colW / 2, tableY + rowH / 2);

  // Par row
  const parRowY = tableY + rowH;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(cardX + 20, parRowY, cardW - 40, rowH);
  ctx.font = `11px -apple-system, system-ui, sans-serif`;
  ctx.fillStyle = '#666666';
  ctx.textAlign = 'center';
  ctx.fillText('PAR', cardX + 20 + colW * 0.5, parRowY + rowH / 2);
  let totalPar = 0;
  for (let i = 0; i < 9; i++) {
    const p = COURSES[i] ? COURSES[i].par : 3;
    totalPar += p;
    ctx.fillText(String(p), cardX + 20 + colW * (i + 1) + colW / 2, parRowY + rowH / 2);
  }
  ctx.fillText(String(totalPar), cardX + 20 + colW * 9 + colW / 2, parRowY + rowH / 2);

  // Player rows
  for (let pi = 0; pi < players.length; pi++) {
    const player = players[pi];
    const rowY = tableY + rowH * (pi + 2);
    const sc = player.scorecard || [];
    const isMe = game.myId && player.id === game.myId;

    // Row background
    ctx.fillStyle = isMe ? 'rgba(78,205,196,0.08)' : (pi % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent');
    ctx.fillRect(cardX + 20, rowY, cardW - 40, rowH);

    // Player name with color dot
    const dotX = cardX + 20 + 6;
    const dotY = rowY + rowH / 2;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
    ctx.fillStyle = player.color || '#4ecdc4';
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.font = `${isMe ? 'bold ' : ''}11px -apple-system, system-ui, sans-serif`;
    ctx.fillStyle = isMe ? '#ffffff' : '#cccccc';
    ctx.fillText(player.name || `P${pi + 1}`, dotX + 10, dotY);

    // Hole scores
    let playerTotal = 0;
    for (let i = 0; i < 9; i++) {
      const score = sc[i];
      const holePar = COURSES[i] ? COURSES[i].par : 3;

      if (score !== null && score !== undefined) {
        playerTotal += score;
        const diff = score - holePar;
        let scoreColor = '#ffffff';
        if (diff < 0) scoreColor = '#4ecdc4';
        if (diff > 0) scoreColor = '#ff6b6b';

        ctx.textAlign = 'center';
        ctx.font = `${diff !== 0 ? 'bold ' : ''}11px -apple-system, system-ui, sans-serif`;
        ctx.fillStyle = scoreColor;
        ctx.fillText(String(score), cardX + 20 + colW * (i + 1) + colW / 2, rowY + rowH / 2);
      }
    }

    // Total
    const totalPar2 = COURSES.reduce((s, c) => s + c.par, 0);
    const totalDiff = playerTotal - totalPar2;
    let totalColor = '#ffffff';
    if (totalDiff < 0) totalColor = '#4ecdc4';
    if (totalDiff > 0) totalColor = '#ff6b6b';

    ctx.textAlign = 'center';
    ctx.font = `bold 11px -apple-system, system-ui, sans-serif`;
    ctx.fillStyle = totalColor;
    ctx.fillText(String(playerTotal), cardX + 20 + colW * 9 + colW / 2, tableY + rowH * (pi + 2) + rowH / 2);
  }

  // Play Again button area
  const btnW = 160;
  const btnH = 44;
  const btnX = w / 2 - btnW / 2;
  const btnY = tableY + rowH * (players.length + 3);

  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 8);
  ctx.fillStyle = '#4ecdc4';
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = '#1a1a2e';
  ctx.fillText('Play Again', w / 2, btnY + btnH / 2);
}

// ---------------------------------------------------------------------------
// Screen: Hole transition
// ---------------------------------------------------------------------------

function drawHoleTransition(ctx, game, viewport) {
  const { w, h } = viewport;
  const t = (game.animState && game.animState.holeTransition) || 0;
  if (t >= 1) return;

  const course = COURSES[game.currentHole || 0];
  const holeNum = (game.currentHole || 0) + 1;
  const par = course ? course.par : '-';

  // Fade: t goes 0->0.5 (fade to dark) then 0.5->1 (fade back)
  let alpha;
  if (t < 0.5) {
    alpha = t * 2; // 0 to 1
  } else {
    alpha = (1 - t) * 2; // 1 to 0
  }

  ctx.fillStyle = `rgba(10,10,20,${alpha})`;
  ctx.fillRect(0, 0, w, h);

  // Show text near peak darkness
  if (t > 0.3 && t < 0.7) {
    const textAlpha = Math.min(1, (t - 0.3) / 0.2) * Math.min(1, (0.7 - t) / 0.2);
    ctx.globalAlpha = textAlpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = `bold ${Math.min(56, w / 7)}px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`HOLE ${holeNum}`, w / 2, h / 2 - 20);

    ctx.font = `${Math.min(24, w / 16)}px -apple-system, system-ui, sans-serif`;
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText(`Par ${par}`, w / 2, h / 2 + 22);

    if (course && course.name) {
      ctx.font = `${Math.min(16, w / 24)}px -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = '#666666';
      ctx.fillText(course.name, w / 2, h / 2 + 52);
    }

    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// Screen shake helper
// ---------------------------------------------------------------------------

function applyScreenShake(ctx, shakeMagnitude) {
  if (!shakeMagnitude || shakeMagnitude <= 0) return;
  // Deterministic-looking shake using a simple pattern
  const now = Date.now();
  const sx = Math.sin(now * 0.07) * shakeMagnitude;
  const sy = Math.cos(now * 0.05) * shakeMagnitude;
  ctx.translate(sx, sy);
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/**
 * Render the entire game frame.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} game
 * @param {{ w: number, h: number, dpr: number }} viewport
 */
export function render(ctx, game, viewport) {
  const { w, h } = viewport;

  // Resolve game fields with safe defaults
  const state = game.state || 'title';
  const currentHole = game.currentHole || 0;
  const strokes = game.strokes || 0;
  const ball = game.ball || null;
  // game.balls is an object {playerId: {x,y,vx,vy}} in MP mode - convert to array for renderer
  const ballsRaw = game.balls || {};
  let balls;
  if (Array.isArray(ballsRaw)) {
    balls = ballsRaw;
  } else {
    // Convert object to array, attaching player color from game.players
    balls = Object.entries(ballsRaw).map(([pid, b]) => {
      const player = (game.players || []).find(p => String(p.id) === String(pid));
      return { ...b, color: player ? player.color : '#4ecdc4', name: player ? player.name : '' };
    }).filter(b => b.x !== undefined);
  }
  const trail = game.trail || [];
  const input = game.input || {};
  const time = game.time || 0;
  const animState = game.animState || {};

  // Resolve current player color
  let playerColor = '#4ecdc4';
  if (game.players && game.players.length > 0 && game.myId) {
    const me = game.players.find(p => p.id === game.myId);
    if (me && me.color) playerColor = me.color;
  }

  // 1. Clear canvas
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, w, h);

  // Title screen is handled separately (no course rendering)
  if (state === 'title') {
    drawTitleScreen(ctx, game, viewport);
    return;
  }

  // Game over screen
  if (state === 'gameover') {
    // Still draw the course behind the overlay
    drawCourseAndGame(ctx, game, viewport, currentHole, strokes, ball, balls, trail, input, time, animState, playerColor);
    drawGameOver(ctx, game, viewport);
    return;
  }

  // Normal game rendering
  drawCourseAndGame(ctx, game, viewport, currentHole, strokes, ball, balls, trail, input, time, animState, playerColor);

  // Hole transition overlay
  if (state === 'nextHole' && animState.holeTransition < 1) {
    drawHoleTransition(ctx, game, viewport);
  }
}

/**
 * Internal: draw the course and all game elements (used for game and gameover states).
 */
function drawCourseAndGame(ctx, game, viewport, currentHole, strokes, ball, balls, trail, input, time, animState, playerColor) {
  const { w, h } = viewport;
  const course = COURSES[currentHole];
  if (!course) return;

  const { scale, offsetX, offsetY } = getCourseTransform(course, viewport, game.zoom);

  // Apply screen shake in screen space
  ctx.save();
  if (animState.shakeMagnitude && animState.shakeMagnitude > 0) {
    applyScreenShake(ctx, animState.shakeMagnitude);
  }

  // Begin course-space transform
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // 3. Course floor
  drawCourseFloor(ctx, course);

  // 4. Sand traps
  drawSandTraps(ctx, course);

  // 5. Water hazards
  drawWaterHazards(ctx, course, time);

  // 6. Walls
  drawWalls(ctx, course);

  // 7. Bumpers
  drawBumpers(ctx, course);

  // 8. Moving obstacles
  drawMovingObstacles(ctx, course, time);

  // 9. Hole
  drawHole(ctx, course);

  // 10. Tee marker
  drawTee(ctx, course, strokes);

  // 11. Ball trail
  drawTrail(ctx, trail);

  // 12. Other players' balls
  drawOtherBalls(ctx, balls);

  // 13. Player ball (skip if sink animation is playing)
  const sinkTimer = animState.sinkTimer || 0;
  if (game.state !== 'sunk' || sinkTimer <= 0) {
    drawBall(ctx, ball, playerColor);
  }

  // 14. Sink animation
  if (game.state === 'sunk' && ball) {
    drawSinkAnimation(ctx, ball, course, sinkTimer);
  }

  // 15. Aim line (while in course-space for correct world coords)
  if (input && input.aiming && ball) {
    // Convert input screen coords to course space for drawing
    const screenInput = { ...input };
    if (input.aimCurrent) {
      const worldCurrent = screenToWorld(input.aimCurrent.x, input.aimCurrent.y, game, viewport);
      screenInput.aimCurrent = worldCurrent;
    }
    drawAimLine(ctx, ball, screenInput);
  }

  // End course-space transform
  ctx.restore();

  // 16-19. HUD (screen space)
  drawTopBar(ctx, game, viewport);
  drawMpTurnIndicator(ctx, game, viewport);
  drawScoreTicker(ctx, game, viewport);

  ctx.restore(); // screen shake
}
