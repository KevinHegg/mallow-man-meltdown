// All placeholder art is drawn procedurally with Phaser Graphics and baked to textures at boot.
import * as Phaser from 'phaser';
import { PAL } from '../config.js';

export function mix(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

const darker = (c, t = 0.28) => mix(c, 0x000000, t);
const lighter = (c, t = 0.5) => mix(c, 0xffffff, t);
const pts = (arr) => {
  const out = [];
  for (let i = 0; i < arr.length; i += 2) out.push({ x: arr[i], y: arr[i + 1] });
  return out;
};

// Shapes: { c: [x, y, r] } circle, { rr: [x, y, w, h, r] } rounded rect, { e: [cx, cy, w, h] } ellipse.
function drawShapes(g, shapes, grow) {
  for (const s of shapes) {
    if (s.c) g.fillCircle(s.c[0], s.c[1], s.c[2] + grow);
    else if (s.rr) {
      const [x, y, w, h, r] = s.rr;
      g.fillRoundedRect(x - grow, y - grow, w + grow * 2, h + grow * 2, r + grow);
    } else if (s.e) g.fillEllipse(s.e[0], s.e[1], s.e[2] + grow * 2, s.e[3] + grow * 2);
  }
}

// Draws a union of shapes with a seamless outline (outline pass first, fill pass on top).
function blob(g, shapes, fill, outline = null, ow = 3) {
  if (outline !== null) {
    g.fillStyle(outline, 1);
    drawShapes(g, shapes, ow);
  }
  g.fillStyle(fill, 1);
  drawShapes(g, shapes, 0);
}

// ---------- Painting helpers: light, gloss, volume (City uses the frosting ones for trim) ----------
// Everything here is baked into textures (or a baked city strip) once, so none of it costs
// anything per frame.
const artRng = new Phaser.Math.RandomDataGenerator(['frosting']);
export const FROST = 0xfff0f7;
export const FROST_EDGE = 0xeab0c9;
export const FROST_PINK = 0xffc6dc;
export const FROST_PINK_EDGE = 0xe98fb3;
export const VALLEY_SHADOW_PAD = 14; // valley billboards carry a contact shadow below their base
const LUMP_DARK = 0xd9b9cd; // the underside a top light never reaches
const LUMP_SIDE = 0xd6b2c9; // the side turning away from the light
const AO = 0x9c7090; // ambient occlusion pooling in seams and under things
const GOO_LIGHT = 0xd6f9b4; // the lit, translucent core of the slime
const GOO_SHADOW = 0x4fae4c;

// A top-lit marshmallow surface: translucent bands darken it toward the base, the far side turns
// away from the light, and a specular rim catches the light on the upper-left edge.
function litBody(g, x, y, w, h, r, ow = 2.5) {
  blob(g, [{ rr: [x, y, w, h, r] }], PAL.mallow, PAL.mallowLine, ow);
  const hi = h - r;
  const lo = r + 1;
  for (let k = 0; k < 5; k++) {
    const hh = hi - ((hi - lo) * k) / 4;
    g.fillStyle(LUMP_DARK, 0.2);
    g.fillRoundedRect(x + 1, y + h - hh, w - 2, hh - 1, { tl: 0, tr: 0, bl: r - 1, br: r - 1 });
  }
  g.fillStyle(LUMP_SIDE, 0.45);
  g.fillRoundedRect(x + w * 0.76, y + h * 0.2, w * 0.18, h * 0.64, Math.min(w * 0.09, h * 0.32));
  g.fillStyle(LUMP_SIDE, 0.25);
  g.fillRoundedRect(x + w * 0.64, y + h * 0.24, w * 0.14, h * 0.58, Math.min(w * 0.07, h * 0.29));
  g.lineStyle(2, 0xffffff, 0.95);
  g.beginPath();
  g.arc(x + r, y + r, Math.max(1, r - 2.5), Math.PI * 1.05, Math.PI * 1.45);
  g.strokePath();
}

// One marshmallow: a lit squashed cylinder with a bright top face, a sheen and powdery specks.
function lump(g, x, y, w, h, r = Math.min(w, h) * 0.32) {
  litBody(g, x, y, w, h, r);
  g.fillStyle(0xffffff, 1);
  g.fillEllipse(x + w * 0.5, y + h * 0.2, w * 0.78, h * 0.24);
  g.lineStyle(1.5, PAL.mallowLine, 0.55);
  g.strokeEllipse(x + w * 0.5, y + h * 0.2, w * 0.78, h * 0.24);
  g.fillStyle(0xffffff, 1);
  g.fillEllipse(x + w * 0.36, y + h * 0.15, w * 0.24, h * 0.06);
  g.fillStyle(PAL.mallowLine, 0.45);
  for (let k = 0; k < 4; k++) g.fillCircle(x + artRng.realInRange(0.2, 0.7) * w, y + artRng.realInRange(0.38, 0.72) * h, artRng.realInRange(0.8, 1.4));
}

// Ambient occlusion: soft darkness where two pieces meet (drawn under the frosting mortar).
function aoLine(g, x0, y0, x1, y1, width) {
  g.lineStyle(width, AO, 0.16);
  g.lineBetween(x0, y0, x1, y1);
  g.lineStyle(width * 0.55, AO, 0.18);
  g.lineBetween(x0, y0, x1, y1);
}
function aoDot(g, x, y, r) {
  g.fillStyle(AO, 0.15);
  g.fillCircle(x, y, r);
  g.fillStyle(AO, 0.14);
  g.fillCircle(x, y, r * 0.65);
}

// A soft shadow pooled on the ground (stacked translucent ellipses).
export function contactShadow(g, cx, cy, w, h) {
  for (let k = 0; k < 4; k++) {
    g.fillStyle(AO, 0.07);
    g.fillEllipse(cx, cy, w * (1 - k * 0.16), h * (1 - k * 0.16));
  }
}

// Piped frosting: glossy beads [x, y, r] drawn as one seamless line — shaded underside, lit
// body, a sharp specular and a small glint.
export function frost(g, list, fill = FROST, edge = FROST_EDGE) {
  g.fillStyle(edge, 1);
  for (const [x, y, r] of list) g.fillCircle(x, y + 0.5, r + 2);
  g.fillStyle(mix(fill, edge, 0.5), 1);
  for (const [x, y, r] of list) g.fillCircle(x, y, r);
  g.fillStyle(fill, 1);
  for (const [x, y, r] of list) g.fillCircle(x - r * 0.12, y - r * 0.14, r * 0.8);
  g.fillStyle(0xffffff, 1);
  for (const [x, y, r] of list) g.fillCircle(x - r * 0.32, y - r * 0.36, Math.max(0.8, r * 0.26));
  g.fillStyle(0xffffff, 0.75);
  for (const [x, y, r] of list) g.fillCircle(x + r * 0.3, y + r * 0.18, Math.max(0.5, r * 0.1));
}

export function beads(x0, y0, x1, y1, r, step) {
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
  const out = [];
  for (let i = 0; i <= n; i++) out.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, r * artRng.realInRange(0.85, 1.15)]);
  return out;
}

