# prompt1 — scaffold the repo (DONE)

Project: Mallow Man Meltdown (working title) — a G-rated, smartphone-first,
portrait mobile web game. Stack: Phaser 3 (latest) + Matter physics (built
into Phaser), Vite for dev/build, JavaScript.

The game in one paragraph: a candy-land flight game. The player steers a toy
glider (drag on a 2D plane: left/right/up/down) through a candy canyon toward
a giant Evil Marshmallow Man perched on a cloud. Tap to fire jelly beans —
jelly beans melt marshmallow, so hit-and-run dives melt him through 4 visible
stages (pristine → sagging → arm sloughs off → collapse). He hurls goo-filled
marshmallows: goo splats add mass and yank the plane's center of gravity
sideways (tiers: dusted / splattered / caked). Clean goo by time (drips off),
bubble boost (partial shed + altitude), or shake (full clean, limited charges,
brief vulnerable wobble). Goo also visibly freezes city buildings below —
spreading frost is the lose meter. Win: melt the boss, fluff-flood finale.
Lose: death spiral (caked + no cleanses left → spin/crash) or city frosted.

Scaffold:
- Vite + Phaser 3 project. Portrait mobile viewport: viewport meta,
  touch-action none, prevent scroll/zoom, orientation hint overlay.
- Scenes: Boot, Flight (the journey), Boss (cloud arena), End (win/lose).
- All placeholder art procedural via Phaser Graphics — candy palette
  (sugar-cube towers, gumdrops, licorice, marshmallow white/pink). No external
  assets. Tiny synth SFX via WebAudio, no audio files.
- Playable stubs: drag steering, tap-fire jelly beans, limited boosts, goo
  tiers visibly slowing/listing the plane, shake, 4-stage boss melt via
  tweens, win/lose states.

Acceptance: `npm run dev` opens a portrait phone-size game with zero console
errors. I can steer the glider with mouse/touch drag, fire beans, watch goo
visibly degrade handling, and reach a placeholder boss that sags through 4
stages into a win screen.

Constraints: simpler than a 3D physics puzzler — 2D planar gameplay only;
depth is decorative parallax, never mechanical. G-rated. Static build must
deploy to Netlify free tier.
