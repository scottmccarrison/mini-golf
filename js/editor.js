// editor.js - Build/edit mode for course holes.
// Entered via ?edit=<key> on the main URL.

import { COURSES } from './courses.js';
import { render, worldToScreen, screenToWorld } from './render.js';
import { initInput, getInput, resetInput, setEnabled } from './input.js';
import { stepBall, DT, MAX_POWER, launchBall } from './physics.js';

const STORAGE_KEY = 'golf-editor-key';

// Touch device detection
const IS_TOUCH = typeof window !== 'undefined' &&
  ('ontouchstart' in window || matchMedia('(pointer: coarse)').matches);

// Handle sizes in screen px
const HANDLE_SIZE = IS_TOUCH ? 24 : 12;
const HANDLE_RADIUS_SIZE = IS_TOUCH ? 16 : 8;
const HANDLE_HIT_RADIUS = IS_TOUCH ? 24 : 16;

// Handle colors
const HANDLE_COLOR_CENTER = '#4ecdc4';
const HANDLE_COLOR_RADIUS = '#ffe500';

function apiUrl() {
  return location.pathname.startsWith('/golf') ? '/golf/api/edit/save-hole' : '/api/edit/save-hole';
}

// ---------------------------------------------------------------------------
// Key resolution
// ---------------------------------------------------------------------------

function resolveEditorKey(editParam) {
  if (!editParam) return null;
  if (editParam.length > 12) {
    // Long key on first visit - persist and shorten URL
    localStorage.setItem(STORAGE_KEY, editParam);
    const u = new URL(location.href);
    u.searchParams.set('edit', '1');
    history.replaceState(null, '', u.toString());
    return editParam;
  }
  // Short param (e.g. '1') - look up stored key
  return localStorage.getItem(STORAGE_KEY) || null;
}

// ---------------------------------------------------------------------------
// Fallback UI when no key
// ---------------------------------------------------------------------------

