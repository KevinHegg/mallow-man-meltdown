import * as Phaser from 'phaser';
import { DEPTH, PAL, TIER_COLOR, TIER_LABEL, TUNE } from '../config.js';
import { makeMuteButton, txt } from './helpers.js';
import { Sfx } from '../sfx.js';

const D = DEPTH.hud;

// Where the rooftop's controls sit, with how far each reaches (plate, shadow, pips, label): the
// roof's facade keeps its windows clear of these.
export function roofSlots(W, H) {
  const y = H - 74;
  return {
    jar: { x: 62, y, rx: 34, up: 50, down: 52 },
    fling: { x: W - 166, y, rx: 52, up: 50, down: 58 },
    shake: { x: W - 62, y, rx: 52, up: 70, down: 58 },
  };
}

// No HUD bars (DESIGN.md: "the world is the interface"): progress is the boss growing on the
// horizon, his health is his melting body. What's left: the goo and frost chips, the cleanse
// buttons, banners and warnings.
export class Hud {
  // mode: 'flight' (glider: BOOST + SHAKE) | 'roof' (pilot on foot: SHAKE only)
  constructor(scene, { mode, glider, city, onBoost, onShake, onFling }) {
    this.scene = scene;
    this.mode = mode;
    this.glider = glider;
    this.city = city;
    const { width: W, height: H } = scene.scale;
    this.W = W;

    makeMuteButton(scene, W - 34, 32);
    this.gooChip = this.chip(14, 18, 'left');
    this.frostChip = this.chip(W - 62, 18, 'right');

    const btnY = mode === 'roof' ? H - 74 : city.top - 64;
    const slots = roofSlots(W, H);
    this.boostBtn = mode === 'roof' ? null : this.actionButton(62, btnY, 'pk_boost', 'BOOST', onBoost);
    this.shakeBtn = this.actionButton(W - 62, btnY, 'pk_shake', 'SHAKE', onShake);
    // on foot: FLING (your goo is ammo) beside SHAKE, and the bean hopper's jar where BOOST was
    this.flingBtn = mode === 'roof' ? this.actionButton(slots.fling.x, btnY, 'pk_fling', 'FLING', onFling) : null;
    this.buttons = [this.boostBtn, this.flingBtn, this.shakeBtn].filter(Boolean);
    this.hopper = mode === 'roof' ? this.hopperMeter(slots.jar.x, btnY) : null;

    this.bannerTitle = txt(scene, W / 2, H * 0.4, '', 46, '#ff5e8a', { stroke: PAL.inkHex, strokeThickness: 10 })
      .setDepth(D + 5)
      .setVisible(false);
    this.bannerSub = txt(scene, W / 2, H * 0.4 + 48, '', 20, PAL.inkHex).setDepth(D + 5).setVisible(false);
    this.warn = txt(scene, W / 2, city.top - 150, 'TOO GOOEY!', 34, '#ffffff', { stroke: '#d8364f', strokeThickness: 10 })
      .setDepth(D + 4)
      .setVisible(false);
    this.warnSub = txt(scene, W / 2, city.top - 114, 'No cleanses left — drip it off!', 16, '#d8364f').setDepth(D + 4).setVisible(false);
    this.lastWarnBeep = 0;
    this.vignette = this.makeVignette(W, H);
    this.lastNow = scene.time.now;
    this.shown = 1;
    this.chrome = [this.gooChip.g, this.gooChip.t, this.frostChip.g, this.frostChip.t];
    this.update();
  }

  // Fades the HUD chrome (0 hidden … 1 shown). The BOOST/SHAKE buttons ignore presses while
  // hidden, so a gesture that starts where they will appear never triggers them.
  setShown(v) {
    if (v === this.shown) return;
    this.shown = v;
    for (const o of this.chrome) o.setAlpha(v);
    for (const btn of this.buttons) {
      btn.pips.setAlpha(v);
      btn.alpha = null;
      btn.zone.input.enabled = v > 0.5;
    }
    if (this.hopper) for (const o of [this.hopper.g, this.hopper.lab]) o.setAlpha(v);
  }

  // Soft green glow around the screen edges, baked once per screen size; pulses while CAKED.
  makeVignette(W, H) {
    const key = `vignette_${W}x${H}`;
    if (!this.scene.textures.exists(key)) {
      const g = this.scene.add.graphics();
      const step = 6;
      const bands = 16;
      for (let i = 0; i < bands; i++) {
        const a = 0.42 * Math.pow(1 - i / bands, 2);
        const o = i * step;
        g.fillStyle(0x5fd35a, a);
        g.fillRect(o, o, W - 2 * o, step);
        g.fillRect(o, H - o - step, W - 2 * o, step);
        g.fillRect(o, o + step, step, H - 2 * o - 2 * step);
        g.fillRect(W - o - step, o + step, step, H - 2 * o - 2 * step);
      }
      g.generateTexture(key, W, H);
      g.destroy();
    }
    return this.scene.add.image(W / 2, H / 2, key).setDepth(D - 2).setAlpha(0);
  }

