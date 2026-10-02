import * as Phaser from 'phaser';
import { CAT, DEPTH, MASK, TUNE } from '../config.js';
import { retire } from '../ui/helpers.js';
import { Sfx } from '../sfx.js';

// Jelly beans: short-range sensor projectiles. They melt goo-mallows and the boss.
export class Beans {
  constructor(scene) {
    this.scene = scene;
    this.items = new Set();
  }

  fire(shot) {
    const b = this.scene.matter.add.image(shot.x, shot.y, `bean${Phaser.Math.Between(0, 5)}`, null, {
      shape: { type: 'circle', radius: 11 },
      isSensor: true,
      ignoreGravity: true,
      frictionAir: 0,
      label: 'bean',
      collisionFilter: { category: CAT.bean, mask: MASK.bean },
    });
    b.setDepth(DEPTH.beans).setRotation(shot.angle);
    const v = TUNE.beanSpeed / 60; // Matter velocity is px per 1/60 s
    b.setVelocity(Math.cos(shot.angle) * v, Math.sin(shot.angle) * v);
    b.life = shot.life ?? TUNE.beanLife;
    b.alive = true;
    this.items.add(b);
    Sfx.fire();
    return b;
  }

  update(dt) {
    for (const b of this.items) {
      b.life -= dt;
      if (b.life < 0.15) b.setAlpha(Math.max(0, b.life / 0.15));
      if (b.life <= 0 || b.y < -40) this.kill(b);
    }
  }

  kill(b) {
    this.items.delete(b);
    retire(this.scene, b);
  }
}

// How much goo one goo-mallow hit puts on the glider (sticky frosting banks reuse it).
export const gooAmount = () => Phaser.Math.FloatBetween(0.95, 1.25);

// Goo-filled marshmallows: gravity-affected sensors. Ones that reach the city frost it.
export class GooMallows {
  constructor(scene, { cityTop, onCity, onLand }) {
    this.scene = scene;
    this.cityTop = cityTop;
    this.onCity = onCity;
    this.onLand = onLand;
    this.items = new Set();
  }

  // landY: where this one lands instead of the city (e.g. a rooftop); it then calls onLand.
  spawn(x, y, vx, vy, landY) {
    const m = this.scene.matter.add.image(x, y, 'goomallow', null, {
      shape: { type: 'circle', radius: 19 },
      isSensor: true,
      frictionAir: 0,
      label: 'goo',
      collisionFilter: { category: CAT.goo, mask: MASK.goo },
    });
    m.setDepth(DEPTH.goo);
    m.setVelocity(vx / 60, vy / 60);
    m.setAngularVelocity(Phaser.Math.FloatBetween(-0.06, 0.06));
    m.alive = true;
    m.gooAmt = gooAmount();
    m.landY = landY;
    this.items.add(m);
    return m;
  }

  update() {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    for (const m of this.items) {
      if (m.landY !== undefined && m.y > m.landY) {
        this.onLand?.(m);
        this.kill(m);
      } else if (m.landY === undefined && m.y > this.cityTop) {
        this.onCity(m);
        this.kill(m);
      } else if (m.x < -80 || m.x > W + 80 || m.y > H + 80) {
        this.kill(m);
      }
    }
  }

  kill(m) {
    this.items.delete(m);
    retire(this.scene, m);
  }

  popAll(fx) {
    for (const m of [...this.items]) {
      fx.puff.explode(4, m.x, m.y);
      this.kill(m);
    }
  }
}
