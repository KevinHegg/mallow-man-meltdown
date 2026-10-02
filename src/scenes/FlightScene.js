// Flight: climb the candy canyon toward the boss's cloud. Parallax layers sell depth;
// all gameplay lives on the 2D screen plane.
import * as Phaser from 'phaser';
import { CAT, DEPTH, MASK, TIER_COLOR, TIER_LABEL, TUNE } from '../config.js';
import { Glider } from '../objects/Glider.js';
import { Beans, GooMallows } from '../objects/Projectiles.js';
import { City } from '../objects/City.js';
import { Controls } from '../objects/Controls.js';
import { buildBossRig } from '../objects/MarshmallowMan.js';
import { Hud } from '../ui/Hud.js';
import { drawSky, floatText, flushTrash, makeFx, rand, randInt, retire, routeCollisions } from '../ui/helpers.js';
import { Sfx } from '../sfx.js';

const SCROLL = 170; // px/s the canyon scrolls past
const WALL_W = 56;

export class FlightScene extends Phaser.Scene {
  constructor() {
    super('Flight');
  }

  create() {
    const { width: W, height: H } = this.scale;
    this.run = this.registry.get('run');
    this.trash = [];
    this.props = new Set();
    this.elapsed = 0;
    this.progress = 0;
    this.ended = false;
    this.arriving = false;
    this.nextObstacle = 1.4;
    this.nextGoo = 2.2;
    this.nextPickup = 7;

    // parallax: sky → far clouds → distant boss → mid walls → near walls
    drawSky(this, [0xffc6e3, 0xffe3f1, 0xd7f0ff, 0xbfe9ff]);
    this.far = this.add.tileSprite(0, 0, W, H, 'farsky').setOrigin(0).setDepth(DEPTH.far);
    this.distant = this.add.container(W / 2, 205).setDepth(DEPTH.distant);
    const dCloud = this.add.image(0, 40, 'bosscloud').setScale(0.9);
    const dRig = buildBossRig(this, 0, 0, 1);
    dRig.parts.forEach((p) => p.setTint(0xf2dcff));
    this.distant.add([dCloud, dRig.root]).setScale(0.22).setAlpha(0.85);
    this.distantRig = dRig;
    this.midL = this.add.tileSprite(0, 0, 100, H, 'wallL').setOrigin(0).setDepth(DEPTH.mid).setTint(0xf0c8f5).setAlpha(0.6);
    this.midR = this.add.tileSprite(W - 100, 0, 100, H, 'wallR').setOrigin(0).setDepth(DEPTH.mid).setTint(0xf0c8f5).setAlpha(0.6);
    this.wallL = this.add.tileSprite(0, 0, WALL_W, H, 'wallL').setOrigin(0).setDepth(DEPTH.walls);
    this.wallR = this.add.tileSprite(W - WALL_W, 0, WALL_W, H, 'wallR').setOrigin(0).setDepth(DEPTH.walls);

    this.city = new City(this, { height: 92, frost: this.run.frost });
    this.fx = makeFx(this);
    this.bounds = { left: WALL_W + 48, right: W - WALL_W - 48, top: 150, bottom: this.city.top - 46 };
    this.glider = new Glider(this, W / 2, this.bounds.bottom - 60, this.bounds, this.run, this.fx);
    this.beans = new Beans(this);
    this.goo = new GooMallows(this, { cityTop: this.city.top + 12, onCity: (m) => this.gooLandsOnCity(m) });

    const boost = () => this.glider.boost();
    const shake = () => this.glider.shake();
    this.hud = new Hud(this, { mode: 'flight', glider: this.glider, city: this.city, onBoost: boost, onShake: shake });
    this.controls = new Controls(this, this.glider, { fire: () => this.fire(), boost, shake });

    this.glider.on('tier', (tier, prev) => this.onTier(tier, prev));
    this.glider.on('crashed', () => this.lose('spiral'));

    const hits = {
      'bean|goo': (bean, goo) => this.popGoo(goo.gameObject, bean.gameObject),
      'glider|goo': (_g, goo) => this.gooHitsGlider(goo.gameObject),
      'glider|prop': (_g, prop) => this.gliderHitsProp(prop.gameObject),
    };
    routeCollisions(this, hits);
    routeCollisions(this, { 'glider|prop': hits['glider|prop'] }, 'collisionactive');

    this.cameras.main.fadeIn(400, 255, 255, 255);
    this.hud.banner('FLY!', 'Climb the candy canyon to his cloud', 1300);
  }

