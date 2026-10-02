// Boot: bakes every procedural texture, then shows the title screen.
import * as Phaser from 'phaser';
import { DEPTH, PAL } from '../config.js';
import { buildTextures } from '../art/textures.js';
import { buildBossRig } from '../objects/MarshmallowMan.js';
import { City } from '../objects/City.js';
import { drawSky, makeMuteButton, newRun, txt } from '../ui/helpers.js';
import { Sfx } from '../sfx.js';

// Dev shortcut: ?scene=boss jumps straight to the boss fight, ?scene=win|lose to the end screen.
function devTarget() {
  const s = new URLSearchParams(window.location.search).get('scene');
  if (s === 'boss') return ['Boss', {}];
  if (s === 'win') return ['End', { result: 'win' }];
  if (s === 'lose') return ['End', { result: 'lose', reason: 'spiral', from: 'Boss' }];
  return ['Flight', {}];
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    buildTextures(this);
    const { width: W, height: H } = this.scale;
    const coarse = window.matchMedia('(pointer: coarse)').matches;

    drawSky(this, [0xffc6e3, 0xffe3f1, 0xd7f0ff, 0xbfe9ff]);
    this.far = this.add.tileSprite(0, 0, W, H, 'farsky').setOrigin(0).setDepth(DEPTH.far);
    new City(this, { height: 120, frost: Array(7).fill(0) });

    const bossY = H * 0.56;
    this.add.image(W / 2, bossY + 34, 'bosscloud').setScale(0.75).setDepth(DEPTH.bossCloud);
    const rig = buildBossRig(this, W / 2, bossY, 0.6);
    rig.root.setDepth(DEPTH.boss);
    this.tweens.add({ targets: rig.armR, rotation: -2.5, duration: 600, yoyo: true, repeat: -1, repeatDelay: 500, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: rig.root, y: bossY - 6, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const title1 = txt(this, W / 2, H * 0.13, 'MALLOW MAN', 58, '#ff6f9f', { stroke: PAL.inkHex, strokeThickness: 12 });
    const title2 = txt(this, W / 2, H * 0.13 + 66, 'MELTDOWN', 64, '#9be7ff', { stroke: PAL.inkHex, strokeThickness: 12 });
    [title1, title2].forEach((t) => t.setDepth(DEPTH.hud).setShadow(0, 6, PAL.inkHex, 0, true, true));
    this.tweens.add({ targets: title2, angle: { from: -2, to: 2 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const glider = this.add.image(W / 2, H - 230, 'glider').setDepth(DEPTH.glider).setScale(1.2);
    this.tweens.add({ targets: glider, y: H - 242, angle: 4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const tap = txt(this, W / 2, H - 162, coarse ? 'TAP TO FLY!' : 'CLICK TO FLY!', 34, '#ffffff', {
      stroke: PAL.inkHex,
      strokeThickness: 9,
    }).setDepth(DEPTH.hud);
    this.tweens.add({ targets: tap, scale: 1.08, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const help = coarse
      ? 'Drag to steer  •  Tap to fire jelly beans\nBOOST sheds goo  •  SHAKE cleans it all'
      : 'Drag or arrows/WASD to steer  •  Click/Space to fire\nZ = Bubble Boost  •  X = Shake';
    txt(this, W / 2, H * 0.265, help, 16, PAL.inkHex, { lineSpacing: 6 }).setDepth(DEPTH.hud);
    makeMuteButton(this, W - 34, 34);

    this.started = false;
    this.input.on('pointerdown', (p, over) => {
      if (!over.length) this.go();
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.go());
    this.input.keyboard?.on('keydown-ENTER', () => this.go());
  }

  update(_t, delta) {
    this.far.tilePositionY -= delta * 0.02;
  }

  go() {
    if (this.started) return;
    this.started = true;
    Sfx.unlock();
    Sfx.start();
    this.registry.set('run', newRun());
    const [key, data] = devTarget();
    this.cameras.main.fadeOut(350, 255, 255, 255);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key, data));
  }
}
