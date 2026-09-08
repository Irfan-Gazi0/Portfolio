import { PROFILE } from '../data/cv.js';

/* The board detail overlay.

   Content lives in the DOM, not in the 3D scene: it stays selectable,
   zoomable, screen-reader-visible, and its links are really clickable — none
   of which is true of text baked into a texture. Everything printed on a board
   out on the site is orientation; this is where it is actually read.

   `renderContent` is deliberately separate from show/hide. A DOM overlay does
   not composite into an immersive XR session, so when VR arrives the same
   structure has to be drawn onto a plane instead; keeping generation apart
   from presentation is what makes that a swap rather than a rewrite. */

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function linkList(links) {
  const p = el('p', 'p-links');
  for (const l of links) {
    const a = el('a', null, l.label);
    a.href = l.href;
    if (!l.href.startsWith('mailto:')) { a.target = '_blank'; a.rel = 'noopener'; }
    p.appendChild(a);
  }
  return p;
}

/** Build the panel body for one board. Pure — touches no live DOM. */
export function renderContent(ex, zone) {
  const frag = document.createDocumentFragment();

  // Where on the site this was, so the panel and the world agree about it.
  if (zone) {
    const tag = el('p', 'p-zone');
    const code = el('span', 'p-zone-code', zone.code);
    code.style.background = '#' + zone.accent.toString(16).padStart(6, '0');
    tag.append(code, document.createTextNode(zone.label));
    frag.appendChild(tag);
  }

  if (ex.venue) {
    const v = el('p', 'p-venue', ex.venue);
    if (ex.status === 'pending') v.classList.add('pending');
    frag.appendChild(v);
  }
  const title = el('h2', 'p-title', ex.title);
  title.id = 'panel-title';   // names the dialog, see xr/index.html
  frag.appendChild(title);

  if (ex.authors) {
    const p = el('p', 'p-authors');
    // {me} marks the author to emphasise, mirroring <span class="me"> on the 2D site.
    ex.authors.split('{me}').forEach((chunk, i) => {
      if (i > 0) p.appendChild(el('span', 'me', PROFILE.name));
      p.appendChild(document.createTextNode(chunk));
    });
    frag.appendChild(p);
  }

  for (const para of ex.body || []) frag.appendChild(el('p', 'p-body', para));

  if (ex.meta) frag.appendChild(el('p', 'p-meta', ex.meta));

  if (ex.pairs) {
    const dl = el('dl', 'p-pairs');
    for (const [k, v] of ex.pairs) {
      const row = el('div');
      row.appendChild(el('dt', null, k));
      row.appendChild(el('dd', null, v));
      dl.appendChild(row);
    }
    frag.appendChild(dl);
  }

  if (ex.list) {
    const ul = el('ul', 'p-list');
    for (const [k, v] of ex.list) {
      const li = el('li');
      li.appendChild(el('span', 'k', k));
      li.appendChild(document.createTextNode(' ' + v));
      ul.appendChild(li);
    }
    frag.appendChild(ul);
  }

  if (ex.rows) {
    const ul = el('ul', 'p-rows');
    for (const [title, when, detail] of ex.rows) {
      const li = el('li');
      const head = el('div', 'row-title', title);
      head.appendChild(el('span', 'when', when));
      li.appendChild(head);
      if (detail) li.appendChild(el('div', 'detail', detail));
      ul.appendChild(li);
    }
    frag.appendChild(ul);
  }

  if (ex.texture) {
    const fig = el('figure', 'p-fig');
    const img = el('img');
    img.src = ex.texture; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    fig.appendChild(img);
    if (ex.caption) fig.appendChild(el('figcaption', null, ex.caption));
    frag.appendChild(fig);
  }

  for (const f of ex.figures || []) {
    const fig = el('figure', 'p-fig');
    const img = el('img');
    img.src = f.src; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    fig.appendChild(img);
    if (f.caption) fig.appendChild(el('figcaption', null, f.caption));
    frag.appendChild(fig);
  }

  if (ex.links && ex.links.length) frag.appendChild(linkList(ex.links));

  return frag;
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function createPanel({ root, body, closeBtn, onClose }) {
  let open = false;
  let returnFocus = null;

  function show(ex, zone) {
    body.replaceChildren(renderContent(ex, zone));
    body.scrollTop = 0;
    root.hidden = false;
    open = true;
    document.body.classList.add('panel-open');
    returnFocus = document.activeElement;
    closeBtn.focus();
  }

  function hide() {
    if (!open) return;
    open = false;
    root.hidden = true;
    document.body.classList.remove('panel-open');
    // Send focus back where it came from. Without this, closing the panel
    // drops a keyboard user at the top of the document and they have to tab
    // past the whole overlay again to reach the next board. The prompt button
    // that usually opened it is hidden by then, so check it is still shown.
    if (returnFocus && document.contains(returnFocus) && returnFocus.offsetParent) {
      returnFocus.focus();
    }
    returnFocus = null;
    onClose?.();
  }

  closeBtn.addEventListener('click', hide);
  root.addEventListener('click', (e) => { if (e.target === root) hide(); });

  window.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); hide(); return; }
    if (e.key !== 'Tab') return;

    // Keep Tab inside the dialog: everything behind it is a 3D scene with
    // nothing to focus, so escaping the panel means falling into a void.
    const items = [...root.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  return { show, hide, get isOpen() { return open; } };
}
