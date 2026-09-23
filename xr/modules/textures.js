import * as THREE from 'three';
import { fitText } from './label.js';

/* Site surfaces, drawn on a canvas at load time.

   A construction site is texture: gravel, tyre tracks, saw-cut joints in a
   slab, plywood grain, hazard stripes, rust. Flat vertex colours cannot carry
   any of it, and shipping image files for the job would cost the site its
   "no build step, nothing to fetch" property — every one of these is a few
   hundred canvas operations that run once and then live in GPU memory.

   Everything is cached by key, because the same slab texture is on five
   compounds and the same ply is on every run of hoarding. Nothing sets
   `repeat` here for the same reason: a shared texture cannot carry a per-mesh
   tiling, so callers scale the UVs on their own geometry (`tileUV` in
   modules/props.js) and the texture stays reusable. */

const cache = new Map();

const hex = (c) => '#' + new THREE.Color(c).getHexString();

/** Deterministic noise, so the site looks the same on every load. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvasTex(key, w, h, draw, { srgb = true, clamp = false } = {}) {
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d'), w, h);

  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  // Decals clamp; surfaces repeat. A decal left on RepeatWrapping smears its
  // own opposite edge back across itself once anisotropy gets hold of it at a
  // grazing angle, which is the only angle a floor marking is ever seen at.
  tex.wrapS = tex.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

/** Scattered dots — the workhorse behind gravel, speckle and weathering. */
function speckle(ctx, w, h, rand, count, colors, rMin, rMax, alpha) {
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = alpha * (0.4 + rand() * 0.6);
    ctx.fillStyle = colors[(rand() * colors.length) | 0];
    const r = rMin + rand() * (rMax - rMin);
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* --- ground -------------------------------------------------------------- */

/** Compacted earth: haul-road dust, gravel, and the arcs plant tracks leave. */
export function earthTexture(pal) {
  return canvasTex('earth:' + pal.earth, 512, 512, (ctx, w, h) => {
    const rand = rng(20260821);
    ctx.fillStyle = hex(pal.earth);
    ctx.fillRect(0, 0, w, h);

    // Damp patches. Many and faint, not few and strong: a handful of dark
    // blobs on a tile that repeats every 9 m reads as a grid of blobs, which is
    // the one thing a dirt surface must never look like.
    for (let i = 0; i < 90; i++) {
      const x = rand() * w, y = rand() * h, r = 18 + rand() * 70;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, hex(pal.earthDark));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.05 + rand() * 0.06;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Tyre tracks: paired arcs, the way plant actually leaves them.
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const y0 = rand() * h, curve = (rand() - 0.5) * 200;
      ctx.globalAlpha = 0.07 + rand() * 0.06;
      ctx.strokeStyle = hex(pal.earthDark);
      for (const off of [-9, 9]) {
        ctx.lineWidth = 5 + rand() * 4;
        ctx.beginPath();
        ctx.moveTo(-20, y0 + off);
        ctx.quadraticCurveTo(w / 2, y0 + off + curve, w + 20, y0 + off + curve * 0.3);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    speckle(ctx, w, h, rand, 2600, [hex(pal.gravel), hex(pal.earthDark), '#7d7361'], 0.6, 2.4, 0.5);
  });
}

/** A poured slab: float finish, saw-cut control joints, rebar-stain freckles. */
export function concreteTexture(pal) {
  return canvasTex('concrete:' + pal.concrete, 512, 512, (ctx, w, h) => {
    const rand = rng(7731);
    ctx.fillStyle = hex(pal.concrete);
    ctx.fillRect(0, 0, w, h);

    // Same rule as the dirt: many faint stains rather than a few strong ones,
    // or the slab reads as a repeat rather than as concrete.
    for (let i = 0; i < 70; i++) {
      const x = rand() * w, y = rand() * h, r = 20 + rand() * 70;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, hex(pal.concreteJoint));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.045;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Control joints on the tile edges: they line up across repeats into a grid.
    ctx.strokeStyle = hex(pal.concreteJoint);
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(0.5, 0); ctx.lineTo(0.5, h);
    ctx.moveTo(0, 0.5); ctx.lineTo(w, 0.5);
    ctx.stroke();
    ctx.globalAlpha = 1;

    speckle(ctx, w, h, rand, 1500, [hex(pal.concreteJoint), hex(pal.gravel)], 0.5, 1.8, 0.32);
    speckle(ctx, w, h, rand, 40, [hex(pal.rust)], 1.5, 4, 0.22);
  });
}

/** Haul road: rolled asphalt, coarse and scuffed. */
export function asphaltTexture(pal) {
  return canvasTex('asphalt:' + pal.asphalt, 256, 256, (ctx, w, h) => {
    const rand = rng(4519);
    ctx.fillStyle = hex(pal.asphalt);
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, rand, 1800, ['#8c8f90', '#4b4e50', '#a2a5a4'], 0.5, 1.9, 0.35);
    speckle(ctx, w, h, rand, 90, [hex(pal.earth)], 2, 6, 0.18);
  });
}

/* --- built things -------------------------------------------------------- */

/** Site hoarding: plywood sheets, grain, seams and fixings. */
export function plywoodTexture(pal) {
  return canvasTex('ply:' + pal.ply, 512, 256, (ctx, w, h) => {
    const rand = rng(9012);
    ctx.fillStyle = hex(pal.ply);
    ctx.fillRect(0, 0, w, h);

    // Grain: long, low-contrast horizontal strokes.
    for (let i = 0; i < 200; i++) {
      const y = rand() * h;
      ctx.globalAlpha = 0.05 + rand() * 0.09;
      ctx.strokeStyle = rand() > 0.5 ? hex(pal.plyGrain) : '#ffffff';
      ctx.lineWidth = 0.6 + rand() * 1.8;
      ctx.beginPath();
      ctx.moveTo(-10, y);
      ctx.bezierCurveTo(w * 0.3, y + (rand() - 0.5) * 7, w * 0.7, y + (rand() - 0.5) * 7, w + 10, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Sheet seam down the tile edge, plus fixings either side of it.
    ctx.fillStyle = hex(pal.plyGrain);
    ctx.globalAlpha = 0.55;
    ctx.fillRect(0, 0, 3, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (let y = 16; y < h; y += 48) {
      ctx.beginPath(); ctx.arc(9, y, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w - 9, y, 2, 0, Math.PI * 2); ctx.fill();
    }

    // Weather streaks running down from the top edge.
    for (let i = 0; i < 22; i++) {
      ctx.globalAlpha = 0.05 + rand() * 0.07;
      ctx.fillStyle = hex(pal.plyGrain);
      ctx.fillRect(rand() * w, 0, 1 + rand() * 4, 30 + rand() * (h * 0.7));
    }
    ctx.globalAlpha = 1;
  });
}

/** Diagonal hazard stripes. */
export function hazardTexture(pal) {
  return canvasTex('hazard:' + pal.hazard, 128, 64, (ctx, w, h) => {
    ctx.fillStyle = hex(pal.hazard);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = hex(pal.hazardInk);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    for (let x = -h; x < w + h; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x + 16, 0);
      ctx.lineTo(x + 16 + h, h); ctx.lineTo(x + h, h);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // Scuffed, not printed yesterday.
    const rand = rng(3311);
    speckle(ctx, w, h, rand, 160, ['#8a8478', '#ffffff'], 0.4, 1.4, 0.16);
  });
}

/**
 * The printed band on a run of hoarding — the scheme graphic a city site wraps
 * itself in.
 *
 * One 12 m x 3 m sheet, repeated along the run, which is how the real thing is
 * printed and why one texture can serve every length. The long tile matters:
 * at 6 m the wordmark came round three times on a single run of hoarding and
 * the site started shouting its own name.
 *
 * `kind` is 'identity' (the project, in the compound's colour, on the face that
 * looks out at the rest of the site), 'zone' (the yard's own name, on inward
 * runs the boards left bare) or 'safety' (the PPE notice).
 */
export function hoardingBandTexture(pal, zone, kind = 'identity') {
  const accent = zone.accent;
  // The safety notice does not use the accent, so it must not be keyed on it —
  // otherwise five compounds get five byte-identical 1.5 Mpx textures. The yard
  // band carries a name, so it keys on the yard rather than on the colour.
  const key = kind === 'safety' ? `band:safety:${pal.night}`
    : kind === 'zone' ? `band:zone:${zone.code}:${pal.night}`
      : `band:identity:${accent}:${pal.night}`;
  return canvasTex(key, 1536, 384, (ctx, w, h) => {
    const FONT = '"Source Sans 3", system-ui, sans-serif';

    /* A run of hazard chevrons, clipped to a strip. */
    const chevron = (y, hgt) => {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, y, w, hgt); ctx.clip();
      ctx.fillStyle = hex(pal.hazard);
      ctx.fillRect(0, y, w, hgt);
      ctx.fillStyle = hex(pal.hazardInk);
      for (let x = -hgt; x < w + hgt; x += hgt * 2.4) {
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + hgt * 1.2, y);
        ctx.lineTo(x + hgt * 1.2 + hgt, y + hgt); ctx.lineTo(x + hgt, y + hgt);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    };

    /* PPE roundels: helmet, vest, boot. Drawn as shapes, not glyphs, because a
       font that happens to be missing would leave three empty circles. */
    const roundels = (cx0, cy, r, step) => {
      [0, 1, 2].forEach((i) => {
        const cx = cx0 + i * step;
        ctx.fillStyle = '#0b60a8';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        if (i === 0) {
          ctx.ellipse(cx, cy + 5, 23, 18, 0, Math.PI, 0);
          ctx.rect(cx - 29, cy + 3, 58, 7);
        } else if (i === 1) {
          ctx.moveTo(cx - 20, cy - 18); ctx.lineTo(cx + 20, cy - 18);
          ctx.lineTo(cx + 20, cy + 20); ctx.lineTo(cx - 20, cy + 20);
          ctx.closePath();
        } else {
          ctx.moveTo(cx - 18, cy - 20); ctx.lineTo(cx - 3, cy - 20);
          ctx.lineTo(cx - 3, cy + 6); ctx.lineTo(cx + 21, cy + 15);
          ctx.lineTo(cx + 21, cy + 21); ctx.lineTo(cx - 18, cy + 21);
          ctx.closePath();
        }
        ctx.fill();
      });
    };

    if (kind === 'safety') {
      ctx.fillStyle = pal.night ? '#1c2426' : '#f2efe6';
      ctx.fillRect(0, 0, w, h);
      chevron(0, 33); chevron(h - 33, 33);

      roundels(142, h / 2, 39, 142);

      ctx.fillStyle = pal.night ? '#e6ecec' : '#22282a';
      ctx.textAlign = 'left';
      ctx.font = `700 63px ${FONT}`;
      ctx.letterSpacing = '3px';
      ctx.fillText('HARD HAT & HI-VIS AREA', 465, 188);
      ctx.font = `600 30px ${FONT}`;
      ctx.letterSpacing = '1.5px';
      ctx.globalAlpha = 0.72;
      ctx.fillText('ALL VISITORS REPORT TO THE SITE OFFICE', 465, 237);
      ctx.globalAlpha = 1;
      ctx.letterSpacing = '0px';
      return;
    }

    if (kind === 'zone') {
      const base = new THREE.Color(accent).multiplyScalar(pal.night ? 0.38 : 0.88);
      ctx.fillStyle = '#' + base.getHexString();
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 2;
      for (let x = 0; x <= w; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y <= h; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

      chevron(0, 26); chevron(h - 26, 26);

      // The plan reference, sized to be read from the far corner of a 24 m yard
      // rather than from arm's length.
      const plate = 176, plateX = 72, plateY = (h - plate) / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillRect(plateX, plateY, plate, plate);
      ctx.fillStyle = '#' + base.getHexString();
      ctx.font = `700 122px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(zone.code, plateX + plate / 2, plateY + plate / 2 + 4);

      // Names run from four characters to twelve, so both the name and the line
      // under it condense to the plank rather than running off the end of it.
      const tx = plateX + plate + 48, room = w - tx - 72;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#ffffff';

      ctx.letterSpacing = '5px';
      ctx.fillText(fitText(ctx, zone.label.toUpperCase(), room, 118, 48, 3)[0], tx, h / 2 + 8);
      ctx.fillRect(tx, h / 2 + 30, Math.min(room, 430), 4);

      ctx.letterSpacing = '2px';
      ctx.globalAlpha = 0.82;
      ctx.fillText(fitText(ctx, zone.blurb.toUpperCase(), room, 36, 18, 1)[0], tx, h / 2 + 88);
      ctx.globalAlpha = 1;
      ctx.letterSpacing = '0px';
      return;
    }

    const base = new THREE.Color(accent).multiplyScalar(pal.night ? 0.42 : 0.92);
    ctx.fillStyle = '#' + base.getHexString();
    ctx.fillRect(0, 0, w, h);

    // A faint blueprint grid over the field, so a long run is not flat colour.
    ctx.strokeStyle = 'rgba(255,255,255,0.075)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= w; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y <= h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    // A ghosted elevation over the right-hand half — the thing being built,
    // drawn the way a scheme board draws it, and the reason the tile can be
    // long without going empty.
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.20)';
    ctx.lineWidth = 3;
    const bx = 885, by = h - 59;
    const storeys = [
      [0, 225, 129], [240, 165, 168], [420, 195, 99], [630, 143, 147],
    ];
    for (const [ox, bw, bh] of storeys) {
      ctx.strokeRect(bx + ox, by - bh, bw, bh);
      const floors = Math.max(2, Math.round(bh / 33));
      for (let f = 1; f < floors; f++) {
        const y = by - (bh * f) / floors;
        ctx.beginPath(); ctx.moveTo(bx + ox, y); ctx.lineTo(bx + ox + bw, y); ctx.stroke();
      }
    }
    ctx.beginPath(); ctx.moveTo(bx - 30, by); ctx.lineTo(w, by); ctx.stroke();
    ctx.restore();

    chevron(h - 38, 38);

    // Monogram plate, then the name and what the project is.
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.fillRect(54, 96, 99, 99);
    ctx.fillStyle = '#' + base.getHexString();
    ctx.font = `700 56px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('IG', 104, 165);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 69px ${FONT}`;
    ctx.letterSpacing = '4px';
    ctx.fillText('IRFAN GAZI', 180, 155);
    ctx.fillRect(180, 176, 322, 3);
    ctx.font = `600 29px ${FONT}`;
    ctx.letterSpacing = '2px';
    ctx.globalAlpha = 0.88;
    ctx.fillText('CONSTRUCTION ENGINEERING & MANAGEMENT', 180, 222);
    ctx.font = `400 26px ${FONT}`;
    ctx.globalAlpha = 0.7;
    ctx.fillText('UNIVERSITY OF NEBRASKA-LINCOLN', 180, 260);
    ctx.globalAlpha = 1;
    ctx.letterSpacing = '0px';
  });
}

/** Chain-link: an alpha map of a diamond mesh. */
export function chainLinkTexture() {
  return canvasTex('chainlink', 128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'square';
    for (let i = -h; i < w + h; i += 22) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i, h); ctx.lineTo(i + h, 0); ctx.stroke();
    }
  }, { srgb: false });
}

/** Container / cabin cladding: vertical corrugated ribs with weathering. */
export function corrugatedTexture(color, seed = 55) {
  return canvasTex('corrugated:' + color, 256, 256, (ctx, w, h) => {
    const rand = rng(seed);
    const base = new THREE.Color(color);
    for (let x = 0; x < w; x += 16) {
      const g = ctx.createLinearGradient(x, 0, x + 16, 0);
      const lo = base.clone().multiplyScalar(0.68);
      const hi = base.clone().multiplyScalar(1.16);
      g.addColorStop(0, '#' + lo.getHexString());
      g.addColorStop(0.45, '#' + hi.getHexString());
      g.addColorStop(1, '#' + lo.getHexString());
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 16, h);
    }
    // Rust creeping up from the bottom rail.
    for (let i = 0; i < 28; i++) {
      ctx.globalAlpha = 0.05 + rand() * 0.13;
      ctx.fillStyle = '#8d5a34';
      const x = rand() * w, ht = 8 + rand() * 46;
      ctx.fillRect(x, h - ht, 2 + rand() * 7, ht);
    }
    ctx.globalAlpha = 1;
  });
}

/** Galvanised steel with a little weathering — tubes, decking, plant bodies. */
export function steelTexture(pal) {
  return canvasTex('steel:' + pal.steel, 256, 256, (ctx, w, h) => {
    const rand = rng(661);
    ctx.fillStyle = hex(pal.steel);
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, rand, 900, [hex(pal.steelDark), '#ffffff'], 0.5, 2.6, 0.16);
    speckle(ctx, w, h, rand, 70, [hex(pal.rust)], 1.5, 5.5, 0.20);
  });
}

/** Profiled metal decking — the floors of a frame that has no slab yet. */
export function deckingTexture(pal) {
  return canvasTex('decking:' + pal.steel, 128, 128, (ctx, w, h) => {
    ctx.fillStyle = hex(pal.steel);
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = hex(pal.steelDark);
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x, 0, 6, h);
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 8, 0, 4, h);
    }
    ctx.globalAlpha = 1;
  });
}

/* --- wayfinding ---------------------------------------------------------- */

/**
 * A painted floor marking: an arrow, a compound code, and where it goes.
 *
 * The doorways are already signed overhead (`gateSign` in modules/site.js), so
 * this is not new information — it is the same information at a range where the
 * lintel sign is a smudge. You read a floor from right across a slab while
 * walking toward it, which is exactly when you need to know which way the Plan
 * Room is.
 *
 * Drawn pointing at the top of the canvas. Whoever places it is responsible for
 * turning it: on a plane laid flat, the top of the canvas ends up facing -Z.
 */
export function wayfindingArrowTexture(pal, accent, code, label) {
  return canvasTex(`arrow:${accent}:${code}:${label}:${pal.night}`, 512, 256, (ctx, w, h) => {
    const FONT = '"Source Sans 3", system-ui, sans-serif';
    const rand = rng(5501);

    // Site paint is thick and bright, and at night it is the only thing on the
    // slab catching the floodlights — so it lifts rather than dims.
    const paint = new THREE.Color(accent).multiplyScalar(pal.night ? 1.5 : 1.06);
    const ink = '#' + paint.getHexString();

    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = pal.night ? 0.95 : 0.88;
    ctx.fillStyle = ink;

    // The arrow: a stubby shaft under a wide head, the proportions a floor
    // marking uses rather than the proportions an icon uses.
    const cx = w / 2;
    ctx.beginPath();
    ctx.moveTo(cx, 12);
    ctx.lineTo(cx + 62, 78);
    ctx.lineTo(cx + 26, 78);
    ctx.lineTo(cx + 26, 122);
    ctx.lineTo(cx - 26, 122);
    ctx.lineTo(cx - 26, 78);
    ctx.lineTo(cx - 62, 78);
    ctx.closePath();
    ctx.fill();

    // Code plate, then the destination. Both sit below the arrow, so they are
    // the near half as you walk up to it.
    const plate = 54;
    const py = 150;
    ctx.fillRect(28, py, plate, plate);
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.night ? '#12181a' : '#fdfcf8';
    ctx.font = `700 40px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(code, 28 + plate / 2, py + plate / 2 + 2);

    ctx.globalAlpha = pal.night ? 0.95 : 0.88;
    ctx.fillStyle = ink;
    ctx.textAlign = 'left';
    // Long names have to fit the same plank as short ones, so the type
    // condenses to the width rather than running off the end of the paint.
    ctx.letterSpacing = '3px';
    ctx.fillText(fitText(ctx, label.toUpperCase(), w - 118, 44, 20)[0], 98, py + plate / 2 + 2);
    ctx.letterSpacing = '0px';
    ctx.globalAlpha = 1;

    // Chip the paint. Traffic wears a marking from the inside out, and cutting
    // holes in it reads as worn where scattering grey dots over it reads as
    // dirty glass.
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 220; i++) {
      ctx.globalAlpha = 0.05 + rand() * 0.35;
      const r = 1 + rand() * 5;
      ctx.beginPath();
      ctx.arc(rand() * w, rand() * h, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }, { clamp: true });
}