function showKeyPrompt() {
  document.body.innerHTML = `
    <div style="
      display:flex; align-items:center; justify-content:center;
      height:100vh; background:#1a1a2e; color:#ccc;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
      text-align:center; padding:24px; box-sizing:border-box;
    ">
      <div>
        <div style="font-size:22px;font-weight:bold;color:#fff;margin-bottom:12px;">Editor key required</div>
        <div>Append <code style="background:#2a2a3e;padding:2px 6px;border-radius:4px;">?edit=&lt;your-key&gt;</code> to the URL once.</div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Hide game UI
// ---------------------------------------------------------------------------

function hideGameUI() {
  const tb = document.getElementById('title-buttons');
  if (tb) tb.classList.add('hidden');
  const tr = document.getElementById('top-right');
  if (tr) tr.classList.add('hidden');
  document.body.classList.add('editor-active');
}

// ---------------------------------------------------------------------------
// Deep clone helper
// ---------------------------------------------------------------------------

function deepClone(obj) {
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

// ---------------------------------------------------------------------------
// Toast notification
// ---------------------------------------------------------------------------

function showToast(message) {
  let toast = document.getElementById('editor-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'editor-toast';
    toast.style.cssText = [
      'position:fixed',
      'bottom:80px',
      'left:50%',
      'transform:translateX(-50%)',
      'background:rgba(0,0,0,0.85)',
      'color:#fff',
      'padding:10px 20px',
      'border-radius:8px',
      'font-size:15px',
      'z-index:9999',
      'pointer-events:none',
      'transition:opacity 0.3s',
    ].join(';');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

// ---------------------------------------------------------------------------
// Fake game object for render.js
// ---------------------------------------------------------------------------

function makeFakeGame(holeIndex) {
  const hole = COURSES[holeIndex] || COURSES[0];
  return {
    currentHole: holeIndex,
    state: 'aiming',
    strokes: 0,
    scorecard: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    ball: null,
    time: 0,
    trail: [],
    zoom: { level: 1, panX: 0, panY: 0 },
    mode: 'sp',
    players: [],
    balls: {},
    _personalBests: null,
    _leaderboard: null,
    playerName: '',
    input: {},
    animState: {},
  };
}

// ---------------------------------------------------------------------------
// Element type metadata
// ---------------------------------------------------------------------------

const ELEM_TYPES = [
  { key: 'walls',           label: 'Wall',        plural: 'Walls' },
  { key: 'bumpers',         label: 'Bumper',      plural: 'Bumpers' },
  { key: 'sandTraps',       label: 'Sand Trap',   plural: 'Sand Traps' },
  { key: 'waterHazards',    label: 'Water',       plural: 'Water Hazards' },
  { key: 'movingObstacles', label: 'Obstacle',    plural: 'Obstacles' },
  { key: 'slopes',          label: 'Slope',       plural: 'Slopes' },
  { key: 'speedPads',       label: 'Speed Pad',   plural: 'Speed Pads' },
  { key: 'magnets',         label: 'Magnet',      plural: 'Magnets' },
  { key: 'oneWayGates',     label: 'Gate',        plural: 'One-Way Gates' },
  { key: 'teleporters',     label: 'Teleporter',  plural: 'Teleporters' },
];

// ---------------------------------------------------------------------------
// Handle generation
// Produces a flat list of handle descriptors from the current wipHole.
// Each handle: { type, elIdx, role, vertexIdx?, wx, wy, isRadius }
// ---------------------------------------------------------------------------

function getHandles(hole) {
  if (!hole) return [];
  const handles = [];

  // Tee
  if (hole.tee) {
    handles.push({ type: 'tee', elIdx: 0, role: 'center', wx: hole.tee.x, wy: hole.tee.y, isRadius: false });
  }

  // Cup
  if (hole.hole) {
    handles.push({ type: 'cup', elIdx: 0, role: 'center', wx: hole.hole.x, wy: hole.hole.y, isRadius: false });
    // Radius handle: offset to the right by holeRadius
    const hr = hole.holeRadius || 12;
    handles.push({ type: 'cup', elIdx: 0, role: 'radius', wx: hole.hole.x + hr, wy: hole.hole.y, isRadius: true });
  }

  // Walls
  if (hole.walls) {
    hole.walls.forEach((w, i) => {
      handles.push({ type: 'walls', elIdx: i, role: 'p1', wx: w.x1, wy: w.y1, isRadius: false });
      handles.push({ type: 'walls', elIdx: i, role: 'p2', wx: w.x2, wy: w.y2, isRadius: false });
    });
  }

  // One-way gates
  if (hole.oneWayGates) {
    hole.oneWayGates.forEach((g, i) => {
      handles.push({ type: 'oneWayGates', elIdx: i, role: 'p1', wx: g.x1, wy: g.y1, isRadius: false });
      handles.push({ type: 'oneWayGates', elIdx: i, role: 'p2', wx: g.x2, wy: g.y2, isRadius: false });
    });
  }

  // Bumpers
  if (hole.bumpers) {
    hole.bumpers.forEach((b, i) => {
      handles.push({ type: 'bumpers', elIdx: i, role: 'center', wx: b.x, wy: b.y, isRadius: false });
      const r = b.r != null ? b.r : 14;
      handles.push({ type: 'bumpers', elIdx: i, role: 'radius', wx: b.x + r, wy: b.y, isRadius: true });
    });
  }

  // Magnets
  if (hole.magnets) {
    hole.magnets.forEach((m, i) => {
      handles.push({ type: 'magnets', elIdx: i, role: 'center', wx: m.x, wy: m.y, isRadius: false });
      const r = m.radius != null ? m.radius : 150;
      handles.push({ type: 'magnets', elIdx: i, role: 'radius', wx: m.x + r, wy: m.y, isRadius: true });
    });
  }

  // Teleporters
  if (hole.teleporters) {
    hole.teleporters.forEach((t, i) => {
      handles.push({ type: 'teleporters', elIdx: i, role: 'a-center', wx: t.a.x, wy: t.a.y, isRadius: false });
      handles.push({ type: 'teleporters', elIdx: i, role: 'a-radius', wx: t.a.x + (t.a.r || 25), wy: t.a.y, isRadius: true });
      handles.push({ type: 'teleporters', elIdx: i, role: 'b-center', wx: t.b.x, wy: t.b.y, isRadius: false });
      handles.push({ type: 'teleporters', elIdx: i, role: 'b-radius', wx: t.b.x + (t.b.r || 25), wy: t.b.y, isRadius: true });
    });
  }

  // Polygon types - one handle per vertex
  const polyTypes = ['sandTraps', 'waterHazards', 'slopes', 'speedPads'];
  for (const key of polyTypes) {
    if (hole[key]) {
      hole[key].forEach((el, i) => {
        if (el.points) {
          el.points.forEach((pt, vi) => {
            handles.push({ type: key, elIdx: i, role: 'vertex', vertexIdx: vi, wx: pt.x, wy: pt.y, isRadius: false });
          });
        }
      });
    }
  }

  // Moving obstacles - pivot center only
  if (hole.movingObstacles) {
    hole.movingObstacles.forEach((ob, i) => {
      if (ob.pivot) {
        handles.push({ type: 'movingObstacles', elIdx: i, role: 'pivot', wx: ob.pivot.x, wy: ob.pivot.y, isRadius: false });
      }
    });
  }

  return handles;
}

// ---------------------------------------------------------------------------
// Apply a drag delta to wipHole based on drag state
// ---------------------------------------------------------------------------

function getDragCenter(hole, drag) {
  const { type, elIdx, role } = drag;
  if (type === 'cup' && role === 'radius') return { x: hole.hole.x, y: hole.hole.y };
  if (type === 'bumpers' && role === 'radius') {
    const b = hole.bumpers[elIdx];
    return b ? { x: b.x, y: b.y } : null;
  }
  if (type === 'magnets' && role === 'radius') {
    const m = hole.magnets[elIdx];
    return m ? { x: m.x, y: m.y } : null;
  }
  if (type === 'teleporters') {
    const t = hole.teleporters[elIdx];
    if (!t) return null;
    if (role === 'a-radius') return { x: t.a.x, y: t.a.y };
    if (role === 'b-radius') return { x: t.b.x, y: t.b.y };
  }
  return null;
}

function applyDrag(hole, drag, worldX, worldY) {
  const { type, elIdx, role, vertexIdx } = drag;

  switch (type) {
    case 'tee':
      hole.tee.x = worldX;
      hole.tee.y = worldY;
      break;

    case 'cup':
      if (role === 'center') {
        hole.hole.x = worldX;
        hole.hole.y = worldY;
      } else if (role === 'radius') {
        const cx = hole.hole.x;
        const cy = hole.hole.y;
        hole.holeRadius = Math.max(4, Math.hypot(worldX - cx, worldY - cy));
      }
      break;

    case 'walls':
    case 'oneWayGates': {
      const el = hole[type][elIdx];
      if (role === 'p1') { el.x1 = worldX; el.y1 = worldY; }
      else if (role === 'p2') { el.x2 = worldX; el.y2 = worldY; }
      break;
    }

    case 'bumpers': {
      const b = hole.bumpers[elIdx];
      if (role === 'center') { b.x = worldX; b.y = worldY; }
      else if (role === 'radius') {
        b.r = Math.max(4, Math.hypot(worldX - b.x, worldY - b.y));
      }
      break;
    }

    case 'magnets': {
      const m = hole.magnets[elIdx];
      if (role === 'center') { m.x = worldX; m.y = worldY; }
      else if (role === 'radius') {
        m.radius = Math.max(4, Math.hypot(worldX - m.x, worldY - m.y));
      }
      break;
    }

    case 'teleporters': {
      const t = hole.teleporters[elIdx];
      if (role === 'a-center') { t.a.x = worldX; t.a.y = worldY; }
      else if (role === 'a-radius') { t.a.r = Math.max(4, Math.hypot(worldX - t.a.x, worldY - t.a.y)); }
      else if (role === 'b-center') { t.b.x = worldX; t.b.y = worldY; }
      else if (role === 'b-radius') { t.b.r = Math.max(4, Math.hypot(worldX - t.b.x, worldY - t.b.y)); }
      break;
    }

    case 'sandTraps':
    case 'waterHazards':
    case 'slopes':
    case 'speedPads': {
      const el = hole[type][elIdx];
      if (role === 'vertex' && el.points && vertexIdx != null) {
        el.points[vertexIdx].x = worldX;
        el.points[vertexIdx].y = worldY;
      }
      break;
    }

    case 'movingObstacles': {
      const ob = hole.movingObstacles[elIdx];
      if (role === 'pivot' && ob.pivot) {
        ob.pivot.x = worldX;
        ob.pivot.y = worldY;
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Hit-test handles in screen space
// Returns handle descriptor or null
// ---------------------------------------------------------------------------

function hitTestHandles(screenX, screenY, hole, fakeGame, viewport) {
  const handles = getHandles(hole);
  // Iterate in reverse so top-drawn handles win (radius handles drawn on top)
  for (let i = handles.length - 1; i >= 0; i--) {
    const h = handles[i];
    const sp = worldToScreen(h.wx, h.wy, fakeGame, viewport, hole);
    const dist = Math.hypot(screenX - sp.x, screenY - sp.y);
    if (dist <= HANDLE_HIT_RADIUS) return h;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Draw handles
// ---------------------------------------------------------------------------

function drawHandles(ctx, state) {
  if (state.mode !== 'edit') return;
  const hole = state.wipHole;
  if (!hole) return;

  const handles = getHandles(hole);
  const vp = state.viewport;
  const fg = state.fakeGame;

  ctx.save();

  for (const h of handles) {
    const sp = worldToScreen(h.wx, h.wy, fg, vp, hole);
    const size = h.isRadius ? HANDLE_RADIUS_SIZE : HANDLE_SIZE;
    const r = size / 2;
    const fill = h.isRadius ? HANDLE_COLOR_RADIUS : HANDLE_COLOR_CENTER;

    // Check if this handle is being hovered or actively dragged
    const isDragging = state.dragging &&
      state.dragging.type === h.type &&
      state.dragging.elIdx === h.elIdx &&
      state.dragging.role === h.role &&
      (h.role !== 'vertex' || state.dragging.vertexIdx === h.vertexIdx);

    ctx.beginPath();
    ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (isDragging) {
      // Glow ring
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Sidebar build
// ---------------------------------------------------------------------------

function buildSidebar(state, onChange) {
  const sidebar = document.getElementById('editor-sidebar');
  if (!sidebar) return;
  sidebar.classList.remove('hidden');
  sidebar.innerHTML = '';

  // --- Hole picker section ---
  const holeSection = document.createElement('div');
  holeSection.className = 'editor-section';
  holeSection.innerHTML = `<div class="editor-section-title">Hole</div>`;

  const holePicker = document.createElement('select');
  holePicker.className = 'editor-input';
  holePicker.id = 'editor-hole-picker';
  COURSES.forEach((c, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${i + 1}. ${c.name}`;
    holePicker.appendChild(opt);
  });
  holePicker.value = String(state.holeIndex);
  holePicker.addEventListener('change', () => {
    const idx = parseInt(holePicker.value, 10);
    state.holeIndex = idx;
    state.wipHole = deepClone(COURSES[idx]);
    state.pristineHole = deepClone(COURSES[idx]);
    state.selected = null;
    state.dragging = null;
    // Exit play mode if active
    if (state.mode === 'play') exitPlayMode(state);
    // Update fakeGame currentHole
    state.fakeGame.currentHole = idx;
    state.fakeGame.ball = null;
    onChange();
  });
  holeSection.appendChild(holePicker);

  const revertBtn = document.createElement('button');
  revertBtn.className = 'editor-btn editor-btn-secondary';
  revertBtn.id = 'editor-revert';
  revertBtn.textContent = 'Revert';
  revertBtn.addEventListener('click', () => {
    state.wipHole = deepClone(state.pristineHole);
    state.selected = null;
    state.dragging = null;
    if (state.mode === 'play') exitPlayMode(state);
    onChange();
  });
  holeSection.appendChild(revertBtn);
  sidebar.appendChild(holeSection);

  // --- Metadata section ---
  const metaSection = document.createElement('div');
  metaSection.className = 'editor-section';
  metaSection.innerHTML = `<div class="editor-section-title">Metadata</div>`;

  function metaInput(id, labelText, type, opts = {}) {
    const label = document.createElement('label');
    label.className = 'editor-label';
    label.textContent = labelText + ' ';
    const inp = document.createElement('input');
    inp.className = 'editor-input';
    inp.id = id;
    inp.type = type;
    if (opts.min !== undefined) inp.min = String(opts.min);
    if (opts.max !== undefined) inp.max = String(opts.max);
    label.appendChild(inp);
    return { label, inp };
  }

  const fields = [
    { id: 'editor-name',     label: 'Name',   type: 'text' },
    { id: 'editor-par',      label: 'Par',    type: 'number', min: 1, max: 20 },
    { id: 'editor-bounds-w', label: 'Width',  type: 'number', min: 200 },
    { id: 'editor-bounds-h', label: 'Height', type: 'number', min: 200 },
    { id: 'editor-tee-x',    label: 'Tee X',  type: 'number' },
    { id: 'editor-tee-y',    label: 'Tee Y',  type: 'number' },
    { id: 'editor-hole-x',   label: 'Hole X', type: 'number' },
    { id: 'editor-hole-y',   label: 'Hole Y', type: 'number' },
  ];

  for (const f of fields) {
    const { label, inp } = metaInput(f.id, f.label, f.type, f);
    inp.addEventListener('change', () => {
      applyMetaChange(state, f.id, inp.value);
      onChange();
    });
    metaSection.appendChild(label);
  }
  sidebar.appendChild(metaSection);

  // --- Elements section ---
  const elemSection = document.createElement('div');
  elemSection.className = 'editor-section';
  elemSection.innerHTML = `<div class="editor-section-title">Elements</div>`;
  const elemList = document.createElement('div');
  elemList.id = 'editor-elements-list';
  elemSection.appendChild(elemList);
  sidebar.appendChild(elemSection);

  // --- Add palette section ---
  const paletteSection = document.createElement('div');
  paletteSection.className = 'editor-section';
  paletteSection.id = 'editor-palette-section';
  paletteSection.innerHTML = `<div class="editor-section-title">Add Element</div>`;
  const paletteGrid = document.createElement('div');
  paletteGrid.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';

  const ADD_ITEMS = [
    { label: '+ Wall',       action: () => addElement(state, 'walls', onChange) },
    { label: '+ Bumper',     action: () => addElement(state, 'bumpers', onChange) },
    { label: '+ Sand',       action: () => addElement(state, 'sandTraps', onChange) },
    { label: '+ Water',      action: () => addElement(state, 'waterHazards', onChange) },
    { label: '+ Slope',      action: () => addElement(state, 'slopes', onChange) },
    { label: '+ Speed Pad',  action: () => addElement(state, 'speedPads', onChange) },
    { label: '+ Magnet',     action: () => addElement(state, 'magnets', onChange) },
    { label: '+ Gate',       action: () => addElement(state, 'oneWayGates', onChange) },
    { label: '+ Teleporter', action: () => addElement(state, 'teleporters', onChange) },
  ];

  for (const item of ADD_ITEMS) {
    const btn = document.createElement('button');
    btn.className = 'editor-btn editor-btn-secondary';
    btn.textContent = item.label;
    btn.style.cssText = 'font-size:11px;padding:4px 6px;flex:0 0 auto;';
    btn.addEventListener('click', () => {
      if (state.mode === 'play') return;
      item.action();
    });
    paletteGrid.appendChild(btn);
  }
  paletteSection.appendChild(paletteGrid);
  sidebar.appendChild(paletteSection);

  // --- Properties section ---
  const propSection = document.createElement('div');
  propSection.className = 'editor-section';
  propSection.id = 'editor-properties-section';
  propSection.innerHTML = `<div class="editor-section-title">Properties</div>`;
  const propBody = document.createElement('div');
  propBody.id = 'editor-properties-body';
  propBody.innerHTML = '<div class="editor-empty">Click an element to edit its properties.</div>';
  propSection.appendChild(propBody);
  sidebar.appendChild(propSection);

  // --- Save section ---
  const saveSection = document.createElement('div');
  saveSection.className = 'editor-section editor-save-section';

  // Play toggle button (above save)
  const playBtn = document.createElement('button');
  playBtn.className = 'editor-btn editor-btn-secondary';
  playBtn.id = 'editor-play-btn';
  playBtn.textContent = 'Play in place';
  playBtn.addEventListener('click', () => {
    if (state.mode === 'edit') {
      enterPlayMode(state, canvas_ref);
      updatePlayUI(state);
    } else {
      exitPlayMode(state);
      updatePlayUI(state);
    }
  });
  saveSection.appendChild(playBtn);

  // Play stats line
  const playStats = document.createElement('div');
  playStats.id = 'editor-play-stats';
  playStats.className = 'editor-readonly';
  playStats.style.cssText = 'margin:4px 0;font-size:12px;';
  playStats.textContent = '';
  saveSection.appendChild(playStats);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'editor-btn editor-btn-primary';
  saveBtn.id = 'editor-save';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    if (state.mode === 'play') {
      exitPlayMode(state);
      updatePlayUI(state);
    }
    save(state);
  });
  const saveStatus = document.createElement('div');
  saveStatus.className = 'editor-save-status';
  saveStatus.id = 'editor-save-status';
  saveSection.appendChild(saveBtn);
  saveSection.appendChild(saveStatus);
  sidebar.appendChild(saveSection);

  // Initial fill
  fillMetaInputs(state);
  rebuildElementList(state, onChange);
}

