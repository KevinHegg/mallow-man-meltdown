// The candy city below. Goo that reaches it frosts buildings; fully frozen buildings
// slowly spread frost to their neighbours. Average frost is the lose meter.
import * as Phaser from 'phaser';
import { DEPTH, PAL, TUNE } from '../config.js';
import { beads, contactShadow, frost, frostDrip, mix } from '../art/textures.js';

const KINDS = ['cube', 'gumdrop', 'cake', 'cane', 'lolli', 'cube', 'gumdrop'];

export class City {
  constructor(scene, { height, frost }) {
    this.scene = scene;
    const { width: W, height: H } = scene.scale;
    this.W = W;
    this.H = H;
    this.height = height;
    this.top = H - height;
    this.groundH = Math.round(height * 0.16);
    this.groundY = H - this.groundH;
    this.frost = frost.slice();
    this.dirty = false;
    this.redrawT = 0;

    const n = this.frost.length;
    const margin = 8;
    const gap = 8;
    const bw = (W - margin * 2 - gap * (n - 1)) / n;
    const rng = new Phaser.Math.RandomDataGenerator(['candy-city-7']);
    const usable = height - this.groundH;
    this.buildings = this.frost.map((_, i) => ({
      i,
      kind: KINDS[i % KINDS.length],
      x: margin + i * (bw + gap),
      w: bw,
      h: usable * rng.realInRange(0.42, 0.68),
      capH: usable * 0.24,
      color: PAL.candy[(i * 2 + 1) % PAL.candy.length],
    }));

    // The static skyline (buildings, frosting trim, shadows, ground) is baked into one texture:
    // a Graphics object would replay every bead and window each frame.
    const key = `city_${W}x${height}`;
    const g = scene.add.graphics();
    g.translateCanvas(0, -this.top);
    this.drawBase(g); // also records each building's top for the frost overlay
    if (!scene.textures.exists(key)) g.generateTexture(key, W, height);
    g.destroy();
    this.base = scene.add.image(0, this.top, key).setOrigin(0, 0).setDepth(DEPTH.city);
    this.ice = scene.add.graphics().setDepth(DEPTH.city + 1);
    this.drawIce();
  }

  get total() {
    return this.frost.reduce((s, f) => s + Math.min(1, f), 0) / this.frost.length;
  }

  centers() {
    return this.buildings.map((b) => ({ x: b.x + b.w / 2, y: this.top + 24 }));
  }

  drawBase(g) {
    const { W, H, groundY } = this;
    g.fillStyle(0xffffff, 0.22);
    g.fillRect(0, this.top, W, this.height);
    g.fillStyle(0xffb3d1, 1);
    g.fillRect(0, groundY, W, this.groundH);
    g.fillStyle(0xffffff, 0.8);
    for (let x = -20; x < W + 20; x += 28) {
      g.fillPoints([{ x, y: groundY }, { x: x + 12, y: groundY }, { x: x + 4, y: H }, { x: x - 8, y: H }], true);
    }
    g.fillStyle(PAL.ink, 0.2);
    g.fillRect(0, groundY, W, 3);
    for (const b of this.buildings) contactShadow(g, b.x + b.w / 2, groundY + 2, b.w * 1.25, 12);
    for (const b of this.buildings) this.drawBuilding(g, b);
  }

