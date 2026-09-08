import * as THREE from 'three';
import { getPalette } from './theme.js';

/* Canvas-drawn text baked into a texture: board captions, gate signage, and the
   face of a board whose image has not arrived.

   Text in the world is for orientation only — anything a visitor actually has
   to read lives in the DOM panel, where it can be selected, zoomed and read by
   a screen reader. So these are styled the way a site labels things rather
   than the way a page does: title blocks, stencilled signs, tape. */

const FONT = '"Source Sans 3", system-ui, -apple-system, "Segoe UI", sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

function wrap(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function texFromCanvas(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

const hex = (c) => '#' + new THREE.Color(c).getHexString();

/**
 * The title block under a board: a drawing-sheet strip with a rule in the
 * compound's accent, a monospaced reference line, and the wrapped title.
 * Returns a mesh `width` metres across, height derived from the text.
 */
export function captionPlate(title, venue, width, accent, opts = {}) {
  const pal = getPalette();
  const PX = 256;                    // pixels per metre
  const w = Math.round(width * PX);
  const pad = 24;
  const titleSize = opts.titleSize || 33;
  const venueSize = 19;

  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `600 ${titleSize}px ${FONT}`;
  const lines = wrap(measure, title, w - pad * 2);

  const venueH = venue ? venueSize + 14 : 0;
  const h = pad * 2 + 6 + venueH + lines.length * (titleSize + 8);

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = Math.round(h);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = pal.labelBg;
  ctx.fillRect(0, 0, w, h);

  // Accent rule across the top, and a hairline box round the whole plate —
  // between them the plate reads as a drawn sheet rather than a floating label.
  ctx.fillStyle = hex(accent);
  ctx.fillRect(0, 0, w, 6);
  ctx.strokeStyle = pal.labelRule;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);

  let y = pad + 6;
  if (venue) {
    ctx.font = `700 ${venueSize}px ${MONO}`;
    ctx.fillStyle = pal.labelMute;
    ctx.letterSpacing = '1.5px';
    ctx.fillText(String(venue).toUpperCase(), pad, y + venueSize);
    ctx.letterSpacing = '0px';
    y += venueH;
  }
  ctx.font = `600 ${titleSize}px ${FONT}`;
  ctx.fillStyle = pal.labelInk;
  for (const l of lines) { y += titleSize; ctx.fillText(l, pad, y); y += 8; }

  const mat = new THREE.MeshBasicMaterial({ map: texFromCanvas(canvas), transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, h / PX), mat);
  mesh.userData.plateHeight = h / PX;
  return mesh;
}

/**
 * A gate sign: a hazard-banded board naming the compound you are walking into,
 * with its plan reference stencilled beside it.
 */
export function gateSign(label, code, width, accent) {
  const pal = getPalette();
  const PX = 120;
  const w = Math.round(width * PX);
  const h = Math.round(w * 0.26);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  const band = Math.max(6, h * 0.11);
  ctx.fillStyle = pal.labelBg;
  ctx.fillRect(0, 0, w, h);

  // Hazard stripes top and bottom.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, band); ctx.rect(0, h - band, w, band);
  ctx.clip();
  ctx.fillStyle = hex(pal.hazard);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = hex(pal.hazardInk);
  for (let x = -h; x < w + h; x += band * 3.2) {
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x + band * 1.6, 0);
    ctx.lineTo(x + band * 1.6 + h, h); ctx.lineTo(x + h, h);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // Plan reference in a filled square, then the compound name.
  const boxSize = h - band * 2 - 14;
  const bx = 14, by = band + 7;
  ctx.fillStyle = hex(accent);
  ctx.fillRect(bx, by, boxSize, boxSize);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(boxSize * 0.66)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(code, bx + boxSize / 2, by + boxSize / 2 + 1);

  ctx.textAlign = 'left';
  ctx.fillStyle = pal.labelInk;
  ctx.font = `700 ${Math.round(h * 0.36)}px ${FONT}`;
  ctx.letterSpacing = '2px';
  ctx.fillText(String(label).toUpperCase(), bx + boxSize + 18, h / 2 + 1);
  ctx.letterSpacing = '0px';

  const mat = new THREE.MeshBasicMaterial({ map: texFromCanvas(canvas), transparent: true });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, (h / w) * width), mat);
}

/**
 * A stencilled safety notice — the yellow-on-black boards bolted to every
 * hoarding. Used for the main gate and for dressing.
 */
