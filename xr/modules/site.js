import * as THREE from 'three';
import { ZONES, EXHIBITS, DOOR_WIDTH, GATE_WIDTH, WALL_HEIGHT, SITE_HALF } from '../data/cv.js';
import { gateSign, noticeBoard } from './label.js';
import { wayfindingArrowTexture } from './textures.js';
import {
  siteMaterials, tileUV, instancer, shade, chainLinkRun, towerCrane, steelFrame,
  scaffoldTower, shippingContainer, siteCabin, excavator, dumpTruck, mixerTruck,
  rebarBundle, pipeStack, blockPallet, lumberStack, cableReel, spoilPile,
  cones, barriers, drums, surveyStakes, floodlightMast, skyline,
  planTable, surveyTripod,
} from './props.js';

/* The site plan, built from ZONES, plus everything outside the compounds.

   Hoarding, not walls. Each run is a concrete plinth carrying plywood panels
   between steel uprights, capped with a hazard band — so it is tall enough to
   carry a 3 m board, but there is no ceiling above it and no room behind it.
   Look over it from the follow camera and you see the rest of the site.

   Openings come in two sizes: `door` is an internal opening between compounds,
   `gate` is the outer gate a compound puts onto the wider site. Both are cut
   out of the run and signed. */

const PLINTH_H = 0.55;    // concrete kicker at the base of every run
const PLINTH_T = 0.52;    // and its thickness — this is what you collide with
const PANEL_T = 0.20;     // the plywood face the boards bolt to
const BAND_H = 0.45;      // hazard band along the top
const POST_STEP = 2.4;
const OPENING_H = 3.6;    // headroom under a lintel — well over head height
const INSET = 2.6;        // how far the painted edge line sits off the hoarding
const CORNER_INSET = 1.4; // keep boards off the corners
const DOOR_MARGIN = 0.8;  // and off the edges of an opening
const HANG_GAP = 1.5;     // spacing between neighbouring boards, in metres
const MAX_BOARD_H = 3.0;  // cap, so nothing outgrows the hoarding
const BAND_TILE = 12;     // the printed hoarding graphic is a 12 m x 3 m sheet
const BAND_H_M = 3;
const BAND_Y = 2.85;      // centred on the plywood, clear of plinth and cap
const ROAD_W = 7;         // haul road
const RING = 42;          // and how far out the ring road runs
const ARROW_W = 3.2;      // a painted floor marking, in metres
const ARROW_D = 1.6;
const ARROW_Y = 0.06;     // clear of the slab (0.03) and its edge lines (0.045)
const ARROW_IN = 5.0;     // how far back from a doorway the marking sits
const ARROW_BACK = 4.2;   // and how far through it the one facing the other way is
const ARROW_GATE = 4.5;   // outside an outer gate, on the spur

export const zoneById = Object.fromEntries(ZONES.map((z) => [z.id, z]));

/** The width of the opening a run type cuts. */
export function openingWidth(type) {
  return type === 'gate' ? GATE_WIDTH : DOOR_WIDTH;
}

/* Each run lies along one axis at a fixed coordinate on the other.
   `inward` points into the compound, which is also a board's facing. */
export function wallAxis(zone, wall) {
  const b = zone.bounds;
  switch (wall) {
    case 'north': return { axis: 'x', min: b.minX, max: b.maxX, fixed: b.minZ, inward: 1, rotationY: 0 };
    case 'south': return { axis: 'x', min: b.minX, max: b.maxX, fixed: b.maxZ, inward: -1, rotationY: Math.PI };
    case 'west':  return { axis: 'z', min: b.minZ, max: b.maxZ, fixed: b.minX, inward: 1, rotationY: Math.PI / 2 };
    case 'east':  return { axis: 'z', min: b.minZ, max: b.maxZ, fixed: b.maxX, inward: -1, rotationY: -Math.PI / 2 };
    default: throw new Error('unknown run: ' + wall);
  }
}

/** Solid stretches of a run, in axis coordinates. An opening splits it in two. */
function wallSpans(zone, wall, inset = 0) {
  const type = zone.walls[wall];
  if (type === 'none') return [];
  const { min, max } = wallAxis(zone, wall);
  const a = min + inset, b = max - inset;
  if (b <= a) return [];
  if (type !== 'door' && type !== 'gate') return [[a, b]];
  const c = (min + max) / 2;
  const half = openingWidth(type) / 2 + (inset ? DOOR_MARGIN : 0);
  return [[a, c - half], [c + half, b]].filter(([s, e]) => e - s > 0.4);
}

