// The player's toy glider. Movement is a mass-aware spring toward a steering target:
// goo adds mass (sluggish, wallowy), sinks the target, and shifts the centre of gravity
// sideways (list → drift + skewed aim). A Matter sensor body follows it for collisions.
import * as Phaser from 'phaser';
import { CAT, DEPTH, MASK, TUNE } from '../config.js';
import { mix } from '../art/textures.js';
import { Sfx } from '../sfx.js';

const HALF_SPAN = 46;
const clamp = Phaser.Math.Clamp;

export function tierFor(goo) {
  if (goo >= TUNE.tier.caked) return 'caked';
  if (goo >= TUNE.tier.splattered) return 'splattered';
  if (goo >= TUNE.tier.dusted) return 'dusted';
  return 'clean';
}

const splatScale = (m) => 0.45 + 0.42 * Math.sqrt(m);

export class Glider extends Phaser.Events.EventEmitter {
  constructor(scene, x, y, bounds, charges, fx) {
    super();
    this.scene = scene;
    this.bounds = bounds;
    this.fx = fx;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.targetX = x;
    this.targetY = y;
    this.list = 0;
    this.roll = 0;
    this.t = 0;
    this.spin = 0;
    this.splats = [];
    this.boosts = charges.boosts;
    this.shakes = charges.shakes;
    this.fireCd = 0;
    this.stun = 0;
    this.bonkCd = 0;
    this.shakeT = 0;
    this.boostT = 0;
    this.stall = 0;
    this.dripAcc = 0;
    this.spiraling = false;
    this.crashed = false;
    this.autopilot = null;
    this.tier = 'clean';

    this.view = scene.add.container(x, y).setDepth(DEPTH.glider);
    this.sprite = scene.add.image(0, 0, 'glider');
    this.gooLayer = scene.add.container(0, 0);
    this.shield = scene.add.image(0, 0, 'bubble').setScale(4).setAlpha(0);
    this.view.add([this.sprite, this.gooLayer, this.shield]);

    this.body = scene.matter.add.rectangle(x, y, 92, 40, {
      isSensor: true,
      ignoreGravity: true,
      label: 'glider',
      collisionFilter: { category: CAT.glider, mask: MASK.glider },
    });
  }

  get goo() {
    return this.splats.reduce((sum, s) => sum + s.m, 0);
  }

  get busy() {
    return this.spiraling || this.crashed;
  }

  get canAct() {
    return !this.busy && !this.autopilot && this.shakeT <= 0;
  }

  steerBy(dx, dy) {
    if (!this.canAct) return;
    const b = this.bounds;
    this.targetX = clamp(this.targetX + dx, b.left, b.right);
    this.targetY = clamp(this.targetY + dy, b.top, b.bottom);
  }

  localToWorld(lx, ly) {
    const c = Math.cos(this.roll);
    const s = Math.sin(this.roll);
    return { x: this.x + lx * c - ly * s, y: this.y + lx * s + ly * c };
  }

  update(dt) {
    this.t += dt;
    this.fireCd -= dt;
    this.stun -= dt;
    this.bonkCd -= dt;
    this.boostT -= dt;
    if (this.crashed) return;
    if (this.spiraling) {
      this.updateSpiral(dt);
      return;
    }

    const b = this.bounds;
    const goo = this.goo;
    const mass = 1 + goo * TUNE.massPerGoo;
    const torque = this.splats.reduce((sum, s) => sum + s.m * s.ox, 0);
    const listTarget = clamp(torque * TUNE.rollPerTorque, -TUNE.maxRoll, TUNE.maxRoll);
    this.list += (listTarget - this.list) * Math.min(1, dt * 3);

    const shaking = this.shakeT > 0;
    if (shaking) this.shakeT -= dt;

    if (this.autopilot) {
      this.targetX = this.autopilot.x;
      this.targetY = this.autopilot.y;
    } else if (!shaking) {
      // goo weight drags the target down; off-centre goo drags it sideways
      this.targetY += goo * TUNE.sinkPerGoo * dt;
      this.targetX += Math.sin(this.list) * TUNE.listDrift * dt;
    }
    this.targetX = clamp(this.targetX, b.left, b.right);
    this.targetY = clamp(this.targetY, b.top, b.bottom);

    let ax;
    let ay;
    if (shaking || this.stun > 0) {
      ax = -this.vx * 3;
      ay = -this.vy * 3;
    } else {
      // Stiffness falls with mass while damping falls with √mass: the damping ratio stays
      // constant, so goo makes the glider genuinely slower to respond (not just bouncier).
      const c = TUNE.damping / Math.sqrt(mass);
      ax = (TUNE.springK * (this.targetX - this.x)) / mass - c * this.vx;
      ay = (TUNE.springK * (this.targetY - this.y)) / mass - c * this.vy;
    }
    this.vx += ax * dt;
    this.vy += ay * dt;
    const cap = TUNE.maxSpeed / Math.sqrt(mass);
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > cap && !this.autopilot && this.boostT <= 0 && this.stun <= 0) {
      this.vx *= cap / speed;
      this.vy *= cap / speed;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < b.left || this.x > b.right) {
      this.x = clamp(this.x, b.left, b.right);
      this.vx *= -0.3;
    }
    if (this.y < b.top || this.y > b.bottom) {
      this.y = clamp(this.y, b.top, b.bottom);
      this.vy *= -0.3;
    }

