# Project context

Personal academic site for Irfan Gazi, served by GitHub Pages from `main` at
<https://irfan-gazi0.github.io/Portfolio/>. Read `README.md` first — this file
only records the constraints that are easy to break by accident.

## Hard constraints

- **No build step, no bundler, no package manager.** `index.html` is the entire
  2D page with its CSS and JavaScript inline. `xr/` is ES modules loaded
  directly by the browser. Anything that requires a compile, a transpile, or an
  `npm install` to view the site is out of scope.
- **three.js is pinned to an exact version** in the import map in
  `xr/index.html`. There is no lockfile, so a floating range would let a CDN
  release change the page underneath it. Bump deliberately and re-check the
  site afterwards.
- **`xr/assets/worker.glb` is the only art file the 3D site ships.** Board
  images reuse `images/*.webp` from the 2D page; every other surface is drawn on
  a canvas in `xr/modules/textures.js`. Do not add texture files — the model
  carries none either, only flat material colours.
- **The box figure in `xr/modules/worker.js` is a live fallback, not dead code.**
  It stands in while the GLB loads and stays if the GLB never arrives, so a
  missing or broken model costs one console warning instead of the site. Both
  figures drive the same `update(dt, speed, heading, walkMax)`; keep it that way.
- **`WALK_STRIDE_SPEED` / `RUN_STRIDE_SPEED` are measurements, not taste.** They
  come from `tools/measure-stride.py` and are what keep the worker's feet from
  sliding. Re-run it if the model changes; do not nudge them by hand.
- **`tools/*` are run by hand, once, and their output is committed.** They are
  not a build step and the site never invokes them. That includes
  `tools/CV_Irfan_Gazi.yaml`, which renders `data/CV_Irfan_Gazi.pdf` through
  rendercv in a throwaway virtualenv — see "The CV PDF" in `README.md`.
- **The CV content is deliberately duplicated** across `index.html`,
  `xr/data/cv.js` and `tools/CV_Irfan_Gazi.yaml` (the source of the linked PDF),
  and nothing keeps them in sync — update all three. Rendering the 2D page from
  shared JSON at runtime would cost it SEO and its no-JS resilience.
- **Light and dark are both first-class.** Every colour is defined on bare
  `:root` first and only overridden in the dark blocks, so no value depends on
  a media query alone. In the 3D site the two themes are two times of day
  (`xr/modules/theme.js`), not two tints of one picture.
- **Images are committed as `.webp` only**, downscaled to a 1400 px maximum
  edge, with real `width`/`height` on the `<img>`. Raw `.jpg`/`.png` sources
  are gitignored — see "Adding an image" in `README.md`.

## Where things live

- 2D page sections follow the nav order: `#about`, `#news`, `#research`,
  `#code`, `#projects`, `#experience`, `#skills`.
- 3D content is `xr/data/cv.js` (`ZONES` and `EXHIBITS`); the modules derive
  everything else from it. Most content edits touch no module. Fast-travel
  viewpoints and the painted floor markings are derived too — from the boards and
  from `neighbourThrough` respectively — so neither is a list to maintain.
- `xr/modules/site.js` owns the site plan; `xr/modules/props.js` owns
  everything standing on it; `xr/modules/label.js` owns anything with text
  baked into a texture.

## Agent skills

`.agents/skills/` holds skills installed via `npx skills` (from
[vercel-labs/skills](https://github.com/vercel-labs/skills)), symlinked into
Claude Code. They're local tooling, not site content:

- `find-skills` — discover and install more skills from the ecosystem.
- `accessibility`, `seo`, `performance`, `core-web-vitals`, `best-practices`,
  `web-quality-audit` (from
  [addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills)) —
  Lighthouse/Core Web Vitals-based audits. Relevant here because the 2D page
  is judged on SEO (it's an academic/research site meant to be found) and the
  `xr/` site is a from-scratch three.js scene that can regress performance and
  accessibility without a framework's guardrails to catch it.

## Local preview

```sh
python3 -m http.server 8000        # 2D at /, 3D at /xr/
python3 tools/dev-server.py 8000   # same, plus browser auto-reload on file changes
```

It must be served over HTTP, not opened as `file://` — the 3D site loads ES
modules. `tools/dev-server.py` is a stdlib-only drop-in for the plain
`http.server` invocation — no npm, no build step — that polls file mtimes
and injects a small reload snippet into served HTML.
