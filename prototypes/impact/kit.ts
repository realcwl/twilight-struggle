// The effects toolkit the ten sets are built from: screen shake, hit-stop, flashes, rings, particles,
// bolts, cracks, slammed text, things thrown along an arc. Everything is drawn in layers of its own over
// (or just under) the map's tokens, in viewport pixels; nothing here is used by the game.
//
// Every duration goes through t(), so the whole show can be slowed down to be studied, and every wait
// can be cut off, so a replay starts clean.

export type Pt = { x: number; y: number };
export type Box = { left: number; top: number; width: number; height: number };
export const CANCELLED = { cancelled: true } as const;

export const OUT = 'cubic-bezier(.2,.8,.2,1)';
export const IN = 'cubic-bezier(.55,0,1,.55)';
export const BACK = 'cubic-bezier(.3,1.6,.5,1)';
export const INOUT = 'cubic-bezier(.5,0,.2,1)';

let speed = 1;
let top!: HTMLElement;
let ground!: HTMLElement;
let svgTop!: SVGSVGElement;
let svgGround!: SVGSVGElement;
let canvas!: HTMLCanvasElement;
let pen!: CanvasRenderingContext2D;
let shakers: HTMLElement[] = [];
let zoomer: HTMLElement | null = null;
let frozen = false;
const anims = new Set<Animation>();
const waits = new Set<(why: unknown) => void>();
const tweens = new Set<{ stop(): void }>();

export const setSpeed = (v: number): void => {
  speed = v;
};
export const t = (ms: number): number => ms / speed;
export const rand = (a: number, b: number): number => a + Math.random() * (b - a);
export const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
export const mid = (r: Box): Pt => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
export const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};
const SVG = 'http://www.w3.org/2000/svg';

export function mount(o: { top: HTMLElement; ground: HTMLElement; shake: HTMLElement[]; zoom: HTMLElement }): void {
  top = o.top;
  ground = o.ground;
  shakers = o.shake;
  zoomer = o.zoom;
  svgGround = document.createElementNS(SVG, 'svg');
  svgGround.setAttribute('class', 'fx-svg');
  ground.append(svgGround);
  canvas = document.createElement('canvas');
  canvas.className = 'fx-canvas';
  svgTop = document.createElementNS(SVG, 'svg');
  svgTop.setAttribute('class', 'fx-svg');
  top.append(canvas, svgTop);
  pen = canvas.getContext('2d')!;
  const size = (): void => {
    const d = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = innerWidth * d;
    canvas.height = innerHeight * d;
    pen.setTransform(d, 0, 0, d, 0, 0);
  };
  size();
  window.addEventListener('resize', size);
  requestAnimationFrame(loop);
}

/** Stops everything that is going on and clears the layers. Pending waits reject with CANCELLED. */
export function reset(): void {
  for (const a of anims) a.cancel();
  anims.clear();
  for (const stop of [...waits]) stop(CANCELLED);
  waits.clear();
  for (const tw of [...tweens]) tw.stop();
  tweens.clear();
  parts.length = 0;
  frozen = false;
  for (const el of [...top.children]) if (el !== canvas && el !== svgTop) el.remove();
  for (const el of [...ground.children]) if (el !== svgGround) el.remove();
  svgTop.replaceChildren();
  svgGround.replaceChildren();
}

// ---------------------------------------------------------------- time
export function wait(ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      waits.delete(stop);
      resolve();
    }, t(ms));
    const stop = (why: unknown): void => {
      clearTimeout(timer);
      reject(why);
    };
    waits.add(stop);
  });
}

