// The candy valley seen from behind the glider: horizon mountains and clouds, a striped
// ground streaming toward the camera, and pooled building billboards lining both walls.
import * as Phaser from 'phaser';
import { DEPTH } from '../config.js';
import { mix } from '../art/textures.js';

const BUILDINGS = ['v_tower0', 'v_tower1', 'v_gumhouse0', 'v_gumhouse1', 'v_gumhouse2', 'v_cane'];
const HAZE = 0xf3d9f2;
const GROUND_FAR = 0xf6dff0;
const GROUND_NEAR = 0xb8efcf;
const PATH = 0xffc6df;

export class Valley {
  // groundY: world depth of the ground below eye level; halfWidth: inner wall line (world x)
  constructor(scene, proj, { groundY, halfWidth, bottomY }) {
    this.scene = scene;
    this.proj = proj;
    this.groundY = groundY;
    this.halfWidth = halfWidth;
    this.bottomY = bottomY;
    this.travel = 0;
    this.pt = {};

    const f = proj.focal;
    this.zNear = 0.45 * f;
    this.spacing = 0.75 * f;
    this.perSide = 13;
    this.zFar = this.zNear + this.spacing * this.perSide;
    this.zGround = (groundY * f) / (bottomY - proj.horizonY); // depth where the ground meets bottomY

    const { width: W } = scene.scale;
    this.clouds = [];
    for (let i = 0; i < 5; i++) {
      const c = scene.add
        .image(Phaser.Math.Between(0, W), Phaser.Math.Between(125, proj.horizonY - 40), 'cloud')
        .setDepth(DEPTH.far)
        .setScale(Phaser.Math.FloatBetween(0.4, 0.8))
        .setTint(Phaser.Utils.Array.GetRandom([0xffffff, 0xffd6ea, 0xffe6f2]))
        .setAlpha(0.85);
      c.baseX = c.x;
      c.drift = Phaser.Math.FloatBetween(8, 16);
      this.clouds.push(c);
    }
    this.mountains = scene.add.image(W / 2, proj.horizonY + 4, 'mountains').setOrigin(0.5, 1).setDepth(DEPTH.horizon);

    this.groundBase = scene.add.graphics().setDepth(DEPTH.ground);
    this.ground = scene.add.graphics().setDepth(DEPTH.ground);
    this.drawGroundBase();

    // Fixed pool of billboards, recycled to the far end as they pass the camera.
    this.buildings = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < this.perSide; i++) {
        const b = { img: scene.add.image(0, 0, BUILDINGS[0]).setOrigin(0.5, 1), side };
        b.z = this.zNear + (i + (side > 0 ? 0.5 : 0)) * this.spacing;
        this.dress(b);
        this.buildings.push(b);
      }
    }
    this.update(0, 0);
  }

  dress(b) {
    b.img.setTexture(Phaser.Utils.Array.GetRandom(BUILDINGS)).setFlipX(b.side > 0);
    b.size = (this.groundY / 300) * Phaser.Math.FloatBetween(0.65, 1.35); // world units per texture px
    const inset = Phaser.Math.FloatBetween(0, 40);
    b.x = b.side * (this.halfWidth + inset + (b.img.width * b.size) / 2);
  }

  update(dt, speed) {
    const p = this.proj;
    const t = this.pt;
    this.travel += speed * dt;
    const span = this.zFar - this.zNear;
    for (const b of this.buildings) {
      b.z -= speed * dt;
      if (b.z < this.zNear) {
        b.z += this.spacing * this.perSide;
        this.dress(b);
      }
      p.project(b.x, this.groundY, b.z, t);
      const far = (b.z - this.zNear) / span; // 0 near … 1 far
      b.img
        .setPosition(t.x, t.y)
        .setScale(t.s * b.size)
        .setDepth(DEPTH.mid + (1 - far) * 0.9)
        .setAlpha(Phaser.Math.Clamp((1 - far) / 0.12, 0, 1))
        .setTint(mix(0xffffff, HAZE, far * 0.75));
    }
    const W = this.scene.scale.width;
    for (const c of this.clouds) {
      c.baseX += c.drift * dt;
      if (c.baseX > W + 120) c.baseX = -120;
      c.x = c.baseX - p.camX * 0.08;
    }
    this.mountains.x = p.cx - p.camX * 0.04;
    this.drawGround();
  }

  drawGroundBase() {
    const g = this.groundBase;
    const { horizonY } = this.proj;
    const W = this.scene.scale.width;
    const bands = 24;
    for (let i = 0; i < bands; i++) {
      const y0 = horizonY + ((this.bottomY - horizonY) * i) / bands;
      g.fillStyle(mix(GROUND_FAR, GROUND_NEAR, Math.pow(i / (bands - 1), 0.7)), 1);
      g.fillRect(0, Math.floor(y0), W, Math.ceil((this.bottomY - horizonY) / bands) + 1);
    }
  }

  // Ground stripes and the centre path stream toward the camera (the main sense of speed).
  drawGround() {
    const g = this.ground;
    const p = this.proj;
    const W = this.scene.scale.width;
    const G = this.groundY;
    const f = p.focal;
    const yAt = (z) => p.horizonY + (G * f) / z;
    g.clear();

    const D = 0.5 * f;
    const zMin = this.zGround;
    const zMax = this.zFar;
    let z0 = Math.floor((zMin + this.travel) / (2 * D)) * 2 * D - this.travel;
    for (; z0 < zMax; z0 += 2 * D) {
      const za = Math.max(z0, zMin);
      const zb = z0 + D;
      if (zb <= zMin) continue;
      const ya = yAt(za);
      const yb = yAt(zb);
      g.fillStyle(0xffffff, 0.4 * (1 - za / zMax));
      g.fillRect(0, yb, W, ya - yb);
    }

    // centre path: a trapezoid from the vanishing point, swaying with the camera
    const PATH_HALF = 70;
    const sb = (this.bottomY - p.horizonY) / G;
    const bx = p.cx - p.camX * sb;
    g.fillStyle(PATH, 0.9);
    g.fillPoints(
      [
        { x: p.cx - 1, y: p.horizonY },
        { x: p.cx + 1, y: p.horizonY },
        { x: bx + PATH_HALF * sb, y: this.bottomY },
        { x: bx - PATH_HALF * sb, y: this.bottomY },
      ],
      true,
    );
    // dashed centre line
    g.fillStyle(0xffffff, 0.9);
    for (z0 = Math.floor((zMin + this.travel) / (2 * D)) * 2 * D - this.travel; z0 < zMax; z0 += 2 * D) {
      const za = Math.max(z0, zMin);
      const zb = z0 + D * 0.6;
      if (zb <= zMin) continue;
      const ya = yAt(za);
      const yb = yAt(zb);
      const sa = f / za;
      const sbz = f / zb;
      const ca = p.cx - p.camX * sa;
      const cb = p.cx - p.camX * sbz;
      g.fillPoints(
        [
          { x: cb - 6 * sbz, y: yb },
          { x: cb + 6 * sbz, y: yb },
          { x: ca + 6 * sa, y: ya },
          { x: ca - 6 * sa, y: ya },
        ],
        true,
      );
    }
  }
}
