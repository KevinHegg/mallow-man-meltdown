// Altitude gameplay for the flight. Valley-spanning obstacles that care how high you fly:
//  - gates: a striped candy-cane bar above the glider's ceiling with a candy curtain hanging down
//    to a hang line. Everything above the line is blocked: dive under.
//  - banks: a sticky pink frosting mass floating low. Everything below its top line is blocked:
//    climb over. Touching one goos the glider like a goo-mallow hit.
// Each is drawn in the projected valley and tested once, at the moment it passes the glider's
// depth, against where its line is on screen right then (what you see is what you hit).
// Thermals are candy-cane columns of rising air: overlap one on screen while it passes your depth
// and it lifts you and makes goo drip off faster. Everything is pooled.
import * as Phaser from 'phaser';
import { DEPTH } from '../config.js';

const clamp = Phaser.Math.Clamp;
const HALF_H = 18; // half the glider's hitbox height, for the band test
const GRACE = 4; // px of overlap forgiven at the crossing
const WARN = 1.4; // s before a crossing that the cue shows (if you're in the blocked band)
const FADE_PAST = 0.3; // obstacles fade out over this many focal lengths after passing you
const THERMAL_W = 140; // column width (world units)
const THERMAL_RIDE = 0.6; // the column is "at your depth" within ± this many focal lengths
const GATE_TEX_W = 512;

