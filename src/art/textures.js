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

// The launch slingshot's frame: band anchors (fork tips) sit `span` apart on the `tipY` row.
export const SLING = { w: 300, h: 236, tipY: 40, span: 220 };

// A lit candy-cane tube along polylines: outline, shaded underside, lit body, specular streak.
// Stripes alternate along each path's length.
function caneTube(g, paths, r) {
  const RED = [0xe8213d, PAL.licoriceDark, 0xff8596];
  const WHITE = [0xfbf3f6, 0xd9c3d1, 0xffffff];
  const samples = [];
  for (const path of paths) {
    let s = 0;
    for (let i = 0; i < path.length; i++) {
      if (i) s += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
      samples.push({ x: path[i].x, y: path[i].y, c: s % 20 < 8 ? RED : WHITE });
    }
  }
  g.fillStyle(PAL.ink, 1);
  for (const p of samples) g.fillCircle(p.x, p.y, r + 2.5);
  for (const p of samples) {
    g.fillStyle(p.c[1], 1);
    g.fillCircle(p.x, p.y, r);
  }
  for (const p of samples) {
    g.fillStyle(p.c[0], 1);
    g.fillCircle(p.x - r * 0.15, p.y - r * 0.12, r * 0.8);
  }
  for (const p of samples) {
    g.fillStyle(p.c[2], 1);
    g.fillCircle(p.x - r * 0.45, p.y - r * 0.35, r * 0.25);
  }
}

const quadPath = (x0, y0, cx, cy, x1, y1, n) => {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({ x: u * u * x0 + 2 * u * t * cx + t * t * x1, y: u * u * y0 + 2 * u * t * cy + t * t * y1 });
  }
  return out;
};

