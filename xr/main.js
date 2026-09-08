import { ZONES } from './data/cv.js';
import { applyDomTheme } from './modules/theme.js';
import { createScene } from './modules/scene.js';
import { buildSite, zoneAt, zoneById, OPEN_SITE } from './modules/site.js';
import { buildLighting } from './modules/lighting.js';
import { createCollider } from './modules/collision.js';
import { createWorker } from './modules/worker.js';
import { createFollowCam } from './modules/followcam.js';
import { createMovement } from './modules/movement.js';
import { buildExhibits } from './modules/exhibits.js';
import { createInteraction } from './modules/interact.js';
import { createPanel } from './modules/panel.js';
import { createMinimap } from './modules/minimap.js';

applyDomTheme();

const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const promptEl = $('prompt');
const zoneTagEl = $('zone-tag');
const startEl = $('start');
const minimapEl = $('minimap');

const { renderer, scene, camera, palette, shadows } = createScene(canvas);
const site = buildSite(scene, palette);
const lighting = buildLighting(scene, palette, site.masts, shadows);
const collider = createCollider(site.colliders);

const worker = createWorker({ shadows: shadows > 0 });
scene.add(worker.root);

const followcam = createFollowCam({ camera, worker, collider });
const movement = createMovement({ canvas, followcam, joystick: $('joystick') });

const exhibits = buildExhibits(scene, palette);
const interaction = createInteraction({ camera, worker, items: exhibits.items });
const minimap = createMinimap($('minimap'));

const panel = createPanel({
  root: $('panel'),
  body: $('panel-body'),
  closeBtn: $('panel-close'),
  onClose: () => movement.requestLock(),
});

/* --- where you stand ------------------------------------------------------
   ?zone=planroom drops you straight into a compound, so a single board can be
   shared by link. The same answer is what a jump uses, so arriving somewhere is
   one thing however you got there. */
const wanted = new URLSearchParams(location.search).get('zone')
  || new URLSearchParams(location.search).get('room');   // the old parameter name
const office = zoneById.office;
const spawnZone = (wanted && zoneById[wanted]) || office;

place(...viewpointFor(spawnZone));

/** Stand `back` metres off a board, facing it. */
function standBefore(item, back = 6.2) {
  const rotY = item.node.rotation.y;
  const nx = Math.sin(rotY), nz = Math.cos(rotY);   // the board's outward normal
  // Through collision on the way out: a deep board on a shallow yard could
  // otherwise put you inside the hoarding on the far side of it.
  const p = collider.resolve(item.anchor.x + nx * back, item.anchor.z + nz * back);
  return [p.x, p.z, Math.atan2(-nx, -nz)];
}

/**
 * Where to put someone arriving in a compound: in front of its work, facing it.
 *
 * Derived rather than listed, so moving a board moves the viewpoint that looks
 * at it and nothing in data/cv.js has to know about the camera. The focal board
 * wins if the yard has one; otherwise the first board hung in it does.
 */
function viewpointFor(zone) {
  const here = exhibits.items.filter((it) => it.zone === zone);
  const item = here.find((it) => it.data.focal) || here[0];
  if (item) return standBefore(item);
  const b = zone.bounds;
  return [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, 0];
}

/**
 * Put the worker down facing `heading`, and swing the camera round behind them.
 * Camera yaw runs opposite to a facing: yaw PI looks along +Z, heading 0 faces
 * +Z, so the arm that sits behind a given heading is heading + PI.
 */
function place(x, z, heading) {
  worker.root.position.set(x, 0, z);
  worker.state.facing = heading;
  worker.root.rotation.y = heading;
  followcam.state.yaw = heading + Math.PI;
  // Otherwise the spring arm eases in from wherever it last stood, which after
  // a jump is a smear of forty metres of site.
  followcam.snap();
  movement.stop();
}

let currentZone = zoneAt(worker.root.position.x, worker.root.position.z) || OPEN_SITE;
if (currentZone !== OPEN_SITE) exhibits.loadZone(currentZone.id);
exhibits.loadZone(office.id);
setZoneTag(currentZone);

function setZoneTag(zone) {
  zoneTagEl.querySelector('.zone-code').textContent = zone.code;
  zoneTagEl.querySelector('.zone-name').textContent = zone.label;
  zoneTagEl.style.setProperty('--zone-accent', '#' + zone.accent.toString(16).padStart(6, '0'));
  zoneTagEl.classList.remove('flash');
  void zoneTagEl.offsetWidth;    // restart the animation
  zoneTagEl.classList.add('flash');
}

