// Boss: the rooftop fight. The pilot bailed out into the boss's cloud and parachutes onto a candy
// rooftop; the Evil Marshmallow Man looms over it at giant scale (same rig, same four melt
// stages, same attacks, aimed at a target on the ground). Run, dodge, duck behind the chimneys
// and spray jelly beans to melt him. Goo he throws at the city frosts the skyline behind the roof.
import * as Phaser from 'phaser';
import { CAT, DEPTH, TIER_COLOR, TIER_LABEL, TUNE } from '../config.js';
import { Beans, GooMallows } from '../objects/Projectiles.js';
import { City } from '../objects/City.js';
import { MarshmallowMan } from '../objects/MarshmallowMan.js';
import { Pilot, PilotControls } from '../objects/Pilot.js';
import { Rooftop } from '../objects/Rooftop.js';
import { Hud } from '../ui/Hud.js';
import { drawSky, floatText, flushTrash, makeFx, rand, randInt, routeCollisions, snapshot } from '../ui/helpers.js';
import { CloudCover } from '../view/CloudCover.js';
import { Sfx } from '../sfx.js';

const Ease = Phaser.Math.Easing;
const clamp = Phaser.Math.Clamp;
const PART_AT = 0.25; // s: the cloud wall starts to part…
const PART_TIME = 1.1; // …and is gone this long after
const FALL_BAILOUT = 1.9; // s: parachuting from the cloud down to the roof
const FALL_DROPIN = 1.3; // s: a retry drops in from above the screen

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
    this.bombs = []; // SAGGING splash bombs waiting to burst
    this.swatGlobs = []; // ARM OFF! close-range swat spray

    drawSky(this, [0xf68fc0, 0xffbfdc, 0xffe2d4, 0xc6ebff]);
    this.add.image(W - 90, 150, 'sunglow').setDepth(DEPTH.far - 0.1);
    const sun = this.add.circle(W - 90, 150, 56, 0xfff1a8).setDepth(DEPTH.far);
    this.tweens.add({ targets: sun, scale: 1.06, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // the rooftop and, behind it, the rest of the city (the frost meter)
    const roofY = H - Math.round(H * 0.25);
    this.roofY = roofY;
    this.landY = roofY - 26; // goo aimed at the pilot lands here if it misses
    this.city = new City(this, { height: Math.round(H * 0.11), frost: this.run.frost, bottom: roofY - 26 });
    this.decor = [];
    for (let i = 0; i < 5; i++) {
      const near = i >= 3;
      const c = this.add
        .image(randInt(0, W), randInt(140, this.city.top - 60), 'cloud')
        .setDepth(near ? DEPTH.mid : DEPTH.far)
        .setScale(near ? rand(0.6, 0.8) : rand(0.35, 0.5))
        .setAlpha(near ? 0.5 : 0.8);
      c.speed = near ? rand(18, 26) : rand(6, 10);
      this.decor.push(c);
    }
    this.roof = new Rooftop(this, { roofY });
    this.fx = makeFx(this);

    // the boss looms over the roof at giant scale, his cloud hovering just above the skyline
    // (the cloud art reaches ~142 units below his feet)
    const scale = clamp(1.1 + (0.2 * (H - 960)) / 209, 1.1, 1.3);
    const k = scale / 0.85;
    this.boss = new MarshmallowMan(this, { x: W / 2, y: this.city.top + 6 - 142 * k, scale, fx: this.fx, ground: true });
    this.boss.cityTargets = this.city.centers();

    this.pilot = new Pilot(this, W / 2, roofY, { left: 40, right: W - 40 }, this.run, this.fx);
    this.beans = new Beans(this);
    this.goo = new GooMallows(this, {
      cityTop: this.city.top + 14,
      onCity: (m) => this.gooLandsOnCity(m),
      onLand: (m) => this.gooLandsOnRoof(m),
    });

    const shake = () => this.pilot.shake();
    this.hud = new Hud(this, { mode: 'roof', glider: this.pilot, city: this.city, onShake: shake });
    this.controls = new PilotControls(this, this.pilot, { shake });

    this.pilot.on('tier', (tier, prev) => this.onTier(tier, prev));
    this.boss.on('throw', (x, y, vx, vy, opts) => this.spawnBossGoo(x, y, vx, vy, opts));
    this.boss.on('stage', (n, name) => {
      if (n < 4) this.hud.banner(name, '', 1100);
    });
    this.boss.on('defeated', () => this.finale());

    routeCollisions(this, {
      'bean|goo': (bean, goo) => this.popGoo(goo.gameObject, bean.gameObject),
      'pilot|goo': (_p, goo) => this.gooHitsPilot(goo.gameObject),
      'bean|boss': (bean) => this.beanHitsBoss(bean.gameObject),
    });

    this.startArrival(data);
  }

  // The pilot comes down by parachute: out of the cloud wall the flight handed over (identical
  // layout, same spot, same swing), or dropping in from above on a retry.
  startArrival(data) {
    const { width: W } = this.scale;
    const bailout = !!data.bailout;
    this.arrival = {
      t: 0,
      bailout,
      x0: data.px ?? W / 2,
      y0: bailout ? data.py : -60,
      s0: data.scale ?? 0.9,
      swing: data.swing ?? 0,
      fall: bailout ? FALL_BAILOUT : FALL_DROPIN,
    };
    this.pilot.autopilot = { landing: true };
    this.pilot.view.setDepth(DEPTH.hud);
    this.pilot.hang(this.arrival.x0, this.arrival.y0, this.arrival.s0, this.arrival.swing);
    this.controls.enabled = false;
    this.hud.setShown(0);
    if (bailout) {
      this.cover = new CloudCover(this, DEPTH.hud - 1);
      this.cover.part(0);
    } else this.cameras.main.fadeIn(400, 255, 255, 255);
  }

  updateArrival(dt) {
    const a = this.arrival;
    a.t += dt;
    a.swing += dt;
    if (this.cover) {
      const p = clamp((a.t - PART_AT) / PART_TIME, 0, 1);
      this.cover.part(p);
      if (p >= 1) {
        this.cover.destroy();
        this.cover = null;
      }
    }
    const { width: W } = this.scale;
    const u = clamp(a.t / a.fall, 0, 1);
    const e = Ease.Sine.InOut(u);
    this.pilot.hang(Phaser.Math.Linear(a.x0, W / 2, e), Phaser.Math.Linear(a.y0, this.roofY, e), Phaser.Math.Linear(a.s0, 1, e), a.swing, 1 - u);
    if (u >= 1) this.landed();
  }

  landed() {
    const p = this.pilot;
    this.arrival = null;
    p.land();
    p.view.setDepth(DEPTH.glider);
    // the chute floats away
    const chute = this.add.image(p.x, p.y - 84, 'chute').setOrigin(0.5, 1).setDepth(DEPTH.glider + 0.5);
    this.tweens.add({ targets: chute, y: chute.y - 220, x: chute.x + 90, angle: 25, alpha: 0, duration: 1400, ease: 'Quad.easeIn', onComplete: () => chute.destroy() });
    this.tweens.add({ targets: p.view, scaleY: 0.86, scaleX: 1.1, duration: 90, yoyo: true });
    this.fx.puff.explode(6, p.x, p.y);
    Sfx.land();
    this.controls.enabled = true;
    this.hudFade = 0;
    this.hud.banner('MELT HIM!', 'Hold to spray jelly beans • duck behind chimneys', 1900);
    this.time.delayedCall(900, () => {
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

    const p = this.pilot;
    if (this.arrival) this.updateArrival(dt);
    else {
      this.controls.update(dt);
      p.covered = !this.ended && !!this.roof.coverAt(p.x);
      if (!this.ended && this.controls.firing) this.fire();
      if (this.hudFade !== undefined && this.hudFade < 1) {
        this.hudFade = Math.min(1, this.hudFade + dt / 0.4);
        this.hud.setShown(this.hudFade);
      }
    }
    const boss = this.boss;
    p.update(dt, boss.x, boss.homeY - 140 * boss.scale);
    boss.update(dt, p);
    this.beans.update(dt);
    this.goo.update(dt);
    this.updateBossGoo(dt);
    this.city.update(dt);
    this.roof.update(dt);
    this.hud.update();

    if (!this.ended && this.city.total >= 1) this.lose('frost');
    this.run.boosts = p.boosts;
    this.run.shakes = p.shakes;
    this.run.frost = this.city.frost.slice();
  }

  // Every boss attack is an ordinary goo-mallow (same goo amount per hit); only how it flies
  // differs. Throws at the pilot land on the roof if they miss; throws at the city frost it.
  spawnBossGoo(x, y, vx, vy, opts) {
    const m = this.goo.spawn(x, y, vx, vy, opts?.city ? undefined : this.landY);
    if (opts?.burst) {
      m.burstIn = opts.burst.after;
      m.burst = opts.burst;
      this.bombs.push(m);
    } else if (opts?.life) {
      m.lifeLeft = opts.life;
      m.setTexture('splat').setScale(0.75);
      this.swatGlobs.push(m);
    }
  }

  updateBossGoo(dt) {
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const m = this.bombs[i];
      if (!m.alive) {
        this.bombs.splice(i, 1);
        continue;
      }
      m.burstIn -= dt;
      m.setTint(m.burstIn < 0.4 && Math.floor(m.burstIn * 20) % 2 ? 0xd4ff9e : 0xffffff); // fizzing telegraph
      if (m.burstIn <= 0) {
        this.bombs.splice(i, 1);
        this.burstBomb(m);
      }
    }
    for (let i = this.swatGlobs.length - 1; i >= 0; i--) {
      const m = this.swatGlobs[i];
      if (!m.alive) {
        this.swatGlobs.splice(i, 1);
        continue;
      }
      m.lifeLeft -= dt;
      if (m.lifeLeft <= 0) {
        this.swatGlobs.splice(i, 1);
        this.fx.drip.explode(3, m.x, m.y);
        this.goo.kill(m); // swat spray is close-range only
      }
    }
  }

  // SAGGING splash arc: the bomb bursts into a fan of splatter that widens as it falls.
  burstBomb(m) {
    const { n, spread } = m.burst;
    const vx = m.body.velocity.x * 60;
    const vy = m.body.velocity.y * 60;
    const { x, y, landY } = m;
    this.goo.kill(m);
    for (let k = 0; k < n; k++) {
      const f = this.goo.spawn(x, y, vx + (k - (n - 1) / 2) * spread, vy - 30 + rand(-20, 20), landY);
      f.setTexture('splat').setScale(0.8);
    }
    this.fx.gob.explode(6, x, y);
    this.fx.puff.explode(4, x, y);
    Sfx.burst();
  }

  fire() {
    const shot = this.pilot.tryFire();
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

  gooHitsPilot(goo) {
    if (!goo?.alive || this.ended) return;
    const p = this.pilot;
    if (p.covered) {
      // it splats on the chimney instead
      this.goo.kill(goo);
      this.fx.drip.explode(5, goo.x, Math.min(goo.y, this.roofY - 120));
      Sfx.bonk();
      return;
    }
    const result = p.applyGoo(goo.x, goo.gooAmt);
    if (result === 'ignored') return;
    this.goo.kill(goo);
    this.fx.drip.explode(6, goo.x, goo.y);
    this.run.stats.splats++;
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

  gooLandsOnRoof(m) {
    this.roof.splat(m.x);
    this.fx.drip.explode(3, m.x, this.roofY - 6);
  }

  onTier(tier, prev) {
    const order = ['clean', 'dusted', 'splattered', 'caked'];
    if (order.indexOf(tier) > order.indexOf(prev)) {
      Sfx.gooWorse(tier);
      floatText(this, this.pilot.x, this.pilot.y - 120, `${TIER_LABEL[tier]}!`, TIER_COLOR[tier], 24);
    }
  }

  // Win: the boss melts, a flood of mini marshmallows pours down and piles up (Matter bodies).
  finale() {
    if (this.ended) return;
    this.ended = true;
    const { width: W, height: H } = this.scale;
    this.boss.active = false;
    this.goo.popAll(this.fx);
    this.pilot.cleanAll();
    this.controls.enabled = false;
    this.tweens.add({ targets: this.pilot.view, y: this.pilot.y - 40, duration: 260, yoyo: true, repeat: 3, ease: 'Quad.easeOut' });
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
    this.controls.enabled = false;
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