    // visuals: list + bank + wobble
    const bank = clamp(this.vx * 0.0011, -0.3, 0.3);
    let wobble = 0;
    if (this.tier === 'caked') wobble = Math.sin(this.t * 9) * 0.07;
    if (shaking) wobble = Math.sin(this.t * 46) * 0.38;
    this.roll = this.list + bank + wobble;
    const jitter = shaking ? Math.sin(this.t * 53) * 5 : 0;
    this.view.setPosition(this.x + jitter, this.y + Math.sin(this.t * 2.4) * 2.5);
    this.view.rotation = this.roll;
    this.sprite.setTint(mix(0xffffff, 0xa8dcff, clamp(goo / TUNE.gooCap, 0, 1)));

    this.updateGoo(dt, goo);
    this.syncBody();

    const tier = tierFor(this.goo);
    if (tier !== this.tier) {
      const prev = this.tier;
      this.tier = tier;
      this.emit('tier', tier, prev);
    }

    const doomed = tier === 'caked' && this.boosts === 0 && this.shakes === 0 && !shaking && !this.autopilot;
    if (doomed) {
      this.stall += dt;
      if (this.stall >= TUNE.stallTime) this.startSpiral();
    } else {
      this.stall = Math.max(0, this.stall - dt * 2);
    }
  }

  updateGoo(dt, goo) {
    // heavier coats harden and drip off more slowly
    const rate = TUNE.dripBase / (1 + goo * 0.22);
    for (const s of this.splats) {
      s.m -= rate * dt;
      s.pop = Math.max(0, s.pop - dt * 4);
      s.img.setScale(splatScale(Math.max(s.m, 0.05)) * (1 + s.pop));
    }
    const gone = this.splats.filter((s) => s.m < 0.08);
    if (gone.length) {
      this.splats = this.splats.filter((s) => s.m >= 0.08);
      for (const s of gone) {
        this.scene.tweens.add({ targets: s.img, alpha: 0, duration: 250, onComplete: () => s.img.destroy() });
      }
    }
    this.dripAcc += goo * dt * 1.4;
    while (this.dripAcc > 1) {
      this.dripAcc -= 1;
      if (!this.splats.length) break;
      const s = Phaser.Utils.Array.GetRandom(this.splats);
      const p = this.localToWorld(s.ox * HALF_SPAN, s.oy + 8);
      this.fx.drip.emitParticleAt(p.x, p.y);
    }
  }

  syncBody() {
    const MB = this.scene.matter.body;
    MB.setPosition(this.body, { x: this.x, y: this.y });
    MB.setAngle(this.body, this.roll);
  }

  // Returns 'splat' | 'shielded' | 'ignored'.
  applyGoo(worldX, amount) {
    if (this.busy || this.autopilot) return 'ignored';
    if (this.boostT > 0) {
      this.fx.bubble.explode(6, worldX, this.y);
      return 'shielded';
    }
    if (this.shakeT > 0) amount *= 1.5; // vulnerable while wobbling
    amount = Math.min(amount, Math.max(0.05, TUNE.gooCap - this.goo));
    const rel = clamp((worldX - this.x) / HALF_SPAN, -1, 1);
    const ox = clamp(rel * 0.85 + Phaser.Math.FloatBetween(-0.2, 0.2), -1, 1);
    let s = this.splats.find((p) => Math.abs(p.ox - ox) < 0.22);
    if (s) {
      s.m += amount;
    } else {
      const img = this.scene.add.image(ox * HALF_SPAN, Phaser.Math.Between(-4, 8), 'splat');
      img.setAngle(Phaser.Math.Between(-30, 30));
      this.gooLayer.add(img);
      s = { m: amount, ox, oy: img.y, img, pop: 0 };
      this.splats.push(s);
    }
    s.pop = 0.4;
    this.vx += (rel >= 0 ? 1 : -1) * 60;
    this.vy += 90;
    Sfx.splat();
    return 'splat';
  }

  tryFire() {
    if (!this.canAct || this.fireCd > 0) return null;
    const slow = this.tier === 'caked' ? 1.7 : this.tier === 'splattered' ? 1.25 : 1;
    this.fireCd = TUNE.fireCooldown * slow;
    const nose = this.localToWorld(0, -30);
    return { x: nose.x, y: nose.y, angle: this.roll - Math.PI / 2 };
  }

  boost() {
    if (!this.canAct) return false;
    if (this.boosts <= 0) {
      Sfx.deny();
      return false;
    }
    this.boosts--;
    this.boostT = 0.8;
    for (const s of this.splats) {
      this.flingGob(s, 0.6);
      s.m *= TUNE.boostKeep;
    }
    this.vy = Math.min(this.vy, 0) - 620;
    this.targetY = clamp(this.targetY - 200, this.bounds.top, this.bounds.bottom);
    this.fx.bubble.explode(18, this.x, this.y + 20);
    this.scene.tweens.killTweensOf(this.shield);
    this.shield.setAlpha(0.85).setScale(3.2);
    this.scene.tweens.add({ targets: this.shield, alpha: 0, scale: 4.4, duration: 800, ease: 'Quad.easeIn' });
    Sfx.boost();
    this.emit('boost');
    return true;
  }

  shake() {
    if (!this.canAct) return false;
    if (this.shakes <= 0) {
      Sfx.deny();
      return false;
    }
    this.shakes--;
    this.shakeT = TUNE.shakeTime;
    for (const s of this.splats) {
      this.flingGob(s, 1);
      s.img.destroy();
    }
    this.splats = [];
    Sfx.shake();
    this.emit('shake');
    return true;
  }

  flingGob(s, frac) {
    const p = this.localToWorld(s.ox * HALF_SPAN, s.oy);
    const gob = this.scene.add
      .image(p.x, p.y, 'splat')
      .setScale(splatScale(s.m) * frac)
      .setDepth(DEPTH.glider - 1);
    const dir = s.ox >= 0 ? 1 : -1;
    this.scene.tweens.add({
      targets: gob,
      x: p.x + dir * Phaser.Math.Between(80, 160),
      y: p.y + Phaser.Math.Between(60, 180),
      angle: dir * 200,
      alpha: 0,
      scale: gob.scale * 0.5,
      duration: 650,
      ease: 'Quad.easeIn',
      onComplete: () => gob.destroy(),
    });
  }

  // Knocked back by an obstacle or the boss. Returns false while on cooldown.
  bonk(fromX) {
    if (this.busy || this.bonkCd > 0) return false;
    this.bonkCd = 0.6;
    this.stun = 0.28;
    const dir = this.x >= fromX ? 1 : -1;
    const b = this.bounds;
    this.vx = dir * 380;
    this.vy = 280;
    this.targetX = clamp(this.x + dir * 80, b.left, b.right);
    this.targetY = clamp(this.y + 90, b.top, b.bottom);
    this.scene.cameras.main.shake(140, 0.006);
    Sfx.bonk();
    return true;
  }

  addCharge(kind) {
    if (kind === 'boost') this.boosts = Math.min(TUNE.boostMax, this.boosts + 1);
    else this.shakes = Math.min(TUNE.shakeMax, this.shakes + 1);
  }

  startSpiral() {
    this.spiraling = true;
    this.spin = 2;
    this.vy = Math.min(this.vy, 0);
    Sfx.spiral();
    this.emit('spiral');
  }

  updateSpiral(dt) {
    this.spin += dt * 9;
    this.roll += this.spin * dt;
    this.vy += 520 * dt;
    this.vx = Math.sin(this.t * 5) * 140;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.view.setPosition(this.x, this.y);
    this.view.rotation = this.roll;
    this.view.setScale(Math.max(0.6, this.view.scale - dt * 0.2));
    if (Math.random() < dt * 20) this.fx.drip.emitParticleAt(this.x, this.y);
    this.syncBody();
    if (this.y > this.bounds.bottom + 110) {
      this.crashed = true;
      this.view.setVisible(false);
      this.fx.puff.explode(16, this.x, this.y);
      this.fx.drip.explode(12, this.x, this.y);
      Sfx.crash();
      this.emit('crashed');
    }
  }

  // Gently sheds all goo (used for victory / scene transitions).
  cleanAll() {
    for (const s of this.splats) {
      this.flingGob(s, 0.8);
      s.img.destroy();
    }
    this.splats = [];
    this.stall = 0;
  }
}
