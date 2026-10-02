// The candy valley seen from behind the glider: two drifting horizon ridges and clouds, a
// striped ground streaming toward the camera, pooled building billboards lining both walls,
// fly-under arches, and a centreline that curves gently over distance. All decorative.
import * as Phaser from 'phaser';
import { DEPTH } from '../config.js';
import { mix, VALLEY_SHADOW_PAD } from '../art/textures.js';

const BUILDINGS = ['v_tower0', 'v_tower1', 'v_gumhouse0', 'v_gumhouse1', 'v_gumhouse2', 'v_cane'];
const ARCHES = ['arch0', 'arch1'];
const HAZE = 0xeadcf6; // distance haze (slightly cool, so far things recede)
const HAZE_AMOUNT = 0.9;
const GROUND_FAR = 0xf6dff0;
const GROUND_NEAR = 0xb8efcf;
const PATH = 0xffc6df;
const PATH_HALF = 70;
const PATH_SAMPLES = 14;

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

    // Curve: the valley centreline's lateral offset over track distance (two slow sines).
    this.curveA1 = 1.15 * f;
    this.curveL1 = 9 * f;
    this.curveA2 = 0.4 * f;
    this.curveL2 = 4 * f;
    this.c0 = 0; // centreline offset at the camera
    this.s0 = 0; // its slope = the camera's heading
    this.lean = 0; // how far the valley bends just ahead (camera sway leans into it)

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
      c.baseY = c.y;
      c.drift = Phaser.Math.FloatBetween(8, 16);
      this.clouds.push(c);
    }
    this.mtnFar = scene.add.image(W / 2, proj.horizonY + 4, 'mtn_far').setOrigin(0.5, 1).setDepth(DEPTH.horizon);
    this.mtnNear = scene.add.image(W / 2, proj.horizonY + 6, 'mtn_near').setOrigin(0.5, 1).setDepth(DEPTH.horizon + 0.05);
    // a band of haze on the horizon, in front of only the farthest billboards
    this.haze = scene.add.image(W / 2, proj.horizonY, 'hazeband').setDisplaySize(W, 120).setDepth(DEPTH.mid + 0.08);

    this.groundBase = scene.add.graphics().setDepth(DEPTH.ground);
    this.ground = scene.add.graphics().setDepth(DEPTH.ground);
    this.drawGroundBase();
    this.pathPts = [];
    for (let i = 0; i < PATH_SAMPLES * 2; i++) this.pathPts.push({ x: 0, y: 0 });
    this.quad = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];

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

    // Arches: legs on the wall lines, crossbar well above eye level so it sweeps overhead.
    this.archSX = (2 * (halfWidth + 20)) / 500;
    this.archSY = (1.5 * groundY) / 642;
    this.arches = ARCHES.map((key) => ({ img: scene.add.image(0, 0, key).setOrigin(0.5, 1).setVisible(false), z: 0, active: false }));
    this.update(0, 0);
  }

  curveAt(d) {
    return this.curveA1 * Math.sin(d / this.curveL1) + this.curveA2 * Math.sin(d / this.curveL2 + 1.3);
  }

  slopeAt(d) {
    return (this.curveA1 / this.curveL1) * Math.cos(d / this.curveL1) + (this.curveA2 / this.curveL2) * Math.cos(d / this.curveL2 + 1.3);
  }

  // Lateral offset of the centreline at depth z, relative to the camera's current heading.
  bend(z) {
    return this.curveAt(this.travel + z) - this.c0 - this.s0 * z;
  }

  depthAt(z) {
    const far = Phaser.Math.Clamp((z - this.zNear) / (this.zFar - this.zNear), 0, 1);
    return DEPTH.mid + (1 - far) * 0.9;
  }

  dress(b) {
    b.img.setTexture(Phaser.Utils.Array.GetRandom(BUILDINGS)).setFlipX(b.side > 0);
    b.img.setOrigin(0.5, 1 - VALLEY_SHADOW_PAD / b.img.height); // base line sits above the baked contact shadow
    b.size = (this.groundY / 300) * Phaser.Math.FloatBetween(0.65, 1.35); // world units per texture px
    const inset = Phaser.Math.FloatBetween(0, 40);
    b.x = b.side * (this.halfWidth + inset + (b.img.width * b.size) / 2);
  }

  launchArch() {
    for (const a of this.arches) {
      if (a.active) continue;
      a.active = true;
      a.z = this.zFar;
      a.img.setVisible(true);
      return true;
    }
    return false;
  }

  update(dt, speed) {
    const p = this.proj;
    const t = this.pt;
    const f = p.focal;
    this.travel += speed * dt;
    this.c0 = this.curveAt(this.travel);
    this.s0 = this.slopeAt(this.travel);
    this.lean = this.bend(3 * f);
    const span = this.zFar - this.zNear;

    for (const b of this.buildings) {
      b.z -= speed * dt;
      if (b.z < this.zNear) {
        b.z += this.spacing * this.perSide;
        this.dress(b);
      }
      p.project(b.x + this.bend(b.z), this.groundY, b.z, t);
      const far = (b.z - this.zNear) / span; // 0 near … 1 far
      b.img
        .setPosition(t.x, t.y)
        .setScale(t.s * b.size)
        .setDepth(DEPTH.mid + (1 - far) * 0.9)
        .setAlpha(Phaser.Math.Clamp((1 - far) / 0.12, 0, 1))
        .setTint(mix(0xffffff, HAZE, far * HAZE_AMOUNT));
    }

    for (const a of this.arches) {
      if (!a.active) continue;
      a.z -= speed * dt;
      if (a.z < 0.5 * f) {
        a.active = false;
        a.img.setVisible(false);
        continue;
      }
      p.project(this.bend(a.z), this.groundY, a.z, t);
      const far = Math.min(1, (a.z - this.zNear) / span);
      a.img
        .setPosition(t.x, t.y)
        .setScale(t.s * this.archSX, t.s * this.archSY)
        .setDepth(a.z < f ? DEPTH.glider + 1 : this.depthAt(a.z) + 0.05) // overhead once it passes the glider
        .setAlpha(Phaser.Math.Clamp((1 - far) / 0.12, 0, 1))
        .setTint(mix(0xffffff, HAZE, Math.max(0, far) * HAZE_AMOUNT));
    }

    // Horizon layers: the far ridge barely moves; the near ridge sways and turns more.
    const W = this.scene.scale.width;
    for (const c of this.clouds) {
      c.baseX += c.drift * dt;
      if (c.baseX > W + 120) c.baseX = -120;
      c.x = c.baseX - p.camX * 0.08 - f * this.s0 * 0.3;
      c.y = c.baseY + p.tilt;
    }
    this.mtnFar.setPosition(p.cx - p.camX * 0.02 - f * this.s0 * 0.5, p.horizonY + 4 + p.tilt);
    this.mtnNear.setPosition(p.cx - p.camX * 0.06 - f * this.s0 * 0.65, p.horizonY + 6 + p.tilt);
    this.groundBase.y = p.tilt;
    this.haze.y = p.horizonY + p.tilt;
    this.drawGround();
  }

  drawGroundBase() {
    const g = this.groundBase;
    const { horizonY } = this.proj;
    const W = this.scene.scale.width;
    const bottom = this.bottomY + 40; // extra so a horizon shift never shows a gap above the city
    const bands = 24;
    for (let i = 0; i < bands; i++) {
      const y0 = horizonY + ((bottom - horizonY) * i) / bands;
      g.fillStyle(mix(GROUND_FAR, GROUND_NEAR, Math.pow(i / (bands - 1), 0.7)), 1);
      g.fillRect(0, Math.floor(y0), W, Math.ceil((bottom - horizonY) / bands) + 1);
    }
  }

  // Ground stripes plus the curving centre path stream toward the camera (no allocations).
  drawGround() {
    const g = this.ground;
    const p = this.proj;
    const W = this.scene.scale.width;
    const G = this.groundY;
    const f = p.focal;
    const hz = p.horizonY + p.tilt;
    const zMin = this.zGround;
    const zMax = this.zFar;
    const D = 0.5 * f;
    g.clear();

    let z0 = Math.floor((zMin + this.travel) / (2 * D)) * 2 * D - this.travel;
    for (; z0 < zMax; z0 += 2 * D) {
      const za = Math.max(z0, zMin);
      const zb = z0 + D;
      if (zb <= zMin) continue;
      const ya = hz + (G * f) / za;
      const yb = hz + (G * f) / zb;
      g.fillStyle(0xffffff, 0.4 * (1 - za / zMax));
      g.fillRect(0, yb, W, ya - yb);
    }

    // centre path following the curve (sampled at geometric depth steps)
    const n = PATH_SAMPLES;
    const pts = this.pathPts;
    for (let i = 0; i < n; i++) {
      const z = zMin * Math.pow(zMax / zMin, i / (n - 1));
      const s = f / z;
      const cxz = p.cx + (this.bend(z) - p.camX) * s;
      const y = hz + G * s;
      pts[i].x = cxz - PATH_HALF * s;
      pts[i].y = y;
      pts[2 * n - 1 - i].x = cxz + PATH_HALF * s;
      pts[2 * n - 1 - i].y = y;
    }
    g.fillStyle(PATH, 0.9);
    g.fillPoints(pts, true);

    // dashed centre line
    const q = this.quad;
    g.fillStyle(0xffffff, 0.9);
    for (z0 = Math.floor((zMin + this.travel) / (2 * D)) * 2 * D - this.travel; z0 < zMax; z0 += 2 * D) {
      const za = Math.max(z0, zMin);
      const zb = z0 + D * 0.6;
      if (zb <= zMin) continue;
      const sa = f / za;
      const sb = f / zb;
      const ca = p.cx + (this.bend(za) - p.camX) * sa;
      const cb = p.cx + (this.bend(zb) - p.camX) * sb;
      q[0].x = cb - 6 * sb;
      q[0].y = hz + G * sb;
      q[1].x = cb + 6 * sb;
      q[1].y = q[0].y;
      q[2].x = ca + 6 * sa;
      q[2].y = hz + G * sa;
      q[3].x = ca - 6 * sa;
      q[3].y = q[2].y;
      g.fillPoints(q, true);
    }
  }
}
