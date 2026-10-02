import * as Phaser from 'phaser';
import { DEPTH, FONT, PAL, TUNE } from '../config.js';
import { mix } from '../art/textures.js';
import { Sfx } from '../sfx.js';

export function txt(scene, x, y, str, size = 24, color = PAL.inkHex, extra = {}) {
  return scene.add
    .text(x, y, str, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color,
      stroke: '#ffffff',
      strokeThickness: Math.max(3, Math.round(size / 5)),
      align: 'center',
      resolution: 2,
      ...extra,
    })
    .setOrigin(0.5);
}

export function drawSky(scene, stops, depth = DEPTH.sky) {
  const { width: W, height: H } = scene.scale;
  const g = scene.add.graphics().setDepth(depth);
  const bands = 48;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const seg = t * (stops.length - 1);
    const k = Math.min(stops.length - 2, Math.floor(seg));
    g.fillStyle(mix(stops[k], stops[k + 1], seg - k), 1);
    g.fillRect(0, Math.floor((i * H) / bands), W, Math.ceil(H / bands) + 1);
  }
  return g;
}

export function floatText(scene, x, y, str, color = PAL.inkHex, size = 22) {
  const t = txt(scene, x, y, str, size, color).setDepth(DEPTH.hud - 1).setScale(0.6);
  scene.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.easeOut' });
  scene.tweens.add({
    targets: t,
    y: y - 60,
    alpha: 0,
    delay: 450,
    duration: 650,
    ease: 'Quad.easeIn',
    onComplete: () => t.destroy(),
  });
  return t;
}

// Rounded candy button. Returns the zone so callers can tweak it.
export function makeButton(scene, x, y, w, h, label, onClick, { fill = 0xff6f9f, size = 26 } = {}) {
  const box = scene.add.container(x, y).setDepth(DEPTH.hud);
  const g = scene.add.graphics();
  g.fillStyle(PAL.ink, 1);
  g.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, h / 2);
  g.fillStyle(fill, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  g.fillStyle(0xffffff, 0.35);
  g.fillRoundedRect(-w / 2 + 14, -h / 2 + 6, w - 28, h * 0.28, h * 0.14);
  g.lineStyle(3, PAL.ink, 1);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  const t = txt(scene, 0, 0, label, size, '#ffffff', { stroke: PAL.inkHex, strokeThickness: 6 });
  box.add([g, t]);
  const zone = scene.add.zone(x, y, w, h + 6).setInteractive({ useHandCursor: true }).setDepth(DEPTH.hud + 1);
  zone.on('pointerdown', () => {
    Sfx.unlock();
    Sfx.click();
    scene.tweens.add({ targets: box, scale: 0.92, duration: 70, yoyo: true, onComplete: onClick });
  });
  return zone;
}

// Small round mute toggle (top-right corner by default).
export function makeMuteButton(scene, x, y) {
  const g = scene.add.graphics({ x, y }).setDepth(DEPTH.hud + 1);
  const draw = () => {
    g.clear();
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(0, 0, 18);
    g.lineStyle(3, PAL.ink, 1);
    g.strokeCircle(0, 0, 18);
    // speaker glyph
    g.fillStyle(PAL.ink, 1);
    g.fillRect(-9, -4, 5, 8);
    g.fillTriangle(-5, -4, 3, -10, 3, 10);
    g.fillTriangle(-5, -4, -5, 4, 3, 10);
    if (Sfx.isMuted()) {
      g.lineStyle(3, 0xd8364f, 1);
      g.lineBetween(-11, -11, 11, 11);
    } else {
      g.lineStyle(2, PAL.ink, 1);
      g.beginPath();
      g.arc(4, 0, 6, -0.9, 0.9);
      g.strokePath();
    }
  };
  draw();
  const zone = scene.add
    .zone(x, y, 46, 46)
    .setInteractive({ useHandCursor: true })
    .setDepth(DEPTH.hud + 2);
  zone.on('pointerdown', () => {
    Sfx.unlock();
    Sfx.toggleMute();
    Sfx.click();
    draw();
  });
  return zone;
}

export function makeFx(scene) {
  const mk = (key, cfg, depth = DEPTH.fx) => scene.add.particles(0, 0, key, { emitting: false, ...cfg }).setDepth(depth);
  return {
    drip: mk('drip', {
      lifespan: 900,
      speedX: { min: -20, max: 20 },
      speedY: { min: 30, max: 90 },
      gravityY: 520,
      scale: { start: 1, end: 0.5 },
      alpha: { start: 1, end: 0 },
    }),
    puff: mk('puff', {
      lifespan: 550,
      speed: { min: 50, max: 170 },
      scale: { start: 0.7, end: 1.7 },
      alpha: { start: 0.95, end: 0 },
    }),
    bubble: mk('bubble', {
      lifespan: 800,
      speed: { min: 60, max: 240 },
      scale: { start: 0.5, end: 1.2 },
      alpha: { start: 1, end: 0 },
      gravityY: -160,
    }),
    spark: mk('spark', {
      lifespan: 420,
      speed: { min: 90, max: 240 },
      scale: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 },
      tint: PAL.beans,
    }),
    flake: mk('flake', {
      lifespan: 1000,
      speed: { min: 20, max: 110 },
      angle: { min: 200, max: 340 },
      scale: { start: 1.1, end: 0.2 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 },
      tint: [0xffffff, 0xcff4ff, 0x9be7ff],
    }),
    mdrip: mk('mdrip', {
      lifespan: 1000,
      speedX: { min: -60, max: 60 },
      speedY: { min: -40, max: 60 },
      gravityY: 600,
      scale: { start: 1, end: 0.6 },
      alpha: { start: 1, end: 0 },
    }),
  };
}

// Physics objects are retired (hidden + collisions off) during a step and destroyed next frame.
export function retire(scene, obj) {
  if (!obj.alive) return;
  obj.alive = false;
  obj.setVisible(false);
  if (obj.body) obj.setCollidesWith(0);
  (scene.trash ??= []).push(obj);
}

export function flushTrash(scene) {
  if (!scene.trash?.length) return;
  for (const obj of scene.trash) obj.destroy();
  scene.trash.length = 0;
}

// Routes Matter collision pairs to handlers keyed by "labelA|labelB" (either order).
export function routeCollisions(scene, handlers, event = 'collisionstart') {
  scene.matter.world.on(event, (e) => {
    for (const pair of e.pairs) {
      const A = pair.bodyA.parent ?? pair.bodyA;
      const B = pair.bodyB.parent ?? pair.bodyB;
      const fwd = handlers[`${A.label}|${B.label}`];
      if (fwd) fwd(A, B);
      else handlers[`${B.label}|${A.label}`]?.(B, A);
    }
  });
}

export function newRun() {
  return {
    frost: Array(7).fill(0),
    boosts: TUNE.boostCharges,
    shakes: TUNE.shakeCharges,
    stats: { beans: 0, pops: 0, hits: 0, splats: 0, startedAt: Date.now() },
  };
}

export const snapshot = (run) => JSON.parse(JSON.stringify(run));

export const rand = Phaser.Math.FloatBetween;
export const randInt = Phaser.Math.Between;
