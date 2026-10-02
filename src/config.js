// Shared constants: palette, physics categories, tuning knobs, draw order.

export const GAME_W = 540;

// Matter gravity (y). 1.0 in Matter ≈ 1000 px/s², so this is ~250 px/s².
export const GRAVITY_Y = 0.25;
export const G_PX = GRAVITY_Y * 1000;

export const FONT = '"Trebuchet MS", "Arial Rounded MT Bold", "Avenir Next", system-ui, sans-serif';

export const PAL = {
  ink: 0x5b2a4e,
  inkHex: '#5b2a4e',
  mallow: 0xfffaf3,
  mallowShade: 0xf3e0ec,
  mallowLine: 0xd9bcd0,
  mallowPink: 0xffb3d1,
  toast: 0xe7a95b,
  toastDark: 0xc9873f,
  goo: 0x9be86a, // green slime (DESIGN.md: "green slime inside, a Ghostbusters nod")
  gooDeep: 0x3f9e4a,
  frost: 0xe4f8ff,
  frostLine: 0x8fd3f0,
  licorice: 0xe0304e,
  licoriceDark: 0xa81d36,
  sugar: 0xfffdf8,
  sugarLine: 0xe8d4ea,
  glider: 0x6fd3ff,
  gliderDark: 0x2f8fc4,
  stripe: 0xff6f9f,
  candy: [0xff5e8a, 0x7ad9a6, 0xffc94d, 0x9a7bff, 0x5ec8ff, 0xff9a4d],
  beans: [0xff4f7b, 0xffb000, 0x5bd16b, 0x8f6bff, 0x34b9ff, 0xff7a2f],
};

// Matter collision categories (bit flags) and who-hits-whom masks.
export const CAT = {
  glider: 0x0002,
  bean: 0x0004,
  goo: 0x0008,
  boss: 0x0010,
  prop: 0x0020,
  fluff: 0x0040,
  ground: 0x0080,
};

export const MASK = {
  glider: CAT.goo | CAT.boss | CAT.prop,
  bean: CAT.goo | CAT.boss,
  goo: CAT.glider | CAT.bean,
  boss: CAT.glider | CAT.bean,
  prop: CAT.glider,
  fluff: CAT.fluff | CAT.ground,
  ground: CAT.fluff,
};

export const DEPTH = {
  sky: 0,
  far: 1,
  horizon: 1.2,
  ground: 1.5,
  distant: 2,
  mid: 3,
  boss: 6,
  bossCloud: 7,
  puddle: 8,
  props: 8,
  walls: 9,
  city: 10,
  beans: 15,
  goo: 16,
  glider: 20,
  fluff: 24,
  fx: 30,
  hud: 60,
};

export const TUNE = {
  // steering
  steerSensitivity: 1.35, // drag distance → target distance
  keySpeed: 520, // px/s target movement from keyboard
  springK: 46, // pull toward the steering target
  damping: 11, // velocity damping
  maxSpeed: 1100, // px/s when clean; divided by √mass when gooey

  // goo
  massPerGoo: 0.6, // each unit of goo adds this much mass
  sinkPerGoo: 15, // px/s the target sinks per unit of goo
  listDrift: 150, // px/s sideways drift at full list
  rollPerTorque: 0.17, // radians of list per unit of off-centre goo
  maxRoll: 0.9,
  gooCap: 7,
  tier: { dusted: 0.15, splattered: 1.6, caked: 3.6 },
  dripBase: 0.05, // goo lost per splat per second (slower when heavily caked)

  // weapons
  fireCooldown: 0.15,
  beanSpeed: 760,
  beanLife: 0.55, // short range → forces hit-and-run dives

  // cleanses
  boostCharges: 3,
  boostMax: 3,
  boostKeep: 0.45, // fraction of each splat left after a bubble boost
  shakeCharges: 2,
  shakeMax: 2,
  shakeTime: 0.9, // vulnerable wobble duration
  stallTime: 2.6, // seconds caked with no cleanses before the death spiral
  thermalLift: 420, // px/s a candy-cane thermal raises the steering target while you're inside
  thermalDrip: 6, // goo drips off this many times faster inside a thermal

  // city
  frostPerGoo: 0.1,
  frostSpread: 0.025, // per second, from fully frozen buildings to neighbours

  // pacing
  flightTime: 40,
  bossHP: 100,
};

export const TIER_LABEL = {
  clean: 'CLEAN',
  dusted: 'DUSTED',
  splattered: 'SPLATTERED',
  caked: 'CAKED',
};

export const TIER_COLOR = {
  clean: '#2f9e6c',
  dusted: '#3a95c9',
  splattered: '#d9781c',
  caked: '#d8364f',
};
