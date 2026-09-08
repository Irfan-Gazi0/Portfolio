/* WebXR: deliberately a stub in v1.

   Shipping untestable controller code would be worse than shipping none. What
   v1 does instead is keep the four things that make a headset mode additive
   rather than a rewrite:

     1. Camera control and locomotion are already separate. The worker
        (modules/worker.js) is what moves through the site; the follow camera
        (modules/followcam.js) only reads it. An immersive session takes over
        the camera and leaves the worker exactly where it is.
     2. Locomotion is one interface returning a displacement and a heading
        (modules/movement.js), so a teleport or a thumbstick implementation
        slots in alongside WASD and the touch sticks.
     3. Panel content generation is separate from DOM rendering
        (modules/panel.js), because a DOM overlay does not composite into an
        immersive session.
     4. The site is built at true scale — 1 unit is 1 metre, the hoarding is
        5.6 m, boards hang on a 3.1 m centre line — so nothing is accidentally
        sized wrong for a headset.

   To turn it on later: set `renderer.xr.enabled = true`, append
   `VRButton.createButton(renderer)`, swap the render loop to
   `renderer.setAnimationLoop`, add a teleport locomotion mode, and hide the
   worker's own mesh in first person (`worker.setVisible(false)`), which the
   first-person view already does. The import map in index.html resolves
   `three/addons/`, and VRButton lives at `three/addons/webxr/VRButton.js`.
*/

export function initXR() {
  return { supported: false, reason: 'not enabled in this version' };
}

/** Whether the browser could offer an immersive session at all. Report only. */
export async function probeXR() {
  if (!navigator.xr?.isSessionSupported) return false;
  try { return await navigator.xr.isSessionSupported('immersive-vr'); }
  catch { return false; }
}
