// Tiny pseudo-3D projector — no 3D engine. World space: x right, y down (0 = eye level),
// z = depth ahead of the camera. screen = horizon + (x, y) / z * focal, scale = focal / z.
// Depth is decorative only: gameplay keeps happening on the 2D screen plane.
export class Projector {
  constructor({ cx, horizonY, focal, planeH }) {
    this.cx = cx;
    this.horizonY = horizonY;
    this.focal = focal;
    this.planeH = planeH; // how far below eye level the glider's flight plane sits (world units)
    this.camX = 0; // decorative camera sway; follows the glider a little
  }

  // World point → screen. Decor only (it includes the camera sway).
  project(x, y, z, out) {
    const s = this.focal / z;
    out.x = this.cx + (x - this.camX) * s;
    out.y = this.horizonY + y * s;
    out.s = s;
    return out;
  }

  // Gameplay entities live on the flight plane, where each screen row corresponds to one
  // depth — so their scale (= focal / z) follows from their screen y alone.
  planeScaleAt(screenY) {
    return (screenY - this.horizonY) / this.planeH;
  }

  // A point on the flight plane at depth z, `xw` world units off-centre (no sway, so hitboxes stay put).
  onPlane(xw, z, out) {
    const s = this.focal / z;
    out.x = this.cx + xw * s;
    out.y = this.horizonY + this.planeH * s;
    out.s = s;
    return out;
  }
}
