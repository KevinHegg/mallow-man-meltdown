# prompt5 response — the boss fights back

Implemented by Claude Code (Opus 5.5), 2026-10-02. Behaviour and visuals only. HP thresholds,
hitboxes, bean damage and all goo numbers are unchanged (verified below).

## What changed

- **`src/objects/MarshmallowMan.js`**
  - **Per-stage attack style** (`STYLE`, `release()`):
    - PRISTINE (smug): one slow, aimed throw at the glider (flight 0.75–1.4 s), about every 2.2 s, with a long unhurried wind-up.
    - SAGGING (sloppy): a lobbed goo bomb. 65% of them aim to burst over the glider, 35% over a city building (DESIGN.md: "splash arcs rain on the city"). It bursts at 55–60% of its arc into 3 pieces that fan apart at ±120 px/s, roughly every 2.4 s.
    - ARM OFF! (desperate): fast, wild throws (aim error ±70 px, often two at once, about every 0.95 s), 25% flung at the city.
      - **Swat:** when the glider comes within 300 px of his chest he sweeps his remaining arm and sprays 4 goo globs at you. They're fast but only last 0.6 s, so they're close-range only. 1.8 s cooldown.
      - Reads as angry and scared: his eyes switch back to angry, he trembles, and sweat beads fly off his head.
    - COLLAPSING (feeble): slow drooping lobs that barely lift the arm, about every 3 s, half of them falling short below the glider.
  - **Melt drama:**
    - Marshmallow drips per second rise by stage (0.4 → 2.5 → 4 → 8), and chunks of marshmallow start sloughing off from SAGGING on (0 → 0.6 → 1.2 → 2.2/s).
    - The melt puddle now grows every stage (0 → 0.35 → 0.65 → 1, then 1.5 when he melts); it used to appear only at COLLAPSING.
  - **Arm detachment:** the arm is now flung harder (up and away, spinning faster). A burst of green goo, marshmallow drips and puff comes from the shoulder, with a heavy camera shake and a burst sound. The boss jolts from the recoil, and the arm trails goo and drips as it falls. The existing stump sprite shows.
- **`src/scenes/BossScene.js`**
  - Every attack is still an ordinary goo-mallow from `GooMallows.spawn`, with the same random goo amount per hit. Bombs and swat globs are tracked in plain arrays with in-place removal.
  - Bombs fizz (tint flicker) for 0.4 s before bursting into splatter pieces. The pieces use the green splat art at 0.8 scale, so their collision circle is 15 px instead of 19.
  - Swat globs disappear in a puff of drips when their 0.6 s is up.
- **`src/ui/helpers.js`**
  - New capped emitters: `slough` (16) and `sweat` (12).
  - The boss's marshmallow drips are now capped at 50.
