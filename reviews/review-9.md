# review-9 — prompt13 (fly dirty: the goo inversion experiment)

Finch review, 2026-10-02. Live build visually verified (rooftop screenshot:
FLING button present beside SHAKE with goo-glob icon, correctly greyed
while the pilot is merely DUSTED; BEANS jar bottom-left; prompt12's framed
window intact; no overlaps).

## The experiment's answer

**The mechanic works. The loop doesn't — quite.** Claude's bot test was
honest and well-designed, and its verdict is nuanced:

- 12/12 wins. Dirty is faster (mean 67.9 s vs 79.2 s) — the predicted
  effect, present.
- But dirty is *also* kinder to the city (frost 5–14% vs 27–33%). The
  failure mode the prompt didn't list: **dirty strictly dominates.**
  Catching goo means it never lands on the city, so the inversion
  double-pays defense. Spending the moment you're loaded means CAKED's
  death spiral never arrives.
- The genuinely interesting emergent finding: the *greedy* variant
  (holding out for CAKED's 17 damage) mostly failed — drip and
  trap-escape boosts shed the goo first. So **"how dirty" is a gamble
  even though "whether dirty" isn't.** There's texture here.

## The caveat that matters most

Bots have perfect information. Steering *into* goo-mallows while dodging
gates, then holding a 0.8 s dive under fire, may be genuinely hard for a
human — and difficulty the bot can't see is exactly the missing risk.
Claude was right not to tune around the bot result.

## Verdict

A productive partial. "The dirtier you fly, the harder you hit" is now a
real, legible, fun-looking mechanic — the game has a hook it didn't have
yesterday. But the *tension* (a real choice with a real cost) isn't proven
yet. The next evidence can't come from bots.

## Recommended next step (not a prompt yet)

**Kevin playtests both styles on his phone** — one run seeking goo and
spending it, one run clean. The questions only a human can answer: does
flying dirty *feel* risky? Is the dive-hold scary under fire? Is spending
it satisfying?

- If it feels great: the hook is real; remaining work is the retention
  layer (gallons score, daily/leaderboard) — the "popular" half.
- If it feels flat or dominant: prompt14 = the city-cost fork (each spend
  rains a little frost on the city — dirty trades city safety for boss
  damage), possibly plus armed-draws-fire. Smallest change that creates a
  real decision.

## Honest framing for the bigger question

The inversion addresses *moment-to-moment* engagement (are the 90 seconds
fun?). It does not address *come-back-tomorrow* engagement
(daily/leaderboard/share). Both matter for "popular." Don't confuse
solving the first with solving the second.

## Scores

- Feel/polish: **4/5** (holding).
- The experiment: hook implemented well; loop tension unproven pending
  human playtest.
