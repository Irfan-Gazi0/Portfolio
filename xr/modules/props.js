import * as THREE from 'three';
import {
  earthTexture, concreteTexture, asphaltTexture, plywoodTexture, hazardTexture,
  chainLinkTexture, corrugatedTexture, steelTexture, deckingTexture,
  hoardingBandTexture,
} from './textures.js';

/* Everything on the site that is not a compound or a notice board: the crane,
   the frame going up, plant, containers, materials, cones, floodlight masts.

   Two rules keep this affordable. Anything that appears more than a handful of
   times goes through `instancer` and lands as one draw call regardless of
   count — cones, ties, scaffold tubes, skyline blocks. And every material is
   made once in `siteMaterials` and shared, because a hundred meshes holding a
   hundred identical materials is a hundred shader programs' worth of state
   changes for one visual result. */

const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

/**
 * Scale a geometry's UVs so a shared, untiled texture repeats across it.
 *
 * Tiling cannot live on the texture: these are cached and shared, so setting
 * `repeat` for a 24 m run of hoarding would retile the 6 m run next to it too.
 * Scaling the mesh's own UVs keeps one texture serving every size.
 */
export function tileUV(geo, sx, sy) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  uv.needsUpdate = true;
  return geo;
}
const cyl = (r, h, mat, seg = 10, rTop = r) =>
  new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, seg), mat);

/** Mark a subtree as casting and/or receiving. */
export function shade(obj, cast = true, receive = true) {
  obj.traverse((n) => {
    if (!n.isMesh) return;
    n.castShadow = cast;
    n.receiveShadow = receive;
  });
  return obj;
}

/**
 * Stop anything too small to read as a shadow from casting one.
 *
 * `shade` works on whole props, which is the right granularity for authoring
 * and the wrong one for the shadow pass: a cab step, a door handle and a wheel
 * nut each cost the sun exactly the same draw call the excavator does, and
 * each contributes a smudge a texel or two across. Two thirds of the
 * per-frame draw calls here were the shadow pass, and most of that was detail
 * this small.
 *
 * Measured rather than hand-listed, so a prop added later is covered the day
 * it is added rather than the day someone remembers this function exists.
 *
 * InstancedMeshes are skipped on purpose. They are one draw call however many
 * copies they hold, so there is nothing to win — and their per-instance scale
 * lives in the instance matrices rather than in `node.scale`, so measuring
 * them this way would read a scaffold ledger as a 1 m stub of what is actually
 * a 3 m tube.
 */
export function pruneShadowCasters(root, minSize = 0.45) {
  const size = new THREE.Vector3();
  root.traverse((n) => {
    if (!n.isMesh || n.isInstancedMesh || !n.castShadow) return;
    if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
    n.geometry.boundingBox.getSize(size).multiply(n.scale);
    if (Math.max(size.x, size.y, size.z) < minSize) n.castShadow = false;
  });
  return root;
}

/**
 * Collects transforms, then emits one InstancedMesh.
 * Everything placed through here shares a single draw call.
 */
export function instancer(geo, mat) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const out = [];
  return {
    at(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
      p.set(x, y, z); e.set(rx, ry, rz); q.setFromEuler(e); s.set(sx, sy, sz);
      out.push(m.compose(p, q, s).clone());
      return this;
    },
    get count() { return out.length; },
    build(cast = true, receive = true) {
      const im = new THREE.InstancedMesh(geo, mat, out.length || 1);
      out.forEach((mat4, i) => im.setMatrixAt(i, mat4));
      im.count = out.length;
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = cast;
      im.receiveShadow = receive;
      return im;
    },
  };
}

/* --- materials ------------------------------------------------------------ */

const sharedMats = new Map();

export function siteMaterials(pal) {
  const lam = (opts) => new THREE.MeshLambertMaterial(opts);
  const chain = chainLinkTexture();
  sharedMats.clear();
  /* One material per key, for the three that are asked for by colour rather
     than named up front. Without this the site ends up holding forty Lambert
     materials where fourteen distinct ones exist, which is exactly the thing
     the note at the top of this file says not to do. */
  const once = (key, make) => {
    let m = sharedMats.get(key);
    if (!m) { m = make(); sharedMats.set(key, m); }
    return m;
  };

  return {
    night: pal.night,
    skylineColor: pal.night ? 0x0d1622 : 0x788b9d,

    earth:    lam({ map: earthTexture(pal) }),
    concrete: lam({ map: concreteTexture(pal) }),
    asphalt:  lam({ map: asphaltTexture(pal) }),
    ply:      lam({ map: plywoodTexture(pal) }),
    hazard:   lam({ map: hazardTexture(pal) }),
    steel:    lam({ map: steelTexture(pal) }),
    decking:  lam({ map: deckingTexture(pal) }),
    steelDark: lam({ color: pal.steelDark }),
    rust:     lam({ color: pal.rust }),
    safety:   lam({ color: pal.safety }),
    paint:    lam({ color: pal.paint }),
    dark:     lam({ color: 0x22282a }),
    tyre:     lam({ color: pal.night ? 0x17191a : 0x26292b }),
    glass:    lam({ color: pal.glass, transparent: true, opacity: 0.55 }),
    // Rendered from both sides and alpha-cut, so a fence reads as fence rather
    // than a grey pane, and you can see the site through it.
    chain:    lam({
      color: pal.steel, alphaMap: chain, transparent: true, alphaTest: 0.35,
      side: THREE.DoubleSide, depthWrite: true,
    }),
    lampOff:  lam({ color: pal.steelDark }),
    lampOn:   new THREE.MeshBasicMaterial({ color: pal.lampGlow, fog: true }),
    glow:     new THREE.MeshBasicMaterial({
      color: pal.lampGlow, transparent: true,
      opacity: pal.lampGlowOpacity * 0.12, depthWrite: false, side: THREE.DoubleSide,
    }),
    container: (color) => once('container:' + color, () => lam({ map: corrugatedTexture(color) })),
    flat: (color) => once('flat:' + color, () => lam({ color })),
    // The printed graphic on a run of hoarding. Cached per compound and kind,
    // because a 21 m run and a 6 m run share one material and differ only in how
    // their own UVs are scaled. The site-wide scheme graphic keys on the colour
    // alone; the yard band names its yard, so that one keys on the yard.
    band: (zone, kind) => once(`band:${kind}:${kind === 'zone' ? zone.code : zone.accent}`,
      () => lam({ map: hoardingBandTexture(pal, zone, kind) })),
  };
}

