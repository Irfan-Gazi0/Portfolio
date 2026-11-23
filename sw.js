/* Service worker: makes repeat visits faster.

   GitHub Pages sends max-age=600 on every file and stamps every ETag with the
   deploy time, so after each push a returning visitor would download every
   file again. This worker keeps a copy of the site's files in the browser.

   - Images, fonts, PDFs and 3D models: stale-while-revalidate. The cached copy
     is shown at once and a fresh copy is fetched in the background, so a
     replaced file shows up on the next visit. No renaming needed.
   - Pages, CSS and JS: network first. The browser's normal HTTP cache still
     applies, so an edit reaches a returning visitor within GitHub's
     10-minute max-age. The worker's copy is only used when the network
     fails.
   - Videos (range requests), other sites' files except Google Fonts, and
     anything that is not a GET: not touched. The browser handles them.

   To clear every visitor's cache, bump VERSION.
   To remove the worker entirely, set KILL = true and push. It deletes its
   caches and unregisters itself on each visitor's next load. */

const VERSION = 'v1';
const KILL = false;

const PREFIX = 'portfolio-';
const CACHE = PREFIX + VERSION;
const ASSET_EXT = /\.(?:webp|png|jpe?g|gif|svg|ico|avif|woff2?|ttf|otf|pdf|glb|gltf|bin)$/i;
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k.startsWith(PREFIX) && (KILL || k !== CACHE))
      .map((k) => caches.delete(k)));
    if (KILL) {
      await self.registration.unregister();
      return;
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (KILL) return;
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  if (req.destination === 'video' || req.destination === 'audio') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = FONT_HOSTS.includes(url.hostname);
  if (!sameOrigin && !isFont) return;
  if (sameOrigin && !url.pathname.startsWith(scopePath())) return;

  if (isFont || req.destination === 'image' || req.destination === 'font' || ASSET_EXT.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event, req));
  } else if (sameOrigin) {
    event.respondWith(networkFirst(event, req));
  }
});

function scopePath() {
  return new URL(self.registration.scope).pathname;
}

// Opaque (no-cors) responses are skipped: they report status 0 and take up
// several megabytes of quota each in Chrome.
function cacheable(res) {
  return res && res.ok && res.type !== 'opaque';
}

// Storage can be blocked, broken or full. Every cache call is wrapped so a
// storage failure falls back to the network instead of failing the request.
async function openCache() {
  try {
    return await caches.open(CACHE);
  } catch (err) {
    return null;
  }
}

async function lookup(cache, req) {
  if (!cache) return undefined;
  try {
    return await cache.match(req);
  } catch (err) {
    return undefined;
  }
}

// Writes are tracked with waitUntil so the browser keeps the worker alive
// until they finish. A failed write is ignored; the download still succeeds.
// Called while the respondWith or waitUntil promise is still pending, which
// is what lets waitUntil run after the first await.
function store(event, cache, req, res) {
  if (!cache || !cacheable(res)) return;
  event.waitUntil(cache.put(req, res.clone()).catch(() => {}));
}

async function staleWhileRevalidate(event, req) {
  const cache = await openCache();
  const cached = await lookup(cache, req);
  const fresh = fetch(req).then((res) => {
    store(event, cache, req, res);
    return res;
  });
  if (cached) {
    event.waitUntil(fresh.catch(() => {}));
    return cached;
  }
  return fresh;
}

async function networkFirst(event, req) {
  const cache = await openCache();
  try {
    const res = await fetch(req);
    store(event, cache, req, res);
    return res;
  } catch (err) {
    const cached = await lookup(cache, req);
    if (cached) return cached;
    throw err;
  }
}