  drawBuilding(g, b) {
    const base = this.groundY;
    const { x, w, color } = b;
    const light = mix(color, 0xffffff, 0.55);
    const dark = mix(color, 0x000000, 0.25);
    let top = base - b.h;
    const windows = (x0, w0, y0, y1) => {
      const ws = Math.max(5, w0 * 0.2);
      for (let wy = y0 + ws; wy < y1 - ws; wy += ws * 2) {
        for (const wx of [x0 + w0 * 0.2, x0 + w0 * 0.8 - ws]) {
          g.fillStyle(0xfff1a8, 1);
          g.fillRoundedRect(wx, wy, ws, ws, 2);
          g.fillStyle(0xffffff, 0.8);
          g.fillRect(wx + 1.5, wy + 1.5, ws * 0.3, ws * 0.3);
          frost(g, beads(wx - 0.5, wy + ws + 1, wx + ws + 0.5, wy + ws + 1, Math.max(1.1, ws * 0.12), ws * 0.4));
        }
      }
    };
    const shadeFacade = (x0, w0, y0, y1) => {
      g.fillStyle(dark, 0.12);
      g.fillRect(x0, y1 - (y1 - y0) * 0.3, w0, (y1 - y0) * 0.3);
      g.fillStyle(dark, 0.1);
      g.fillRect(x0 + w0 * 0.82, y0, w0 * 0.18, y1 - y0);
    };

    switch (b.kind) {
      case 'cube': {
        const cs = w / 2;
        const rows = Math.max(2, Math.round(b.h / cs));
        top = base - rows * cs;
        g.fillStyle(PAL.sugarLine, 1);
        g.fillRect(x, top, w, rows * cs);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < 2; c++) {
            g.fillStyle(PAL.sugar, 1);
            g.fillRoundedRect(x + c * cs + 1.5, top + r * cs + 1.5, cs - 3, cs - 3, 4);
          }
        }
        shadeFacade(x, w, top, base);
        for (let r = 1; r < rows; r++) frost(g, beads(x + 2, top + r * cs, x + w - 2, top + r * cs, cs * 0.08, cs * 0.28));
        frost(g, beads(x + w / 2, top + 3, x + w / 2, base - 3, cs * 0.07, cs * 0.3));
        frost(g, [[x + w / 2 - cs * 0.24, top + 1, cs * 0.11], [x + w / 2 + cs * 0.24, top + 1, cs * 0.11], [x + w / 2, top - 1, cs * 0.16]]);
        g.fillStyle(0xe8213d, 1);
        g.fillCircle(x + w / 2, top - b.capH * 0.32, b.capH * 0.3);
        g.fillStyle(0xffffff, 0.75);
        g.fillCircle(x + w / 2 - b.capH * 0.1, top - b.capH * 0.42, b.capH * 0.08);
        g.lineStyle(2, 0x3f8f3a, 1);
        g.lineBetween(x + w / 2, top - b.capH * 0.6, x + w / 2 + 6, top - b.capH * 0.9);
        break;
      }
      case 'gumdrop': {
        g.fillStyle(color, 1);
        g.fillEllipse(x + w / 2, top, w * 1.04, b.capH * 1.9);
        g.fillStyle(0xffffff, 0.85);
        g.fillCircle(x + w * 0.35, top - b.capH * 0.45, 2);
        g.fillCircle(x + w * 0.62, top - b.capH * 0.6, 1.6);
        g.fillStyle(light, 1);
        g.fillRect(x, top, w, b.h);
        shadeFacade(x, w, top, base);
        windows(x, w, top, base);
        frostDrip(g, x + w * 0.28, top + 1, Math.max(4, w * 0.12), Math.max(4, w * 0.08));
        frost(g, beads(x + 1, top, x + w - 1, top, Math.max(2, w * 0.055), w * 0.11));
        break;
      }
      case 'cake': {
        const tiers = 3;
        const th = b.h / tiers;
        for (let k = 0; k < tiers; k++) {
          const inset = k * w * 0.1;
          const ty = base - (k + 1) * th;
          g.fillStyle(k % 2 ? 0xffe9c7 : light, 1);
          g.fillRect(x + inset, ty, w - inset * 2, th);
          g.fillStyle(dark, 0.1);
          g.fillRect(x + inset, ty + th * 0.6, w - inset * 2, th * 0.4);
          if (k === 1) frostDrip(g, x + inset + (w - inset * 2) * 0.7, ty + 2, th * 0.35, Math.max(4, w * 0.07));
          frost(g, beads(x + inset + 2, ty + 2, x + w - inset - 2, ty + 2, Math.max(2, w * 0.05), w * 0.1));
        }
        top = base - b.h;
        g.fillStyle(0xfff1a8, 1);
        g.fillRect(x + w / 2 - 2, top - b.capH * 0.6, 4, b.capH * 0.6);
        g.fillStyle(0xffa63d, 1);
        g.fillEllipse(x + w / 2, top - b.capH * 0.7, 7, 11);
        break;
      }
      case 'cane': {
        const cw = w * 0.62;
        const cx = x + (w - cw) / 2;
        g.fillStyle(0xffffff, 1);
        g.fillRect(cx, top, cw, b.h);
        g.fillStyle(0xe8213d, 1);
        for (let y = top - 10; y < base; y += 14) {
          const y0 = Math.max(top, y);
          const y1 = Math.min(base, y + 7);
          if (y1 > y0) g.fillRect(cx, y0, cw, y1 - y0);
        }
        g.fillStyle(dark, 0.1);
        g.fillRect(cx + cw * 0.75, top, cw * 0.25, b.h);
        g.lineStyle(cw * 0.5, 0xe8213d, 1);
        g.beginPath();
        g.arc(cx + cw * 0.75 + cw * 0.25, top, cw * 0.5, Math.PI, Math.PI * 1.9);
        g.strokePath();
        frostDrip(g, cx + cw * 0.3, top + 3, Math.max(4, cw * 0.18), Math.max(4, cw * 0.12));
        frost(g, beads(cx - 1, top + 3, cx + cw + 1, top + 3, Math.max(2, cw * 0.09), cw * 0.2));
        break;
      }
      case 'lolli': {
        g.fillStyle(0xffffff, 1);
        g.fillRect(x + w / 2 - 2, top - b.capH * 0.5, 4, b.capH * 0.5);
        g.fillStyle(color, 1);
        g.fillCircle(x + w / 2, top - b.capH * 0.6, b.capH * 0.42);
        g.lineStyle(3, 0xffffff, 1);
        g.beginPath();
        g.arc(x + w / 2, top - b.capH * 0.6, b.capH * 0.24, 0, Math.PI * 1.5);
        g.strokePath();
        g.fillStyle(0xffffff, 0.7);
        g.fillCircle(x + w / 2 - b.capH * 0.16, top - b.capH * 0.74, b.capH * 0.08);
        g.fillStyle(light, 1);
        g.fillRect(x, top, w, b.h);
        shadeFacade(x, w, top, base);
        windows(x, w, top, base);
        frostDrip(g, x + w * 0.72, top + 1, Math.max(4, w * 0.1), Math.max(4, w * 0.08));
        frost(g, beads(x + 1, top, x + w - 1, top, Math.max(2, w * 0.055), w * 0.11));
        break;
      }
      default:
        break;
    }
    g.lineStyle(2, dark, 0.5);
    g.strokeRect(x, top, w, base - top);
    b.topY = top;
    b.fullTop = top - b.capH;
  }

  drawIce() {
    const g = this.ice;
    g.clear();
    for (const b of this.buildings) {
      const f = Math.min(1, this.frost[b.i]);
      if (f <= 0.001) continue;
      const fullH = this.groundY - b.fullTop + 4;
      const fh = fullH * f;
      const y0 = this.groundY - fh;
      const x = b.x - 3;
      const w = b.w + 6;
      g.fillStyle(PAL.frost, 0.82);
      g.fillRect(x, y0, w, fh);
      const spikes = 4;
      const sw = w / spikes;
      for (let k = 0; k < spikes; k++) {
        g.fillTriangle(x + k * sw, y0, x + (k + 0.5) * sw, y0 - 7 - (k % 2) * 5, x + (k + 1) * sw, y0);
      }
      g.lineStyle(2, 0xffffff, 0.9);
      g.lineBetween(x + 5, y0 + 6, x + 5, this.groundY - 4);
      g.lineStyle(1.5, PAL.frostLine, 1);
      g.strokeRect(x, y0, w, fh);
      if (this.frost[b.i] >= 1) {
        g.fillStyle(0xffffff, 1);
        g.fillRect(x - 2, y0 - 4, w + 4, 5);
        for (let k = 0; k < 4; k++) g.fillTriangle(x + 4 + k * 9, y0, x + 9 + k * 9, y0, x + 6.5 + k * 9, y0 + 9);
      }
    }
  }

  addFrost(x, amount) {
    let best = 0;
    let bestD = Infinity;
    this.buildings.forEach((b, i) => {
      const d = Math.abs(b.x + b.w / 2 - x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    this.bump(best, amount);
    this.bump(best - 1, amount * 0.15);
    this.bump(best + 1, amount * 0.15);
    return this.buildings[best];
  }

  bump(i, amount) {
    if (i < 0 || i >= this.frost.length) return;
    this.frost[i] = Math.min(1.25, this.frost[i] + amount);
    this.dirty = true;
  }

  update(dt) {
    if (!this.thawing) {
      const n = this.frost.length;
      for (let i = 0; i < n; i++) {
        if (this.frost[i] < 1) continue;
        for (const j of [i - 1, i + 1]) {
          if (j >= 0 && j < n && this.frost[j] < 1.25) this.bump(j, TUNE.frostSpread * dt);
        }
      }
    }
    this.redrawT -= dt;
    if (this.dirty && this.redrawT <= 0) {
      this.drawIce();
      this.dirty = false;
      this.redrawT = 0.08;
    }
  }

  freezeAll() {
    this.frost = this.frost.map(() => 1.25);
    this.drawIce();
  }

  thaw(duration) {
    this.thawing = true;
    const from = this.frost.slice();
    this.scene.tweens.addCounter({
      from: 1,
      to: 0,
      duration,
      onUpdate: (tw) => {
        const k = tw.getValue();
        this.frost = from.map((f) => f * k);
        this.drawIce();
      },
    });
  }
}
