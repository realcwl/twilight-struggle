import { AUDIO_KEY, CUES, SCORE, audioPreferences, type AudioPort, type AudioPreferences, type SoundCue } from './cues';

type Stream = { media: HTMLAudioElement; gain: GainNode; node: MediaElementAudioSourceNode; side: 0 | 1 };
/** Browser-only sound system. Never imported by the authoritative game/AI or the Worker. */
export class GameAudio extends EventTarget implements AudioPort {
  private context?: AudioContext;
  private master?: GainNode;
  private effectsBus?: GainNode;
  private musicBus?: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private loading?: Promise<void>;
  private voices = new Set<AudioBufferSourceNode>();
  private streams = new Set<Stream>();
  private current?: Stream;
  private lastCue = new Map<SoundCue, number>();
  private lastFile = new Map<SoundCue, string>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private abort = new AbortController();
  private duckUntil = 0;
  private help = false;
  private unlocked = false;
  private disposed = false;
  private generation = 0;
  private musicError = false;
  private effectErrors = 0;
  private played = 0;
  private side: 0 | 1 | null = null;
  private settings: AudioPreferences;
  constructor() {
    super();
    try { this.settings = audioPreferences(JSON.parse(localStorage.getItem(AUDIO_KEY) ?? 'null')); }
    catch { this.settings = audioPreferences(null); }
    const signal = this.abort.signal;
    const gesture = (e: Event) => {
      if (!e.isTrusted || (e instanceof KeyboardEvent && (e.metaKey || e.ctrlKey || e.altKey))) return;
      void this.unlock();
    };
    window.addEventListener('pointerdown', gesture, { capture: true, signal });
    window.addEventListener('keydown', gesture, { capture: true, signal });
    document.addEventListener('visibilitychange', () => this.visibility(), { signal });
    window.addEventListener('pagehide', () => { this.silenceEffects(); this.streams.forEach(s => s.media.pause()); }, { signal });
    window.addEventListener('pageshow', () => this.visibility(), { signal });
    document.addEventListener('card-term-open', () => { this.help = true; this.mix(); }, { signal });
    document.addEventListener('card-term-close', () => { this.help = false; this.mix(); }, { signal });
    window.addEventListener('storage', e => {
      if (e.key !== AUDIO_KEY) return;
      try { this.settings = audioPreferences(JSON.parse(e.newValue ?? 'null')); this.apply(); } catch { /* retain valid settings */ }
    }, { signal });
  }
  get preferences(): AudioPreferences { return { ...this.settings }; }
  get faction(): 0 | 1 | null { return this.side; }
  get status(): 'muted' | 'locked' | 'unavailable' | 'ready' {
    return this.settings.muted ? 'muted' : !this.unlocked ? 'locked' : this.musicError ? 'unavailable' : 'ready';
  }
  /** Public diagnostics contain no game state or audio samples. Useful for integration tests. */
  inspect() {
    return { status: this.status, context: this.context?.state ?? 'uninitialized', faction: this.side,
      buffers: this.buffers.size, voices: this.voices.size, played: this.played, effectErrors: this.effectErrors,
      streams: [...this.streams].map(s => ({ faction: s.side, paused: s.media.paused, time: s.media.currentTime, duration: s.media.duration })),
      preferences: this.preferences };
  }
  configure(change: Partial<AudioPreferences>): void {
    this.settings = audioPreferences({ ...this.settings, ...change });
    try { localStorage.setItem(AUDIO_KEY, JSON.stringify(this.settings)); } catch { /* private/blocked storage still works this session */ }
    this.apply();
  }
  setFaction(side: 0 | 1): void {
    if (this.side === side) return;
    this.side = side;
    this.musicError = false;
    if (this.unlocked && !this.settings.muted && this.settings.music > 0 && !document.hidden) this.startMusic();
    this.changed();
  }
  async unlock(): Promise<void> {
    if (this.disposed || this.settings.muted || document.hidden) return;
    try {
      if (!this.context) {
        const ctx = this.context = new AudioContext({ latencyHint: 'interactive' });
        const master = this.master = ctx.createGain();
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -4; limiter.knee.value = 6; limiter.ratio.value = 12;
        limiter.attack.value = .004; limiter.release.value = .2;
        master.connect(limiter); limiter.connect(ctx.destination);
        this.effectsBus = ctx.createGain(); this.effectsBus.connect(master);
        this.musicBus = ctx.createGain(); this.musicBus.connect(master);
      }
      if (this.context.state !== 'running') await this.context.resume();
      if (this.disposed) return;
      const first = !this.unlocked;
      this.unlocked = this.context.state === 'running';
      this.mix();
      if (this.unlocked) {
        void this.preload();
        if (this.settings.music > 0 && (first || !this.current || this.current.media.paused)) this.startMusic();
      }
      if (first) this.changed();
    } catch { /* Unsupported/blocked audio must never interrupt a decision. */ }
  }
  async preload(): Promise<void> {
    if (!this.context || this.disposed) return;
    return this.loading ??= Promise.all([...new Set(Object.values(CUES).flatMap(c => [...c.files]))].map(async file => {
      try {
        const r = await fetch(`/audio/sfx/${file}.mp3?v=1`, { signal: this.abort.signal });
        if (!r.ok) throw new Error('missing sound');
        const buffer = await this.context!.decodeAudioData(await r.arrayBuffer());
        if (!this.disposed) this.buffers.set(file, buffer);
      } catch { if (!this.disposed) this.effectErrors++; }
    })).then(() => { this.changed(); });
  }
  play(cue: SoundCue, options: { pan?: number; gain?: number } = {}): void {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || this.disposed || document.hidden || this.settings.muted || this.settings.effects === 0) return;
    const spec = CUES[cue], now = performance.now();
    if (now - (this.lastCue.get(cue) ?? -Infinity) < spec.gap) return;
    const variants = spec.files.filter(file => file !== this.lastFile.get(cue));
    const file = variants[Math.floor(Math.random() * variants.length)] ?? spec.files[0];
    const buffer = this.buffers.get(file);
    // Missing/late assets are dropped, not queued to sound after their visual event.
    if (!buffer) return;
    this.lastCue.set(cue, now); this.lastFile.set(cue, file);
    if (this.voices.size >= 12) this.voices.values().next().value?.stop();
    const source = ctx.createBufferSource(), gain = ctx.createGain(), pan = ctx.createStereoPanner();
    source.buffer = buffer;
    source.playbackRate.value = ['victory', 'defeat', 'draw'].includes(cue) ? 1 : .975 + Math.random() * .05;
    gain.gain.value = spec.gain * Math.max(0, Math.min(1.5, options.gain ?? 1));
    pan.pan.value = Math.max(-.65, Math.min(.65, options.pan ?? 0));
    source.connect(gain); gain.connect(pan); pan.connect(this.effectsBus!);
    this.voices.add(source);
    source.onended = () => { this.voices.delete(source); source.disconnect(); gain.disconnect(); pan.disconnect(); };
    source.start(); this.played++;
  }
  duck(ms: number): void {
    this.duckUntil = Math.max(this.duckUntil, performance.now() + ms);
    this.mix();
    this.later(() => this.mix(), ms + 10);
  }
  silenceEffects(): void {
    for (const voice of this.voices) { try { voice.stop(); } catch { /* already ended */ } }
    this.voices.clear();
  }
  private changed(): void { this.dispatchEvent(new Event('change')); }
  private later(fn: () => void, ms: number): void {
    const timer = setTimeout(() => { this.timers.delete(timer); if (!this.disposed) fn(); }, ms);
    this.timers.add(timer);
  }
  private level(node: GainNode | undefined, value: number, fade = .12): void {
    if (!node || !this.context) return;
    node.gain.cancelScheduledValues(this.context.currentTime);
    node.gain.setTargetAtTime(value, this.context.currentTime, fade);
  }
  private mix(): void {
    this.level(this.master, this.settings.muted || document.hidden ? 0 : 1, .06);
    this.level(this.effectsBus, this.settings.effects);
    this.level(this.musicBus, this.settings.music * (this.help ? .28 : performance.now() < this.duckUntil ? .4 : 1), .18);
  }
  private apply(): void {
    this.mix();
    if (this.settings.muted) this.silenceEffects();
    if (this.settings.muted || this.settings.music === 0) this.streams.forEach(s => s.media.pause());
    else if (this.unlocked && !document.hidden) this.startMusic();
    this.changed();
  }
  private visibility(): void {
    if (document.hidden) {
      this.silenceEffects();
      this.streams.forEach(s => s.media.pause());
      this.mix();
    } else if (this.unlocked) void this.unlock();
  }
  private retire(stream: Stream): void {
    stream.media.pause(); stream.media.removeAttribute('src'); stream.media.load();
    stream.node.disconnect(); stream.gain.disconnect(); this.streams.delete(stream);
  }
  private startMusic(loop = false): void {
    const ctx = this.context, side = this.side;
    if (!ctx || side === null || document.hidden || this.disposed || this.settings.muted || this.settings.music === 0) return;
    const old = this.current;
    if (!loop && old?.side === side && !this.musicError) {
      if (old.media.paused) void old.media.play().catch(() => { this.musicError = true; this.changed(); });
      return;
    }
    const generation = ++this.generation;
    const media = new Audio(`/audio/music/${SCORE[side].file}`);
    media.preload = 'auto'; media.setAttribute('playsinline', '');
    const gain = ctx.createGain(), node = ctx.createMediaElementSource(media);
    gain.gain.value = 0; node.connect(gain); gain.connect(this.musicBus!);
    const stream = { media, node, gain, side };
    this.streams.add(stream); this.current = stream;
    media.addEventListener('timeupdate', () => {
      if (this.current === stream && media.duration > 12 && media.duration - media.currentTime < 6 && !media.paused) this.startMusic(true);
    });
    media.addEventListener('ended', () => { if (this.current === stream) this.startMusic(true); });
    const fail = () => {
      if (this.disposed || generation !== this.generation || !this.streams.has(stream)) return;
      this.musicError = true;
      this.retire(stream); this.current = old && this.streams.has(old) ? old : undefined;
      this.changed();
    };
    media.addEventListener('error', fail, { once: true });
    void media.play().then(() => {
      if (this.disposed || generation !== this.generation) { if (this.streams.has(stream)) this.retire(stream); return; }
      this.musicError = false;
      this.level(gain, 1, 1.2);
      for (const previous of [...this.streams]) if (previous !== stream) {
        this.level(previous.gain, 0, 1.2);
        this.later(() => { if (this.streams.has(previous)) this.retire(previous); }, 6000);
      }
      if (document.hidden || this.settings.muted || this.settings.music === 0) media.pause();
      this.changed();
    }).catch(fail);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.generation++;
    this.abort.abort(); this.timers.forEach(clearTimeout); this.timers.clear();
    this.silenceEffects(); [...this.streams].forEach(s => this.retire(s));
    void this.context?.close(); this.buffers.clear();
  }
}
