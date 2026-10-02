// Boot: bakes every procedural texture, then opens straight into the flight's slingshot launch
// (the title shows over it). No click-to-start card: the slingshot is the start.
import * as Phaser from 'phaser';
import { buildTextures } from '../art/textures.js';
import { newRun } from '../ui/helpers.js';

// Dev shortcut: ?scene=boss jumps straight to the boss fight, ?scene=win|lose to the end screen.
function devTarget() {
  const s = new URLSearchParams(window.location.search).get('scene');
  if (s === 'boss') return ['Boss', {}];
  if (s === 'win') return ['End', { result: 'win' }];
  if (s === 'lose') return ['End', { result: 'lose', reason: 'spiral', from: 'Boss' }];
  return ['Flight', { title: true }];
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    buildTextures(this);
    this.registry.set('run', newRun());
    const [key, data] = devTarget();
    this.scene.start(key, data);
  }
}