export type AnimOpts = { ms: number; ease?: string; delay?: number; fill?: FillMode; add?: boolean };
/** A WAAPI animation at the show's speed. `add`: on top of whatever transform the element already has. */
export function anim(el: Element, frames: Keyframe[], { ms, ease = OUT, delay = 0, fill = 'both', add = false }: AnimOpts): Animation {
  const a = el.animate(frames, { duration: Math.max(1, t(ms)), delay: t(delay), easing: ease, fill, composite: add ? 'add' : 'replace' });
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
/** A passing movement of something that is not ours (a token, a die): added to its own transform, leaving nothing behind. */
export const nudge = (el: Element, frames: Keyframe[], ms: number, ease = OUT, delay = 0): Promise<void> => go(el, frames, { ms, ease, delay, fill: 'backwards', add: true });

/** Runs fn(k) every frame with k from 0 to 1. Stops for a hit-stop. */
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
      if (!frozen) spent += (now - last) * speed;
      last = now;
      const k = Math.min(1, spent / ms);
      fn(ease(k));
      if (k >= 1) {
        tweens.delete(self);
        resolve();
      } else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
}
export const easeIn = (k: number): number => k * k;
export const easeOut = (k: number): number => 1 - (1 - k) * (1 - k);
export const easeInOut = (k: number): number => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

/** The frame of the hit, held: everything stops dead for a moment, then goes on. */
export async function hitStop(ms: number): Promise<void> {
  // everything stops but the light: a flash held at its peak would be a white screen
  const lit = (a: Animation): boolean => ((a.effect as KeyframeEffect | null)?.target as Element | null)?.classList.contains('fx-flash') ?? false;
  const held = document.getAnimations().filter((a) => a.playState === 'running' && !lit(a));
  for (const a of held) a.pause();
  frozen = true;
  try {
    await wait(ms);
  } finally {
    frozen = false;
    for (const a of held) if (a.playState === 'paused') a.play();
  }
}

// ---------------------------------------------------------------- the screen
/** Shakes the whole picture. power in px at its strongest; it dies away. */
export function shake(power: number, ms = 320, axis: 'both' | 'y' | 'x' = 'both'): void {
  const n = Math.max(4, Math.round(ms / 28));
  const frames: Keyframe[] = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const fall = Math.pow(1 - k, 1.6) * power;
    const x = axis === 'y' ? 0 : (i % 2 ? 1 : -1) * fall * rand(0.5, 1);
    const y = axis === 'x' ? 0 : (i % 2 ? -1 : 1) * fall * rand(0.5, 1) * (axis === 'y' ? 1 : 0.8);
    frames.push({ translate: i === n ? '0px 0px' : `${x.toFixed(1)}px ${y.toFixed(1)}px` });
  }
  for (const el of shakers) anim(el, frames, { ms, ease: 'linear', fill: 'none' });
}
/** The table takes a blow: everything drops a little and comes back. */
export function bump(depth = 6, ms = 220): void {
  for (const el of shakers) anim(el, [{ translate: '0 0' }, { translate: `0 ${depth}px`, offset: 0.18 }, { translate: `0 ${-depth * 0.25}px`, offset: 0.55 }, { translate: '0 0' }], { ms, ease: 'ease-out', fill: 'none' });
}
/** The camera kicks in and settles back. */
export function punch(scale = 1.03, ms = 260, at?: Pt): void {
  if (!zoomer) return;
  if (at) zoomer.style.transformOrigin = `${at.x}px ${at.y}px`;
  anim(zoomer, [{ scale: '1' }, { scale: String(scale), offset: 0.15 }, { scale: '1' }], { ms, ease: 'ease-out', fill: 'none' });
}
export function flash(color = '#fff', peak = 0.6, ms = 160): void {
  const el = mk('fx-flash');
  el.style.background = color;
  void go(el, [{ opacity: peak }, { opacity: 0 }], { ms, ease: 'ease-out' }).then(() => el.remove(), () => undefined);
}
/** Dims the picture until told otherwise. */
export function dim(alpha = 0.5, ms = 120, color = '#05070c'): { off(ms?: number): void; el: HTMLElement } {
  const el = mk('fx-flash');
  el.style.background = color;
  anim(el, [{ opacity: 0 }, { opacity: alpha }], { ms });
  return {
    el,
    off: (out = 220) => void go(el, [{ opacity: alpha }, { opacity: 0 }], { ms: out }).then(() => el.remove(), () => undefined),
  };
}

