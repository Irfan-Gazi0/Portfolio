# Portfolio

Personal academic site for Irfan Gazi — <https://irfan-gazi0.github.io/Portfolio/>

Served by GitHub Pages from `main`. There is no build step, for either the page or the
3D site: `index.html` is the whole page with its CSS and JavaScript inline, and `xr/`
loads three.js from a CDN through an import map.

## Layout

```
index.html          the entire page — styles, markup and scripts
images/*.webp       figures, named for what they show
data/CV_*.pdf       the CV linked from the header — rendered from tools/, committed
tools/              one-off inputs, run by hand — see "The worker" and "The CV PDF"
xr/                 the 3D construction site — a second way through the same CV
  index.html          import map, overlay UI, panel styles
  main.js             bootstrap and frame loop
  assets/worker.glb   the rigged figure you walk as — the only art file here
  data/cv.js          zones and exhibits — the only file most edits touch
  modules/
    scene.js            renderer, sky dome, fog, shadow tier
    theme.js            scene palettes — a working day and a night shift
    textures.js         every surface, drawn on a canvas at load time
    props.js            crane, plant, containers, materials, cones, masts
    site.js             the site plan: ground, roads, hoarding, perimeter, dressing
    exhibits.js         the boards bolted to the hoarding
    label.js            canvas-drawn signage, title blocks and text board faces
    lighting.js         sun, hemisphere, floodlights, travelling shadow frustum
    worker.js           the rigged worker, and the box figure behind it
    followcam.js        third-person spring arm with wall dodge
    movement.js         keyboard, pointer, wheel and touch locomotion
    collision.js        axis-aligned collision on the ground plane
    interact.js         proximity and facing test for the focused board
    panel.js            the DOM panel a board opens
    minimap.js          the site plan in the corner
    xr.js               WebXR stub, and why it is a stub
```

## Editing

Open `index.html` and edit in place. The sections appear in the same order as the nav:
`#about`, `#news`, `#research`, `#code`, `#projects`, `#experience`, `#skills`.

**Adding a research entry.** The section is four `<div class="rgroup">` blocks — Funded
Projects, Journal Articles, In Progress, Conference Presentations — each a `.rgroup-head`
(heading plus count) over a `.rgroup-body` holding the entries. Copy an existing
`<article class="entry">` into the right body. Each one is a figure column plus a body of
`<p class="entry-meta">` → title → authors → link chips → summary, where the meta line is a
`<span class="state">` naming what the thing is (`Published`, `Under review` with
`class="state is-open"`, `B.Sc. thesis` with `is-past`, …) followed by the venue as plain
text. Use `class="entry no-fig"` when there is no figure, and wrap Irfan's own name in
`<span class="me">` so it renders bold in the author list.

Then **bump two counts by hand**: the group's `<span class="rgroup-count">` and its chip in
the `.rindex` strip under the Research heading. CSS counters cannot read a later sibling's
subtree, and counting in JavaScript would put the numbers behind a script — so eight
numbers are maintained by hand, the same bargain the CV duplication below already makes.

**Adding a code entry.** Copy an existing `<article class="repo">`. The heading is what the
project *does* — a slug alone tells a reader nothing — and the repo address goes underneath it
in `<p class="repo-slug">`, which carries the shared GitHub mark via `<use href="#i-github"/>`.
Then tags, one paragraph, and `<p class="actions">` link chips.

**Adding a news item.** Newest first, at the top of the `<ul>` inside `.news-scroll`.

**Adding an image.** Downscale before committing — a 1400px maximum edge is plenty, since
nothing displays wider than about 900 CSS px:

```sh
ffmpeg -i source.png -vf "scale='min(1400,iw)':-1:flags=lanczos" \
  -c:v libwebp -quality 85 -compression_level 6 -preset picture images/name.webp
```

Then set `width` and `height` on the `<img>` to the file's real pixel dimensions, so the
browser reserves the right space before the image loads. Keep the original next to it if
you like — `.gitignore` covers `images/*.jpg` and `images/*.png`, so only the `.webp` ever
ships.

