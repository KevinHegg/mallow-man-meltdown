# Review 1 — prompt2 (into-the-horizon valley view)

Date: 2026-10-02 ~00:05 EDT. Commit reviewed: 38c6fce6 (prompt2).
Review type: code-only — no live build deployed yet (Netlify URL 404s), so no
screenshot verification was possible.

## What landed
- `src/view/Projector.js` — clean pseudo-3D projector, correct perspective
  math, decorative camera sway, gameplay stays on the 2D plane. Good design.
- `src/view/Valley.js` — pooled building billboards on both walls, recycling,
  haze, streaming striped ground, horizon mountains + pink clouds.
- `src/view/Pools.js` — object pooling. Real mobile-perf thinking.
- PROGRESS.md correctly marked DONE. Commit message honest about scope.

## Verdict
Spec compliance: excellent — everything prompt2 asked for is present.
Code quality: good — clean view/ separation, no gameplay/visual coupling.

Depth score: 3/5 (provisional, code-only). The architecture for depth is
right, but two risks are unverifiable without a screenshot: (1) flat
billboards can read as cardboard cutouts near the camera, (2) a straight
valley with a static glider still risks the "diorama sliding past" feel.

Flattest on-screen element: the glider itself — it never banks, pitches, or
reacts to motion, and nothing ever passes overhead.

## Next
prompt3 targets exactly that: banking, climb/dive pitch, curving valley,
fly-under arches, layered parallax. Visual review unblocked once the Netlify
deploy is connected.
