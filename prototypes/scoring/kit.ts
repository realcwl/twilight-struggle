// What the ten ways of showing a scoring are built from: time that can be slowed, skipped and cut off,
// things placed and thrown in viewport pixels, numbers that count. Everything is drawn in one layer of
// its own over the map and the HUD; nothing here is used by the game.

export type Pt = { x: number; y: number };
export type Box = { left: number; top: number; width: number; height: number };
export const CANCELLED = { cancelled: true } as const;

export const OUT = 'cubic-bezier(.2,.8,.2,1)';
export const IN = 'cubic-bezier(.55,0,1,.55)';
export const BACK = 'cubic-bezier(.3,1.6,.5,1)';
export const INOUT = 'cubic-bezier(.5,0,.2,1)';

let speed = 1;
let boost = 1;
let top!: HTMLElement;
let shakers: Element[] = [];
let frozen = false;
const anims = new Set<Animation>();
const waits = new Set<{ stop(why: unknown): void; rush(): void }>();
const tweens = new Set<{ stop(): void }>();

export const setSpeed = (v: number): void => void (speed = v);
/** Ms of the design turned into ms of the clock. */
export const t = (ms: number): number => ms / (speed * boost);
/** 1rem in px: the HUD is drawn in rem, and so is everything here, so that both grow with the window. */
export const rem = (n = 1): number => n * parseFloat(getComputedStyle(document.documentElement).fontSize);
export const mid = (r: Box): Pt => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
export const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};
export const clamp = (n: number, a: number, b: number): number => Math.min(b, Math.max(a, n));

/** `shake`: what a blow is felt in, besides the layer itself (the map and the HUD). */
export function mount(layer: HTMLElement, shake: Element[] = []): void {
  top = layer;
  shakers = [layer, ...shake];
}

/** Stops everything that is going on and clears the layer. Pending waits reject with CANCELLED. */
export function reset(): void {
  boost = 1;
  frozen = false;
  for (const a of anims) a.cancel();
  anims.clear();
  for (const w of [...waits]) w.stop(CANCELLED);
  waits.clear();
  for (const tw of [...tweens]) tw.stop();
  tweens.clear();
  top.replaceChildren();
}

/** The player has seen enough: what is left runs many times faster, and lands where it would have. */
export function rush(): void {
  if (boost > 1) return;
  boost = 14;
  for (const a of anims) a.playbackRate = boost;
  for (const w of [...waits]) w.rush();
}
export const rushing = (): boolean => boost > 1;
/** Back to the show's own pace: what comes after a place where the player is waited for is not hurried. */
export const calm = (): void => {
  boost = 1;
  for (const a of anims) a.playbackRate = 1;
};
/** A wait that ends when it is told to (a button). Cut off by reset() like any other wait. */
export function gate(): { promise: Promise<void>; open(): void } {
  let open!: () => void;
  const promise = new Promise<void>((resolve, reject) => {
    const self = { stop: (why: unknown): void => reject(why), rush: (): void => undefined };
    waits.add(self);
    open = (): void => {
      waits.delete(self);
      resolve();
    };
  });
  return { promise, open };
}

// ---------------------------------------------------------------- time
export function wait(ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const whole = t(ms);
    let timer = 0;
    const done = (): void => {
      waits.delete(self);
      resolve();
    };
    const self = {
      stop(why: unknown): void {
        clearTimeout(timer);
        reject(why);
      },
      rush(): void {
        clearTimeout(timer);
        timer = window.setTimeout(done, Math.max(0, whole - (performance.now() - started)) / boost);
      },
    };
    timer = window.setTimeout(done, whole);
    waits.add(self);
  });
}

