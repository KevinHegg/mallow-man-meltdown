// The gingerbread pilot. He bails out of the glider at the boss's cloud and fights on foot on a
// rooftop: runs left/right toward a steering target and sprays jelly beans from his blaster while
// firing is held (bursts from a hopper that refills, so held fire sputters to a steady trickle).
// He wears goo with the glider's numbers (same amounts, tiers and drip): it makes him heavy and
// slow, and SHAKE flings it all off. Behind a chimney he's in cover: goo can't reach him, and he
// can't shoot.
import * as Phaser from 'phaser';
import { CAT, DEPTH, MASK, TUNE } from '../config.js';
import { mix } from '../art/textures.js';
import { tierFor } from './Glider.js';
import { Sfx } from '../sfx.js';

const clamp = Phaser.Math.Clamp;
const RUN_SPEED = 430; // px/s when clean; divided by √mass when gooey (the glider's mass model)
const RUN_ACCEL = 10;
const FIRE_CD = 0.13; // a machine gun: ~7.7 beans/s in a burst…
const HOPPER = 12; // …from a gumball hopper that holds this many beans…
const REFILL = 3; // …and refills at this many per second (held fire sputters down to this)
const BEAN_LIFE = 1.15; // long enough to reach the boss from the roof (same speed and damage)
const SPREAD = 0.13; // machine-gun spray
const AIM_MAX = 0.3; // the blaster tilts at most this far from straight up, toward the boss
const MUZZLE = 58; // gun pivot → muzzle
const GOO_SLOTS = [
  { at: 0.15, x: -10, y: -82, s: 0.5 },
  { at: 0.8, x: 12, y: -54, s: 0.55 },
  { at: 1.6, x: -14, y: -44, s: 0.6 },
  { at: 2.6, x: 8, y: -90, s: 0.6 },
  { at: 3.6, x: 2, y: -30, s: 0.7 },
];

// The pilot's art: a container with its origin between his feet. Shared by the flight's bail-out.
export function buildPilotView(scene) {
  const root = scene.add.container(0, 0);
  const legL = scene.add.image(-9, -26, 'gb_leg').setOrigin(0.5, 0.08);
  const legR = scene.add.image(9, -26, 'gb_leg').setOrigin(0.5, 0.08);
  const body = scene.add.image(0, -22, 'gb_body').setOrigin(0.5, 1);
  const gun = scene.add.image(0, -44, 'gb_gun').setOrigin(0.5, 0.82);
  const chute = scene.add.image(0, -84, 'chute').setOrigin(0.5, 1).setVisible(false);
  const strands = scene.add.image(0, -14, 'cc_strands').setScale(0.6, 0.5).setVisible(false);
  const goo = GOO_SLOTS.map((d) => scene.add.image(d.x, d.y, 'gcoat').setScale(d.s).setVisible(false));
  root.add([chute, legL, legR, body, ...goo, gun, strands]);
  return { root, legL, legR, body, gun, chute, goo, strands };
}

export class Pilot extends Phaser.Events.EventEmitter {
  constructor(scene, x, roofY, bounds, charges, fx) {
    super();
    this.scene = scene;
    this.fx = fx;
    this.bounds = bounds;
    this.x = x;
    this.y = roofY;
    this.roofY = roofY;
    this.targetX = x;
    this.vx = 0;
    this.vy = 0;
    this.t = 0;
    this.splats = [];
    this.tier = 'clean';
    this.boosts = charges.boosts;
    this.shakes = charges.shakes;
    this.shakeT = 0;
    this.fireCd = 0;
    this.stall = 0; // the HUD's death-spiral warning never applies on foot
    this.autopilot = null; // set while parachuting in: no running, shooting or goo
    this.covered = false;
    this.stuck = false; // held by a cotton-candy patch (set by the scene each frame)
    this.aim = 0;
    this.ammo = HOPPER;
    this.art = buildPilotView(scene);
    this.view = this.art.root.setPosition(x, roofY).setDepth(DEPTH.glider);
    this.body = scene.matter.add.rectangle(x, roofY - 44, 40, 80, {
      isSensor: true,
      ignoreGravity: true,
      label: 'pilot',
      collisionFilter: { category: CAT.glider, mask: MASK.glider },
    });
  }

