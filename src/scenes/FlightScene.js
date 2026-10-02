// Flight: into-the-horizon run down a candy valley toward the boss's cloud. A tiny pseudo-3D
// projector draws the valley and scales entities with depth, but all gameplay — steering,
// goo, beans, props, collisions — stays on the 2D screen plane exactly as before.
import * as Phaser from 'phaser';
import { DEPTH, G_PX, TIER_COLOR, TIER_LABEL, TUNE } from '../config.js';
import { Glider } from '../objects/Glider.js';
import { Beans, GooMallows } from '../objects/Projectiles.js';
import { City } from '../objects/City.js';
import { Controls } from '../objects/Controls.js';
import { Slingshot } from '../objects/Slingshot.js';
import { buildBossRig } from '../objects/MarshmallowMan.js';
import { Hud } from '../ui/Hud.js';
import { drawSky, floatText, flushTrash, makeFx, rand, randInt, routeCollisions } from '../ui/helpers.js';
import { Projector } from '../view/Projector.js';
import { Valley } from '../view/Valley.js';
import { PropPool, ShadowPool } from '../view/Pools.js';
import { Wind } from '../view/Wind.js';
import { Sfx } from '../sfx.js';

const FOCAL = 420;
const SPAWN_DEPTH = 6 * FOCAL; // props appear this far ahead…
const APPROACH_TIME = 4.2; // …and take this long to reach the glider's plane
const HOVER_DEPTH = 1.7 * FOCAL; // pickups drift here for a while before passing
const WALL_INSET = 40; // valley walls sit this far in from the screen edges at the glider's plane
const MAX_GOO = 10;
const KICK_DECAY = 0.9; // s: the slingshot's speed burst fades into cruise

export class FlightScene extends Phaser.Scene {
  constructor() {
    super('Flight');
  }

  create(data = {}) {
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
    this.nextArch = rand(8, 12); // first arch early, then every ~25–35 s
    this.pt = {};
    this.att = { bank: 0, pitch: 0 }; // eased visual attitude of the glider
    this.kick = 0; // launch speed burst: extra speed fraction, decaying to 0

    drawSky(this, [0xf9a8d4, 0xffc8e3, 0xffe3f0, 0xfff1f6]);
    this.city = new City(this, { height: 92, frost: this.run.frost });
    const horizonY = Math.round(H * 0.3);
    const bottom = this.city.top - 46;
    const planeY = bottom - 60; // glider's home row = the flight plane at depth FOCAL
    this.proj = new Projector({ cx: W / 2, horizonY, focal: FOCAL, planeH: planeY - horizonY });
    this.valley = new Valley(this, this.proj, {
      groundY: this.city.top - horizonY,
      halfWidth: W / 2 - WALL_INSET,
      bottomY: this.city.top,
    });
    this.speed = (SPAWN_DEPTH - FOCAL) / APPROACH_TIME; // world units per second
    this.wind = new Wind(this, this.proj, this.valley);

    // The boss sits on the horizon and grows with progress: he is the progress bar.
    this.distant = this.add.container(W / 2, horizonY).setDepth(DEPTH.distant);
    const dCloud = this.add.image(0, 40, 'bosscloud').setScale(0.9);
    const dRig = buildBossRig(this, 0, 0, 1);
    dRig.parts.forEach((p) => p.setTint(0xf2dcff));
    this.distant.add([dCloud, dRig.root]);
    this.distantRig = dRig;
    this.placeBoss();

    this.fx = makeFx(this);
    this.bounds = {
      left: WALL_INSET + 50,
      right: W - WALL_INSET - 50,
      top: horizonY + (planeY - horizonY) * 0.28,
      bottom,
    };
    this.glider = new Glider(this, W / 2, planeY, this.bounds, this.run, this.fx);
    this.beans = new Beans(this);
    this.goo = new GooMallows(this, { cityTop: this.city.top + 12, onCity: (m) => this.gooLandsOnCity(m) });
    this.beanViews = new ShadowPool(this, 16, DEPTH.beans);
    this.gooViews = new ShadowPool(this, MAX_GOO + 2, DEPTH.goo);
    this.beanScale = (y) => {
      const s = this.proj.planeScaleAt(y);
      return s < 0.06 ? 0 : Math.min(s, 1.2);
    };
    this.gooScale = (y) => Phaser.Math.Clamp(this.proj.planeScaleAt(y), 0.15, 1.25);
    this.propPool = new PropPool(this, {
      ledge: { shape: { type: 'rectangle', width: 180, height: 58 }, count: 4 },
      licorice: { shape: { type: 'rectangle', width: 236, height: 22 }, count: 8 },
      gumdrop0: { shape: { type: 'circle', radius: 27 }, count: 3 },
      gumdrop1: { shape: { type: 'circle', radius: 27 }, count: 3 },
      gumdrop2: { shape: { type: 'circle', radius: 27 }, count: 3 },
      pk_boost: { shape: { type: 'circle', radius: 28 }, count: 2 },
      pk_shake: { shape: { type: 'circle', radius: 28 }, count: 2 },
    });

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

    // Every flight opens in the slingshot; the valley holds still until the glider is flung.
    this.sling = new Slingshot(this, {
      glider: this.glider,
      x: W / 2,
      seatY: planeY - 54,
      homeY: planeY,
      apexY: this.bounds.top + 20,
      logoY: Math.min(H * 0.13, horizonY - 200), // keep the boss on the horizon in view below it
      title: !!data.title,
      onLaunch: (power) => this.launched(power),
    });
    this.hud.setShown(0);
    this.controls.enabled = false;
    this.cameras.main.fadeIn(400, 255, 255, 255);
  }