export function noticeBoard(lines, width, opts = {}) {
  const pal = getPalette();
  const PX = 120;
  const w = Math.round(width * PX);
  const h = Math.round(w * (opts.ratio || 0.72));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = opts.bg || hex(pal.hazard);
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = hex(pal.hazardInk);
  ctx.lineWidth = Math.max(4, w * 0.02);
  ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, w - ctx.lineWidth * 2, h - ctx.lineWidth * 2);

  ctx.fillStyle = opts.ink || hex(pal.hazardInk);
  ctx.textAlign = 'center';
  const step = h / (lines.length + 1);
  lines.forEach((line, i) => {
    const size = i === 0 ? step * 0.62 : step * 0.42;
    ctx.font = `700 ${Math.round(size)}px ${FONT}`;
    ctx.letterSpacing = '1.5px';
    ctx.fillText(String(line).toUpperCase(), w / 2, step * (i + 1) + size * 0.34);
  });
  ctx.letterSpacing = '0px';

  const mat = new THREE.MeshBasicMaterial({ map: texFromCanvas(canvas) });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, (h / w) * width), mat);
}

/** Trim a string to fit `max` pixels, with an ellipsis if it had to be cut. */
function clip(ctx, text, max) {
  let t = String(text);
  if (ctx.measureText(t).width <= max) return t;
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t.replace(/[\s,;:.\-]+$/, '') + '…';
}

/**
 * The face of a board that has no photograph — which is most of them.
 *
 * Rather than a blank sheet with a title on it, this prints what the entry
 * actually holds: the dates and headlines of a news list, the columns of a
 * skills table, the periods of a position. Sixteen of the twenty-four boards
 * on this site are text entries, and if they render as empty white rectangles
 * the yards look unfinished no matter how good the hoarding is.
 *
 * Everything is derived from the entry, so adding a row in cv.js changes the
 * board. Content is clipped, never shrunk to fit: a sheet you can read from
 * four metres away with three of seven items on it beats all seven at a size
 * that needs the DOM panel anyway — which is what pressing E is for.
 */
