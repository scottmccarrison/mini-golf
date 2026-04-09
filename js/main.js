// Mini Golf - main entry point
// Placeholder canvas rendering until game logic is implemented.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const viewport = { w: 0, h: 0, dpr: 1 };

function resize() {
  const dpr = window.devicePixelRatio || 1;
  viewport.dpr = dpr;
  viewport.w = window.innerWidth;
  viewport.h = window.innerHeight;
  canvas.width = Math.floor(viewport.w * dpr);
  canvas.height = Math.floor(viewport.h * dpr);
  canvas.style.width = viewport.w + 'px';
  canvas.style.height = viewport.h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function draw() {
  const { w, h } = viewport;

  // Green fairway background
  ctx.fillStyle = '#2d8a4e';
  ctx.fillRect(0, 0, w, h);

  // Title text centered
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.min(48, w / 8)}px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MINI GOLF', w / 2, h / 2);

  // Subtle subtitle
  ctx.font = `${Math.min(18, w / 22)}px -apple-system, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('loading...', w / 2, h / 2 + Math.min(48, w / 8) * 0.9);
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

// iOS Safari ignores user-scalable=no on double-tap zoom.
// Block the second tap when it lands within 350ms of the first.
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd < 350) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

// Block pinch-zoom gestures.
document.addEventListener('gesturestart', (e) => e.preventDefault());