export class Heights {
  constructor(scene, proj, valley, { bounds, halfWidth, groundY, spawnDepth, onGate, onBank }) {
    this.scene = scene;
    this.proj = proj;
    this.valley = valley;
    this.f = proj.focal;
    this.spawnDepth = spawnDepth;
    this.topW = bounds.top - proj.horizonY; // the glider's ceiling and floor in world y at its depth
    this.botW = bounds.bottom - proj.horizonY;
    this.halfWidth = halfWidth;
    this.groundY = groundY;
    this.onGate = onGate;
    this.onBank = onBank;
    this.pt = {};
    this.inThermal = false;
    this.stats = { gates: 0, gateHits: 0, banks: 0, bankHits: 0, thermals: 0, thermalTime: 0 };

    this.obstacles = [];
    for (let i = 0; i < 3; i++) this.obstacles.push(this.makeGate(), this.makeBank());
    this.thermals = [this.makeThermal(), this.makeThermal()];
    this.cue = scene.add.image(0, 0, 'chev').setDepth(DEPTH.glider + 0.5).setScale(1.1).setVisible(false);
    this.lift = scene.add
      .particles(0, 0, 'spark', {
        emitting: false,
        maxAliveParticles: 24,
        lifespan: 700,
        speedX: { min: -30, max: 30 },
        speedY: { min: -220, max: -120 },
        scale: { start: 0.8, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [0xffffff, 0xffc6dc, 0xff5e8a],
      })
      .setDepth(DEPTH.fx);
  }

  makeGate() {
    const s = this.scene;
    const hw = this.halfWidth + 14;
    const c = s.add.container(0, 0).setVisible(false);
    const strands = s.add.image(0, 0, 'gate_strands').setOrigin(0.5, 0);
    const tips = s.add.image(0, 0, 'gate_tips').setOrigin(0.5, 1);
    const legL = s.add.image(-hw, this.groundY, 'gate_leg').setOrigin(0.5, 1);
    const legR = s.add.image(hw, this.groundY, 'gate_leg').setOrigin(0.5, 1).setFlipX(true);
    const bar = s.add.image(0, 0, 'gate_bar');
    c.add([strands, tips, legL, legR, bar]);
    return { kind: 'gate', c, strands, tips, legL, legR, bar, z: 0, y: 0, active: false };
  }

  makeBank() {
    const s = this.scene;
    const c = s.add.container(0, 0).setVisible(false);
    const shadow = s.add.image(0, this.groundY, 'bank_shadow').setDisplaySize(2 * this.halfWidth, 40);
    const body = s.add.image(0, 0, 'bank').setOrigin(0.5, 8 / 256);
    c.add([shadow, body]);
    return { kind: 'bank', c, body, z: 0, y: 0, active: false };
  }

  makeThermal() {
    const s = this.scene;
    const c = s.add.container(0, 0).setVisible(false);
    const col = s.add.tileSprite(0, this.groundY, THERMAL_W, 1500, 'thermal').setOrigin(0.5, 1);
    const vent = s.add.image(0, this.groundY, 'thermal_vent');
    c.add([col, vent]);
    return { c, col, vent, z: 0, xw: 0, active: false, inside: false };
  }

  get activeCount() {
    let n = 0;
    for (const o of this.obstacles) if (o.active) n++;
    return n;
  }

  // a: how far down the glider's height range the curtain hangs (0 = ceiling, 1 = floor).
  spawnGate(a) {
    const g = this.obstacles.find((o) => o.kind === 'gate' && !o.active);
    if (!g) return false;
    const yHang = this.topW + a * (this.botW - this.topW);
    const yBar = this.topW - 70; // the bar sits above the ceiling: there is no going over
    const span = 2 * (this.halfWidth + 14);
    g.bar.setPosition(0, yBar).setScale((span + 40) / GATE_TEX_W, 1);
    const legScale = (this.groundY - yBar) / 256;
    g.legL.setScale(1, legScale);
    g.legR.setScale(1, legScale);
    const s0 = yBar + 18;
    const s1 = yHang - 34;
    g.strands.setPosition(0, s0).setScale((span - 24) / GATE_TEX_W, Math.max(0.05, (s1 - s0) / 64));
    g.tips.setPosition(0, yHang).setScale((span - 24) / GATE_TEX_W, 1);
    this.launch(g, yHang);
    this.stats.gates++;
    return true;
  }

  // b: where the bank's top line sits in the glider's height range (0 = ceiling, 1 = floor).
  spawnBank(b) {
    const k = this.obstacles.find((o) => o.kind === 'bank' && !o.active);
    if (!k) return false;
    const yTop = this.topW + b * (this.botW - this.topW);
    const yBot = this.groundY - 12; // floats just above the ground: there is no going under
    k.body.setPosition(0, yTop).setScale((2 * this.halfWidth + 20) / 512, (yBot - yTop) / 248);
    this.launch(k, yTop);
    this.stats.banks++;
    return true;
  }

  launch(o, y) {
    o.y = y;
    o.z = this.spawnDepth;
    o.active = true;
    o.c.setVisible(true).setAlpha(0);
  }

  spawnThermal(xw) {
    const t = this.thermals.find((th) => !th.active);
    if (!t) return false;
    t.xw = xw;
    t.z = this.spawnDepth;
    t.active = true;
    t.inside = false;
    t.c.setVisible(true).setAlpha(0);
    this.stats.thermals++;
    return true;
  }

  // Is the glider in this obstacle's blocked band, judged against its line's screen row at the
  // glider's depth?
  blocked(o, gl, hz) {
    const line = hz + o.y;
    return o.kind === 'gate' ? gl.y - HALF_H < line - GRACE : gl.y + HALF_H > line + GRACE;
  }

  update(dt, speed, gl, steerable) {
    const p = this.proj;
    const f = this.f;
    const t = this.pt;
    const hz = p.horizonY + p.tilt;
    let cue = null;
    let cueEta = Infinity;

    for (const o of this.obstacles) {
      if (!o.active) continue;
      const prev = o.z;
      o.z -= speed * dt;
      if (prev > f && o.z <= f && steerable && this.blocked(o, gl, hz)) {
        // the one test: it is passing the glider's depth right now
        if (o.kind === 'gate') {
          this.stats.gateHits++;
          this.onGate(o);
        } else {
          this.stats.bankHits++;
          this.onBank(o);
        }
      }
      if (o.z < f * (1 - FADE_PAST)) {
        o.active = false;
        o.c.setVisible(false);
        continue;
      }
      p.project(this.valley.bend(o.z), 0, o.z, t);
      const fadeIn = clamp((this.spawnDepth - o.z) / (0.5 * f), 0, 1);
      const fadeOut = o.z < f ? clamp((o.z - f * (1 - FADE_PAST)) / (f * FADE_PAST), 0, 1) : 1;
      o.c
        .setPosition(t.x, t.y)
        .setScale(t.s)
        .setAlpha(fadeIn * fadeOut)
        .setDepth(o.z < f ? DEPTH.glider + 1 : DEPTH.props + (1 - o.z / this.spawnDepth) * 0.9);
      if (o.z > f && speed > 0 && steerable) {
        const eta = (o.z - f) / speed;
        if (eta < WARN && eta < cueEta && this.blocked(o, gl, hz)) {
          cue = o;
          cueEta = eta;
        }
      }
    }

    // the cue: a pulsing chevron pointing to the safe side while you're in the way
    if (cue) {
      const down = cue.kind === 'gate';
      const bob = Math.sin(this.scene.time.now / 90) * 5;
      this.cue
        .setVisible(true)
        .setFlipY(!down)
        .setPosition(gl.x, gl.y + (down ? 66 + bob : -66 - bob))
        .setAlpha(0.65 + 0.35 * Math.sin(this.scene.time.now / 70));
    } else this.cue.setVisible(false);

    this.inThermal = false;
    for (const th of this.thermals) {
      if (!th.active) continue;
      th.z -= speed * dt;
      if (th.z < 0.35 * f) {
        th.active = false;
        th.c.setVisible(false);
        continue;
      }
      p.project(th.xw + this.valley.bend(th.z), 0, th.z, t);
      const fadeIn = clamp((this.spawnDepth - th.z) / (0.6 * f), 0, 1);
      const fadeOut = clamp((th.z - 0.35 * f) / (0.3 * f), 0, 1);
      th.c
        .setPosition(t.x, t.y)
        .setScale(t.s)
        .setAlpha(fadeIn * fadeOut)
        .setDepth(DEPTH.props - 0.5 + (1 - th.z / this.spawnDepth) * 0.4);
      th.col.tilePositionY += dt * 110; // stripes rising
      // inside: the column is near your depth and you overlap it on screen (beside it and above
      // its vent, which sits higher on screen while the column is still ahead of you)
      const ventY = t.y + this.groundY * t.s;
      th.inside =
        steerable && Math.abs(th.z - f) < THERMAL_RIDE * f && Math.abs(gl.x - t.x) < (THERMAL_W / 2) * t.s && gl.y < ventY;
      if (th.inside) this.inThermal = true;
    }
    if (this.inThermal) {
      this.stats.thermalTime += dt;
      if (Math.random() < dt * 30) this.lift.emitParticleAt(gl.x + Phaser.Math.Between(-40, 40), gl.y + Phaser.Math.Between(-10, 30));
    }
  }
}
