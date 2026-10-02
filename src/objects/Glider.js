// The player's toy glider. Movement is a mass-aware spring toward a steering target:
// goo adds mass (sluggish, wallowy), sinks the target, and shifts the centre of gravity
// sideways (list → drift + skewed aim). A Matter sensor body follows it for collisions.
import * as Phaser from 'phaser';
import { CAT, DEPTH, MASK, TUNE } from '../config.js';
import { mix } from '../art/textures.js';
import { Sfx } from '../sfx.js';
import { GooCoat } from './GooCoat.js';

const HALF_SPAN = 46;
// Art is drawn a third bigger so bank, coat, list and wobble read on a phone. The Matter
// hitbox and aim (HALF_SPAN, localToWorld) stay at the original size: art scale only.
const ART_SCALE = 4 / 3;
const clamp = Phaser.Math.Clamp;

export function tierFor(goo) {
  if (goo >= TUNE.tier.caked) return 'caked';
  if (goo >= TUNE.tier.splattered) return 'splattered';
  if (goo >= TUNE.tier.dusted) return 'dusted';
  return 'clean';
}

// Art-only list and wobble per tier (clean, dusted, splattered, caked) so the handling
// penalty reads on screen. Hitbox, aim and drift keep using the physical `list`/`roll`.
const TIER_LEVEL = { clean: 0, dusted: 1, splattered: 2, caked: 3 };
const ART_LIST = [0, 0.05, 0.12, 0.2];
const ART_WOBBLE = [0, 0.025, 0.05, 0.06];

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
    this.bank = 0;
    this.artList = 0;
    this.artWobble = 0;
    this.artOffset = 0;
    this.attBank = null; // flight-view bank/pitch (FlightScene); null elsewhere
    this.attPitch = 0;
    this.lastHitSide = 1;
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
    this.spiraling = false;
    this.crashed = false;
    this.autopilot = null;
    this.thermal = false; // inside a candy-cane thermal (set by the flight each frame)
    this.stuck = false; // held by a cotton-candy trap (set by the flight each frame)
    this.tier = 'clean';

    this.view = scene.add.container(x, y).setDepth(DEPTH.glider).setScale(ART_SCALE);
    this.sprite = scene.add.image(0, 0, 'glider');
    this.gooLayer = scene.add.container(0, 0);
    this.shield = scene.add.image(0, 0, 'bubble').setScale(4).setAlpha(0);
    this.strands = scene.add.image(0, 0, 'cc_strands').setScale(0.8).setVisible(false);
    this.view.add([this.sprite, this.gooLayer, this.strands, this.shield]);
    this.coat = new GooCoat(scene, this.gooLayer, fx);

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
    const held = this.stuck && this.boostT <= 0; // a boost tears free of a trap
    this.strands.setVisible(this.stuck).setAlpha(0.6 + Math.sin(this.t * 9) * 0.25);

    if (this.autopilot) {
      this.targetX = this.autopilot.x;
      this.targetY = this.autopilot.y;
    } else if (!shaking) {
      // goo weight drags the target down; off-centre goo drags it sideways; thermals lift it
      this.targetY += goo * TUNE.sinkPerGoo * dt;
      this.targetX += Math.sin(this.list) * TUNE.listDrift * dt;
      if (this.thermal) this.targetY -= TUNE.thermalLift * dt;
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
      // A cotton-candy trap weakens the pull toward your steering.
      const c = TUNE.damping / Math.sqrt(mass);
      const k = TUNE.springK * (held ? TUNE.trapSpring : 1);
      ax = (k * (this.targetX - this.x)) / mass - c * this.vx;
      ay = (k * (this.targetY - this.y)) / mass - c * this.vy;
    }
    this.vx += ax * dt;
    this.vy += ay * dt;
    const cap = (TUNE.maxSpeed / Math.sqrt(mass)) * (held ? TUNE.trapHold : 1);
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
    this.bank = bank;
    this.roll = this.list + bank + wobble;
    const jitter = shaking ? Math.sin(this.t * 53) * 5 : 0;
    this.view.setPosition(this.x + jitter, this.y + Math.sin(this.t * 2.4) * 2.5);
    this.view.rotation = this.roll;
    this.sprite.setTint(mix(0xffffff, 0xc6f2b0, clamp(goo / TUNE.gooCap, 0, 1)));

    this.updateGoo(dt, goo);
    this.syncBody();

    const tier = tierFor(this.goo);
    if (tier !== this.tier) {
      const prev = this.tier;
      this.tier = tier;
      this.emit('tier', tier, prev);
    }

    // goo you can see: the coat, plus an art-only list toward the gooey side and a wobble
    const lvl = shaking ? 0 : TIER_LEVEL[tier];
    const side = Math.abs(torque) > 0.05 ? Math.sign(torque) : this.lastHitSide;
    this.artList += (side * ART_LIST[lvl] - this.artList) * Math.min(1, dt * 3);
    this.artWobble += (ART_WOBBLE[lvl] - this.artWobble) * Math.min(1, dt * 2);
    this.artOffset = this.artList + Math.sin(this.t * (6 + lvl)) * this.artWobble;
    const g = this.goo;
    this.coat.update(dt, g, g > 0.01 ? clamp(torque / g, -1, 1) : 0);
    this.applyArt();

    const doomed = tier === 'caked' && this.boosts === 0 && this.shakes === 0 && !shaking && !this.autopilot;
    if (doomed) {
      this.stall += dt;
      if (this.stall >= TUNE.stallTime) this.startSpiral();
    } else {
      this.stall = Math.max(0, this.stall - dt * 2);
    }
  }

  updateGoo(dt, goo) {
    // heavier coats harden and drip off more slowly; a thermal's warm air speeds it up
    const warm = this.thermal ? TUNE.thermalDrip : 1;
    const rate = (warm * TUNE.dripBase) / (1 + goo * 0.22);
    const splats = this.splats;
    for (let i = splats.length - 1; i >= 0; i--) {
      splats[i].m -= rate * dt;
      if (splats[i].m < 0.08) splats.splice(i, 1); // in place: no per-frame arrays
    }
    this.coat.drip(goo * 1.4 * warm, dt); // drops fall from the coat as it drips off
  }

  // Art transform on top of the physical roll: flight bank/pitch, goo list and wobble,
  // and a squash-and-stretch shudder while shaking.
  applyArt() {
    const bankOff = this.attBank === null ? 0 : this.attBank - this.bank;
    const rot = this.busy ? 0 : bankOff + this.artOffset;
    const sx = this.shakeT > 0 ? 1 + Math.sin(this.t * 38) * 0.08 : 1;
    const sy = (1 + this.attPitch * 0.14) * (this.shakeT > 0 ? 1 - Math.sin(this.t * 38) * 0.06 : 1);
    this.sprite.setRotation(rot).setScale(sx, sy);
    this.gooLayer.setRotation(rot).setScale(sx, sy);
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
    const s = this.splats.find((p) => Math.abs(p.ox - ox) < 0.22);
    if (s) s.m += amount;
    else this.splats.push({ m: amount, ox });
    this.coat.popNear(ox * HALF_SPAN);
    this.lastHitSide = rel >= 0 ? 1 : -1;
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
    this.coat.fling(0.5); // the shed portion flies off
    for (const s of this.splats) s.m *= TUNE.boostKeep;
    this.vy = Math.min(this.vy, 0) - 620;
    this.targetY = clamp(this.targetY - 200, this.bounds.top, this.bounds.bottom);
    this.bubbleBurst();
    Sfx.boost();
    this.emit('boost');
    return true;
  }

  // The boost's look (bubble spray + shield flash), also used by the slingshot launch.
  bubbleBurst(alpha = 0.85) {
    this.fx.bubble.explode(18, this.x, this.y + 20);
    this.scene.tweens.killTweensOf(this.shield);
    this.shield.setAlpha(alpha).setScale(3.2);
    this.scene.tweens.add({ targets: this.shield, alpha: 0, scale: 4.4, duration: 800, ease: 'Quad.easeIn' });
  }

  // Slingshot launch: the sling places the glider directly (art scale and tilt included)
  // until it hands control back with release().
  hold(x, y, rot = 0, scale = 1, vx = 0, vy = 0) {
    this.x = this.targetX = x;
    this.y = this.targetY = y;
    this.vx = vx;
    this.vy = vy;
    this.view.setPosition(x, y).setRotation(rot).setScale(ART_SCALE * scale);
    this.syncBody();
  }

  release() {
    this.autopilot = null;
    this.vx = 0;
    this.vy = 0;
    this.view.setScale(ART_SCALE);
  }

  shake() {
    if (!this.canAct) return false;
    if (this.shakes <= 0) {
      Sfx.deny();
      return false;
    }
    this.shakes--;
    this.shakeT = TUNE.shakeTime;
    this.coat.startShake(this.goo, TUNE.shakeTime); // blobs fling off during the wobble
    this.splats = [];
    Sfx.shake();
    this.emit('shake');
    return true;
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

  // Visual-only attitude for the flight view: a smoother, deeper bank and a pitch on the art.
  // The hitbox, aim and goo physics keep using `roll`, so mechanics are unchanged.
  setAttitude(bank, pitch) {
    this.attBank = bank;
    this.attPitch = pitch;
    this.applyArt();
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
    this.coat.fling(0.6);
    this.splats = [];
    this.stall = 0;
  }
}