// Reference to canvas, set during startEditor
let canvas_ref = null;

// ---------------------------------------------------------------------------
// Play mode helpers
// ---------------------------------------------------------------------------

function enterPlayMode(state, canvas) {
  state.mode = 'play';
  const h = state.wipHole;
  state.playGame = {
    ball: { x: h.tee.x, y: h.tee.y, vx: 0, vy: 0 },
    time: 0,
    strokes: 0,
    rolling: false,
    accumulator: 0,
  };
  state.fakeGame.state = 'aiming';
  state.fakeGame.ball = { x: h.tee.x, y: h.tee.y, vx: 0, vy: 0 };
  state.fakeGame.input = {};

  // Init input system against the canvas
  const canvasEl = canvas || canvas_ref;
  if (canvasEl) {
    initInput(canvasEl, () => {
      if (!state.playGame || !state.playGame.ball) return { x: 0, y: 0 };
      const sp = worldToScreen(state.playGame.ball.x, state.playGame.ball.y, state.fakeGame, state.viewport, state.wipHole);
      return sp;
    });
    setEnabled(true);
  }
}

function exitPlayMode(state) {
  setEnabled(false);
  state.mode = 'edit';
  state.playGame = null;
  state.fakeGame.ball = null;
  state.fakeGame.state = 'aiming';
  state.fakeGame.input = {};
}