- **`src/sfx.js`**: new `burst` and `swat` sounds.
- **`src/objects/Glider.js`** (Kevin's bigger glider): the art container is scaled by 4/3 (`ART_SCALE`). The Matter hitbox (92×40) and the aim maths don't use that container, so they're unchanged.
- **`src/ui/Hud.js`**: BOOST/SHAKE now fade to 45% while the glider's art is underneath them (see Verification → bigger glider).

## Verification

Environment:
- Claude desktop app in-app browser, Vite dev server.
- Booted under mobile emulation, so the canvas was a portrait 540×1169; screenshots were taken at desktop pane size.
- Frames were driven with `__game.loop.sleep()` + `__game.step(t, 16.67)`, paced 16 ms apart so Phaser's wall-clock tweens (wind-ups, swats) run at real speed.
- The boss's `emit('throw')`, `swat()` and the scene's `burstBomb()` were wrapped to log every attack with its time, stage and kind.
- Stages were reached by calling `boss.hit()`, the real damage path, 25 times per stage.
- While observing each stage, the glider's goo was cleared every frame and city frost zeroed, so the run couldn't end. That's harness only; nothing in the game was changed for it.

| Criterion | What I observed |
| --- | --- |
| PRISTINE pattern | 8 s at a distance: 4 throws, all single aimed lobs, 2.0–2.4 s apart, mean launch speed 264 px/s. Screenshot: wind-up with a goo-mallow in hand. |
| SAGGING pattern | Every throw was a burst bomb, about 2.5 s apart. Captured a burst: 3 pieces fanned out (x 151 / 183 / 215 at y≈420, spreading) plus a goo spray. When the bomb bursts right above the glider, the splatter lands on it. |
| ARM OFF! pattern | Far away (5 s): 7 throws, mean launch speed 543 px/s (about 2× PRISTINE), 0 swats. Up close (5 s, glider ~40 px from his chest x): 3 swats spraying 12 globs; screenshot shows the sweep hitting the glider (DUSTED). Sweat particles up to 3 alive. |
| COLLAPSING pattern | 9 s: 3 throws, 3.15 s and 3.02 s apart, mean launch speed 158 px/s, 0 swats. Drips hit the 50 cap (drips outnumber attacks). Dizzy eyes. |
| Arm detachment reads | At the transition: arm hidden, stump visible, debris flung up and left and spinning, 22 goo-burst particles alive, recoil jolt, eyes angry. The screenshot shows the arm mid-air above his shoulder with green goo spraying out. |
| Puddle grows per stage | `pose.puddle`: 0 → 0.35 → 0.65 → 1.0 at stages 0–3, visible on the cloud in each stage's screenshot. |
| HP thresholds unchanged | Stage changes logged at hp 75 / 50 / 25 / 0 (of 100). |
| Hitboxes unchanged | Boss sensor bounds per stage: 153×255, 162×230, 161×208, 179×157. These equal the `HITBOX` table × 0.85, and `git diff` shows no change to that table. |
| Damage and goo numbers unchanged | `git diff --quiet src/config.js src/objects/Projectiles.js` → unchanged. `hit()` still removes 1 HP per bean. Every boss attack spawns through `GooMallows.spawn` (goo per hit still 0.95–1.25). |
| Win flow intact | After hp 0: melt-away → fluff flood → End scene. |
| Zero console errors | No errors in either run (stage-by-stage, and the full real-time fight). `npm run build` clean. |
| Bigger glider, art only | Art 149×85 px (was 112×64); Matter hitbox still 92×40. |
| Bigger glider vs BOOST/SHAKE | Swept every reachable glider position at 10 px steps, measuring art bounds against the 42 px button circles. Flight: home position, bottom-centre and the side mid-points are all clear. Overlap only happens in the bottom corners (lowest ~100 px at the far left or right): 9.3% of reachable positions. At the **old** size the same sweep gave 6.6%, so this already existed and is now slightly larger. Boss arena: 6.7%, again only in the bottom corners. Mitigation: the covered button fades to 45% so the glider shows through (verified: bottom-left → BOOST 0.45, bottom-right → SHAKE 0.45, home → both 1.0; screenshot taken). |

**Balance check** (same tapping bot as in the scaffold: fires every 0.25 s, dives in 2 s and out 1.5 s, cleanses only when CAKED, real-time pace):

| | Old boss | New boss |
| --- | --- | --- |
| Win time | ~40 s | 62 s |
| City frost peak | 31% | 39% |
| Splats taken | 5 | 10 |

Time in each stage: PRISTINE 12 s, SAGGING 18 s, ARM OFF! 18 s (frost +25%, the bulk of the city pressure), COLLAPSING 14 s. Harder but clearly winnable.

## Deferred or skipped

- **Corner overlap isn't fully gone.** Removing it entirely needs either moving the buttons onto the city strip (which would hide the corner buildings' frost, the lose meter) or tightening the glider's flight bounds (a mechanics change). Neither is in scope, so I faded the buttons instead. A layout call for Finch/Kevin.
- **Swat effect is goo, not knockback.** It works through the existing projectile system: sprayed goo globs carry the normal goo amount. Contact with the boss body still does the old bonk plus 1.1 goo.
- **Splatter pieces have a smaller collision circle** (0.8×, 15 px instead of 19 px), so the fan reads as smaller bits. Goo per hit is unchanged.
- **Throw timing changed on purpose**, since the prompt asked for unhurried, faster/wilder and long-pause behaviour. Intervals were 1.9 / 1.6 / 1.4 / 1.2 s and are now 2.2 / 2.4 / 0.95 / 3.0 s. The old 35% triple-volley at stage 2+ is replaced by these patterns.

## Notes for the next prompt

- **ARM OFF! dominates city frost** (+25% in one stage in the bot run). To ease it, the first knob is its 25% city-throw share or the 0.95 s interval.
- **Harness note: screenshots can lag.** In the preview pane they sometimes show a frame from before the last few steps. I waited about 1 s before capturing the ones that mattered (the splash burst and the arm detach).
- **Still open:**
  - The shake window is 0.9 s, but DESIGN.md says ~1.5 s.
  - The progress bar and melt-o-meter are still HUD bars, against DESIGN's "no HUD bars".
  - Distant goo in Flight keeps its full-size hitbox.
- **DESIGN items not built:**
  - Residents tossing items.
  - Thermals.
  - The slingshot launch.
  - "Gallons of marshmallow" as the score.
