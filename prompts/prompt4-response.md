# prompt4 response — goo you can feel

Implemented by Claude Code (Opus 5.5), 2026-10-02. Visualization only: no goo or penalty
number, control, or mechanic changed (verified below).

## What changed

- **`src/objects/GooCoat.js` (new).** A fixed pool of 17 slime sprites at anchor slots on
  the glider's wings, fuselage and tail, living in the glider's `gooLayer`, so they ride
  the prompt3 bank/pitch transforms. A coverage value (0–1) is derived from the goo total
  and banded so each tier has its own look the moment you enter it:
  - DUSTED: small drips hanging under the wings.
  - SPLATTERED: distinct blobs on both wings and the fuselage.
  - CAKED: heavy slime sheets (new `gcoat` texture) over wings, fuselage, tail and nose.
  - The heavier side fills first (slot thresholds shift by the goo's weighted mean side).
  - Fresh hits make nearby blobs bulge.
  - Drips are emitted from visible blobs at the same rate goo drips off (`goo * 1.4` per second, as before).
- **`src/objects/Glider.js`.**
  - Per-splat `Image`s and the tween-based `flingGob` are replaced by the pooled coat. The splat
    *data* (`{ m, ox }`), merge rule, drip-off rate, mass, torque, list, sink, drift and the
    mechanical `roll` used for aim and the hitbox are untouched.
  - New art-only transform (`applyArt()`) on top of the physical roll:
    - The prompt3 flight bank/pitch.
    - A list toward the gooey side that grows with tier (0 / 0.05 / 0.12 / 0.20 rad; toward the last hit side when goo is centred).
    - A wobble that grows with tier (0 / 0.025 / 0.05 / 0.06 rad).
    - A squash-and-stretch shudder while shaking.
  - Smaller changes:
    - Shake starts a staged fling: blobs come off one by one over the first 60% of the wobble window, as particles.
    - Boost flings the shed portion.
    - `cleanAll()` flings everything.
  - Removed a per-frame `filter()` allocation in `updateGoo` (now an in-place splice). Same behaviour.
- **Goo is green now** (`PAL.goo` / `PAL.gooDeep` in `src/config.js`). DESIGN.md specifies
  "green slime inside, a Ghostbusters nod"; the scaffold had used icy blue. This also
  recolours the goo-mallow projectiles' ooze, splats and drips. City frost stays icy blue.
- **`src/ui/helpers.js`.**
  - New pooled `gob` emitter (flung blobs).
  - Particle caps via `maxAliveParticles: 40` on `gob` and `drip`.
- **`src/ui/Hud.js`.** The CAKED vignette is a soft green edge glow baked once per screen size
  into a texture (`vignette_WxH`). At runtime only its alpha changes: it eases in and pulses
  (~0.3–0.9) while CAKED, then fades out. It's in the HUD, so it works in Flight and Boss.
- **`src/art/textures.js`.** New `gcoat` slime-sheet texture.

## Verification

Environment:
- Claude desktop app's in-app browser, `npm` dev server (Vite) on localhost.
- Booted under mobile emulation (375×812), so the game sized itself to a portrait 540×1169 canvas.
- Screenshots were then taken at the pane's desktop size, where that canvas letterboxes.
- The preview pane is hidden, which throttles `requestAnimationFrame` to ~2 fps. So the game loop was
  paused (`__game.loop.sleep()`) and frames were driven by browser-console scripts calling
  `__game.step(t, 16.67)`, paced with 16 ms timeouts so Phaser's wall-clock tweens stay in sync.
- Close-ups used a temporary camera zoom (`cameras.main.setZoom(3.2)`), reset afterwards.
- Not tested on a physical phone.

Goo was applied through **real Matter collisions**: a goo-mallow spawned 140 px above the
glider falling at 420 px/s (`s.goo.spawn(gl.x + dx, gl.y - 140, 0, 420)`), with obstacle,
goo, pickup and arch spawning disabled for the test.

| Criterion | What I did | Observed |
| --- | --- | --- |
| Hits coat the glider more each tier | 1 hit, then 2, then 4; read visible slots + screenshots | DUSTED (goo 1.01): 3 wing drips. SPLATTERED (1.96): 4 drips + blobs on both wings and fuselage. CAKED (4.16): 13 sprites incl. both wing sheets; plane mostly hidden under slime. |
| Lists and wobbles by tier | Read `artList`, `artWobble`, and the sprite's extra rotation over 60 frames | artList 0.04 → 0.105 → 0.198 rad. artWobble 0.016 → 0.039 → 0.059. At CAKED the art swung 0.142–0.261 rad. |
| Drips fall off over time | `fx.drip.getAliveParticleCount()` while gooed | 5–11 drops alive at DUSTED–CAKED; capped at 40. Screenshots show green drops falling away behind the glider. |
| SHAKE flings goo, wobbles, ends clean | **Real click on the SHAKE button** while CAKED; traced 70 frames | Shakes 2→1. Coat 13→8→4→0 sprites within ~0.5 s. Flung particles peaked at 26 (cap 40). The existing shake wobble played (view roll swinging −0.24…+0.34) and firing was blocked for 0.9 s. After: goo 0, tier CLEAN, vignette 0. |
| CAKED edge vignette | Read `hud.vignette.alpha` + full-frame screenshot | 0 at DUSTED/SPLATTERED; at CAKED it pulsed 0.36–0.78 (green edge glow visible in screenshot). |
| Penalties and mechanics unchanged | `git diff src/config.js` + the prompt1 step-response test (time to cover 135 of a 150 px steer, goo centred) | Config diff is only the two goo colours. Response times 0.45 / 0.58 / 0.70 / 0.85 s (clean / 1.2 / 2.4 / 4.4 goo), identical to the scaffold's measurement. |
| Aim and hitbox still use the physical roll | Compared `tryFire().angle`, `body.angle`, `roll` and sprite rotation | shot angle = roll − π/2 exactly; body.angle = roll = 0.0155 while the art carried an extra 0.20 rad. |
| Death spiral intact | Caked, boosts = shakes = 0, stepped 170 frames | Stall 2.62 s → spiraling = true (stall time 2.6 s, as before). |
| Boss scene | `?scene=boss`, 4 collision hits | CAKED, 13 coat sprites, vignette 0.55, art lean 0.22, drips falling. |
| Zero console errors | `read_console_messages` (errors only) after the Flight and Boss runs | None. `npm run build` clean. |

## Deferred or skipped

- **Shake window stays 0.9 s.** DESIGN.md says "~1.5s vulnerable wobble". The prompt said to
  leave shake cost and cooldown unchanged, so I did. Worth a tuning decision.
- **Visual coat lags the mechanics on shake, by design.** Goo is mechanically cleared at the
  start of the shake (as before). The visible coat comes off over the first ~0.54 s of the
  wobble, so it reads as being flung.
- **Two layers of list.** The physical list (torque-based, drives drift and aim) already
  existed and is unchanged. The new art list is an extra, readable lean that grows with tier.
  When goo is perfectly centred it leans toward the last hit side.
- **One small per-frame allocation left.** `ShadowPool.sync` (prompt2) still iterates a `Set`
  with `for…of` (one iterator per call). Not touched here.

## Notes for the next prompt

- **Correction to review-2.** The ntfy workflow and the GitHub Pages deploy weren't unprompted.
  Kevin asked for both. Kevin doesn't use the ntfy app; the workflow posts to a secret topic
  (`NTFY_TOPIC`) and is harmless if unused.
- **DESIGN.md items not built yet:**
  - Residents tossing boost bubbles from windows.
  - Candy-cane thermals (lift + faster drip).
  - The slingshot launch.
  - The boss's stage-2 splash arcs and stage-3 close-range swats.
  - "No HUD bars": the progress bar and melt-o-meter are still HUD bars.
- **Still the flattest elements (per review-2):** near-field billboards and the plain ground between road and walls.
- **Open from prompt2:** distant goo is drawn small but keeps its full-size hitbox.