/** Board size, capped in height with the aspect ratio kept. */
export function boardSize(ex) {
  const [w, h] = ex.size;
  if (h <= MAX_BOARD_H) return [w, h];
  const k = MAX_BOARD_H / h;
  return [w * k, MAX_BOARD_H];
}

/**
 * Lay boards out along the usable stretches of a run, given their widths.
 *
 * Widths matter: distributing by count alone lets a wide board and a narrow one
 * share a stretch that only fits the narrow pair, and they overlap.
 *
 * Boards hang at a fixed gap and the group is centred on its stretch, rather
 * than spreading to fill it. On a 21 m run, two boards spread edge-to-edge end
 * up 8 m apart — far enough that standing between them puts neither in view.
 *
 * Returns an array of centre coordinates, with a hole where a board did not fit
 * anywhere — callers must skip those.
 */
export function slotPositions(zone, wall, widths) {
  const spans = wallSpans(zone, wall, CORNER_INSET);
  const out = new Array(widths.length);
  if (!widths.length || !spans.length) return out;

  const extent = (g) => g.reduce((a, j) => a + widths[j], 0) + HANG_GAP * (g.length - 1);

  const groups = spans.map(() => []);
  let si = 0;
  for (let i = 0; i < widths.length; i++) {
    while (si < spans.length) {
      const g = groups[si];
      if (extent([...g, i]) <= spans[si][1] - spans[si][0]) { g.push(i); break; }
      si++;
    }
    if (si >= spans.length) break;
  }

  spans.forEach(([s, e], k) => {
    const g = groups[k];
    if (!g.length) return;
    let x = s + ((e - s) - extent(g)) / 2;   // centre the group on the stretch
    for (const j of g) { out[j] = x + widths[j] / 2; x += widths[j] + HANG_GAP; }
  });
  return out;
}

/**
 * Which stretches of a run end up with a board on them.
 *
 * Derived from the board data rather than listed, because the boards are the
 * source of truth for where work hangs — and it has to be per stretch, not per
 * run. An opening splits a run in two, and a run with one board on it leaves
 * the other side of the opening as bare plywood unless something notices.
 */
function occupiedSpans(zone, wall) {
  const list = EXHIBITS
    .filter((ex) => ex.zone === zone.id && ex.wall === wall)
    .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
  const spans = wallSpans(zone, wall, CORNER_INSET);
  if (!list.length) return spans.map(() => false);
  const coords = slotPositions(zone, wall, list.map((ex) => boardSize(ex)[0]));
  return spans.map(([s, e]) => coords.some((c) => c !== undefined && c >= s && c <= e));
}

/** World transform for a board at `coord` along `wall`, standing at `y`. */
export function wallPlacement(zone, wall, coord, y) {
  const w = wallAxis(zone, wall);
  // Clear of the steel uprights, not just of the plywood: the posts stand proud
  // of the panel, and a board mounted flush to the panel gets a post straight
  // through the middle of it wherever the two happen to line up.
  const off = PANEL_T / 2 + 0.17;
  const pos = new THREE.Vector3();
  if (w.axis === 'x') pos.set(coord, y, w.fixed + w.inward * off);
  else pos.set(w.fixed + w.inward * off, y, coord);
  return { position: pos, rotationY: w.rotationY };
}

/** Which compound lies on the far side of an internal opening. */
export function neighbourThrough(zone, wall) {
  const wa = wallAxis(zone, wall);
  return ZONES.find((other) => {
    if (other.id === zone.id) return false;
    const b = other.bounds;
    if (wa.axis === 'x') return (wa.inward > 0 ? b.maxZ : b.minZ) === wa.fixed;
    return (wa.inward > 0 ? b.maxX : b.minX) === wa.fixed;
  }) || null;
}

/**
 * Standing outside every compound is a real place here — the haul road, the
 * laydown yard, the frame going up — so it gets a name of its own rather than
 * leaving the last compound's tag on screen after you have walked out of it.
 */
export const OPEN_SITE = {
  id: 'open', label: 'Open Site', code: '\u25CB', accent: 0x6f7a7d,
  bounds: { minX: -SITE_HALF, maxX: SITE_HALF, minZ: -SITE_HALF, maxZ: SITE_HALF },
  walls: {}, blurb: 'the working site outside the yards',
};

