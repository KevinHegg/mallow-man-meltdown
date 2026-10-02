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
  const stump = scene.add.image(-SHOULDER_X + 14, -180, 'msplat').setVisible(false);
  root.add([legL, legR, armL, armR, body, stump, headC]);
  return { root, legL, legR, armL, armR, body, headC, head, eyes, mouth, stump, parts: [legL, legR, armL, armR, body, head] };
}

export class MarshmallowMan extends Phaser.Events.EventEmitter {
  constructor(scene, { x, y, scale, fx }) {
    super();
    this.scene = scene;
    this.fx = fx;
    this.homeX = x;
    this.homeY = y;
    this.x = x;
    this.scale = scale;
    this.cloud = scene.add.image(x, y + 52, 'bosscloud').setDepth(DEPTH.bossCloud);
    this.puddle = scene.add.image(x, y - 6, 'boss_puddle').setDepth(DEPTH.puddle).setScale(0.2, 0.2).setAlpha(0);
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
      this.x = this.homeX + Math.sin(this.t * speed) * 95;
    }
    const bob = Math.sin(this.t * 1.7) * 3;
    r.root.setPosition(this.x, this.homeY + bob + p.sink);
    this.cloud.setPosition(this.x, this.homeY + 52 + Math.sin(this.t * 1.7 + 0.6) * 4);
    this.puddle.setPosition(this.x, this.homeY - 6 + bob);
    this.puddle.setScale(0.2 + p.puddle * 0.8, 0.2 + p.puddle * 0.8).setAlpha(Math.min(1, p.puddle * 1.5));

    const breath = 1 + Math.sin(this.t * 3.2) * 0.02;
    r.body.setScale(p.bodySX, p.bodySY * breath);
    const bodyTop = -48 - 160 * p.bodySY * breath;
    r.headC.setPosition(p.headX, bodyTop + 12 + p.headDrop);
    r.headC.rotation = p.headRot + Math.sin(this.t * 2.1) * 0.03;
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

    if (this.debris?.active) {
      if (this.debris.y > this.scene.scale.height - 150) {
        this.fx.puff.explode(10, this.debris.x, this.debris.y);
        this.debris.destroy();
        this.debris = null;
      }
    }

    if (this.active && !this.dead) {
      this.throwT -= dt;
      if (this.throwT <= 0 && !this.throwing) this.startThrow(glider);
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
    const side = this.armGone ? 'R' : glider.x < this.x ? 'L' : 'R';
    const arm = side === 'L' ? this.rig.armL : this.rig.armR;
    const sgn = side === 'L' ? 1 : -1;
    const tweens = this.scene.tweens;
    this.throwing = true;
    arm.busy = true;
    this.throwT = [1.9, 1.6, 1.4, 1.2][this.stage] * Phaser.Math.FloatBetween(0.85, 1.15);
    Sfx.windup();
    tweens.add({
      targets: arm,
      rotation: sgn * 2.7,
      duration: 320,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (!this.dead) this.release(side, glider);
        tweens.add({
          targets: arm,
          rotation: sgn * 0.9,
          duration: 120,
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

  // Solves a ballistic arc to either the glider (with lead) or a city building.
  release(side, glider) {
    const hand = this.handWorld(side);
    const atPlayer = !glider.busy && this.cityTargets.length && Math.random() < 0.6;
    let tx;
    let ty;
    let T;
    if (atPlayer || !this.cityTargets.length) {
      const d = Phaser.Math.Distance.Between(hand.x, hand.y, glider.x, glider.y);
      T = Phaser.Math.Clamp(d / 520, 0.55, 1.25);
      tx = glider.x + glider.vx * T * 0.5;
      ty = glider.y + glider.vy * T * 0.3;
    } else {
      const target = Phaser.Utils.Array.GetRandom(this.cityTargets);
      tx = target.x;
      ty = target.y;
      T = Phaser.Math.FloatBetween(1.4, 1.8);
    }
    const volley = this.stage >= 2 && Math.random() < 0.35 ? 3 : 1;
    for (let k = 0; k < volley; k++) {
      const spread = (k - (volley - 1) / 2) * 70;
      const vx = (tx + spread - hand.x) / T;
      const vy = (ty - hand.y) / T - 0.5 * G_PX * T;
      this.emit('throw', hand.x, hand.y, vx, vy);
    }
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
      to({ bodySX: 1.08, bodySY: 0.88, headDrop: 10, headRot: -0.12, armRest: 0.16 });
      r.eyes.setTexture('boss_eyes_droopy');
    } else if (n === 2) {
      to({ bodySX: 1.12, bodySY: 0.8, headDrop: 18, headRot: -0.22, headX: -8 });
      r.mouth.setTexture('boss_mouth_wobble');
      this.dropArm();
    } else if (n === 3) {
      to({ bodySX: 1.24, bodySY: 0.62, headDrop: 26, headRot: -0.34, headX: -16, legSY: 0.35, puddle: 1 });
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
    debris.setVelocity(-2.4, -4.5);
    debris.setAngularVelocity(-0.07);
    this.debris = debris;
    Sfx.slough();
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