export type AnimOpts = { ms: number; ease?: string; delay?: number; fill?: FillMode; add?: boolean };
/** A WAAPI animation at the show's speed. `add`: on top of whatever transform the element already has. */
export function anim(el: Element, frames: Keyframe[], { ms, ease = OUT, delay = 0, fill = 'both', add = false }: AnimOpts): Animation {
  const a = el.animate(frames, { duration: Math.max(1, ms / speed), delay: delay / speed, easing: ease, fill, composite: add ? 'add' : 'replace' });
  a.playbackRate = boost;
  anims.add(a);
  const done = (): void => void anims.delete(a);
  a.finished.then(done, done);
  return a;
}
/** The same, awaited. A cancelled animation rejects with CANCELLED. */
export function go(el: Element, frames: Keyframe[], opts: AnimOpts): Promise<void> {
  return anim(el, frames, opts).finished.then(
    () => undefined,
    () => Promise.reject(CANCELLED),
  );
}
/** A passing movement of something that is not ours (a token, a HUD part): it leaves nothing behind. */
export const nudge = (el: Element, frames: Keyframe[], ms: number, ease = OUT, delay = 0): Promise<void> => go(el, frames, { ms, ease, delay, fill: 'backwards', add: true });

/** Runs fn(k) every frame with k from 0 to 1. */
export function tween(ms: number, fn: (k: number) => void, ease: (k: number) => number = (k) => k): Promise<void> {
  return new Promise((resolve, reject) => {
    let spent = 0;
    let last = performance.now();
    let raf = 0;
    const self = {
      stop(): void {
        cancelAnimationFrame(raf);
        tweens.delete(self);
        reject(CANCELLED);
      },
    };
    tweens.add(self);
    const tick = (now: number): void => {
      if (!frozen) spent += (now - last) * speed * boost;
      last = now;
      const k = Math.min(1, spent / Math.max(1, ms));
      fn(ease(k));
      if (k < 1) raf = requestAnimationFrame(tick);
      else {
        tweens.delete(self);
        resolve();
      }
    };
    raf = requestAnimationFrame(tick);
  });
}
export const easeIn = (k: number): number => k * k;
export const easeOut = (k: number): number => 1 - (1 - k) * (1 - k);
export const easeInOut = (k: number): number => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

// ---------------------------------------------------------------- things
/** An element in the layer. */
export function mk(cls: string, html = '', style: Partial<CSSStyleDeclaration> = {}): HTMLElement {
  const el = document.createElement('div');
  el.className = cls;
  if (html) el.innerHTML = html;
  Object.assign(el.style, style);
  top.append(el);
  return el;
}
/** An element inside another of ours. */
export function sub(parent: Element, cls: string, html = '', tag: keyof HTMLElementTagNameMap = 'div'): HTMLElement {
  const el = document.createElement(tag);
  el.className = cls;
  if (html) el.innerHTML = html;
  parent.append(el);
  return el;
}
/** An element centred on a point of the screen. */
export function put(cls: string, p: Pt, html = '', style: Partial<CSSStyleDeclaration> = {}): HTMLElement {
  return mk(`sk-at ${cls}`, html, { left: `${p.x}px`, top: `${p.y}px`, ...style });
}
export const moveTo = (el: HTMLElement, p: Pt): void => {
  el.style.left = `${p.x}px`;
  el.style.top = `${p.y}px`;
};
/** Fades something of ours out and takes it away. */
export function gone(el: Element, ms = 220, delay = 0): Promise<void> {
  return go(el, [{ opacity: 0 }], { ms, delay, fill: 'forwards' }).then(
    () => el.remove(),
    () => undefined,
  );
}
/** Comes in with a little overshoot: the way a number or a word arrives. */
export const popIn = (el: Element, ms = 220, from = 0.6, delay = 0): Promise<void> => go(el, [{ opacity: 0, scale: String(from) }, { opacity: 1, scale: '1' }], { ms, ease: BACK, delay });
/** A pane slides in from just above where it stands. */
export const enter = (el: Element, ms = 200, delay = 0): Promise<void> => go(el, [{ opacity: 0, translate: '0 -1.2rem' }, { opacity: 1, translate: '0 0' }], { ms, delay });
/** A beat on something that is already there: the number just changed. */
export const beat = (el: Element, scale = 1.28, ms = 200): void => void go(el, [{ scale: String(scale) }, { scale: '1' }], { ms, ease: BACK, fill: 'none' }).catch(() => undefined);

