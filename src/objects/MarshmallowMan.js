// The Evil Marshmallow Man. Built from procedural parts in a container; stage changes
// tween a plain "pose" object that update() applies every frame (so idle breathing and
// stage slumps never fight over the same properties).
import * as Phaser from 'phaser';
import { CAT, DEPTH, G_PX, MASK, TUNE } from '../config.js';
import { Sfx } from '../sfx.js';

export const STAGE_NAMES = ['PRISTINE', 'SAGGING', 'ARM OFF!', 'COLLAPSING', 'MELTED!'];

const SHOULDER_X = 96;
const HAND_REACH = 90; // arm origin → hand centre, in rig units
const ARM_REST = 0.32;

// How each stage fights (behaviour only: goo amounts, damage and HP thresholds live elsewhere).
//   PRISTINE   smug: slow, aimed, unhurried throws
//   SAGGING    sloppy: lobbed goo bombs that burst mid-air into a widening splatter
//   ARM OFF!   desperate: fast, wild throws, plus a swat when the glider gets close
//   COLLAPSING feeble: slow drooping lobs and long pauses; more drips than attacks
const STYLE = [
  { interval: 2.2, windup: 460, follow: 140, raise: 2.7 },
  { interval: 2.4, windup: 380, follow: 130, raise: 2.7 },
  { interval: 0.95, windup: 190, follow: 90, raise: 2.9 },
  { interval: 3.0, windup: 650, follow: 280, raise: 1.5 },
];
// Melt drama per stage: marshmallow drips and sloughing chunks per second, and puddle size.
const MELT_DRIPS = [0.4, 2.5, 4, 8];
const MELT_SLOUGH = [0, 0.6, 1.2, 2.2];
const PUDDLE = [0, 0.35, 0.65, 1];
const SWAT_RANGE = 300; // px from his chest at which the one-armed boss swats
const SWAT_UNDER = 150; // vs a target on the ground: how far either side of him he swats down
const SWAT_COOLDOWN = 1.8;
const SPLASH = { n: 3, spread: 120 };

// Hitbox per stage, in rig units relative to the feet.
const HITBOX = [
  { w: 180, h: 300, cy: -165 },
  { w: 190, h: 270, cy: -150 },
  { w: 190, h: 245, cy: -138 },
  { w: 210, h: 185, cy: -100 },
];

export function buildBossRig(scene, x, y, scale) {
  const root = scene.add.container(x, y).setScale(scale);
  const legL = scene.add.image(-40, 0, 'boss_leg').setOrigin(0.5, 1);
  const legR = scene.add.image(40, 0, 'boss_leg').setOrigin(0.5, 1).setFlipX(true);
  const armL = scene.add.image(-SHOULDER_X, -186, 'boss_arm').setOrigin(0.5, 0.12).setRotation(ARM_REST);
  const armR = scene.add
    .image(SHOULDER_X, -186, 'boss_arm')
    .setOrigin(0.5, 0.12)
    .setRotation(-ARM_REST)
    .setFlipX(true);
  const body = scene.add.image(0, -48, 'boss_body').setOrigin(0.5, 1);
  const headC = scene.add.container(0, -196);
  const head = scene.add.image(0, 0, 'boss_head').setOrigin(0.5, 1);
  const eyes = scene.add.image(0, -60, 'boss_eyes_angry');
  const mouth = scene.add.image(0, -28, 'boss_mouth_grin');
  headC.add([head, eyes, mouth]);
  const stump = scene.add.image(-SHOULDER_X + 14, -180, 'boss_stump').setScale(1.25).setVisible(false);
  root.add([legL, legR, armL, armR, body, stump, headC]);
  return { root, legL, legR, armL, armR, body, headC, head, eyes, mouth, stump, parts: [legL, legR, armL, armR, body, head] };
}

