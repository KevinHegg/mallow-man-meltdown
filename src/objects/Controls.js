// Touch/mouse: drag anywhere to steer (relative, like a trackpad, so your finger never
// covers the glider); every new touch/click fires a jelly bean. A second finger can tap-fire
// while the first keeps steering. Keyboard: arrows/WASD steer, Space fires, Z boost, X shake.
import { TUNE } from '../config.js';
import { Sfx } from '../sfx.js';

export class Controls {
  constructor(scene, glider, { fire, boost, shake }) {
    this.scene = scene;
    this.glider = glider;
    this.fire = fire;
    this.steerId = null;
    this.lastX = 0;
    this.lastY = 0;

    const input = scene.input;
    input.on('pointerdown', (p, over) => {
      Sfx.unlock();
      if (over.length) return; // HUD buttons handle themselves
      fire();
      if (this.steerId === null) {
        this.steerId = p.id;
        this.lastX = p.x;
        this.lastY = p.y;
      }
    });
    input.on('pointermove', (p) => {
      if (p.id !== this.steerId || !p.isDown) return;
      const k = TUNE.steerSensitivity;
      this.glider.steerBy((p.x - this.lastX) * k, (p.y - this.lastY) * k);
      this.lastX = p.x;
      this.lastY = p.y;
    });
    const release = (p) => {
      if (p.id === this.steerId) this.steerId = null;
    };
    input.on('pointerup', release);
    input.on('pointerupoutside', release);

    if (input.keyboard) {
      this.keys = input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,Z,X');
      this.keys.Z.on('down', () => boost());
      this.keys.X.on('down', () => shake());
    }
  }

  update(dt) {
    const k = this.keys;
    if (!k) return;
    const sx = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
    const sy = (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);
    if (sx || sy) this.glider.steerBy(sx * TUNE.keySpeed * dt, sy * TUNE.keySpeed * dt);
    if (k.SPACE.isDown) this.fire();
  }
}