  // The fling doubles as a free first boost: a speed burst (stronger pull, bigger burst) that
  // decays into cruise and nudges progress along while it lasts.
  launched(power) {
    this.kick = 0.5 + power;
    this.time.delayedCall(250, () => {
      this.hud.banner('FLY!', 'Down the candy valley to his cloud', 1300);
      Sfx.start();
    });
  }

  placeBoss() {
    const s = Phaser.Math.Linear(0.22, 0.55, this.progress);
    this.distant.setScale(s).setY(this.proj.horizonY + this.proj.tilt - 40 * s); // cloud centre sits on the horizon
  }

  update(_time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    const W = this.scale.width;
    flushTrash(this);
    const sling = this.sling;
    if (sling) {
      sling.update(dt);
      this.hud.setShown(sling.hudAlpha);
      this.controls.enabled = !sling.holding;
      if (sling.gone) {
        this.sling = null;
        this.hud.setShown(1);
      }
    }
    const waiting = !!sling?.waiting; // still in the slingshot: the world holds still
    const holding = !!sling?.holding; // the sling (not the player) moves the glider
    this.kick *= Math.exp(-dt / KICK_DECAY);
    const boosting = this.glider.boostT > 0;
    const speed = waiting ? 0 : this.speed * (boosting ? 1.8 : 1) * (this.arriving ? 1.6 : 1) * (1 + this.kick);

    // Flight feel (visual only): ease a bank from lateral velocity and a pitch from vertical
    // velocity; the horizon dips on climbs and the camera leans into turns and bends.
    const gl = this.glider;
    const att = this.att;
    const bankTarget = gl.busy ? 0 : Phaser.Math.Clamp(gl.vx * 0.0012, -0.35, 0.35);
    const pitchTarget = gl.busy ? 0 : Phaser.Math.Clamp(-gl.vy / 450, -1, 1);
    att.bank += (bankTarget - att.bank) * Math.min(1, dt * 6);
    att.pitch += (pitchTarget - att.pitch) * Math.min(1, dt * 5);
    this.proj.tilt = att.pitch * 16;
    const sway = (gl.x - W / 2) * 0.12 + att.bank * 45 + this.valley.lean * 0.25;
    this.proj.camX += (sway - this.proj.camX) * Math.min(1, dt * 4);
    this.valley.update(dt, speed);
    const intensity = Phaser.Math.Clamp((speed / this.speed - 1) * 0.7 + 0.18 + Math.hypot(gl.vx, gl.vy) / 1400, 0, 1);
    if (!waiting) this.wind.update(dt, speed, intensity);
    this.updateProps(dt, speed);

    if (!holding) {
      this.controls.update(dt);
      gl.update(dt);
    }
    gl.setAttitude(att.bank, att.pitch);
    this.beans.update(dt);
    this.goo.update(dt);
    this.city.update(dt);

    this.beanViews.sync(this.beans.items, this.beanScale);
    this.gooViews.sync(this.goo.items, this.gooScale);
    // the boss is a far landmark: he slides with the camera's heading through bends
    this.distant.x = W / 2 - FOCAL * this.valley.s0 * 0.5 - this.proj.camX * 0.02;

    if (!this.ended && !this.arriving && !waiting) {
      this.elapsed += dt;
      this.progress = Math.min(1, this.progress + (dt * (boosting ? 1.6 : 1) * (1 + 0.6 * this.kick)) / TUNE.flightTime);
      this.spawn(dt);
      this.placeBoss();
      if (this.progress >= 1) this.arrive();
      if (this.city.total >= 1) this.lose('frost');
    }
    this.hud.progress = this.progress;
    this.hud.update();
    this.syncRun();
  }

