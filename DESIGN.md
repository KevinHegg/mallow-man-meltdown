# Mallow Man Meltdown (working title) — design notes, 2026-10-01

Repo: `mallow-man-meltdown`. Name decided 2026-10-01 as the development
throughline (may change before ship). Casualties along the way: Mallowfall
(taken by an adult visual novel), Mallow Melt (Roblox crop), Goo Patrol (PS5
game), Fluffpocalypse (too hard to spell — Kevin's call).

## Stack (recommended 2026-10-01)
- **Phaser 3 + Matter physics (built into Phaser), Vite.** One framework covers
  rendering, touch input, particles, tweens, audio, and scenes; Matter handles
  the sugar-cube toppling. Best mobile-web track record, fastest to playable.
- Alternative: PixiJS + Matter.js — lighter, more control, but input/audio/
  scenes get wired by hand.
- Deliberately NOT Three.js/Rapier: 3D cost without 3D gameplay need. The
  gameplay is 2D planar (depth decorative only); 2.5D look comes from parallax.
  "Simpler than The Great Fall" is a hard constraint.
- Fake the tricky physics smartly: goo = particles + a debuff number (not
  fluid sim); boss melt stages = tweens + sprite swaps (not soft-body).

A G-rated, smartphone-first (portrait, one-thumb) candy-land flight game.
Simpler than The Great Fall by design.

## Fantasy
You are a glider pilot defending Candy City from the Evil Marshmallow Man,
a giant perched atop a cloud, hurling goo-filled marshmallows (green slime
inside, a Ghostbusters nod) at you and the city. Nothing dies; the finale is
dessert.

## Core loop
Slingshot launch → glide the candy canyon (dodge goo volleys, catch items
from residents, ride candy-cane thermals) → fly into his cloud and bail out →
melt the boss from a rooftop → his fluff-flood thaws the frozen city. Victory
is measured in gallons of marshmallow.

## Controls (planar, crisp)
- Portrait phone, one thumb. Steering is left/right (+ up/down) on a single
  readable 2D plane — depth is decorative, never mechanical.
- Drag to steer, tap/hold to fire jelly beans, tap to boost.
- Auto-climb baseline; thermals give lift.
- On the rooftop (finale): drag to run left/right, keep your thumb down to
  spray jelly beans, tap SHAKE to cleanse. Same thumb, same feel.

## The goo (enemy debuff — no HP anywhere)
Goo marshmallows explode into slime. A hit doesn't subtract health; it changes
the flight model — added mass, center of gravity yanked sideways. A splat on
the left wing lists you left. Players feel it in their thumb.
- **Dusted** (graze): mild pull, drips off in seconds. Free.
- **Splattered** (direct hit): strong list, ~10s of ugly flying.
- **Caked** (hits stack): barely controllable.
- Goo on the city **freezes** buildings and residents (frost tint, stillness) —
  the city's spreading frost is the visible lose meter. No HUD bars: the world
  is the interface.

## Cleanses (three verbs, three currencies)
- **Time**: goo slowly drips/melts off. Costs patience.
- **Bubble boost**: exhaust blast sheds a *portion* of goo (+ altitude/dodge).
  Costs a precious boost.
- **Shake**: violent shudder, goo flings off in chunks. *Complete* clean, limited
  charges; while shaking you can't climb or aim (~1.5s vulnerable wobble).
  Costs tempo.
- Candy-cane thermals passively speed the drip (already canon for lift — free).
- Rule: more goo → shaking more necessary. Never contrived: exhaust blasts
  stuff off, shaking flings stuff off, time drips stuff off. Everyone has
  shaken mud off a boot.

## Lose conditions (both visible in the world)
1. **Personal**: caked in goo with no boosts/shakes left → unrecoverable list →
   spin or bank into a sugar-cube tower (comedic crash, G-rated).
2. **City**: frost overruns too much of the city → frozen over, even if you're
   flying fine.
The two interact: all self-preservation lets the city freeze; all defense
leaves you goo'd. That tension IS the game.

## The boss: Evil Marshmallow Man
- Perched atop his cloud, looming over the city. Jelly beans melt marshmallow
  (established by the game's own rules); on the rooftop the pilot's
  jelly-bean blaster sprays them in bursts, so you dart under him, unload,
  and dodge.
- **His body is his health bar** — staged melting, no HUD:
  1. Pristine and smug: aimed goo-marshmallow throws at you.
  2. Sagging, dripping: gets sloppy, splash arcs rain on the city (frost clock).
  3. Arm sloughs off: wild desperate swats (his close-range answer — on the
     rooftop he swats straight down at you when you stand right under him:
     the boss dance is dart in, unload, dodge the swat).
  4. Total collapse: the money shot.
- **Cotton-candy sticky traps** (his integrated attack — works in late flight
  *and* on the rooftop): he flings a pink spun-sugar blast that bursts into a
  sticky zone — a hanging cloud in the flight lane, a splattered patch on the
  roof. Caught in one you're held, not gooed: no tiers, no mass, just stuck
  until it dissipates (~8 s); a boost tears you free in flight. Trap-plus-goo
  is the real danger, since held means you can't dodge.
- Residents toss boost bubbles and jelly beans from windows as you pass —
  fly close to catch (risk/reward: close to buildings is where flak is thick).

## Finale: the bail-out (no arena, no cut)
- **Arrival:** the flight ends by flying *into* the boss's cloud. The pilot —
  a gingerbread man, he's from this world — bails out under a candy
  parachute; the empty glider sails on into the cloud, its journey over. He
  drifts down through the cloud and out of it onto a candy rooftop. One
  continuous arrival: the cloud is the only "transition".
- **The rooftop:** a roof in the same city and art style — frosting surface,
  candy-cane railing, gingerbread chimneys. Chimneys are cover: behind one, goo
  can't reach you, but you can't shoot either. The rest of the city (and its
  frost) is right there behind the roof.
- **The fight:** the boss looms over the roof at giant scale, same rig, same
  four melt stages and attacks, aimed at a grounded target: aimed throws,
  splash bombs that burst over you, the ARM OFF! swat straight down, feeble
  lobs. Throws at the city still frost it. The pilot runs and sprays beans;
  goo slows him, SHAKE cleans him. No bars: his body is his health bar.
- **Payoff:** he collapses into liquid marshmallow that floods the streets —
  and the warm fluff **thaws the frozen residents**. His defeat heals the
  battle. The pool is the score screen: your performance, measured in
  gallons, over a saved city.

## Design principles (from the brainstorm)
- Legibility over cleverness: if a mechanic needs a tutorial sentence, cut it.
- Depth decorative, never mechanical. No HP bars — bodies and frost are the UI.
- Every verb does double duty (boosts: altitude/dodge/cleanse; goo: debuff +
  city-freeze; melt pool: punchline + cure).
- Simpler than The Great Fall: three verbs, two resources, one thumb.

## Open questions
- Shake charges vs. tempo-only cost (tuning will decide).
- Slingshot launch vs. auto-start (launch is a nice ritual; keep if cheap).
- 2.5D camera: three-quarter chase vs. pure side-view for the journey.
- Daily/seeded runs? (Hungry Wolf playbook, if the game wants it.)