## The 3D site (`xr/`)

The CV laid out as a construction site: five fenced compounds in a plus — Site Office at
the middle, Plan Room, Systems Container, Fabrication Yard and Milestone Row around it —
inside a much larger fenced site with a haul road, a tower crane, a steel frame going up,
a laydown yard and welfare cabins. A construction worker walks it in third person (WASD or
a touch stick), and walking up to a board on the hoarding and pressing <kbd>E</kbd> opens
the full entry in a DOM panel. `xr/?zone=planroom` drops a visitor straight into one
compound; the old `?room=` parameter still works.

Nobody has to walk, though. **Jump to** in the top-left lists the five yards with how
many of each one's boards you have opened, <kbd>1</kbd>–<kbd>5</kbd> go straight to one,
and clicking a compound on the site plan in the corner does the same. A jump is a hard
cut under a short fade rather than a camera move: interpolating the worker across forty
metres walks them through the hoarding, since collision is resolved per step. Where you
land is derived, not authored — `viewpointFor` in `main.js` stands you in front of that
yard's focal board, facing it, which is the same answer the spawn uses.

**Painted floor markings** name the way out of each opening (`buildWayfinding` in
`modules/site.js`, drawn by `wayfindingArrowTexture`). The doorways were already signed
overhead, so these are not new information — they are the same information at a range
where a lintel sign is a smudge. The plan is a hub with four spokes rather than a route,
so there is no trail of arrows to follow: there is one marking per way out at the hub,
one pointing back on the far side of each, and one outside each outer gate. Every
destination is read off the site plan through `neighbourThrough`, so moving a compound
moves the marking that names it.

**Content lives in `xr/data/cv.js`**, not in the modules. `ZONES` describes the plan;
`EXHIBITS` lists every board. To add one, append an object naming its `zone`, `wall`
(`north`/`south`/`east`/`west`), `slot` (an ordering hint along that run) and `size` in
metres — match the aspect ratio of its image, since the board is built from these numbers.
`modules/site.js` works out the actual position: boards are spaced at a fixed gap and the
group is centred on the stretch of hoarding it fits on, so nothing is positioned by hand.

A board with no `texture` is not left blank. `sheetFace` in `modules/label.js` prints what
the entry actually holds — the dates of a news list, the columns of a skills table, the
periods of a position — as a drawing sheet, because sixteen of the twenty-four boards are
text entries and blank rectangles would make the yards look unfinished.

Runs of hoarding that end up carrying no board get the printed scheme graphic or the PPE
notice instead (`hoardingBandTexture`), worked out from the board data rather than listed,
so moving a board moves its graphic too.

Board images reuse the same `images/*.webp` as the 2D page and load per compound on entry,
so no extra art is needed and a phone never downloads all of them at once. Every other
surface — dirt, concrete, plywood, hazard tape, chain link, corrugated steel, the arrows
painted on the ground — is drawn on a canvas at load time in `modules/textures.js`. Apart
from the worker below, the 3D site ships no art files of its own, and no texture files at
all.

### The worker

