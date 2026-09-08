import * as THREE from 'three';

/* The site operative you walk around as.

   Two figures live here, and only one of them is ever on screen.

   The one you normally see is a rigged model — `xr/assets/worker.glb`, a
   Quaternius worker in full PPE, five animation clips, no textures at all. It
   is a local committed file, not a CDN fetch, which is the difference that
   made it worth doing: nothing can change it underneath the site.

   The one behind it is built from boxes, and it is not dead code. It is what
   stands on the slab from the first frame, while the model is still in flight,
   and it is what you keep if the model never arrives — a 404, a corrupt file, a
   browser that will not give us the loader. The site has no build step and no
   asset pipeline, so "the model failed" has to be a thing that degrades rather
   than a blank yard. Delete the boxes and that stops being true.

   The box walk is procedural: legs and arms swing off a single phase that
   advances with distance travelled, so the gait stays in step with the ground
   at any speed. The model gets the same property a different way — its clips
   are driven at a timeScale derived from actual speed, so its feet do not slide
   either. */

const SKIN = 0x9a6b4a;
const HIVIS = 0xe2600f;
const HAT = 0xf0c419;
const TROUSER = 0x2f4756;
const BOOT = 0x2a2018;
const BAND = 0xdfe8e8;
const GLOVE = 0x3d3833;

const MODEL_URL = new URL('../assets/worker.glb', import.meta.url).href;
const MODEL_HEIGHT = 1.78;   // what the model is scaled to, in metres
/* The model's armature carries a -90 degrees X rotation, which lands its
   forward on +Z — the same convention the rest of the site uses, where a
   heading of 0 faces +Z. If a future model faces the other way, this is the
   one number that needs to change. */
const MODEL_YAW = 0;

/* How fast the figure covers ground when a clip runs at timeScale 1, in metres
   per second at MODEL_HEIGHT.

   The clips carry no root motion — deliberately, because locomotion is ours —
   so the stride is not a number in the file. It is still a measurable one: the
   feet are direct children of the root in this rig, so the distance a planted
   foot travels backwards under the body is the step length, and two steps make
   a cycle. `tools/measure-stride.py` reads exactly that off the GLB; re-run it
   if the model is ever replaced.

   Note what these say about the site. Locomotion runs at 3.6 m/s and 6.6 m/s
   (WALK and RUN in modules/movement.js), which is quick — the site is 120 m
   across and crossing it should not be a chore. At 3.6 m/s a person is running,
   so that speed lands on the run clip, and the walk clip is what you see on the
   way up to it and on a half-pushed thumbstick. */
const WALK_STRIDE_SPEED = 1.30;
const RUN_STRIDE_SPEED = 2.53;

const lam = (color) => new THREE.MeshLambertMaterial({ color });
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

/** Frame-rate independent approach: how far to move toward a target this frame. */
const ease = (dt, k) => 1 - Math.exp(-k * dt);

/** A limb segment hanging below a joint, so rotating the joint swings it. */
function segment(parent, w, h, d, mat, drop = 0) {
  const joint = new THREE.Group();
  const mesh = box(w, h, d, mat);
  mesh.position.y = -h / 2 - drop;
  joint.add(mesh);
  parent.add(joint);
  return { joint, mesh };
}