export function frostDrip(g, x, y, len, w = 6) {
  blob(g, [{ rr: [x - w / 2, y, w, len, w / 2] }, { c: [x, y + len, w * 0.7] }], mix(FROST, FROST_EDGE, 0.45), FROST_EDGE, 2);
  g.fillStyle(FROST, 1);
  g.fillRoundedRect(x - w / 2 + 0.5, y, w * 0.6, len, Math.min(w * 0.3, len / 2));
  g.fillCircle(x - w * 0.12, y + len - w * 0.08, w * 0.5);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(x - w * 0.22, y + len - w * 0.22, Math.max(1, w * 0.2));
}

// Piped rosette where the boss's torso seams meet.
function rosette(g, x, y, R) {
  const ring = [];
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    ring.push([x + Math.cos(a) * R * 0.62, y + Math.sin(a) * R * 0.62, R * 0.38]);
  }
  ring.push([x, y, R * 0.45]);
  frost(g, ring, FROST_PINK, FROST_PINK_EDGE);
  g.lineStyle(2, FROST_PINK_EDGE, 0.85);
  g.beginPath();
  g.arc(x, y, R * 0.28, 0, Math.PI * 1.6);
  g.strokePath();
}

// Wet slime: deep outline, a shadowed lower edge, a lit translucent core, sharp specular glints
// and a tiny trapped bubble. `main` picks the lobe that gets the big highlight.
function wetGoo(g, shapes, main = 0) {
  blob(g, shapes, PAL.goo, PAL.gooDeep, 2);
  g.fillStyle(GOO_SHADOW, 0.35);
  for (const s of shapes) {
    if (s.c) g.fillCircle(s.c[0], s.c[1] + s.c[2] * 0.22, s.c[2] * 0.75);
    else if (s.e) g.fillEllipse(s.e[0], s.e[1] + s.e[3] * 0.18, s.e[2] * 0.85, s.e[3] * 0.6);
  }
  g.fillStyle(GOO_LIGHT, 0.85);
  for (const s of shapes) {
    if (s.c) g.fillCircle(s.c[0] - s.c[2] * 0.12, s.c[1] - s.c[2] * 0.14, s.c[2] * 0.52);
    else if (s.e) g.fillEllipse(s.e[0] - s.e[2] * 0.06, s.e[1] - s.e[3] * 0.12, s.e[2] * 0.6, s.e[3] * 0.45);
  }
  const m = shapes[main];
  const [mx, my, mr] = m.c ? m.c : [m.e[0], m.e[1], Math.min(m.e[2], m.e[3]) / 2];
  g.fillStyle(0xffffff, 1);
  g.fillEllipse(mx - mr * 0.38, my - mr * 0.42, mr * 0.75, mr * 0.3);
  g.fillCircle(mx + mr * 0.32, my - mr * 0.5, Math.max(1, mr * 0.12));
  g.fillStyle(0xffffff, 0.9);
  for (const s of shapes) if (s.c && s !== m && s.c[2] >= 5) g.fillCircle(s.c[0] - s.c[2] * 0.35, s.c[1] - s.c[2] * 0.4, Math.max(0.8, s.c[2] * 0.2));
  const br = Math.max(1, mr * 0.12);
  g.fillStyle(GOO_LIGHT, 1);
  g.fillCircle(mx + mr * 0.25, my + mr * 0.2, br);
  g.lineStyle(1, PAL.gooDeep, 0.6);
  g.strokeCircle(mx + mr * 0.25, my + mr * 0.2, br);
}

// Volumetric cloud: shaded underside, body in shadow, lit tops and sunlit crowns.
function cloudPuffs(g, circles, dy = 0) {
  g.fillStyle(0xcab3de, 1);
  for (const [x, y, r] of circles) g.fillCircle(x, y + dy + r * 0.18, r);
  g.fillStyle(0xe6dbf3, 1);
  for (const [x, y, r] of circles) g.fillCircle(x, y + dy + r * 0.06, r * 0.97);
  g.fillStyle(0xfcf9ff, 1);
  for (const [x, y, r] of circles) g.fillCircle(x - r * 0.05, y + dy - r * 0.07, r * 0.86);
  g.fillStyle(0xffffff, 1);
  for (const [x, y, r] of circles) g.fillCircle(x - r * 0.24, y + dy - r * 0.28, r * 0.42);
}

