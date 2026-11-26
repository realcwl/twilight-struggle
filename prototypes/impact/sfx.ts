// Sound for the impact prototypes, made on the spot with WebAudio: no files. A hit without a sound is
// half a hit, so every set has its own voice. Nothing here is used by the game.

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = false;

export const setMuted = (on: boolean): void => {
  muted = on;
};
export const isMuted = (): boolean => muted;

/** Browsers only let sound start from a click or a key; call this from one. */
export function wake(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  try {
    ctx = new AudioContext();
    const squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -14;
    squash.ratio.value = 5;
    out = ctx.createGain();
    out.gain.value = 0.55;
    out.connect(squash).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  } catch {
    ctx = null;
  }
}

type Tone = { f: number; to?: number; d: number; g?: number; type?: OscillatorType; at?: number; attack?: number };
type Hiss = { d: number; g?: number; at?: number; type?: BiquadFilterType; f?: number; to?: number; q?: number; attack?: number };

function tone({ f, to, d, g = 0.5, type = 'sine', at = 0, attack = 0.004 }: Tone): void {
  if (!ctx || !out || muted) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const v = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + d);
  v.gain.setValueAtTime(0.0001, t);
  v.gain.exponentialRampToValueAtTime(g, t + attack);
  v.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(v).connect(out);
  o.start(t);
  o.stop(t + d + 0.03);
}

function hiss({ d, g = 0.5, at = 0, type = 'lowpass', f = 1200, to, q = 0.8, attack = 0.003 }: Hiss): void {
  if (!ctx || !out || !noise || muted) return;
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(f, t);
  if (to) filter.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + d);
  const v = ctx.createGain();
  v.gain.setValueAtTime(0.0001, t);
  v.gain.exponentialRampToValueAtTime(g, t + attack);
  v.gain.exponentialRampToValueAtTime(0.0001, t + d);
  src.connect(filter).connect(v).connect(out);
  src.start(t, Math.random());
  src.stop(t + d + 0.03);
}

/** Up a scale, one step per call: what makes a run of bonus points sound like a run. */
const step = (i: number, base: number): number => base * Math.pow(2, [0, 2, 4, 5, 7, 9, 11, 12, 14, 16][Math.min(9, Math.max(0, i))] / 12);

