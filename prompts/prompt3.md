# prompt3 — flight feel: banking, climbs/dives, curving valley, arches

prompt2 gave us the valley; right now it reads as a diorama sliding past. The
glider never banks, never climbs or dives visually, the valley runs straight,
and nothing ever passes overhead. Make it feel like flying THROUGH a world.
Gameplay stays planar — everything below is visual only; hitboxes and
controls are untouched.

- Banking: roll the glider sprite (rotation, about ±0.35 rad max) proportional
  to lateral velocity, smoothly lerped so it eases in and out of turns. Shift
  the projector's camera sway a touch further in the turn direction so the
  world leans with the glider.
- Climb/dive: pitch the glider slightly with vertical velocity and move the
  horizon a few pixels (climb → horizon drops, dive → horizon rises), lerped.
  Add pooled wind-streak particles (short white speed lines) streaming past;
  their spawn rate and opacity scale with the glider's total speed.
- Curving valley: the flight path bends gently. Add a curve function of
  distance traveled (slow summed sines, gentle amplitude) and offset each
  building billboard's projected x by the curve value at its depth. The
  camera sway follows the local curve so the player feels steered through
  bends. Keep it decorative — the gameplay plane does not move.
- Fly-under arches: candy-cane / licorice arch billboards spanning the valley
  every ~25–35 seconds of flight. They stream in from the horizon, grow past
  scale 1, pass overhead, and recycle. Decorative only — no collision — but
  they are the single strongest "through-ness" cue.
- Layered parallax: split the horizon into two mountain layers drifting at
  different rates, plus a few distant giant lollipop-tree silhouettes on the
  far ridge. Clouds keep drifting as now.
- Mobile perf: reuse the existing pools, cap particle counts, no per-frame
  allocations in the hot loop.

Acceptance: on a portrait phone viewport, holding left/right visibly banks
the glider and leans the world; holding up/down pitches the glider and moves
the horizon; the valley visibly curves over distance; at least one arch
passes overhead every ~30 seconds of flight; wind streaks appear at speed;
zero console errors; all prompt2 visuals and all mechanics play exactly as
before.