function updatePlayUI(state) {
  const playBtn = document.getElementById('editor-play-btn');
  const paletteSection = document.getElementById('editor-palette-section');
  const propSection = document.getElementById('editor-properties-section');

  if (state.mode === 'play') {
    if (playBtn) playBtn.textContent = 'Stop playing';
    if (paletteSection) paletteSection.style.opacity = '0.4';
    if (propSection) propSection.style.opacity = '0.4';
  } else {
    if (playBtn) playBtn.textContent = 'Play in place';
    if (paletteSection) paletteSection.style.opacity = '';
    if (propSection) propSection.style.opacity = '';
    const statsEl = document.getElementById('editor-play-stats');
    if (statsEl) statsEl.textContent = '';
  }
}

// ---------------------------------------------------------------------------
// Add element defaults
// ---------------------------------------------------------------------------

function addElement(state, type, onChange) {
  const h = state.wipHole;
  if (!h) return;

  const cx = h.bounds ? h.bounds.width / 2 : 200;
  const cy = h.bounds ? h.bounds.height / 2 : 200;

  // Square polygon helper (80x80)
  function square80() {
    const half = 40;
    return [
      { x: cx - half, y: cy - half },
      { x: cx + half, y: cy - half },
      { x: cx + half, y: cy + half },
      { x: cx - half, y: cy + half },
    ];
  }

  let newEl;
  switch (type) {
    case 'walls':
      newEl = { x1: cx - 50, y1: cy, x2: cx + 50, y2: cy };
      break;
    case 'bumpers':
      newEl = { x: cx, y: cy, r: 14 };
      break;
    case 'sandTraps':
      newEl = { points: square80() };
      break;
    case 'waterHazards':
      newEl = { points: square80() };
      break;
    case 'slopes':
      newEl = { points: square80(), ax: 0, ay: 0 };
      break;
    case 'speedPads':
      newEl = { points: square80(), ax: 0, ay: 0 };
      break;
    case 'magnets':
      newEl = { x: cx, y: cy, strength: 200, radius: 150 };
      break;
    case 'oneWayGates':
      newEl = { x1: cx - 50, y1: cy, x2: cx + 50, y2: cy, nx: 0, ny: -1 };
      break;
    case 'teleporters':
      newEl = { a: { x: cx - 100, y: cy, r: 25 }, b: { x: cx + 100, y: cy, r: 25 } };
      break;
    default:
      return;
  }

  if (!h[type]) h[type] = [];
  h[type].push(newEl);
  const newIdx = h[type].length - 1;
  state.selected = { type, index: newIdx };
  onChange();
}

// ---------------------------------------------------------------------------
// Delete selected element
// ---------------------------------------------------------------------------

function deleteSelected(state, onChange) {
  if (!state.selected) return;
  const { type, index } = state.selected;

  // Cannot delete pseudo-elements
  if (type === 'tee' || type === 'cup' || type === 'markers') return;

  const h = state.wipHole;
  if (!h || !h[type] || !Array.isArray(h[type])) return;

  h[type].splice(index, 1);
  state.selected = null;
  state.dragging = null;
  onChange();
}

// ---------------------------------------------------------------------------
// Refresh sidebar (called after state changes, avoids full rebuild)
// ---------------------------------------------------------------------------

function refreshSidebar(state, onChange) {
  fillMetaInputs(state);
  rebuildElementList(state, onChange);
  refreshPropertiesPanel(state, onChange);
}