/** Which compound contains a point — used for lazy loading and the minimap. */
export function zoneAt(x, z) {
  for (const zn of ZONES) {
    const b = zn.bounds;
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return zn;
  }
  return null;
}

/* ========================================================================== */

export function buildSite(scene, pal) {
  const mats = siteMaterials(pal);
  const root = new THREE.Group();
  const colliders = [];
  const masts = [];
  const animated = [];

  const solid = (cx, cz, hw, hd) => colliders.push({
    minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd,
  });

  buildGround(root, mats);
  buildRoads(root, mats);
  for (const zone of ZONES) buildCompound(root, zone, mats, pal, solid);
  buildPerimeter(root, mats, solid);
  buildWayfinding(root, pal);
  dressSite(root, mats, pal, solid, masts, animated);

  scene.add(root);
  return { root, colliders, masts, animated, mats };
}

/* --- ground and roads ----------------------------------------------------- */

function buildGround(root, mats) {
  const size = 780;
  const ground = new THREE.Mesh(tileUV(new THREE.PlaneGeometry(size, size), size / 9, size / 9), mats.earth);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);
}

/** Haul road: a ring linking the four outer gates, with a spur into each. */
function buildRoads(root, mats) {
  const strip = (x, z, w, d) => {
    const m = new THREE.Mesh(tileUV(new THREE.PlaneGeometry(w, d), w / 4, d / 4), mats.asphalt);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.015, z);
    m.receiveShadow = true;
    root.add(m);
  };
  const L = RING * 2 + ROAD_W;
  strip(0, -RING, L, ROAD_W);
  strip(0, RING, L, ROAD_W);
  strip(-RING, 0, ROAD_W, L);
  strip(RING, 0, ROAD_W, L);

  // Spurs from each outer gate out to the ring, and the entrance road south.
  strip(0, -36, GATE_WIDTH + 1, 13);
  strip(0, 36, GATE_WIDTH + 1, 13);
  strip(36, 0, 13, GATE_WIDTH + 1);
  strip(-36, 0, 13, GATE_WIDTH + 1);
  strip(0, (RING + SITE_HALF) / 2, ROAD_W + 2, SITE_HALF - RING + 2);
}

/* --- one compound --------------------------------------------------------- */

function buildCompound(root, zone, mats, pal, solid) {
  const b = zone.bounds;
  const w = b.maxX - b.minX, d = b.maxZ - b.minZ;
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;

  // Poured slab. Its saw-cut joints tile on the geometry, so every compound
  // shares one texture and still gets joints at a constant 6 m spacing.
  const slab = new THREE.Mesh(tileUV(new THREE.PlaneGeometry(w, d), w / 6, d / 6), mats.concrete);
  slab.rotation.x = -Math.PI / 2;
  slab.position.set(cx, 0.03, cz);
  slab.receiveShadow = true;
  root.add(slab);

  // Painted edge line in the compound's colour. It gives each yard an identity
  // and gives the eye something to read across a large empty slab.
  const lineMat = new THREE.MeshBasicMaterial({ color: zone.accent, transparent: true, opacity: 0.42 });
  const bw = w - INSET * 2, bd = d - INSET * 2, t = 0.14;
  for (const [sx, sz, px, pz] of [
    [bw, t, 0, -bd / 2], [bw, t, 0, bd / 2],
    [t, bd, -bw / 2, 0], [t, bd, bw / 2, 0],
  ]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(cx + px, 0.045, cz + pz);
    root.add(line);
  }

  for (const wall of ['north', 'south', 'east', 'west']) {
    const type = zone.walls[wall];
    if (type === 'none') continue;
    const wa = wallAxis(zone, wall);
    const taken = occupiedSpans(zone, wall);

    wallSpans(zone, wall).forEach(([s, e], k) => {
      buildHoarding(root, mats, wa, s, e, solid);
      // The scheme graphic, on the face that looks out at the rest of the
      // site — and the PPE notice on any inward stretch left bare by the
      // boards, so no run of plywood is ever simply blank.
      hangBand(root, mats, wa, s, e, zone.accent, 'identity', false);
      if (!taken[k]) hangBand(root, mats, wa, s, e, zone.accent, 'safety', true);
    });

    if (type === 'door' || type === 'gate') {
      buildOpening(root, mats, zone, wall, wa, type);
    }
  }

  dressCompound(root, zone, mats, solid);
}

/**
 * The printed band on one stretch of hoarding.
 *
 * The graphic is a BAND_TILE x 3 m sheet, so the tile count is rounded to whole
 * sheets: a fractional repeat slices a word in half at the end of every run,
 * and stretching the tile a little is far less visible than that.
 */
