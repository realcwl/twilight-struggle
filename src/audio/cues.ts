import { t as i18n } from '../i18n/index.js';
// Assets are prepared offline; runtime randomness affects timbre only, never the match RNG.
export const CUES = {
  card: { files: ['card-1', 'card-2', 'card-3'], gain: .8, gap: 100 },
  reveal: { files: ['reveal'], gain: .8, gap: 120 },
  return: { files: ['return'], gain: .65, gap: 70 },
  influence: { files: ['influence-1', 'influence-2', 'influence-3'], gain: .82, gap: 45 },
  remove: { files: ['remove'], gain: .72, gap: 60 },
  control: { files: ['control'], gain: .68, gap: 180 },
  dice: { files: ['dice-1', 'dice-2', 'dice-3'], gain: .9, gap: 35 },
  coup: { files: ['coup'], gain: .9, gap: 350 },
  'coup-fail': { files: ['coup-fail'], gain: .7, gap: 350 },
  realign: { files: ['realign'], gain: .7, gap: 120 },
  space: { files: ['space'], gain: .65, gap: 350 },
  vp: { files: ['vp'], gain: .58, gap: 160 },
  turn: { files: ['turn'], gain: .5, gap: 450 },
  passive: { files: ['passive'], gain: .6, gap: 220 },
  crisis: { files: ['crisis'], gain: .72, gap: 500 },
  victory: { files: ['victory'], gain: .8, gap: 1500 },
  defeat: { files: ['defeat'], gain: .7, gap: 1500 },
  draw: { files: ['draw'], gain: .7, gap: 1500 },
} as const;
export type SoundCue = keyof typeof CUES;
export const SCORE = [
  { file: 'us-signal-to-noise.m4a', faction: i18n("美国"), title: 'Signal to Noise', mood: i18n("钢琴 · 大提琴 · 暗线"), url: 'https://www.scottbuckley.com.au/library/signal-to-noise/' },
  { file: 'ussr-katabasis.m4a', faction: i18n("苏联"), title: 'Katabasis I', mood: i18n("低音弦乐 · 冷峻 · 张力"), url: 'https://www.scottbuckley.com.au/library/katabasis-i/' },
] as const;
export type AudioPreferences = { muted: boolean; music: number; effects: number };
export const DEFAULT_AUDIO: AudioPreferences = { muted: false, music: .5, effects: .8 };
export const AUDIO_KEY = 'coldwar.audio.v1';
export function audioPreferences(raw: unknown): AudioPreferences {
  const p = raw && typeof raw === 'object' ? raw as Partial<AudioPreferences> : {};
  const volume = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
  return { muted: typeof p.muted === 'boolean' ? p.muted : false, music: volume(p.music, .5), effects: volume(p.effects, .8) };
}
export interface AudioPort {
  play(cue: SoundCue, options?: { pan?: number; gain?: number }): void;
  duck(ms: number): void;
  silenceEffects(): void;
}