export function createWorker({ shadows }) {
  const mats = {
    skin: lam(SKIN), hivis: lam(HIVIS), hat: lam(HAT), trouser: lam(TROUSER),
    boot: lam(BOOT), band: lam(BAND), glove: lam(GLOVE), dark: lam(0x24282a),
  };

  const root = new THREE.Group();      // on the ground, rotation.y is the facing
  const body = new THREE.Group();      // everything above; carries the bob
  root.add(body);

  // The box figure, in one group so the model can hide all of it at once.
  const rig = new THREE.Group();
  body.add(rig);

  /* --- legs --- */
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.115, 0.86, 0);
    rig.add(hip);

    const thigh = segment(hip, 0.19, 0.44, 0.20, mats.trouser);
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    thigh.joint.add(knee);
    segment(knee, 0.165, 0.42, 0.175, mats.trouser);

    const ankle = new THREE.Group();
    ankle.position.y = -0.42;
    knee.add(ankle);
    const boot = box(0.17, 0.13, 0.30, mats.boot);
    boot.position.set(0, -0.065, 0.05);
    ankle.add(boot);

    legs.push({ hip: thigh.joint, knee, ankle });
  }

  /* --- torso --- */
  const torso = new THREE.Group();
  torso.position.y = 0.86;
  rig.add(torso);

  const chest = box(0.42, 0.56, 0.24, mats.dark);
  chest.position.y = 0.29;
  torso.add(chest);

  // The vest sits proud of the chest so the banding has something to sit on.
  const vest = box(0.47, 0.44, 0.29, mats.hivis);
  vest.position.y = 0.30;
  torso.add(vest);

  const bandGeo = new THREE.BoxGeometry(0.475, 0.055, 0.295);
  for (const y of [0.18, 0.40]) {
    const b = new THREE.Mesh(bandGeo, mats.band);
    b.position.y = y;
    torso.add(b);
  }
  for (const sx of [-0.13, 0.13]) {
    const v = box(0.055, 0.44, 0.298, mats.band);
    v.position.set(sx, 0.30, 0.001);
    torso.add(v);
  }

  const belt = box(0.44, 0.09, 0.27, mats.dark);
  belt.position.y = 0.02;
  torso.add(belt);
  const pouch = box(0.11, 0.16, 0.09, mats.boot);
  pouch.position.set(0.24, -0.02, 0.04);
  torso.add(pouch);

  /* --- arms --- */
  const arms = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.28, 0.52, 0);
    torso.add(shoulder);

    const upper = segment(shoulder, 0.135, 0.30, 0.145, mats.hivis);
    const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.15), mats.band);
    cuff.position.y = -0.27;
    upper.joint.add(cuff);

    const elbow = new THREE.Group();
    elbow.position.y = -0.30;
    upper.joint.add(elbow);
    segment(elbow, 0.12, 0.28, 0.13, mats.skin);

    const glove = box(0.135, 0.14, 0.16, mats.glove);
    glove.position.y = -0.35;
    elbow.add(glove);

    arms.push({ shoulder: upper.joint, elbow });
  }

  /* --- head and hat --- */
  const neck = new THREE.Group();
  neck.position.y = 0.60;
  torso.add(neck);

  const throat = box(0.145, 0.10, 0.135, mats.skin);
  throat.position.y = 0.04;
  neck.add(throat);

  const head = box(0.205, 0.24, 0.215, mats.skin);
  head.position.y = 0.19;
  neck.add(head);

  const brow = box(0.207, 0.035, 0.02, mats.dark);
  brow.position.set(0, 0.215, 0.108);
  neck.add(brow);

  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.hat);
  shell.position.y = 0.305;
  shell.scale.set(1, 0.78, 1.06);
  neck.add(shell);

  const ridge = box(0.045, 0.055, 0.25, mats.hat);
  ridge.position.y = 0.325;
  neck.add(ridge);

  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.022, 12), mats.hat);
  brim.position.y = 0.305;
  brim.scale.set(1, 1, 1.22);
  neck.add(brim);

  const peak = box(0.19, 0.022, 0.10, mats.hat);
  peak.position.set(0, 0.306, 0.155);
  neck.add(peak);

  rig.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });

  /* A painted-on contact shadow. When the device cannot afford a shadow map,
     this is the only thing keeping the figure from looking pasted onto the
     ground; when it can, it still helps at the moment the sun is behind you. */
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: shadows ? 0.09 : 0.3, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  blob.renderOrder = 1;
  root.add(blob);

  /* --- the model ---------------------------------------------------------- */

  let model = null;        // { mixer, actions } once the GLB is in
  let visible = true;

  /**
   * Fetch and fit the model. Everything here is best-effort: if any step fails
   * the box figure is already standing on the slab and simply stays.
   */
  async function loadModel() {
    let gltf;
    try {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      gltf = await new GLTFLoader().loadAsync(MODEL_URL);
    } catch (err) {
      console.warn('[site] worker model unavailable, keeping the box figure:', err);
      return;
    }

    const modelRoot = new THREE.Group();
    modelRoot.add(gltf.scene);
    modelRoot.rotation.y = MODEL_YAW;

    /* The model is authored with a metalness that reads as dull mud under this
       scene's three lights and no environment map. Everything else on the site
       is Lambert (see siteMaterials in props.js), so the model joins it — same
       base colours, one Lambert per source material rather than per mesh. */
    const converted = new Map();
    gltf.scene.traverse((n) => {
      if (!n.isMesh) return;
      const swap = (m) => {
        if (!converted.has(m.uuid)) {
          converted.set(m.uuid, new THREE.MeshLambertMaterial({
            color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
            map: m.map || null,
            side: m.side,
          }));
        }
        return converted.get(m.uuid);
      };
      n.material = Array.isArray(n.material) ? n.material.map(swap) : swap(n.material);
      n.castShadow = shadows;
      n.receiveShadow = shadows;
      // A skinned mesh's bounding box is the bind pose, so an animating figure
      // gets culled at the edge of the screen while still plainly on it.
      if (n.isSkinnedMesh) n.frustumCulled = false;
    });

    /* Fit to human height. Box3.setFromObject reads geometry bounds, which for
       a skinned mesh is the unposed bind pose in bone space and nowhere near
       the figure — so ask each SkinnedMesh for its own posed box first. */
    modelRoot.updateMatrixWorld(true);
    const bounds = new THREE.Box3();
    gltf.scene.traverse((n) => {
      if (!n.isSkinnedMesh) return;
      n.computeBoundingBox();
      bounds.union(n.boundingBox.clone().applyMatrix4(n.matrixWorld));
    });
    if (bounds.isEmpty()) bounds.setFromObject(modelRoot);

    const size = new THREE.Vector3();
    bounds.getSize(size);
    if (size.y > 0.01 && Number.isFinite(size.y)) {
      modelRoot.scale.setScalar(MODEL_HEIGHT / size.y);
      modelRoot.updateMatrixWorld(true);
      modelRoot.position.y -= bounds.min.y * (MODEL_HEIGHT / size.y);
    } else {
      // Better a wrongly-sized worker than an invisible one — but say so.
      console.warn('[site] could not measure the worker model; using it unscaled');
    }

    const mixer = new THREE.AnimationMixer(gltf.scene);
    const actions = {};
    for (const clip of gltf.animations) {
      const key = clip.name.split('|').pop().toLowerCase();
      actions[key] = mixer.clipAction(clip);
    }
    if (!actions.idle || !actions.walk || !actions.run) {
      console.warn('[site] worker model is missing a locomotion clip, keeping the box figure');
      return;
    }
    for (const key of ['idle', 'walk', 'run']) {
      actions[key].setEffectiveWeight(key === 'idle' ? 1 : 0).play();
    }

    mixer.addEventListener('finished', (e) => {
      if (e.action === gestAction) gestOn = false;
    });

    model = { mixer, actions, weights: { idle: 1, walk: 0, run: 0 } };
    root.add(modelRoot);
    model.node = modelRoot;
    rig.visible = false;
    modelRoot.visible = visible;
  }

  loadModel();

  /* --- gestures ----------------------------------------------------------- */

  let gestAction = null, gestOn = false, gestAmt = 0;

  /**
   * Play a one-shot clip over the top of the walk — 'interact' when a board
   * opens, 'wave' on arrival. A no-op until the model is in, which is exactly
   * right: the box figure has no clips and nothing should wait for it.
   */
  function gesture(name) {
    const action = model && model.actions[name];
    if (!action || gestOn) return;
    if (gestAction && gestAction !== action) gestAction.stop();
    gestAction = action;
    gestOn = true;
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.setEffectiveWeight(0);
    action.play();
  }

  /* --- animation ---------------------------------------------------------- */

  const state = { phase: 0, amt: 0, facing: 0, idle: 0 };

  /**
   * @param dt      seconds
   * @param speed   metres per second the figure is actually covering
   * @param heading where it should be facing, radians (null keeps the current)
   * @param walkMax the speed at which the gait is at full extension
   */
  function update(dt, speed, heading, walkMax = 3.6) {
    if (typeof heading === 'number') {
      // Shortest way round, so turning past south does not spin the long way.
      let d = heading - state.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      state.facing += d * ease(dt, 13);
      root.rotation.y = state.facing;
    }

    state.idle += dt;
    const want = Math.min(speed / walkMax, 1.35);
    state.amt += (want - state.amt) * ease(dt, 9);

    if (model) updateModel(dt, speed);
    else updateRig(dt, speed);

    const bob = model ? 0 : Math.abs(Math.cos(state.phase)) * 0.055 * state.amt;
    blob.scale.setScalar(1 - bob * 0.6);
    blob.material.opacity = (shadows ? 0.09 : 0.3) * (1 - bob * 1.2);
  }

  /** Blend idle / walk / run by speed, and run each clip at the pace of the ground. */
  function updateModel(dt, speed) {
    const { actions, weights } = model;

    // Which clip suits a speed is a question about the clips, not about the
    // site's nominal top speed — so the crossover sits on the two measured
    // stride speeds rather than on walkMax.
    const moving = THREE.MathUtils.smoothstep(speed, 0.05, 0.35);
    const jogging = THREE.MathUtils.smoothstep(
      speed, WALK_STRIDE_SPEED * 1.15, RUN_STRIDE_SPEED * 1.15,
    );
    const target = {
      idle: 1 - moving,
      walk: moving * (1 - jogging),
      run: moving * jogging,
    };

    // Ease the weights rather than setting them, for the same reason the box
    // figure eases its stride amount: speed steps around on a keyboard, and a
    // hard cut between clips reads as a stutter rather than as a stride.
    const k = ease(dt, 11);
    const gest = 1 - gestAmt;
    for (const key of ['idle', 'walk', 'run']) {
      weights[key] += (target[key] - weights[key]) * k;
      actions[key].setEffectiveWeight(weights[key] * gest);
    }

    // Each clip plays at the rate the ground is actually passing, which is what
    // keeps the feet from sliding: at half speed it plays at half rate.
    //
    // The clamps are where honesty runs out. Holding Shift asks for 6.6 m/s,
    // which is 2.6x the run clip, and a stride played at 2.6x reads as a
    // cartoon. Capping it trades a little slide at a sprint — which nobody
    // holds for long — against legs that stay legs.
    actions.walk.timeScale = THREE.MathUtils.clamp(speed / WALK_STRIDE_SPEED, 0.6, 1.9);
    actions.run.timeScale = THREE.MathUtils.clamp(speed / RUN_STRIDE_SPEED, 0.7, 2.0);

    gestAmt += ((gestOn ? 1 : 0) - gestAmt) * ease(dt, 9);
    if (gestAction) {
      gestAction.setEffectiveWeight(gestAmt);
      if (!gestOn && gestAmt < 0.01) {
        gestAction.stop();
        gestAction = null;
        gestAmt = 0;
      }
    }

    model.mixer.update(dt);
  }

  /** The box figure's four-joint walk. */
  function updateRig(dt, speed) {
    // Phase advances with distance travelled, which is what keeps the feet from
    // sliding: at half speed the legs swing at half the rate.
    state.phase += dt * speed * 1.75;
    const a = state.amt;

    const swing = Math.sin(state.phase);
    const swing2 = Math.sin(state.phase + Math.PI);

    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? swing : swing2;
      legs[i].hip.rotation.x = s * 0.72 * a;
      // The knee only bends on the recovery half of the stride.
      legs[i].knee.rotation.x = -Math.max(0, -s) * 1.15 * a - 0.04;
      legs[i].ankle.rotation.x = -legs[i].hip.rotation.x * 0.35;
    }

    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? swing2 : swing;
      arms[i].shoulder.rotation.x = s * 0.58 * a;
      arms[i].shoulder.rotation.z = (i === 0 ? 1 : -1) * (0.09 + 0.05 * a);
      arms[i].elbow.rotation.x = -0.25 - Math.max(0, s) * 0.5 * a;
    }

    // Bob is twice the stride frequency — one rise per footfall, not per cycle.
    const bob = Math.abs(Math.cos(state.phase)) * 0.055 * a;
    body.position.y = bob + (a < 0.05 ? Math.sin(state.idle * 1.7) * 0.006 : 0);
    body.rotation.x = -0.05 * a;
    body.rotation.z = Math.sin(state.phase) * 0.03 * a;
    neck.rotation.x = 0.04 * a;
  }

  /** Eye position, for first person and for aiming interaction. */
  const eye = new THREE.Vector3();
  function eyePosition() {
    return eye.set(root.position.x, root.position.y + 1.66, root.position.z);
  }

  function setVisible(v) {
    visible = v;
    rig.visible = v && !model;
    if (model) model.node.visible = v;
    blob.visible = v;
  }

  return {
    root, body, state, update, eyePosition, setVisible, gesture,
    get facing() { return state.facing; },
  };
}
