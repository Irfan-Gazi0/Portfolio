/* Axis-aligned box collision against the static obstacle list.

   Everything solid on the site — hoarding runs, the perimeter fence, container
   footprints, plant, mast bases — is a box on the XZ plane, and the worker is a
   circle of radius PLAYER_RADIUS. Because every box is axis-aligned we can
   resolve by pushing out along whichever axis has the smallest overlap: cheap,
   stable, and it slides along a run of hoarding rather than sticking to it. Two
   passes settle the inside corners where two runs meet.

   Nothing here is height-aware, which is the one thing to know before adding an
   obstacle: a box stops the worker no matter how low it is. That is why cones,
   kerbs and stacked timber are placed without colliders and simply walked
   over — being blocked by a traffic cone is worse than clipping one. */

export const PLAYER_RADIUS = 0.42;

export function createCollider(boxes) {
  function resolve(x, z) {
    let px = x, pz = z;
    for (let pass = 0; pass < 2; pass++) {
      let moved = false;
      for (const b of boxes) {
        const minX = b.minX - PLAYER_RADIUS, maxX = b.maxX + PLAYER_RADIUS;
        const minZ = b.minZ - PLAYER_RADIUS, maxZ = b.maxZ + PLAYER_RADIUS;
        if (px <= minX || px >= maxX || pz <= minZ || pz >= maxZ) continue;

        const dLeft = px - minX, dRight = maxX - px;
        const dUp = pz - minZ, dDown = maxZ - pz;
        const m = Math.min(dLeft, dRight, dUp, dDown);
        if (m === dLeft) px = minX;
        else if (m === dRight) px = maxX;
        else if (m === dUp) pz = minZ;
        else pz = maxZ;
        moved = true;
      }
      if (!moved) break;
    }
    return { x: px, z: pz };
  }
  return { resolve, boxes };
}
