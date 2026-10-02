// Pooled sprites for the projected view (no per-frame allocation, capped on-screen counts).
import { CAT, DEPTH, MASK } from '../config.js';

// Draws depth-scaled stand-ins for physics sprites (beans, goo). The physics bodies keep
// their size and screen-space collisions; only what you see shrinks into the distance.
export class ShadowPool {
  constructor(scene, size, depth) {
    this.items = [];
    for (let i = 0; i < size; i++) this.items.push(scene.add.image(0, 0, '__DEFAULT').setVisible(false).setDepth(depth));
  }

  // scaleFor(y) returns the depth scale for a screen row, or 0 to hide.
  sync(sources, scaleFor) {
    let i = 0;
    for (const src of sources) {
      if (!src.alive) continue;
      src.setVisible(false);
      if (i >= this.items.length) continue; // over the cap: not drawn
      const s = scaleFor(src.y);
      if (s <= 0) continue;
      const img = this.items[i++];
      if (img.texture.key !== src.texture.key) img.setTexture(src.texture.key);
      img.setPosition(src.x, src.y).setRotation(src.rotation).setScale(s).setAlpha(src.alpha).setVisible(true);
    }
    for (; i < this.items.length; i++) this.items[i].setVisible(false);
  }
}

// Reusable Matter sensor props (obstacles + pickups), one bucket per texture.
export class PropPool {
  constructor(scene, specs) {
    this.buckets = {};
    for (const [key, { shape, count }] of Object.entries(specs)) {
      this.buckets[key] = [];
      for (let i = 0; i < count; i++) {
        const img = scene.matter.add.image(-999, -999, key, null, {
          isStatic: true,
          isSensor: true,
          label: 'prop',
          shape,
          collisionFilter: { category: CAT.prop, mask: 0 },
        });
        img.setVisible(false).setDepth(DEPTH.props);
        img.alive = false;
        this.buckets[key].push(img);
      }
    }
  }

  // Returns a free prop or null when the bucket is exhausted (the on-screen cap).
  acquire(key) {
    const img = this.buckets[key].find((p) => !p.alive);
    if (!img) return null;
    img.alive = true;
    img.setVisible(true).setAlpha(1).setFlipX(false).setCollidesWith(MASK.prop);
    return img;
  }

  release(img) {
    if (!img.alive) return;
    img.alive = false;
    img.setVisible(false).setCollidesWith(0).setPosition(-999, -999);
  }
}