/* --- perimeter ------------------------------------------------------------ */

/**
 * A run of chain-link fence with posts, a top rail, and hazard bunting.
 * `axis` is 'x' or 'z'; the run is centred on (x, z).
 */
export function chainLinkRun(mats, { x, z, axis, length, height = 2.4 }) {
  const g = new THREE.Group();
  const along = axis === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);

  // The cached alpha map is shared by every run, so tiling has to happen on a
  // clone — setting `repeat` on the shared texture would retile the whole site.
  const alpha = chainLinkTexture().clone();
  alpha.needsUpdate = true;
  alpha.repeat.set(length / 2.4, height / 2.4);
  const mat = mats.chain.clone();
  mat.alphaMap = alpha;

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(length, height), mat);
  mesh.position.y = height / 2;
  if (axis === 'z') mesh.rotation.y = Math.PI / 2;
  g.add(mesh);

  const postGeo = new THREE.CylinderGeometry(0.045, 0.045, height + 0.12, 6);
  const posts = instancer(postGeo, mats.steel);
  const rail = instancer(new THREE.BoxGeometry(1, 0.06, 0.06), mats.steel);
  const step = 2.6;
  const n = Math.max(2, Math.round(length / step));
  for (let i = 0; i <= n; i++) {
    const t = -length / 2 + (length * i) / n;
    posts.at(along.x * t, (height + 0.12) / 2, along.z * t);
    if (i < n) {
      const mid = t + length / (2 * n);
      rail.at(along.x * mid, height, along.z * mid, axis === 'z' ? Math.PI / 2 : 0, length / n, 1, 1);
    }
  }
  g.add(posts.build(true, false), rail.build(true, false));

  g.position.set(x, 0, z);
  return g;
}

/* --- structures ----------------------------------------------------------- */

/**
 * The tower crane. The landmark: at 36 m it is visible from every compound,
 * which is what stops the open ground reading as featureless.
 * The returned group exposes `slew`, rotated slowly by the frame loop.
 */
