// The candy rooftop where the pilot makes his stand: a frosted roof with a candy-cane railing
// along the back, a sugar-brick facade with lit windows below, and two gingerbread chimneys that
// stand in front of him as cover. The static roof is baked into one texture at first use; goo
// that lands on the roof leaves pooled splats that fade.
import * as Phaser from 'phaser';
import { DEPTH, PAL } from '../config.js';
import { beads, contactShadow, frost, frostDrip, FROST, FROST_EDGE, FROST_PINK, FROST_PINK_EDGE, mix } from '../art/textures.js';

const FACADE = 0xc9b8ff;
const SPLATS = 8;
const SPLAT_LIFE = 3.5;

export class Rooftop {
  // keepClear: the HUD control slots ({x, y}); no window is drawn near them.
  constructor(scene, { roofY, keepClear = [] }) {
    const { width: W, height: H } = scene.scale;
    this.scene = scene;
    this.roofY = roofY;
    this.top = roofY - 42;
    this.keepClear = keepClear;
    const key = `roof_${W}x${H}_${roofY}_${keepClear.length}`;
    if (!scene.textures.exists(key)) {
      const g = scene.add.graphics();
      g.translateCanvas(0, -this.top);
      this.draw(g, W, H);
      g.generateTexture(key, W, H - this.top);
      g.destroy();
    }
    scene.add.image(0, this.top, key).setOrigin(0, 0).setDepth(DEPTH.city + 2);
    scene.add.image(W / 2 - 150, roofY - 6, 'roofvent').setOrigin(0.5, 1).setDepth(DEPTH.city + 2.5);

    // chimneys stand in front of the pilot: behind one he is covered
    this.chimneys = [86, W - 86].map((x) => {
      scene.add.image(x, roofY + 8, 'chimney').setOrigin(0.5, 1).setDepth(DEPTH.glider + 1);
      return { x, half: 34 };
    });
    this.splats = [];
    for (let i = 0; i < SPLATS; i++) {
      this.splats.push({ img: scene.add.image(0, 0, 'splat').setVisible(false).setDepth(DEPTH.city + 3), t: 0 });
    }
  }

  draw(g, W, H) {
    const y = this.roofY;
    // a low candy-cane railing along the back edge (low, so the city behind stays in view)
    for (let x = 18; x < W; x += 58) {
      g.fillStyle(PAL.ink, 1);
      g.fillRoundedRect(x - 6, y - 36, 12, 30, 5);
      g.fillStyle(0xfbf3f6, 1);
      g.fillRoundedRect(x - 4, y - 34, 8, 26, 4);
      g.fillStyle(0xe8213d, 1);
      for (let k = 0; k < 2; k++) g.fillRect(x - 4, y - 30 + k * 12, 8, 5);
    }
    for (const ry of [y - 32]) {
      g.fillStyle(PAL.ink, 1);
      g.fillRoundedRect(0, ry - 5, W, 10, 5);
      g.fillStyle(0xfbf3f6, 1);
      g.fillRoundedRect(0, ry - 3, W, 6, 3);
      g.fillStyle(0xe8213d, 1);
      for (let x = 0; x < W; x += 22) g.fillRect(x, ry - 3, 9, 6);
    }
    // the roof's top face: thick frosting, lit from above
    g.fillStyle(FROST_EDGE, 1);
    g.fillRect(0, y - 14, W, 36);
    g.fillStyle(mix(FROST, FROST_EDGE, 0.35), 1);
    g.fillRect(0, y - 12, W, 30);
    g.fillStyle(FROST, 1);
    g.fillRect(0, y - 12, W, 14);
    g.fillStyle(0xffffff, 0.8);
    for (let x = 10; x < W; x += 46) g.fillEllipse(x + 12, y - 6, 26, 4);
    // facade: sugar bricks, two rows of lit windows, shading toward the street
    const fy = y + 22;
    g.fillStyle(FACADE, 1);
    g.fillRect(0, fy, W, H - fy);
    g.lineStyle(2, mix(FACADE, 0xffffff, 0.45), 1);
    for (let by = fy + 16, r = 0; by < H; by += 22, r++) {
      g.lineBetween(0, by, W, by);
      for (let bx = (r % 2) * 30; bx < W; bx += 60) g.lineBetween(bx, by - 22, bx, by);
    }
    // Windows that read as architecture, not as buttons: framed sash windows with panes, a
    // frosting lintel, shutters and a flower-box sill, set into the brick — and never near a
    // control: any spot that would come within reach of a HUD slot stays plain wall.
    const placed = [];
    const clear = (r) =>
      this.keepClear.every((c) => r.x1 < c.x - c.rx || r.x0 > c.x + c.rx || r.y1 < c.y - c.up || r.y0 > c.y + c.down) &&
      placed.every((p) => r.x1 < p.x0 - 10 || r.x0 > p.x1 + 10);
    for (const wy of [fy + 40, fy + 170]) {
      if (wy + 104 > H) continue;
      for (const cx of [W * 0.33, W * 0.67, W * 0.5]) {
        const r = { x0: cx - 60, x1: cx + 60, y0: wy - 20, y1: wy + 104 };
        if (!clear(r)) continue;
        placed.push(r);
        this.window(g, cx, wy);
      }
    }
    g.fillStyle(PAL.ink, 0.12);
    g.fillRect(0, H - 70, W, 70);
    // the roof's front lip: frosting beads and drips spilling over the facade
    contactShadow(g, W / 2, fy + 6, W * 1.2, 16);
    frost(g, beads(-4, fy, W + 4, fy, 8, 14));
    for (let x = 30; x < W; x += 74) frostDrip(g, x, fy + 4, 12 + ((x / 74) % 3) * 8, 9);
  }