// ---------------------------------------------------------------------------
// Fill metadata inputs from wipHole
// ---------------------------------------------------------------------------

function fillMetaInputs(state) {
  const h = state.wipHole;
  if (!h) return;
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val !== undefined && val !== null ? String(val) : '';
  };
  set('editor-name',     h.name || '');
  set('editor-par',      h.par != null ? h.par : '');
  set('editor-bounds-w', h.bounds ? h.bounds.width : '');
  set('editor-bounds-h', h.bounds ? h.bounds.height : '');
  set('editor-tee-x',    h.tee ? h.tee.x : '');
  set('editor-tee-y',    h.tee ? h.tee.y : '');
  set('editor-hole-x',   h.hole ? h.hole.x : '');
  set('editor-hole-y',   h.hole ? h.hole.y : '');
}

// ---------------------------------------------------------------------------
// Apply metadata change back to wipHole
// ---------------------------------------------------------------------------

function applyMetaChange(state, id, rawVal) {
  const h = state.wipHole;
  if (!h) return;
  const num = parseFloat(rawVal);
  switch (id) {
    case 'editor-name':     h.name = rawVal; break;
    case 'editor-par':      if (!isNaN(num)) h.par = num; break;
    case 'editor-bounds-w': if (!isNaN(num)) { h.bounds = h.bounds || {}; h.bounds.width = num; } break;
    case 'editor-bounds-h': if (!isNaN(num)) { h.bounds = h.bounds || {}; h.bounds.height = num; } break;
    case 'editor-tee-x':    if (!isNaN(num)) { h.tee = h.tee || {}; h.tee.x = num; } break;
    case 'editor-tee-y':    if (!isNaN(num)) { h.tee = h.tee || {}; h.tee.y = num; } break;
    case 'editor-hole-x':   if (!isNaN(num)) { h.hole = h.hole || {}; h.hole.x = num; } break;
    case 'editor-hole-y':   if (!isNaN(num)) { h.hole = h.hole || {}; h.hole.y = num; } break;
  }
}

// ---------------------------------------------------------------------------
// Rebuild element list
// ---------------------------------------------------------------------------

function rebuildElementList(state, onChange) {
  const container = document.getElementById('editor-elements-list');
  if (!container) return;
  container.innerHTML = '';

  const h = state.wipHole;
  if (!h) return;

  // Pseudo-elements: Tee and Cup (hole)
  const pseudoGroup = document.createElement('div');
  pseudoGroup.className = 'editor-elem-group';
  const pseudoHeader = document.createElement('div');
  pseudoHeader.className = 'editor-elem-group-header';
  pseudoHeader.textContent = 'Markers (2)';
  const pseudoRows = document.createElement('div');
  pseudoRows.className = 'editor-elem-group-rows';

  for (const pseudo of ['tee', 'cup']) {
    const row = document.createElement('div');
    row.className = 'editor-elem-row' + (
      state.selected && state.selected.type === pseudo ? ' selected' : ''
    );
    row.dataset.type = pseudo;
    row.dataset.index = '0';
    row.textContent = pseudo === 'tee' ? 'Tee' : 'Cup';
    row.addEventListener('pointerdown', () => {
      if (state.mode === 'play') return;
      state.selected = { type: pseudo, index: 0 };
      rebuildElementList(state, onChange);
      refreshPropertiesPanel(state, onChange);
    });
    pseudoRows.appendChild(row);
  }
  pseudoGroup.appendChild(pseudoHeader);
  pseudoGroup.appendChild(pseudoRows);
  container.appendChild(pseudoGroup);

  // Element types
  for (const { key, label, plural } of ELEM_TYPES) {
    const arr = h[key];
    if (!arr || arr.length === 0) continue;

    const group = document.createElement('div');
    group.className = 'editor-elem-group';

    const header = document.createElement('div');
    header.className = 'editor-elem-group-header';
    header.textContent = `${plural} (${arr.length})`;
    // Collapse toggle
    let collapsed = false;
    header.addEventListener('pointerdown', () => {
      collapsed = !collapsed;
      rowsDiv.style.display = collapsed ? 'none' : '';
      header.classList.toggle('collapsed', collapsed);
    });

    const rowsDiv = document.createElement('div');
    rowsDiv.className = 'editor-elem-group-rows';

    arr.forEach((_, i) => {
      const row = document.createElement('div');
      row.className = 'editor-elem-row' + (
        state.selected && state.selected.type === key && state.selected.index === i ? ' selected' : ''
      );
      row.dataset.type = key;
      row.dataset.index = String(i);
      row.textContent = `${label} ${i + 1}`;
      row.addEventListener('pointerdown', () => {
        if (state.mode === 'play') return;
        state.selected = { type: key, index: i };
        rebuildElementList(state, onChange);
        refreshPropertiesPanel(state, onChange);
      });
      rowsDiv.appendChild(row);
    });

    group.appendChild(header);
    group.appendChild(rowsDiv);
    container.appendChild(group);
  }
}

// ---------------------------------------------------------------------------
// Properties panel
// ---------------------------------------------------------------------------

// Debounce timer for properties panel refresh during drag
let _propRefreshTimer = null;

function refreshPropertiesPanelDebounced(state, onChange) {
  if (_propRefreshTimer) return;
  _propRefreshTimer = setTimeout(() => {
    _propRefreshTimer = null;
    refreshPropertiesPanel(state, onChange);
  }, 33); // ~30Hz
}

