# prompt5 — the boss fights back

The Marshmallow Man already has a staged rig (PRISTINE → SAGGING →
ARM OFF! → COLLAPSING → MELTED!, per-stage hitboxes in
`src/objects/MarshmallowMan.js`). Now make each stage *fight* differently
and *melt* visibly. He is the title character — this is the emotional
core of the game.

- Stage attack behaviors (work through the existing projectile system;
  keep all damage and goo numbers exactly as they are — behaviors only):
  - PRISTINE (smug): slow, aimed marshmallow throws at the glider.
    Confident, unhurried.
  - SAGGING: splash arcs — lobbed goo bursts that explode mid-flight into
    a widening splatter zone, harder to dodge cleanly than a straight
    throw.
  - ARM OFF! (desperate): the remaining arm swats at close range when the
    glider gets near, plus faster, wilder throws. He should read as angry
    and scared.
  - COLLAPSING: sluggish and feeble — slow drooping throws, long pauses,
    more drips than attacks.
- Melt drama (visual): drips and sloughing particles increase per stage;
  at the ARM OFF! transition the arm visibly detaches — fling it with a
  goo burst (the stump sprite already exists in the rig); a melt puddle
  grows beneath him per stage.
- Keep the per-stage hitboxes exactly as they are. Keep staging HP
  thresholds unchanged.
- Bigger glider (Kevin's call, agreed): scale the glider's ART up about
  one-third so the banking, goo coat, list and wobble read clearly — it is
  currently a postage stamp and all of prompt3/4's expressive work is lost
  at that size. Art scale only: hitbox, aim and all mechanics unchanged.
  Verify the bigger art doesn't overlap the BOOST/SHAKE buttons.
- Mobile perf: pooled particles, capped counts, no per-frame allocations
  in the hot loop.

Acceptance: each boss stage has a visibly distinct attack pattern and
melt state; the arm detachment reads clearly; the puddle grows per stage;
zero console errors; boss HP thresholds, hitboxes, damage and goo numbers
unchanged. Then write prompts/prompt5-response.md per the protocol and
commit.
