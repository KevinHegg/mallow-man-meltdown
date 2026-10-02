// Wind streaks: short white speed lines streaming out of the vanishing point and past the
// camera. A fixed pool (capped count, no per-frame allocations); spawn rate and opacity scale
// with the glider's total speed. Decorative only.
import * as Phaser from 'phaser';
import { DEPTH } from '../config.js';

export class Wind {
  constructor(scene, proj, valley, cap = 26) {
    this.proj = proj;
    this.valley = valley;
    this.items = [];
    for (let i = 0; i < cap; i++) {
      this.items.push({ img: scene.add.image(0, 0, 'streak').setVisible(false).setDepth(DEPTH.glider - 1), x: 0, y: 0, z: 0, active: false });
    }
    const f = proj.focal;
    this.zStart = 2.4 * f;
    this.zEnd = 0.25 * f;
    this.spread = scene.scale.width * 0.8;
    this.acc = 0;
    this.alpha = 0;
    this.pt = {};
  }

  // intensity: 0 (calm) … 1 (boosting flat out)
  update(dt, speed, intensity) {
    this.alpha = 0.2 + 0.7 * intensity;
    this.acc += dt * (1 + 32 * Math.pow(intensity, 1.5)); // a few at cruise, a rush when boosting
    while (this.acc >= 1) {
      this.acc -= 1;
      this.spawn();
    }
    const p = this.proj;
    const t = this.pt;
    const vy = p.horizonY + p.tilt;
    for (const w of this.items) {
      if (!w.active) continue;
      w.z -= speed * dt;
      if (w.z < this.zEnd) {
        w.active = false;
        w.img.setVisible(false);
        continue;
      }
      p.project(w.x + this.valley.bend(w.z), w.y, w.z, t);
      const fade = Phaser.Math.Clamp((this.zStart - w.z) / (0.6 * p.focal), 0, 1);
      w.img
        .setPosition(t.x, t.y)
        .setRotation(Math.atan2(t.y - vy, t.x - p.cx))
        .setScale(Math.min(3.5, 0.6 + t.s * 2), Math.min(2, 0.7 + t.s * 0.7))
        .setAlpha(this.alpha * fade);
    }
  }

  spawn() {
    for (const w of this.items) {
      if (w.active) continue;
      const G = this.valley.groundY;
      w.x = Phaser.Math.FloatBetween(-this.spread, this.spread);
      w.y = Phaser.Math.FloatBetween(-0.6 * G, 0.95 * G);
      // keep the middle of the flight lane clear so streaks never sit on the glider
      if (Math.abs(w.x) < 160 && w.y > 0) w.x = Math.sign(w.x || 1) * Phaser.Math.FloatBetween(160, this.spread);
      w.z = this.zStart;
      w.active = true;
      w.img.setVisible(true).setAlpha(0);
      return;
    }
  }
}