  update(_time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    flushTrash(this);
    const boosting = this.glider.boostT > 0;
    const speed = SCROLL * (boosting ? 1.8 : 1) * (this.arriving ? 1.6 : 1);

    this.far.tilePositionY -= speed * 0.12 * dt;
    this.midL.tilePositionY -= speed * 0.45 * dt;
    this.midR.tilePositionY -= speed * 0.45 * dt;
    this.wallL.tilePositionY -= speed * dt;
    this.wallR.tilePositionY -= speed * dt;

    for (const p of this.props) {
      p.y += speed * dt;
      if (p.bob !== undefined) p.x = p.baseX + Math.sin(this.elapsed * 2 + p.bob) * 12;
      if (p.y > this.scale.height + 100) {
        this.props.delete(p);
        retire(this, p);
      }
    }

    this.controls.update(dt);
    this.glider.update(dt);
    this.beans.update(dt);
    this.goo.update(dt);
    this.city.update(dt);

    if (!this.ended && !this.arriving) {
      this.elapsed += dt;
      this.progress = Math.min(1, this.progress + (dt * (boosting ? 1.6 : 1)) / TUNE.flightTime);
      this.spawn(dt);
      if (this.progress >= 1) this.arrive();
      if (this.city.total >= 1) this.lose('frost');
    }
    const d = 0.22 + this.progress * 0.2;
    this.distant.setScale(d);
    this.hud.progress = this.progress;
    this.hud.update();
    this.syncRun();
  }

  spawn(dt) {
    const p = this.progress;
    this.nextObstacle -= dt;
    this.nextGoo -= dt;
    this.nextPickup -= dt;
    if (this.nextObstacle <= 0) {
      this.spawnObstacle();
      this.nextObstacle = Phaser.Math.Linear(2.3, 1.5, p) * rand(0.85, 1.15);
    }
    if (this.nextGoo <= 0) {
      this.spawnGoo();
      this.nextGoo = Phaser.Math.Linear(2.4, 1.3, p) * rand(0.8, 1.2);
    }
    if (this.nextPickup <= 0) {
      this.spawnPickup();
      this.nextPickup = rand(7, 10);
    }
  }

  addProp(x, y, key, shape, kind = 'obstacle') {
    const opts = {
      isStatic: true,
      isSensor: true,
      label: 'prop',
      collisionFilter: { category: CAT.prop, mask: MASK.prop },
      shape: shape.circle ? { type: 'circle', radius: shape.circle } : { type: 'rectangle', width: shape.w, height: shape.h },
    };
    const img = this.matter.add.image(x, y, key, null, opts).setDepth(DEPTH.props);
    img.kind = kind;
    img.alive = true;
    this.props.add(img);
    return img;
  }

  spawnObstacle() {
    const W = this.scale.width;
    const b = this.bounds;
    const y = -70;
    const r = Math.random();
    if (r < 0.35) {
      const left = Math.random() < 0.5;
      const img = this.addProp(left ? 128 : W - 128, y, 'ledge', { w: 180, h: 58 });
      img.setFlipX(!left);
    } else if (r < 0.7) {
      const gapX = randInt(b.left + 50, b.right - 50);
      const gap = 170;
      this.addProp(gapX - gap / 2 - 118, y, 'licorice', { w: 236, h: 22 });
      this.addProp(gapX + gap / 2 + 118, y, 'licorice', { w: 236, h: 22 });
    } else {
      const n = randInt(1, 2);
      for (let k = 0; k < n; k++) {
        const x = randInt(b.left, b.right);
        const g = this.addProp(x, y - k * 110, `gumdrop${randInt(0, 2)}`, { circle: 27 });
        g.baseX = x;
        g.bob = rand(0, 6);
      }
    }
  }

