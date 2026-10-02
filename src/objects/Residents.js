// Candy City's residents: little gingerbread people on the skyline's rooftops. They freeze with
// their building's frost (icy tint, stock-still) and, when the finale's flood thaws their
// building, they warm up and celebrate.
import * as Phaser from 'phaser';
import { mix } from '../art/textures.js';

const ICE = 0x9fd8ff;

export class Residents {
  constructor(scene, city, depth) {
    this.scene = scene;
    this.city = city;
    this.items = city.buildings.map((b) => {
      const y = b.fullTop + b.capH + 1; // standing on the roof line, beside the cap
      const x = b.x + b.w * (b.i % 2 ? 0.74 : 0.26);
      const img = scene.add.image(x, y, 'resident').setOrigin(0.5, 1).setScale(0.62).setDepth(depth);
      const ice = scene.add.image(x, y + 2, 'ice_block').setOrigin(0.5, 1).setScale(0.7).setDepth(depth + 0.05).setAlpha(0);
      return { img, ice, i: b.i, x, y, t: Phaser.Math.FloatBetween(0, 6), cheer: false, warm: 1 };
    });
  }

  update(dt) {
    const frost = this.city.frost;
    for (const r of this.items) {
      r.t += dt;
      const frozen = !r.cheer && frost[r.i] >= 0.5;
      // warmth eases between frozen (0) and alive (1)
      r.warm += ((frozen ? 0 : 1) - r.warm) * Math.min(1, dt * 4);
      r.img.setTint(mix(ICE, 0xffffff, r.warm));
      r.ice.setAlpha((1 - r.warm) * 0.85);
      if (r.cheer) {
        const hop = Math.abs(Math.sin(r.t * 7)) * 14;
        r.img.setPosition(r.x, r.y - hop).setAngle(Math.sin(r.t * 7) * 8);
        if (Math.random() < dt * 2.5) this.confetti?.emitParticleAt(r.x, r.y - 30);
      } else {
        const bob = Math.sin(r.t * 2.2) * 1.5 * r.warm; // the frozen stand stock-still
        r.img.setPosition(r.x, r.y + bob).setAngle(Math.sin(r.t * 1.3) * 4 * r.warm);
      }
    }
  }

  // The flood reached building i: its resident thaws and celebrates.
  celebrate(i) {
    const r = this.items[i];
    if (!r || r.cheer) return;
    r.cheer = true;
    r.img.setTexture('resident_cheer');
  }
}