export function sheetFace(ex, w, h, accent) {
  const pal = getPalette();
  const PX = 220;
  const cw = Math.round(w * PX), ch = Math.round(h * PX);
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext('2d');
  const ink = pal.labelInk, mute = pal.labelMute;

  const pad = Math.round(cw * 0.055);
  const S = (k) => Math.round(cw * k);

  ctx.fillStyle = pal.labelBg;
  ctx.fillRect(0, 0, cw, ch);

  // Faint drawing grid, so the sheet reads as a sheet and not as paper.
  ctx.strokeStyle = pal.labelRule;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.28;
  for (let x = 40; x < cw; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke(); }
  for (let y = 40; y < ch; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke(); }
  ctx.globalAlpha = 1;

  /* Header band in the compound's colour, carrying the venue or period. */
  const bandH = Math.max(S(0.075), 30);
  ctx.fillStyle = hex(accent);
  ctx.fillRect(0, 0, cw, bandH);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${S(0.03)}px ${MONO}`;
  ctx.letterSpacing = '2px';
  ctx.fillText(clip(ctx, String(ex.venue || ex.kind || '').toUpperCase(), cw - pad * 2), pad, bandH / 2 + 1);
  ctx.letterSpacing = '0px';
  ctx.textBaseline = 'alphabetic';

  /* Title, up to three lines. */
  let y = bandH + S(0.075);
  const titleSize = S(0.062);
  ctx.font = `700 ${titleSize}px ${FONT}`;
  ctx.fillStyle = ink;
  const tLines = wrap(ctx, ex.title, cw - pad * 2).slice(0, 3);
  for (const l of tLines) { ctx.fillText(clip(ctx, l, cw - pad * 2), pad, y); y += titleSize * 1.18; }

  ctx.fillStyle = hex(accent);
  ctx.fillRect(pad, y - titleSize * 0.3, S(0.14), Math.max(3, S(0.008)));
  y += S(0.05);

  /* Body. Whatever shape the entry happens to be, laid out in two columns
     where it has two and one where it does not. */
  const footY = ch - S(0.062);
  const bodySize = S(0.034);
  const lead = bodySize * 1.42;
  const keyW = Math.round((cw - pad * 2) * 0.30);
  const rest = cw - pad * 2 - keyW - S(0.022);
  const room = () => footY - S(0.03) - y;

  const rows = ex.list || ex.pairs
    || (ex.rows && ex.rows.map(([a, b]) => [b, a]))
    || null;

  let shown = 0, total = 0;
  if (rows) {
    total = rows.length;
    const mono = ex.list || ex.rows;
    for (const [k, v] of rows) {
      if (room() < lead) break;
      ctx.font = mono ? `600 ${Math.round(bodySize * 0.88)}px ${MONO}` : `700 ${bodySize}px ${FONT}`;
      ctx.fillStyle = mono ? hex(accent) : ink;
      ctx.fillText(clip(ctx, k, keyW), pad, y);

      ctx.font = `400 ${bodySize}px ${FONT}`;
      ctx.fillStyle = mute;
      ctx.fillText(clip(ctx, v, rest), pad + keyW + S(0.022), y);
      y += lead;
      shown++;
    }
  } else if (ex.body) {
    ctx.font = `400 ${bodySize}px ${FONT}`;
    ctx.fillStyle = mute;
    const lines = wrap(ctx, ex.body.join(' '), cw - pad * 2);
    for (let i = 0; i < lines.length; i++) {
      if (room() < lead) break;
      const last = room() < lead * 2 && i < lines.length - 1;
      ctx.fillText(last ? clip(ctx, lines[i] + ' …', cw - pad * 2) : lines[i], pad, y);
      y += lead;
    }
  }

  if (rows && shown < total) {
    ctx.font = `600 ${Math.round(bodySize * 0.9)}px ${FONT}`;
    ctx.fillStyle = hex(accent);
    ctx.fillText(`+ ${total - shown} more`, pad, Math.min(y, footY - S(0.02)));
  } else if (ex.links && ex.links.length && room() > lead) {
    // Contact-style entries carry links and nothing else; print them as chips
    // so the board has something on it besides one sentence.
    ctx.font = `600 ${Math.round(bodySize * 0.92)}px ${FONT}`;
    let cx = pad;
    const chipH = Math.round(bodySize * 1.7);
    for (const l of ex.links) {
      const tw = ctx.measureText(l.label).width;
      if (cx + tw + S(0.05) > cw - pad) { cx = pad; y += chipH + S(0.014); }
      if (room() < chipH) break;
      ctx.fillStyle = hex(accent);
      ctx.globalAlpha = 0.14;
      ctx.fillRect(cx, y - chipH * 0.72, tw + S(0.04), chipH);
      ctx.globalAlpha = 1;
      ctx.fillText(l.label, cx + S(0.02), y);
      cx += tw + S(0.05) + S(0.014);
    }
  }

  /* Sheet footer: a rule, the reference, and what to do about it. */
  ctx.strokeStyle = pal.labelRule;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(pad, footY); ctx.lineTo(cw - pad, footY); ctx.stroke();
  ctx.font = `600 ${S(0.026)}px ${MONO}`;
  ctx.fillStyle = mute;
  ctx.letterSpacing = '1px';
  ctx.fillText(String(ex.id).toUpperCase(), pad, footY + S(0.042));
  ctx.textAlign = 'right';
  ctx.fillText('PRESS E', cw - pad, footY + S(0.042));
  ctx.textAlign = 'left';
  ctx.letterSpacing = '0px';

  return new THREE.MeshBasicMaterial({ map: texFromCanvas(canvas) });
}

/**
 * The face of a board with no image — a drawing sheet with the title set on it,
 * rather than a grey rectangle.
 *
 * The venue deliberately does not appear: the title block bolted underneath
 * already carries it, and printing it twice a hand's width apart just reads as
 * a mistake.
 */
export function placeholderFace(title, venue, w, h, accent) {
  const pal = getPalette();
  const PX = 200;
  const cw = Math.round(w * PX), ch = Math.round(h * PX);
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = pal.labelBg;
  ctx.fillRect(0, 0, cw, ch);

  // Faint drawing grid, so an empty sheet still reads as a sheet.
  ctx.strokeStyle = pal.labelRule;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.35;
  for (let x = 40; x < cw; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke(); }
  for (let y = 40; y < ch; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke(); }
  ctx.globalAlpha = 1;

  ctx.fillStyle = hex(accent);
  ctx.fillRect(0, 0, cw, 12);

  const pad = Math.round(cw * 0.075);
  ctx.font = `700 ${Math.round(cw * 0.075)}px ${FONT}`;
  const lines = wrap(ctx, title, cw - pad * 2);
  const step = Math.round(cw * 0.092);

  // Set from the middle of the sheet, so short and long titles both sit well.
  let y = (ch - lines.length * step) / 2 + step * 0.72;
  ctx.fillStyle = pal.labelInk;
  for (const l of lines) { ctx.fillText(l, pad, y); y += step; }

  ctx.fillStyle = hex(accent);
  ctx.fillRect(pad, (ch - lines.length * step) / 2 - step * 0.5, Math.round(cw * 0.16), 7);

  return new THREE.MeshBasicMaterial({ map: texFromCanvas(canvas) });
}