// ---------------------------------------------------------------- pieces of DOM
export function mk(cls: string, style: Partial<CSSStyleDeclaration> = {}, under = false): HTMLElement {
  const el = document.createElement('div');
  el.className = cls;
  Object.assign(el.style, style);
  (under ? ground : top).append(el);
  return el;
}
/** A thing of ours placed by its centre. */
export function put(cls: string, p: Pt, w: number, h: number, style: Partial<CSSStyleDeclaration> = {}, under = false): HTMLElement {
  return mk(`fx-at ${cls}`, { left: `${p.x - w / 2}px`, top: `${p.y - h / 2}px`, width: `${w}px`, height: `${h}px`, ...style }, under);
}
/** Behind everything else in the upper layer (the dice stand in front of it). */
export const toBack = (el: Element): void => void top.insertBefore(el, top.firstChild);
export const gone = (el: Element, after = 0): void => {
  if (after) wait(after).then(() => el.remove(), () => undefined);
  else el.remove();
};
/** A stand-in for part of a token: a block of colour with a number on it, exactly where the real one is. */
export function chip(r: Box, bg: string, text: string, o: { color?: string; radius?: string; cls?: string } = {}): HTMLElement {
  const el = mk(`fx-at fx-chip ${o.cls ?? ''}`, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, background: bg, color: o.color ?? '#fff', borderRadius: o.radius ?? '2px', fontSize: `${Math.max(9, r.height * 0.62)}px`, lineHeight: `${r.height}px` });
  el.textContent = text;
  return el;
}
/** A copy of one of our own elements, lifted out to where it stands, so that it can be cut up or thrown. */
export function ghost(el: HTMLElement): HTMLElement {
  const r = el.getBoundingClientRect();
  const c = el.cloneNode(true) as HTMLElement;
  c.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  Object.assign(c.style, { position: 'absolute', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, margin: '0', translate: '', rotate: '', scale: '', visibility: 'visible' });
  c.style.setProperty('--die', `${r.width}px`);
  top.append(c);
  return c;
}
/** Two copies of an element, one on each side of a straight cut through its middle. angle in degrees: 0 a level cut, 90 an upright one. */
export function halves(el: HTMLElement, angle = -18): [HTMLElement, HTMLElement] {
  const r = el.getBoundingClientRect();
  const cx = r.width / 2;
  const cy = r.height / 2;
  const L = Math.max(r.width, r.height) * 3;
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad) * L;
  const dy = Math.sin(rad) * L;
  const side = (sign: number): string => {
    const nx = -Math.sin(rad) * L * sign;
    const ny = Math.cos(rad) * L * sign;
    const pts = [[cx - dx, cy - dy], [cx + dx, cy + dy], [cx + dx + nx, cy + dy + ny], [cx - dx + nx, cy - dy + ny]];
    return `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(', ')})`;
  };
  const a = ghost(el);
  const b = ghost(el);
  a.style.clipPath = side(-1);
  b.style.clipPath = side(1);
  return [a, b];
}
/** Copies of an element cut into n level bands, top to bottom. */
export function bands(el: HTMLElement, n = 4): HTMLElement[] {
  return Array.from({ length: n }, (_, i) => {
    const c = ghost(el);
    c.style.clipPath = `inset(${((i / n) * 100).toFixed(2)}% -50% ${(100 - ((i + 1) / n) * 100).toFixed(2)}% -50%)`;
    return c;
  });
}

