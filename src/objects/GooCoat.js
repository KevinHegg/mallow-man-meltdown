// What goo looks like on the glider. A fixed pool of slime sprites sits at anchor slots on the
// wings and fuselage; which slots show, and how big, follows the goo total and which side it
// is on — so DUSTED / SPLATTERED / CAKED read at a glance. Purely visual: Glider owns the goo
// numbers. The sprites live in the glider's goo layer, so they ride its bank and pitch.
import * as Phaser from 'phaser';
import { TUNE } from '../config.js';

// t: coverage (0..1) at which the slot appears. Bands: dusted drips, splattered blobs, caked coat.
// Each band's first slots sit just under its entry coverage (0.05 / 0.33 / 0.70) so a new
// tier shows its signature look immediately.
const SLOTS = [
  { t: 0.03, x: -28, y: 9, s: 0.85, key: 'drip' },
  { t: 0.08, x: 26, y: 10, s: 0.8, key: 'drip' },
  { t: 0.13, x: -42, y: 7, s: 0.7, key: 'drip' },
  { t: 0.18, x: 40, y: 8, s: 0.7, key: 'drip' },
  { t: 0.25, x: -32, y: 1, s: 0.55, key: 'splat' },
  { t: 0.27, x: 0, y: -10, s: 0.42, key: 'splat' },
  { t: 0.29, x: 30, y: 2, s: 0.55, key: 'splat' },
  { t: 0.45, x: -16, y: 3, s: 0.45, key: 'splat' },
  { t: 0.52, x: 15, y: 2, s: 0.45, key: 'splat' },
  { t: 0.58, x: 2, y: 14, s: 0.4, key: 'splat' },
  { t: 0.63, x: -30, y: 0, s: 0.95, key: 'gcoat' },
  { t: 0.645, x: 29, y: 1, s: 0.95, key: 'gcoat' },
  { t: 0.66, x: 0, y: 0, s: 0.8, key: 'splat' },
  { t: 0.8, x: -46, y: 5, s: 0.5, key: 'splat' },
  { t: 0.86, x: 45, y: 5, s: 0.5, key: 'splat' },
  { t: 0.9, x: 0, y: 21, s: 0.6, key: 'gcoat' },
  { t: 0.95, x: 1, y: -20, s: 0.45, key: 'splat' },
];
const RAMP = 0.06; // coverage over which a slot grows from nothing to full
const SIDE_BIAS = 0.16; // the heavier side fills this much coverage earlier

const lerp = Phaser.Math.Linear;

// Goo total → coat coverage, banded so each tier looks distinct.
export function coverageFor(goo) {
  const T = TUNE.tier;
  if (goo < T.dusted) return 0;
  if (goo < T.splattered) return lerp(0.05, 0.24, (goo - T.dusted) / (T.splattered - T.dusted));
  if (goo < T.caked) return lerp(0.33, 0.62, (goo - T.splattered) / (T.caked - T.splattered));
  return lerp(0.7, 1, Phaser.Math.Clamp((goo - T.caked) / (TUNE.gooCap - T.caked), 0, 1));
}

export class GooCoat {
  constructor(scene, layer, fx) {
    this.fx = fx;
    this.slots = SLOTS.map((def) => {
      const img = scene.add.image(def.x, def.y, def.key).setVisible(false).setAngle(def.key === 'drip' ? 0 : Phaser.Math.Between(-25, 25));
      layer.add(img);
      return { ...def, side: Math.abs(def.x) < 8 ? 0 : Math.sign(def.x), img, v: 0, pop: 0 };
    });
    this.flingT = 0; // while > 0, slots that vanish are flung off as particles
    this.shakeFrom = 0; // coverage snapshot when a shake starts
    this.shakeT = 0;
    this.shakeDur = 1;
    this.dripAcc = 0;
    this.m = new Phaser.GameObjects.Components.TransformMatrix();
    this.pm = new Phaser.GameObjects.Components.TransformMatrix();
    this.pos = { x: 0, y: 0 };
  }

  // Shed a portion (boost) or everything (victory): vanishing blobs fly off for `dur` seconds.
  fling(dur = 0.5) {
    this.flingT = dur;
  }

  // Shake: the coat comes off blob by blob over the first part of the wobble window.
  startShake(goo, wobble) {
    this.shakeFrom = coverageFor(goo);
    this.shakeDur = wobble * 0.6;
    this.shakeT = this.shakeDur;
    this.flingT = this.shakeDur + 0.1;
  }

  // A fresh hit: the blobs near it bulge for a moment.
  popNear(localX) {
    let hit = false;
    for (const s of this.slots) {
      if (s.v > 0.05 && Math.abs(s.x - localX) < 20) {
        s.pop = 0.35;
        hit = true;
      }
    }
    if (!hit) {
      let best = this.slots[0];
      for (const s of this.slots) if (Math.abs(s.x - localX) < Math.abs(best.x - localX)) best = s;
      best.pop = 0.35;
    }
  }

  worldPos(s) {
    s.img.getWorldTransformMatrix(this.m, this.pm);
    this.pos.x = this.m.tx;
    this.pos.y = this.m.ty;
    return this.pos;
  }

  // goo: total goo; bias: weighted mean side of the goo (-1 left … 1 right)
  update(dt, goo, bias) {
    this.flingT -= dt;
    let cover = coverageFor(goo);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      cover = Math.max(cover, this.shakeFrom * Math.max(0, this.shakeT / this.shakeDur));
    }
    const flinging = this.flingT > 0;
    for (const s of this.slots) {
      const t = s.t - SIDE_BIAS * s.side * bias;
      const target = Phaser.Math.Clamp((cover - t) / RAMP, 0, 1);
      if (target <= 0 && s.v > 0.15 && flinging) {
        // flung off: burst of blobs from where it sat
        const p = this.worldPos(s);
        this.fx.gob.explode(2, p.x, p.y);
        s.v = 0;
      } else {
        const before = s.v;
        s.v += (target - s.v) * Math.min(1, dt * 8);
        if (before >= 0.1 && s.v < 0.1 && !flinging) {
          const p = this.worldPos(s);
          this.fx.drip.emitParticleAt(p.x, p.y + 6); // dripped off
        }
      }
      s.pop = Math.max(0, s.pop - dt * 3);
      const on = s.v > 0.02;
      s.img.setVisible(on);
      if (on) s.img.setScale(s.s * (0.25 + 0.75 * s.v) * (1 + s.pop));
    }
  }

  // Time cleanse made visible: drops fall from the coat at the same rate goo drips off.
  drip(rate, dt) {
    this.dripAcc += rate * dt;
    while (this.dripAcc > 1) {
      this.dripAcc -= 1;
      let total = 0;
      for (const s of this.slots) total += s.v;
      if (total <= 0.05) {
        this.dripAcc = 0;
        return;
      }
      let r = Math.random() * total;
      for (const s of this.slots) {
        r -= s.v;
        if (r <= 0) {
          const p = this.worldPos(s);
          this.fx.drip.emitParticleAt(p.x, p.y + 6);
          break;
        }
      }
    }
  }
}
