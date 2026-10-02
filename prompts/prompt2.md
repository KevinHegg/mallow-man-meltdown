# prompt2 — into-the-horizon valley view (pseudo-3D rework)

Right now FlightScene is a vertical climb (glider moves up the screen, flat
side-wall tileSprites). Change it to into-the-horizon flight:

- Camera sits behind/above the glider looking forward into the distance. The
  glider stays near the bottom-center and steers on its 2D screen plane
  (left/right/up/down) exactly as now — gameplay stays planar; depth is
  decorative only. That design constraint is unchanged.
- Implement a tiny pseudo-3D projector (no 3D engine): every world entity gets
  (x, y, z) with z = depth ahead of the camera; screenX = cx + (x/z)*focal,
  screenY = horizonY + (y/z)*focal, scale = focal/z.
- The valley: sugar-cube towers and gumdrop buildings line the LEFT and RIGHT
  as valley walls at staggered depths, streaming toward the camera and
  recycling past it. Candy mountains and pink clouds at the horizon for
  parallax. This replaces the flat wallL/wallR tileSprites.
- Entities live in depth: goo marshmallows spawn small at the horizon and grow
  as they approach; jelly beans shrink into the distance when fired; pickups
  drift at mid-depth. Keep collision in screen space as now.
- The boss's cloud sits ON the horizon and visibly grows as progress
  increases — he is the progress bar. FlightScene still hands off to
  BossScene at the end of the run.
- Keep Glider, Projectiles, City, Hud, Controls, and all mechanics (goo
  tiers, boosts, shakes, frost) untouched. Camera/projection rework only.
- Mobile perf: pool all projected sprites, cap on-screen counts.

Acceptance: on a portrait phone viewport I see the glider flying into a candy
valley toward the horizon, buildings streaming past on both sides, enemies
growing out of the distance, zero console errors, and the game plays exactly
as before.
