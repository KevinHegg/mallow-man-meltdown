# prompt13 — fly dirty (the goo inversion experiment)

**The hypothesis.** Right now goo is pure punishment: something that
happens *to* you. This prompt tests whether the game has a heart by
inverting it: **carried goo is ammunition. The dirtier you fly, the
harder you hit.** If the playtest below doesn't show a real risk/reward
loop, say so plainly in the response file — a failed experiment is a
result.

## The new rule

SPLATTERED or CAKED = **loaded**. (DUSTED is a graze, not enough mass —
this makes tiers matter strategically: you want to get *properly* hit.)

### Flight: the dive-bomb

- While loaded, **holding a steep dive** (sustained, not a quick dip under
  a gate — a dip must never trigger it) arms the missile: the glider
  glows, a "SPLAT!" cue appears, unmistakable.
- On commit, the glider streaks at the boss's cloud on the horizon as a
  goo comet, detonates tier-scaled damage into the **shared boss HP pool**,
  and bounces back to cruise **clean**. About 1.5–2 s out of action: the
  tempo cost.
- Damage (tune with the bot, in bean-equivalents): SPLATTERED ≈ 6–8 beans,
  CAKED ≈ 15–20. **The flight must not solo the boss**: cap flight splats
  so ~3 CAKED comets ≈ one stage, and the rooftop always matters.
- First time per run a player reaches SPLATTERED: one banner —
  "HOLD YOUR DIVE to splat your goo at the boss!"

### Rooftop: the FLING button

- New round button next to SHAKE (bottom-right; jar stays bottom-left).
  Enabled only while loaded, greyed otherwise.
- Tap: the pilot hurls all carried goo upward in an arc at the looming
  boss — tier-scaled damage, pilot goes clean. Same shared HP pool.
- First goo on the roof per run: one banner — "FLING your goo at him!"

### What doesn't change

- Jelly beans still do the same damage; they're the safe route. The
  inversion *adds* a route. Tiers, cleanse rules, controls, speeds,
  spawn pressure: untouched.

## The loop this should create

Get dirty → spend it (dive-bomb / FLING) → clean → get dirty again.
And the strategic layer: play the flight clean and safe, or arrive at the
rooftop having already chunked a stage off the boss.

## Verification: the experiment must be falsifiable

Two bots, end to end, no cheats:
- **dirty-bot**: seeks goo, spends it the moment it's loaded.
- **clean-bot**: avoids goo, beans only (plays like prompt11).
- Both must win. Then compare: dirty should be **faster on average with
  higher variance** (frost peaks, splat counts). If dirty can't win, or
  clean is strictly better in every run, the inversion failed — write
  that up honestly instead of tuning around it.

Also: zero console errors; both aspects screenshot-checked (arming cue
must be unmistakable vs. a gate-dive); update DESIGN.md's goo section
with the inversion.

Then write prompts/prompt13-response.md per the protocol and commit.
