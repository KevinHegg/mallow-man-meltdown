// The opening toy moment. Every flight starts with the glider sitting in a candy slingshot:
// drag back anywhere to stretch the frosting bands and aim, let go to fling it into the valley.
// A plain tap (or Space/Enter) launches at a default pull. Driven by the scene's dt, and gone
// about a second after launch: the sling falls behind as the valley streams forward.
import * as Phaser from 'phaser';
import { DEPTH, PAL } from '../config.js';
import { FROST_PINK, FROST_PINK_EDGE, SLING } from '../art/textures.js';
import { txt } from '../ui/helpers.js';
import { Sfx } from '../sfx.js';

const Ease = Phaser.Math.Easing;
const clamp = Phaser.Math.Clamp;
const lerp = Phaser.Math.Linear;

const MAX_PULL = 150; // px of downward drag for a full stretch
const MAX_AIM = 90; // px of sideways drag for full aim
const AIM_SHIFT = 0.7; // the pouch follows this much of the sideways drag
const AIM_X = 110; // a full aim sends the glider this far off-centre
const TAP_MOVE = 14; // a press that moves less than this is a tap
const DEFAULT_POWER = 0.7; // a tap's pull
const MIN_POWER = 0.45; // even a feeble pull launches properly
const SAG = 18; // the pouch hangs this far below the fork tips
const SEAT = 44; // the glider's centre sits this far above the pouch (the pouch cradles its tail)
const POUCH_W = 16; // half-width of the frosting pouch
const BAND_W = 11; // band thickness at rest (thins as it stretches)
const AUTO_PULL = 0.14; // s: a tap's quick automatic draw
const FLING_OUT = 0.22; // s: out to the apex…
const FLING_END = 0.85; // …then glide down onto the cruise row and hand over control
const APEX_SCALE = 0.72; // the glider shrinks as it shoots away from the camera
const RECEDE_DELAY = 0.08;
const RECEDE_TIME = 0.75;
const SPRING_K = 700; // the pouch snaps back and wobbles after release
const SPRING_C = 11;
const SPRINKLES = [0xff5e8a, 0xffc94d, 0x7ad9a6, 0x5ec8ff, 0x9a7bff];

export class Slingshot {
  // seatY: the glider's centre at rest; homeY: its cruise row; apexY: highest point of the fling;
  // logoY: where the title sits (above the boss on the horizon), shown only when `title` is set.
  constructor(scene, { glider, x, seatY, homeY, apexY, logoY, title = false, onLaunch }) {
    this.scene = scene;
    this.glider = glider;
    this.x = x;
    this.y = seatY + SEAT - SAG; // the fork tips' row
    this.seatY = seatY;
    this.homeY = homeY;
    this.apexY = apexY;
    this.onLaunch = onLaunch;
    this.phase = 'ready'; // ready → pull (drag or tap) → fling → gone
    this.t = 0;
    this.pull = 0; // pouch offset below rest
    this.side = 0; // pouch offset sideways
    this.vPull = 0;
    this.vSide = 0;
    this.tease = 0; // idle demo pull
    this.tick = 0;
    this.pointer = null;
    this.auto = false;
    this.handed = false;
    this.wob = 0;
    this.hudAlpha = 0;
    this.restLen = Math.hypot(SLING.span / 2 - POUCH_W, SAG);

    this.root = scene.add.container(x, this.y).setDepth(DEPTH.glider - 0.5);
    this.frame = scene.add.image(0, 0, 'sling').setOrigin(0.5, SLING.tipY / SLING.h);
    this.bands = scene.add.graphics();
    this.root.add([this.frame, this.bands]);
    glider.autopilot = { x, y: homeY }; // not steerable (or able to fire) until the hand-over
    this.seat();

    this.texts = this.makeTexts(title, logoY);

    const input = scene.input;
    this.onDown = (p, over) => {
      if (over.length || this.phase !== 'ready') return; // the mute button handles itself
      Sfx.unlock();
      this.pointer = { id: p.id, x: p.x, y: p.y, moved: 0 };
      this.phase = 'pull';
      this.t = 0;
    };
    this.onMove = (p) => {
      const q = this.pointer;
      if (!q || p.id !== q.id || this.auto) return;
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      q.moved = Math.max(q.moved, Math.hypot(dx, dy));
      this.pull = clamp(dy, 0, MAX_PULL);
      this.side = clamp(dx, -MAX_AIM, MAX_AIM) * AIM_SHIFT;
    };
    this.onUp = (p) => {
      const q = this.pointer;
      if (!q || p.id !== q.id) return;
      this.pointer = null;
      if (q.moved < TAP_MOVE) this.tap();
      else this.launch(this.power());
    };
    this.onKey = () => {
      if (this.phase !== 'ready') return;
      Sfx.unlock();
      this.phase = 'pull';
      this.tap();
    };
    input.on('pointerdown', this.onDown);
    input.on('pointermove', this.onMove);
    input.on('pointerup', this.onUp);
    input.on('pointerupoutside', this.onUp);
    this.keys = ['keydown-SPACE', 'keydown-ENTER', 'keydown-UP', 'keydown-W'];
    for (const k of this.keys) input.keyboard?.on(k, this.onKey);
  }

