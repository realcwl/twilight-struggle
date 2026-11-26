// The sounds of a hit (impact.ts), made on the spot with WebAudio: wood on a table, glass giving way,
// a gun and its shell, a tick that climbs. They sit on top of the game's own cues and obey the same
// audio preferences (mute and effects volume).
import { AUDIO_KEY, audioPreferences } from '../audio/cues';

export type ImpactSound = ReturnType<typeof makeImpactSound>;

export function makeImpactSound() {
  let ctx: AudioContext | null = null;
  let out: GainNode | null = null;
  let noise: AudioBuffer | null = null;

  /** Ready to play, at the volume the player has set; null when muted or when sound is not available. */
  function live(): AudioContext | null {
    let prefs;
    try {
      prefs = audioPreferences(JSON.parse(localStorage.getItem(AUDIO_KEY) ?? 'null'));
    } catch {
      prefs = audioPreferences(null);
    }
    if (prefs.muted || prefs.effects <= 0) return null;
    try {
      if (!ctx) {
        ctx = new AudioContext();
        const squash = ctx.createDynamicsCompressor();
        squash.threshold.value = -14;
        squash.ratio.value = 5;
        out = ctx.createGain();
        out.connect(squash).connect(ctx.destination);
        noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') void ctx.resume();
      out!.gain.value = 0.5 * prefs.effects;
      return ctx;
    } catch {
      return null;
    }
  }
  function tone(f: number, d: number, g = 0.5, o: { to?: number; type?: OscillatorType; at?: number } = {}): void {
    const c = live();
    if (!c || !out) return;
    const t = c.currentTime + (o.at ?? 0);
    const osc = c.createOscillator();
    const v = c.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + d);
    v.gain.setValueAtTime(0.0001, t);
    v.gain.exponentialRampToValueAtTime(g, t + 0.004);
    v.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(v).connect(out);
    osc.start(t);
    osc.stop(t + d + 0.03);
  }
  function hiss(d: number, g = 0.5, o: { type?: BiquadFilterType; f?: number; to?: number; q?: number; at?: number; attack?: number } = {}): void {
    const c = live();
    if (!c || !out || !noise) return;
    const t = c.currentTime + (o.at ?? 0);
    const src = c.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = o.type ?? 'lowpass';
    filter.Q.value = o.q ?? 0.8;
    filter.frequency.setValueAtTime(o.f ?? 1200, t);
    if (o.to) filter.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t + d);
    const v = c.createGain();
    v.gain.setValueAtTime(0.0001, t);
    v.gain.exponentialRampToValueAtTime(g, t + (o.attack ?? 0.003));
    v.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(filter).connect(v).connect(out);
    src.start(t, Math.random());
    src.stop(t + d + 0.03);
  }
  /** Up a scale, a step each time: what makes a run of points sound like a run. */
  const step = (i: number, base: number): number => base * Math.pow(2, [0, 2, 4, 5, 7, 9, 11, 12, 14, 16][Math.min(9, Math.max(0, i))] / 12);

  return {
    /** Wood set down hard on a table. */
    thock(pitch = 1): void {
      tone(210 * pitch, 0.08, 0.7, { to: 120 * pitch, type: 'triangle' });
      hiss(0.035, 0.55, { type: 'bandpass', f: 1900 * pitch, q: 2.5 });
      tone(82, 0.12, 0.5, { to: 50 });
    },
    clack(i = 0): void {
      tone(step(i, 520), 0.045, 0.45, { to: step(i, 380), type: 'triangle' });
      hiss(0.02, 0.3, { type: 'bandpass', f: 3200, q: 3 });
    },
    thud(weight = 1): void {
      tone(150 / weight, 0.22 * weight, 0.95, { to: 38 / weight });
      hiss(0.09 * weight, 0.5, { f: 900 / weight, to: 120 });
    },
    crack(): void {
      hiss(0.05, 0.65, { type: 'highpass', f: 2600 });
      tone(1500, 0.04, 0.25, { to: 300, type: 'square' });
    },
    shatter(): void {
      hiss(0.3, 0.55, { type: 'highpass', f: 3800 });
      for (let i = 0; i < 9; i++) tone(2200 + Math.random() * 4200, 0.07 + Math.random() * 0.2, 0.08 + Math.random() * 0.07, { at: Math.random() * 0.2 });
    },
    boom(size = 1): void {
      tone(110, 0.7 * size, 1, { to: 28 });
      hiss(0.9 * size, 0.95, { f: 2600, to: 90 });
      hiss(0.06, 0.7, { type: 'highpass', f: 2500 });
    },
    /** One more point: a tick that climbs with each, or falls for a point taken away. */
    tick(i = 0, up = true): void {
      tone(step(up ? i : 0, up ? 620 : 300), 0.07, 0.34, { type: 'triangle' });
      tone(step(up ? i : 0, up ? 1240 : 600), 0.04, 0.12);
    },
  };
}
