# prompt9 — altitude matters

The flight still plays as dodge-left-right. The glider moves up and down,
but nothing in the flight *cares* about altitude. Make height a gameplay
dimension with the same controls — no new buttons, no new mechanics
numbers, just obstacles that force vertical decisions.

- High obstacles: candy-cane arches at head height — dive UNDER them.
  Some hang low enough that climbing over isn't possible; going under is
  the only play. Telegraph clearly: striped arches up high mean "get low".
- Low hazards: frosting traps / sticky pools floating at low altitude —
  climb OVER them. Touching one goos the glider exactly like a
  marshmallow hit (same goo numbers, no new debuff type).
- Candy-cane thermals (DESIGN.md): striped thermal columns that lift the
  glider while inside and make goo drip off faster. Visible shimmer,
  gentle lift force — a reward for flying through, not just an obstacle
  to avoid.
- Readability first: height bands must telegraph instantly (high =
  striped arches overhead, low = pink frosting blobs below). The player
  should never wonder whether to climb or dive.
- Don't change: controls, speeds, goo/damage numbers, overall spawn
  pressure (rebalance the obstacle *mix*, not the difficulty). The
  valley, boss-on-horizon, and all visuals stay as they are.

Acceptance: a flight run forces both climbing and diving decisions;
thermals visibly lift and accelerate drip-off; zero console errors; all
mechanics numbers unchanged — only obstacle placement and the new
thermal behavior. Then write prompts/prompt9-response.md per the
protocol and commit.