export function buildTextures(scene) {
  const make = (key, w, h, draw) => {
    if (scene.textures.exists(key)) return;
    const g = scene.add.graphics();
    draw(g, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  const rng = new Phaser.Math.RandomDataGenerator(['mallow']);

  // ---------- Player glider (nose up) ----------
  make('glider', 112, 64, (g) => {
    const cx = 56;
    const wingL = [cx - 8, 24, 6, 33, 9, 41, cx - 8, 40];
    const wingR = [cx + 8, 24, 106, 33, 103, 41, cx + 8, 40];
    g.fillStyle(PAL.gliderDark, 1);
    g.fillPoints(pts(wingL.map((v, i) => (i % 2 ? v + 4 : v))), true);
    g.fillPoints(pts(wingR.map((v, i) => (i % 2 ? v + 4 : v))), true);
    g.fillStyle(PAL.mallow, 1);
    g.fillPoints(pts(wingL), true);
    g.fillPoints(pts(wingR), true);
    g.fillStyle(PAL.stripe, 1);
    g.fillPoints(pts([22, 29.6, 14, 31.3, 14.5, 40.9, 22, 40.7]), true);
    g.fillPoints(pts([90, 29.6, 98, 31.3, 97.5, 40.9, 90, 40.7]), true);
    g.lineStyle(2, PAL.ink, 0.9);
    g.strokePoints(pts(wingL), true);
    g.strokePoints(pts(wingR), true);
    // tailplane
    g.fillStyle(PAL.mallow, 1);
    g.fillPoints(pts([cx - 20, 52, cx + 20, 52, cx + 15, 58, cx - 15, 58]), true);
    g.strokePoints(pts([cx - 20, 52, cx + 20, 52, cx + 15, 58, cx - 15, 58]), true);
    // fuselage
    g.fillStyle(PAL.ink, 1);
    g.fillEllipse(cx, 34, 24, 52);
    g.fillStyle(PAL.glider, 1);
    g.fillEllipse(cx, 34, 20, 48);
    g.fillStyle(PAL.gliderDark, 0.5);
    g.fillEllipse(cx + 4, 40, 8, 30);
    g.fillStyle(PAL.stripe, 1);
    g.fillRect(cx - 9, 42, 18, 4);
    // cockpit bubble
    g.fillStyle(0xd9f6ff, 1);
    g.fillEllipse(cx, 22, 12, 14);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(cx - 2, 19, 4, 5);
  });

  // ---------- Jelly beans ----------
  PAL.beans.forEach((color, i) => {
    make(`bean${i}`, 28, 18, (g) => {
      blob(g, [{ e: [14, 9, 22, 12] }], color, darker(color), 2);
      g.fillStyle(0xffffff, 0.6);
      g.fillEllipse(10, 6, 8, 3);
    });
  });

  // ---------- Goo-filled marshmallow projectile ----------
  make('goomallow', 48, 52, (g) => {
    litBody(g, 6, 14, 36, 32, 10);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(24, 16, 34, 12);
    wetGoo(g, [
      { e: [24, 12, 30, 12] },
      { rr: [9, 12, 7, 18, 3.5] },
      { c: [12.5, 30, 4.5] },
      { rr: [33, 12, 6, 22, 3] },
      { c: [36, 34, 4] },
      { rr: [21, 12, 6, 9, 3] },
    ]);
    // grumpy mini face
    g.fillStyle(PAL.ink, 1);
    g.fillCircle(18, 34, 2.6);
    g.fillCircle(28, 34, 2.6);
    g.lineStyle(2, PAL.ink, 1);
    g.lineBetween(14, 29, 20, 31);
    g.lineBetween(32, 29, 26, 31);
    g.beginPath();
    g.arc(23, 43, 4, Math.PI * 1.15, Math.PI * 1.85);
    g.strokePath();
  });

  // ---------- Goo splat (sticks to the glider) ----------
  make('splat', 52, 40, (g) => {
    wetGoo(g, [
      { c: [26, 19, 13] },
      { c: [14, 16, 8] },
      { c: [38, 15, 9] },
      { c: [18, 27, 7] },
      { c: [35, 26, 8] },
      { c: [7, 22, 4] },
      { c: [45, 24, 4] },
      { c: [26, 31, 5] },
    ]);
  });

  // melted-marshmallow blob (arm stump)
  make('msplat', 52, 40, (g) => {
    blob(
      g,
      [{ c: [26, 18, 14] }, { c: [14, 20, 9] }, { c: [38, 20, 9] }, { rr: [20, 22, 9, 16, 4.5] }, { c: [33, 32, 5] }],
      PAL.mallow,
      PAL.mallowLine,
      2.5,
    );
    g.fillStyle(PAL.mallowPink, 0.7);
    g.fillEllipse(26, 16, 12, 6);
  });

  // heavy slime sheet for the CAKED coat (wings and tail)
  make('gcoat', 64, 34, (g) => {
    wetGoo(g, [{ e: [32, 13, 58, 18] }, { e: [18, 11, 26, 14] }, { e: [46, 12, 28, 16] }, { rr: [12, 14, 6, 14, 3] }, { c: [15, 27, 4] }, { rr: [40, 14, 6, 10, 3] }, { c: [43, 23, 3.5] }]);
    g.fillStyle(0xffffff, 0.9);
    g.fillEllipse(44, 9, 10, 3);
  });

  make('drip', 12, 16, (g) => {
    g.fillStyle(PAL.gooDeep, 1);
    g.fillCircle(6, 10, 5.2);
    g.fillTriangle(6, 0, 1.2, 9, 10.8, 9);
    g.fillStyle(PAL.goo, 1);
    g.fillCircle(6, 10, 4.3);
    g.fillTriangle(6, 1.5, 2, 9, 10, 9);
    g.fillStyle(GOO_LIGHT, 0.9);
    g.fillCircle(5.4, 9.4, 2.4);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(4.4, 8.4, 1.8, 3.2);
  });

  make('mdrip', 16, 20, (g) => {
    g.fillStyle(PAL.mallowLine, 1);
    g.fillCircle(8, 13, 6.5);
    g.fillTriangle(8, 0, 2, 12, 14, 12);
    g.fillStyle(PAL.mallow, 1);
    g.fillCircle(8, 13, 5);
    g.fillTriangle(8, 2.5, 3.5, 12, 12.5, 12);
  });

  make('puff', 36, 36, (g) => {
    for (let i = 0; i < 6; i++) {
      g.fillStyle(0xffffff, 0.2);
      g.fillCircle(18, 18, 18 - i * 3);
    }
  });

  make('bubble', 30, 30, (g) => {
    g.fillStyle(0xd6f6ff, 0.35);
    g.fillCircle(15, 15, 13);
    g.lineStyle(2, 0xffffff, 0.95);
    g.strokeCircle(15, 15, 13);
    g.fillStyle(0xffffff, 0.9);
    g.fillEllipse(10, 9, 7, 4);
  });

  make('spark', 18, 18, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillPoints(pts([9, 0, 11.5, 6.5, 18, 9, 11.5, 11.5, 9, 18, 6.5, 11.5, 0, 9, 6.5, 6.5]), true);
  });

  make('flake', 16, 16, (g) => {
    g.lineStyle(2, 0xffffff, 1);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      g.lineBetween(8 - Math.cos(a) * 7, 8 - Math.sin(a) * 7, 8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7);
    }
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 2);
  });

  [PAL.mallow, 0xffd3e6].forEach((color, i) => {
    make(`fluff${i}`, 32, 26, (g) => {
      blob(g, [{ rr: [3, 5, 26, 18, 7] }], color, 0xe3c8da, 1.5);
      g.fillStyle(0xffffff, 1);
      g.fillEllipse(16, 7, 22, 6);
    });
  });

  // ---------- Candy canyon props ----------
  [PAL.candy[0], PAL.candy[1], PAL.candy[3]].forEach((color, i) => {
    make(`gumdrop${i}`, 76, 68, (g) => {
      blob(g, [{ e: [38, 36, 62, 52] }, { rr: [7, 36, 62, 24, 10] }], color, darker(color), 3);
      g.fillStyle(lighter(color, 0.55), 0.7);
      g.fillEllipse(26, 22, 18, 10);
      g.fillStyle(0xffffff, 0.85);
      for (let k = 0; k < 14; k++) g.fillCircle(rng.between(14, 62), rng.between(18, 56), rng.realInRange(1, 2));
    });
  });

  make('licorice', 240, 30, (g) => {
    blob(g, [{ rr: [2, 4, 236, 22, 11] }], PAL.licorice, PAL.licoriceDark, 2);
    g.lineStyle(3, PAL.licoriceDark, 0.55);
    for (let x = 14; x < 224; x += 14) g.lineBetween(x, 7, x + 8, 24);
    g.fillStyle(0xffffff, 0.35);
    g.fillRoundedRect(12, 7, 216, 4, 2);
  });

  make('ledge', 190, 70, (g) => {
    const cube = (x, y, s) => {
      blob(g, [{ rr: [x, y, s, s, 6] }], PAL.sugar, PAL.sugarLine, 2);
      g.fillStyle(0xffffff, 1);
      g.fillRect(x + 5, y + 5, 9, 3);
      g.fillStyle(PAL.sugarLine, 0.8);
      g.fillCircle(x + s * 0.7, y + s * 0.6, 1.5);
      g.fillCircle(x + s * 0.35, y + s * 0.75, 1.2);
    };
    for (let i = 0; i < 5; i++) cube(4 + i * 36, 36, 32);
    for (let i = 0; i < 3; i++) cube(4 + i * 36, 3, 32);
    blob(g, [{ e: [132, 22, 22, 18] }], PAL.candy[2], darker(PAL.candy[2]), 2);
  });

  make('pk_boost', 60, 60, (g) => {
    g.fillStyle(0x9fe9ff, 0.55);
    g.fillCircle(30, 30, 26);
    g.lineStyle(3, 0xffffff, 1);
    g.strokeCircle(30, 30, 26);
    g.fillStyle(0xffffff, 0.75);
    g.fillCircle(20, 40, 4);
    g.fillCircle(40, 42, 3);
    g.fillCircle(36, 34, 2);
    g.fillStyle(PAL.stripe, 1);
    g.fillTriangle(30, 14, 18, 30, 42, 30);
    g.fillRect(25, 29, 10, 13);
    g.fillStyle(0xffffff, 0.9);
    g.fillEllipse(19, 18, 10, 5);
  });

  make('pk_shake', 60, 60, (g) => {
    g.fillStyle(0xfff1a8, 0.95);
    g.fillCircle(30, 30, 27);
    g.lineStyle(3, 0xf0b93a, 1);
    g.strokeCircle(30, 30, 27);
    blob(g, [{ rr: [19, 23, 22, 25, 7] }], 0xe9fbff, 0x9ccbe0, 2);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(21, 36, 18, 10, 5);
    blob(g, [{ rr: [19, 13, 22, 11, 5] }], 0xc9d2e3, 0x8a93a8, 2);
    g.fillStyle(PAL.ink, 1);
    g.fillCircle(25, 18, 1.4);
    g.fillCircle(30, 18, 1.4);
    g.fillCircle(35, 18, 1.4);
    g.lineStyle(2.5, PAL.ink, 0.8);
    g.lineBetween(10, 24, 14, 30);
    g.lineBetween(10, 34, 14, 38);
    g.lineBetween(50, 24, 46, 30);
    g.lineBetween(50, 34, 46, 38);
  });

  // ---------- Tileable backgrounds (vertical scroll) ----------
  const wall = (key, mirror) =>
    make(key, 64, 256, (g, w, h) => {
      const mx = (x, width) => (mirror ? w - x - width : x);
      g.fillStyle(0xead6ea, 1);
      g.fillRect(0, 0, w, h);
      const cs = 27;
      for (let row = 0; row < 256 / 32; row++) {
        for (let col = 0; col < 2; col++) {
          const x = mx(col * cs, cs);
          const y = row * 32;
          g.fillStyle((row + col) % 2 ? 0xfffaff : 0xf7eaf7, 1);
          g.fillRoundedRect(x + 2, y + 2, cs - 4, 28, 5);
          g.fillStyle(0xffffff, 0.9);
          g.fillRect(x + 5, y + 6, 8, 3);
        }
      }
      // candy-cane edge facing the canyon
      const ex = mx(54, 10);
      g.fillStyle(0xffffff, 1);
      g.fillRect(ex, 0, 10, h);
      g.fillStyle(PAL.licorice, 1);
      for (let y = -16; y < h; y += 16) {
        g.fillPoints(pts([ex, y + 6, ex + 10, y, ex + 10, y + 7, ex, y + 13]), true);
      }
      g.fillStyle(PAL.ink, 0.18);
      g.fillRect(mirror ? 0 : w - 2, 0, 2, h);
    });
  wall('wallL', false);
  wall('wallR', true);

  make('farsky', 540, 512, (g, w, h) => {
    const puffCloud = (x, y, r, color, alpha) => {
      g.fillStyle(color, alpha);
      g.fillCircle(x, y, r);
      g.fillCircle(x - r * 0.9, y + r * 0.25, r * 0.7);
      g.fillCircle(x + r * 0.95, y + r * 0.2, r * 0.75);
      g.fillCircle(x + r * 0.3, y - r * 0.35, r * 0.65);
    };
    const r2 = new Phaser.Math.RandomDataGenerator(['sky']);
    for (let i = 0; i < 12; i++) {
      const x = r2.between(20, w - 20);
      const y = r2.between(0, h);
      const r = r2.between(18, 40);
      const color = r2.pick([0xffffff, 0xffe3f1, 0xe1f4ff]);
      // draw wrapped copies so the tile seams are invisible
      for (const dy of [-h, 0, h]) puffCloud(x, y + dy, r, color, 0.55);
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle(0xffffff, r2.realInRange(0.4, 0.9));
      g.fillCircle(r2.between(0, w), r2.between(2, h - 2), r2.realInRange(0.8, 2));
    }
  });

  make('cloud', 200, 120, (g) => {
    cloudPuffs(g, [[50, 62, 30], [90, 46, 38], [138, 54, 32], [168, 68, 22], [100, 72, 30], [28, 74, 18]], 10);
    g.fillStyle(0xffd6ea, 0.35);
    g.fillEllipse(100, 98, 140, 12);
  });

  // The boss's throne: a big volumetric cloud with a pink bounce light and a soft drop shadow.
  // Padded 15px top and bottom (was 170 tall) so its centre — where the boss stands — is unchanged.
  make('bosscloud', 440, 200, (g) => {
    for (let k = 0; k < 5; k++) {
      g.fillStyle(0x8a6aa8, 0.06);
      g.fillEllipse(220, 184, 380 - k * 40, 26 - k * 3);
    }
    cloudPuffs(
      g,
      [
        [80, 95, 50], [150, 70, 62], [230, 62, 68], [310, 72, 60], [370, 95, 48],
        [120, 112, 44], [220, 114, 48], [320, 110, 44], [40, 112, 30], [405, 114, 28],
      ],
      15,
    );
    g.fillStyle(0xffd6ea, 0.4);
    g.fillEllipse(220, 152, 300, 24);
  });

  // a warm halo for the boss arena's sun
  make('sunglow', 260, 260, (g) => {
    for (let k = 0; k < 8; k++) {
      g.fillStyle(0xfff1a8, 0.06);
      g.fillCircle(130, 130, 128 - k * 9);
    }
  });

  // atmospheric haze that sits on the valley's horizon
  make('hazeband', 64, 120, (g, w, h) => {
    for (let y = 0; y < h; y += 4) {
      g.fillStyle(0xf4e4f6, 0.42 * Math.sin((Math.PI * (y + 2)) / h));
      g.fillRect(0, y, w, 4);
    }
  });

  // ---------- Valley (into-the-horizon flight) ----------
  // Building billboards are drawn for the LEFT wall (inner face = right edge) and flipped for the right.
  [0, 1].forEach((v) =>
    make(`v_tower${v}`, 120, 300 + VALLEY_SHADOW_PAD, (g, w) => {
      const h = 300; // base line; the pad below holds the contact shadow
      contactShadow(g, w / 2, h + 3, w * 0.98, 20);
      const s = 36;
      const cols = 3;
      const rows = 7;
      const x0 = (w - cols * s) / 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const accent = v === 0 ? (r * 3 + c) % 7 === 2 : r === 3;
          const fill = accent ? (v === 0 ? 0xffd3e6 : 0xd9f3ff) : (r + c) % 2 ? PAL.sugar : 0xfaf0fa;
          blob(g, [{ rr: [x0 + c * s + 1, h - (r + 1) * s + 1, s - 2, s - 2, 6] }], fill, PAL.sugarLine, 2);
          g.fillStyle(0xffffff, 1);
          g.fillRect(x0 + c * s + 6, h - (r + 1) * s + 6, 9, 3);
          g.fillStyle(PAL.sugarLine, 0.5);
          g.fillRect(x0 + c * s + 3, h - r * s - 9, s - 6, 6);
        }
      }
      const topY = h - rows * s;
      g.fillStyle(PAL.ink, 0.1);
      g.fillRect(x0 + cols * s - 12, topY, 12, rows * s);
      // frosting mortar between the sugar-cube courses
      for (let r = 1; r < rows; r++) frost(g, beads(x0 + 3, h - r * s, x0 + cols * s - 3, h - r * s, 2.6, 7));
      frost(g, beads(x0 + 4, topY + 1, x0 + cols * s - 4, topY + 1, 3.4, 8));
      if (v === 0) {
        blob(g, [{ e: [w / 2, topY - 2, 52, 40] }], PAL.candy[1], darker(PAL.candy[1]), 2);
        g.fillStyle(0xffffff, 0.8);
        g.fillCircle(w / 2 - 8, topY - 10, 2);
        g.fillCircle(w / 2 + 9, topY - 6, 1.6);
      } else {
        g.fillStyle(0x3f8f3a, 1);
        g.fillRect(w / 2 + 1, topY - 36, 3, 16);
        blob(g, [{ c: [w / 2, topY - 14, 14] }], 0xe8213d, darker(0xe8213d), 2);
        g.fillStyle(0xffffff, 0.7);
        g.fillCircle(w / 2 - 5, topY - 19, 3);
      }
    }),
  );

  [PAL.candy[0], PAL.candy[3], PAL.candy[2]].forEach((color, i) =>
    make(`v_gumhouse${i}`, 130, 230 + VALLEY_SHADOW_PAD, (g, w) => {
      const h = 230;
      contactShadow(g, w / 2, h + 3, w * 0.98, 20);
      blob(g, [{ e: [w / 2, 78, 116, 96] }], color, darker(color), 3);
      g.fillStyle(darker(color, 0.12), 0.6);
      g.fillEllipse(w / 2 + 14, 92, 80, 40);
      g.fillStyle(lighter(color, 0.55), 0.7);
      g.fillEllipse(44, 52, 26, 14);
      g.fillStyle(0xffffff, 0.85);
      for (let k = 0; k < 12; k++) g.fillCircle(rng.between(24, 106), rng.between(40, 76), rng.realInRange(1, 2));
      blob(g, [{ rr: [10, 80, 110, 148, 8] }], lighter(color, 0.6), darker(color, 0.15), 3);
      g.fillStyle(darker(color, 0.1), 0.25);
      g.fillRoundedRect(12, 170, 106, 56, { tl: 0, tr: 0, bl: 7, br: 7 });
      g.fillStyle(0xfff1a8, 1);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) g.fillRoundedRect(22 + c * 32, 96 + r * 30, 18, 18, 4);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) frost(g, beads(23 + c * 32, 115 + r * 30, 39 + c * 32, 115 + r * 30, 1.8, 5));
      g.fillStyle(darker(color, 0.35), 1);
      g.fillRoundedRect(w / 2 - 12, h - 32, 24, 30, { tl: 12, tr: 12, bl: 0, br: 0 });
      g.fillStyle(PAL.ink, 0.1);
      g.fillRect(104, 82, 14, 144);
      // frosting where the gumdrop roof sits on the house
      frostDrip(g, 30, 84, 10, 6);
      frostDrip(g, 98, 84, 7, 5);
      frost(g, beads(14, 82, 116, 82, 4, 9));
    }),
  );

  make('v_cane', 90, 330 + VALLEY_SHADOW_PAD, (g, w) => {
    const h = 330;
    contactShadow(g, w / 2, h + 3, 70, 18);
    const cw = 40;
    const x0 = (w - cw) / 2;
    const top = 90;
    g.fillStyle(0xffffff, 1);
    g.fillRect(x0, top, cw, h - top);
    g.fillStyle(0xe8213d, 1);
    for (let y = top; y < h; y += 28) g.fillPoints(pts([x0, y + 14, x0 + cw, y, x0 + cw, y + 12, x0, y + 26]), true);
    g.fillStyle(PAL.ink, 0.12);
    g.fillRect(x0 + cw - 8, top, 8, h - top);
    g.lineStyle(2, PAL.licoriceDark, 0.6);
    g.strokeRect(x0, top, cw, h - top);
    g.fillStyle(0xffffff, 1);
    g.fillRect(w / 2 - 3, top - 30, 6, 30);
    blob(g, [{ c: [w / 2, top - 44, 38] }], PAL.candy[4], darker(PAL.candy[4]), 3);
    g.lineStyle(5, 0xffffff, 0.9);
    g.beginPath();
    g.arc(w / 2, top - 44, 22, 0, Math.PI * 1.6);
    g.strokePath();
    g.beginPath();
    g.arc(w / 2, top - 44, 10, Math.PI, Math.PI * 2.5);
    g.strokePath();
    frostDrip(g, x0 + 10, top + 2, 9, 5);
    frost(g, beads(x0 - 2, top + 1, x0 + cw + 2, top + 1, 4, 8));
  });

  // Two horizon layers that drift at different rates; the far ridge carries giant lollipop trees.
  const mountainRange = (key, peaks, color, extra) =>
    make(key, 680, 180, (g, w, h) => {
      for (const [x, ph, hw] of peaks) {
        g.fillStyle(color, 1);
        g.fillTriangle(x - hw, h, x + hw, h, x, h - ph);
        // icing cap with little drips
        const capY = h - ph + ph * 0.3;
        const cw = hw * 0.3;
        g.fillStyle(0xffffff, 1);
        g.fillTriangle(x - cw, capY, x + cw, capY, x, h - ph);
        for (let k = -1; k <= 1; k++) g.fillCircle(x + k * cw * 0.6, capY, cw * 0.28);
      }
      extra?.(g, w, h);
    });
  mountainRange('mtn_far', [[60, 120, 110], [200, 150, 130], [340, 128, 120], [480, 160, 140], [620, 125, 115]], 0xe6c9f5, (g, w, h) => {
    for (const [x, tall, r] of [[130, 118, 20], [415, 146, 26], [575, 108, 18]]) {
      const cy = h - tall - r + 4;
      g.fillStyle(0xcfa6e3, 1);
      g.fillRect(x - 2, h - tall, 4, tall);
      g.fillCircle(x, cy, r);
      g.lineStyle(3, 0xe9d2f7, 1);
      g.beginPath();
      g.arc(x, cy, r * 0.55, 0, Math.PI * 1.5);
      g.strokePath();
    }
  });
  mountainRange('mtn_near', [[0, 80, 100], [130, 100, 110], [270, 86, 95], [410, 106, 120], [560, 90, 105], [680, 80, 100]], 0xffbfdc);

  // Wind streak: bright head on the right, fading tail (rotated to point away from the vanishing point).
  make('streak', 64, 6, (g) => {
    for (let i = 0; i < 16; i++) {
      const a = Math.pow((i + 1) / 16, 1.6);
      g.fillStyle(0xffffff, a * 0.45);
      g.fillRect(i * 4, 0, 4, 6);
      g.fillStyle(0xffffff, a);
      g.fillRect(i * 4, 2, 4, 2);
    }
  });

  // Fly-under arches spanning the valley (leg centres 500px apart; scaled to the valley in Valley.js).
  const arch = (key, band, stripe) =>
    make(key, 560, 700, (g, w, h) => {
      const cx = 280;
      const cy = 280;
      const r = 250;
      const t = 56;
      for (const lx of [cx - r, cx + r]) {
        g.fillStyle(band, 1);
        g.fillRect(lx - t / 2, cy, t, h - cy);
        g.fillStyle(stripe, 1);
        for (let y = cy - 20; y < h; y += 34) g.fillPoints(pts([lx - t / 2, y + 18, lx + t / 2, y, lx + t / 2, y + 14, lx - t / 2, y + 32]), true);
        g.fillStyle(PAL.ink, 0.15);
        g.fillRect(lx + t / 2 - 8, cy, 8, h - cy);
      }
      g.lineStyle(t, band, 1);
      g.beginPath();
      g.arc(cx, cy, r, Math.PI, Math.PI * 2);
      g.strokePath();
      g.lineStyle(t, stripe, 1);
      for (let a = Math.PI + 0.06; a < Math.PI * 2 - 0.05; a += 0.2) {
        g.beginPath();
        g.arc(cx, cy, r, a, a + 0.09);
        g.strokePath();
      }
      g.lineStyle(3, darker(band === 0xffffff ? 0xe8213d : band, 0.35), 1);
      for (const rr of [r + t / 2, r - t / 2]) {
        g.beginPath();
        g.arc(cx, cy, rr, Math.PI, Math.PI * 2);
        g.strokePath();
      }
      blob(g, [{ e: [cx, cy - r, 70, 54] }], PAL.candy[1], darker(PAL.candy[1]), 3);
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(cx - 12, cy - r - 10, 3);
      g.fillCircle(cx + 10, cy - r + 4, 2.4);
    });
  arch('arch0', 0xffffff, 0xe8213d); // candy cane
  arch('arch1', PAL.licorice, PAL.licoriceDark); // licorice

  // ---------- Evil Marshmallow Man parts ----------
  // He is built from individual marshmallows glued together with frosting mortar. Texture sizes
  // match the rig (origins, shoulders, hand reach), so only the art changes.
  make('boss_body', 180, 164, (g) => {
    // four big marshmallows glued into a torso; the silhouette stays a rounded block
    lump(g, 92, 14, 80, 68);
    lump(g, 8, 10, 84, 72);
    lump(g, 90, 82, 82, 72);
    lump(g, 10, 80, 82, 74);
    // ambient occlusion pooling where the marshmallows meet (under the mortar)
    aoLine(g, 91, 16, 91, 150, 22);
    aoLine(g, 14, 81, 168, 81, 22);
    aoLine(g, 36, 13, 144, 13, 18);
    aoLine(g, 18, 153, 162, 153, 14);
    aoDot(g, 14, 38, 16);
    aoDot(g, 166, 38, 16);
    // drips first, so the piped seams cover their tops
    frostDrip(g, 64, 14, 14, 7);
    frostDrip(g, 116, 14, 9, 6);
    frostDrip(g, 16, 44, 12, 6);
    frostDrip(g, 165, 44, 9, 6);
    frostDrip(g, 96, 88, 12, 6);
    frostDrip(g, 46, 154, 4, 6);
    frostDrip(g, 132, 154, 4, 5);
    // mortar: seams between the lumps, neck collar, shoulders (arms glue on here), waist band
    frost(g, beads(91, 18, 91, 148, 6, 11));
    frost(g, beads(16, 80, 166, 82, 6, 11));
    frost(g, beads(40, 11, 140, 11, 8, 12));
    frost(g, [[12, 30, 9], [20, 40, 8], [10, 45, 6]]);
    frost(g, [[168, 30, 9], [160, 40, 8], [170, 45, 6]]);
    frost(g, beads(20, 153, 160, 153, 5, 10));
    rosette(g, 91, 81, 17);
  });

  make('boss_head', 144, 124, (g) => {
    // one big marshmallow with a toasted top
    litBody(g, 8, 22, 128, 94, 30, 3);
    g.fillStyle(PAL.mallowLine, 0.45);
    for (let k = 0; k < 6; k++) g.fillCircle(rng.between(22, 122), rng.between(48, 100), rng.realInRange(0.8, 1.5));
    g.fillStyle(0xfff3e4, 1);
    g.fillEllipse(72, 26, 128, 34);
    g.fillStyle(PAL.toast, 1);
    g.fillEllipse(72, 24, 118, 26);
    g.fillRoundedRect(30, 24, 12, 20, 6);
    g.fillRoundedRect(96, 24, 10, 26, 5);
    g.fillStyle(PAL.toastDark, 0.7);
    g.fillEllipse(58, 21, 46, 10);
    g.fillCircle(96, 26, 4);
    // a smear of frosting on his temple
    frostDrip(g, 16, 56, 9, 5);
    frost(g, [[20, 50, 6], [27, 46, 5], [15, 57, 4]]);
  });

  make('boss_eyes_angry', 110, 48, (g) => {
    for (const x of [30, 80]) {
      blob(g, [{ e: [x, 30, 30, 30] }], 0xffffff, PAL.ink, 3);
      g.fillStyle(PAL.ink, 1);
      g.fillCircle(x + (x < 55 ? 4 : -4), 32, 8);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(x + (x < 55 ? 6 : -2), 29, 2.5);
    }
    g.fillStyle(PAL.ink, 1);
    g.fillPoints(pts([10, 5, 48, 13, 48, 20, 10, 12]), true);
    g.fillPoints(pts([62, 13, 100, 5, 100, 12, 62, 20]), true);
  });

  make('boss_eyes_droopy', 110, 48, (g) => {
    for (const x of [30, 80]) {
      blob(g, [{ e: [x, 30, 30, 26] }], 0xffffff, PAL.ink, 3);
      g.fillStyle(PAL.ink, 1);
      g.fillCircle(x, 35, 7);
      g.fillStyle(PAL.mallowShade, 1);
      g.fillEllipse(x, 22, 30, 16);
      g.lineStyle(3, PAL.ink, 1);
      g.lineBetween(x - 15, 28, x + 15, 28);
    }
    g.fillStyle(PAL.ink, 1);
    g.fillPoints(pts([10, 12, 46, 5, 46, 11, 10, 18]), true);
    g.fillPoints(pts([64, 5, 100, 12, 100, 18, 64, 11]), true);
  });

  make('boss_eyes_dizzy', 110, 48, (g) => {
    for (const x of [30, 80]) {
      blob(g, [{ e: [x, 28, 30, 30] }], 0xffffff, PAL.ink, 3);
      g.lineStyle(3, PAL.ink, 1);
      g.beginPath();
      g.arc(x, 28, 9, 0, Math.PI * 1.6);
      g.strokePath();
      g.beginPath();
      g.arc(x, 28, 4, Math.PI, Math.PI * 2.4);
      g.strokePath();
    }
  });

  make('boss_mouth_grin', 80, 34, (g) => {
    g.fillStyle(PAL.ink, 1);
    g.fillEllipse(40, 12, 62, 30);
    g.fillStyle(PAL.mallow, 1);
    g.fillEllipse(40, 4, 70, 18);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(24, 12, 30, 12, 27, 19);
    g.fillTriangle(50, 12, 56, 12, 53, 19);
  });

  make('boss_mouth_wobble', 80, 34, (g) => {
    const wave = [];
    for (let x = 10; x <= 70; x += 4) wave.push({ x, y: 17 + Math.sin((x - 10) / 6) * 5 });
    g.lineStyle(5, PAL.ink, 1);
    g.strokePoints(wave, false);
  });

  make('boss_arm', 56, 124, (g) => {
    // torn frosting at the shoulder end (hidden behind his body until the arm comes off)
    frost(g, [[20, 7, 6], [28, 5, 7], [36, 7, 6]]);
    lump(g, 9, 4, 38, 42); // upper arm
    lump(g, 11, 48, 34, 38); // forearm
    aoLine(g, 10, 47, 46, 47, 12);
    aoLine(g, 12, 87, 44, 87, 10);
    blob(g, [{ c: [28, 103, 18] }, { c: [12, 96, 7.5] }], PAL.mallow, PAL.mallowLine, 2.5); // mitten hand
    g.fillStyle(PAL.mallowShade, 1);
    g.fillEllipse(36, 108, 14, 18);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(23, 96, 12, 7);
    // elbow and wrist mortar
    frostDrip(g, 40, 49, 8, 6);
    frostDrip(g, 17, 89, 7, 5);
    frost(g, beads(10, 47, 46, 47, 5, 8));
    frost(g, beads(12, 87, 44, 87, 4.5, 8));
  });

  make('boss_leg', 60, 66, (g) => {
    lump(g, 9, 3, 42, 30); // thigh
    lump(g, 8, 33, 44, 30); // shin
    aoLine(g, 10, 33, 50, 33, 12);
    frostDrip(g, 44, 35, 7, 5);
    frost(g, beads(10, 33, 50, 33, 5, 9)); // knee mortar
  });

  // ARM OFF! stump: torn marshmallow strands over a frosting joint
  make('boss_stump', 52, 44, (g) => {
    const torn = [4, 30, 8, 16, 14, 22, 20, 9, 27, 19, 33, 6, 39, 18, 46, 11, 48, 32];
    g.fillStyle(PAL.mallowLine, 1);
    g.fillPoints(pts(torn), true);
    g.fillStyle(PAL.mallow, 1);
    g.fillPoints(pts(torn.map((v, i) => (i % 2 ? v + 3 : v + (v < 26 ? 2 : -2)))), true);
    g.lineStyle(2, PAL.mallow, 1);
    g.lineBetween(20, 12, 18, 3);
    g.lineBetween(33, 9, 36, 1);
    g.lineBetween(45, 14, 50, 8);
    frostDrip(g, 18, 33, 6, 6);
    frostDrip(g, 34, 33, 4, 5);
    frost(g, [[12, 30, 8], [24, 32, 9], [37, 30, 8], [46, 29, 5]]);
  });

  make('boss_puddle', 300, 70, (g) => {
    blob(
      g,
      [{ e: [150, 44, 270, 36] }, { e: [96, 36, 120, 30] }, { e: [204, 34, 130, 30] }, { c: [40, 52, 10] }, { c: [262, 52, 9] }],
      PAL.mallow,
      PAL.mallowLine,
      3,
    );
    g.fillStyle(PAL.mallowPink, 0.6);
    g.fillEllipse(150, 40, 60, 10);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(110, 32, 50, 8);
    frost(g, [[72, 40, 6], [80, 44, 5], [214, 38, 6], [222, 43, 4]]);
    frost(g, [[176, 46, 5], [184, 44, 4]], FROST_PINK, FROST_PINK_EDGE);
  });
}
