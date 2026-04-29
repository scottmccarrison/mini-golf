// preview.js - Render all courses to a grid of canvases for review.
// Standalone visualization (does not import render.js) so the preview is
// stable even as the in-game renderer evolves.

import { COURSES } from '../js/courses.js';

const TARGET_W = 720; // pixel width of each preview canvas

const grid = document.getElementById('grid');
const cards = []; // { idx, course, canvas } for download

for (let i = 0; i < COURSES.length; i++) {
  const course = COURSES[i];
  const card = buildCard(i, course);
  grid.appendChild(card);
}

const downloadBtn = document.getElementById('download-all');
const status = document.getElementById('download-status');
if (downloadBtn) {
  downloadBtn.addEventListener('click', downloadAll);
}

function downloadAll() {
  status.textContent = `Saving ${cards.length} PNGs...`;
  let i = 0;
  function next() {
    if (i >= cards.length) {
      status.textContent = `Saved ${cards.length} PNGs to your downloads folder.`;
      return;
    }
    const { idx, course, canvas } = cards[i++];
    const slug = course.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const filename = `hole-${String(idx + 1).padStart(2, '0')}-${slug}.png`;
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Stagger downloads so the browser does not coalesce them
      setTimeout(() => {
        URL.revokeObjectURL(url);
        next();
      }, 250);
    }, 'image/png');
  }
  next();
}

function buildCard(idx, course) {
  const card = document.createElement('div');
  card.className = 'card';

  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = `Hole ${idx + 1} - ${course.name} (Par ${course.par})`;
  card.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = describeFeatures(course);
  card.appendChild(meta);

  const aspect = course.bounds.width / course.bounds.height;
  const canvas = document.createElement('canvas');
  canvas.width = TARGET_W;
  canvas.height = Math.round(TARGET_W / aspect);
  card.appendChild(canvas);

  drawCourse(canvas, course);
  cards.push({ idx, course, canvas });
  return card;
}

function describeFeatures(c) {
  const bits = [`${c.bounds.width}x${c.bounds.height}`];
  if (c.walls?.length) bits.push(`${c.walls.length} walls`);
  if (c.bumpers?.length) bits.push(`${c.bumpers.length} bumpers`);
  if (c.sandTraps?.length) bits.push(`${c.sandTraps.length} sand`);
  if (c.waterHazards?.length) bits.push(`${c.waterHazards.length} water`);
  if (c.slopes?.length) bits.push(`${c.slopes.length} slopes`);
  if (c.speedPads?.length) bits.push(`${c.speedPads.length} speed pads`);
  if (c.magnets?.length) bits.push(`${c.magnets.length} magnets`);
  if (c.oneWayGates?.length) bits.push(`${c.oneWayGates.length} gates`);
  if (c.teleporters?.length) bits.push(`${c.teleporters.length} teleporters`);
  if (c.movingObstacles?.length) bits.push(`${c.movingObstacles.length} moving`);
  return bits.join(' . ');
}