export const sfx = {
  /** Something heavy meets the table. `weight` 0.5 light, 1 heavy, 1.6 enormous. */
  thud(weight = 1): void {
    tone({ f: 150 / weight, to: 38 / weight, d: 0.22 * weight, g: 0.95 });
    hiss({ d: 0.09 * weight, g: 0.5, f: 900 / weight, to: 120 });
  },
  /** Wood on wood. */
  thock(pitch = 1): void {
    tone({ f: 210 * pitch, to: 120 * pitch, d: 0.08, g: 0.7, type: 'triangle' });
    hiss({ d: 0.035, g: 0.55, type: 'bandpass', f: 1900 * pitch, q: 2.5 });
    tone({ f: 82, to: 50, d: 0.12, g: 0.5 });
  },
  clack(i = 0): void {
    tone({ f: step(i, 520), to: step(i, 380), d: 0.045, g: 0.45, type: 'triangle' });
    hiss({ d: 0.02, g: 0.3, type: 'bandpass', f: 3200, q: 3 });
  },
  /** A neutral tick that climbs. */
  tick(i = 0): void {
    tone({ f: step(i, 620), d: 0.07, g: 0.34, type: 'triangle' });
    tone({ f: step(i, 1240), d: 0.04, g: 0.12 });
  },
  ding(i = 0): void {
    tone({ f: step(i, 880), d: 0.5, g: 0.34 });
    tone({ f: step(i, 880) * 2.76, d: 0.3, g: 0.1 });
  },
  coin(i = 0): void {
    tone({ f: step(i, 1318), d: 0.07, g: 0.22, type: 'square' });
    tone({ f: step(i, 1976), d: 0.22, g: 0.2, type: 'square', at: 0.06 });
  },
  boom(size = 1): void {
    tone({ f: 110, to: 28, d: 0.7 * size, g: 1 });
    hiss({ d: 0.9 * size, g: 0.95, f: 2600, to: 90 });
    hiss({ d: 0.06, g: 0.7, type: 'highpass', f: 2500 });
  },
  whistle(d = 0.4): void {
    tone({ f: 2100, to: 620, d, g: 0.16, attack: d * 0.4 });
  },
  crack(): void {
    hiss({ d: 0.05, g: 0.65, type: 'highpass', f: 2600 });
    tone({ f: 1500, to: 300, d: 0.04, g: 0.25, type: 'square' });
  },
  shatter(): void {
    hiss({ d: 0.3, g: 0.55, type: 'highpass', f: 3800 });
    for (let i = 0; i < 9; i++) tone({ f: 2200 + Math.random() * 4200, d: 0.07 + Math.random() * 0.2, g: 0.08 + Math.random() * 0.07, at: Math.random() * 0.2 });
  },
  clink(i = 0): void {
    tone({ f: step(i, 2093), d: 0.16, g: 0.2 });
    tone({ f: step(i, 2093) * 1.5, d: 0.09, g: 0.09 });
    hiss({ d: 0.015, g: 0.2, type: 'highpass', f: 6000 });
  },
  zap(power = 1): void {
    tone({ f: 2400, to: 90, d: 0.16 * power, g: 0.3, type: 'sawtooth' });
    hiss({ d: 0.12 * power, g: 0.5 * power, type: 'bandpass', f: 4200, to: 900, q: 1.5 });
  },
  buzz(i = 0): void {
    tone({ f: step(i, 196), d: 0.11, g: 0.2, type: 'sawtooth' });
    hiss({ d: 0.07, g: 0.22, type: 'bandpass', f: 5200, q: 3 });
  },
  thunder(): void {
    hiss({ d: 1.3, g: 0.75, f: 420, to: 60, attack: 0.03 });
    tone({ f: 62, to: 30, d: 0.9, g: 0.6 });
  },
  slash(): void {
    hiss({ d: 0.16, g: 0.5, type: 'bandpass', f: 1400, to: 7500, q: 4 });
    tone({ f: 3200, to: 5200, d: 0.22, g: 0.07, at: 0.02 });
  },
  sheath(): void {
    tone({ f: 4200, d: 0.5, g: 0.06 });
    hiss({ d: 0.03, g: 0.3, type: 'highpass', f: 5000, at: 0.0 });
  },
  stamp(weight = 1): void {
    tone({ f: 120 / weight, to: 44, d: 0.16 * weight, g: 0.95 });
    hiss({ d: 0.07, g: 0.6, type: 'bandpass', f: 700, q: 0.9 });
    hiss({ d: 0.16, g: 0.16, type: 'highpass', f: 3200, at: 0.02 });
  },
  rip(): void {
    hiss({ d: 0.22, g: 0.5, type: 'bandpass', f: 2600, to: 900, q: 1.2 });
  },
  whoosh(d = 0.22): void {
    hiss({ d, g: 0.3, type: 'bandpass', f: 500, to: 2600, q: 1.4, attack: d * 0.5 });
  },
  beep(i = 0): void {
    tone({ f: step(i, 1046), d: 0.06, g: 0.22, type: 'square' });
  },
  lock(): void {
    tone({ f: 1568, d: 0.07, g: 0.22, type: 'square' });
    tone({ f: 2093, d: 0.16, g: 0.22, type: 'square', at: 0.075 });
  },
  glitch(): void {
    for (let i = 0; i < 7; i++) tone({ f: 200 + Math.random() * 2600, d: 0.03, g: 0.16, type: 'square', at: i * 0.028 });
    hiss({ d: 0.2, g: 0.25, type: 'highpass', f: 5000 });
  },
  drum(i = 0): void {
    tone({ f: 190, to: 110, d: 0.11, g: 0.6, type: 'triangle' });
    hiss({ d: 0.09, g: 0.3 + i * 0.03, type: 'bandpass', f: 2400, q: 0.8 });
  },
  brass(): void {
    for (const [f, at] of [[196, 0], [247, 0], [294, 0], [392, 0.02]] as const) tone({ f, d: 0.55, g: 0.2, type: 'sawtooth', at, attack: 0.02 });
    tone({ f: 98, to: 60, d: 0.3, g: 0.6 });
  },
  rumble(d = 0.8): void {
    hiss({ d, g: 0.6, f: 160, to: 50, attack: 0.05 });
    tone({ f: 46, to: 30, d, g: 0.5, attack: 0.04 });
  },
  /** The short phrase that says "won". */
  fanfare(): void {
    [523, 659, 784, 1047].forEach((f, i) => tone({ f, d: i === 3 ? 0.5 : 0.12, g: 0.22, type: 'triangle', at: i * 0.075 }));
  },
  jackpot(): void {
    for (let i = 0; i < 12; i++) tone({ f: step(i % 8, 1047), d: 0.09, g: 0.16, type: 'square', at: i * 0.055 });
  },
  /** The die itself: each time it meets the table. */
  die(i = 0): void {
    tone({ f: 240 - i * 30, to: 90, d: 0.06, g: 0.5 - i * 0.1, type: 'triangle' });
    hiss({ d: 0.03, g: 0.4 - i * 0.08, type: 'bandpass', f: 2400, q: 2 });
  },
};
export type Sfx = typeof sfx;