/** Throws an element (made with put) from a to b along an arc. */
export function fly(el: HTMLElement, a: Pt, b: Pt, o: { ms: number; lift?: number; ease?: (k: number) => number; scale?: [number, number]; fade?: boolean; trail?: string } = { ms: 300 }): Promise<void> {
  const lift = o.lift ?? Math.min(80, Math.hypot(b.x - a.x, b.y - a.y) * 0.18);
  const [s0, s1] = o.scale ?? [1, 1];
  let dropped = 0;
  return tween(
    o.ms,
    (k) => {
      const x = a.x + (b.x - a.x) * k;
      const y = a.y + (b.y - a.y) * k - Math.sin(k * Math.PI) * lift;
      // what it leaves behind on the way: light that stays for a moment where it has been
      if (o.trail && performance.now() - dropped > 14) {
        dropped = performance.now();
        const size = rem(2.6) * (s0 + (s1 - s0) * k);
        const dot = put('sk-trail', { x, y }, '', { width: `${size}px`, height: `${size}px`, background: o.trail, color: o.trail });
        void go(dot, [{ opacity: 0.85, scale: '1' }, { opacity: 0, scale: '.2' }], { ms: 340, ease: 'ease-out' }).then(
          () => dot.remove(),
          () => undefined,
        );
      }
      moveTo(el, { x, y });
      el.style.transform = `translate(-50%, -50%) scale(${s0 + (s1 - s0) * k})`;
      if (o.fade) el.style.opacity = String(k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2);
    },
    o.ease ?? easeInOut,
  );
}

/** A number that counts from one value to another. */
export function count(el: Element, from: number, to: number, ms = 300, fmt: (n: number) => string = String): Promise<void> {
  if (from === to) {
    el.textContent = fmt(to);
    return Promise.resolve();
  }
  return tween(ms, (k) => void (el.textContent = fmt(Math.round(from + (to - from) * k))), easeOut);
}

/** One ring spreading from a point. */
export function ring(p: Pt, color: string, o: { from?: number; to?: number; ms?: number; width?: number; delay?: number } = {}): void {
  const { from = 14, to = 90, ms = 420, width = 2.5, delay = 0 } = o;
  const r = put('sk-ring', p, '', { width: `${to}px`, height: `${to}px`, borderColor: color, borderWidth: `${width}px` });
  void go(r, [{ opacity: 0.95, transform: `translate(-50%,-50%) scale(${from / to})` }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1)' }], { ms, delay }).then(
    () => r.remove(),
    () => undefined,
  );
}