function hangBand(root, mats, wa, s, e, accent, kind, inward) {
  const len = e - s;
  if (len < 2) return;                      // a stub of hoarding stays plain
  const mid = (s + e) / 2;
  const alongX = wa.axis === 'x';
  const dir = inward ? wa.inward : -wa.inward;
  const off = PANEL_T / 2 + 0.012;

  const geo = tileUV(new THREE.PlaneGeometry(len, BAND_H_M), Math.max(1, Math.round(len / BAND_TILE)), 1);
  const m = new THREE.Mesh(geo, mats.band(accent, kind));
  if (alongX) m.position.set(mid, BAND_Y, wa.fixed + dir * off);
  else m.position.set(wa.fixed + dir * off, BAND_Y, mid);
  m.rotation.y = wa.rotationY + (inward ? 0 : Math.PI);
  m.receiveShadow = true;
  root.add(m);
}

/**
 * What is standing in a compound.
 *
 * Each yard gets the plant and materials its work would actually need, which is
 * also how the yards tell themselves apart from the middle of the slab, before
 * you are close enough to read a board.
 *
 * Two lanes stay clear everywhere: the cross corridor through the openings, and
 * a 4 m strip inside any run that carries boards, so nothing is ever parked
 * between you and the work.
 */
function dressCompound(root, zone, mats, solid) {
  const put = (node, hw, hd) => {
    root.add(node);
    if (hw) solid(node.position.x, node.position.z, hw, hd ?? hw);
  };

  switch (zone.id) {
    case 'office': {
      put(siteCabin(mats, { x: -8, z: -5.4, rot: Math.PI / 2, w: 5.4, accent: zone.accent }), 1.7, 3.0);
      put(planTable(mats, { x: 7.8, z: -5, rot: -1.9, accent: zone.accent }), 1.2, 1.2);
      root.add(drums(mats, [[7.6, 6.2], [8.7, 6.6], [7.9, 7.3]]));
      root.add(cableReel(mats, { x: -9.2, z: 2.4, rot: 0.8, r: 0.7 }));
      solid(-9.2, 2.4, 0.9, 0.9);
      break;
    }
    case 'planroom': {
      put(planTable(mats, { x: -5.4, z: -19.5, rot: 0.22, accent: zone.accent, w: 2.8 }), 1.5, 1.5);
      put(planTable(mats, { x: 5.4, z: -22, rot: -0.38, accent: zone.accent }), 1.3, 1.3);
      root.add(surveyStakes(mats, [[-6.4, -25.4], [-4.6, -25.4], [-2.8, -25.4]], zone.accent));
      root.add(drums(mats, [[6.6, -15.4], [7.7, -15.9]]));
      break;
    }
    case 'systems': {
      put(shippingContainer(mats, { x: 18.5, z: -5.8, rot: 0, color: 0x3d6f77 }), 3.3, 1.4);
      root.add(cableReel(mats, { x: 21.6, z: 5.4, rot: 0.3 }));
      root.add(cableReel(mats, { x: 23.9, z: 5.9, rot: 1.4, r: 0.75 }));
      solid(22.8, 5.6, 2.2, 1.1);
      root.add(drums(mats, [[15.6, 6.4], [16.7, 6.9], [15.9, 7.6]]));
      break;
    }
    case 'fabrication': {
      put(rebarBundle(mats, { x: -20, z: -5.6, rot: 0.08 }), 3.2, 0.8);
      put(rebarBundle(mats, { x: -20, z: -7.4, rot: 0.08 }), 3.2, 0.8);
      put(pipeStack(mats, { x: -18.6, z: 5.6, rot: 0.06 }), 2.7, 0.9);
      put(lumberStack(mats, { x: -23.4, z: 6.6, rot: 0.5 }), 2.0, 1.2);
      root.add(blockPallet(mats, { x: -15.4, z: -6.8, high: 2 }));
      solid(-15.4, -6.8, 0.7, 0.7);
      break;
    }
    case 'milestones': {
      // The survey line the yard is named for, set off the centre so the way
      // through from the office is never blocked.
      const stakes = [];
      for (let i = 0; i < 6; i++) stakes.push([-7.4, 15.6 + i * 2.4]);
      root.add(surveyStakes(mats, stakes, zone.accent));
      put(surveyTripod(mats, { x: -7.4, z: 13.2, rot: 0.2, accent: zone.accent }), 0.5, 0.5);
      put(planTable(mats, { x: 6.8, z: 20, rot: -0.5, accent: zone.accent }), 1.3, 1.3);
      root.add(blockPallet(mats, { x: 6.4, z: 25.6, high: 1 }));
      solid(6.4, 25.6, 0.7, 0.7);
      break;
    }
    default: break;
  }
}

