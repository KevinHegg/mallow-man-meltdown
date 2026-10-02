// Tiny WebAudio synth. No audio files: every sound is an oscillator or filtered noise.
// The AudioContext is only created inside a user gesture (Sfx.unlock), so browsers never warn.

const VOLUME = 0.4;

let ctx = null;
let master = null;
let noiseBuffer = null;
let muted = false;
const lastPlayed = {};

try {
  muted = localStorage.getItem('mmm-muted') === '1';
} catch {
  // storage can be blocked (private mode); default to sound on
}

function init() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : VOLUME;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 6;
  master.connect(comp).connect(ctx.destination);
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return true;
}

// Rate-limits each named sound so rapid events don't pile into mush.
function ready(name, gap = 0) {
  if (!ctx || muted || ctx.state !== 'running') return false;
  const now = ctx.currentTime;
  if (gap && lastPlayed[name] !== undefined && now - lastPlayed[name] < gap) return false;
  lastPlayed[name] = now;
  return true;
}

function tone(f, to, dur, { type = 'sine', vol = 0.2, delay = 0, attack = 0.005 } = {}) {
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t0);
  if (to && to !== f) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
  return osc;
}

function noise(dur, { vol = 0.2, freq = 1000, to, q = 0.8, type = 'lowpass', delay = 0 } = {}) {
  const t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, t0);
  if (to) filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.05);
}

function vibrato(osc, rate, depth, dur) {
  const t0 = ctx.currentTime;
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = rate;
  lfoGain.gain.value = depth;
  lfo.connect(lfoGain).connect(osc.frequency);
  lfo.start(t0);
  lfo.stop(t0 + dur + 0.05);
}

const arp = (notes, step, opts) => notes.forEach((f, i) => tone(f, f, step * 1.8, { ...opts, delay: i * step }));

export const Sfx = {
  unlock() {
    if (init() && ctx.state === 'suspended') ctx.resume();
  },
  isMuted: () => muted,
  toggleMute() {
    muted = !muted;
    if (master) master.gain.setTargetAtTime(muted ? 0 : VOLUME, ctx.currentTime, 0.02);
    try {
      localStorage.setItem('mmm-muted', muted ? '1' : '0');
    } catch {
      // ignore blocked storage
    }
    return muted;
  },

  click() {
    if (!ready('click', 0.05)) return;
    tone(700, 900, 0.05, { type: 'triangle', vol: 0.12 });
  },
  start() {
    if (!ready('start')) return;
    arp([523, 659, 784, 1047], 0.07, { type: 'triangle', vol: 0.16 });
  },
  fire() {
    if (!ready('fire', 0.04)) return;
    tone(950, 1500, 0.07, { type: 'square', vol: 0.05 });
  },
  pop() {
    if (!ready('pop', 0.03)) return;
    tone(420, 1100, 0.09, { vol: 0.22 });
    noise(0.06, { vol: 0.12, freq: 2500, type: 'bandpass', q: 1.5 });
  },
  splat() {
    if (!ready('splat', 0.05)) return;
    noise(0.22, { vol: 0.45, freq: 900, to: 200 });
    tone(200, 70, 0.2, { type: 'triangle', vol: 0.25 });
  },
  hitBoss() {
    if (!ready('hit', 0.04)) return;
    tone(330, 160, 0.09, { type: 'triangle', vol: 0.2 });
    noise(0.08, { vol: 0.14, freq: 700 });
  },
  frost() {
    if (!ready('frost', 0.08)) return;
    tone(1800, 2600, 0.12, { type: 'triangle', vol: 0.08 });
    tone(2400, 3200, 0.16, { vol: 0.06, delay: 0.06 });
  },
  boost() {
    if (!ready('boost')) return;
    [520, 660, 880, 1180].forEach((f, i) => tone(f, f * 1.4, 0.12, { vol: 0.14, delay: i * 0.05 }));
    noise(0.4, { vol: 0.1, freq: 3000, type: 'highpass' });
  },
  shake() {
    if (!ready('shake')) return;
    const osc = tone(180, 260, 0.75, { type: 'sawtooth', vol: 0.08 });
    vibrato(osc, 18, 70, 0.75);
    noise(0.5, { vol: 0.12, freq: 1600, type: 'bandpass', q: 2 });
  },
  bonk() {
    if (!ready('bonk', 0.1)) return;
    tone(240, 110, 0.14, { vol: 0.28 });
    noise(0.06, { vol: 0.15, freq: 1200 });
  },
  pickup() {
    if (!ready('pickup', 0.05)) return;
    arp([660, 880, 1320], 0.06, { type: 'triangle', vol: 0.14 });
  },
  deny() {
    if (!ready('deny', 0.15)) return;
    tone(180, 150, 0.12, { type: 'square', vol: 0.06 });
  },
  gooWorse(tier) {
    if (!ready('tier', 0.2)) return;
    const f = { dusted: 520, splattered: 330, caked: 200 }[tier] ?? 400;
    tone(f, f * 0.7, 0.18, { type: 'triangle', vol: 0.14 });
  },
  warn() {
    if (!ready('warn', 0.4)) return;
    tone(880, 880, 0.09, { type: 'square', vol: 0.06 });
    tone(660, 660, 0.09, { type: 'square', vol: 0.06, delay: 0.12 });
  },
  windup() {
    if (!ready('windup', 0.1)) return;
    noise(0.3, { vol: 0.12, freq: 300, to: 1600, type: 'bandpass', q: 3 });
  },
  stage() {
    if (!ready('stage')) return;
    tone(420, 90, 0.6, { type: 'sawtooth', vol: 0.12 });
    noise(0.5, { vol: 0.25, freq: 600, to: 120 });
  },
  burst() {
    if (!ready('burst', 0.08)) return;
    noise(0.25, { vol: 0.3, freq: 1800, to: 300, type: 'bandpass', q: 1.2 });
    tone(520, 180, 0.18, { type: 'triangle', vol: 0.16 });
  },
  swat() {
    if (!ready('swat', 0.2)) return;
    noise(0.28, { vol: 0.28, freq: 400, to: 2400, type: 'bandpass', q: 2 });
    tone(140, 90, 0.2, { type: 'sawtooth', vol: 0.08 });
  },
  slough() {
    if (!ready('slough')) return;
    tone(300, 60, 0.8, { type: 'triangle', vol: 0.2 });
  },
  spiral() {
    if (!ready('spiral')) return;
    const osc = tone(900, 90, 1.3, { type: 'triangle', vol: 0.16 });
    vibrato(osc, 9, 40, 1.3);
  },
  crash() {
    if (!ready('crash')) return;
    noise(0.5, { vol: 0.4, freq: 800, to: 100 });
    tone(160, 50, 0.4, { vol: 0.3 });
  },
  arrive() {
    if (!ready('arrive')) return;
    arp([392, 523, 659, 784], 0.09, { type: 'triangle', vol: 0.15 });
  },
  win() {
    if (!ready('win')) return;
    arp([523, 659, 784, 1047, 1319, 1568], 0.09, { type: 'triangle', vol: 0.16 });
    noise(1.2, { vol: 0.06, freq: 5000, type: 'highpass' });
  },
  lose() {
    if (!ready('lose')) return;
    [392, 370, 349, 262].forEach((f, i) => tone(f, f * 0.97, i === 3 ? 0.7 : 0.28, { type: 'triangle', vol: 0.16, delay: i * 0.3 }));
  },
  freeze() {
    if (!ready('freeze')) return;
    arp([2093, 1760, 1568, 1319, 1047], 0.05, { vol: 0.07 });
  },
};