  // Props live on the flight plane: they emerge at the horizon and sweep toward the camera.
  updateProps(dt, speed) {
    const H = this.scale.height;
    const t = this.pt;
    for (const p of this.props) {
      if (p.hover > 0 && p.pz <= HOVER_DEPTH) p.hover -= dt;
      else p.pz -= speed * dt;
      const bob = p.bob !== undefined ? Math.sin(this.elapsed * 2 + p.bob) * 14 : 0;
      this.proj.onPlane(p.xw + bob, p.pz, t);
      p.setPosition(t.x, t.y);
      if (Math.abs(p.scaleX - t.s) > 0.01) p.setScale(t.s);
      p.setAlpha(Phaser.Math.Clamp((SPAWN_DEPTH - p.pz) / (0.5 * FOCAL), 0, 1));
      p.setDepth(DEPTH.props + (1 - p.pz / SPAWN_DEPTH) * 0.9);
      if (t.y - 40 * t.s > H || p.pz < 0.3 * FOCAL) this.releaseProp(p);
    }
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
    if (this.elapsed >= this.nextArch) {
      this.valley.launchArch();
      this.nextArch = this.elapsed + rand(25, 35);
    }
  }

  // xw: world x on the flight plane (screen offset from centre when it reaches the glider).
  addProp(key, xw, pz = SPAWN_DEPTH, kind = 'obstacle') {
    const img = this.propPool.acquire(key);
    if (!img) return null; // pool exhausted = on-screen cap reached
    img.kind = kind;
    img.xw = xw;
    img.pz = pz;
    img.hover = 0;
    img.bob = undefined;
    this.props.add(img);
    return img;
  }

  releaseProp(p) {
    this.props.delete(p);
    this.propPool.release(p);
  }

  spawnObstacle() {
    const W = this.scale.width;
    const half = W / 2 - WALL_INSET;
    const r = Math.random();
    if (r < 0.35) {
      // sugar-cube ledge jutting out of a valley wall
      const left = Math.random() < 0.5;
      const img = this.addProp('ledge', (left ? -1 : 1) * (half - 90));
      img?.setFlipX(!left);
    } else if (r < 0.7) {
      // licorice gate: fly through the gap
      const b = this.bounds;
      const gapX = randInt(b.left + 50, b.right - 50) - W / 2;
      const gap = 170;
      this.addProp('licorice', gapX - gap / 2 - 118);
      this.addProp('licorice', gapX + gap / 2 + 118);
    } else {
      const n = randInt(1, 2);
      for (let k = 0; k < n; k++) {
        const g = this.addProp(`gumdrop${randInt(0, 2)}`, randInt(-half + 60, half - 60), SPAWN_DEPTH + k * 0.5 * FOCAL);
        if (g) g.bob = rand(0, 6);
      }
    }
  }

  // Pickups drift in to mid-depth and hover there before passing by.
  spawnPickup() {
    const gl = this.glider;
    const needBoost = TUNE.boostMax - gl.boosts;
    const needShake = TUNE.shakeMax - gl.shakes;
    const kind = needShake > needBoost ? 'shake' : needBoost > 0 ? 'boost' : Math.random() < 0.5 ? 'boost' : 'shake';
    const half = this.scale.width / 2 - WALL_INSET - 70;
    const img = this.addProp(kind === 'boost' ? 'pk_boost' : 'pk_shake', randInt(-half, half), SPAWN_DEPTH, `pickup_${kind}`);
    if (!img) return;
    img.bob = rand(0, 6);
    img.hover = 3.5;
  }

  // The boss lobs goo from his cloud on the horizon, at you or at the city.
  spawnGoo() {
    if (this.goo.items.size >= MAX_GOO) return;
    const s = this.distant.scale;
    const side = Math.random() < 0.5 ? -1 : 1;
    const x0 = this.distant.x + side * 100 * s;
    const y0 = this.distant.y - 250 * s;
    const T = rand(1.6, 2.2);
    let tx;
    let ty;
    if (Math.random() < 0.45) {
      tx = this.glider.x + this.glider.vx * T * 0.4;
      ty = this.glider.y;
    } else {
      tx = Phaser.Utils.Array.GetRandom(this.city.centers()).x;
      ty = this.city.top + 20;
    }
    this.goo.spawn(x0, y0, (tx - x0) / T, (ty - y0) / T - 0.5 * G_PX * T);
    const arm = side < 0 ? this.distantRig.armL : this.distantRig.armR;
    this.tweens.add({ targets: arm, rotation: -side * 2.6, duration: 200, yoyo: true, ease: 'Sine.easeOut' });
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
      this.fx.spark.explode(10, prop.x, prop.y);
      Sfx.pickup();
      floatText(this, prop.x, prop.y - 30, kind === 'boost' ? '+1 BOOST' : '+1 SHAKE', '#ff5e8a');
      this.releaseProp(prop);
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
    this.glider.autopilot = { x: W / 2, y: this.bounds.top + 40 };
    this.tweens.add({ targets: this.distant, scale: 1, y: this.proj.horizonY + 60, alpha: 1, duration: 1500, ease: 'Quad.easeIn' });
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