/** One solid stretch of hoarding: plinth, panels, uprights, hazard cap. */
function buildHoarding(root, mats, wa, s, e, solid) {
  const len = e - s, mid = (s + e) / 2;
  const alongX = wa.axis === 'x';
  const at = (h, y, t, mat, tiles) => {
    const geo = alongX
      ? new THREE.BoxGeometry(len, h, t)
      : new THREE.BoxGeometry(t, h, len);
    if (tiles) tileUV(geo, tiles[0], tiles[1]);
    const m = new THREE.Mesh(geo, mat);
    if (alongX) m.position.set(mid, y, wa.fixed);
    else m.position.set(wa.fixed, y, mid);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    return m;
  };

  at(PLINTH_H, PLINTH_H / 2, PLINTH_T, mats.concrete, [len / 3, PLINTH_H / 3]);

  const panelH = WALL_HEIGHT - PLINTH_H - BAND_H;
  at(panelH, PLINTH_H + panelH / 2, PANEL_T, mats.ply, [len / 2.4, panelH / 2.4]);

  at(BAND_H, WALL_HEIGHT - BAND_H / 2, PANEL_T + 0.06, mats.hazard, [len / 1.2, 1]);

  // Steel uprights, just proud of the panel face so a 21 m run has a rhythm.
  // Kept shallower than the board standoff — see wallPlacement.
  const postGeo = alongX
    ? new THREE.BoxGeometry(0.16, WALL_HEIGHT - 0.1, PANEL_T + 0.1)
    : new THREE.BoxGeometry(PANEL_T + 0.1, WALL_HEIGHT - 0.1, 0.16);
  const posts = instancer(postGeo, mats.steelDark);
  const n = Math.max(1, Math.round(len / POST_STEP));
  for (let i = 0; i <= n; i++) {
    const t = s + (len * i) / n;
    posts.at(alongX ? t : wa.fixed, (WALL_HEIGHT - 0.1) / 2, alongX ? wa.fixed : t);
  }
  root.add(posts.build(true, false));

  const hw = alongX ? len / 2 : PLINTH_T / 2;
  const hd = alongX ? PLINTH_T / 2 : len / 2;
  solid(alongX ? mid : wa.fixed, alongX ? wa.fixed : mid, hw, hd);
}

/** An opening: goalpost frame, lintel over the top, and a sign either side. */
function buildOpening(root, mats, zone, wall, wa, type) {
  const width = openingWidth(type);
  const c = (wa.min + wa.max) / 2;
  const alongX = wa.axis === 'x';

  const lintelH = WALL_HEIGHT - OPENING_H;
  const geo = alongX
    ? new THREE.BoxGeometry(width, lintelH, PANEL_T)
    : new THREE.BoxGeometry(PANEL_T, lintelH, width);
  tileUV(geo, width / 2.4, lintelH / 2.4);
  const lintel = new THREE.Mesh(geo, mats.ply);
  const ly = OPENING_H + lintelH / 2;
  if (alongX) lintel.position.set(c, ly, wa.fixed);
  else lintel.position.set(wa.fixed, ly, c);
  lintel.castShadow = true;
  root.add(lintel);

  // Hazard-striped goalposts. On a real site these are the only part of the
  // hoarding anyone ever hits, so they are the part that gets painted.
  const jambGeo = alongX
    ? new THREE.BoxGeometry(0.28, OPENING_H, PANEL_T + 0.3)
    : new THREE.BoxGeometry(PANEL_T + 0.3, OPENING_H, 0.28);
  tileUV(jambGeo, 1, OPENING_H / 1.2);
  const jambs = instancer(jambGeo, mats.hazard);
  for (const s of [-1, 1]) {
    const t = c + (s * width) / 2;
    jambs.at(alongX ? t : wa.fixed, OPENING_H / 2, alongX ? wa.fixed : t);
  }
  root.add(jambs.build(true, false));

  // Sign naming the compound on the far side, hung on the inward face.
  const target = type === 'gate' ? null : neighbourThrough(zone, wall);
  const sign = target
    ? gateSign(target.label, target.code, width * 0.92, target.accent)
    : noticeBoard(['site exit', 'high-vis beyond this point'], width * 0.62, { ratio: 0.42 });
  const p = wallPlacement(zone, wall, c, OPENING_H + lintelH / 2);
  sign.position.copy(p.position);
  sign.rotation.y = p.rotationY;
  root.add(sign);
}