  get goo() {
    return this.splats.reduce((sum, s) => sum + s.m, 0);
  }

  get busy() {
    return false;
  }

  get canAct() {
    return !this.autopilot && this.shakeT <= 0;
  }

  steerBy(dx) {
    if (!this.canAct) return;
    this.targetX = clamp(this.targetX + dx, this.bounds.left, this.bounds.right);
  }

  // Parachuting in: placed directly, chute open, legs dangling (amp damps the sway as he lands).
  hang(x, y, scale, swing, amp = 1) {
    this.x = this.targetX = x;
    this.y = y;
    const a = this.art;
    a.chute.setVisible(true);
    a.legL.rotation = (0.25 + Math.sin(swing * 3.1) * 0.15) * amp;
    a.legR.rotation = (-0.2 + Math.sin(swing * 3.1 + 1) * 0.15) * amp;
    a.gun.rotation = 0;
    this.view.setPosition(x, y).setScale(scale).setRotation(Math.sin(swing * 2.2) * 0.12 * amp);
    this.syncBody();
  }

  land() {
    this.y = this.roofY;
    this.view.setRotation(0).setScale(1);
    this.art.chute.setVisible(false);
    this.autopilot = null;
  }

  update(dt, aimX, aimY) {
    this.t += dt;
    this.fireCd -= dt;
    this.ammo = Math.min(HOPPER, this.ammo + REFILL * dt);
    if (this.autopilot) return;
    const shaking = this.shakeT > 0;
    if (shaking) this.shakeT -= dt;
    const goo = this.goo;
    const mass = 1 + goo * TUNE.massPerGoo;

    // run toward the steering target; goo weighs him down
    const maxV = (RUN_SPEED / Math.sqrt(mass)) * (this.stuck ? TUNE.trapHold : 1);
    const want = shaking ? 0 : clamp((this.targetX - this.x) * 8, -maxV, maxV);
    this.vx += (want - this.vx) * Math.min(1, dt * RUN_ACCEL);
    this.x = clamp(this.x + this.vx * dt, this.bounds.left, this.bounds.right);

    // goo drips off (heavier coats slower), exactly like the glider
    const rate = TUNE.dripBase / (1 + goo * 0.22);
    for (let i = this.splats.length - 1; i >= 0; i--) {
      this.splats[i].m -= rate * dt;
      if (this.splats[i].m < 0.08) this.splats.splice(i, 1);
    }
    if (goo > 0.3 && Math.random() < dt * goo * 1.4) this.fx.drip.emitParticleAt(this.x + Phaser.Math.Between(-16, 16), this.y - Phaser.Math.Between(30, 80));

    const tier = tierFor(this.goo);
    if (tier !== this.tier) {
      const prev = this.tier;
      this.tier = tier;
      this.emit('tier', tier, prev);
    }

    // aim the blaster at the boss (within limits)
    const want2 = Math.atan2(aimY - (this.y - 44), aimX - this.x) + Math.PI / 2;
    this.aim += (clamp(want2, -AIM_MAX, AIM_MAX) - this.aim) * Math.min(1, dt * 4);
    this.pose(dt, shaking);
    this.syncBody();
  }

  pose(dt, shaking) {
    const a = this.art;
    const run = Math.min(1, Math.abs(this.vx) / 200);
    const stride = Math.sin(this.t * 16) * 0.6 * run;
    a.legL.rotation = stride;
    a.legR.rotation = -stride;
    const crouch = this.covered ? 0.82 : 1;
    const bob = Math.abs(Math.sin(this.t * 16)) * 3 * run;
    const jitter = shaking ? Math.sin(this.t * 53) * 5 : 0;
    a.body.setScale(1, crouch);
    a.body.y = -22 + (crouch < 1 ? 4 : 0);
    a.gun.setPosition(0, -44 + (1 - crouch) * 30);
    a.gun.rotation = this.covered ? 0.9 * Math.sign(this.aim || 1) : this.aim;
    this.view.setPosition(this.x + jitter, this.y - bob).setRotation(shaking ? Math.sin(this.t * 46) * 0.3 : this.vx * 0.0002);
    const goo = this.goo;
    a.body.setTint(mix(0xffffff, 0xc6f2b0, clamp(goo / TUNE.gooCap, 0, 1)));
    GOO_SLOTS.forEach((d, i) => a.goo[i].setVisible(!shaking && goo >= d.at));
    a.strands.setVisible(this.stuck).setAlpha(0.6 + Math.sin(this.t * 9) * 0.25);
  }