/* --- opening a board ------------------------------------------------------ */
function openFocused() {
  const f = interaction.focus;
  if (!f || panel.isOpen) return;
  if (document.pointerLockElement) document.exitPointerLock();
  worker.gesture('interact');
  markRead(f.data.id);
  panel.show(f.data, f.zone);
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && !jumpEl.hidden) { setJump(false); jumpBtn.focus(); return; }
  if (panel.isOpen || startEl.hidden === false) return;
  if (e.code === 'KeyV') { e.preventDefault(); setView(followcam.toggle()); return; }
  if (e.code === 'KeyJ') { e.preventDefault(); setJump(jumpEl.hidden); return; }
  // 1-5 name the yards in plan order, which is the order the induction card
  // and the jump list both list them in.
  if (e.code.startsWith('Digit')) {
    const zone = ZONES[Number(e.code.slice(5)) - 1];
    if (zone) { e.preventDefault(); setJump(false); jumpTo(zone); }
    return;
  }
  if (e.code === 'KeyE' || e.code === 'Enter') {
    if (interaction.focus) { e.preventDefault(); openFocused(); }
  }
});
promptEl.addEventListener('click', openFocused);

// On touch there is no pointer lock to swallow the tap, so a tap that did not
// turn into a look-drag opens whatever is in focus.
const touchStart = { x: 0, y: 0 };
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') return;
  touchStart.x = e.clientX;
  touchStart.y = e.clientY;
  setStart(false);
});
canvas.addEventListener('pointerup', (e) => {
  if (e.pointerType !== 'touch' || panel.isOpen || !interaction.focus) return;
  // Either half of the screen: a tap that never became a drag is a tap, whether
  // it landed on the walk thumb's side or the look thumb's.
  if (Math.hypot(e.clientX - touchStart.x, e.clientY - touchStart.y) < 12) openFocused();
});

/* --- view mode ------------------------------------------------------------ */
const viewBtn = $('view-btn');
function setView(first) {
  document.body.classList.toggle('first-person', first);
  viewBtn.querySelector('.view-label').textContent = first ? 'First person' : 'Third person';
  viewBtn.setAttribute('aria-pressed', String(first));
}
viewBtn.addEventListener('click', () => {
  setView(followcam.toggle());
  movement.requestLock();
});
setView(false);

/* --- induction / help overlay --------------------------------------------- */
function setStart(visible) {
  startEl.hidden = !visible;
  document.body.classList.toggle('start-open', visible);
  // Put the keyboard where the card is. It is a modal dialog; leaving focus on
  // whatever chip opened it means Tab walks the page behind it.
  if (visible) $('start-btn').focus();
}
setStart(true);

$('start-btn').addEventListener('click', () => {
  setStart(false);
  movement.start();
});
$('help-btn').addEventListener('click', () => {
  if (document.pointerLockElement) document.exitPointerLock();
  setStart(true);
});
startEl.addEventListener('click', (e) => {
  if (e.target === startEl && movement.state.started) setStart(false);
});
// Losing pointer lock (Esc, tab-out) does not re-show the card — drag or click
// on the site picks straight back up.

/* --- getting about --------------------------------------------------------
   The site is a hub with four spokes and every board is reachable on foot, but
   nobody should have to walk back across a yard to reach the one thing they
   came for. So: a list of the five compounds, the same list on the site plan in
   the corner, and 1-5 on the keyboard.

   A jump is a cut, not a journey. Interpolating the worker across forty metres
   walks them straight through the hoarding — collision is resolved per step, so
   a long lerp tunnels — and flying the camera over the site is a different
   promise from "go to Milestone Row". Under the fade it is one frame. */

const jumpBtn = $('jump-btn');
const jumpEl = $('jump');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let jumping = false;
let mapHover = null;

function jumpTo(zone) {
  if (jumping || zone === currentZone) {
    if (zone === currentZone) movement.requestLock();
    return;
  }
  const arrive = () => {
    exhibits.loadZone(zone.id);
    const [x, z, heading] = viewpointFor(zone);
    place(x, z, heading);
    currentZone = zoneAt(x, z) || zone;
    setZoneTag(currentZone);
  };

  // Asking for the pointer back has to happen inside the gesture that asked for
  // the jump, not after the fade, or the browser has already forgotten there
  // was one.
  movement.requestLock();

  if (reduceMotion.matches) { arrive(); return; }
  jumping = true;
  document.body.classList.add('jumping');
  setTimeout(() => {
    arrive();
    document.body.classList.remove('jumping');
    jumping = false;
  }, 170);
}

/* --- what you have already read -------------------------------------------
   Twenty-four boards across five yards is more than anyone holds in their head,
   and "which of these have I looked at" is the question the jump list is
   actually being asked. Kept per browser; losing it costs nothing. */

const READ_KEY = 'xr:read';
let read = new Set();
try { read = new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); } catch { /* private mode */ }

function markRead(id) {
  if (!id || read.has(id)) return;
  read.add(id);
  try { localStorage.setItem(READ_KEY, JSON.stringify([...read])); } catch { /* private mode */ }
  refreshJump();
}

const jumpCounts = new Map();