  window(g, cx, y) {
    const w = 66;
    const h = 80;
    const x = cx - w / 2;
    // shutters with slats
    for (const [sx, c] of [[x - 22, 0xff9ec4], [x + w + 2, 0x7ad9a6]]) {
      g.fillStyle(PAL.ink, 1);
      g.fillRoundedRect(sx - 2, y - 2, 24, h + 4, 4);
      g.fillStyle(c, 1);
      g.fillRoundedRect(sx, y, 20, h, 3);
      g.fillStyle(mix(c, 0x000000, 0.18), 1);
      for (let k = 8; k < h - 4; k += 9) g.fillRect(sx + 3, y + k, 14, 3);
    }
    // frame, four panes of pale glass, mullions
    g.fillStyle(PAL.ink, 1);
    g.fillRect(x - 4, y - 4, w + 8, h + 8);
    g.fillStyle(0xfffaf3, 1);
    g.fillRect(x - 2, y - 2, w + 4, h + 4);
    const pw = (w - 10) / 2;
    const ph = (h - 10) / 2;
    for (const [px, py] of [[x + 3, y + 3], [x + 7 + pw, y + 3], [x + 3, y + 7 + ph], [x + 7 + pw, y + 7 + ph]]) {
      g.fillStyle(0xbfdcf5, 1);
      g.fillRect(px, py, pw, ph);
      g.fillStyle(0xe4f2ff, 1);
      g.fillRect(px, py, pw, ph * 0.4);
      g.fillStyle(0xffffff, 0.85);
      g.fillPoints([{ x: px + 4, y: py + ph - 6 }, { x: px + pw - 10, y: py + 4 }, { x: px + pw - 4, y: py + 4 }, { x: px + 10, y: py + ph - 6 }], true);
    }
    // frosting lintel with a cherry keystone
    frost(g, beads(x - 8, y - 9, x + w + 8, y - 9, 5, 8), FROST_PINK, FROST_PINK_EDGE);
    g.fillStyle(0xe8213d, 1);
    g.fillCircle(cx, y - 15, 5);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(cx - 1.5, y - 16.5, 1.5);
    // sill and a flower box
    g.fillStyle(PAL.ink, 1);
    g.fillRoundedRect(x - 10, y + h + 2, w + 20, 10, 3);
    g.fillStyle(0xfffaf3, 1);
    g.fillRoundedRect(x - 8, y + h + 3, w + 16, 6, 2);
    g.fillStyle(0xb57a46, 1);
    g.fillRoundedRect(x - 2, y + h + 10, w + 4, 12, 3);
    for (let k = 0; k < 6; k++) {
      const fx = x + 4 + k * ((w - 8) / 5);
      g.fillStyle(PAL.candy[k % PAL.candy.length], 1);
      g.fillCircle(fx, y + h + 9, 4);
      g.fillStyle(0xfff1a8, 1);
      g.fillCircle(fx, y + h + 9, 1.5);
    }
  }

  coverAt(x) {
    for (const c of this.chimneys) if (Math.abs(x - c.x) < c.half) return c;
    return null;
  }

  splat(x) {
    const s = this.splats.find((p) => p.t <= 0) ?? this.splats[0];
    s.t = SPLAT_LIFE;
    s.img.setPosition(x, this.roofY + 2).setScale(Phaser.Math.FloatBetween(0.8, 1.1), 0.45).setAlpha(1).setVisible(true);
  }

  update(dt) {
    for (const s of this.splats) {
      if (s.t <= 0) continue;
      s.t -= dt;
      s.img.setAlpha(Math.min(1, s.t / 1.2));
      if (s.t <= 0) s.img.setVisible(false);
    }
  }
}