/* --- wayfinding ----------------------------------------------------------- */

/**
 * Which heading points along an axis. `sign` is the component of travel on the
 * axis the wall's normal runs down, so this is the direction you would walk to
 * go through the opening rather than the direction the run of hoarding lies in.
 */
function arrowHeading(axis, sign) {
  return axis === 'x' ? Math.atan2(0, sign) : Math.atan2(sign, 0);
}

/** One painted marking on the ground, pointing along `heading`. */
function placeArrow(root, pal, x, z, heading, accent, code, label) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(ARROW_W, ARROW_D),
    // Unlit, like the painted edge lines in buildCompound: at night the paint
    // is the one thing on the slab holding the floodlight, and shading it with
    // the ground puts it out at exactly the hour it is needed.
    new THREE.MeshBasicMaterial({
      map: wayfindingArrowTexture(pal, accent, code, label),
      transparent: true,
      depthWrite: false,
    }),
  );
  mesh.position.set(x, ARROW_Y, z);
  // Turn the quad in its own plane, then tip that plane onto the ground: with
  // the default XYZ order the Z term is applied first, which is the one that
  // spins the marking. The texture is drawn pointing at its own top edge, and
  // a flat quad's top edge lands on -Z, so `heading` needs half a turn added.
  mesh.rotation.set(-Math.PI / 2, 0, heading + Math.PI);
  mesh.renderOrder = 2;
  root.add(mesh);
}

/**
 * Directional paint at the openings.
 *
 * The plan is a hub with four spokes, not a route, so this is not a trail of
 * arrows from one yard to the next — there is no such order to follow. It is
 * what a real site paints at a junction: at the hub, one marking per way out
 * naming what is through it; on the far side of each of those, one pointing
 * back; and outside each outer gate, one naming the way back in for anyone who
 * walked off into the open site.
 *
 * Every destination is read from the site plan through `neighbourThrough`, so
 * moving a compound moves the marking that names it.
 */
function buildWayfinding(root, pal) {
  const office = zoneById.office;
  if (!office) return;

  for (const wall of ['north', 'south', 'east', 'west']) {
    if (office.walls[wall] !== 'door') continue;
    const target = neighbourThrough(office, wall);
    if (!target) continue;

    const wa = wallAxis(office, wall);
    const c = (wa.min + wa.max) / 2;
    const alongX = wa.axis === 'x';

    const near = wa.fixed + wa.inward * ARROW_IN;
    placeArrow(root, pal,
      alongX ? c : near, alongX ? near : c,
      arrowHeading(wa.axis, -wa.inward), target.accent, target.code, target.label);

    const far = wa.fixed - wa.inward * ARROW_BACK;
    placeArrow(root, pal,
      alongX ? c : far, alongX ? far : c,
      arrowHeading(wa.axis, wa.inward), office.accent, office.code, office.label);
  }

  for (const zone of ZONES) {
    for (const wall of ['north', 'south', 'east', 'west']) {
      if (zone.walls[wall] !== 'gate') continue;
      const wa = wallAxis(zone, wall);
      const c = (wa.min + wa.max) / 2;
      const alongX = wa.axis === 'x';
      const at = wa.fixed - wa.inward * ARROW_GATE;
      placeArrow(root, pal,
        alongX ? c : at, alongX ? at : c,
        arrowHeading(wa.axis, wa.inward), zone.accent, zone.code, zone.label);
    }
  }
}

/* --- perimeter ------------------------------------------------------------ */

