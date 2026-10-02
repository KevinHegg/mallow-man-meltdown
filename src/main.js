import * as Phaser from 'phaser';
import './style.css';
import { GAME_W, GRAVITY_Y } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { FlightScene } from './scenes/FlightScene.js';
import { BossScene } from './scenes/BossScene.js';
import { EndScene } from './scenes/EndScene.js';

// Block browser gestures that fight the game: pinch-zoom, double-tap zoom, rubber-band scroll.
const block = (e) => e.preventDefault();
['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'contextmenu'].forEach((t) =>
  document.addEventListener(t, block, { passive: false }),
);
document.addEventListener('touchmove', block, { passive: false });

// Fixed 540px logical width; height follows the phone's aspect so tall phones fill edge to edge.
const host = document.getElementById('game');
const rect = host.getBoundingClientRect();
const aspect = rect.height / Math.max(1, rect.width);
const height = aspect > 1.45 ? Math.round(Phaser.Math.Clamp(GAME_W * aspect, 960, 1170)) : 960;
const params = new URLSearchParams(window.location.search);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: host,
  backgroundColor: '#ffd9ec',
  banner: false,
  audio: { noAudio: true }, // all sound is our own WebAudio synth (src/sfx.js)
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_W,
    height,
  },
  input: { activePointers: 3 },
  physics: {
    default: 'matter',
    matter: { gravity: { x: 0, y: GRAVITY_Y }, debug: params.has('debug') },
  },
  scene: [BootScene, FlightScene, BossScene, EndScene],
});

// Pause while the "rotate your phone" overlay is showing.
const landscape = window.matchMedia('(orientation: landscape) and (pointer: coarse) and (max-height: 600px)');
const applyOrientation = () => (landscape.matches ? game.loop.sleep() : game.loop.wake());
landscape.addEventListener('change', applyOrientation);
game.events.once(Phaser.Core.Events.READY, applyOrientation);

if (import.meta.env.DEV) window.__game = game;
