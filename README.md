# Mallow Man Meltdown (working title)

A G-rated, smartphone-first (portrait, one-thumb) candy-land flight game.
Simpler than a 3D physics puzzler by design.

You are a glider pilot defending Candy City from the Evil Marshmallow Man,
a giant perched atop a cloud, hurling goo-filled marshmallows at you and the
city. Melt him with jelly beans before his goo cakes your wings or his frost
covers the city. Nothing dies; the finale is dessert.

**▶ Play it:** https://kevinhegg.github.io/mallow-man-meltdown/ (best on a phone, held upright)

- `DESIGN.md` — the full game design (mechanics, boss stages, win/lose)
- `claude-code-scaffold-prompt.md` — the prompt this playable scaffold was built from

**Stack:** Phaser 3.90 (Matter physics) · Vite · plain JavaScript. All art is procedural (Phaser Graphics → textures) and all sound is a tiny WebAudio synth, so there are no asset files.

## Run

```bash
npm install
npm run dev
```

`npm run dev` opens the game in your browser. The dev server is also exposed on your LAN, so you can open the printed "Network" URL on a phone on the same Wi-Fi.

- `npm run build` writes a static build to `dist/`
- `npm run preview` serves that build locally

### Dev shortcuts (query string)

| URL | Effect |
| --- | --- |
| `?scene=boss` | Title tap goes straight to the boss fight |
| `?scene=win` / `?scene=lose` | Title tap goes to the end screen |
| `?debug` | Shows Matter physics bodies |

In dev builds the game instance is available as `window.__game`.

## Controls

| | Touch / mouse | Keyboard |
| --- | --- | --- |
| Steer | Drag anywhere (relative, like a trackpad) | Arrows / WASD |
| Fire jelly beans | Every tap/click (a second finger can tap-fire while the first steers) | Space |
| Bubble Boost | BOOST button | Z |
| Shake | SHAKE button | X |

## How it plays

- **Flight** (~40 s): fly into the horizon down a gently curving candy valley, with sugar-cube towers and gumdrop houses streaming past on both sides and candy-cane arches sweeping overhead. The glider banks into turns and pitches on climbs and dives (the horizon dips and rises with it), and wind streaks pick up with speed. The boss sits on his cloud at the horizon and grows as you get closer (he is the progress meter). Dodge sugar-cube ledges, licorice gates and gumdrops as they come at you out of the distance (bonks knock you back). Grab soda bubbles (+1 Boost) and sugar shakers (+1 Shake) while they hover at mid-depth. The boss lobs goo-mallows at you and at the city.
- **Boss**: built from marshmallows glued together with frosting, he patrols his cloud and fights differently as he melts. PRISTINE: slow, smug, aimed throws. SAGGING: lobbed goo bombs that burst mid-air into a widening splatter. ARM OFF!: the arm tears off in a goo burst, and he trembles, throws fast and wild, and swats at you up close. COLLAPSING: feeble, drooping lobs with long pauses. Jelly beans have short range, so you have to dive in, fire, and dive back out. Drips, sloughing chunks and his melt puddle grow each stage until he melts away and a fluff flood fills the screen.
- **Goo tiers** (dusted / splattered / caked): you can see them on the glider. Drips, then blobs, then a heavy green coat, plus a lean and wobble that grow with each tier; CAKED also pulses a green glow at the screen edges. Each splat adds mass, so the glider responds more slowly. The weight also drags you down, and off-centre goo lists you sideways, which also skews your aim.
- **Cleansing:** goo drips off over time (slower when caked). **Bubble Boost** sheds about half and gives you altitude plus a brief bubble shield. **Shake** fully cleans you, but you wobble helplessly for 0.9 s and goo sticks harder.
- **Lose conditions:**
  - **Death spiral:** caked with no Boosts or Shakes left for 2.6 s.
  - **City frost:** goo that reaches the city frosts buildings, and fully frozen buildings spread frost to their neighbours. You lose at 100%.

## Project layout

```
src/
  main.js              game config, portrait sizing, gesture blocking, rotate-pause
  config.js            palette, collision categories, depth order, all tuning knobs (TUNE)
  sfx.js               WebAudio synth (no audio files)
  art/textures.js      every procedural texture
  objects/
    Glider.js          handling model: mass-aware spring, goo splats, CoG list, cleanses, spiral
    GooCoat.js         pooled slime sprites that show the goo tier on the glider
    Controls.js        drag-steer / tap-fire / keyboard
    Projectiles.js     jelly beans + goo-mallows (Matter sensors)
    City.js            skyline + frost meter
    MarshmallowMan.js  boss rig, throw AI (ballistic aim), 4-stage melt
  view/
    Projector.js       tiny pseudo-3D projector (no 3D engine)
    Valley.js          curving valley walls, ground, arches, two-layer horizon (pooled billboards)
    Wind.js            pooled wind streaks that scale with speed
    Pools.js           pooled depth-scaled sprites + reusable Matter props
  ui/
    Hud.js             bars, goo/frost chips, Boost/Shake buttons, banners
    helpers.js         text/sky/button helpers, particles, collision router, run state
  scenes/              Boot (textures + title), Flight, Boss, End
```

Gameplay is strictly 2D on the screen plane. Depth is only decorative: in Flight, a tiny projector (`screen = horizon + (x, y) / z * focal`) draws the valley and scales goo, beans and props by depth, while collisions stay in screen space. Most balance lives in `TUNE` in `src/config.js`.

## Deploy

**GitHub Pages (live):** `.github/workflows/deploy-pages.yml` builds and publishes to https://kevinhegg.github.io/mallow-man-meltdown/ on every push to `main`.

**Netlify (alternative, free tier):** `netlify.toml` is included (build `npm run build`, publish `dist`, Node 22). Connect the repo in Netlify, or drag the `dist/` folder onto app.netlify.com/drop.