export function towerCrane(mats, { x, z, mastH = 36, jib = 40, counterJib = 13 }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const pad = box(7, 0.7, 7, mats.concrete);
  pad.position.y = 0.35;
  g.add(pad);

  // Mast: four corner chords plus instanced ties and diagonals, so a 36 m
  // lattice tower is four draw calls rather than three hundred.
  const S = 0.85;                      // half the mast section
  const chordGeo = new THREE.BoxGeometry(0.16, mastH, 0.16);
  const chords = instancer(chordGeo, mats.steel);
  for (const [cx, cz] of [[-S, -S], [S, -S], [S, S], [-S, S]]) chords.at(cx, mastH / 2 + 0.7, cz);
  g.add(chords.build());

  const tieGeo = new THREE.BoxGeometry(S * 2, 0.09, 0.09);
  const ties = instancer(tieGeo, mats.steel);
  const diagGeo = new THREE.BoxGeometry(S * 2.55, 0.07, 0.07);
  const diags = instancer(diagGeo, mats.steel);
  for (let y = 0.7 + 1.6; y < mastH; y += 1.8) {
    ties.at(0, y, -S).at(0, y, S)
        .at(-S, y, 0, Math.PI / 2).at(S, y, 0, Math.PI / 2);
    const up = (Math.round(y / 1.8) % 2) ? 0.62 : -0.62;
    diags.at(0, y + 0.9, -S, 0, 1, 1, 1, 0, up);
    diags.at(0, y + 0.9, S, 0, 1, 1, 1, 0, -up);
    diags.at(-S, y + 0.9, 0, Math.PI / 2, 1, 1, 1, 0, up);
    diags.at(S, y + 0.9, 0, Math.PI / 2, 1, 1, 1, 0, -up);
  }
  g.add(ties.build(true, false), diags.build(true, false));

  /* --- everything above the slew ring turns --- */
  const slew = new THREE.Group();
  slew.position.y = mastH + 0.7;
  g.add(slew);

  const ring = cyl(1.1, 0.5, mats.hazard, 12);
  ring.position.y = 0.25;
  slew.add(ring);

  const cab = box(1.9, 1.7, 2.2, mats.flat(0xdfe3e0));
  cab.position.set(0, 1.4, 1.6);
  slew.add(cab);
  const cabGlass = box(1.72, 1.0, 2.0, mats.glass);
  cabGlass.position.set(0, 1.6, 1.62);
  slew.add(cabGlass);

  // A-frame apex, and the tie bars that actually hold the jib up.
  const apexH = 7.2;
  const apex = new THREE.Vector3(0, 0.5 + apexH, 0);
  for (const s of [-1, 1]) {
    const leg = box(0.13, apexH, 0.13, mats.steel);
    leg.position.set(s * 0.55, 0.5 + apexH / 2, 0);
    leg.rotation.z = -s * 0.075;
    slew.add(leg);
  }

  const jibGeo = new THREE.BoxGeometry(0.14, 0.14, 1);
  const jibChords = instancer(jibGeo, mats.steel);
  const jibTies = instancer(new THREE.BoxGeometry(1.3, 0.07, 0.07), mats.steel);
  const H = 0.65;
  for (const [ox, oy] of [[-H, 0.9], [H, 0.9], [0, 0.9 + 1.15]]) {
    jibChords.at(ox, oy, jib / 2, 0, 1, 1, jib);
    jibChords.at(ox, oy, -counterJib / 2, 0, 1, 1, counterJib);
  }
  for (let d = 2; d < jib; d += 2) {
    jibTies.at(0, 0.9, d);
    jibTies.at(0, 0.9, d, Math.PI / 2, 1.75, 1, 1, 0, 0);
  }
  for (let d = 2; d < counterJib; d += 2) jibTies.at(0, 0.9, -d);
  slew.add(jibChords.build(true, false), jibTies.build(true, false));

  // Pendant bars from the apex out to the jib and the counter-jib. A Z-aligned
  // bar rotated about X by atan2(rise, run) lands on the line between the two.
  const tieBar = instancer(new THREE.BoxGeometry(0.09, 0.09, 1), mats.steelDark);
  for (const end of [jib * 0.88, -counterJib * 0.78]) {
    const rise = apex.y - 2.05;
    tieBar.at(0, (apex.y + 2.05) / 2, end / 2, 0, 1, 1, Math.hypot(rise, end),
      Math.atan2(rise, end), 0);
  }
  slew.add(tieBar.build(true, false));

  const cw = box(2.6, 2.1, 3.0, mats.flat(0x9aa0a0));
  cw.position.set(0, 1.3, -counterJib + 1.6);
  slew.add(cw);

  // Trolley and hook, out along the jib.
  const trolley = box(1.0, 0.4, 1.2, mats.safety);
  trolley.position.set(0, 0.6, jib * 0.62);
  slew.add(trolley);

  const hook = new THREE.Group();
  hook.position.set(0, 0.45, jib * 0.62);
  const cable = cyl(0.035, 14, mats.steelDark, 5);
  cable.position.y = -7;
  hook.add(cable);
  const block = box(0.5, 0.7, 0.5, mats.safety);
  block.position.y = -14.4;
  hook.add(block);
  slew.add(hook);

  shade(g, true, false);
  pad.receiveShadow = true;
  g.userData.slew = slew;
  g.userData.hook = hook;
  return g;
}

/** A steel frame partway up: columns, beams, decking and a stair tower. */
export function steelFrame(mats, { x, z, bays = 4, spans = 3, grid = 6, levels = 3, storey = 4 }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const W = bays * grid, D = spans * grid, H = levels * storey;

  const pad = box(W + 4, 0.4, D + 4, mats.concrete);
  pad.position.y = 0.2;
  pad.receiveShadow = true;
  g.add(pad);

  const cols = instancer(new THREE.BoxGeometry(0.34, H, 0.34), mats.steel);
  for (let i = 0; i <= bays; i++) {
    for (let j = 0; j <= spans; j++) {
      cols.at(-W / 2 + i * grid, H / 2 + 0.4, -D / 2 + j * grid);
    }
  }
  g.add(cols.build(true, false));

  const beamX = instancer(new THREE.BoxGeometry(1, 0.42, 0.22), mats.steel);
  const beamZ = instancer(new THREE.BoxGeometry(0.22, 0.42, 1), mats.steel);
  for (let l = 1; l <= levels; l++) {
    const y = 0.4 + l * storey;
    for (let j = 0; j <= spans; j++) {
      for (let i = 0; i < bays; i++) {
        beamX.at(-W / 2 + (i + 0.5) * grid, y, -D / 2 + j * grid, 0, grid, 1, 1);
      }
    }
    for (let i = 0; i <= bays; i++) {
      for (let j = 0; j < spans; j++) {
        beamZ.at(-W / 2 + i * grid, y, -D / 2 + (j + 0.5) * grid, 0, 1, 1, grid);
      }
    }
  }
  g.add(beamX.build(true, false), beamZ.build(true, false));

  // Decking, thinning out as it goes up — a frame is never finished all at once.
  for (let l = 1; l <= levels; l++) {
    const frac = l === levels ? 0.45 : l === levels - 1 ? 0.8 : 1;
    const deck = new THREE.Mesh(tileUV(new THREE.PlaneGeometry(W * frac, D), W * frac / 2, D / 2), mats.decking);
    deck.rotation.x = -Math.PI / 2;
    deck.position.set(-W / 2 + (W * frac) / 2, 0.4 + l * storey + 0.23, 0);
    deck.receiveShadow = true;
    deck.castShadow = true;
    g.add(deck);
  }

  // Edge protection: two rails all round the topmost deck.
  const rail = instancer(new THREE.BoxGeometry(1, 0.05, 0.05), mats.safety);
  const topY = 0.4 + levels * storey + 0.25;
  for (const h of [0.5, 1.1]) {
    rail.at(0, topY + h, -D / 2, 0, W, 1, 1);
    rail.at(0, topY + h, D / 2, 0, W, 1, 1);
    rail.at(-W / 2, topY + h, 0, Math.PI / 2, D, 1, 1);
    rail.at(W / 2, topY + h, 0, Math.PI / 2, D, 1, 1);
  }
  g.add(rail.build(true, false));

  return g;
}

