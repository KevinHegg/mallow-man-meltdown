// End: win / lose screen with stats and retry options.
import * as Phaser from 'phaser';
import { DEPTH, PAL } from '../config.js';
import { City } from '../objects/City.js';
import { buildPilotView } from '../objects/Pilot.js';
import { Residents } from '../objects/Residents.js';
import { drawSky, makeButton, newRun, randInt, snapshot, txt } from '../ui/helpers.js';

const COPY = {
  win: ['MELTDOWN!', 'The Evil Marshmallow Man is a puddle.\nThe city is safe and fluffy!'],
  spiral: ['SPUN OUT!', 'Too much goo and no cleanses left.\nBoost or shake before you get caked!'],
  frost: ['FROZEN SOLID!', 'The goo froze the whole city.\nPop falling goo before it lands!'],
};

export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  init(data) {
    this.outcome = { result: 'lose', reason: 'spiral', from: 'Flight', ...data };
  }

  create() {
    const { width: W, height: H } = this.scale;
    const { result, reason, from } = this.outcome;
    const win = result === 'win';
    const run = this.registry.get('run') ?? newRun();
    const [title, sub] = COPY[win ? 'win' : reason] ?? COPY.spiral;

    drawSky(this, win ? [0xffc6e3, 0xffe3f1, 0xd7f0ff, 0xbfe9ff] : [0x8a6fb3, 0xc49ad6, 0xf0c6e0, 0xd6e6f5]);
    const frost = win ? Array(7).fill(0) : reason === 'frost' ? Array(7).fill(1.25) : run.frost;
    const city = new City(this, { height: 130, frost });
    // the residents on the skyline: cheering after a win, frozen where the frost got them
    this.residents = new Residents(this, city, DEPTH.city + 1.2);
    if (win) city.buildings.forEach((b) => this.residents.celebrate(b.i));

    if (win) {
      // a static fluff pile and celebratory bean confetti
      for (let i = 0; i < 70; i++) {
        this.add
          .image(randInt(0, W), H - randInt(4, 70) - (i % 3) * 8, `fluff${i % 2}`)
          .setAngle(randInt(0, 360))
          .setDepth(DEPTH.fluff);
      }
      PAL.beans.forEach((_, i) => {
        this.add
          .particles(0, -20, `bean${i}`, {
            x: { min: 0, max: W },
            speedY: { min: 120, max: 260 },
            speedX: { min: -40, max: 40 },
            rotate: { min: 0, max: 360 },
            lifespan: 5000,
            frequency: 380,
          })
          .setDepth(DEPTH.fx);
      });
    }

    if (from === 'Boss') {
      // the finale was on foot: the gingerbread pilot cheers (or droops, frosty)
      const pilot = buildPilotView(this);
      pilot.root.setPosition(W / 2, H * 0.6 + 50).setScale(1.5).setDepth(DEPTH.glider);
      if (win) {
        pilot.gun.setRotation(-0.4);
        this.tweens.add({ targets: pilot.root, y: H * 0.6 + 30, duration: 300, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: pilot.gun, rotation: 0.4, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      } else {
        pilot.root.setAngle(-8);
        [pilot.body, pilot.legL, pilot.legR, pilot.gun].forEach((part) => part.setTint(0xb5d8f0));
        pilot.gun.setRotation(1.1);
      }
    } else {
      const glider = this.add.image(W / 2, H * 0.6, 'glider').setScale(1.4).setDepth(DEPTH.glider);
      if (win) {
        this.tweens.add({ targets: glider, y: H * 0.6 - 14, angle: 6, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      } else {
        glider.setAngle(-28).setTint(0xb5d8f0);
        if (reason === 'spiral') {
          [-30, 4, 28].forEach((dx, i) => this.add.image(W / 2 + dx, H * 0.6 + (i % 2) * 6, 'splat').setScale(1.1).setDepth(DEPTH.glider + 1));
        }
        this.tweens.add({ targets: glider, angle: -20, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    }

    const head = txt(this, W / 2, H * 0.14, title, 56, win ? '#ff6f9f' : '#9be7ff', { stroke: PAL.inkHex, strokeThickness: 12 }).setDepth(DEPTH.hud);
    head.setScale(0.3);
    this.tweens.add({ targets: head, scale: 1, duration: 600, ease: 'Back.easeOut' });
    txt(this, W / 2, H * 0.14 + 76, sub, 19, PAL.inkHex, { lineSpacing: 6 }).setDepth(DEPTH.hud);

    const s = run.stats;
    const secs = Math.round((Date.now() - s.startedAt) / 1000);
    const lines = [
      `Jelly beans fired: ${s.beans}`,
      `Goo-mallows popped: ${s.pops}`,
      `Boss hits: ${s.hits}`,
      `Goo splats taken: ${s.splats}`,
      `City frost: ${Math.round((frost.reduce((a, f) => a + Math.min(1, f), 0) / frost.length) * 100)}%`,
      `Time: ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`,
    ];
    const stats = txt(this, W / 2, H * 0.36, lines.join('\n'), 18, PAL.inkHex, { lineSpacing: 8, strokeThickness: 4 }).setDepth(DEPTH.hud);
    const panel = this.add.graphics().setDepth(DEPTH.hud - 1);
    const pw = 420;
    const top = H * 0.14 + 40;
    const bottom = stats.y + stats.height / 2 + 14;
    panel.fillStyle(0xffffff, 0.72);
    panel.fillRoundedRect(W / 2 - pw / 2, top, pw, bottom - top, 22);
    panel.lineStyle(3, PAL.ink, 0.5);
    panel.strokeRoundedRect(W / 2 - pw / 2, top, pw, bottom - top, 22);

    const by = H * 0.66;
    makeButton(this, W / 2, by, 280, 66, 'FLY AGAIN', () => {
      this.registry.set('run', newRun());
      this.scene.start('Flight', { title: false }); // explicit: Phaser keeps a scene's last start data otherwise
    });
    const checkpoint = this.registry.get('bossCheckpoint');
    if (!win && from === 'Boss' && checkpoint) {
      makeButton(
        this,
        W / 2,
        by + 84,
        280,
        58,
        'RETRY BOSS',
        () => {
          const retry = snapshot(checkpoint);
          retry.boosts = Math.max(retry.boosts, 1);
          retry.shakes = Math.max(retry.shakes, 1);
          retry.stats.startedAt = Date.now();
          this.registry.set('run', retry);
          this.scene.start('Boss', { retry: true });
        },
        { fill: 0x5ec8ff, size: 22 },
      );
    }
    makeButton(this, W / 2, by + (win || from !== 'Boss' ? 84 : 160), 180, 48, 'TITLE', () => this.scene.start('Boot'), {
      fill: 0xb59cff,
      size: 18,
    });

    this.cameras.main.fadeIn(400, 255, 255, 255);
  }

  update(_t, delta) {
    this.residents.update(Math.min(delta / 1000, 0.05));
  }
}
