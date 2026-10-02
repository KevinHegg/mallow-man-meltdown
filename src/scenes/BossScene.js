// Boss: the cloud arena. Hit-and-run dives with short-range jelly beans melt the
// Evil Marshmallow Man through 4 stages; goo he throws frosts the city below.
import * as Phaser from 'phaser';
import { CAT, DEPTH, TIER_COLOR, TIER_LABEL, TUNE } from '../config.js';
import { Glider } from '../objects/Glider.js';
import { Beans, GooMallows } from '../objects/Projectiles.js';
import { City } from '../objects/City.js';
import { Controls } from '../objects/Controls.js';
import { MarshmallowMan } from '../objects/MarshmallowMan.js';
import { Hud } from '../ui/Hud.js';
import { drawSky, floatText, flushTrash, makeFx, rand, randInt, routeCollisions, snapshot } from '../ui/helpers.js';
import { Sfx } from '../sfx.js';

const CITY_H = 140;

export class BossScene extends Phaser.Scene {
  constructor() {
    super('Boss');
  }

  create(data = {}) {
    const { width: W, height: H } = this.scale;
    this.run = this.registry.get('run');
    if (!data.retry) this.registry.set('bossCheckpoint', snapshot(this.run));
    this.trash = [];
    this.ended = false;

    drawSky(this, [0xff9ec9, 0xffc7e0, 0xffe6d6, 0xcdeeff]);
    const sun = this.add.circle(W - 90, 150, 56, 0xfff1a8).setDepth(DEPTH.far);
    this.tweens.add({ targets: sun, scale: 1.06, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.decor = [];
    for (let i = 0; i < 6; i++) {
      const near = i >= 3;
      const c = this.add
        .image(randInt(0, W), randInt(160, H - CITY_H - 120), 'cloud')
        .setDepth(near ? DEPTH.mid : DEPTH.far)
        .setScale(near ? rand(0.7, 0.9) : rand(0.35, 0.5))
        .setAlpha(near ? 0.55 : 0.8);
      c.speed = near ? rand(18, 26) : rand(6, 10);
      this.decor.push(c);
    }

    this.city = new City(this, { height: CITY_H, frost: this.run.frost });
    this.fx = makeFx(this);
    this.boss = new MarshmallowMan(this, { x: W / 2, y: 352, scale: 0.85, fx: this.fx });
    this.boss.cityTargets = this.city.centers();
    this.bounds = { left: 48, right: W - 48, top: 110, bottom: this.city.top - 48 };
    this.glider = new Glider(this, W / 2, this.bounds.bottom - 30, this.bounds, this.run, this.fx);
    this.beans = new Beans(this);
    this.goo = new GooMallows(this, { cityTop: this.city.top + 14, onCity: (m) => this.gooLandsOnCity(m) });

    const boost = () => this.glider.boost();
    const shake = () => this.glider.shake();
    this.hud = new Hud(this, { mode: 'boss', glider: this.glider, city: this.city, boss: this.boss, onBoost: boost, onShake: shake });
    this.controls = new Controls(this, this.glider, { fire: () => this.fire(), boost, shake });

    this.glider.on('tier', (tier, prev) => this.onTier(tier, prev));
    this.glider.on('crashed', () => this.lose('spiral'));
    this.boss.on('throw', (x, y, vx, vy) => this.goo.spawn(x, y, vx, vy));
    this.boss.on('stage', (n, name) => {
      if (n < 4) this.hud.banner(name, '', 1100);
    });
    this.boss.on('defeated', () => this.finale());

    routeCollisions(this, {
      'bean|goo': (bean, goo) => this.popGoo(goo.gameObject, bean.gameObject),
      'glider|goo': (_g, goo) => this.gooHitsGlider(goo.gameObject),
      'bean|boss': (bean) => this.beanHitsBoss(bean.gameObject),
    });

    this.cameras.main.fadeIn(500, 255, 255, 255);
    this.hud.banner('MELT HIM!', 'Dive in, fire jelly beans, dive out', 1700);
    this.time.delayedCall(1800, () => {
      if (!this.ended) this.boss.active = true;
    });
  }

  update(_time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    const W = this.scale.width;
    flushTrash(this);
    for (const c of this.decor) {
      c.x += c.speed * dt;
      if (c.x > W + 120) c.x = -120;
    }

    this.controls.update(dt);
    this.glider.update(dt);
    this.boss.update(dt, this.glider);
    this.beans.update(dt);
    this.goo.update(dt);
    this.city.update(dt);
    this.hud.update();

    // Flying into the boss = sticky bounce. Checked every frame so lingering inside repeats it.
    const gl = this.glider;
    if (!this.ended && this.boss.contains(gl.x, gl.y) && gl.bonk(this.boss.x)) {
      gl.applyGoo(gl.x + rand(-20, 20), 1.1);
      this.fx.mdrip.explode(6, gl.x, gl.y - 20);
    }

    if (!this.ended && this.city.total >= 1) this.lose('frost');
    this.run.boosts = gl.boosts;
    this.run.shakes = gl.shakes;
    this.run.frost = this.city.frost.slice();
  }

  fire() {
    const shot = this.glider.tryFire();
    if (!shot) return;
    this.beans.fire(shot);
    this.run.stats.beans++;
  }

  popGoo(goo, bean) {
    if (!goo?.alive || !bean?.alive) return;
    this.goo.kill(goo);
    this.beans.kill(bean);
    this.fx.puff.explode(5, goo.x, goo.y);
    this.fx.spark.explode(6, goo.x, goo.y);
    Sfx.pop();
    this.run.stats.pops++;
  }

  gooHitsGlider(goo) {
    if (!goo?.alive || this.ended) return;
    const result = this.glider.applyGoo(goo.x, goo.gooAmt);
    if (result === 'ignored') return;
    this.goo.kill(goo);
    if (result === 'shielded') Sfx.pop();
    else {
      this.fx.drip.explode(6, goo.x, goo.y);
      this.run.stats.splats++;
    }
  }

  beanHitsBoss(bean) {
    if (!bean?.alive) return;
    this.beans.kill(bean);
    if (this.boss.hit(bean.x, bean.y)) this.run.stats.hits++;
  }

  gooLandsOnCity(m) {
    if (this.ended) return;
    const b = this.city.addFrost(m.x, TUNE.frostPerGoo);
    this.fx.flake.explode(8, b.x + b.w / 2, this.city.top + 30);
    Sfx.frost();
  }

  onTier(tier, prev) {
    const order = ['clean', 'dusted', 'splattered', 'caked'];
    if (order.indexOf(tier) > order.indexOf(prev)) {
      Sfx.gooWorse(tier);
      floatText(this, this.glider.x, this.glider.y - 50, `${TIER_LABEL[tier]}!`, TIER_COLOR[tier], 24);
    }
  }

  // Win: the boss melts, a flood of mini marshmallows pours down and piles up (Matter bodies).
  finale() {
    if (this.ended) return;
    this.ended = true;
    const { width: W, height: H } = this.scale;
    this.boss.active = false;
    this.goo.popAll(this.fx);
    this.glider.cleanAll();
    this.glider.autopilot = { x: W / 2, y: this.bounds.bottom - 160 };
    this.hud.banner('MELTDOWN!', 'The city is saved!', 4000);
    Sfx.win();
    this.city.thaw(3200);

    const solid = { isStatic: true, label: 'ground', collisionFilter: { category: CAT.ground, mask: CAT.fluff } };
    this.matter.add.rectangle(W / 2, H + 30, W * 2, 60, solid);
    this.matter.add.rectangle(-30, H / 2, 60, H * 2, solid);
    this.matter.add.rectangle(W + 30, H / 2, 60, H * 2, solid);
    this.time.addEvent({ delay: 26, repeat: 150, callback: () => this.spawnFluff() });

    this.time.delayedCall(5600, () => {
      this.cameras.main.fadeOut(600, 255, 255, 255);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('End', { result: 'win', from: 'Boss' }));
    });
  }

  spawnFluff() {
    const W = this.scale.width;
    const f = this.matter.add.image(randInt(20, W - 20), rand(-80, -20), `fluff${randInt(0, 1)}`, null, {
      shape: { type: 'rectangle', width: 26, height: 18 },
      chamfer: { radius: 6 },
      restitution: 0.2,
      friction: 0.4,
      frictionAir: 0.012,
      label: 'fluff',
      collisionFilter: { category: CAT.fluff, mask: CAT.fluff | CAT.ground },
    });
    f.setDepth(DEPTH.fluff).setAngle(randInt(0, 360));
    f.setVelocity(rand(-1, 1), rand(1, 3));
    f.setAngularVelocity(rand(-0.1, 0.1));
  }

  lose(reason) {
    if (this.ended) return;
    this.ended = true;
    this.boss.active = false;
    if (reason === 'frost') {
      this.city.freezeAll();
      this.hud.banner('CITY FROZEN!', '', 2000);
      Sfx.freeze();
    }
    Sfx.lose();
    this.time.delayedCall(1500, () => {
      this.cameras.main.fadeOut(500, 40, 20, 50);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('End', { result: 'lose', reason, from: 'Boss' }));
    });
  }
}