/** Scaffold tower: tubes, boards, toe boards, and a ladder on one face. */
export function scaffoldTower(mats, { x, z, w = 3, d = 2.2, lifts = 4, lift = 2 }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const H = lifts * lift;

  const stds = instancer(new THREE.CylinderGeometry(0.026, 0.026, H, 6), mats.steel);
  for (const [cx, cz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]) {
    stds.at(cx, H / 2, cz);
  }
  g.add(stds.build(true, false));

  const ledger = instancer(new THREE.CylinderGeometry(0.024, 0.024, 1, 6), mats.steel);
  const brace = instancer(new THREE.CylinderGeometry(0.022, 0.022, 1, 6), mats.steel);
  const board = instancer(new THREE.BoxGeometry(w, 0.04, 0.24), mats.ply);
  const toe = instancer(new THREE.BoxGeometry(w, 0.15, 0.03), mats.ply);

  for (let l = 1; l <= lifts; l++) {
    const y = l * lift;
    ledger.at(0, y, -d / 2, 0, 1, w, 1, 0, Math.PI / 2);
    ledger.at(0, y, d / 2, 0, 1, w, 1, 0, Math.PI / 2);
    ledger.at(-w / 2, y, 0, 0, 1, d, 1, Math.PI / 2, 0);
    ledger.at(w / 2, y, 0, 0, 1, d, 1, Math.PI / 2, 0);
    const diag = Math.hypot(w, lift);
    brace.at(0, y - lift / 2, -d / 2, 0, 1, diag, 1, 0, Math.PI / 2 + Math.atan2(lift, w) * (l % 2 ? 1 : -1));
    for (let i = 0; i < 4; i++) board.at(0, y + 0.02, -d / 2 + 0.14 + i * 0.26);
    toe.at(0, y + 0.09, -d / 2 + 0.02);
    toe.at(0, y + 0.09, d / 2 - 0.02);
  }
  g.add(ledger.build(true, false), brace.build(true, false), board.build(), toe.build(true, false));

  const rung = instancer(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 5), mats.steel);
  for (let y = 0.3; y < H; y += 0.3) rung.at(w / 2 + 0.28, y, 0, 0, 1, 1, 1, Math.PI / 2, 0);
  g.add(rung.build(true, false));

  return g;
}

/* --- boxes on the ground -------------------------------------------------- */

/** A shipping container. `stack` puts a second one on top, offset. */
export function shippingContainer(mats, { x, z, rot = 0, color = 0x2f6f7a, len = 6.1, stack = false }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;

  const shell = (y) => {
    const c = new THREE.Group();
    const body = box(len, 2.6, 2.44, mats.container(color));
    body.position.y = y + 1.3 + 0.12;
    c.add(body);
    // Corner castings, which is what actually makes it read as a container.
    const cast = instancer(new THREE.BoxGeometry(0.24, 0.24, 0.24), mats.steelDark);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const sy of [0, 1]) {
      cast.at(sx * (len / 2 - 0.1), y + 0.12 + sy * 2.5, sz * 1.13);
    }
    c.add(cast.build());
    const base = box(len, 0.24, 2.44, mats.steelDark);
    base.position.y = y + 0.12;
    c.add(base);
    // Doors at one end.
    const doors = box(0.06, 2.3, 2.3, mats.flat(new THREE.Color(color).multiplyScalar(0.82).getHex()));
    doors.position.set(-len / 2 - 0.02, y + 1.3 + 0.12, 0);
    c.add(doors);
    const bar = instancer(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), mats.steelDark);
    for (const oz of [-0.85, -0.3, 0.3, 0.85]) bar.at(-len / 2 - 0.06, y + 1.42, oz);
    c.add(bar.build());
    return c;
  };

  g.add(shell(0));
  if (stack) {
    const top = shell(2.74);
    top.position.x = 0.5;
    g.add(top);
  }
  return shade(g, true, false);
}