function refreshPropertiesPanel(state, onChange) {
  const body = document.getElementById('editor-properties-body');
  if (!body) return;

  if (!state.selected) {
    body.innerHTML = '<div class="editor-empty">Click an element to edit its properties.</div>';
    return;
  }

  const { type, index } = state.selected;
  const h = state.wipHole;
  body.innerHTML = '';

  function numField(labelText, getter, setter, step) {
    const label = document.createElement('label');
    label.className = 'editor-label';
    label.textContent = labelText + ' ';
    const inp = document.createElement('input');
    inp.className = 'editor-input';
    inp.type = 'number';
    inp.step = step !== undefined ? String(step) : 'any';
    const val = getter();
    inp.value = val !== undefined && val !== null ? String(val) : '';
    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value);
      if (!isNaN(v)) {
        setter(v);
        onChange();
      }
    });
    label.appendChild(inp);
    return label;
  }

  function readonlyInfo(text) {
    const d = document.createElement('div');
    d.className = 'editor-readonly';
    d.textContent = text;
    return d;
  }

  if (type === 'tee') {
    body.appendChild(numField('X', () => h.tee.x, v => { h.tee.x = v; }));
    body.appendChild(numField('Y', () => h.tee.y, v => { h.tee.y = v; }));
  } else if (type === 'cup') {
    body.appendChild(numField('X', () => h.hole.x, v => { h.hole.x = v; }));
    body.appendChild(numField('Y', () => h.hole.y, v => { h.hole.y = v; }));
    body.appendChild(numField('Radius', () => h.holeRadius || 12, v => { h.holeRadius = v; }));
  } else if (type === 'walls' || type === 'oneWayGates') {
    const el = h[type][index];
    body.appendChild(numField('x1', () => el.x1, v => { el.x1 = v; }));
    body.appendChild(numField('y1', () => el.y1, v => { el.y1 = v; }));
    body.appendChild(numField('x2', () => el.x2, v => { el.x2 = v; }));
    body.appendChild(numField('y2', () => el.y2, v => { el.y2 = v; }));
    if (type === 'oneWayGates') {
      body.appendChild(numField('nx', () => el.nx, v => { el.nx = v; }, 0.01));
      body.appendChild(numField('ny', () => el.ny, v => { el.ny = v; }, 0.01));
    }
  } else if (type === 'bumpers') {
    const el = h.bumpers[index];
    body.appendChild(numField('X', () => el.x, v => { el.x = v; }));
    body.appendChild(numField('Y', () => el.y, v => { el.y = v; }));
    body.appendChild(numField('Radius', () => el.r != null ? el.r : 14, v => { el.r = v; }));
    body.appendChild(numField('Bounciness', () => el.bounciness != null ? el.bounciness : 1.0, v => { el.bounciness = v; }, 0.01));
  } else if (type === 'magnets') {
    const el = h.magnets[index];
    body.appendChild(numField('X', () => el.x, v => { el.x = v; }));
    body.appendChild(numField('Y', () => el.y, v => { el.y = v; }));
    body.appendChild(numField('Strength', () => el.strength, v => { el.strength = v; }));
    body.appendChild(numField('Radius', () => el.radius, v => { el.radius = v; }));
  } else if (type === 'teleporters') {
    const el = h.teleporters[index];
    body.appendChild(numField('A x', () => el.a.x, v => { el.a.x = v; }));
    body.appendChild(numField('A y', () => el.a.y, v => { el.a.y = v; }));
    body.appendChild(numField('A r', () => el.a.r, v => { el.a.r = v; }));
    body.appendChild(numField('B x', () => el.b.x, v => { el.b.x = v; }));
    body.appendChild(numField('B y', () => el.b.y, v => { el.b.y = v; }));
    body.appendChild(numField('B r', () => el.b.r, v => { el.b.r = v; }));
  } else if (type === 'sandTraps' || type === 'waterHazards') {
    const el = h[type][index];
    const pts = (el.points || []).length;
    body.appendChild(readonlyInfo(`${pts} vertices (drag handles to reshape)`));
  } else if (type === 'slopes' || type === 'speedPads') {
    const el = h[type][index];
    const pts = (el.points || []).length;
    body.appendChild(readonlyInfo(`${pts} vertices (drag handles to reshape)`));
    body.appendChild(numField('ax', () => el.ax, v => { el.ax = v; }, 0.1));
    body.appendChild(numField('ay', () => el.ay, v => { el.ay = v; }, 0.1));
  } else if (type === 'movingObstacles') {
    const el = h.movingObstacles[index];
    body.appendChild(readonlyInfo(`type: ${el.type || 'windmill'}`));
    if (el.pivot) {
      body.appendChild(numField('Pivot X', () => el.pivot.x, v => { el.pivot.x = v; }));
      body.appendChild(numField('Pivot Y', () => el.pivot.y, v => { el.pivot.y = v; }));
    }
    if (el.armLength != null) body.appendChild(numField('Arm Length', () => el.armLength, v => { el.armLength = v; }));
    if (el.rpm != null) body.appendChild(numField('RPM', () => el.rpm, v => { el.rpm = v; }, 0.1));
  }
}

// ---------------------------------------------------------------------------
// Canvas setup
// ---------------------------------------------------------------------------

function setupCanvas(canvas, ctx, state) {
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const sidebarW = window.innerWidth <= 768 ? 0 : 320;
    const w = window.innerWidth - sidebarW;
    const h = window.innerHeight;
    state.viewport.w = w;
    state.viewport.h = h;
    state.viewport.dpr = dpr;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.style.left = sidebarW + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();
}

// ---------------------------------------------------------------------------
// Hit testing (element bodies)
// ---------------------------------------------------------------------------

const HIT_RADIUS = 12;    // world px for point targets
const HIT_LINE   = 8;     // world px for line targets

