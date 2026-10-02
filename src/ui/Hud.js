import * as Phaser from 'phaser';
import { DEPTH, PAL, TIER_COLOR, TIER_LABEL, TUNE } from '../config.js';
import { makeMuteButton, txt } from './helpers.js';
import { Sfx } from '../sfx.js';

const D = DEPTH.hud;

// No HUD bars (DESIGN.md: "the world is the interface"): progress is the boss growing on the
// horizon, his health is his melting body. What's left: the goo and frost chips, the cleanse
// buttons, banners and warnings.
export class Hud {
  // mode: 'flight' (glider: BOOST + SHAKE) | 'roof' (pilot on foot: SHAKE only)
  constructor(scene, { mode, glider, city, onBoost, onShake }) {
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
    this.boostBtn = mode === 'roof' ? null : this.actionButton(62, btnY, 'pk_boost', 'BOOST', onBoost);
    this.shakeBtn = this.actionButton(W - 62, btnY, 'pk_shake', 'SHAKE', onShake);
    this.buttons = this.boostBtn ? [this.boostBtn, this.shakeBtn] : [this.shakeBtn];

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

  actionButton(x, y, icon, label, onPress) {
    const scene = this.scene;
    const r = 42;
    const bg = scene.add.graphics({ x, y }).setDepth(D);
    bg.fillStyle(0xffffff, 0.88);
    bg.fillCircle(0, 0, r);
    bg.lineStyle(4, PAL.ink, 1);
    bg.strokeCircle(0, 0, r);
    const img = scene.add.image(x, y - 6, icon).setScale(0.82).setDepth(D + 1);
    const lab = txt(scene, x, y + r - 9, label, 12, PAL.inkHex, { strokeThickness: 4 }).setDepth(D + 2);
    const pips = scene.add.graphics({ x, y: y - r - 10 }).setDepth(D + 1);
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
    return { bg, img, lab, pips, zone, x, y, r, count: -1, alpha: null };
  }

  // True when the glider's art (not its hitbox) sits under this button.
  covers(btn, gl) {
    const hw = 56 * gl.view.scaleX;
    const hh = 32 * gl.view.scaleY;
    const cx = Phaser.Math.Clamp(btn.x, gl.x - hw, gl.x + hw);
    const cy = Phaser.Math.Clamp(btn.y, gl.y - hh, gl.y + hh);
    return Math.hypot(cx - btn.x, cy - btn.y) < btn.r;
  }

  refreshButton(btn, count, max, enabled, covered) {
    if (btn.count !== count) {
      btn.count = count;
      btn.pips.clear();
      const gap = 16;
      for (let i = 0; i < max; i++) {
        const px = (i - (max - 1) / 2) * gap;
        btn.pips.fillStyle(i < count ? 0xff5e8a : 0xffffff, 1);
        btn.pips.fillCircle(px, 0, 6);
        btn.pips.lineStyle(2, PAL.ink, 1);
        btn.pips.strokeCircle(px, 0, 6);
      }
    }
    // dim when unavailable; fade further while the glider flies underneath so both stay readable
    const a = (enabled && count > 0 ? 1 : 0.4) * (covered ? 0.45 : 1) * this.shown;
    if (btn.alpha !== a) {
      btn.alpha = a;
      btn.bg.setAlpha(a);
      btn.img.setAlpha(a);
      btn.lab.setAlpha(a);
    }
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
    if (this.boostBtn) this.refreshButton(this.boostBtn, gl.boosts, TUNE.boostMax, ready, this.covers(this.boostBtn, gl));
    this.refreshButton(this.shakeBtn, gl.shakes, TUNE.shakeMax, ready, this.covers(this.shakeBtn, gl));

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