/** Site office cabin: windows, a door, steps, and an air-conditioning box. */
export function siteCabin(mats, { x, z, rot = 0, w = 6.4, d = 3.0, accent = 0x0e6e6e }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;

  const skid = box(w, 0.3, d, mats.steelDark);
  skid.position.y = 0.15;
  g.add(skid);

  const body = box(w, 2.6, d, mats.container(0xe9e6dd));
  body.position.y = 1.6;
  g.add(body);

  const roof = box(w + 0.24, 0.16, d + 0.24, mats.flat(accent));
  roof.position.y = 2.98;
  g.add(roof);

  // Windows start clear of the door, which sits at the left-hand end.
  const glass = instancer(new THREE.BoxGeometry(1.25, 0.95, 0.06), mats.glass);
  const sill = instancer(new THREE.BoxGeometry(1.4, 1.1, 0.03), mats.steelDark);
  for (let ox = -w / 2 + 2.9; ox < w / 2 - 0.8; ox += 1.75) {
    sill.at(ox, 1.85, d / 2 + 0.015);
    glass.at(ox, 1.85, d / 2 + 0.035);
  }
  g.add(sill.build(true, false), glass.build(false, false));

  const door = box(0.9, 2.0, 0.07, mats.flat(accent));
  door.position.set(-w / 2 + 1.1, 1.3, d / 2 + 0.04);
  g.add(door);

  for (let i = 0; i < 2; i++) {
    const step = box(1.3, 0.16, 0.35, mats.steelDark);
    step.position.set(-w / 2 + 1.1, 0.08 + i * 0.16, d / 2 + 0.6 - i * 0.3);
    g.add(step);
  }

  const ac = box(0.8, 0.6, 0.4, mats.steel);
  ac.position.set(w / 2 - 1.2, 2.3, -d / 2 - 0.2);
  g.add(ac);

  return shade(g);
}

/* --- plant ---------------------------------------------------------------- */

export function excavator(mats, { x, z, rot = 0, color = 0xd7a418 }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  const paint = mats.flat(color);

  for (const sz of [-1.05, 1.05]) {
    const track = box(4.2, 0.85, 0.75, mats.tyre);
    track.position.set(0, 0.45, sz);
    g.add(track);
    const wheels = instancer(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 10), mats.steelDark);
    for (const ox of [-1.7, 1.7]) wheels.at(ox, 0.45, sz, 0, 1, 1, 1, 0, Math.PI / 2);
    g.add(wheels.build());
  }

  const house = box(2.9, 1.5, 2.3, paint);
  house.position.set(-0.3, 1.6, 0);
  g.add(house);

  const cab = box(1.3, 1.6, 1.5, paint);
  cab.position.set(0.6, 2.15, 0.55);
  g.add(cab);
  const cabGlass = box(1.2, 1.1, 1.42, mats.glass);
  cabGlass.position.set(0.62, 2.3, 0.56);
  g.add(cabGlass);

  const cw = box(0.7, 1.2, 2.2, mats.steelDark);
  cw.position.set(-1.85, 1.6, 0);
  g.add(cw);

  const boom = box(3.4, 0.5, 0.5, paint);
  boom.position.set(1.9, 2.7, -0.55);
  boom.rotation.z = 0.62;
  g.add(boom);

  const stick = box(2.6, 0.4, 0.42, paint);
  stick.position.set(3.5, 2.35, -0.55);
  stick.rotation.z = -0.85;
  g.add(stick);

  const bucket = box(0.9, 0.8, 1.0, mats.steelDark);
  bucket.position.set(4.4, 0.75, -0.55);
  bucket.rotation.z = 0.4;
  g.add(bucket);

  return shade(g, true, false);
}

export function dumpTruck(mats, { x, z, rot = 0, color = 0xc0451f, tipped = false }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  const paint = mats.flat(color);

  const chassis = box(7.6, 0.5, 2.4, mats.steelDark);
  chassis.position.y = 1.0;
  g.add(chassis);

  const cab = box(2.2, 1.9, 2.4, paint);
  cab.position.set(2.5, 2.2, 0);
  g.add(cab);
  const windscreen = box(0.08, 1.0, 2.1, mats.glass);
  windscreen.position.set(3.6, 2.6, 0);
  g.add(windscreen);

  const bodyPivot = new THREE.Group();
  bodyPivot.position.set(-3.4, 1.3, 0);
  bodyPivot.rotation.z = tipped ? -0.5 : 0;
  const tipper = box(4.9, 1.3, 2.5, paint);
  tipper.position.set(2.45, 0.65, 0);
  bodyPivot.add(tipper);
  g.add(bodyPivot);

  const wheels = instancer(new THREE.CylinderGeometry(0.62, 0.62, 0.44, 12), mats.tyre);
  for (const ox of [2.6, -1.6, -2.7]) for (const sz of [-1.2, 1.2]) wheels.at(ox, 0.62, sz, 0, 1, 1, 1, Math.PI / 2, 0);
  g.add(wheels.build());

  return shade(g, true, false);
}

