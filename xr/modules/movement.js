import * as THREE from 'three';

/* Input and locomotion.

   Everything the player can do with a keyboard, a mouse, or two thumbs is
   gathered here and comes out as one thing: the world-space displacement the
   worker wants this frame, plus the heading they should be facing. The caller
   resolves that against collision and writes the worker.

   Movement is camera-relative — pushing forward means "away from the camera",
   not "along the worker's nose" — because in third person those are different
   directions and only the first is what anyone means. */

const WALK = 3.6;
const RUN = 6.6;
const ACCEL = 15;
const DAMP = 13;
const LOOK_SENS = 0.0024;
const TOUCH_LOOK_SENS = 0.0042;
const STICK_RANGE = 54;
const RUN_THRESHOLD = 0.86;   // push the thumbstick past this and you jog

export function createMovement({ canvas, followcam, joystick }) {
  const state = {
    started: false,   // the visitor has been through induction
    locked: false,    // pointer lock is currently held
    touch: false,
    enabled: true,
    running: false,
  };

  const keys = Object.create(null);
  const vel = new THREE.Vector3();
  const want = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();

  /* --- keyboard --- */
  const MOVE_KEYS = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
  ]);
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    // Arrows and space scroll the page behind the canvas otherwise — but only
    // while locomotion is the thing reading them. An overlay on top of the site
    // (the induction card, the board panel) is a scrollable document of its
    // own, and swallowing its keys leaves a keyboard user unable to reach the
    // bottom of it.
    if (!state.enabled || !state.started) return;
    if (MOVE_KEYS.has(e.code) && !e.metaKey && !e.ctrlKey) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  /* --- mouse look ---
     Pointer lock when we can get it, drag-to-look when we cannot. The fallback
     is not only for old browsers: lock can be refused inside an iframe, denied
     by policy, or dropped by the OS, and without it there would be no way to
     turn the camera at all. */
  let dragging = false;

  canvas.addEventListener('mousemove', (e) => {
    if (state.locked || dragging) {
      followcam.look((e.movementX || 0) * LOOK_SENS, (e.movementY || 0) * LOOK_SENS);
    }
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    document.body.classList.remove('is-dragging');
  });

  canvas.addEventListener('wheel', (e) => {
    if (!state.started) return;
    e.preventDefault();
    followcam.zoom(Math.sign(e.deltaY) * 0.85);
  }, { passive: false });

  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
    document.body.classList.toggle('is-locked', state.locked);
  });

  function start() {
    state.started = true;
    requestLock();
  }

  function requestLock() {
    if (state.touch || state.locked) return;
    try {
      const p = canvas.requestPointerLock?.();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch { /* falls back to drag-to-look */ }
  }

  /* --- touch: left thumb drives, right thumb looks --- */
  const stick = { id: null, ox: 0, oy: 0, dx: 0, dy: 0, mag: 0 };
  const look = { id: null, x: 0, y: 0 };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') {
      state.started = true;
      dragging = true;
      document.body.classList.add('is-dragging');
      requestLock();
      return;
    }
    state.touch = true;
    state.started = true;
    document.body.classList.add('is-touch');
    if (e.clientX < window.innerWidth * 0.5 && stick.id === null) {
      stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY;
      if (joystick) {
        joystick.style.display = 'block';
        joystick.style.left = e.clientX + 'px';
        joystick.style.top = e.clientY + 'px';
        joystick.firstElementChild.style.transform = 'translate(-50%, -50%)';
      }
    } else if (look.id === null) {
      look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId === stick.id) {
      const dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
      const len = Math.hypot(dx, dy) || 1;
      const clamp = Math.min(len, STICK_RANGE) / len;
      stick.dx = (dx * clamp) / STICK_RANGE;
      stick.dy = (dy * clamp) / STICK_RANGE;
      stick.mag = Math.min(len, STICK_RANGE) / STICK_RANGE;
      if (joystick) {
        joystick.firstElementChild.style.transform =
          `translate(calc(-50% + ${dx * clamp}px), calc(-50% + ${dy * clamp}px))`;
        joystick.classList.toggle('running', stick.mag > RUN_THRESHOLD);
      }
    } else if (e.pointerId === look.id) {
      followcam.look((e.clientX - look.x) * TOUCH_LOOK_SENS, (e.clientY - look.y) * TOUCH_LOOK_SENS);
      look.x = e.clientX; look.y = e.clientY;
    }
  });

  function endPointer(e) {
    if (e.pointerId === stick.id) {
      stick.id = null; stick.dx = 0; stick.dy = 0; stick.mag = 0;
      if (joystick) { joystick.style.display = 'none'; joystick.classList.remove('running'); }
    }
    if (e.pointerId === look.id) look.id = null;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  /* --- per-frame --- */
  function update(dt) {
    const active = state.enabled && state.started;

    want.set(0, 0, 0);
    state.running = false;

    if (active) {
      let f = 0, s = 0;
      if (keys.KeyW || keys.ArrowUp) f += 1;
      if (keys.KeyS || keys.ArrowDown) f -= 1;
      if (keys.KeyD || keys.ArrowRight) s += 1;
      if (keys.KeyA || keys.ArrowLeft) s -= 1;
      if (stick.id !== null) { f += -stick.dy; s += stick.dx; }

      if (f || s) {
        fwd.copy(followcam.forward());
        right.set(-fwd.z, 0, fwd.x);
        want.set(fwd.x * f + right.x * s, 0, fwd.z * f + right.z * s);
        if (want.lengthSq() > 1) want.normalize();
        state.running = keys.ShiftLeft || keys.ShiftRight || stick.mag > RUN_THRESHOLD;
        want.multiplyScalar(state.running ? RUN : WALK);
      }
    }

    // Exponential approach to the desired velocity, so starts and stops ease
    // instead of the figure snapping between standing and full stride.
    const k = want.lengthSq() > 0 ? ACCEL : DAMP;
    const t = 1 - Math.exp(-k * dt);
    vel.x += (want.x - vel.x) * t;
    vel.z += (want.z - vel.z) * t;
    if (Math.abs(vel.x) < 0.004) vel.x = 0;
    if (Math.abs(vel.z) < 0.004) vel.z = 0;

    const speed = Math.hypot(vel.x, vel.z);
    let heading = null;
    if (followcam.state.first) {
      // Facing follows the camera, or the figure walks with its head on sideways.
      const d = followcam.forward();
      heading = Math.atan2(d.x, d.z);
    } else if (speed > 0.12) {
      heading = Math.atan2(vel.x, vel.z);
    }

    return { dx: vel.x * dt, dz: vel.z * dt, speed, heading, walkMax: WALK };
  }

  function stop() { vel.set(0, 0, 0); }

  return {
    state, update, start, requestLock, stop,
    setEnabled: (v) => { state.enabled = v; if (!v) stop(); },
  };
}
