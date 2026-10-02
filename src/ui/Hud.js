import * as Phaser from 'phaser';
import { DEPTH, PAL, TIER_COLOR, TIER_LABEL, TUNE } from '../config.js';
import { STAGE_NAMES } from '../objects/MarshmallowMan.js';
import { makeMuteButton, txt } from './helpers.js';
import { Sfx } from '../sfx.js';

const D = DEPTH.hud;

export class Hud {
  // mode: 'flight' (progress bar) | 'boss' (melt-o-meter)
  constructor(scene, { mode, glider, city, boss, onBoost, onShake }) {
    this.scene = scene;
    this.mode = mode;
    this.glider = glider;
    this.city = city;
    this.boss = boss;
    this.progress = 0;
    const { width: W, height: H } = scene.scale;
    this.W = W;

    const panel = scene.add.graphics().setDepth(D);
    panel.fillStyle(0xffffff, 0.85);
    panel.fillRoundedRect(12, 12, W - 24, 58, 18);
    panel.lineStyle(3, PAL.ink, 0.9);
    panel.strokeRoundedRect(12, 12, W - 24, 58, 18);
    this.title = txt(scene, 30, 29, mode === 'boss' ? 'MELT-O-METER' : 'TO THE CLOUD', 15, PAL.inkHex, {
      strokeThickness: 0,
    })
      .setOrigin(0, 0.5)
      .setDepth(D + 1);
    this.status = txt(scene, W - 74, 29, '', 15, PAL.inkHex, { strokeThickness: 0 }).setOrigin(1, 0.5).setDepth(D + 1);
    this.barX = 30;
    this.barW = W - 112;
    this.bar = scene.add.graphics().setDepth(D + 1);
    this.barIcon = scene.add.image(0, 52, 'glider').setScale(0.3).setDepth(D + 2).setVisible(mode === 'flight');
    makeMuteButton(scene, W - 40, 41);

    this.gooChip = this.chip(16, 82, 'left');
    this.frostChip = this.chip(W - 16, 82, 'right');

    const btnY = city.top - 64;
    this.boostBtn = this.actionButton(62, btnY, 'pk_boost', 'BOOST', onBoost);
    this.shakeBtn = this.actionButton(W - 62, btnY, 'pk_shake', 'SHAKE', onShake);

    this.bannerTitle = txt(scene, W / 2, H * 0.4, '', 46, '#ff5e8a', { stroke: PAL.inkHex, strokeThickness: 10 })
      .setDepth(D + 5)
      .setVisible(false);
    this.bannerSub = txt(scene, W / 2, H * 0.4 + 48, '', 20, PAL.inkHex).setDepth(D + 5).setVisible(false);
    this.warn = txt(scene, W / 2, city.top - 150, 'TOO GOOEY!', 34, '#ffffff', { stroke: '#d8364f', strokeThickness: 10 })
      .setDepth(D + 4)
      .setVisible(false);
    this.warnSub = txt(scene, W / 2, city.top - 114, 'No cleanses left — drip it off!', 16, '#d8364f').setDepth(D + 4).setVisible(false);
    this.lastWarnBeep = 0;
    this.cache = {};
    this.vignette = this.makeVignette(W, H);
    this.lastNow = scene.time.now;
    this.update();
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
    return { bg, img, lab, pips, count: -1, enabled: null };
  }

  refreshButton(btn, count, max, enabled) {
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
    const on = enabled && count > 0;
    if (btn.enabled !== on) {
      btn.enabled = on;
      const a = on ? 1 : 0.4;
      btn.bg.setAlpha(a);
      btn.img.setAlpha(a);
      btn.lab.setAlpha(a);
    }
  }

  drawBar(frac, color, ticks) {
    const key = `${Math.round(frac * 200)}|${color}`;
    if (this.cache.bar === key) return;
    this.cache.bar = key;
    const g = this.bar;
    const { barX: x, barW: w } = this;
    const y = 45;
    const h = 14;
    g.clear();
    g.fillStyle(0xf3e0ec, 1);
    g.fillRoundedRect(x, y, w, h, 7);
    if (frac > 0.01) {
      g.fillStyle(color, 1);
      g.fillRoundedRect(x, y, Math.max(14, w * frac), h, 7);
    }
    if (ticks) {
      g.fillStyle(PAL.ink, 0.6);
      for (const t of ticks) g.fillRect(x + w * t - 1, y, 2, h);
    }
    g.lineStyle(2, PAL.ink, 0.8);
    g.strokeRoundedRect(x, y, w, h, 7);
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
    if (this.mode === 'boss') {
      const boss = this.boss;
      this.drawBar(1 - boss.hpFrac, 0xff5e8a, [0.25, 0.5, 0.75]);
      this.setText(this.status, STAGE_NAMES[boss.stage]);
    } else {
      this.drawBar(this.progress, 0x7ad9a6);
      this.barIcon.setPosition(this.barX + this.barW * this.progress, 52).setRotation(Math.PI / 2);
      this.setText(this.status, `${Math.floor(this.progress * 100)}%`);
    }
    this.setChip(this.gooChip, `GOO: ${TIER_LABEL[gl.tier]}`, TIER_COLOR[gl.tier]);
    const frost = Math.round(this.city.total * 100);
    this.setChip(this.frostChip, `CITY FROST ${frost}%`, frost >= 66 ? '#d8364f' : frost >= 33 ? '#3a95c9' : '#7fb8d6');

    const ready = gl.canAct;
    this.refreshButton(this.boostBtn, gl.boosts, TUNE.boostMax, ready);
    this.refreshButton(this.shakeBtn, gl.shakes, TUNE.shakeMax, ready);

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

  setText(t, s) {
    if (t.text !== s) t.setText(s);
  }
}