function pointInPolygon(px, py, points) {
  if (!points || points.length < 3) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x, yi = points[i].y;
    const xj = points[j].x, yj = points[j].y;
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function hitTest(worldX, worldY, hole) {
  if (!hole) return null;

  // Bumpers (point)
  if (hole.bumpers) {
    for (let i = 0; i < hole.bumpers.length; i++) {
      const b = hole.bumpers[i];
      const r = b.r != null ? b.r : 14;
      if (Math.hypot(worldX - b.x, worldY - b.y) <= r + HIT_RADIUS) {
        return { type: 'bumpers', index: i };
      }
    }
  }

  // Magnets (point)
  if (hole.magnets) {
    for (let i = 0; i < hole.magnets.length; i++) {
      const m = hole.magnets[i];
      if (Math.hypot(worldX - m.x, worldY - m.y) <= HIT_RADIUS) {
        return { type: 'magnets', index: i };
      }
    }
  }

  // Teleporters (a and b pads)
  if (hole.teleporters) {
    for (let i = 0; i < hole.teleporters.length; i++) {
      const t = hole.teleporters[i];
      if (Math.hypot(worldX - t.a.x, worldY - t.a.y) <= (t.a.r || 20) + HIT_RADIUS * 0.5) {
        return { type: 'teleporters', index: i };
      }
      if (Math.hypot(worldX - t.b.x, worldY - t.b.y) <= (t.b.r || 20) + HIT_RADIUS * 0.5) {
        return { type: 'teleporters', index: i };
      }
    }
  }

  // Tee (point)
  if (hole.tee && Math.hypot(worldX - hole.tee.x, worldY - hole.tee.y) <= HIT_RADIUS) {
    return { type: 'tee', index: 0 };
  }

  // Cup/hole (point)
  if (hole.hole) {
    const hr = hole.holeRadius || 12;
    if (Math.hypot(worldX - hole.hole.x, worldY - hole.hole.y) <= hr + HIT_RADIUS * 0.5) {
      return { type: 'cup', index: 0 };
    }
  }

  // Walls (line distance)
  if (hole.walls) {
    for (let i = 0; i < hole.walls.length; i++) {
      const w = hole.walls[i];
      if (distToSegment(worldX, worldY, w.x1, w.y1, w.x2, w.y2) <= HIT_LINE) {
        return { type: 'walls', index: i };
      }
    }
  }

  // One-way gates (line distance)
  if (hole.oneWayGates) {
    for (let i = 0; i < hole.oneWayGates.length; i++) {
      const g = hole.oneWayGates[i];
      if (distToSegment(worldX, worldY, g.x1, g.y1, g.x2, g.y2) <= HIT_LINE) {
        return { type: 'oneWayGates', index: i };
      }
    }
  }

  // Polygon types (point-in-polygon)
  const polyTypes = ['sandTraps', 'waterHazards', 'slopes', 'speedPads'];
  for (const key of polyTypes) {
    if (hole[key]) {
      for (let i = 0; i < hole[key].length; i++) {
        if (pointInPolygon(worldX, worldY, hole[key][i].points)) {
          return { type: key, index: i };
        }
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Pointer events (handles + click-to-select + drag)
// ---------------------------------------------------------------------------

function setupPointerEvents(canvas, state, onChange) {
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;

    // In play mode, input.js handles everything
    if (state.mode === 'play') return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // 1. Hit-test handles first
    const handleHit = hitTestHandles(screenX, screenY, state.wipHole, state.fakeGame, state.viewport);
    if (handleHit) {
      // Select the element this handle belongs to
      const selIndex = handleHit.elIdx;
      state.selected = { type: handleHit.type, index: selIndex };

      // Enter drag mode
      const world = screenToWorld(screenX, screenY, state.fakeGame, state.viewport, state.wipHole);
      state.dragging = {
        type: handleHit.type,
        elIdx: handleHit.elIdx,
        role: handleHit.role,
        vertexIdx: handleHit.vertexIdx,
        startWorld: { x: world.x, y: world.y },
        currentWorld: { x: world.x, y: world.y },
      };

      canvas.setPointerCapture(e.pointerId);
      rebuildElementList(state, onChange);
      refreshPropertiesPanel(state, onChange);
      return;
    }

    // 2. Fall back to element body hit-test for selection
    const world = screenToWorld(screenX, screenY, state.fakeGame, state.viewport, state.wipHole);
    const hit = hitTest(world.x, world.y, state.wipHole);
    if (hit) {
      state.selected = hit;
      rebuildElementList(state, onChange);
      refreshPropertiesPanel(state, onChange);
    }
    // No hit: leave selection as-is
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!state.dragging) return;
    if (state.mode === 'play') return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    let world = screenToWorld(screenX, screenY, state.fakeGame, state.viewport, state.wipHole);

    // Shift: snap to 10px grid. For radius handles, snap the distance from
    // center instead so the resulting radius itself snaps cleanly.
    if (e.shiftKey) {
      if (state.dragging.role === 'radius' || state.dragging.role === 'a-radius' || state.dragging.role === 'b-radius') {
        const c = getDragCenter(state.wipHole, state.dragging);
        if (c) {
          const dx = world.x - c.x;
          const dy = world.y - c.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const snapped = Math.max(10, Math.round(dist / 10) * 10);
          if (dist > 0.01) {
            world.x = c.x + (dx / dist) * snapped;
            world.y = c.y + (dy / dist) * snapped;
          }
        }
      } else {
        world.x = Math.round(world.x / 10) * 10;
        world.y = Math.round(world.y / 10) * 10;
      }
    }

    state.dragging.currentWorld = world;
    applyDrag(state.wipHole, state.dragging, world.x, world.y);

    // Keep fakeGame ball synced if tee moved
    if (state.dragging.type === 'tee' && state.wipHole.tee) {
      state.fakeGame.ball = null;
    }

    refreshPropertiesPanelDebounced(state, onChange);
  });

  function endDrag(e) {
    if (!state.dragging) return;
    state.dragging = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    refreshPropertiesPanel(state, onChange);
  }

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
}

// ---------------------------------------------------------------------------
// Delete key listener
// ---------------------------------------------------------------------------

function setupDeleteKey(state, onChange) {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;

    // Don't intercept when typing in an input or textarea
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (state.mode === 'play') return;

    deleteSelected(state, onChange);
    e.preventDefault();
  });
}

// ---------------------------------------------------------------------------
// Selection ring overlay
// ---------------------------------------------------------------------------

