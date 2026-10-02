# prompt7 — paint the world

Kevin's direction: get closer to the movie-poster look — painterly
richness, light and atmosphere, not flat shapes. Prompt6 built the
structure (lumps, frosting helpers); now light it. Still 100%
procedural — no external assets. All new detail baked into textures at
boot, so there is no new per-frame rendering cost.

- Boss: make him look *lit*. Stronger top-light gradient on each
  marshmallow lump, ambient occlusion darkening in the seams between
  lumps, glossy specular highlights on the frosting mortar. Keep the
  toasted top and the face exactly as they are.
- Goo: make it look wet — glossy highlight on splats, drips and
  projectiles, a hint of translucency. Matte green reads as paint;
  glossy green reads as slime.
- Clouds: rebuild cloud puffs with volume — layered blobs with shaded
  undersides instead of flat ellipses. The boss's cloud is his throne;
  give it presence. Keep the pastel sky, just give it a touch more depth
  (don't muddy it).
- City: dress the building facades with the prompt6 frosting helpers —
  frosting trim on roofs, piped details — to break up the flat facades.
- Atmosphere: strengthen the distance haze slightly; add soft drop
  shadows under the boss's cloud and under near-field buildings.
- Keep everything else: hitboxes, behaviors, numbers, staging,
  mechanics. Art only. Sprite counts sane.

Acceptance: the boss looks lit and dimensional rather than flat; goo
looks wet; clouds have volume; the response file includes screenshots
showing the difference; zero console errors; no new per-frame cost.
Then write prompts/prompt7-response.md per the protocol and commit.
