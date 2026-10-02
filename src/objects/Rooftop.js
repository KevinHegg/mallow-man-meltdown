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
  constructor(scene, { roofY }) {
    const { width: W, height: H } = scene.scale;
    this.scene = scene;
    this.roofY = roofY;
    this.top = roofY - 42;
    const key = `roof_${W}x${H}_${roofY}`;
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
    for (const wy of [fy + 46, fy + 150]) {
      if (wy + 70 > H) continue;
      for (let wx = 40; wx < W - 60; wx += 120) {
        g.fillStyle(PAL.ink, 1);
        g.fillRoundedRect(wx - 3, wy - 3, 66, 76, 30);
        g.fillStyle(0xfff1a8, 1);
        g.fillRoundedRect(wx, wy, 60, 70, 28);
        g.fillStyle(0xffffff, 0.75);
        g.fillRoundedRect(wx + 8, wy + 8, 14, 26, 7);
        g.fillStyle(PAL.ink, 0.25);
        g.fillRect(wx + 29, wy + 4, 3, 64);
        frost(g, beads(wx - 4, wy + 74, wx + 64, wy + 74, 4, 8), FROST_PINK, FROST_PINK_EDGE);
      }
    }
    g.fillStyle(PAL.ink, 0.12);
    g.fillRect(0, H - 70, W, 70);
    // the roof's front lip: frosting beads and drips spilling over the facade
    contactShadow(g, W / 2, fy + 6, W * 1.2, 16);
    frost(g, beads(-4, fy, W + 4, fy, 8, 14));
    for (let x = 30; x < W; x += 74) frostDrip(g, x, fy + 4, 12 + ((x / 74) % 3) * 8, 9);
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