/** A handful of sparks thrown from a point. */
export function sparks(p: Pt, color: string | string[], n = 10, reach = 70, o: { ms?: number; size?: number; dir?: number; spread?: number } = {}): void {
  const { ms = 460, size = 5, dir = -Math.PI / 2, spread = Math.PI * 2 } = o;
  const colors = typeof color === 'string' ? [color] : color;
  for (let i = 0; i < n; i++) {
    const a = dir + (Math.random() - 0.5) * spread;
    const d = reach * (0.45 + Math.random() * 0.75);
    const c = colors[i % colors.length];
    const s = put('sk-spark', p, '', { width: `${size * (0.6 + Math.random() * 0.8)}px`, height: `${size * (0.6 + Math.random() * 0.8)}px`, background: c, color: c });
    void go(s, [{ opacity: 1, transform: 'translate(-50%,-50%)' }, { opacity: 0, transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 18}px)) scale(.3)` }], { ms: ms * (0.7 + Math.random() * 0.6), ease: 'cubic-bezier(.1,.7,.3,1)' }).then(
      () => s.remove(),
      () => undefined,
    );
  }
}

/** A short jolt of the things named. */
export function shake(els: Element[], power = 4, ms = 220): void {
  const frames: Keyframe[] = [0, 1, 2, 3, 4, 5].map((i) => ({ transform: i === 5 ? 'translate(0,0)' : `translate(${((i % 2 ? 1 : -1) * power * (5 - i)) / 5}px, ${((i % 3) - 1) * power * 0.5}px)` }));
  for (const el of els) void nudge(el, frames, ms, 'linear').catch(() => undefined);
}

/** A line of light from a to b that draws itself and fades. */
export function streak(a: Pt, b: Pt, color: string, o: { ms?: number; width?: number; hold?: number } = {}): void {
  const { ms = 220, width = 2, hold = 120 } = o;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const el = put('sk-streak', a, '', { width: `${len}px`, height: `${width}px`, background: `linear-gradient(90deg, transparent, ${color})`, transform: `translateY(-50%) rotate(${Math.atan2(b.y - a.y, b.x - a.x)}rad)` });
  void go(el, [{ clipPath: 'inset(0 100% 0 0)', opacity: 1 }, { clipPath: 'inset(0 0 0 0)', opacity: 1, offset: ms / (ms + hold + 160) }, { clipPath: 'inset(0 0 0 0)', opacity: 1, offset: (ms + hold) / (ms + hold + 160) }, { clipPath: 'inset(0 0 0 60%)', opacity: 0 }], { ms: ms + hold + 160, ease: 'linear' }).then(
    () => el.remove(),
    () => undefined,
  );
}

// ---------------------------------------------------------------- the blow
/** The frame of the hit, held: everything stops dead for a moment, then goes on. */
export async function hitStop(ms: number): Promise<void> {
  if (boost > 1) return;
  const held = document.getAnimations().filter((a) => a.playState === 'running' && !((a.effect as KeyframeEffect | null)?.target as Element | null)?.classList.contains('sk-flash'));
  for (const a of held) a.pause();
  frozen = true;
  try {
    await wait(ms);
  } finally {
    frozen = false;
    for (const a of held) if (a.playState === 'paused') a.play();
  }
}
/** Shakes the whole picture. power in px at its strongest; it dies away. */
export function quake(power: number, ms = 300): void {
  const n = Math.max(4, Math.round(ms / 28));
  const frames: Keyframe[] = [];
  for (let i = 0; i <= n; i++) {
    const fall = Math.pow(1 - i / n, 1.6) * power;
    frames.push({ translate: i === n ? '0px 0px' : `${((i % 2 ? 1 : -1) * fall * (0.5 + Math.random() * 0.5)).toFixed(1)}px ${((i % 2 ? -1 : 1) * fall * (0.4 + Math.random() * 0.4)).toFixed(1)}px` });
  }
  for (const el of shakers) anim(el, frames, { ms, ease: 'linear', fill: 'none' });
}
/** The table takes a blow: everything drops a little and comes back. */
export function bump(depth = 6, ms = 220): void {
  for (const el of shakers) anim(el, [{ translate: '0 0' }, { translate: `0 ${depth}px`, offset: 0.18 }, { translate: `0 ${-depth * 0.25}px`, offset: 0.55 }, { translate: '0 0' }], { ms, ease: 'ease-out', fill: 'none' });
}
/** One flash of light over everything. */
export function flash(color = '#fff', peak = 0.5, ms = 200): void {
  const el = mk('sk-flash');
  el.style.background = color;
  void go(el, [{ opacity: peak }, { opacity: 0 }], { ms, ease: 'ease-out' }).then(
    () => el.remove(),
    () => undefined,
  );
}
/** The edges of the screen take a colour for a moment: whose moment this is. */
export function wash(color: string, peak = 0.8, ms = 900): void {
  const el = mk('sk-wash');
  el.style.setProperty('--wash', color);
  void go(el, [{ opacity: 0 }, { opacity: peak, offset: 0.12 }, { opacity: peak * 0.55, offset: 0.5 }, { opacity: 0 }], { ms, ease: 'linear' }).then(
    () => el.remove(),
    () => undefined,
  );
}
/** Rays of light turning slowly behind something, then gone. */
export function rays(p: Pt, color: string, size: number, ms = 1000): HTMLElement {
  const el = put('sk-rays', p, '', { width: `${size}px`, height: `${size}px` });
  el.style.setProperty('--ray', color);
  void go(el, [{ opacity: 0, rotate: '0deg', scale: '.3' }, { opacity: 0.95, scale: '1', offset: 0.16 }, { opacity: 0.7, offset: 0.6 }, { opacity: 0, rotate: '55deg', scale: '1.08' }], { ms, ease: 'linear' }).then(
    () => el.remove(),
    () => undefined,
  );
  return el;
}
