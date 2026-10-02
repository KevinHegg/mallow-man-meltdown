# review-8 — prompt12 (UI legibility pass)

Finch visual + design review, 2026-10-02. Live build verified via browser
screenshots: ?scene=boss rooftop and fresh-load flight.

## What was actually wrong (Claude's diagnosis, confirmed)

Kevin saw four yellow ovals; there were actually eight, in two rows —
cropping hid half of them on his phone. And the flight controls were never
under the art in draw order (they sat at the top layer all along). The real
culprit was translucency: buttons at 88% opacity dropping to 45% whenever
the glider passed underneath, so background art showed straight through
and swamped them. "Covered by art" was the right read of the wrong cause —
good bug report, better diagnosis.

## What landed

- **Windows are architecture now.** Framed sash windows: dark frames,
  four-pane glass, pink curtains, green shutters, sill with lights, flower
  boxes, cherry keystone. They cannot be mistaken for buttons. Verified
  live.
- **Controls are solid.** Opaque plates with ink rims and drop shadows;
  the 45% glider-underneath fade is gone — the wingtip now slides *under*
  the button, which is the correct relationship. Verified live in both
  scenes.
- **BEANS jar.** The blaster hopper finally has a readout: a gumball jar
  in the bottom-left that fills with up to 12 beans, shows the refill
  trickle, and flashes EMPTY! in red. Jar-shaped, deliberately unlike the
  round buttons. Verified live.
- **Bonus:** the audit caught the end-screen pilot standing on the FLY
  AGAIN button — fixed in the same prompt.
- **Process:** the automated occlusion audit (every input zone, every 20
  frames, full flight + rooftop + finale, both aspects) found zero
  occluders. That's the right artifact for this class of bug. The
  two-aspect screenshot rule is now in the working notes.

## Honest notes

1. Small yellow pill-dots remain on the *background* rooftop buildings.
   They read as distant lit windows, not buttons — likely fine, but if
   Kevin's eye catches them again, they're the same motif at a smaller
   scale.
2. The "hopper pips" Kevin never asked about turned out to be SHAKE charge
   pips, not a hopper readout at all. The prompt's third item was slightly
   misdiagnosed; Claude caught it and built the real thing. Good.
3. The BOOST label sits slightly snug against its button's bottom edge —
   legible, cosmetic, not worth a prompt alone.

## Scores

- Feel/polish: **4/5** (holding).
- The game is now past the point where the UI fights the player. Nothing
  in the interface reads as broken on a phone.

## Queue state

All 12 prompts DONE. The earlier-proposed prompt13 (gallons-of-marshmallow
score screen, PRISTINE/hopper tuning, flood-behind-roof visibility, commit
the e2e bot to tools/) is still unapproved — awaiting Kevin's call.
