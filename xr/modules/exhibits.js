import * as THREE from 'three';
import { EXHIBITS } from '../data/cv.js';
import { zoneById, slotPositions, wallPlacement, boardSize } from './site.js';
import { captionPlate, placeholderFace, sheetFace } from './label.js';
import { instancer } from './props.js';

export { boardSize };

/* The boards on the hoarding.

   Each one is a printed panel in an aluminium surround, on a steel backing,
   over a title block naming the work — the way a site displays a drawing or a
   contractor displays a scheme. Approaching one and pressing E opens the real
   entry in the DOM panel.

   Images load per compound on entry, never up front. Five yards of figures
   fetched eagerly is what would stall a phone at the gate; geometry is built
   immediately, so every yard is walkable while its pictures fill in. */

const CENTRE_Y = 3.1;         // boards hang to a common centre line
const MIN_PLATE_BOTTOM = 0.68; // clear of the concrete plinth
const PLATE_GAP = 0.16;
const FRAME_BORDER = 0.075;
const FRAME_DEPTH = 0.055;
const PLATE_MAX_W = 3.2;

export function buildExhibits(scene, pal, renderer) {
  const group = new THREE.Group();
  const items = [];
  const loader = new THREE.TextureLoader();
  const loadedZones = new Set();

  const backMat = new THREE.MeshLambertMaterial({ color: pal.boardBack });
  const bracketMat = new THREE.MeshLambertMaterial({ color: pal.steelDark });
  const hoodMat = new THREE.MeshLambertMaterial({ color: pal.boardFrame });
  const brackets = instancer(new THREE.BoxGeometry(0.09, 0.09, 0.16), bracketMat);

  // Group by compound + run so slots can be spaced against the actual run length.
  const byWall = new Map();
  for (const ex of EXHIBITS) {
    const key = ex.zone + ':' + ex.wall;
    if (!byWall.has(key)) byWall.set(key, []);
    byWall.get(key).push(ex);
  }

  for (const [key, list] of byWall) {
    const [zoneId, wall] = key.split(':');
    const zone = zoneById[zoneId];
    if (!zone) { console.warn('[site] board references unknown compound:', zoneId); continue; }

    list.sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
    const coords = slotPositions(zone, wall, list.map((ex) => boardSize(ex)[0]));

    list.forEach((ex, i) => {
      if (coords[i] === undefined) {
        console.warn(`[site] ${zoneId}/${wall}: no run left for "${ex.id}"`);
        return;
      }
      const [w, h] = boardSize(ex);

      const plate = captionPlate(ex.title, ex.venue, Math.min(w, PLATE_MAX_W), zone.accent);
      const plateH = plate.userData.plateHeight;

      // Hang to the common centre line, then lift the whole assembly if the
      // title block would otherwise run into the plinth. Titles vary from one
      // line to four, so a fixed plate height would either waste the run or
      // bury the long ones.
      let centreY = CENTRE_Y;
      const plateBottom = centreY - h / 2 - PLATE_GAP - plateH;
      if (plateBottom < MIN_PLATE_BOTTOM) centreY += MIN_PLATE_BOTTOM - plateBottom;

      const node = new THREE.Group();
      const { position, rotationY } = wallPlacement(zone, wall, coords[i], 0);
      node.position.copy(position);
      node.rotation.y = rotationY;
      group.add(node);

      // Backing panel: a steel sheet a little larger than the print, so the
      // board sits off the hoarding rather than being painted onto it.
      const back = new THREE.Mesh(
        new THREE.BoxGeometry(w + FRAME_BORDER * 2 + 0.1, h + FRAME_BORDER * 2 + 0.1, 0.05),
        backMat,
      );
      back.position.set(0, centreY, 0);
      back.castShadow = true;
      back.receiveShadow = true;
      node.add(back);

      // Aluminium surround, four bars rather than a slab — the edge highlight
      // is what makes a flat print read as a mounted board.
      const frameMat = new THREE.MeshLambertMaterial({ color: pal.boardFrame });
      const frame = new THREE.Group();
      const fw = w + FRAME_BORDER * 2, fh = h + FRAME_BORDER * 2;
      for (const [bw, bh, bx, by] of [
        [fw, FRAME_BORDER, 0, (fh - FRAME_BORDER) / 2],
        [fw, FRAME_BORDER, 0, -(fh - FRAME_BORDER) / 2],
        [FRAME_BORDER, fh - FRAME_BORDER * 2, -(fw - FRAME_BORDER) / 2, 0],
        [FRAME_BORDER, fh - FRAME_BORDER * 2, (fw - FRAME_BORDER) / 2, 0],
      ]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, FRAME_DEPTH), frameMat);
        bar.position.set(bx, centreY + by, FRAME_DEPTH / 2 + 0.026);
        bar.castShadow = true;
        frame.add(bar);
      }
      node.add(frame);

      const faceMat = ex.texture
        ? new THREE.MeshBasicMaterial({ color: pal.boardBack })   // until the image lands
        : sheetFace(ex, w, h, zone.accent);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), faceMat);
      face.position.set(0, centreY, FRAME_DEPTH / 2 + 0.03);
      node.add(face);

      // Hooded lamp over the board. Unlit geometry, so it costs nothing — but
      // after dark the glow strip is what tells you a board is there at all.
      // It does not cast: an 11 cm slab hung flat against the hoarding throws
      // a smudge nobody can read, for the same shadow-pass draw call the crane
      // costs. The board and its surround are the silhouette that matters.
      const hood = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w, 1.6), 0.11, 0.34), hoodMat);
      hood.position.set(0, centreY + fh / 2 + 0.16, 0.2);
      hood.rotation.x = 0.34;
      hood.castShadow = false;
      node.add(hood);

      const lampMat = new THREE.MeshBasicMaterial({
        color: pal.lampGlow, transparent: true,
        opacity: pal.night ? 0.85 : 0.14, depthWrite: false,
      });
      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w, 1.5), 0.06), lampMat);
      lamp.position.set(0, centreY + fh / 2 + 0.11, 0.3);
      lamp.rotation.x = -1.2;
      node.add(lamp);

      plate.position.set(0, centreY - h / 2 - PLATE_GAP - plateH / 2, 0.14);
      node.add(plate);

      // Accent bar under the board, brightened while it is focused.
      const glowMat = new THREE.MeshBasicMaterial({
        color: zone.accent, transparent: true, opacity: 0.0, depthWrite: false,
      });
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(fw, 0.07), glowMat);
      glow.position.set(0, centreY - fh / 2 - 0.055, FRAME_DEPTH / 2 + 0.032);
      node.add(glow);

      // Fixings at the corners of the backing panel.
      const bx = fw / 2 - 0.02, by = fh / 2 - 0.02;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        const p = new THREE.Vector3(sx * bx, centreY + sy * by, 0.02).applyAxisAngle(
          new THREE.Vector3(0, 1, 0), rotationY,
        );
        brackets.at(position.x + p.x, p.y, position.z + p.z, rotationY);
      }

      const anchor = new THREE.Vector3(position.x, centreY, position.z);
      // Direction along the run, perpendicular to the board's normal. Focus is
      // measured against the nearest point on this span rather than the centre,
      // so a 5 m board still registers when you stand at one end of it.
      const along = new THREE.Vector3(Math.cos(rotationY), 0, -Math.sin(rotationY));
      items.push({
        data: ex, zone, node, frame, face, glow, lamp, anchor, along,
        halfWidth: w / 2,
        baseFrameColor: new THREE.Color(pal.boardFrame),
        baseLamp: pal.night ? 0.85 : 0.14,
        accent: new THREE.Color(zone.accent),
        frameMat,
      });
    });
  }

  // The corner fixings are 9 cm. Same reasoning as the hood: too small to read
  // as a shadow, and one more pass over the whole scene to draw them.
  group.add(brackets.build(false, false));

  /** Load the images for one compound. Safe to call repeatedly. */
  function loadZone(zoneId) {
    if (loadedZones.has(zoneId)) return;
    loadedZones.add(zoneId);
    for (const it of items) {
      if (it.zone.id !== zoneId || !it.data.texture) continue;
      loader.load(
        it.data.texture,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 8;
          it.face.material.dispose();
          it.face.material = new THREE.MeshBasicMaterial({ map: tex });
          // Fetching early only moves the fetch. What costs a frame is the
          // upload and the mipmap chain, and three.js does that lazily on the
          // first frame the board is drawn — which, loading on entry, is the
          // frame you walk through the gate. Forcing it here spends it on a
          // frame of our choosing instead of the one that is being watched.
          renderer.initTexture(tex);
        },
        undefined,
        () => {
          console.warn('[site] board image failed:', it.data.texture);
          const [w, h] = boardSize(it.data);
          it.face.material.dispose();
          it.face.material = placeholderFace(it.data.title, it.data.venue, w, h, it.zone.accent);
        },
      );
    }
  }

  /** Highlight exactly one board (or none). */
  function setFocus(target) {
    for (const it of items) {
      const on = it === target;
      it.glow.material.opacity += ((on ? 0.95 : 0) - it.glow.material.opacity) * 0.25;
      it.frameMat.color.lerp(on ? it.accent : it.baseFrameColor, 0.18);
      const wantLamp = on ? Math.max(it.baseLamp, 0.8) : it.baseLamp;
      it.lamp.material.opacity += (wantLamp - it.lamp.material.opacity) * 0.2;
    }
  }

  scene.add(group);
  return { group, items, loadZone, setFocus };
}