function drawSelection(ctx, state) {
  if (!state.selected) return;
  const { type, index } = state.selected;
  const h = state.wipHole;
  if (!h) return;

  const vp = state.viewport;
  const fg = state.fakeGame;

  function screenPt(wx, wy) {
    return worldToScreen(wx, wy, fg, vp, h);
  }

  function scaleVal(worldR) {
    if (!h.bounds) return worldR;
    const availW = vp.w - 24;
    const availH = vp.h - 100;
    const scaleX = availW / h.bounds.width;
    const scaleY = availH / h.bounds.height;
    return worldR * Math.min(scaleX, scaleY) * fg.zoom.level;
  }

  ctx.save();
  ctx.strokeStyle = '#ffe500';
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 4]);

  if (type === 'bumpers' && h.bumpers && h.bumpers[index]) {
    const b = h.bumpers[index];
    const sc = screenPt(b.x, b.y);
    const sr = scaleVal(b.r != null ? b.r : 14);
    ctx.beginPath();
    ctx.arc(sc.x, sc.y, sr + 5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === 'magnets' && h.magnets && h.magnets[index]) {
    const m = h.magnets[index];
    const sc = screenPt(m.x, m.y);
    ctx.beginPath();
    ctx.arc(sc.x, sc.y, 16, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === 'teleporters' && h.teleporters && h.teleporters[index]) {
    const t = h.teleporters[index];
    const sa = screenPt(t.a.x, t.a.y);
    const ra = scaleVal(t.a.r || 20);
    ctx.beginPath();
    ctx.arc(sa.x, sa.y, ra + 5, 0, Math.PI * 2);
    ctx.stroke();
    const sb = screenPt(t.b.x, t.b.y);
    const rb = scaleVal(t.b.r || 20);
    ctx.beginPath();
    ctx.arc(sb.x, sb.y, rb + 5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === 'tee' && h.tee) {
    const sc = screenPt(h.tee.x, h.tee.y);
    ctx.beginPath();
    ctx.arc(sc.x, sc.y, 16, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === 'cup' && h.hole) {
    const sc = screenPt(h.hole.x, h.hole.y);
    const hr = scaleVal(h.holeRadius || 12);
    ctx.beginPath();
    ctx.arc(sc.x, sc.y, hr + 6, 0, Math.PI * 2);
    ctx.stroke();
  } else if ((type === 'walls' || type === 'oneWayGates') && h[type] && h[type][index]) {
    const w = h[type][index];
    const s1 = screenPt(w.x1, w.y1);
    const s2 = screenPt(w.x2, w.y2);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.stroke();
    // Endpoint dots
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(s1.x, s1.y, 6, 0, Math.PI * 2);
    ctx.arc(s2.x, s2.y, 6, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Polygon types - draw outline
    const polyEl = h[type] && h[type][index];
    if (polyEl && polyEl.points && polyEl.points.length > 1) {
      const pts = polyEl.points.map(p => screenPt(p.x, p.y));
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------

function startRenderLoop(canvas, ctx, state, onChange) {
  // Fixed-timestep accumulator for play mode physics
  let lastTime = null;

  function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const frameTime = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    if (state.mode === 'play' && state.playGame) {
      // Accumulate time for fixed-step physics
      state.playGame.accumulator = (state.playGame.accumulator || 0) + frameTime;

      const input = getInput();

      // Process shot if released and has power
      if (input.released && input.shotPower > 0 && !state.playGame.rolling) {
        const curvedPower = input.shotPower * input.shotPower;
        const actualPower = curvedPower * MAX_POWER;
        launchBall(state.playGame.ball, input.shotAngle, actualPower);
        state.playGame.strokes += 1;
        state.playGame.rolling = true;
        resetInput();
        state.fakeGame.input = {};
        state.fakeGame.state = 'rolling';
      } else if (!input.released) {
        // Mirror input into fakeGame so render.js draws the aim line
        state.fakeGame.input = input;
      }

      // Run fixed physics steps
      while (state.playGame.accumulator >= DT) {
        state.playGame.accumulator -= DT;

        if (state.playGame.rolling) {
          const courseWithTime = { ...state.wipHole, time: state.playGame.time };
          const result = stepBall(state.playGame.ball, courseWithTime, DT);
          state.playGame.time += DT;

          if (result.sunk) {
            showToast(`Sunk in ${state.playGame.strokes} stroke${state.playGame.strokes !== 1 ? 's' : ''}!`);
            // Reset ball to tee
            state.playGame.ball = {
              x: state.wipHole.tee.x,
              y: state.wipHole.tee.y,
              vx: 0,
              vy: 0,
            };
            state.playGame.strokes = 0;
            state.playGame.rolling = false;
            state.fakeGame.state = 'aiming';
          } else if (result.water) {
            state.playGame.strokes += 1;
            showToast('Water! +1 stroke, ball returned to tee.');
            state.playGame.ball = {
              x: state.wipHole.tee.x,
              y: state.wipHole.tee.y,
              vx: 0,
              vy: 0,
            };
            state.playGame.rolling = false;
            state.fakeGame.state = 'aiming';
          } else if (state.playGame.ball.vx === 0 && state.playGame.ball.vy === 0) {
            // Ball stopped
            state.playGame.rolling = false;
            state.fakeGame.state = 'aiming';
          }
        }
      }

      // Sync ball into fakeGame for render
      state.fakeGame.ball = state.playGame.ball;

      // Update play stats in sidebar
      const statsEl = document.getElementById('editor-play-stats');
      if (statsEl) {
        const par = state.wipHole.par || 3;
        statsEl.textContent = `Par: ${par} | Strokes: ${state.playGame.strokes}`;
      }
    } else {
      // Edit mode: no ball displayed
      state.fakeGame.ball = null;
      state.fakeGame.input = {};
    }

    state.fakeGame.currentHole = state.holeIndex;
    render(ctx, state.fakeGame, state.viewport, state.wipHole);

    if (state.mode === 'edit') {
      drawSelection(ctx, state);
      drawHandles(ctx, state);
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

async function save(state) {
  const statusEl = document.getElementById('editor-save-status');
  const saveBtn = document.getElementById('editor-save');

  state.saveStatus = 'saving';
  if (statusEl) {
    statusEl.textContent = 'Saving...';
    statusEl.className = 'editor-save-status saving';
  }
  if (saveBtn) saveBtn.disabled = true;

  try {
    const resp = await fetch(apiUrl(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-editor-key': state.editorKey,
      },
      body: JSON.stringify({
        holeIndex: state.holeIndex,
        hole: state.wipHole,
      }),
    });

    const data = await resp.json().catch(() => ({}));

    if (resp.ok) {
      state.saveStatus = 'success';
      state.pristineHole = deepClone(state.wipHole);
      if (statusEl) {
        statusEl.textContent = 'Saved! Deploy in ~60s';
        statusEl.className = 'editor-save-status success';
      }
      setTimeout(() => {
        if (state.saveStatus === 'success') {
          state.saveStatus = null;
          if (statusEl) {
            statusEl.textContent = '';
            statusEl.className = 'editor-save-status';
          }
        }
      }, 5000);
    } else {
      throw new Error(data.error || `HTTP ${resp.status}`);
    }
  } catch (err) {
    state.saveStatus = 'error';
    state.saveError = err.message;
    if (statusEl) {
      statusEl.textContent = 'Error: ' + err.message;
      statusEl.className = 'editor-save-status error';
    }
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function startEditor({ canvas, ctx, editParam }) {
  const editorKey = resolveEditorKey(editParam);
  if (!editorKey) {
    showKeyPrompt();
    return;
  }

  hideGameUI();

  // Store canvas reference for play mode initInput
  canvas_ref = canvas;

  const holeIndex = 0;
  const wipHole = deepClone(COURSES[holeIndex]);
  const pristineHole = deepClone(COURSES[holeIndex]);

  const state = {
    holeIndex,
    wipHole,
    pristineHole,
    selected: null,
    dragging: null,
    editorKey,
    saveStatus: null,
    saveError: '',
    viewport: { w: 0, h: 0, dpr: 1 },
    fakeGame: makeFakeGame(holeIndex),
    mode: 'edit',
    playGame: null,
  };

  // onChange triggers a sidebar refresh (not full rebuild)
  function onChange() {
    // In edit mode, keep fakeGame ball null (handles show instead of live ball)
    if (state.mode === 'play' && state.playGame) {
      // Ball is managed by play loop, don't clobber it
    } else {
      state.fakeGame.ball = null;
    }
    refreshSidebar(state, onChange);
  }

  buildSidebar(state, onChange);
  setupCanvas(canvas, ctx, state);
  setupPointerEvents(canvas, state, onChange);
  setupDeleteKey(state, onChange);
  startRenderLoop(canvas, ctx, state, onChange);
}