function buildPerimeter(root, mats, solid) {
  const H = SITE_HALF, len = H * 2, gate = 9;
  // Three closed sides, and a south side split for the main gate.
  for (const [x, z, axis] of [[0, -H, 'x'], [-H, 0, 'z'], [H, 0, 'z']]) {
    root.add(chainLinkRun(mats, { x, z, axis, length: len }));
  }
  const half = (len - gate) / 2;
  for (const s of [-1, 1]) {
    root.add(chainLinkRun(mats, { x: s * (gate / 2 + half / 2), z: H, axis: 'x', length: half }));
  }

  solid(0, -H, H, 0.2);
  solid(-H, 0, 0.2, H);
  solid(H, 0, 0.2, H);
  for (const s of [-1, 1]) solid(s * (gate / 2 + half / 2), H, half / 2, 0.2);

  // Main gate: two posts, a header, and the project board on it.
  const postGeo = new THREE.BoxGeometry(0.3, 5.4, 0.3);
  const posts = instancer(postGeo, mats.steel);
  for (const s of [-1, 1]) posts.at(s * (gate / 2 + 0.4), 2.7, H);
  root.add(posts.build());

  const header = new THREE.Mesh(new THREE.BoxGeometry(gate + 1.4, 0.9, 0.28), mats.steelDark);
  header.position.set(0, 5.0, H);
  header.castShadow = true;
  root.add(header);

  const board = noticeBoard(
    ['Irfan Gazi', 'Construction Engineering & Management', 'all visitors report to the site office'],
    8.4, { ratio: 0.36 },
  );
  board.position.set(0, 3.4, H - 0.22);
  board.rotation.y = Math.PI;
  root.add(board);
}

/* --- everything outside the compounds ------------------------------------- */