export function mixerTruck(mats, { x, z, rot = 0, color = 0xd8d4c8 }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;

  const chassis = box(7.8, 0.5, 2.4, mats.steelDark);
  chassis.position.y = 1.0;
  g.add(chassis);

  const cab = box(2.2, 1.9, 2.4, mats.flat(0x2f6f7a));
  cab.position.set(2.6, 2.2, 0);
  g.add(cab);

  // The drum and its bands share one frame, so the bands stay on the drum no
  // matter how it is tilted.
  const drum = new THREE.Group();
  drum.position.set(-1.3, 2.5, 0);
  drum.rotation.z = Math.PI / 2 - 0.16;
  const barrel = cyl(1.15, 4.4, mats.flat(color), 16, 0.75);
  drum.add(barrel);
  const fin = instancer(new THREE.CylinderGeometry(1.03, 1.03, 0.07, 16), mats.steelDark);
  for (let i = 0; i < 4; i++) fin.at(0, -1.5 + i * 1.0, 0, 0, 1 - i * 0.07, 1, 1 - i * 0.07);
  drum.add(fin.build(true, false));
  g.add(drum);

  const chute = box(2.2, 0.16, 0.6, mats.steel);
  chute.position.set(-4.3, 1.7, 0);
  chute.rotation.z = -0.35;
  g.add(chute);

  const wheels = instancer(new THREE.CylinderGeometry(0.6, 0.6, 0.42, 12), mats.tyre);
  for (const ox of [2.7, -1.4, -2.5]) for (const sz of [-1.2, 1.2]) wheels.at(ox, 0.6, sz, 0, 1, 1, 1, Math.PI / 2, 0);
  g.add(wheels.build());

  return shade(g, true, false);
}

/* --- materials on the ground ---------------------------------------------- */

export function rebarBundle(mats, { x, z, rot = 0, len = 6, rows = 3 }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  const bar = instancer(new THREE.CylinderGeometry(0.035, 0.035, len, 5), mats.rust);
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < 9 - r; i++) {
      bar.at(0, 0.06 + r * 0.075, -0.3 + i * 0.078 + r * 0.039, 0, 1, 1, 1, 0, Math.PI / 2);
    }
  }
  g.add(bar.build());
  for (const ox of [-len / 2 + 0.6, len / 2 - 0.6]) {
    const sleeper = box(0.12, 0.12, 1.2, mats.ply);
    sleeper.position.set(ox, 0.06, 0.05);
    g.add(sleeper);
  }
  return shade(g, true, false);
}

export function pipeStack(mats, { x, z, rot = 0, len = 5, color = 0x3a4c55 }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  const pipe = instancer(new THREE.CylinderGeometry(0.24, 0.24, len, 10), mats.flat(color));
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 4 - r; i++) {
      pipe.at(0, 0.26 + r * 0.42, -0.75 + i * 0.5 + r * 0.25, 0, 1, 1, 1, 0, Math.PI / 2);
    }
  }
  g.add(pipe.build());
  return shade(g, true, false);
}

export function blockPallet(mats, { x, z, rot = 0, high = 1 }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  const slat = instancer(new THREE.BoxGeometry(1.2, 0.06, 0.14), mats.ply);
  const block = instancer(new THREE.BoxGeometry(0.38, 0.19, 0.19), mats.flat(0x9b9284));
  for (let h = 0; h < high; h++) {
    const y0 = h * 0.86;
    for (let i = 0; i < 5; i++) slat.at(0, y0 + 0.03, -0.5 + i * 0.25);
    for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) for (let j = 0; j < 5; j++) {
      block.at(-0.4 + i * 0.4, y0 + 0.16 + r * 0.2, -0.48 + j * 0.24);
    }
  }
  g.add(slat.build(), block.build());
  return shade(g, true, false);
}

export function lumberStack(mats, { x, z, rot = 0, len = 4 }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  const plank = instancer(new THREE.BoxGeometry(len, 0.09, 0.22), mats.ply);
  for (let r = 0; r < 6; r++) for (let i = 0; i < 4; i++) plank.at(0, 0.06 + r * 0.1, -0.4 + i * 0.26);
  g.add(plank.build());
  return shade(g, true, false);
}

/** A drum of cable on its side: two plywood cheeks, a hub, and the coil. */
export function cableReel(mats, { x, z, rot = 0, r = 0.9 }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  const half = r * 0.5;

  // Cheeks and coil all lie on the same axis. Rolling the cheeks about Z and
  // the drum about X put them at right angles to each other, which is how this
  // ended up looking like a burst sack rather than a reel.
  const cheek = instancer(new THREE.CylinderGeometry(r, r, 0.07, 16), mats.ply);
  for (const s of [-1, 1]) cheek.at(0, r, s * half, 0, 1, 1, 1, Math.PI / 2, 0);
  g.add(cheek.build());

  const coil = cyl(r * 0.74, half * 1.75, mats.dark, 16);
  coil.rotation.x = Math.PI / 2;
  coil.position.y = r;
  g.add(coil);

  const hub = cyl(r * 0.16, half * 2.3, mats.steelDark, 8);
  hub.rotation.x = Math.PI / 2;
  hub.position.y = r;
  g.add(hub);

  return shade(g, true, false);
}

export function spoilPile(mats, { x, z, r = 3.2, h = 1.6, rot = 0 }) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 12, 1), mats.earth);
  m.position.set(x, h / 2, z);
  m.rotation.y = rot;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* --- small repeated things ------------------------------------------------ */

