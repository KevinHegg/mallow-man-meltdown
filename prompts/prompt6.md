# prompt6 — the boss, rebuilt from marshmallows

Kevin's direction: the Evil Marshmallow Man should look *constructed* —
individual marshmallows glued together with frosting mortar. Right now he
is smooth single-piece sprites: charming but plain. Make him more
interesting, more detailed, more convincing. This is a re-skin, not a
re-rig.

- Keep the entire rig and behavior layer untouched: `buildBossRig` part
  structure, the pose object and its tweens, per-stage hitboxes, the arm /
  stump detachment, all four stage attack behaviors from prompt5, HP
  thresholds, damage and goo numbers. Only the art changes.
- Marshmallow lumps: build the body, head, arms and legs from visible
  individual marshmallow lumps — rounded, slightly squashed cylinders in
  off-white with soft shading, sizes varied a little. The lumps must read
  as separate pieces, not one smooth blob.
- Frosting mortar: glossy pinkish-white frosting blobs at every joint —
  neck, shoulders, elbows, wrists, waist, knees — with a few small drips.
  This is the "glue" and should read clearly at arena scale.
- Keep the toasted golden-brown top of his head (it already reads well)
  and the thick angled brows / toothy grin (his character). Add surface
  interest: subtle lump shading, a frosting smear or two, maybe replace
  the flat pink belly swirl with a piped frosting swirl.
- Two scales: he must read at horizon distance in the flight scene
  (small) AND up close in the boss arena (large). Don't make the lumps so
  small and fiddly they turn to noise at distance — silhouette first,
  detail second.
- The melt stages must still read on the new art: SAGGING droop via the
  existing pose, increasing drips/sloughing (already implemented), ARM
  OFF! stump showing frosting and torn marshmallow.
- Procedural textures only (`src/art/textures.js`) — no external assets.
- Mobile perf: keep sprite counts sane; reuse pools.

Acceptance: the boss visibly reads as marshmallows joined by frosting
mortar; he is more detailed and convincing at both horizon and arena
scale; all four melt stages, the arm detachment, and all stage behaviors
still read and behave exactly as before; zero console errors. Include
screenshots at both scales in prompts/prompt6-response.md per the
protocol, then commit.