export class MarshmallowMan extends Phaser.Events.EventEmitter {
  // ground: his target stands on a rooftop below him (the swat reaches down instead of out).
  constructor(scene, { x, y, scale, fx, ground = false }) {
    super();
    this.scene = scene;
    this.fx = fx;
    this.homeX = x;
    this.homeY = y;
    this.x = x;
    this.scale = scale;
    this.k = scale / 0.85; // size relative to the original arena boss (cloud, puddle, sway)
    this.ground = ground;
    this.cloud = scene.add.image(x, y + 52 * this.k, 'bosscloud').setDepth(DEPTH.bossCloud).setScale(this.k);
    this.puddle = scene.add.image(x, y - 6 * this.k, 'boss_puddle').setDepth(DEPTH.puddle).setScale(0.2, 0.2).setAlpha(0);
    this.rig = buildBossRig(scene, x, y, scale);
    this.rig.root.setDepth(DEPTH.boss);
    this.maxHp = TUNE.bossHP;
    this.hp = this.maxHp;
    this.stage = 0;
    this.t = 0;
    this.throwT = 1.2;
    this.throwing = false;
    this.active = false; // set true when the fight starts
    this.dead = false;
    this.armGone = false;
    this.flashT = 0;
    this.cityTargets = [];
    this.pose = { bodySX: 1, bodySY: 1, headDrop: 0, headRot: 0, headX: 0, armRest: ARM_REST, legSY: 1, puddle: 0, sink: 0 };
    this.dripAcc = 0;
    this.sloughAcc = 0;
    this.sweatAcc = 0;
    this.trailAcc = 0;
    this.swatCd = 0;
    this.recoil = 0; // head/body jolt after the arm tears off
    this.pt = { x: 0, y: 0 };
    this.makeHitbox();
  }

  get hpFrac() {
    return this.hp / this.maxHp;
  }

  makeHitbox() {
    if (this.hitbox) this.scene.matter.world.remove(this.hitbox);
    this.hitbox = null;
    if (this.dead) return;
    const d = HITBOX[this.stage];
    this.hb = d;
    this.hitbox = this.scene.matter.add.rectangle(this.x, this.homeY + d.cy * this.scale, d.w * this.scale, d.h * this.scale, {
      isStatic: true,
      isSensor: true,
      label: 'boss',
      collisionFilter: { category: CAT.boss, mask: MASK.boss },
    });
  }

  contains(px, py) {
    if (!this.hitbox) return false;
    const { min, max } = this.hitbox.bounds;
    return px > min.x && px < max.x && py > min.y && py < max.y;
  }