/** One draw call for every traffic cone on the site. */
export function cones(mats, list) {
  const geo = new THREE.ConeGeometry(0.19, 0.62, 8);
  const inst = instancer(geo, mats.safety);
  const base = instancer(new THREE.BoxGeometry(0.36, 0.04, 0.36), mats.dark);
  for (const [x, z] of list) { inst.at(x, 0.33, z); base.at(x, 0.02, z); }
  const g = new THREE.Group();
  g.add(inst.build(true, false), base.build(false, true));
  return g;
}

export function barriers(mats, list) {
  // A jersey barrier is a trapezoid; a box with a smaller box on top is close
  // enough at the distance anyone ever looks at one. What actually makes it
  // read as a barrier rather than a kerbstone is the marking: a hazard band
  // down each face and a reflector at each end.
  const g = new THREE.Group();
  const foot = instancer(new THREE.BoxGeometry(2.0, 0.4, 0.6), mats.paint);
  const top = instancer(new THREE.BoxGeometry(2.0, 0.55, 0.3), mats.paint);
  const stripeGeo = tileUV(new THREE.BoxGeometry(1.94, 0.26, 0.34), 4, 1);
  const stripe = instancer(stripeGeo, mats.hazard);
  const eye = instancer(new THREE.BoxGeometry(0.1, 0.12, 0.34), mats.safety);
  for (const [x, z, rot] of list) {
    const r = rot || 0;
    foot.at(x, 0.2, z, r);
    top.at(x, 0.67, z, r);
    stripe.at(x, 0.72, z, r);
    for (const s of [-1, 1]) {
      eye.at(x + Math.cos(r) * s * 0.94, 0.5, z - Math.sin(r) * s * 0.94, r);
    }
  }
  g.add(foot.build(), top.build(), stripe.build(true, false), eye.build(false, false));
  return g;
}

export function drums(mats, list) {
  const g = new THREE.Group();
  const body = instancer(new THREE.CylinderGeometry(0.3, 0.3, 0.88, 12), mats.safety);
  const band = instancer(new THREE.CylinderGeometry(0.315, 0.315, 0.12, 12), mats.paint);
  for (const [x, z] of list) {
    body.at(x, 0.44, z);
    band.at(x, 0.3, z); band.at(x, 0.62, z);
  }
  g.add(body.build(), band.build(true, false));
  return g;
}

/**
 * A drawing table: trestles, a ply top and a sheet on it, with a couple of
 * rolled drawings leaning on the leg. The one piece of furniture the compounds
 * actually need — a yard with nothing at waist height reads as a car park.
 */
export function planTable(mats, { x, z, rot = 0, accent = 0x2b6cb0, w = 2.4, d = 1.2 }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;

  const H = 0.86;
  const leg = instancer(new THREE.BoxGeometry(0.07, H, 0.07), mats.steelDark);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) leg.at(sx * (w / 2 - 0.16), H / 2, sz * (d / 2 - 0.14));
  }
  // Cross-brace, so the legs read as trestles rather than four sticks.
  const brace = instancer(new THREE.BoxGeometry(w - 0.3, 0.05, 0.05), mats.steelDark);
  brace.at(0, 0.24, -(d / 2 - 0.14));
  brace.at(0, 0.24, d / 2 - 0.14);
  g.add(leg.build(true, false), brace.build(true, false));

  const top = new THREE.Mesh(tileUV(new THREE.BoxGeometry(w, 0.06, d), w / 1.6, d / 1.6), mats.ply);
  top.position.y = H;
  g.add(top);

  // The drawing itself: a pale sheet with a title block and grid lines in the
  // compound's colour, drawn as thin planes so it costs nothing.
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.78, d * 0.74), mats.paint);
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.set(0, H + 0.035, 0);
  g.add(sheet);

  const inkMat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 5; i++) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, 0.012), inkMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(-w * 0.06, H + 0.04, -d * 0.24 + i * 0.11);
    g.add(line);
  }
  const block = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.2, d * 0.2), inkMat);
  block.rotation.x = -Math.PI / 2;
  block.position.set(w * 0.26, H + 0.04, d * 0.24);
  g.add(block);

  // Rolled up drawings, leaning where you would actually drop them.
  const roll = instancer(new THREE.CylinderGeometry(0.045, 0.045, 1.0, 7), mats.paint);
  roll.at(-w / 2 + 0.1, 0.5, d / 2 - 0.05, 0, 1, 1, 1, 0.22, 0.16);
  roll.at(-w / 2 + 0.22, 0.5, d / 2 - 0.12, 0, 1, 1, 1, 0.18, -0.1);
  g.add(roll.build(true, false));

  shade(top, true, true);
  return g;
}

/**
 * A surveyor's tripod with the instrument on it. Milestone Row is a survey
 * line, so this is the thing that says what the yard is for.
 */