  chip(x, y, align) {
    const g = this.scene.add.graphics().setDepth(D);
    const t = txt(this.scene, x, y + 14, '', 14, '#ffffff', { strokeThickness: 0 })
      .setOrigin(align === 'left' ? 0 : 1, 0.5)
      .setDepth(D + 1);
    return { g, t, x, y, align };
  }

  setChip(chip, label, color) {
    const key = `${label}|${color}`;
    if (chip.key === key) return;
    chip.key = key;
    chip.t.setText(label);
    const w = chip.t.width + 24;
    const x = chip.align === 'left' ? chip.x : chip.x - w;
    chip.t.setX(chip.align === 'left' ? chip.x + 12 : chip.x - 12);
    chip.g.clear();
    chip.g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 0.95);
    chip.g.fillRoundedRect(x, chip.y, w, 28, 14);
    chip.g.lineStyle(2, PAL.ink, 0.8);
    chip.g.strokeRoundedRect(x, chip.y, w, 28, 14);
  }

  // Interactive controls are drawn solid in every state (opaque plate, drop shadow, thick ink
  // rim) at the top of the draw order, so no art behind them can ever show through or hide them.
  actionButton(x, y, icon, label, onPress) {
    const scene = this.scene;
    const r = 42;
    const bg = scene.add.graphics({ x, y }).setDepth(D);
    const img = scene.add.image(x, y - 6, icon).setScale(0.82).setDepth(D + 1);
    const lab = txt(scene, x, y + r - 9, label, 12, PAL.inkHex, { strokeThickness: 4 }).setDepth(D + 2);
    const pips = scene.add.graphics({ x, y: y - r - 13 }).setDepth(D + 1);
    const hit = r * 1.2;
    const zone = scene.add
      .zone(x, y, hit * 2, hit * 2)
      .setInteractive(new Phaser.Geom.Circle(hit, hit, hit), Phaser.Geom.Circle.Contains)
      .setDepth(D + 3);
    zone.on('pointerdown', () => {
      Sfx.unlock();
      if (onPress()) {
        scene.tweens.add({ targets: [bg, img], scale: '*=0.85', duration: 70, yoyo: true });
      }
    });
    const btn = { bg, img, lab, pips, zone, x, y, r, count: -1, usable: null, alpha: null };
    this.drawPlate(btn, true);
    return btn;
  }

  drawPlate(btn, usable) {
    const { bg, r } = btn;
    bg.clear();
    bg.fillStyle(PAL.ink, 0.3);
    bg.fillCircle(0, 4, r + 3);
    bg.fillStyle(usable ? 0xffffff : 0xece6ef, 1);
    bg.fillCircle(0, 0, r);
    bg.fillStyle(usable ? 0xfff0f7 : 0xe2dbe6, 1);
    bg.fillCircle(0, r * 0.18, r * 0.8);
    bg.lineStyle(5, PAL.ink, 1);
    bg.strokeCircle(0, 0, r);
  }

  // Charges as big pips on a dark pill, so they read against any background.
  drawPips(btn, count, max) {
    const g = btn.pips;
    const gap = 21;
    const w = (max - 1) * gap + 24;
    g.clear();
    g.fillStyle(PAL.ink, 0.88);
    g.fillRoundedRect(-w / 2, -11, w, 22, 11);
    for (let i = 0; i < max; i++) {
      const px = (i - (max - 1) / 2) * gap;
      const full = i < count;
      g.fillStyle(full ? 0xff5e8a : 0x8a6f86, 1);
      g.fillCircle(px, 0, 7.5);
      g.lineStyle(2, 0xffffff, full ? 1 : 0.5);
      g.strokeCircle(px, 0, 7.5);
      if (full) {
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(px - 2.5, -2.5, 2.2);
      }
    }
  }

  refreshButton(btn, count, max, enabled) {
    if (btn.count !== count) {
      btn.count = count;
      if (max > 0) this.drawPips(btn, count, max); // no pips on a button without charges
    }
    // unavailable = greyed icon and label on the same solid plate (never see-through)
    const usable = enabled && count > 0;
    if (btn.usable !== usable) {
      btn.usable = usable;
      this.drawPlate(btn, usable);
      if (usable) btn.img.clearTint();
      else btn.img.setTint(0xb3a9ba);
      btn.lab.setColor(usable ? PAL.inkHex : '#8f8496');
    }
    const a = this.shown;
    if (btn.alpha !== a) {
      btn.alpha = a;
      btn.bg.setAlpha(a);
      btn.img.setAlpha(a);
      btn.lab.setAlpha(a);
    }
  }

  // The blaster's gumball hopper: a jar that fills with beans (display only, not a button).
  hopperMeter(x, y) {
    const g = this.scene.add.graphics({ x, y }).setDepth(D);
    const lab = txt(this.scene, x, y + 44, 'BEANS', 12, PAL.inkHex, { strokeThickness: 4 }).setDepth(D + 2);
    return { g, lab, key: '' };
  }

  drawHopper(ammo, max) {
    const h = this.hopper;
    const full = Math.floor(ammo + 1e-6);
    const empty = ammo < 1;
    const blink = empty && Math.floor(this.scene.time.now / 180) % 2 === 0;
    const key = `${Math.floor(ammo * 3)}|${blink}`;
    if (h.key === key) return;
    h.key = key;
    const g = h.g;
    g.clear();
    g.fillStyle(PAL.ink, 0.3);
    g.fillRoundedRect(-27, -30, 54, 70, 14);
    g.fillStyle(blink ? 0xffd6dc : 0xf2fbff, 1);
    g.fillRoundedRect(-26, -34, 52, 68, 14);
    g.lineStyle(4, blink ? 0xd8364f : PAL.ink, 1);
    g.strokeRoundedRect(-26, -34, 52, 68, 14);
    g.fillStyle(0xff6f9f, 1);
    g.fillRoundedRect(-21, -44, 42, 13, 6);
    g.lineStyle(3, PAL.ink, 1);
    g.strokeRoundedRect(-21, -44, 42, 13, 6);
    // beans stack from the bottom; the one refilling fades in
    for (let i = 0; i < max; i++) {
      const c = i % 3;
      const r = Math.floor(i / 3);
      const bx = -14 + c * 14;
      const by = 22 - r * 13;
      const a = i < full ? 1 : i === full ? (ammo - full) * 0.6 : 0;
      if (a <= 0) continue;
      g.fillStyle(PAL.ink, a);
      g.fillEllipse(bx, by, 13, 10);
      g.fillStyle(PAL.beans[i % PAL.beans.length], a);
      g.fillEllipse(bx, by, 10, 7);
      g.fillStyle(0xffffff, 0.8 * a);
      g.fillCircle(bx - 2, by - 1.5, 1.5);
    }
    g.fillStyle(0xffffff, 0.6);
    g.fillRoundedRect(-21, -28, 6, 40, 3);
    h.lab.setText(empty ? 'EMPTY!' : 'BEANS').setColor(empty ? '#d8364f' : PAL.inkHex);
  }

  banner(title, sub = '', hold = 1500) {
    const { bannerTitle: t, bannerSub: s, scene } = this;
    scene.tweens.killTweensOf([t, s]);
    t.setText(title).setVisible(true).setAlpha(1).setScale(0.4);
    s.setText(sub).setVisible(!!sub).setAlpha(1);
    scene.tweens.add({ targets: t, scale: 1, duration: 380, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: [t, s], alpha: 0, delay: hold, duration: 400, onComplete: () => t.setVisible(false) });
  }

  update() {
    const gl = this.glider;
    this.setChip(this.gooChip, `GOO: ${TIER_LABEL[gl.tier]}`, TIER_COLOR[gl.tier]);
    const frost = Math.round(this.city.total * 100);
    this.setChip(this.frostChip, `CITY FROST ${frost}%`, frost >= 66 ? '#d8364f' : frost >= 33 ? '#3a95c9' : '#7fb8d6');

    const ready = gl.canAct;
    if (this.boostBtn) this.refreshButton(this.boostBtn, gl.boosts, TUNE.boostMax, ready);
    this.refreshButton(this.shakeBtn, gl.shakes, TUNE.shakeMax, ready);
    if (this.flingBtn) {
      this.refreshButton(this.flingBtn, gl.loaded ? 1 : 0, 0, ready);
      // loaded: the button breathes so you notice it's live
      const s = gl.loaded && ready ? 1 + Math.sin(this.scene.time.now / 140) * 0.06 : 1;
      this.flingBtn.img.setScale(0.82 * s);
    }
    if (this.hopper) this.drawHopper(gl.ammo, gl.hopperMax);

    const now = this.scene.time.now;
    const dt = Math.min(0.1, (now - this.lastNow) / 1000);
    this.lastNow = now;
    const caked = gl.tier === 'caked' && !gl.busy;
    const vTarget = caked ? 0.6 + Math.sin(now / 280) * 0.3 : 0;
    this.vignette.setAlpha(this.vignette.alpha + (vTarget - this.vignette.alpha) * Math.min(1, dt * 6));

    const stalling = gl.stall > 0 && !gl.busy;
    this.warn.setVisible(stalling);
    this.warnSub.setVisible(stalling);
    if (stalling) {
      const blink = Math.floor(this.scene.time.now / 160) % 2 === 0;
      this.warn.setAlpha(blink ? 1 : 0.55).setScale(1 + (gl.stall / TUNE.stallTime) * 0.25);
      if (this.scene.time.now - this.lastWarnBeep > 450) {
        this.lastWarnBeep = this.scene.time.now;
        Sfx.warn();
      }
    }
  }
}