  syncBody() {
    this.scene.matter.body.setPosition(this.body, { x: this.x, y: this.y - 44 });
  }

  // A shot from the blaster's muzzle toward the boss, with a little machine-gun spray.
  tryFire() {
    if (!this.canAct || this.covered || this.fireCd > 0) return null;
    if (this.ammo < 1) return null; // the hopper is refilling
    const slow = this.tier === 'caked' ? 1.7 : this.tier === 'splattered' ? 1.25 : 1;
    this.fireCd = FIRE_CD * slow;
    this.ammo -= 1;
    const a = this.aim + Phaser.Math.FloatBetween(-SPREAD, SPREAD);
    const px = this.x;
    const py = this.y - 44;
    return { x: px + Math.sin(this.aim) * MUZZLE, y: py - Math.cos(this.aim) * MUZZLE, angle: a - Math.PI / 2, life: BEAN_LIFE };
  }

  // Returns 'splat' | 'ignored' — the same goo rules as the glider (vulnerable while shaking).
  applyGoo(worldX, amount) {
    if (this.autopilot) return 'ignored';
    if (this.shakeT > 0) amount *= 1.5;
    amount = Math.min(amount, Math.max(0.05, TUNE.gooCap - this.goo));
    this.splats.push({ m: amount });
    this.vx += (worldX < this.x ? 1 : -1) * 90; // the splat shoves him a little
    Sfx.splat();
    return 'splat';
  }

  shake() {
    if (!this.canAct) return false;
    if (this.shakes <= 0) {
      Sfx.deny();
      return false;
    }
    this.shakes--;
    this.shakeT = TUNE.shakeTime;
    const n = Math.min(14, Math.round(this.goo * 3));
    if (n) this.fx.gob.explode(n, this.x, this.y - 50);
    this.splats = [];
    Sfx.shake();
    this.emit('shake');
    return true;
  }

  cleanAll() {
    this.splats = [];
  }
}

// On-foot controls. Touch/mouse: drag anywhere to run (relative, like the glider) and keep the
// finger down to keep firing. Keyboard: arrows/A-D run, hold Space to fire, X shakes.
export class PilotControls {
  constructor(scene, pilot, { shake }) {
    this.pilot = pilot;
    this.enabled = true;
    this.dragId = null;
    this.lastX = 0;
    const input = scene.input;
    input.on('pointerdown', (p, over) => {
      Sfx.unlock();
      if (over.length || !this.enabled || this.dragId !== null) return; // HUD buttons handle themselves
      this.dragId = p.id;
      this.lastX = p.x;
    });
    input.on('pointermove', (p) => {
      if (p.id !== this.dragId || !p.isDown) return;
      if (this.enabled) pilot.steerBy((p.x - this.lastX) * TUNE.steerSensitivity);
      this.lastX = p.x;
    });
    const release = (p) => {
      if (p.id === this.dragId) this.dragId = null;
    };
    input.on('pointerup', release);
    input.on('pointerupoutside', release);
    if (input.keyboard) {
      this.keys = input.keyboard.addKeys('A,D,LEFT,RIGHT,SPACE,X');
      this.keys.X.on('down', () => this.enabled && shake());
    }
  }

  get firing() {
    return this.enabled && (this.dragId !== null || !!this.keys?.SPACE.isDown);
  }

  update(dt) {
    const k = this.keys;
    if (!k || !this.enabled) return;
    const sx = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
    if (sx) this.pilot.steerBy(sx * TUNE.keySpeed * dt);
  }
}
