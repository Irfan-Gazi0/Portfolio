import * as THREE from 'three';
import { getPalette } from './theme.js';

/* Renderer, sky and camera.

   There is no player rig here any more. The site is third-person: the worker
   (modules/worker.js) is the thing that moves through the world, and the
   camera trails it on a spring arm (modules/followcam.js). Locomotion writes
   the worker; the camera only ever reads it.

   That split is also what keeps a headset mode additive rather than a rewrite
   — an immersive session drives the camera directly and the worker keeps being
   driven from locomotion, exactly as it is now. See modules/xr.js. */

/* Shadows are the single biggest lever on both looks and cost here. One sun,
   one tightly-framed shadow camera that follows the player, and a quality tier
   picked from what the device admits to having. */
function shadowTier() {
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (coarse && (cores <= 4 || mem <= 3)) return 0;      // blob shadow only
  if (coarse || cores <= 4 || mem <= 4) return 1024;
  return 2048;
}

export function createScene(canvas) {
  const pal = getPalette();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Outdoors under a bright sun, a linear response blows the sky out and
  // crushes everything in shade. Tone mapping is what makes daylight readable.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = pal.night ? 1.32 : 1.0;

  const shadows = shadowTier();
  renderer.shadowMap.enabled = shadows > 0;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(pal.fog);
  scene.fog = new THREE.Fog(pal.fog, pal.fogNear, pal.fogFar);

  scene.add(buildSky(pal));

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.15, 900);
  camera.position.set(0, 6, 12);
  scene.add(camera);

  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  return { renderer, scene, camera, palette: pal, shadows, onResize };
}

/* An inverted sphere with a three-stop vertical gradient. Cheaper than a
   cubemap, and it means the horizon can be tuned to meet the fog exactly —
   without that match, the far fence ends against a visible seam. */
function buildSky(pal) {
  const geo = new THREE.SphereGeometry(600, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(pal.skyTop) },
      mid: { value: new THREE.Color(pal.skyMid) },
      low: { value: new THREE.Color(pal.skyLow) },
    },
    vertexShader: `
      varying float vH;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vH = normalize(world.xyz).y;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 top, mid, low;
      varying float vH;
      void main() {
        float h = clamp(vH, -1.0, 1.0);
        vec3 c = h > 0.0
          ? mix(mid, top, smoothstep(0.0, 0.55, h))
          : mix(mid, low, smoothstep(0.0, -0.25, h));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  return sky;
}