$('jump-list').replaceChildren(...ZONES.map((zone) => {
  const li = document.createElement('li');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'jump-item';

  const code = document.createElement('span');
  code.className = 'code';
  code.textContent = zone.code;
  code.style.background = '#' + zone.accent.toString(16).padStart(6, '0');

  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = zone.label;

  const count = document.createElement('span');
  count.className = 'read';

  const blurb = document.createElement('span');
  blurb.className = 'blurb';
  blurb.textContent = zone.blurb;

  btn.append(code, name, count, blurb);
  btn.addEventListener('click', () => { setJump(false); jumpTo(zone); });
  jumpCounts.set(zone.id, count);
  li.appendChild(btn);
  return li;
}));

/** Counted off the boards that actually got hung, not off the data. */
function refreshJump() {
  for (const zone of ZONES) {
    const el = jumpCounts.get(zone.id);
    const here = exhibits.items.filter((it) => it.zone === zone);
    const done = here.filter((it) => read.has(it.data.id)).length;
    el.textContent = here.length ? `${done}/${here.length}` : '';
    el.title = here.length ? `${done} of ${here.length} boards opened` : '';
    el.classList.toggle('done', here.length > 0 && done === here.length);
  }
}
refreshJump();

function setJump(open) {
  // Closing while the keyboard is inside the list would drop focus on a hidden
  // element, and the next Tab would start again from the top of the document.
  if (!open && jumpEl.contains(document.activeElement)) jumpBtn.focus();
  jumpEl.hidden = !open;
  jumpBtn.setAttribute('aria-expanded', String(open));
  if (!open) return;
  // The cursor is captured while you are walking; there is nothing to click
  // with until it is handed back.
  if (document.pointerLockElement) document.exitPointerLock();
  refreshJump();
  jumpEl.querySelector('button')?.focus();
}

jumpBtn.addEventListener('click', () => setJump(jumpEl.hidden));
document.addEventListener('pointerdown', (e) => {
  if (jumpEl.hidden) return;
  if (!jumpEl.contains(e.target) && !jumpBtn.contains(e.target)) setJump(false);
});

/* The site plan is the other half of the same control: it already draws the
   five compounds, so pointing at one is the shortest way to say "there". It
   stays pointer-only — a canvas has nothing a keyboard can land on — and the
   jump list is the route that does not need a mouse. */
minimapEl.addEventListener('pointermove', (e) => { mapHover = minimap.hitTest(e.clientX, e.clientY); });
minimapEl.addEventListener('pointerleave', () => { mapHover = null; });
minimapEl.addEventListener('click', (e) => {
  const id = minimap.hitTest(e.clientX, e.clientY);
  if (id && zoneById[id]) jumpTo(zoneById[id]);
});

/* --- frame loop ----------------------------------------------------------- */
let last = performance.now();
let firstFrame = true;

function frame(now) {
  requestAnimationFrame(frame);
  // Clamp dt so a backgrounded tab does not teleport the worker on return.
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  // The induction card and the board panel are both scrollable overlays; while
  // one is up the keyboard belongs to it, not to the worker.
  movement.setEnabled(!panel.isOpen && startEl.hidden);
  const { dx, dz, speed, heading, walkMax } = movement.update(dt);

  if (dx || dz) {
    const next = collider.resolve(worker.root.position.x + dx, worker.root.position.z + dz);
    worker.root.position.x = next.x;
    worker.root.position.z = next.z;

    // Walking out of a yard is a transition too: the tag names the open site
    // rather than going on claiming you are somewhere you left.
    const zone = zoneAt(next.x, next.z) || OPEN_SITE;
    if (zone !== currentZone) {
      currentZone = zone;
      if (zone !== OPEN_SITE) exhibits.loadZone(zone.id);
      setZoneTag(zone);
    }
  }

  worker.update(dt, speed, heading, walkMax);
  followcam.update(dt);
  lighting.update(worker.root.position.x, worker.root.position.z);

  // The crane slews all day. It is the only thing on the site that moves on its
  // own, and it is what stops a still frame reading as a screenshot.
  for (const a of site.animated) {
    if (a.kind === 'slew') a.node.rotation.y += dt * 0.045;
  }

  const focus = panel.isOpen ? null : interaction.update();
  exhibits.setFocus(focus);

  if (focus && !panel.isOpen) {
    promptEl.hidden = false;
    promptEl.querySelector('.prompt-title').textContent = focus.data.title;
  } else {
    promptEl.hidden = true;
  }

  minimap.draw(worker.root.position.x, worker.root.position.z, followcam.state.yaw, currentZone.id, mapHover);
  renderer.render(scene, camera);

  if (firstFrame) {
    firstFrame = false;
    document.body.classList.add('ready');
  }
}

requestAnimationFrame(frame);

// Surface the compound list for the induction card rather than hand-maintaining it.
$('zone-legend').replaceChildren(...ZONES.map((z) => {
  const li = document.createElement('li');
  const code = document.createElement('span');
  code.className = 'code';
  code.textContent = z.code;
  code.style.background = '#' + z.accent.toString(16).padStart(6, '0');
  const name = document.createElement('b');
  name.textContent = z.label;
  li.append(code, name, document.createTextNode(' — ' + z.blurb));
  return li;
}));
