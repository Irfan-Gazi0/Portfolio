import * as THREE from 'three';

/* Picks the board the player means.

   Proximity plus facing, rather than a strict raycast. A raycast through the
   exact screen centre is fussy to aim on a phone and punishes small camera
   movement — and in third person the screen centre is not even where the worker
   is standing. Here anything within RANGE of the worker and inside a generous
   cone from the camera counts, and the one nearest the centre of view wins.

   The two positions do different jobs on purpose: distance is measured from the
   worker, because that is who is standing in front of the board, while aim is
   measured from the camera, because that is what the player is pointing. */

const RANGE = 7.5;
const CONE = Math.cos(THREE.MathUtils.degToRad(52));

const fwd = new THREE.Vector3();
const eye = new THREE.Vector3();
const to = new THREE.Vector3();
const near = new THREE.Vector3();

export function createInteraction({ camera, worker, items }) {
  let focus = null;

  function update() {
    eye.copy(worker.eyePosition());
    camera.getWorldDirection(fwd);
    // Aim is measured on the ground plane. Boards hang above eye level, so the
    // true 3D angle would widen exactly as you step close to a large one and
    // drop focus at the moment you are most obviously looking at it.
    const fLen = Math.hypot(fwd.x, fwd.z) || 1;
    const fx = fwd.x / fLen, fz = fwd.z / fLen;

    let best = null, bestScore = -Infinity;
    for (const it of items) {
      // Boards face into their yard. From behind one you are on the far side of
      // the hoarding it hangs on, and it is not yours to open.
      const ry = it.node.rotation.y;
      if ((eye.x - it.anchor.x) * Math.sin(ry) + (eye.z - it.anchor.z) * Math.cos(ry) < 0) continue;

      // Nearest point on the board's span, not its centre: standing at one end
      // of a 5 m board should still count as looking at it.
      to.subVectors(eye, it.anchor);
      const t = Math.max(-it.halfWidth, Math.min(it.halfWidth, to.dot(it.along)));
      near.copy(it.along).multiplyScalar(t).add(it.anchor);

      to.subVectors(near, eye);
      const dist = to.length();
      if (dist > RANGE || dist < 0.001) continue;

      const flat = Math.hypot(to.x, to.z);
      if (flat < 0.001) continue;
      const aim = (to.x / flat) * fx + (to.z / flat) * fz;
      if (aim < CONE) continue;

      // Aim dominates; distance only breaks ties between similarly-aimed boards.
      const score = aim * 2 - dist / RANGE;
      if (score > bestScore) { bestScore = score; best = it; }
    }
    focus = best;
    return focus;
  }

  return { update, get focus() { return focus; } };
}