  get waiting() {
    return this.phase === 'ready' || this.phase === 'pull';
  }

  get holding() {
    return this.phase !== 'gone' && !this.handed;
  }

  get gone() {
    return this.phase === 'gone';
  }

  makeTexts(title, logoY) {
    const scene = this.scene;
    const W = scene.scale.width;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const out = [];
    const top = this.seatY;
    const hint = txt(scene, W / 2, top - 118, coarse ? 'PULL BACK & LET GO!' : 'DRAG BACK & LET GO!', 30, '#ffffff', {
      stroke: PAL.inkHex,
      strokeThickness: 9,
    });
    const sub = txt(scene, W / 2, top - 84, 'or just tap to launch', 16, PAL.inkHex);
    scene.tweens.add({ targets: hint, scale: 1.07, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    out.push(hint, sub);
    if (title) {
      const t1 = txt(scene, W / 2, logoY, 'MALLOW MAN', 58, '#ff6f9f', { stroke: PAL.inkHex, strokeThickness: 12 });
      const t2 = txt(scene, W / 2, logoY + 66, 'MELTDOWN', 64, '#9be7ff', { stroke: PAL.inkHex, strokeThickness: 12 });
      [t1, t2].forEach((t) => t.setShadow(0, 6, PAL.inkHex, 0, true, true));
      scene.tweens.add({ targets: t2, angle: { from: -2, to: 2 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const help = coarse
        ? 'Drag to steer  •  Tap to fire jelly beans\nBOOST sheds goo  •  SHAKE cleans it all'
        : 'Drag or arrows/WASD to steer  •  Click/Space to fire\nZ = Bubble Boost  •  X = Shake';
      out.push(t1, t2, txt(scene, W / 2, top - 168, help, 16, PAL.inkHex, { lineSpacing: 6 }));
    }
    out.forEach((t) => t.setDepth(DEPTH.hud));
    return out;
  }

  // Pull → launch power; a feeble or sideways-only drag still launches at the default.
  power() {
    return this.pull < 20 ? DEFAULT_POWER : Math.max(MIN_POWER, this.pull / MAX_PULL);
  }

  tap() {
    this.auto = true;
    this.t = 0;
    this.autoFrom = this.pull;
  }

  launch(power) {
    this.phase = 'fling';
    this.t = 0;
    this.launchPower = power;
    const aim = -this.side / (MAX_AIM * AIM_SHIFT); // pulled left → flies right
    const g = this.glider;
    this.from = { x: g.x, y: g.y, s: this.seatScale, r: this.seatRot };
    this.apex = { x: this.x + aim * AIM_X * 0.6, y: Math.max(this.apexY, this.seatY - (150 + 170 * power)) };
    this.end = { x: this.x + aim * AIM_X, y: this.homeY };
    this.vPull = 0;
    this.vSide = 0;
    Sfx.boing(power);
    g.bubbleBurst(0.6);
    this.scene.cameras.main.shake(120, 0.003 + 0.004 * power);
    for (const t of this.texts) {
      this.scene.tweens.killTweensOf(t);
      this.scene.tweens.add({ targets: t, alpha: 0, y: t.y - 40, duration: 300, ease: 'Quad.easeIn', onComplete: () => t.destroy() });
    }
    this.onLaunch?.(power);
  }

  update(dt) {
    if (this.phase === 'gone') return;
    this.t += dt;
    if (this.phase === 'ready') {
      // idle: every few seconds the pouch draws back a little and snaps, to show it stretches
      this.tease = (this.tease + dt) % 2.6;
      const u = this.tease - 1.2;
      const target = u > 0 && u < 0.7 ? 26 * Ease.Sine.InOut(u / 0.7) : 0;
      this.spring(dt, target);
      this.seat();
    } else if (this.phase === 'pull') {
      if (this.auto) {
        const u = Math.min(1, this.t / AUTO_PULL);
        this.pull = lerp(this.autoFrom, DEFAULT_POWER * MAX_PULL, Ease.Quadratic.Out(u));
        if (u >= 1) {
          this.auto = false;
          this.seat();
          this.launch(DEFAULT_POWER);
        }
      }
      if (this.phase === 'pull') {
        const step = Math.floor(this.pull / 18);
        if (step > this.tick) Sfx.stretch(this.pull / MAX_PULL);
        this.tick = step;
        this.seat();
      }
    }
    if (this.phase === 'fling') this.fling(dt);
    if (this.phase !== 'gone') this.draw();
  }

  // Semi-implicit spring for the pouch (stable at the scene's capped dt).
  spring(dt, target = 0) {
    this.vPull += (-SPRING_K * (this.pull - target) - SPRING_C * this.vPull) * dt;
    this.vSide += (-SPRING_K * this.side - SPRING_C * this.vSide) * dt;
    this.pull += this.vPull * dt;
    this.side += this.vSide * dt;
  }

  // The glider sits in the pouch: drawn back toward the camera (bigger) and tilted to the aim.
  seat() {
    const k = clamp(this.pull / MAX_PULL, 0, 1);
    this.seatScale = 1 + 0.15 * k;
    this.seatRot = (-this.side / (MAX_AIM * AIM_SHIFT)) * 0.28;
    this.glider.hold(this.x + this.side, this.y + SAG + this.pull - SEAT, this.seatRot, this.seatScale);
  }

  fling(dt) {
    const t = this.t;
    const g = this.glider;
    if (!this.handed) {
      const { from, apex, end } = this;
      let x;
      let y;
      let s;
      let r;
      if (t < FLING_OUT) {
        const e = Ease.Quadratic.Out(t / FLING_OUT);
        x = lerp(from.x, apex.x, e);
        y = lerp(from.y, apex.y, e);
        s = lerp(from.s, APEX_SCALE, e);
        r = from.r;
      } else {
        const e = Ease.Sine.InOut(Math.min(1, (t - FLING_OUT) / (FLING_END - FLING_OUT)));
        x = lerp(apex.x, end.x, e);
        y = lerp(apex.y, end.y, e);
        s = lerp(APEX_SCALE, 1, e);
        r = from.r * (1 - e);
      }
      g.hold(x, y, r, s, dt > 0 ? (x - g.x) / dt : 0, dt > 0 ? (y - g.y) / dt : 0);
      if (t >= FLING_END) {
        g.release();
        this.handed = true;
      }
    }
    this.spring(dt);
    // the frame jiggles from the snap, then falls behind as the valley rushes forward
    this.wob += dt;
    const jig = 0.07 * this.launchPower * Math.sin(this.wob * 34) * Math.exp(-this.wob * 6);
    this.frame.setScale(1 + jig, 1 - jig * 0.7);
    const r = clamp((t - RECEDE_DELAY) / RECEDE_TIME, 0, 1);
    const e = Ease.Quadratic.In(r);
    this.root
      .setPosition(this.x, this.y + 340 * e)
      .setScale(1 + 0.5 * e)
      .setAlpha(1 - clamp((r - 0.45) / 0.55, 0, 1));
    this.hudAlpha = clamp((t - 0.3) / 0.4, 0, 1);
    if (r >= 1 && this.handed) this.destroy();
  }

  draw() {
    const g = this.bands;
    g.clear();
    const px = this.side;
    const py = SAG + this.pull;
    const tip = SLING.span / 2;
    this.band(g, -tip, 0, px - POUCH_W, py);
    this.band(g, tip, 0, px + POUCH_W, py);
    // knots where the bands tie onto the forks
    for (const x of [-tip, tip]) {
      g.fillStyle(FROST_PINK_EDGE, 1);
      g.fillCircle(x, 1, 8);
      g.fillStyle(FROST_PINK, 1);
      g.fillCircle(x - 1, 0, 6);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(x - 3, -2, 2);
    }
    // the pouch: a frosting cradle under the glider's tail
    g.fillStyle(PAL.ink, 1);
    g.fillEllipse(px, py + 2, POUCH_W * 2 + 12, 17);
    g.fillStyle(FROST_PINK_EDGE, 1);
    g.fillEllipse(px, py + 1, POUCH_W * 2 + 6, 12);
    g.fillStyle(FROST_PINK, 1);
    g.fillEllipse(px - 2, py - 1, POUCH_W * 2 - 2, 7);
    g.fillStyle(0xffffff, 0.9);
    g.fillEllipse(px - 8, py - 2, 9, 3);
    if (this.phase === 'pull' && this.pull > 6) this.drawAim(g);
  }

  // A frosting band: dark edge, glossy pink body and highlight, beads that spread as it stretches.
  band(g, x0, y0, x1, y1) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const w = clamp(BAND_W * Math.sqrt(this.restLen / Math.max(1, len)), 4.5, 14);
    g.lineStyle(w + 5, PAL.ink, 1);
    g.lineBetween(x0, y0, x1, y1);
    g.lineStyle(w, FROST_PINK_EDGE, 1);
    g.lineBetween(x0, y0, x1, y1);
    g.lineStyle(w * 0.55, FROST_PINK, 1);
    g.lineBetween(x0, y0 - w * 0.15, x1, y1 - w * 0.15);
    g.lineStyle(Math.max(1.5, w * 0.2), 0xffffff, 0.85);
    g.lineBetween(x0, y0 - w * 0.3, x1, y1 - w * 0.3);
    for (const f of [0.3, 0.55, 0.8]) {
      const bx = lerp(x0, x1, f);
      const by = lerp(y0, y1, f);
      const r = w * 0.62;
      g.fillStyle(FROST_PINK_EDGE, 1);
      g.fillCircle(bx, by, r + 1.5);
      g.fillStyle(FROST_PINK, 1);
      g.fillCircle(bx - r * 0.1, by - r * 0.12, r);
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(bx - r * 0.35, by - r * 0.4, Math.max(1, r * 0.3));
    }
  }

  // Sprinkle dots from the glider's nose to where the fling will peak: aim and power at a glance.
  drawAim(g) {
    const power = this.power();
    const aim = -this.side / (MAX_AIM * AIM_SHIFT);
    const gl = this.glider;
    const nx = gl.x - this.x;
    const ny = gl.y - 46 * this.seatScale - this.y;
    const ax = aim * AIM_X * 0.6;
    const ay = Math.max(this.apexY, this.seatY - (150 + 170 * power)) - this.y;
    const cx = nx;
    const cy = lerp(ny, ay, 0.5);
    for (let i = 1; i <= 8; i++) {
      const t = i / 8.5;
      const u = 1 - t;
      const x = u * u * nx + 2 * u * t * cx + t * t * ax;
      const y = u * u * ny + 2 * u * t * cy + t * t * ay;
      const r = 8.5 - i * 0.6;
      const a = 1 - i * 0.07;
      g.fillStyle(PAL.ink, 0.55 * a);
      g.fillCircle(x, y + 1, r + 2);
      g.fillStyle(SPRINKLES[i % SPRINKLES.length], a);
      g.fillCircle(x, y, r);
      g.fillStyle(0xffffff, 0.8 * a);
      g.fillCircle(x - r * 0.3, y - r * 0.35, r * 0.3);
    }
  }

  destroy() {
    this.phase = 'gone';
    const input = this.scene.input;
    input.off('pointerdown', this.onDown);
    input.off('pointermove', this.onMove);
    input.off('pointerup', this.onUp);
    input.off('pointerupoutside', this.onUp);
    for (const k of this.keys) input.keyboard?.off(k, this.onKey);
    this.root.destroy();
  }
}