function dressSite(root, mats, pal, solid, masts, animated) {
  root.add(skyline(mats, {}));

  /* North: the frame going up, and the crane over it. */
  const crane = towerCrane(mats, { x: -34, z: -46 });
  root.add(crane);
  animated.push({ node: crane.userData.slew, kind: 'slew' });
  solid(-34, -46, 3.6, 3.6);

  const frame = steelFrame(mats, { x: -1, z: -51, bays: 4, spans: 3, grid: 6, levels: 3, storey: 4 });
  root.add(frame);
  for (let i = 0; i <= 4; i++) {
    for (let j = 0; j <= 3; j++) solid(-1 - 12 + i * 6, -51 - 9 + j * 6, 0.3, 0.3);
  }

  root.add(scaffoldTower(mats, { x: 14.5, z: -50, w: 3.4, d: 2.4, lifts: 5 }));
  solid(14.5, -50, 1.9, 1.4);
  root.add(spoilPile(mats, { x: -22, z: -58, r: 5, h: 2.4, rot: 0.7 }));
  root.add(spoilPile(mats, { x: 24, z: -55, r: 3.6, h: 1.7, rot: 2.1 }));
  root.add(dumpTruck(mats, { x: 22, z: -42, rot: Math.PI, tipped: true }));
  solid(22, -42, 4.2, 1.6);

  /* East: containers, cable, power. */
  const stack = [
    { x: 50, z: -10, rot: Math.PI / 2, color: 0x2f6f7a, stack: true },
    { x: 50, z: -1, rot: Math.PI / 2, color: 0xb0562a },
    { x: 50, z: 8, rot: Math.PI / 2, color: 0x4a6b3c, stack: true },
    { x: 41, z: 14, rot: 0, color: 0x8d8f92 },
  ];
  for (const c of stack) {
    root.add(shippingContainer(mats, c));
    const long = 3.3, short = 1.4;
    solid(c.x, c.z, c.rot ? short : long, c.rot ? long : short);
  }
  for (const [x, z, r] of [[44, -16, 0.4], [46.6, -16.4, 1.1], [43, 20, 0.9]]) {
    root.add(cableReel(mats, { x, z, rot: r }));
  }
  root.add(siteCabin(mats, { x: 47, z: 24, rot: -Math.PI / 2, w: 5.4, accent: 0x4e8b3a }));
  solid(47, 24, 1.7, 3.2);

  /* West: the laydown yard. */
  root.add(rebarBundle(mats, { x: -48, z: -8, rot: 0.1 }));
  root.add(rebarBundle(mats, { x: -48, z: -5.4, rot: 0.1 }));
  root.add(pipeStack(mats, { x: -47, z: 2, rot: 0.05 }));
  root.add(pipeStack(mats, { x: -47, z: 6, rot: 0.05, color: 0x6a6f52 }));
  for (const [x, z, h] of [[-53, 12, 2], [-51, 12, 1], [-53, 14.4, 1]]) {
    root.add(blockPallet(mats, { x, z, high: h }));
  }
  root.add(lumberStack(mats, { x: -44, z: 12, rot: 0.4 }));
  root.add(mixerTruck(mats, { x: -38, z: -20, rot: 0.5 }));
  solid(-38, -20, 4.4, 2.2);
  root.add(excavator(mats, { x: -47, z: -26, rot: -0.9 }));
  solid(-47, -26, 2.8, 2.8);
  root.add(spoilPile(mats, { x: -54, z: -32, r: 4.2, h: 2.0, rot: 1.3 }));

  /* South: welfare and the way in. */
  root.add(siteCabin(mats, { x: -13, z: 46, rot: 0, w: 7.2, accent: 0x8a5fa8 }));
  solid(-13, 46, 3.7, 1.7);
  root.add(siteCabin(mats, { x: -13, z: 51, rot: 0, w: 7.2, accent: 0x0e6e6e }));
  solid(-13, 51, 3.7, 1.7);
  root.add(shippingContainer(mats, { x: 14, z: 48, rot: 0.2, color: 0xb0562a }));
  solid(14, 48, 3.3, 1.4);
  root.add(dumpTruck(mats, { x: 22, z: 44, rot: -0.4 }));
  solid(22, 44, 4.2, 1.6);

  /* The four notches between compounds — inside the ring, but outside every
     yard, so they need something in them or the plan reads as a hole. */
  const notch = [[22, -22], [22, 22], [-22, 22], [-22, -22]];
  notch.forEach(([x, z], i) => {
    root.add(spoilPile(mats, { x: x * 1.15, z: z * 1.15, r: 2.6, h: 1.2, rot: i }));
    root.add(blockPallet(mats, { x, z, high: 1 + (i % 2) }));
    root.add(lumberStack(mats, { x: x * 0.86, z: z * 0.86, rot: i * 0.6, len: 3.4 }));
  });

  /* Cones, barriers and drums, one draw call each for the whole site. */
  const conePos = [];
  for (const [gx, gz, ax] of [[0, -32, 'x'], [0, 32, 'x'], [32, 0, 'z'], [-32, 0, 'z']]) {
    for (let i = -2; i <= 2; i++) {
      if (ax === 'x') conePos.push([gx - 3.4, gz + i * 2.2], [gx + 3.4, gz + i * 2.2]);
      else conePos.push([gx + i * 2.2, gz - 3.4], [gx + i * 2.2, gz + 3.4]);
    }
  }
  for (let i = -3; i <= 3; i++) conePos.push([-6.2, 52 + i * 1.8], [6.2, 52 + i * 1.8]);
  root.add(cones(mats, conePos));

  root.add(barriers(mats, [
    [-8, 40, 0], [-6, 40, 0], [8, 40, 0], [6, 40, 0],
    [44, -30, Math.PI / 2], [44, -28, Math.PI / 2],
    [-44, 30, Math.PI / 2], [-44, 32, Math.PI / 2],
    [16, -40, 0], [18, -40, 0],
  ]));

  root.add(drums(mats, [
    [-40, -40], [-38.6, -40], [-39.3, -38.8],
    [40, 40], [41.4, 40], [40.7, 41.2],
    [-40, 40], [40, -40],
  ]));

  /* Floodlight masts. Placed to cover the yards and the two working areas;
     modules/lighting.js hangs a spot light on each one after dark. */
  const positions = [
    // Corner of the site office, not the middle of it — a mast on the spawn
    // point is the first thing you walk into.
    { x: 9.7, z: -9.7, h: 12, aim: -2.4, heads: 2, target: [0, 0] },
    { x: -20, z: -20, h: 10, aim: 2.4, heads: 2, target: [0, -21] },
    { x: 20, z: -20, h: 10, aim: -2.4, heads: 2, target: [21, 0] },
    { x: -20, z: 20, h: 10, aim: 0.8, heads: 2, target: [-21, 0] },
    { x: 20, z: 20, h: 10, aim: -0.8, heads: 2, target: [0, 21] },
    { x: 14, z: -44, h: 14, aim: 3.4, heads: 2, target: [-2, -51] },
    { x: 44, z: 4, h: 10, aim: 1.6, heads: 1, target: [50, 0] },
    { x: -44, z: 4, h: 10, aim: -1.6, heads: 1, target: [-49, 0] },
    // The way in. Arriving at an unlit gate is the one place the night shift
    // must not look like a power cut.
    { x: -9, z: 50, h: 12, aim: 0.5, heads: 2, target: [0, 46] },
    { x: 9, z: 50, h: 12, aim: -0.5, heads: 2, target: [0, 56] },
  ];
  for (const m of positions) {
    root.add(floodlightMast(mats, m));
    solid(m.x, m.z, 0.8, 0.8);
    masts.push(m);
  }
}