`xr/assets/worker.glb` is a [Quaternius](https://quaternius.com/) Worker (CC0) — about
5,200 triangles, 62 joints, and **no textures at all**, just flat material colours, whose
hi-vis orange and hard-hat yellow already sit in the site's palette. It is the one art
file the 3D site ships, and it is committed rather than fetched from a CDN, which is the
whole reason it was worth adding: nothing can change it underneath the page.

**The box figure in `modules/worker.js` is not dead code.** It is what stands on the slab
from the first frame while the model is still in flight, and what you keep if the model
never arrives. Break the asset and the site logs one warning and stays walkable. Deleting
the boxes would end that.

Two things about it were measured rather than guessed, and both live in `tools/`:

```sh
# 24 clips ship; the site plays five. Run once, commit the output.
python3 tools/trim-glb.py "xr/Assets/Worker by Quaternius.glb" xr/assets/worker.glb \
    Idle Walk Run Wave Interact          # 1.28 MB -> 0.79 MB

# What ground speed each clip's stride implies — WALK_STRIDE_SPEED and
# RUN_STRIDE_SPEED in modules/worker.js, which is what stops the feet sliding.
python3 tools/measure-stride.py xr/assets/worker.glb
```

Neither runs at view time; the site has no build step. `xr/Assets/` holds the untrimmed
download and is not published — nothing references it, and `.gitignore` keeps it out of
the repository, which also keeps it from colliding with `xr/assets/` on a case-insensitive
filesystem. If a model ever replaces this one, run both scripts again and copy the two
stride figures across; `measure-stride.py` finds the joints it measures by name, so it
will say so rather than guess if the new rig names them differently.

> **The CV content is duplicated.** `index.html`, `xr/data/cv.js` and
> `tools/CV_Irfan_Gazi.yaml` hold the same facts in three different shapes, and nothing
> keeps them in sync — update all three. This is deliberate: rendering the 2D page from
> shared JSON at runtime would cost it SEO and its no-JS resilience.

**three.js is pinned to an exact version** in the import map in `xr/index.html`. With no
lockfile, a floating range would let a CDN release change the page underneath it. Bump it
deliberately, and reload the site afterwards to check nothing broke.

WebXR is not enabled. `xr/modules/xr.js` documents the four structural decisions that keep
adding a headset mode additive rather than a rewrite.

## The CV PDF

`data/CV_Irfan_Gazi.pdf` is the CV linked from the header and from a board in the 3D
site. It is rendered from `tools/CV_Irfan_Gazi.yaml` by
[rendercv](https://docs.rendercv.com/), by hand, and the PDF is committed — like the
scripts in `tools/`, this is not a build step and nothing on the site invokes it:

```sh
python3 -m venv /tmp/rcv
/tmp/rcv/bin/pip install "rendercv[full]" click     # click is missing from its deps
/tmp/rcv/bin/rendercv render tools/CV_Irfan_Gazi.yaml
cp rendercv_output/Irfan_Gazi_CV.pdf data/CV_Irfan_Gazi.pdf
```

Two things to know about the YAML. Long prose uses block scalars (`>-`) throughout,
because a plain YAML scalar cannot contain `": "` and most of these sentences do. And
the four `page.*_margin` keys are deliberately unset: rendercv 2.3 renders only at its
default 2 cm, and any other value dies in its Typst template with *cannot multiply
dictionary with integer*. A section's title comes from its key, title-cased, so keys
that need their own capitalisation (`"BIM Projects"`) are quoted with the exact text.

### Performance notes

Anything that appears more than a handful of times goes through the `instancer` collector
in `modules/props.js` and lands as a single draw call — cones, scaffold tubes, hoarding
uprights, skyline blocks. Materials are made once in `siteMaterials` and shared, and
because a shared texture cannot carry a per-mesh tiling, meshes scale their own UVs
(`tileUV`) instead of setting `repeat`. Shadow map size is picked from what the device
admits to having, down to no shadow map at all on a weak phone, where the worker falls
back to a blob contact shadow.

## Local preview

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

The 3D site is at <http://localhost:8000/xr/>. It needs to be served over HTTP rather than
opened as a `file://` path, because it loads ES modules.

## Theme

Light and dark palettes are defined as CSS custom properties. The page follows the
operating system by default; the header toggle overrides that and stores the choice in
`localStorage`. Every colour is defined on bare `:root` first and only overridden in the
dark blocks, so no value depends on a media query alone.

The 3D site reads the same `localStorage` key, so the theme carries across. Its scene
colours are separate, in `xr/modules/theme.js`, and there they are not two tints of one
picture but two times of day: light is a working day with the sun up and the floodlight
masts dark, dark is the night shift with a weak moon and the masts carrying the scene.
The night palette's ambient and hemisphere terms are deliberately higher than "realistic"
— tuned by eye against the lit compounds alone, the open ground between them went to black
and the site stopped being navigable.
