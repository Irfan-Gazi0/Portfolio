import * as THREE from 'three';

/* The follow camera.

   A spring arm: the camera wants to sit `dist` behind the worker's shoulders at
   the current yaw and elevation, and eases toward that every frame rather than
   snapping to it. The easing is the whole reason a third-person view feels like
   a camera rather than a rigid mount.

   Two things stop it from being useless in practice. It pulls in when hoarding
   would come between it and the worker, so walking along a run never leaves you
   staring at plywood; and it can drop to first person, because reading a board
   from two metres away is genuinely better with your eye where the worker's is.
*/

const FOCUS_Y = 1.55;          // shoulder height on the worker
const SHOULDER = 0.42;         // offset to the right, so the figure is off-centre
const MIN_DIST = 2.4;
const MAX_DIST = 11;
const PITCH_MIN = -0.30;       // looking up from below
const PITCH_MAX = 1.12;        // looking almost straight down
const SKIN = 0.45;             // how far clear of a wall the camera stops

export function createFollowCam({ camera, worker, collider }) {
  // 5.2, not the 6.4 this started at. The arm is added to however far the worker
  // stands off a board, so at 6.4 a 3 m board was 8% of the frame from the one
  // place the site puts you to read it, and a 24 m yard read as empty.
  const state = { yaw: Math.PI, pitch: 0.30, dist: 5.2, first: false };

  const focus = new THREE.Vector3();
  const want = new THREE.Vector3();
  const right = new THREE.Vector3();
  const smoothed = new THREE.Vector3(0, 8, 10);
  const lookAt = new THREE.Vector3();
  let started = false;

  /**
   * How far along the segment from `focus` out to the desired camera position
   * we can travel before hitting something. Slab method against every collider
   * box, in 2D — every one of them is a full-height run of hoarding or fence,
   * so height never changes the answer.
   */
  function clearDistance(fx, fz, dx, dz, dist) {
    let best = dist;
    for (const b of collider.boxes) {
      const minX = b.minX - SKIN, maxX = b.maxX + SKIN;
      const minZ = b.minZ - SKIN, maxZ = b.maxZ + SKIN;
      // Standing inside a box (walking through a gate) means nothing to dodge.
      if (fx > minX && fx < maxX && fz > minZ && fz < maxZ) continue;

      let t0 = 0, t1 = best;
      for (const [o, d, lo, hi] of [[fx, dx, minX, maxX], [fz, dz, minZ, maxZ]]) {
        if (Math.abs(d) < 1e-6) {
          if (o < lo || o > hi) { t0 = t1 + 1; break; }
          continue;
        }
        let a = (lo - o) / d, b2 = (hi - o) / d;
        if (a > b2) { const tmp = a; a = b2; b2 = tmp; }
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, b2);
      }
      if (t0 <= t1 && t0 < best) best = Math.max(0, t0);
    }
    return best;
  }

  function update(dt) {
    const p = worker.root.position;

    if (state.first) {
      // Eye height, looking where the camera yaw points. The worker turns with
      // it, so the figure never ends up walking sideways out of shot.
      focus.set(p.x, p.y + 1.66, p.z);
      camera.position.lerp(focus, started ? 1 - Math.exp(-30 * dt) : 1);
      // View direction is the third-person arm reversed, so positive pitch
      // keeps meaning "looking down" in both modes.
      const cp = Math.cos(state.pitch);
      lookAt.set(
        camera.position.x - Math.sin(state.yaw) * cp,
        camera.position.y - Math.sin(state.pitch),
        camera.position.z - Math.cos(state.yaw) * cp,
      );
      camera.lookAt(lookAt);
      started = true;
      return;
    }

    focus.set(p.x, p.y + FOCUS_Y, p.z);
    // Nudge the focus sideways so the worker sits off-centre and the board you
    // are walking toward is not permanently behind their hard hat.
    right.set(Math.cos(state.yaw), 0, -Math.sin(state.yaw)).multiplyScalar(SHOULDER);
    focus.add(right);

    const cp = Math.cos(state.pitch);
    const dx = Math.sin(state.yaw) * cp;
    const dy = Math.sin(state.pitch);
    const dz = Math.cos(state.yaw) * cp;

    const dist = clearDistance(focus.x, focus.z, dx, dz, state.dist);
    want.set(focus.x + dx * dist, focus.y + dy * dist, focus.z + dz * dist);
    // Never let the camera drop through the ground on a low elevation angle.
    want.y = Math.max(want.y, 0.55);

    // Pulling in has to be instant or the hoarding clips through the view for a
    // frame; easing back out is what stops it snapping as you clear a corner.
    const pullingIn = dist < state.dist - 0.02;
    const k = pullingIn ? 42 : 25;
    smoothed.lerp(want, started ? 1 - Math.exp(-k * dt) : 1);
    camera.position.copy(smoothed);
    camera.lookAt(focus.x, focus.y - 0.12, focus.z);
    started = true;
  }

  function look(dx, dy) {
    state.yaw -= dx;
    state.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, state.pitch + dy));
  }

  function zoom(delta) {
    state.dist = Math.max(MIN_DIST, Math.min(MAX_DIST, state.dist + delta));
  }

  function setFirstPerson(on) {
    state.first = on;
    worker.setVisible(!on);
    state.pitch = Math.max(-0.9, Math.min(0.9, state.first ? 0.1 : 0.30));
    started = false;
  }

  function toggle() { setFirstPerson(!state.first); return state.first; }

  /**
   * Forget where the camera was standing, so the next update puts it exactly
   * where the arm wants it instead of easing toward it.
   *
   * This is what a jump across the site needs. Without it the spring arm does
   * its job far too well: it eases forty metres over half a second, and the
   * first frame after a fast travel is a smear of everything in between.
   */
  function snap() { started = false; }

  /** Where the camera is aiming, flattened onto the ground plane. */
  const flat = new THREE.Vector3();
  function forward() {
    return flat.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
  }

  return { state, update, look, zoom, toggle, setFirstPerson, forward, snap };
}