// A cane's crook: an arc from the fork tip over the top and a short way down the far side.
const crookPath = (x, y, dir, R, n) => {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI * (i / n);
    out.push({ x: x + dir * R - dir * R * Math.cos(a), y: y + R * Math.sin(a) });
  }
  out.push({ x: x + dir * 2 * R, y: y + 5 }, { x: x + dir * 2 * R, y: y + 10 });
  return out;
};

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

  // The launch slingshot: candy-cane forks on a gumdrop base, frosting where the bands tie on.
  make('sling', SLING.w, SLING.h, (g, w) => {
    const cx = w / 2;
    const tipL = cx - SLING.span / 2;
    const tipR = cx + SLING.span / 2;
    const ty = SLING.tipY;
    contactShadow(g, cx, 229, 210, 14);
    caneTube(
      g,
      [
        quadPath(cx, 196, cx, 176, cx, 150, 24),
        quadPath(cx, 152, tipL + 6, 158, tipL, ty, 90),
        quadPath(cx, 152, tipR - 6, 158, tipR, ty, 90),
        crookPath(tipL, ty, -1, 12, 24),
        crookPath(tipR, ty, 1, 12, 24),
      ],
      12,
    );
    aoDot(g, cx, 166, 16);
    const base = PAL.candy[0];
    blob(g, [{ e: [cx, 204, 150, 62] }, { rr: [cx - 74, 204, 148, 26, 12] }], base, darker(base), 3);
    g.fillStyle(darker(base, 0.15), 1);
    g.fillEllipse(cx + 34, 212, 70, 30);
    g.fillStyle(base, 1);
    g.fillEllipse(cx - 6, 200, 120, 44);
    g.fillStyle(lighter(base, 0.55), 0.8);
    g.fillEllipse(cx - 40, 190, 34, 12);
    g.fillStyle(0xffffff, 0.85);
    for (let k = 0; k < 22; k++) g.fillCircle(rng.between(cx - 62, cx + 62), rng.between(186, 222), rng.realInRange(1, 2.2));
    // frosting: a collar where the stem enters the gumdrop, a band at the fork, wraps at the tips
    frost(g, beads(cx - 15, 178, cx + 15, 178, 5, 5), FROST_PINK, FROST_PINK_EDGE);
    frost(g, beads(cx - 20, 150, cx + 20, 150, 5.5, 6));
    frostDrip(g, cx - 8, 152, 10, 6);
    for (const x of [tipL, tipR]) frost(g, beads(x - 13, ty + 9, x + 13, ty + 9, 4.5, 5), FROST_PINK, FROST_PINK_EDGE);
  });

  // ---------- Altitude gameplay: gates to dive under, frosting banks to climb over, thermals ----------
  // Gate: candy-cane legs on the valley walls, a striped crossbar above the glider's ceiling, and a
  // candy curtain (stretchable strands + a row of candy tips at the hang line) hanging from it.
  make('gate_leg', 40, 256, (g, w, h) => {
    caneTube(g, [quadPath(w / 2, -10, w / 2, h / 2, w / 2, h + 10, 80)], 14);
  });
  make('gate_bar', 512, 64, (g, w, h) => {
    caneTube(g, [quadPath(16, h / 2 - 4, w / 2, h / 2 - 4, w - 16, h / 2 - 4, 220)], 20);
    frost(g, beads(28, h / 2 + 20, w - 28, h / 2 + 20, 4, 9));
  });
  const STRANDS = 16;
  make('gate_strands', 512, 64, (g, w, h) => {
    const step = w / STRANDS;
    for (let i = 0; i < STRANDS; i++) {
      const x = step * (i + 0.5);
      const c = PAL.candy[i % PAL.candy.length];
      g.fillStyle(PAL.ink, 1);
      g.fillRect(x - 5, 0, 10, h);
      g.fillStyle(c, 1);
      g.fillRect(x - 3, 0, 6, h);
      g.fillStyle(lighter(c, 0.6), 1);
      g.fillRect(x - 2, 0, 2, h);
    }
  });
  make('gate_tips', 512, 48, (g, w, h) => {
    const step = w / STRANDS;
    for (let i = 0; i < STRANDS; i++) {
      const x = step * (i + 0.5);
      const c = PAL.candy[i % PAL.candy.length];
      g.fillStyle(PAL.ink, 1);
      g.fillRect(x - 5, 0, 10, 14);
      g.fillStyle(c, 1);
      g.fillRect(x - 3, 0, 6, 14);
      blob(g, [{ c: [x, h - 15, 13] }], c, darker(c), 2.5);
      g.fillStyle(darker(c, 0.12), 1);
      g.fillCircle(x + 3, h - 12, 9);
      g.fillStyle(c, 1);
      g.fillCircle(x - 1, h - 16, 10);
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(x - 5, h - 20, 3.5);
    }
  });

  // Frosting bank: a puffy, glossy, sticky pink frosting cloud that floats low across the lane.
  // Its lumpy top edge (texture y ~8) is the line to clear.
  make('bank', 512, 256, (g, w, h) => {
    const br = new Phaser.Math.RandomDataGenerator(['bank']);
    const puffs = [];
    for (let x = 34; x <= w - 34; x += 46) puffs.push([x, 48 + br.between(-4, 6), br.between(36, 44)]);
    for (let x = 56; x <= w - 56; x += 58) puffs.push([x, h - 66 + br.between(-6, 6), br.between(34, 42)]);
    const shapes = [{ rr: [10, 48, w - 20, h - 116, 40] }, ...puffs.map((c) => ({ c }))];
    const drips = [];
    for (let x = 70; x < w - 50; x += 64 + br.between(0, 30)) drips.push({ rr: [x - 6, h - 50, 12, br.between(14, 30), 6] });
    blob(g, [...shapes, ...drips], FROST_PINK_EDGE, darker(FROST_PINK_EDGE, 0.35), 3);
    // lit body: lighter toward the top, shaded underside, glossy wet highlights
    g.fillStyle(mix(FROST_PINK, FROST_PINK_EDGE, 0.35), 1);
    for (const [x, y, r] of puffs) g.fillCircle(x - 2, y - 3, r * 0.9);
    g.fillRoundedRect(16, 52, w - 32, h - 130, 36);
    g.fillStyle(FROST_PINK, 1);
    for (const [x, y, r] of puffs) if (y < h / 2) g.fillCircle(x - 4, y - 6, r * 0.78);
    g.fillRoundedRect(20, 50, w - 40, (h - 130) * 0.55, 30);
    g.fillStyle(lighter(FROST_PINK, 0.55), 0.9);
    for (const [x, y, r] of puffs) if (y < h / 2) g.fillEllipse(x - 12, y - 18, r * 0.8, r * 0.34);
    g.fillStyle(0xffffff, 1);
    for (const [x, y, r] of puffs) if (y < h / 2) g.fillEllipse(x - 16, y - 22, r * 0.34, r * 0.14);
    for (const d of drips) {
      const [x, y, dw, dh] = d.rr;
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(x + dw * 0.35, y + dh - 3, 2);
    }
    // sticky strings and sprinkles
    g.lineStyle(2, 0xffffff, 0.55);
    for (let k = 0; k < 7; k++) {
      const x = br.between(40, w - 40);
      g.lineBetween(x, br.between(70, 110), x + br.between(-20, 20), br.between(130, 170));
    }
    for (let k = 0; k < 50; k++) {
      g.fillStyle(PAL.candy[k % PAL.candy.length], 1);
      g.fillRoundedRect(br.between(24, w - 30), br.between(26, h - 110), 7, 3, 1.5);
    }
  });
  make('bank_shadow', 256, 40, (g, w, h) => contactShadow(g, w / 2, h / 2, w, h));

  // Thermal: a vertical tile of translucent rising candy-cane stripes, fading at its edges.
  make('thermal', 140, 128, (g, w, h) => {
    for (let x = 0; x < w; x += 4) {
      const a = Math.pow(Math.sin((Math.PI * (x + 2)) / w), 1.2);
      g.fillStyle(0xffffff, 0.14 * a);
      g.fillRect(x, 0, 4, h);
      for (let k = -2; k <= 4; k++) {
        const y0 = k * 64 - x * 0.55;
        for (const [off, len, c, al] of [[0, 20, 0xe8213d, 0.5], [32, 14, 0xffffff, 0.55]]) {
          const a0 = Math.max(0, y0 + off);
          const a1 = Math.min(h, y0 + off + len);
          if (a1 > a0) {
            g.fillStyle(c, al * a);
            g.fillRect(x, a0, 4, a1 - a0);
          }
        }
      }
    }
    // bright edges where the warm air shimmers
    for (const ex of [6, w - 10]) {
      g.fillStyle(0xffffff, 0.35);
      g.fillRect(ex, 0, 4, h);
    }
    const r2 = new Phaser.Math.RandomDataGenerator(['thermal']);
    for (let k = 0; k < 16; k++) {
      const x = r2.between(16, w - 16);
      const y = r2.between(0, h);
      g.fillStyle(0xffffff, r2.realInRange(0.5, 0.95));
      for (const dy of [-h, 0, h]) g.fillCircle(x, y + dy, r2.realInRange(1.4, 2.8));
    }
  });
  make('thermal_vent', 160, 56, (g, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const rx = 66;
    const ry = 18;
    g.fillStyle(PAL.ink, 0.25);
    g.fillEllipse(cx, cy + 6, rx * 2 + 16, ry * 2 + 10);
    const n = 28;
    for (const [pass, lw] of [[0, 16], [1, 11]]) {
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        g.lineStyle(lw, pass === 0 ? PAL.ink : i % 2 ? 0xe8213d : 0xfbf3f6, 1);
        g.lineBetween(cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry, cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry);
      }
    }
    g.fillStyle(0xfff0f7, 0.9);
    g.fillEllipse(cx, cy, rx * 1.6, ry * 1.2);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(cx - 10, cy - 2, rx * 0.8, ry * 0.5);
  });

  // Cue chevron (points down; flipped to point up): a bold candy "V".
  make('chev', 60, 40, (g, w) => {
    const v = [[8, 8], [w / 2, 30], [w - 8, 8]];
    for (const [lw, c] of [[15, PAL.ink], [10, 0xffffff], [5, 0xff5e8a]]) {
      g.lineStyle(lw, c, 1);
      g.lineBetween(v[0][0], v[0][1], v[1][0], v[1][1]);
      g.lineBetween(v[1][0], v[1][1], v[2][0], v[2][1]);
      g.fillStyle(c, 1);
      for (const [x, y] of v) g.fillCircle(x, y, lw / 2);
    }
  });

  // ---------- The finale: gingerbread pilot, candy parachute, rooftop props ----------
  const COOKIE = 0xc8834a;
  const COOKIE_DARK = 0x8f5428;
  const COOKIE_LIGHT = 0xe2a56a;
  const zigzag = (g, x0, x1, y, amp, step) => {
    g.lineStyle(2.4, 0xffffff, 1);
    g.beginPath();
    g.moveTo(x0, y);
    for (let x = x0, k = 0; x <= x1; x += step, k++) g.lineTo(x, y + (k % 2 ? amp : -amp));
    g.strokePath();
  };
  // Pilot torso + head (feet-up layout: the container's origin is between the feet).
  make('gb_body', 64, 70, (g) => {
    blob(g, [{ rr: [17, 34, 30, 34, 12] }, { c: [32, 24, 19] }, { c: [18, 40, 7] }, { c: [46, 40, 7] }], COOKIE, COOKIE_DARK, 2.5);
    g.fillStyle(COOKIE_LIGHT, 1);
    g.fillCircle(27, 19, 10);
    g.fillRoundedRect(20, 37, 12, 22, 6);
    // aviator cap with ear flaps, goggles pushed up on the forehead
    g.fillStyle(darker(0xff6f9f, 0.25), 1);
    g.fillEllipse(32, 13, 42, 26);
    g.fillRoundedRect(12, 14, 9, 18, 4);
    g.fillRoundedRect(43, 14, 9, 18, 4);
    g.fillStyle(0xff6f9f, 1);
    g.fillEllipse(31, 11, 38, 20);
    g.fillStyle(0xffffff, 0.55);
    g.fillEllipse(25, 6, 14, 5);
    g.fillStyle(PAL.ink, 1);
    g.fillRect(13, 15, 38, 5);
    for (const x of [24, 40]) {
      g.fillStyle(PAL.ink, 1);
      g.fillCircle(x, 17, 6.5);
      g.fillStyle(0x9be7ff, 1);
      g.fillCircle(x, 17, 4.6);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(x - 1.5, 15.5, 1.6);
    }
    // face: eyes, icing smile, rosy cheeks
    g.fillStyle(PAL.ink, 1);
    g.fillCircle(26, 27, 2.4);
    g.fillCircle(38, 27, 2.4);
    g.fillStyle(0xff9ab8, 0.7);
    g.fillCircle(21, 32, 3);
    g.fillCircle(43, 32, 3);
    g.lineStyle(2.4, 0xffffff, 1);
    g.beginPath();
    g.arc(32, 30, 6, 0.35, Math.PI - 0.35);
    g.strokePath();
    // candy buttons and icing trim
    for (const [y, c] of [[45, 0xe8213d], [55, 0x5bd16b]]) {
      blob(g, [{ c: [32, y, 3.6] }], c, darker(c), 1.2);
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(31, y - 1, 1.1);
    }
    zigzag(g, 20, 44, 64, 2, 4);
  });
  make('gb_leg', 18, 30, (g) => {
    blob(g, [{ rr: [3, 0, 12, 28, 6] }], COOKIE, COOKIE_DARK, 2);
    g.fillStyle(COOKIE_LIGHT, 1);
    g.fillRoundedRect(5, 2, 4, 18, 2);
    zigzag(g, 4, 14, 21, 1.6, 3.3);
  });
  // Jelly-bean blaster held in two cookie hands: striped barrel, gumball hopper, muzzle at the top.
  make('gb_gun', 36, 66, (g) => {
    caneTube(g, [quadPath(18, 6, 18, 18, 18, 34, 20)], 6);
    g.fillStyle(PAL.ink, 1);
    g.fillRoundedRect(10, 0, 16, 8, 3);
    g.fillStyle(0xffc94d, 1);
    g.fillRoundedRect(12, 1, 12, 5, 2);
    blob(g, [{ c: [18, 42, 11] }], 0xe9f8ff, PAL.ink, 2);
    for (let k = 0; k < 6; k++) {
      g.fillStyle(PAL.beans[k], 1);
      g.fillEllipse(13 + (k % 3) * 5, 39 + Math.floor(k / 3) * 6, 5, 3.4);
    }
    g.fillStyle(0xffffff, 0.85);
    g.fillEllipse(13, 37, 5, 3);
    blob(g, [{ c: [9, 55, 6.5] }, { c: [27, 55, 6.5] }, { rr: [12, 50, 12, 12, 4] }], COOKIE, COOKIE_DARK, 2);
    g.fillStyle(PAL.ink, 1);
    g.fillRect(15, 50, 6, 13);
  });
  // Candy parachute: a peppermint-swirl canopy with a scalloped hem and four strings.
  make('chute', 150, 112, (g, w, h) => {
    const cx = w / 2;
    const cy = 58;
    const rx = 70;
    const ry = 52;
    g.lineStyle(1.6, PAL.ink, 0.8);
    for (const sx of [-0.92, -0.4, 0.4, 0.92]) g.lineBetween(cx + sx * rx, cy + 4, cx, h - 2);
    const n = 8;
    // the dome is the upper half of an ellipse: wedges from π to 2π
    const arcPts = (a0, a1, grow = 0) => {
      const out = [{ x: cx, y: cy + grow }];
      for (let i = 0; i <= 8; i++) {
        const a = a0 + ((a1 - a0) * i) / 8;
        out.push({ x: cx + Math.cos(a) * (rx + grow), y: cy + Math.sin(a) * (ry + grow) });
      }
      return out;
    };
    g.fillStyle(PAL.ink, 1);
    g.fillPoints(arcPts(Math.PI, Math.PI * 2, 3), true);
    for (let i = 0; i < n; i++) {
      const a0 = Math.PI + (i / n) * Math.PI;
      g.fillStyle(i % 2 ? 0xfbf3f6 : 0xe8213d, 1);
      g.fillPoints(arcPts(a0, a0 + Math.PI / n), true);
    }
    // scalloped hem
    for (let i = 0; i < n; i++) {
      const x = cx - rx + ((i + 0.5) * 2 * rx) / n;
      blob(g, [{ c: [x, cy + 1, rx / n + 1] }], i % 2 ? 0xfbf3f6 : 0xe8213d, PAL.ink, 2);
    }
    g.fillStyle(0xffffff, 0.5);
    g.fillEllipse(cx - 24, cy - 34, 30, 10);
    blob(g, [{ c: [cx, cy - ry + 2, 7] }], 0x7ad9a6, darker(0x7ad9a6), 2);
  });
  // Rooftop cover: a gingerbread brick chimney with an icing cap (origin at its base).
  make('chimney', 88, 134, (g, w, h) => {
    blob(g, [{ rr: [10, 22, w - 20, h - 22, 6] }, { rr: [2, 8, w - 4, 26, 8] }], COOKIE, COOKIE_DARK, 3);
    g.fillStyle(COOKIE_LIGHT, 1);
    g.fillRect(14, 36, (w - 28) * 0.45, h - 40);
    g.fillStyle(COOKIE_DARK, 0.35);
    g.fillRect(w - 26, 36, 12, h - 40);
    g.lineStyle(2.2, 0xffffff, 0.95);
    for (let y = 48, r = 0; y < h - 4; y += 16, r++) {
      g.lineBetween(12, y, w - 12, y);
      for (let x = 12 + (r % 2) * 16; x < w - 14; x += 32) g.lineBetween(x + 16, y - 16, x + 16, y);
    }
    frost(g, beads(6, 12, w - 6, 12, 7, 9));
    frostDrip(g, 22, 18, 16, 8);
    frostDrip(g, w - 30, 18, 10, 7);
    blob(g, [{ c: [w / 2 + 14, 4, 6] }], 0xe8213d, darker(0xe8213d), 1.5);
    g.fillStyle(0xffffff, 0.85);
    g.fillCircle(w / 2 + 12, 2, 1.8);
  });
  make('roofvent', 52, 72, (g, w, h) => {
    caneTube(g, [quadPath(w / 2, h - 2, w / 2, h / 2, w / 2, 24, 30)], 10);
    blob(g, [{ e: [w / 2, 18, 46, 22] }], 0xfbf3f6, PAL.ink, 2.5);
    g.fillStyle(0xe8213d, 1);
    g.fillEllipse(w / 2, 16, 34, 10);
    g.fillStyle(0xffffff, 0.8);
    g.fillEllipse(w / 2 - 8, 13, 10, 3);
  });

  // ---------- Cotton-candy sticky traps, residents, the flood ----------
  const CC = [0xffa8d4, 0xff8fc6, 0xffc2e3, 0xe7a8ff, 0xffd6ec];
  // spun sugar: a soft pink body wrapped in glossy fibres
  const spunSugar = (g, cx, cy, rx, ry, seed, fibres) => {
    const r2 = new Phaser.Math.RandomDataGenerator([seed]);
    for (let k = 0; k < 9; k++) {
      g.fillStyle(CC[k % CC.length], 0.55);
      g.fillEllipse(cx + r2.realInRange(-0.45, 0.45) * rx, cy + r2.realInRange(-0.35, 0.35) * ry, rx * r2.realInRange(0.8, 1.2), ry * r2.realInRange(0.7, 1.1));
    }
    for (let k = 0; k < fibres; k++) {
      const a0 = r2.realInRange(0, Math.PI * 2);
      const a1 = a0 + r2.realInRange(1.2, 2.6);
      const rr = r2.realInRange(0.35, 1);
      g.lineStyle(r2.realInRange(1, 2.2), r2.pick([0xffffff, 0xff7fbf, 0xffb3dc, 0xd99bff]), r2.realInRange(0.5, 0.9));
      g.beginPath();
      for (let i = 0; i <= 10; i++) {
        const a = a0 + ((a1 - a0) * i) / 10;
        const x = cx + Math.cos(a) * rx * rr * 0.5;
        const y = cy + Math.sin(a) * ry * rr * 0.5;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.strokePath();
    }
    g.fillStyle(0xffffff, 0.85);
    g.fillEllipse(cx - rx * 0.18, cy - ry * 0.22, rx * 0.3, ry * 0.12);
    g.fillCircle(cx + rx * 0.2, cy - ry * 0.1, 2.5);
  };
  make('cotton', 210, 160, (g, w, h) => spunSugar(g, w / 2, h / 2, 150, 108, 'cotton', 60));
  make('cc_patch', 190, 60, (g, w, h) => {
    spunSugar(g, w / 2, h / 2 + 6, 146, 32, 'patch', 34);
    const r2 = new Phaser.Math.RandomDataGenerator(['patch-up']);
    for (let k = 0; k < 9; k++) {
      const x = r2.between(20, w - 20);
      g.lineStyle(1.6, 0xffffff, 0.8);
      g.lineBetween(x, h / 2, x + r2.between(-6, 6), r2.between(2, 12));
    }
  });
  make('cc_blast', 60, 60, (g, w, h) => {
    spunSugar(g, w / 2, h / 2, 42, 42, 'blast', 18);
    g.lineStyle(2, PAL.ink, 0.6);
    g.strokeCircle(w / 2, h / 2, 22);
  });
  make('cc_strands', 140, 80, (g, w, h) => {
    const r2 = new Phaser.Math.RandomDataGenerator(['strands']);
    for (let k = 0; k < 26; k++) {
      g.lineStyle(r2.realInRange(1, 2), r2.pick([0xffffff, 0xff7fbf, 0xffb3dc]), 0.85);
      const x0 = r2.between(4, w - 4);
      const y0 = r2.between(4, h - 4);
      g.lineBetween(x0, y0, x0 + r2.between(-40, 40), y0 + r2.between(-20, 20));
    }
  });
  make('cc_ring', 120, 50, (g, w, h) => {
    g.lineStyle(4, 0xff5ea8, 0.9);
    g.strokeEllipse(w / 2, h / 2, w - 8, h - 8);
    g.lineStyle(2, 0xffffff, 0.9);
    g.strokeEllipse(w / 2, h / 2, w - 20, h - 18);
  });

  // a resident of Candy City: a little gingerbread person (arms down / arms up cheering)
  for (const [key, up] of [['resident', false], ['resident_cheer', true]]) {
    make(key, 40, 48, (g) => {
      const arms = up ? [{ rr: [2, 4, 8, 20, 4] }, { rr: [30, 4, 8, 20, 4] }] : [{ rr: [3, 20, 8, 16, 4] }, { rr: [29, 20, 8, 16, 4] }];
      blob(g, [{ c: [20, 12, 10] }, { rr: [10, 20, 20, 20, 8] }, { rr: [11, 36, 7, 12, 3] }, { rr: [22, 36, 7, 12, 3] }, ...arms], COOKIE, COOKIE_DARK, 2);
      g.fillStyle(COOKIE_LIGHT, 1);
      g.fillCircle(17, 9, 5);
      g.fillStyle(PAL.ink, 1);
      g.fillCircle(16, 11, 1.6);
      g.fillCircle(24, 11, 1.6);
      g.lineStyle(1.8, 0xffffff, 1);
      g.beginPath();
      g.arc(20, 14, 3.5, 0.3, Math.PI - 0.3);
      g.strokePath();
      for (const [y, c] of [[26, 0xe8213d], [32, 0x5bd16b]]) {
        g.fillStyle(c, 1);
        g.fillCircle(20, y, 2.2);
      }
    });
  }

  // the marshmallow flood's surface: a soft fluffy wave band that tiles sideways
  make('flood', 256, 140, (g, w, h) => {
    const r2 = new Phaser.Math.RandomDataGenerator(['flood']);
    g.fillStyle(0xf3e0ec, 1);
    g.fillRect(0, 40, w, h - 40);
    for (let x = -32; x <= w + 32; x += 32) {
      const y = 36 + Math.sin((x / w) * Math.PI * 4) * 8;
      for (const dx of [-w, 0, w]) {
        g.fillStyle(0xf3e0ec, 1);
        g.fillCircle(x + dx, y + 6, 26);
        g.fillStyle(0xfffaf3, 1);
        g.fillCircle(x + dx - 3, y, 22);
        g.fillStyle(0xffffff, 1);
        g.fillEllipse(x + dx - 8, y - 9, 14, 6);
      }
    }
    g.fillStyle(0xfffaf3, 1);
    g.fillRect(0, 56, w, h - 56);
    for (let k = 0; k < 24; k++) {
      g.fillStyle(r2.pick([0xffe0ef, 0xf3e0ec, 0xffffff]), 1);
      const x = r2.between(0, w);
      const y = r2.between(70, h - 10);
      for (const dx of [-w, 0, w]) g.fillRoundedRect(x + dx, y, 22, 14, 6);
    }
  });

  make('rainbow', 520, 270, (g, w, h) => {
    const cols = [0xff6f9f, 0xffa64d, 0xffd84d, 0x7ad9a6, 0x5ec8ff, 0x9a7bff];
    cols.forEach((c, i) => {
      g.lineStyle(16, c, 0.55);
      g.beginPath();
      g.arc(w / 2, h, w / 2 - 12 - i * 15, Math.PI, Math.PI * 2);
      g.strokePath();
    });
  });
  // a frozen resident's ice block
  make('ice_block', 32, 40, (g, w, h) => {
    g.fillStyle(PAL.frostLine, 0.9);
    g.fillRoundedRect(0, 0, w, h, 6);
    g.fillStyle(PAL.frost, 0.75);
    g.fillRoundedRect(2, 2, w - 4, h - 4, 5);
    g.fillStyle(0xffffff, 0.9);
    g.fillRoundedRect(5, 4, 5, h - 14, 2.5);
    g.fillRect(13, 5, 8, 3);
  });
}