  spawnPickup() {
    const gl = this.glider;
    const needBoost = TUNE.boostMax - gl.boosts;
    const needShake = TUNE.shakeMax - gl.shakes;
    const kind = needShake > needBoost ? 'shake' : needBoost > 0 ? 'boost' : Math.random() < 0.5 ? 'boost' : 'shake';
    const x = randInt(this.bounds.left, this.bounds.right);
    const img = this.addProp(x, -60, kind === 'boost' ? 'pk_boost' : 'pk_shake', { circle: 28 }, `pickup_${kind}`);
    img.baseX = x;
    img.bob = rand(0, 6);
  }

  // The distant boss lobs goo down the canyon at you (and the city).
  spawnGoo() {
    const b = this.bounds;
    const aimed = Math.random() < 0.45;
    const x = aimed ? Phaser.Math.Clamp(this.glider.x + rand(-50, 50), b.left, b.right) : randInt(b.left, b.right);
    this.goo.spawn(x, -30, rand(-30, 30), rand(40, 90));
    const arm = Math.random() < 0.5 ? this.distantRig.armL : this.distantRig.armR;
    const sgn = arm === this.distantRig.armL ? 1 : -1;
    this.tweens.add({ targets: arm, rotation: sgn * 2.6, duration: 200, yoyo: true, ease: 'Sine.easeOut' });
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
    if (!goo?.alive) return;
    const result = this.glider.applyGoo(goo.x, goo.gooAmt);
    if (result === 'ignored') return;
    this.goo.kill(goo);
    if (result === 'shielded') Sfx.pop();
    else {
      this.fx.drip.explode(6, goo.x, goo.y);
      this.run.stats.splats++;
    }
  }

  gliderHitsProp(prop) {
    if (!prop?.alive || this.ended) return;
    if (prop.kind.startsWith('pickup_')) {
      const kind = prop.kind.slice(7);
      this.glider.addCharge(kind);
      this.props.delete(prop);
      retire(this, prop);
      this.fx.spark.explode(10, prop.x, prop.y);
      Sfx.pickup();
      floatText(this, prop.x, prop.y - 30, kind === 'boost' ? '+1 BOOST' : '+1 SHAKE', '#ff5e8a');
      return;
    }
    if (this.glider.bonk(prop.x)) this.fx.spark.explode(6, this.glider.x, this.glider.y - 20);
  }

  gooLandsOnCity(m) {
    const b = this.city.addFrost(m.x, TUNE.frostPerGoo);
    this.fx.flake.explode(8, b.x + b.w / 2, this.city.top + 20);
    Sfx.frost();
  }

  onTier(tier, prev) {
    const order = ['clean', 'dusted', 'splattered', 'caked'];
    if (order.indexOf(tier) > order.indexOf(prev)) {
      Sfx.gooWorse(tier);
      floatText(this, this.glider.x, this.glider.y - 50, `${TIER_LABEL[tier]}!`, TIER_COLOR[tier], 24);
    }
  }

  syncRun() {
    this.run.boosts = this.glider.boosts;
    this.run.shakes = this.glider.shakes;
    this.run.frost = this.city.frost.slice();
  }

  arrive() {
    this.arriving = true;
    const { width: W } = this.scale;
    Sfx.arrive();
    this.hud.banner('THE CLOUD!', 'Meltdown time', 1400);
    this.goo.popAll(this.fx);
    this.glider.cleanAll();
    this.glider.autopilot = { x: W / 2, y: this.bounds.top + 80 };
    this.tweens.add({ targets: this.distant, scale: 0.9, y: 360, alpha: 1, duration: 1500, ease: 'Quad.easeIn' });
    this.time.delayedCall(1500, () => {
      this.syncRun();
      this.cameras.main.fadeOut(500, 255, 255, 255);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Boss'));
    });
  }

  lose(reason) {
    if (this.ended) return;
    this.ended = true;
    if (reason === 'frost') {
      this.city.freezeAll();
      this.hud.banner('CITY FROZEN!', '', 2000);
      Sfx.freeze();
    }
    Sfx.lose();
    this.syncRun();
    this.time.delayedCall(1400, () => {
      this.cameras.main.fadeOut(500, 40, 20, 50);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('End', { result: 'lose', reason, from: 'Flight' }));
    });
  }
}
