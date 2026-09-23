/* Palettes for the site.

   Light and dark are not two tints of the same picture here — they are two
   times of day. Light is a working day: high sun, pale sky, floodlights off.
   Dark is the night shift: deep sky, cold moonlight, and the mast floodlights
   carrying the scene. Anything that changes between them lives in one of these
   two objects, so nothing downstream has to ask which mode it is in.

   The DOM overlay takes its colours from CSS custom properties in index.html;
   only scene colours live here. Both follow the same rule as the 2D site:
   light is the base, an explicit choice wins over the OS. */

const DAY = {
  night: false,

  /* sky + atmosphere */
  skyTop: 0x5b90c4,
  skyMid: 0xa8c6dd,
  skyLow: 0xdfe4e2,
  fog: 0xcdd6d6, fogNear: 46, fogFar: 252,

  /* lighting */
  sun: 0xfff2dc, sunI: 2.05, sunPos: [58, 76, 34],
  hemiSky: 0xb7d2e8, hemiGround: 0x8d7f68, hemiI: 0.85,
  ambient: 0xf2f7f8, ambientI: 0.18,
  floodI: 0,                       // masts are dark in daylight
  lampGlow: 0x6a6f6a, lampGlowOpacity: 0.0,

  /* ground + civils */
  earth: 0xa2947c,
  earthDark: 0x8b7f69,
  gravel: 0xb8ae9a,
  concrete: 0xbfbdb5,
  concreteJoint: 0x9d9b94,
  asphalt: 0x6f7274,

  /* built things */
  ply: 0xc09258,
  plyGrain: 0x9d7440,
  steel: 0x93999b,
  steelDark: 0x5f686b,
  rust: 0x8d5a34,
  hazard: 0xe8b62c,
  hazardInk: 0x24282a,
  safety: 0xdc6b1a,
  paint: 0xe6e2d8,

  /* boards */
  boardFrame: 0x555f62,
  boardBack: 0x8d9497,
  glass: 0x9fc7d8,

  /* canvas-drawn labels */
  labelInk: '#1b2226',
  labelMute: '#5c6b70',
  labelBg: 'rgba(253,252,248,0.97)',
  labelRule: 'rgba(27,34,38,0.22)',
};

const NIGHT = {
  night: true,

  skyTop: 0x070d1a,
  skyMid: 0x142238,
  skyLow: 0x2a3247,
  fog: 0x141c26, fogNear: 34, fogFar: 208,

  // Moonlight is cold and weak; it shapes silhouettes and leaves the reading to
  // the floodlights, which is what a real night shift looks like.
  //
  // "Weak" still has a floor. Tuned by eye against the compounds alone, the
  // open ground between them went to pure black and the site stopped being
  // navigable — so the ambient and hemisphere terms carry enough to keep the
  // ground, the hoarding and the plant readable everywhere, and the masts add
  // the pools of working light on top.
  sun: 0x9fb6d8, sunI: 0.72, sunPos: [-46, 62, -38],
  hemiSky: 0x3b5273, hemiGround: 0x24262a, hemiI: 0.82,
  ambient: 0xa8bcd0, ambientI: 0.52,
  floodI: 3.4,
  lampGlow: 0xffe6b4, lampGlowOpacity: 0.85,

  earth: 0x413c33,
  earthDark: 0x322e28,
  gravel: 0x4c473d,
  concrete: 0x545550,
  concreteJoint: 0x3d3e3a,
  asphalt: 0x2f3234,

  ply: 0x6a4f2d,
  plyGrain: 0x4e3a21,
  steel: 0x4a5154,
  steelDark: 0x2c3234,
  rust: 0x4e3220,
  hazard: 0xc99a26,
  hazardInk: 0x14171a,
  safety: 0xb85614,
  paint: 0x8d8b84,

  boardFrame: 0x2c3336,
  boardBack: 0x3b4245,
  glass: 0x2e4854,

  labelInk: '#e6ecec',
  labelMute: '#93a5a5',
  labelBg: 'rgba(18,24,26,0.96)',
  labelRule: 'rgba(230,236,236,0.24)',
};

export function prefersDark() {
  return false;
}

export function getPalette() {
  return prefersDark() ? NIGHT : DAY;
}

export function applyDomTheme() {
  document.documentElement.setAttribute('data-theme', prefersDark() ? 'dark' : 'light');
}
