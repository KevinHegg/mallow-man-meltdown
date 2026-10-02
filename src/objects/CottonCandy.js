// Cotton-candy sticky traps: the boss's new attack, late in the flight and on the rooftop. A pink
// blast arcs out (its landing spot is marked with a pulsing ring) and bursts into a sticky zone
// that lasts ~8 s: in the flight a hanging spun-sugar cloud on the flight plane, on the roof a
// patch of spun sugar. Whoever is inside is held — a spatial slow, distinct from goo: no tiers, no
// mass, nothing to clean off. Step out (or boost out, in the glider) and you're free. Pooled.
import * as Phaser from 'phaser';
import { DEPTH } from '../config.js';
import { Sfx } from '../sfx.js';

const clamp = Phaser.Math.Clamp;
const LIFE = 8; // s a trap lasts…
const FADE = 1.2; // …fading out over the last stretch
const AIR = { rx: 92, ry: 66 }; // the hanging cloud's sticky ellipse
const ROOF_HALF = 76; // the roof patch's sticky half-width

export class CottonCandy {
  // mode 'air': zones are ellipses on the flight plane; 'roof': x-ranges on the roof at roofY.
  constructor(scene, { mode, roofY = 0, fx, max = 2 }) {
    this.scene = scene;
    this.mode = mode;
    this.roofY = roofY;
    this.fx = fx;
    this.traps = [];
    this.blasts = [];
    const air = mode === 'air';
    for (let i = 0; i < max; i++) {
      const img = scene.add
        .image(0, 0, air ? 'cotton' : 'cc_patch')
        .setVisible(false)
        .setDepth(air ? DEPTH.goo - 0.5 : DEPTH.city + 3.5);
      this.traps.push({ img, x: 0, y: 0, t: 0, active: false });
      const blast = scene.add.image(0, 0, 'cc_blast').setVisible(false).setDepth(DEPTH.goo);
      const ring = scene.add
        .image(0, 0, 'cc_ring')
        .setVisible(false)
        .setDepth(air ? DEPTH.goo - 0.6 : DEPTH.city + 3.6);
      this.blasts.push({ img: blast, ring, active: false, t: 0, T: 1, x0: 0, y0: 0, x1: 0, y1: 0, arc: 0 });
    }
    this.stats = { fired: 0, burst: 0, catches: 0, heldTime: 0 };
    this.wasHeld = false;
  }

  get busy() {
    let n = 0;
    for (const t of this.traps) if (t.active) n++;
    for (const b of this.blasts) if (b.active) n++;
    return n;
  }

  // Lob a blast from (x0, y0) that bursts into a trap at (x1, y1) after T seconds.
  fire(x0, y0, x1, y1, T = 1.2) {
    const b = this.blasts.find((q) => !q.active);
    if (!b || this.busy >= this.traps.length) return false;
    Object.assign(b, { active: true, t: 0, T, x0, y0, x1, y1, arc: this.mode === 'air' ? 120 : 160 });
    b.img.setVisible(true).setPosition(x0, y0).setScale(0.4);
    b.ring.setVisible(true).setPosition(x1, y1).setScale(this.mode === 'air' ? 1.6 : 1.3, this.mode === 'air' ? 2.6 : 0.8).setAlpha(0);
    this.stats.fired++;
    Sfx.ccFire();
    return true;
  }

  burst(x, y) {
    const t = this.traps.find((q) => !q.active);
    if (!t) return;
    Object.assign(t, { active: true, x, y, t: LIFE });
    t.img.setVisible(true).setPosition(x, y).setScale(0.3).setAlpha(1);
    this.fx.puff.explode(8, x, y);
    this.stats.burst++;
    Sfx.ccBurst();
  }

  contains(t, x, y) {
    if (this.mode === 'air') {
      const dx = (x - t.x) / AIR.rx;
      const dy = (y - t.y) / AIR.ry;
      return dx * dx + dy * dy < 1;
    }
    return Math.abs(x - t.x) < ROOF_HALF;
  }

  clear() {
    for (const t of this.traps) {
      t.active = false;
      t.img.setVisible(false);
    }
    for (const b of this.blasts) {
      b.active = false;
      b.img.setVisible(false);
      b.ring.setVisible(false);
    }
  }

  // Returns true while (x, y) is held by a trap.
  update(dt, x, y) {
    const now = this.scene.time.now;
    for (const b of this.blasts) {
      if (!b.active) continue;
      b.t += dt;
      const u = Math.min(1, b.t / b.T);
      const px = Phaser.Math.Linear(b.x0, b.x1, u);
      const py = Phaser.Math.Linear(b.y0, b.y1, u) - b.arc * 4 * u * (1 - u);
      b.img.setPosition(px, py).setScale(0.4 + u * 0.8).setRotation(b.t * 5);
      b.ring.setAlpha(0.35 + 0.45 * Math.abs(Math.sin(now / 110)) * Math.min(1, u * 3));
      if (u >= 1) {
        b.active = false;
        b.img.setVisible(false);
        b.ring.setVisible(false);
        this.burst(b.x1, b.y1);
      }
    }
    let held = false;
    for (const t of this.traps) {
      if (!t.active) continue;
      t.t -= dt;
      if (t.t <= 0) {
        t.active = false;
        t.img.setVisible(false);
        continue;
      }
      const age = LIFE - t.t;
      const grow = clamp(age / 0.25, 0, 1);
      const wob = 1 + Math.sin(now / 180 + t.x) * 0.03;
      t.img.setScale((0.3 + 0.7 * grow) * wob, (0.3 + 0.7 * grow) / wob).setAlpha(clamp(t.t / FADE, 0, 1));
      if (this.contains(t, x, y)) held = true;
    }
    if (held) {
      this.stats.heldTime += dt;
      if (!this.wasHeld) this.stats.catches++;
    }
    this.wasHeld = held;
    return held;
  }
}