/** A ring that spreads from a point. `under`: on the ground, beneath the tokens, flattened as the ground is seen. */
export function ring(p: Pt, o: { color?: string; from?: number; to: number; width?: number; ms?: number; under?: boolean; squash?: number; ease?: string; fill?: string; delay?: number; peak?: number } = { to: 120 }): void {
  const { color = '#fff', from = 8, to, width = 3, ms = 420, under = false, squash = under ? 0.5 : 1, ease = OUT, fill = 'transparent', delay = 0, peak = 1 } = o;
  const el = put('fx-ring', p, to, to, { border: `${width}px solid ${color}`, background: fill, opacity: '0' }, under);
  void go(el, [{ transform: `scale(${from / to}, ${(from / to) * squash})`, opacity: peak }, { transform: `scale(1, ${squash})`, opacity: 0 }], { ms, ease, delay }).then(() => el.remove(), () => undefined);
}
/** A mark left on the ground that fades. */
export function scorch(p: Pt, size: number, ms = 1600, color = 'rgba(12,8,5,.75)'): void {
  const el = put('fx-scorch', p, size, size * 0.5, { background: `radial-gradient(closest-side, ${color}, transparent)` }, true);
  void go(el, [{ opacity: 0 }, { opacity: 1, offset: 0.06 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], { ms, ease: 'linear' }).then(() => el.remove(), () => undefined);
}
/** Rays from a point, the way a poster draws glory. */
export function rays(p: Pt, o: { color: string; size?: number; ms?: number; under?: boolean; spokes?: number; alpha?: number; turn?: number; back?: boolean }): HTMLElement {
  const { color, size = 900, ms = 700, under = true, spokes = 14, alpha = 0.85, turn = 14, back = false } = o;
  const step = 360 / spokes;
  const el = put('fx-rays', p, size, size, { background: `repeating-conic-gradient(from 0deg, ${color} 0deg ${step * 0.5}deg, transparent ${step * 0.5}deg ${step}deg)` }, under && !back);
  // behind everything else in the upper layer: the dice stand in front of it
  if (back) top.insertBefore(el, top.firstChild);
  void go(el, [{ opacity: 0, transform: 'scale(.2) rotate(0deg)' }, { opacity: alpha, transform: `scale(1) rotate(${turn * 0.3}deg)`, offset: 0.14 }, { opacity: alpha, transform: `scale(1.04) rotate(${turn * 0.8}deg)`, offset: 0.75 }, { opacity: 0, transform: `scale(1.08) rotate(${turn}deg)` }], { ms, ease: 'linear' }).then(() => el.remove(), () => undefined);
  return el;
}
/** Words that hit the screen. */
export function slam(p: Pt, text: string, o: { cls?: string; color?: string; size?: number; ms?: number; rot?: number; from?: number; under?: boolean } = {}): HTMLElement {
  const { cls = '', color = '#fff', size = 44, ms = 1100, rot = -6, from = 2.6 } = o;
  const el = mk(`fx-at fx-slam ${cls}`, { left: `${p.x}px`, top: `${p.y}px`, color, fontSize: `${size}px` });
  el.textContent = text;
  void go(el, [{ opacity: 0, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${from})` }, { opacity: 1, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(1)`, offset: Math.min(0.3, 130 / ms) }, { opacity: 1, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(1)`, offset: 0.78 }, { opacity: 0, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(1.04)` }], { ms, ease: 'cubic-bezier(.3,0,.2,1)' }).then(() => el.remove(), () => undefined);
  return el;
}

// ---------------------------------------------------------------- lines
function path(d: string, o: { color: string; width: number; under?: boolean; glow?: string; cap?: string; dash?: string; fill?: string }): SVGPathElement {
  const el = document.createElementNS(SVG, 'path');
  el.setAttribute('d', d);
  el.setAttribute('fill', o.fill ?? 'none');
  el.setAttribute('stroke', o.color);
  el.setAttribute('stroke-width', String(o.width));
  el.setAttribute('stroke-linecap', o.cap ?? 'round');
  el.setAttribute('stroke-linejoin', 'round');
  if (o.dash) el.setAttribute('stroke-dasharray', o.dash);
  if (o.glow) el.style.filter = `drop-shadow(0 0 6px ${o.glow}) drop-shadow(0 0 14px ${o.glow})`;
  (o.under ? svgGround : svgTop).append(el);
  return el;
}
const jag = (a: Pt, b: Pt, rough: number, depth = 4): Pt[] => {
  let pts = [a, b];
  let r = rough;
  for (let i = 0; i < depth; i++) {
    const next: Pt[] = [];
    for (let j = 0; j < pts.length - 1; j++) {
      const p = pts[j];
      const q = pts[j + 1];
      const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      const off = rand(-r, r);
      next.push(p, { x: (p.x + q.x) / 2 + (-(q.y - p.y) / len) * off, y: (p.y + q.y) / 2 + ((q.x - p.x) / len) * off });
    }
    next.push(pts[pts.length - 1]);
    pts = next;
    r *= 0.55;
  }
  return pts;
};
const dOf = (pts: Pt[]): string => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');

