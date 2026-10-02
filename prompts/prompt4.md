# prompt4 — goo you can feel

The depth work is landing. Now give the game its mechanical identity: goo
is mass, not HP (DESIGN.md). The tiers already exist numerically (DUSTED /
SPLATTERED / CAKED) with handling penalties — but on screen the glider
looks the same at every tier. Make goo visible and physical. Numbers and
penalties stay exactly as they are; this prompt is visualization only.

- Goo accumulation: green goo splats visibly build up on the glider with
  tier — DUSTED: a few drips on the wings; SPLATTERED: distinct blobs on
  wings and fuselage; CAKED: a heavy coating. Use pooled sprites attached
  to the glider (visual only, they ride the banking/pitching transforms).
- The list: the glider visibly lists to one side as tier rises, plus a
  gentle wobble oscillation that grows with tier. This mirrors the existing
  handling penalty — do not change any penalty numbers, just make the
  penalty readable on screen.
- Time cleanse, made visible: goo slowly drips off the glider over time —
  small green drip particles falling away and fading, pooled and capped.
- Shake: shaking flings the goo blobs off as particles, plays the wobble
  animation during the vulnerable window, then the glider is clean. The
  existing shake cost/cooldown is unchanged.
- CAKED warning: a soft pulsing green vignette at the screen edges while
  at CAKED tier — the "you are barely flying" signal.
- Mobile perf: reuse existing pools, cap particle counts, no per-frame
  allocations in the hot loop.

Acceptance: on a portrait phone viewport, taking goo hits visibly coats
the glider more with each tier; the glider lists and wobbles accordingly;
drips fall off over time; pressing SHAKE flings goo off with the wobble
animation and leaves the glider clean; CAKED shows the edge vignette;
zero console errors; all penalty numbers, controls, and mechanics behave
exactly as before. Then write prompts/prompt4-response.md per the
protocol and commit.
