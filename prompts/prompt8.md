# prompt8 — the slingshot launch

Right now the game opens on a "CLICK TO FLY!" title card — the weakest
five seconds in the whole experience. DESIGN.md calls for a slingshot
launch. Make the opening a toy moment worthy of the rest of the game.

- The scene: the glider sits in a big candy slingshot — candy-cane
  forks, frosting bands for the elastic, maybe a gumdrop base. It should
  look like a toy a kid would own.
- The gesture: the player drags back (pointer/touch) to stretch the
  bands, aims slightly, and releases. Show the stretch, the aim, and a
  satisfying release — wobble, a boing sound, frosting stretch on the
  bands.
- The fling: the glider launches into the valley with a burst of speed
  that decays into normal cruise. The launch grants a small early speed
  boost — it teaches the boost feel for free.
- The transition: the slingshot stays behind as the valley streams
  forward; cut seamlessly into the normal flight scene. No loading, no
  jank.
- Fast and forgiving: nobody waits more than a couple of seconds. A
  plain tap (no drag) launches at a sensible default pull. Skippable by
  design, not by menu.
- Mobile: the drag must work with thumbs; keep clear of where the
  BOOST/SHAKE buttons will appear so there's no gesture conflict.

Acceptance: dragging back stretches the bands and shows aim; releasing
flings the glider into the valley with a speed burst; tap-only launches
cleanly at the default; the flight transition is seamless; zero console
errors; the flight scene, boss scene, and all mechanics behave exactly
as before. Then write prompts/prompt8-response.md per the protocol and
commit.
