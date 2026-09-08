import * as THREE from 'three';

/* Site lighting.

   Daylight is three lights and nothing else: a sun, a hemisphere for the bounce
   off the sky and the dirt, and a little ambient so nothing in shade goes to
   black. That is what keeps a phone interactive — every extra light multiplies
   the work every lit fragment does.

   After dark the sun becomes a weak moon and the floodlight masts take over,
   one spot each. They are the only reason the night scene is legible, so they
   are worth the cost — but only then, and only unshadowed. */

export function buildLighting(scene, pal, masts, shadowSize) {
  const group = new THREE.Group();

  group.add(new THREE.AmbientLight(pal.ambient, pal.ambientI));
  group.add(new THREE.HemisphereLight(pal.hemiSky, pal.hemiGround, pal.hemiI));

  const sun = new THREE.DirectionalLight(pal.sun, pal.sunI);
  sun.position.set(...pal.sunPos);
  group.add(sun);
  group.add(sun.target);

  if (shadowSize > 0) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    // A tight frustum that travels with the player. Framing the whole 120 m
    // site instead would spread the same texels over 100x the area and give
    // shadows too coarse to read as anything.
    const R = 34;
    const cam = sun.shadow.camera;
    cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R;
    cam.near = 1; cam.far = 190;
    cam.updateProjectionMatrix();
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 2.2;
  }

  const lamps = [];
  if (pal.floodI > 0) {
    for (const m of masts) {
      const spot = new THREE.SpotLight(pal.lampGlow, pal.floodI, 104, 0.82, 0.6, 1.05);
      spot.position.set(m.x, m.h + 0.1, m.z);
      spot.target.position.set(m.target ? m.target[0] : m.x, 0, m.target ? m.target[1] : m.z);
      group.add(spot, spot.target);
      lamps.push(spot);
    }
  }

  scene.add(group);

  const off = new THREE.Vector3(...pal.sunPos).normalize().multiplyScalar(85);

  /** Keep the shadow frustum centred on the player. */
  function update(x, z) {
    if (!sun.castShadow) return;
    sun.target.position.set(x, 0, z);
    sun.position.set(x + off.x, off.y, z + off.z);
    sun.target.updateMatrixWorld();
  }

  return { group, sun, lamps, update };
}
