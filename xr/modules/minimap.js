import { ZONES, SITE_HALF } from '../data/cv.js';
import { getPalette } from './theme.js';

/* The site plan in the corner.

   A plus-shaped cluster inside a much larger fenced site is easy to get lost in
   the moment you walk out through a gate, and the ground outside the compounds
   deliberately has no walls to navigate by. This is the cheapest fix: the same
   plan a site office would have pinned up, with you on it.

   It is also a control: `hitTest` turns a click on a compound into the compound
   it landed on, and main.js walks you there. That stays a pointer-only
   shortcut — a canvas has nothing a keyboard can reach — so the jump list in
   the overlay is the real route to the same thing, and this is the fast one. */

export function createMinimap(canvas) {
  const pal = getPalette();
  const dpr = Math.min(window.devicePixelRatio, 2);
  const size = canvas.clientWidth || 138;
  canvas.width = size * dpr;
  canvas.height = size * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const pad = 9;
  const scale = (size - pad * 2) / (SITE_HALF * 2);
  const sx = (x) => pad + (x + SITE_HALF) * scale;
  const sz = (z) => pad + (z + SITE_HALF) * scale;

  const hex = (c) => '#' + c.toString(16).padStart(6, '0');

  /** Which compound a page-space point lands on, or null. */
  function hitTest(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    // The canvas is drawn at `size` CSS pixels but styled smaller on a phone,
    // so go through the rect rather than assuming the two agree.
    const x = ((clientX - rect.left) / rect.width) * size;
    const y = ((clientY - rect.top) / rect.height) * size;
    const wx = (x - pad) / scale - SITE_HALF;
    const wz = (y - pad) / scale - SITE_HALF;
    for (const zn of ZONES) {
      const b = zn.bounds;
      if (wx >= b.minX && wx <= b.maxX && wz >= b.minZ && wz <= b.maxZ) return zn.id;
    }
    return null;
  }

  function draw(px, pz, yaw, currentZoneId, hoverId) {
    ctx.clearRect(0, 0, size, size);

    // The perimeter fence, dashed the way a boundary is drawn on a plan.
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = pal.labelMute;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.strokeRect(sx(-SITE_HALF), sz(-SITE_HALF), SITE_HALF * 2 * scale, SITE_HALF * 2 * scale);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    for (const zn of ZONES) {
      const b = zn.bounds;
      const here = zn.id === currentZoneId;
      const over = zn.id === hoverId;
      const x = sx(b.minX), y = sz(b.minZ);
      const w = (b.maxX - b.minX) * scale, h = (b.maxZ - b.minZ) * scale;

      ctx.fillStyle = hex(zn.accent);
      ctx.globalAlpha = here ? 0.46 : (over ? 0.34 : 0.16);
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = here || over ? 0.95 : 0.42;
      ctx.strokeStyle = hex(zn.accent);
      ctx.lineWidth = here || over ? 1.7 : 1;
      ctx.strokeRect(x, y, w, h);

      ctx.globalAlpha = here || over ? 1 : 0.6;
      ctx.fillStyle = hex(zn.accent);
      ctx.font = '700 8px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(zn.code, x + w / 2, y + h / 2);
    }
    ctx.globalAlpha = 1;

    // North arrow, because everything else on this plan is square.
    ctx.fillStyle = pal.labelMute;
    ctx.font = '700 8px ui-monospace, monospace';
    ctx.fillText('N', size - pad - 3, pad + 8);
    ctx.beginPath();
    ctx.moveTo(size - pad - 3, pad - 1);
    ctx.lineTo(size - pad - 6, pad + 4);
    ctx.lineTo(size - pad, pad + 4);
    ctx.closePath();
    ctx.fill();

    // The player: a triangle pointing where the camera faces.
    const x = sx(px), y = sz(pz);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-yaw);   // camera yaw PI faces +Z, which is down the plan
    ctx.beginPath();
    ctx.moveTo(0, -5.5); ctx.lineTo(3.6, 4); ctx.lineTo(-3.6, 4);
    ctx.closePath();
    ctx.fillStyle = pal.labelInk;
    ctx.fill();
    ctx.strokeStyle = pal.labelBg;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  return { draw, hitTest };
}
