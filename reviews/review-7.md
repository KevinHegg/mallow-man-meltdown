# review-7 — prompts 8–11 (the integration arc)

Finch visual + design review, 2026-10-02. Live build verified via browser
screenshots: slingshot opening, mid-flight, and ?scene=boss rooftop.

## The arc in one line

The game Kevin critiqued — a 1D forward scroller with a disconnected boss
arena — is gone. What's live now: a slingshot launch, a flight where
altitude is a real decision, and a finale where you fly into the boss's
cloud, bail out as a gingerbread pilot, and fight him from a rooftop with
a jelly-bean machine gun. No HUD bars anywhere.

## What landed well

- **prompt8 (slingshot):** The toy opening the game needed. Tap-to-launch
  default keeps it frictionless; the drag-back is there for players who
  want the ritual. Verified live: renders clean, composition good.
- **prompt9 (altitude):** The most important gameplay fix of the four.
  Gates force dives, frosting banks force climbs, thermals reward flying
  through. The cue chevron is good teaching — Claude's cue-following bot
  took zero gate hits. "What you see is what you hit" (single hit test at
  the passing moment) is the right fairness call.
- **prompt10 (bail-out):** The brave idea, executed with care. The seeded
  cloud wall making the scene change invisible is genuinely clever. Pilot
  art (gingerbread, aviator cap, goggles) is charming. The hopper on the
  blaster was balance-forced, not planned — honest work, and the numbers
  (17 s melt without it) justify it. Bars are truly gone; verified live.
  DESIGN.md's finale rewrite is accurate.
- **prompt11 (traps + flood):** The cotton-candy trap is exactly the
  integrated obstacle Kevin asked for — one mechanic, both halves of the
  game, distinct from goo (spatial hold, no tiers). The bot finding and
  fixing a real prompt5 bug (frozen boss when ARM OFF! interrupts a
  throw) is the process working as designed. 6/6 wins at both skill
  levels; frost peaks sane (16–32%).

## Honest concerns

1. **The rooftop has one lose condition, not two.** On foot there's no
   goo-crash death spiral — goo slows the pilot and his fire rate, but
   you can only lose to city frost. DESIGN.md's "the two interact" tension
   is now a flight-phase thing; the finale is a damage race against the
   frost clock. Acceptable for a ~37 s finale, but it's a narrowing worth
   naming.
2. **PRISTINE barely exists on the roof** (~5 s of fighting with a full
   hopper). The smug stage is the boss's best personality and it's over
   before it registers. Claude's own suggestion — start the hopper half
   full — is right.
3. **"Gallons of marshmallow" is still not a number.** DESIGN.md says
   victory is measured in gallons and the pool is the score screen; the
   end-screen stats are unchanged. The fantasy and the UI disagree.
4. **The flood behind the roof is partly hidden** by the roof itself
   (Claude flagged). The front flood carries the read; minor.
5. **The e2e bot lives in a scratchpad, not the repo.** Claude offered to
   commit it under tools/ — say yes. It's the regression harness for
   every future prompt.

## Scores

- Feel/polish: **4/5** (holding — the art bar from prompt7 is intact).
- Game design: was the weakest link at prompt7; now a strength. The
  altitude decisions, the trap/goo interplay, and the continuous finale
  give the game verbs to match its looks.

## Note for the next prompt

Natural prompt12: gallons-of-marshmallow score screen, PRISTINE/hopper
tuning, flood-behind-roof visibility, commit the e2e bot to tools/.
Awaiting Kevin's greenlight — the approved arc ended at 11.