function drawCourse(canvas, course) {
  const ctx = canvas.getContext('2d');
  const sx = canvas.width / course.bounds.width;
  const sy = canvas.height / course.bounds.height;
  const s = Math.min(sx, sy);

  // World-to-screen: uniform scale, centered if aspect mismatches
  const offX = (canvas.width - course.bounds.width * s) / 2;
  const offY = (canvas.height - course.bounds.height * s) / 2;

  ctx.save();
  ctx.translate(offX, offY);
  ctx.scale(s, s);

  // Floor
  ctx.fillStyle = '#0a3a1a';
  ctx.fillRect(0, 0, course.bounds.width, course.bounds.height);

  // Slopes (under hazards, above floor)
  for (const slope of course.slopes || []) {
    ctx.fillStyle = 'rgba(120, 200, 120, 0.22)';
    fillPoly(ctx, slope.points);
    const c = polyCenter(slope.points);
    drawArrow(ctx, c.x, c.y, slope.ax, slope.ay, 'rgba(255, 255, 255, 0.7)', 60);
  }

  // Speed pads
  for (const pad of course.speedPads || []) {
    ctx.fillStyle = 'rgba(255, 200, 0, 0.45)';
    fillPoly(ctx, pad.points);
    ctx.strokeStyle = 'rgba(255, 235, 60, 0.7)';
    ctx.lineWidth = 2;
    strokePoly(ctx, pad.points);
    const c = polyCenter(pad.points);
    drawArrow(ctx, c.x, c.y, pad.ax, pad.ay, '#ffeb3b', 70);
  }

  // Magnets (radius ring + core)
  for (const m of course.magnets || []) {
    const pulling = m.strength >= 0;
    const ring = pulling ? 'rgba(255, 80, 80, 0.6)' : 'rgba(80, 80, 255, 0.6)';
    const fill = pulling ? 'rgba(255, 80, 80, 0.10)' : 'rgba(80, 80, 255, 0.10)';
    ctx.fillStyle = fill;
    ctx.strokeStyle = ring;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    // Core
    ctx.fillStyle = pulling ? '#ff5555' : '#5555ff';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 8, 0, Math.PI * 2);
    ctx.fill();
    // Strength label
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(m.strength), m.x, m.y - 14);
  }

  // Sand traps
  for (const sand of course.sandTraps || []) {
    ctx.fillStyle = '#c9a875';
    fillPoly(ctx, sand.points);
    ctx.strokeStyle = 'rgba(180, 140, 80, 0.9)';
    ctx.lineWidth = 1.5;
    strokePoly(ctx, sand.points);
  }

  // Water hazards
  for (const water of course.waterHazards || []) {
    ctx.fillStyle = '#3a7fc0';
    fillPoly(ctx, water.points);
    ctx.strokeStyle = 'rgba(100, 170, 220, 0.9)';
    ctx.lineWidth = 1.5;
    strokePoly(ctx, water.points);
  }

  // Walls
  ctx.strokeStyle = '#cfcfcf';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (const w of course.walls || []) {
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  // One-way gates - dashed line + pass-direction arrow
  for (const g of course.oneWayGates || []) {
    ctx.strokeStyle = '#bb55ff';
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.moveTo(g.x1, g.y1);
    ctx.lineTo(g.x2, g.y2);
    ctx.stroke();
    ctx.setLineDash([]);
    const cx = (g.x1 + g.x2) / 2;
    const cy = (g.y1 + g.y2) / 2;
    drawArrow(ctx, cx, cy, g.nx, g.ny, '#bb55ff', 40);
  }

  // Bumpers
  for (const b of course.bumpers || []) {
    ctx.fillStyle = '#e84d8a';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff8fb4';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Teleporters - colored pairs joined by a dashed line
  const tpPalette = ['#00ffff', '#ff44ff', '#ffff44', '#88ff88'];
  let tpIdx = 0;
  for (const t of course.teleporters || []) {
    const color = tpPalette[tpIdx++ % tpPalette.length];
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(t.a.x, t.a.y, t.a.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(t.b.x, t.b.y, t.b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(t.a.x, t.a.y);
    ctx.lineTo(t.b.x, t.b.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Moving obstacles (windmills) - draw as a cross at rest
  for (const m of course.movingObstacles || []) {
    if (m.type === 'windmill') {
      ctx.strokeStyle = '#ff8800';
      ctx.lineWidth = (m.armWidth || 8);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(m.pivot.x - m.armLength, m.pivot.y);
      ctx.lineTo(m.pivot.x + m.armLength, m.pivot.y);
      ctx.moveTo(m.pivot.x, m.pivot.y - m.armLength);
      ctx.lineTo(m.pivot.x, m.pivot.y + m.armLength);
      ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      ctx.arc(m.pivot.x, m.pivot.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Hole
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(course.hole.x, course.hole.y, course.holeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Tee
  ctx.fillStyle = '#4ecdc4';
  ctx.beginPath();
  ctx.arc(course.tee.x, course.tee.y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();

  // Labels in screen space
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const teeS = world(course.tee.x, course.tee.y, s, offX, offY);
  const holeS = world(course.hole.x, course.hole.y, s, offX, offY);
  ctx.fillText('T', teeS.x, teeS.y);
  ctx.fillStyle = '#fff';
  ctx.fillText('H', holeS.x, holeS.y);
}

function world(x, y, s, offX, offY) {
  return { x: x * s + offX, y: y * s + offY };
}

function fillPoly(ctx, points) {
  if (!points || points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fill();
}

function strokePoly(ctx, points) {
  if (!points || points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.stroke();
}

function polyCenter(points) {
  let cx = 0, cy = 0;
  for (const p of points) { cx += p.x; cy += p.y; }
  return { x: cx / points.length, y: cy / points.length };
}

function drawArrow(ctx, x, y, dx, dy, color, len) {
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag < 1e-6) return;
  const nx = dx / mag;
  const ny = dy / mag;
  const tipX = x + nx * len;
  const tipY = y + ny * len;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  // Arrowhead
  const ah = 11;
  const aw = 7;
  // Perp vector
  const px = -ny;
  const py = nx;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - nx * ah + px * aw, tipY - ny * ah + py * aw);
  ctx.lineTo(tipX - nx * ah - px * aw, tipY - ny * ah - py * aw);
  ctx.closePath();
  ctx.fill();
}