/** Lightning from a to b: redrawn a few times while it lasts, with side branches. */
export function bolt(a: Pt, b: Pt, o: { color?: string; core?: string; width?: number; ms?: number; rough?: number; branches?: number } = {}): void {
  const { color = '#9fd0ff', core = '#fff', width = 4, ms = 220, rough = 46, branches = 2 } = o;
  const draws = Math.max(2, Math.round(ms / 55));
  let made: SVGPathElement[] = [];
  const draw = (): void => {
    made.forEach((el) => el.remove());
    made = [];
    const pts = jag(a, b, rough);
    made.push(path(dOf(pts), { color, width: width * 2.4, glow: color }), path(dOf(pts), { color: core, width }));
    for (let i = 0; i < branches; i++) {
      const from = pts[Math.floor(rand(0.2, 0.75) * pts.length)];
      const ang = Math.atan2(b.y - a.y, b.x - a.x) + rand(-1, 1);
      const len = rand(40, 110);
      made.push(path(dOf(jag(from, { x: from.x + Math.cos(ang) * len, y: from.y + Math.sin(ang) * len }, rough * 0.4, 3)), { color, width: width * 0.8, glow: color }));
    }
    made.forEach((el) => (el.style.opacity = String(rand(0.75, 1))));
  };
  draw();
  let i = 1;
  const again = (): void => {
    if (i++ < draws) {
      draw();
      wait(55).then(again, () => made.forEach((el) => el.remove()));
    } else made.forEach((el) => void go(el, [{ opacity: 1 }, { opacity: 0 }], { ms: 90 }).then(() => el.remove(), () => el.remove()));
  };
  wait(55).then(again, () => made.forEach((el) => el.remove()));
}
/** Cracks running out from a point, which stay a while. */
export function cracks(p: Pt, o: { n?: number; len?: number; color?: string; width?: number; ms?: number; hold?: number; under?: boolean; squash?: number; rough?: number; glow?: string } = {}): void {
  const { n = 7, len = 90, color = '#1a120b', width = 2, ms = 140, hold = 900, under = true, squash = under ? 0.5 : 1, rough = 12, glow } = o;
  const start = rand(0, Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const ang = start + (i / n) * Math.PI * 2 + rand(-0.25, 0.25);
    const l = len * rand(0.55, 1);
    const pts = jag(p, { x: p.x + Math.cos(ang) * l, y: p.y + Math.sin(ang) * l * squash }, rough, 3);
    const el = path(dOf(pts), { color, width: width * rand(0.6, 1.2), under, glow });
    const total = el.getTotalLength();
    el.style.strokeDasharray = String(total);
    void go(el, [{ strokeDashoffset: total, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: ms / (ms + hold + 400) }, { strokeDashoffset: 0, opacity: 1, offset: (ms + hold) / (ms + hold + 400) }, { strokeDashoffset: 0, opacity: 0 }], { ms: ms + hold + 400, ease: 'linear' }).then(() => el.remove(), () => el.remove());
  }
}
/** A straight stroke drawn from a to b in a blink, which then thins away: a tracer, a cut, a beam. */
export function streak(a: Pt, b: Pt, o: { color?: string; width?: number; ms?: number; hold?: number; glow?: string; under?: boolean; dash?: string } = {}): Promise<void> {
  const { color = '#fff', width = 3, ms = 90, hold = 120, glow, under = false, dash } = o;
  const el = path(`M${a.x} ${a.y}L${b.x} ${b.y}`, { color, width, glow, under, cap: 'round' });
  const total = el.getTotalLength();
  if (dash) {
    el.setAttribute('stroke-dasharray', dash);
    void go(el, [{ opacity: 0 }, { opacity: 1, offset: ms / (ms + hold + 160) }, { opacity: 1, offset: (ms + hold) / (ms + hold + 160) }, { opacity: 0 }], { ms: ms + hold + 160, ease: 'linear' }).then(() => el.remove(), () => el.remove());
  } else {
    el.style.strokeDasharray = String(total);
    void go(el, [{ strokeDashoffset: total, strokeWidth: width }, { strokeDashoffset: 0, strokeWidth: width, offset: ms / (ms + hold + 160) }, { strokeDashoffset: 0, strokeWidth: width, offset: (ms + hold) / (ms + hold + 160) }, { strokeDashoffset: 0, strokeWidth: 0 }], { ms: ms + hold + 160, ease: 'linear' }).then(() => el.remove(), () => el.remove());
  }
  return wait(ms);
}

