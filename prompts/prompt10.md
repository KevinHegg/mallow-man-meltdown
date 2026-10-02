# prompt10 — the bail-out (finale, part 1)

The boss fight is a disconnected arena where the plane hovers
statically — odd, and Kevin's call is to integrate it. New finale with
no hard transition: the flight FLIES INTO the boss's cloud, the pilot
bails out, and the fight happens on a rooftop in the same world.

- The arrival: at the end of the flight the glider reaches the boss's
  cloud. Beat: the pilot — a gingerbread man, they're already in this
  world — bails (candy parachute or a brave hop) and lands on a nearby
  rooftop. The glider is left behind; its journey is over. This must read
  as one continuous arrival, not a scene cut.
- The rooftop: a candy building roof — frosting surface, candy-cane
  railings, chimneys/vents as cover. Same city, same art style, no break.
- The pilot: runs left/right on the rooftop (simple touch controls),
  armed with a jelly-bean machine gun — hold to spray jelly beans. Beans
  do the same damage per hit as glider shots. Keep the pilot's goo
  simple: goo slows him, SHAKE still cleanses.
- The boss looms over the rooftop at giant scale: same rig, same four
  melt stages, same stage attacks from prompt5, retargeted at the
  rooftop (throws, swats, splash arcs all work against a grounded
  target).
- Kill the horizontal bars: remove MELT-O-METER and TO THE CLOUD, per
  DESIGN.md's "no HUD bars". The boss's staged body is the health bar;
  arrival at the boss was the progress bar. Nothing replaces them.
- Update DESIGN.md's finale section to describe the bail-out, replacing
  the old arena-transition description.
- Mobile perf: pooled everything, capped particles, as always.

Acceptance: the flight flows into the cloud and the bail-out reads
clearly; the rooftop fight plays (pilot movement + machine gun); all
boss stages and behaviors intact; both bars gone; DESIGN.md updated;
zero console errors. Then write prompts/prompt10-response.md per the
protocol and commit.