export function surveyTripod(mats, { x, z, rot = 0, accent = 0x8a5fa8, h = 1.35 }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;

  // Each leg gets its own pivot: yaw the pivot, tilt the leg inside it. Doing
  // it with a single Euler instead would compose the two rotations in the wrong
  // order and splay the legs in three different directions.
  const legLen = h * 1.14;
  const legGeo = new THREE.BoxGeometry(0.045, legLen, 0.045);
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (i * Math.PI * 2) / 3;
    const leg = new THREE.Mesh(legGeo, mats.ply);
    leg.rotation.x = -0.30;
    leg.position.set(0, h / 2, Math.sin(0.30) * legLen / 2);
    pivot.add(leg);
    g.add(pivot);
  }

  const head = box(0.26, 0.09, 0.26, mats.steelDark);
  head.position.y = h;
  g.add(head);
  const body = box(0.2, 0.24, 0.16, mats.flat(accent));
  body.position.y = h + 0.17;
  g.add(body);
  const scope = cyl(0.045, 0.3, mats.steel, 8);
  scope.rotation.z = Math.PI / 2;
  scope.position.set(0, h + 0.26, 0);
  g.add(scope);

  shade(g, true, false);
  return g;
}

/** Survey stakes with flagging tape — the marker for Milestone Row. */
export function surveyStakes(mats, list, accent) {
  const g = new THREE.Group();
  const stake = instancer(new THREE.BoxGeometry(0.05, 0.9, 0.05), mats.ply);
  const flagMat = new THREE.MeshLambertMaterial({ color: accent, side: THREE.DoubleSide });
  const flag = instancer(new THREE.PlaneGeometry(0.28, 0.16), flagMat);
  list.forEach(([x, z], i) => {
    stake.at(x, 0.45, z);
    flag.at(x + 0.14, 0.82, z, i * 1.7);
  });
  g.add(stake.build(true, false), flag.build(false, false));
  return g;
}

/**
 * A floodlight mast. In daylight it is just steel; at night the lamps light up
 * and a spot light is hung on it by modules/lighting.js.
 */
export function floodlightMast(mats, { x, z, h = 9, aim = 0, heads = 2 }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = aim;

  const base = box(1.4, 0.35, 1.4, mats.concrete);
  base.position.y = 0.17;
  g.add(base);

  const mast = cyl(0.11, h, mats.steel, 8, 0.08);
  mast.position.y = h / 2 + 0.35;
  g.add(mast);

  const arm = box(1.9, 0.09, 0.09, mats.steel);
  arm.position.y = h + 0.3;
  g.add(arm);

  const lampMat = mats.night ? mats.lampOn : mats.lampOff;
  for (let i = 0; i < heads; i++) {
    const ox = heads === 1 ? 0 : -0.7 + i * 1.4;
    const housing = box(0.6, 0.34, 0.42, mats.steelDark);
    housing.position.set(ox, h + 0.12, 0);
    housing.rotation.x = 0.5;
    g.add(housing);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.3), lampMat);
    face.position.set(ox, h - 0.04, 0.2);
    face.rotation.x = 0.5 - Math.PI / 2;
    g.add(face);
  }

  shade(g, true, false);
  base.receiveShadow = true;
  g.userData.lampY = h;
  return g;
}

/**
 * The city the site is being built in: a ring of hazed silhouettes plus a
 * couple of distant cranes. Two draw calls, and without it the horizon is a
 * flat line where the ground stops.
 *
 * The ring sits well inside the fog's far plane on purpose. Pushed out beyond
 * it, every block resolves to exactly the fog colour and reads as a pale card
 * pasted onto a blue sky; kept inside, the fog only half-takes them and they
 * stay darker than what is behind them, which is what makes a silhouette.
 */
export function skyline(mats, { radius = 148, count = 96, seed = 4242 }) {
  let s = seed >>> 0;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

  // Unlit: the ring is meant to sit in the fog as a silhouette, and a lit
  // material would give the near faces a sunlit edge the fog cannot swallow.
  const dark = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const blocks = instancer(new THREE.BoxGeometry(1, 1, 1), dark);
  const tints = [];
  const base = new THREE.Color(mats.skylineColor);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rand() * 0.06;
    const r = radius + rand() * 74;
    const w = 12 + rand() * 24, h = 12 + rand() * rand() * 46, d = 12 + rand() * 24;
    blocks.at(Math.sin(a) * r, h / 2, Math.cos(a) * r, a, w, h, d);
    // One flat colour across the whole ring reads as cut card. A little tonal
    // spread is all it takes for the blocks to separate from each other.
    tints.push(base.clone().multiplyScalar(0.78 + rand() * 0.34));
  }
  const g = new THREE.Group();
  const mesh = blocks.build(false, false);
  tints.forEach((c, i) => mesh.setColorAt(i, c));
  mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  g.add(mesh);

  // Distant cranes, so the skyline reads as a city that is also being built.
  const boomMat = new THREE.MeshBasicMaterial({ color: mats.skylineColor });
  const boom = instancer(new THREE.BoxGeometry(1, 0.9, 0.9), boomMat);
  for (let i = 0; i < 5; i++) {
    const a = rand() * Math.PI * 2;
    const r = radius + 40 + rand() * 60;
    const h = 40 + rand() * 26;
    boom.at(Math.sin(a) * r, h / 2, Math.cos(a) * r, 0, 1.6, h, 1.6);
    boom.at(Math.sin(a) * r, h, Math.cos(a) * r, rand() * 3, 52, 1.2, 1.2);
  }
  const bmesh = boom.build(false, false);
  bmesh.frustumCulled = false;
  g.add(bmesh);
  return g;
}