/** Moves one of our elements, by its centre, from a to b along an arc. lift: how far the arc rises, in px. */
export function fly(el: HTMLElement, a: Pt, b: Pt, o: { ms: number; lift?: number; ease?: (k: number) => number; spin?: number; scale?: [number, number]; each?: (p: Pt, k: number) => void } ): Promise<void> {
  const { ms, lift = 0, ease = (k: number) => k, spin = 0, scale = [1, 1], each } = o;
  Object.assign(el.style, { position: 'absolute', left: '0px', top: '0px' });
  return tween(ms, (k) => {
    const x = a.x + (b.x - a.x) * k;
    const y = a.y + (b.y - a.y) * k - lift * 4 * k * (1 - k);
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) rotate(${(spin * k).toFixed(1)}deg) scale(${(scale[0] + (scale[1] - scale[0]) * k).toFixed(3)})`;
    each?.({ x, y }, k);
  }, ease);
}

// ---------------------------------------------------------------- particles
export type Kind = 'shard' | 'glass' | 'spark' | 'dust' | 'smoke' | 'chip' | 'ash' | 'debris' | 'ink' | 'confetti' | 'pixel' | 'ember' | 'pip';
type Part = { kind: Kind; x: number; y: number; vx: number; vy: number; g: number; drag: number; life: number; age: number; size: number; rot: number; vr: number; color: string; shape: number[]; floor: number | null; grow: number };
const parts: Part[] = [];

export type Burst = {
  kind: Kind;
  n: number;
  colors: readonly string[];
  /** px per second */
  speed?: [number, number];
  /** the way it mostly goes, in degrees: 0 right, -90 up */
  angle?: number;
  /** how wide around that, in degrees; 360 = every way */
  spread?: number;
  gravity?: number;
  drag?: number;
  life?: [number, number];
  size?: [number, number];
  spin?: number;
  /** the particles start anywhere in a box this big around the point */
  area?: [number, number];
  /** bounce on this y */
  floor?: number;
  grow?: number;
};
export function burst(p: Pt, b: Burst): void {
  const { kind, n, colors, speed: sp = [120, 420], angle = -90, spread = 360, gravity = 900, drag = 0.6, life = [0.5, 1], size = [4, 9], spin = 9, area = [0, 0], floor = null, grow = 0 } = b;
  for (let i = 0; i < n; i++) {
    const ang = ((angle + rand(-spread / 2, spread / 2)) * Math.PI) / 180;
    const v = rand(sp[0], sp[1]);
    const a0 = rand(0, Math.PI * 2);
    parts.push({
      kind, x: p.x + rand(-area[0] / 2, area[0] / 2), y: p.y + rand(-area[1] / 2, area[1] / 2), vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, g: gravity, drag,
      life: rand(life[0], life[1]), age: 0, size: rand(size[0], size[1]), rot: rand(0, Math.PI * 2), vr: rand(-spin, spin), color: pick(colors),
      shape: [a0, a0 + rand(1.6, 2.6), a0 + rand(3.4, 4.8), rand(0.6, 1), rand(0.6, 1), rand(0.6, 1)], floor, grow,
    });
  }
}

let before = performance.now();
function loop(now: number): void {
  const dt = Math.min(0.05, (now - before) / 1000) * speed;
  before = now;
  pen.clearRect(0, 0, innerWidth, innerHeight);
  if (parts.length) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (!frozen) {
        p.age += dt;
        if (p.age >= p.life) {
          parts.splice(i, 1);
          continue;
        }
        const d = Math.pow(p.drag, dt * 4);
        p.vx *= d;
        p.vy = p.vy * d + p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.size += p.grow * dt;
        if (p.floor !== null && p.y > p.floor && p.vy > 0) {
          p.y = p.floor;
          p.vy *= -0.38;
          p.vx *= 0.7;
          p.vr *= 0.6;
        }
      }
      draw(p);
    }
    pen.globalAlpha = 1;
    pen.globalCompositeOperation = 'source-over';
  }
  requestAnimationFrame(loop);
}
function draw(p: Part): void {
  const k = p.age / p.life;
  const fade = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1;
  pen.globalCompositeOperation = p.kind === 'spark' || p.kind === 'ember' ? 'lighter' : 'source-over';
  pen.globalAlpha = fade;
  pen.fillStyle = p.color;
  pen.strokeStyle = p.color;
  switch (p.kind) {
    case 'spark': {
      const v = Math.hypot(p.vx, p.vy) || 1;
      const len = Math.min(34, v * 0.045) + 2;
      pen.lineWidth = p.size * (1 - k * 0.6);
      pen.lineCap = 'round';
      pen.beginPath();
      pen.moveTo(p.x, p.y);
      pen.lineTo(p.x - (p.vx / v) * len, p.y - (p.vy / v) * len);
      pen.stroke();
      break;
    }
    case 'ember':
      pen.beginPath();
      pen.arc(p.x, p.y, p.size * (1 - k * 0.5), 0, 7);
      pen.fill();
      break;
    case 'dust':
    case 'smoke': {
      pen.globalAlpha = (p.kind === 'smoke' ? 0.3 : 0.42) * (1 - k) * (k < 0.1 ? k / 0.1 : 1);
      pen.beginPath();
      pen.arc(p.x, p.y, p.size, 0, 7);
      pen.fill();
      break;
    }
    case 'ink':
      pen.globalAlpha = Math.min(1, (1 - k) * 2.2);
      pen.beginPath();
      pen.ellipse(p.x, p.y, p.size, p.size * 0.72, p.rot, 0, 7);
      pen.fill();
      break;
    case 'pip':
      pen.beginPath();
      pen.arc(p.x, p.y, p.size, 0, 7);
      pen.fill();
      break;
    case 'ash':
    case 'pixel': {
      const s = p.kind === 'ash' ? p.size * (1 - k * 0.5) : p.size;
      pen.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      break;
    }
    case 'chip': {
      // a coin seen turning over
      const squash = Math.abs(Math.cos(p.rot));
      pen.beginPath();
      pen.ellipse(p.x, p.y, p.size, Math.max(1, p.size * squash), 0, 0, 7);
      pen.fill();
      pen.lineWidth = Math.max(1, p.size * 0.22);
      pen.strokeStyle = 'rgba(255,255,255,.75)';
      pen.stroke();
      break;
    }
    case 'confetti': {
      pen.save();
      pen.translate(p.x, p.y);
      pen.rotate(p.rot);
      pen.fillRect(-p.size / 2, (-p.size / 2) * Math.cos(p.rot * 2.3), p.size, p.size * 0.5);
      pen.restore();
      break;
    }
    case 'debris': {
      pen.save();
      pen.translate(p.x, p.y);
      pen.rotate(p.rot);
      pen.fillRect(-p.size / 2, -p.size * 0.35, p.size, p.size * 0.7);
      pen.restore();
      break;
    }
    default: {
      // shard, glass: a three-cornered piece, each its own shape
      pen.save();
      pen.translate(p.x, p.y);
      pen.rotate(p.rot);
      pen.beginPath();
      for (let i = 0; i < 3; i++) {
        const r = p.size * p.shape[3 + i];
        const x = Math.cos(p.shape[i]) * r;
        const y = Math.sin(p.shape[i]) * r;
        if (i) pen.lineTo(x, y);
        else pen.moveTo(x, y);
      }
      pen.closePath();
      if (p.kind === 'glass') pen.globalAlpha = fade * 0.62;
      pen.fill();
      pen.globalAlpha = fade * 0.8;
      pen.lineWidth = 1;
      pen.strokeStyle = p.kind === 'glass' ? '#fff' : 'rgba(255,255,255,.45)';
      pen.stroke();
      pen.restore();
    }
  }
}
