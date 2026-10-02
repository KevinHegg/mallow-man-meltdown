// A wall of cloud that fills the screen. The flight rises into it as the pilot bails out; the
// rooftop fight starts inside the identical wall and parts it. The layout is seeded, so both
// scenes build exactly the same picture and the hand-over between them can't be seen: the pilot
// under his parachute is the one thing that stays put across it.
import * as Phaser from 'phaser';

const clamp = Phaser.Math.Clamp;
const Ease = Phaser.Math.Easing;

export class CloudCover {
  constructor(scene, depth) {
    const { width: W, height: H } = scene.scale;
    this.W = W;
    this.H = H;
    const rng = new Phaser.Math.RandomDataGenerator(['cover']);
    this.root = scene.add.container(0, 0).setDepth(depth);
    this.back = scene.add.rectangle(W / 2, H / 2 + 15, W + 60, H + 50, 0xfdf3f9); // top edge just above the screen, under the first row of puffs
    this.root.add(this.back);
    this.puffs = [];
    const rows = Math.ceil(H / 130) + 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 4; c++) {
        const x = (c / 3) * W + rng.between(-40, 40);
        const y = 40 + r * 130 + rng.between(-30, 30);
        const img = scene.add
          .image(x, y, 'cloud')
          .setScale(rng.realInRange(1.7, 2.4))
          .setTint(rng.pick([0xffffff, 0xffeef7, 0xfff6fb, 0xf6ecff]))
          .setFlipX(rng.frac() < 0.5);
        img.baseX = x;
        img.baseY = y;
        img.side = x < W / 2 ? -1 : 1;
        img.lag = rng.frac() * 0.25;
        this.root.add(img);
        this.puffs.push(img);
      }
    }
  }

  // 0 = still below the screen … 1 = covering it.
  rise(p) {
    this.root.y = (1 - Ease.Sine.InOut(clamp(p, 0, 1))) * this.H * 1.2;
  }

  // 0 = covering … 1 = parted and gone: the puffs drift apart to the sides and up.
  part(p) {
    this.root.y = 0;
    this.back.setAlpha(1 - clamp(p * 2.5, 0, 1));
    for (const img of this.puffs) {
      const q = clamp((p - img.lag) / (1 - img.lag), 0, 1);
      const e = Ease.Quadratic.In(q);
      img.setPosition(img.baseX + img.side * e * this.W * 0.9, img.baseY - e * this.H * 0.3).setAlpha(1 - clamp((q - 0.4) / 0.6, 0, 1));
    }
  }

  destroy() {
    this.root.destroy();
  }
}