  update(dt, glider) {
    this.t += dt;
    const r = this.rig;
    const p = this.pose;
    if (!this.dead) {
      const speed = [0.45, 0.55, 0.62, 0.38][this.stage];
      this.x = this.homeX + Math.sin(this.t * speed) * 95 * this.k;
    }
    const bob = Math.sin(this.t * 1.7) * 3;
    this.recoil = Math.max(0, this.recoil - dt * 1.5);
    // ARM OFF!: angry and scared — he trembles
    const tremble = (this.stage === 2 && !this.dead ? Math.sin(this.t * 31) * 2.2 : 0) + Math.sin(this.t * 40) * this.recoil * 8;
    r.root.setPosition(this.x + tremble, this.homeY + bob + p.sink);
    this.cloud.setPosition(this.x, this.homeY + (52 + Math.sin(this.t * 1.7 + 0.6) * 4) * this.k);
    this.puddle.setPosition(this.x, this.homeY + (bob - 6) * this.k);
    this.puddle.setScale((0.2 + p.puddle * 0.8) * this.k).setAlpha(Math.min(1, p.puddle * 1.5));

    const breath = 1 + Math.sin(this.t * 3.2) * 0.02;
    r.body.setScale(p.bodySX, p.bodySY * breath);
    const bodyTop = -48 - 160 * p.bodySY * breath;
    r.headC.setPosition(p.headX, bodyTop + 12 + p.headDrop);
    r.headC.rotation = p.headRot + Math.sin(this.t * 2.1) * 0.03 + Math.sin(this.t * 25) * this.recoil * 0.25;
    r.armL.setPosition(-SHOULDER_X * p.bodySX, bodyTop + 22);
    r.armR.setPosition(SHOULDER_X * p.bodySX, bodyTop + 22);
    r.stump.setPosition(-SHOULDER_X * p.bodySX + 14, bodyTop + 28);
    if (!r.armL.busy) r.armL.rotation = p.armRest + Math.sin(this.t * 2) * 0.05;
    if (!r.armR.busy) r.armR.rotation = -p.armRest - Math.sin(this.t * 2) * 0.05;
    r.legL.setScale(1, p.legSY);
    r.legR.setScale(1, p.legSY);

    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) r.parts.forEach((part) => part.clearTint());
    }

    if (this.hitbox) {
      this.scene.matter.body.setPosition(this.hitbox, { x: this.x, y: this.homeY + bob + this.hb.cy * this.scale });
    }

    if (!this.dead) this.melt(dt);

    if (this.debris?.active) {
      // the torn-off arm trails goo and marshmallow as it tumbles
      this.trailAcc += dt * 22;
      while (this.trailAcc >= 1) {
        this.trailAcc -= 1;
        (Math.random() < 0.5 ? this.fx.drip : this.fx.mdrip).emitParticleAt(this.debris.x, this.debris.y);
      }
      if (this.debris.y > this.scene.scale.height - 150) {
        this.fx.puff.explode(10, this.debris.x, this.debris.y);
        this.debris.destroy();
        this.debris = null;
      }
    }

    if (this.active && !this.dead) {
      this.throwT -= dt;
      this.swatCd -= dt;
      const near = this.ground
        ? Math.abs(glider.x - this.x) < SWAT_UNDER * this.k
        : Phaser.Math.Distance.Between(glider.x, glider.y, this.x, this.homeY - 140 * this.scale) < SWAT_RANGE;
      if (this.stage === 2 && !this.throwing && this.swatCd <= 0 && near && !glider.busy) this.swat(glider);
      else if (this.throwT <= 0 && !this.throwing) this.startThrow(glider);
    }
  }

  // A random point on his body (for drips and sloughing chunks).
  bodyPoint() {
    const p = this.pose;
    const root = this.rig.root;
    this.pt.x = root.x + Phaser.Math.FloatBetween(-80, 80) * this.scale * p.bodySX;
    this.pt.y = root.y + (-48 - Phaser.Math.FloatBetween(10, 150) * p.bodySY) * this.scale;
    return this.pt;
  }

  melt(dt) {
    this.dripAcc += dt * MELT_DRIPS[this.stage];
    while (this.dripAcc >= 1) {
      this.dripAcc -= 1;
      const pt = this.bodyPoint();
      this.fx.mdrip.emitParticleAt(pt.x, pt.y);
    }
    this.sloughAcc += dt * MELT_SLOUGH[this.stage];
    while (this.sloughAcc >= 1) {
      this.sloughAcc -= 1;
      const pt = this.bodyPoint();
      this.fx.slough.emitParticleAt(pt.x, pt.y);
    }
    if (this.stage === 2) {
      // nervous sweat beads off his head
      this.sweatAcc += dt * 3;
      while (this.sweatAcc >= 1) {
        this.sweatAcc -= 1;
        const h = this.rig.headC;
        const side = Math.random() < 0.5 ? -1 : 1;
        this.fx.sweat.emitParticleAt(this.rig.root.x + (h.x + side * 60) * this.scale, this.rig.root.y + (h.y - 70) * this.scale);
      }
    }
  }

  handWorld(side) {
    const arm = side === 'L' ? this.rig.armL : this.rig.armR;
    const root = this.rig.root;
    const th = arm.rotation;
    return {
      x: root.x + this.scale * (arm.x - HAND_REACH * Math.sin(th)),
      y: root.y + this.scale * (arm.y + HAND_REACH * Math.cos(th)),
    };
  }

  startThrow(glider) {
    const st = STYLE[this.stage];
    const side = this.armGone ? 'R' : glider.x < this.x ? 'L' : 'R';
    const arm = side === 'L' ? this.rig.armL : this.rig.armR;
    const sgn = side === 'L' ? 1 : -1;
    const tweens = this.scene.tweens;
    this.throwing = true;
    this.throwArm = arm;
    arm.busy = true;
    this.throwT = st.interval * Phaser.Math.FloatBetween(0.85, 1.15);
    Sfx.windup();
    tweens.add({
      targets: arm,
      rotation: sgn * st.raise,
      duration: st.windup,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (!this.dead) this.release(side, glider);
        tweens.add({
          targets: arm,
          rotation: sgn * 0.9,
          duration: st.follow,
          ease: 'Quad.easeIn',
          onComplete: () =>
            tweens.add({
              targets: arm,
              rotation: sgn * this.pose.armRest,
              duration: 380,
              ease: 'Back.easeOut',
              onComplete: () => {
                arm.busy = false;
                this.throwing = false;
              },
            }),
        });
      },
    });
  }

  // Ballistic lob from the hand to (tx, ty) arriving after T seconds.
  lob(hand, tx, ty, T, opts) {
    this.emit('throw', hand.x, hand.y, (tx - hand.x) / T, (ty - hand.y) / T - 0.5 * G_PX * T, opts);
  }

  cityTarget() {
    return Phaser.Utils.Array.GetRandom(this.cityTargets);
  }

  release(side, glider) {
    const hand = this.handWorld(side);
    const R = Phaser.Math.FloatBetween;
    const canAim = !glider.busy || !this.cityTargets.length;
    const d = Phaser.Math.Distance.Between(hand.x, hand.y, glider.x, glider.y);
    if (this.stage === 0) {
      // smug: one slow, well-aimed throw
      if (canAim) {
        const T = Phaser.Math.Clamp(d / 420, 0.75, 1.4);
        this.lob(hand, glider.x + glider.vx * T * 0.5, glider.y + glider.vy * T * 0.3, T);
      } else {
        const c = this.cityTarget();
        this.lob(hand, c.x, c.y, R(1.4, 1.8), { city: true });
      }
    } else if (this.stage === 1) {
      // sloppy: a lobbed goo bomb that bursts mid-flight over you or the city
      const overGlider = canAim && Math.random() < 0.65;
      const c = overGlider ? null : this.cityTarget();
      const T = overGlider ? R(1.3, 1.6) : R(1.5, 1.8);
      const tx = overGlider ? glider.x + glider.vx * T * 0.4 : c.x;
      const ty = overGlider ? glider.y - 90 : c.y;
      this.lob(hand, tx, ty, T, { city: !overGlider, burst: { after: T * (overGlider ? 0.6 : 0.55), n: SPLASH.n, spread: SPLASH.spread } });
    } else if (this.stage === 2) {
      // desperate: fast, wild throws (often two)
      const n = Math.random() < 0.4 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        if (canAim && Math.random() < 0.75) {
          const T = Phaser.Math.Clamp(d / 650, 0.45, 1);
          this.lob(hand, glider.x + R(-70, 70), glider.y + R(-40, 40), T);
        } else {
          const c = this.cityTarget();
          this.lob(hand, c.x + R(-40, 40), c.y, R(1.1, 1.5), { city: true });
        }
      }
    } else {
      // feeble: a slow lob that droops short
      if (canAim && Math.random() < 0.5) this.lob(hand, glider.x + R(-30, 30), glider.y + 60, R(1.8, 2.3));
      else {
        const c = this.cityTarget();
        this.lob(hand, c.x, c.y, R(2, 2.4), { city: true });
      }
    }
  }

  // ARM OFF! close-range answer to your short-range beans: a sweep that sprays goo at you.
  swat(glider) {
    const arm = this.rig.armR;
    const tweens = this.scene.tweens;
    this.throwing = true;
    arm.busy = true;
    this.swatCd = SWAT_COOLDOWN;
    this.throwT = Math.max(this.throwT, 0.6);
    Sfx.swat();
    let sprayed = false;
    tweens.add({
      targets: arm,
      rotation: -2.3,
      duration: 150,
      ease: 'Quad.easeOut',
      onComplete: () =>
        tweens.add({
          targets: arm,
          rotation: 0.9,
          duration: 170,
          ease: 'Quad.easeIn',
          onUpdate: (tw) => {
            if (!sprayed && tw.progress > 0.45 && !this.dead) {
              sprayed = true;
              this.swatSpray(glider);
            }
          },
          onComplete: () =>
            tweens.add({
              targets: arm,
              rotation: -this.pose.armRest,
              duration: 300,
              ease: 'Back.easeOut',
              onComplete: () => {
                arm.busy = false;
                this.throwing = false;
              },
            }),
        }),
    });
  }

  swatSpray(glider) {
    const hand = this.handWorld('R');
    const base = Math.atan2(glider.y - hand.y, glider.x - hand.x);
    // close range only: the spray lives just long enough to reach you (a rooftop is further down)
    const life = this.ground ? Math.min(1.1, Phaser.Math.Distance.Between(hand.x, hand.y, glider.x, glider.y) / 520 + 0.2) : 0.6;
    for (let k = 0; k < 4; k++) {
      const a = base + (k - 1.5) * 0.3;
      this.emit('throw', hand.x, hand.y, Math.cos(a) * 520, Math.sin(a) * 520, { life });
    }
    this.scene.cameras.main.shake(120, 0.005);
  }

  hit(x, y) {
    if (this.dead) return false;
    this.hp = Math.max(0, this.hp - 1);
    this.flashT = 0.08;
    this.rig.parts.forEach((part) => part.setTint(0xff9cc4));
    this.fx.mdrip.explode(2, x, y);
    this.fx.spark.explode(4, x, y);
    Sfx.hitBoss();
    const f = this.hpFrac;
    const stage = f <= 0 ? 4 : f <= 0.25 ? 3 : f <= 0.5 ? 2 : f <= 0.75 ? 1 : 0;
    if (stage > this.stage) this.setStage(stage);
    return true;
  }

  setStage(n) {
    this.stage = n;
    const sc = this.scene;
    const r = this.rig;
    sc.cameras.main.shake(260, 0.012);
    this.fx.mdrip.explode(14, this.x, this.homeY - 150);
    const to = (props, duration = 700, ease = 'Back.easeOut') => sc.tweens.add({ targets: this.pose, ...props, duration, ease });
    if (n === 1) {
      to({ bodySX: 1.08, bodySY: 0.88, headDrop: 10, headRot: -0.12, armRest: 0.16, puddle: PUDDLE[1] });
      r.eyes.setTexture('boss_eyes_droopy');
    } else if (n === 2) {
      to({ bodySX: 1.12, bodySY: 0.8, headDrop: 18, headRot: -0.22, headX: -8, puddle: PUDDLE[2] });
      r.eyes.setTexture('boss_eyes_angry'); // angry again — and scared (trembling, sweating)
      r.mouth.setTexture('boss_mouth_wobble');
      this.dropArm();
    } else if (n === 3) {
      to({ bodySX: 1.24, bodySY: 0.62, headDrop: 26, headRot: -0.34, headX: -16, legSY: 0.35, puddle: PUDDLE[3] });
      r.eyes.setTexture('boss_eyes_dizzy');
    } else if (n === 4) {
      this.meltAway();
    }
    if (n < 4) {
      this.makeHitbox();
      Sfx.stage();
    }
    this.emit('stage', n, STAGE_NAMES[n]);
  }

  dropArm() {
    this.armGone = true;
    const arm = this.rig.armL;
    const root = this.rig.root;
    this.scene.tweens.killTweensOf(arm);
    // a throw in progress with this arm dies with it: free him to attack again
    if (this.throwArm === arm) this.throwing = false;
    arm.busy = true;
    arm.setVisible(false);
    this.rig.stump.setVisible(true);
    // Swap the rig arm for a free-falling Matter body that tumbles off the cloud.
    const th = arm.rotation;
    const off = (0.5 - 0.12) * arm.height;
    const cx = root.x + this.scale * (arm.x - off * Math.sin(th));
    const cy = root.y + this.scale * (arm.y + off * Math.cos(th));
    const debris = this.scene.matter.add.image(cx, cy, 'boss_arm', null, {
      isSensor: true,
      label: 'debris',
      collisionFilter: { category: 0, mask: 0 },
    });
    debris.setScale(this.scale).setRotation(th).setDepth(DEPTH.bossCloud + 1);
    debris.setVelocity(-4.2, -6.5); // flung up and away
    debris.setAngularVelocity(-0.16);
    this.debris = debris;
    // goo bursts from the shoulder as it tears free
    const sx = root.x + this.scale * arm.x;
    const sy = root.y + this.scale * arm.y;
    this.fx.gob.explode(16, sx, sy);
    this.fx.mdrip.explode(14, sx, sy);
    this.fx.puff.explode(8, sx, sy);
    this.scene.cameras.main.shake(380, 0.016);
    this.recoil = 1;
    Sfx.slough();
    Sfx.burst();
  }

  meltAway() {
    this.dead = true;
    this.makeHitbox();
    this.scene.tweens.killTweensOf([this.rig.armL, this.rig.armR]);
    this.rig.eyes.setTexture('boss_eyes_dizzy');
    this.scene.tweens.add({
      targets: this.pose,
      bodySY: 0.1,
      bodySX: 1.5,
      headDrop: 120,
      legSY: 0,
      armRest: 1.6,
      puddle: 1.5,
      sink: 30,
      duration: 1400,
      ease: 'Quad.easeIn',
    });
    this.scene.tweens.add({ targets: this.rig.root, alpha: 0, delay: 900, duration: 700 });
    this.scene.time.delayedCall(500, () => this.fx.puff.explode(20, this.x, this.homeY - 60));
    this.scene.time.delayedCall(1000, () => this.emit('defeated'));
  }
}
