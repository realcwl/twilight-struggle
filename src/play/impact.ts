import { text as displayText } from '../i18n/index.js';
// The moments that land. Three of them, each with one way of being felt:
//
//   control()   a side has just come to control a country: its plinth is set down hard, like a piece
//               of wood slapped on a table. It lands a little askew, rocks once, the table jumps and
//               the tokens near it jump with it.
//   shatter()   a coup has cleared a side out of a country: its number freezes, cracks twice, and
//               breaks into shards on a held frame; its plinth, if it had one, goes with it.
//   point() and fire()   dice. The points added to a die come in one at a time, each a tracer and a
//               tick that climbs; and whoever wins fires on what it beat: the other die, or, when a
//               single die had a number to beat, that number.
//
// Everything is drawn in one layer over the play stage. Timing goes through the presenter's Fx, so
// it follows the pace, Space cuts it short, and it dies with the presenter.
import type { Fx } from './fx';
import type { ImpactSound } from './impactSound';
import type { SideIndex } from './types';
import './impact.css';

type Pt = { x: number; y: number };
type Box = { left: number; top: number; width: number; height: number };
type Kind = 'shard' | 'glass' | 'spark' | 'dust' | 'smoke' | 'debris' | 'pip' | 'ember';
type Part = { kind: Kind; x: number; y: number; vx: number; vy: number; g: number; drag: number; life: number; age: number; size: number; rot: number; vr: number; color: string; shape: number[]; floor: number | null; grow: number };
type Burst = { kind: Kind; n: number; colors: readonly string[]; speed?: [number, number]; angle?: number; spread?: number; gravity?: number; drag?: number; life?: [number, number]; size?: [number, number]; spin?: number; area?: [number, number]; floor?: number; grow?: number };

export type Impact = {
  /** Right after the change that gave `side` the country: its plinth comes down. */
  control(id: string, side: SideIndex): Promise<void>;
  /** `side`'s number in the country is destroyed. `commit` makes the change; it is called on the frame of the hit. */
  shatter(id: string, side: SideIndex, commit: () => void): Promise<void>;
  /** One point reaches a die's sum: a tracer from where it is written to the sum. Resolves as it lands. */
  point(from: Element, to: Element, i: number, up: boolean): Promise<void>;
  /** The winning die fires on what it beat. `foe`: whose die that was, or null when it was a number to beat. */
  fire(die: HTMLElement, target: HTMLElement, foe: SideIndex | null): Promise<void>;
  dispose(): void;
};

const SVG = 'http://www.w3.org/2000/svg';
const OUT = 'cubic-bezier(.2,.8,.2,1)';
const IN = 'cubic-bezier(.55,0,1,.55)';
const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const mid = (r: Box): Pt => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
/** A colour moved towards white (k > 0) or black (k < 0). */
function shade(colour: string, k: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(colour.trim());
  if (!m) return colour;
  const n = parseInt(m[1], 16);
  const to = k > 0 ? 255 : 0;
  const ch = (s: number): number => Math.round(((n >> s) & 255) + (to - ((n >> s) & 255)) * Math.abs(k));
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

export function makeImpact(o: { layer: HTMLElement; container: HTMLElement; fx: Fx; pace: number; sound: ImpactSound | null }): Impact {
  const { layer, container, fx, sound } = o;
  const pace = Math.max(0.01, o.pace);
  const calm = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let root: HTMLElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let pen: CanvasRenderingContext2D | null = null;
  let svg: SVGSVGElement | null = null;
  const parts: Part[] = [];
  const anims = new Set<Animation>();
  let raf = 0;
  let frozen = false;
  let before = 0;

  // ---------------------------------------------------------------- the layer
  const size = (): void => {
    if (!canvas || !pen) return;
    const d = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = layer.clientWidth * d;
    canvas.height = layer.clientHeight * d;
    pen.setTransform(d, 0, 0, d, 0, 0);
  };
  function mount(): HTMLElement {
    if (root) return root;
    root = fx.el('div', 'im-layer');
    canvas = document.createElement('canvas');
    pen = canvas.getContext('2d');
    svg = document.createElementNS(SVG, 'svg');
    root.append(canvas, svg);
    layer.appendChild(root);
    size();
    window.addEventListener('resize', size);
    return root;
  }
  /** Where an element is, in the layer's own pixels. */
  function boxOf(el: Element): Box {
    const r = el.getBoundingClientRect();
    const at = layer.getBoundingClientRect();
    return { left: r.left - at.left, top: r.top - at.top, width: r.width, height: r.height };
  }
  const plateOf = (id: string): HTMLElement | null => container.querySelector<HTMLElement>(`.wm-plate[data-id="${id}"]`);
  const tint = (side: SideIndex): { main: string; light: string; deep: string } => {
    const css = getComputedStyle(layer);
    const main = css.getPropertyValue(side === 0 ? '--a' : '--b').trim() || (side === 0 ? '#2e6ad6' : '#de3f2b');
    return { main, light: css.getPropertyValue(side === 0 ? '--a-l' : '--b-l').trim() || shade(main, 0.45), deep: shade(main, -0.4) };
  };

  // ---------------------------------------------------------------- pieces
  function anim(el: Element, frames: Keyframe[], ms: number, opts: { ease?: string; add?: boolean; fill?: FillMode; delay?: number } = {}): Animation {
    const a = el.animate(frames, { duration: Math.max(1, ms * pace), delay: (opts.delay ?? 0) * pace, easing: opts.ease ?? OUT, fill: opts.fill ?? 'both', composite: opts.add ? 'add' : 'replace' });
    anims.add(a);
    const done = (): void => void anims.delete(a);
    a.finished.then(done, done);
    return a;
  }
  /** One of ours, placed by its centre; gone when its animation is. */
  function put(cls: string, p: Pt, w: number, h: number, style: Partial<CSSStyleDeclaration> = {}): HTMLElement {
    const el = fx.el('div', `im-at ${cls}`);
    Object.assign(el.style, { left: `${p.x - w / 2}px`, top: `${p.y - h / 2}px`, width: `${w}px`, height: `${h}px`, ...style });
    mount().appendChild(el);
    return el;
  }
  const after = (a: Animation, el: Element): void => {
    const drop = (): void => el.remove();
    a.finished.then(drop, drop);
  };
  function flash(color: string, peak: number, ms: number): void {
    const el = fx.el('div', 'im-flash');
    el.style.background = color;
    mount().appendChild(el);
    after(anim(el, [{ opacity: peak }, { opacity: 0 }], ms, { ease: 'ease-out' }), el);
  }
  function ring(p: Pt, to: number, color: string, width: number, ms: number, squash = 1): void {
    const el = put('im-ring', p, to, to, { border: `${width}px solid ${color}` });
    after(anim(el, [{ transform: `scale(${8 / to}, ${(8 / to) * squash})`, opacity: 1 }, { transform: `scale(1, ${squash})`, opacity: 0 }], ms), el);
  }
  function line(d: string, color: string, width: number, glow?: string): SVGPathElement {
    mount();
    const el = document.createElementNS(SVG, 'path');
    el.setAttribute('d', d);
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', color);
    el.setAttribute('stroke-width', String(width));
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    if (glow) el.style.filter = `drop-shadow(0 0 6px ${glow}) drop-shadow(0 0 14px ${glow})`;
    svg!.appendChild(el);
    return el;
  }
  /** Cracks running out from a point, which stay for a moment. */
  function cracks(p: Pt, n: number, len: number, hold: number): void {
    const start = rand(0, Math.PI * 2);
    for (let i = 0; i < n; i++) {
      const ang = start + (i / n) * Math.PI * 2 + rand(-0.25, 0.25);
      const l = len * rand(0.55, 1);
      let d = `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      for (let k = 1; k <= 4; k++) d += `L${(p.x + Math.cos(ang) * l * (k / 4) + rand(-4, 4)).toFixed(1)} ${(p.y + Math.sin(ang) * l * (k / 4) + rand(-4, 4)).toFixed(1)}`;
      const el = line(d, '#fff', rand(1, 1.8));
      const total = el.getTotalLength();
      el.style.strokeDasharray = String(total);
      const all = 140 + hold + 300;
      after(anim(el, [{ strokeDashoffset: total, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: 140 / all }, { strokeDashoffset: 0, opacity: 1, offset: (140 + hold) / all }, { strokeDashoffset: 0, opacity: 0 }], all, { ease: 'linear' }), el);
    }
  }
  /** A straight stroke drawn in a blink, which then thins away. */
  function streak(a: Pt, b: Pt, color: string, width: number, ms: number, hold: number, glow?: string): void {
    const el = line(`M${a.x} ${a.y}L${b.x} ${b.y}`, color, width, glow);
    const total = el.getTotalLength();
    el.style.strokeDasharray = String(total);
    const all = ms + hold + 160;
    after(anim(el, [{ strokeDashoffset: total, strokeWidth: width }, { strokeDashoffset: 0, strokeWidth: width, offset: ms / all }, { strokeDashoffset: 0, strokeWidth: width, offset: (ms + hold) / all }, { strokeDashoffset: 0, strokeWidth: 0 }], all, { ease: 'linear' }), el);
  }
  /** The table takes a blow: everything drops a little and comes back. */
  function bump(depth: number, ms: number): void {
    anim(container, [{ transform: 'translateY(0)' }, { transform: `translateY(${depth}px)`, offset: 0.18 }, { transform: `translateY(${-depth * 0.25}px)`, offset: 0.55 }, { transform: 'translateY(0)' }], ms, { ease: 'ease-out', add: true, fill: 'none' });
  }
  /** The frame of the hit, held: everything stops dead for a moment, but not the light. */
  async function hitStop(ms: number): Promise<void> {
    const lit = (a: Animation): boolean => ((a.effect as KeyframeEffect | null)?.target as Element | null)?.classList.contains('im-flash') ?? false;
    const held = document.getAnimations().filter((a) => a.playState === 'running' && !lit(a));
    for (const a of held) a.pause();
    frozen = true;
    try {
      await fx.wait(ms);
    } finally {
      frozen = false;
      for (const a of held) if (a.playState === 'paused') a.play();
    }
  }
  /** Moves one of ours, by its centre, from a to b along a low arc. */
  function fly(el: HTMLElement, a: Pt, b: Pt, ms: number, lift: number, each?: (p: Pt) => void): Promise<void> {
    Object.assign(el.style, { left: '0px', top: '0px' });
    return new Promise((resolve) => {
      let spent = 0;
      let last = performance.now();
      const tick = (now: number): void => {
        if (fx.dead) return resolve();
        if (!frozen) spent += now - last;
        last = now;
        const k = Math.min(1, spent / Math.max(1, ms * pace));
        const p = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k - lift * 4 * k * (1 - k) };
        el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -50%)`;
        each?.(p);
        if (k >= 1) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  // ---------------------------------------------------------------- particles
  function burst(p: Pt, b: Burst): void {
    mount();
    const { kind, n, colors, speed = [120, 420], angle = -90, spread = 360, gravity = 900, drag = 0.6, life = [0.5, 1], size: sz = [4, 9], spin = 9, area = [0, 0], floor = null, grow = 0 } = b;
    for (let i = 0; i < n; i++) {
      const ang = ((angle + rand(-spread / 2, spread / 2)) * Math.PI) / 180;
      const v = rand(speed[0], speed[1]);
      const a0 = rand(0, Math.PI * 2);
      parts.push({
        kind, x: p.x + rand(-area[0] / 2, area[0] / 2), y: p.y + rand(-area[1] / 2, area[1] / 2), vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, g: gravity, drag,
        life: rand(life[0], life[1]), age: 0, size: rand(sz[0], sz[1]), rot: rand(0, Math.PI * 2), vr: rand(-spin, spin), color: colors[Math.floor(Math.random() * colors.length)],
        shape: [a0, a0 + rand(1.6, 2.6), a0 + rand(3.4, 4.8), rand(0.6, 1), rand(0.6, 1), rand(0.6, 1)], floor, grow,
      });
    }
    if (!raf) {
      before = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }
  function loop(now: number): void {
    raf = 0;
    if (!pen || fx.dead) return;
    const dt = Math.min(0.05, (now - before) / 1000);
    before = now;
    pen.clearRect(0, 0, layer.clientWidth, layer.clientHeight);
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
      draw(pen, p);
    }
    pen.globalAlpha = 1;
    pen.globalCompositeOperation = 'source-over';
    if (parts.length) raf = requestAnimationFrame(loop);
  }
  function draw(g: CanvasRenderingContext2D, p: Part): void {
    const k = p.age / p.life;
    const fade = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1;
    g.globalCompositeOperation = p.kind === 'spark' || p.kind === 'ember' ? 'lighter' : 'source-over';
    g.globalAlpha = fade;
    g.fillStyle = p.color;
    g.strokeStyle = p.color;
    if (p.kind === 'spark') {
      const v = Math.hypot(p.vx, p.vy) || 1;
      const len = Math.min(34, v * 0.045) + 2;
      g.lineWidth = p.size * (1 - k * 0.6);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x - (p.vx / v) * len, p.y - (p.vy / v) * len);
      g.stroke();
    } else if (p.kind === 'ember' || p.kind === 'pip') {
      g.beginPath();
      g.arc(p.x, p.y, p.kind === 'ember' ? p.size * (1 - k * 0.5) : p.size, 0, 7);
      g.fill();
    } else if (p.kind === 'dust' || p.kind === 'smoke') {
      g.globalAlpha = (p.kind === 'smoke' ? 0.3 : 0.42) * (1 - k) * (k < 0.1 ? k / 0.1 : 1);
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, 7);
      g.fill();
    } else if (p.kind === 'debris') {
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillRect(-p.size / 2, -p.size * 0.35, p.size, p.size * 0.7);
      g.restore();
    } else {
      // shard, glass: a three-cornered piece, each its own shape
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.beginPath();
      for (let i = 0; i < 3; i++) {
        const r = p.size * p.shape[3 + i];
        if (i) g.lineTo(Math.cos(p.shape[i]) * r, Math.sin(p.shape[i]) * r);
        else g.moveTo(Math.cos(p.shape[i]) * r, Math.sin(p.shape[i]) * r);
      }
      g.closePath();
      if (p.kind === 'glass') g.globalAlpha = fade * 0.62;
      g.fill();
      g.globalAlpha = fade * 0.8;
      g.lineWidth = 1;
      g.strokeStyle = p.kind === 'glass' ? '#fff' : 'rgba(255,255,255,.45)';
      g.stroke();
      g.restore();
    }
  }

  // ---------------------------------------------------------------- the three
  async function control(id: string, side: SideIndex): Promise<void> {
    const plate = plateOf(id);
    const plinth = plate?.querySelector<HTMLElement>('.wm-plinth');
    // off screen, or motion turned down: it is simply there
    if (!plate || !plinth || calm() || plate.style.display === 'none') return;
    void side;
    // it does not fade in: it is set down, from a hand's height, a little askew
    plate.classList.add('im-set');
    fx.later(() => plate.classList.remove('im-set'), 900 * pace);
    const fall = 170;
    anim(plinth, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1 }], fall, { ease: IN, fill: 'backwards' });
    anim(plinth, [{ transform: 'translate(16px,-130px) rotate(8deg) scale(1.3)' }, { transform: 'translate(0,0) rotate(0deg) scale(1)' }], fall, { ease: IN, add: true, fill: 'backwards' });
    await fx.wait(fall);
    sound?.thock(0.9);
    bump(7, 230);
    // it rocks once on its edge and is still
    anim(plinth, [{ transform: 'rotate(2.6deg) scale(1.05,.78)' }, { transform: 'rotate(-1.5deg) scale(1,1.08)', offset: 0.4 }, { transform: 'rotate(.7deg)', offset: 0.7 }, { transform: 'rotate(0deg)' }], 340, { ease: 'ease-out', add: true, fill: 'none' });
    anim(plate, [{ transform: 'translateY(-8px)' }, { transform: 'translateY(1.5px)', offset: 0.5 }, { transform: 'translateY(0)' }], 230, { add: true, fill: 'none' });
    const b = boxOf(plinth);
    for (const way of [180, 0]) burst({ x: b.left + (way ? 0.1 : 0.9) * b.width, y: b.top + b.height }, { kind: 'dust', n: 5, colors: ['#e2d5b8'], speed: [60, 170], angle: way, spread: 50, gravity: -10, drag: 0.1, life: [0.35, 0.7], size: [4, 8], grow: 12 });
    // the table jumped: so does whatever stands near
    const at = mid(boxOf(plate));
    for (const other of container.querySelectorAll<HTMLElement>('.wm-plate[data-id]')) {
      if (other === plate || other.style.display === 'none') continue;
      const q = mid(boxOf(other));
      const dist = Math.hypot(q.x - at.x, q.y - at.y);
      if (dist > 380) continue;
      anim(other, [{ transform: 'translateY(0)' }, { transform: `translateY(${-Math.max(2, 8 * (1 - dist / 380))}px)`, offset: 0.35 }, { transform: 'translateY(0)' }], 280, { add: true, fill: 'none', delay: dist * 0.14 });
    }
    await fx.wait(240);
    sound?.clack(0);
  }

  async function shatter(id: string, side: SideIndex, commit: () => void): Promise<void> {
    const plate = plateOf(id);
    const cell = plate?.querySelector<HTMLElement>(side === 0 ? '.wm-inf.a' : '.wm-inf.b');
    if (!plate || !cell || calm() || plate.style.display === 'none') return commit();
    const c = tint(side);
    const r = boxOf(cell);
    const p = mid(r);
    const plinth = plate.querySelector<HTMLElement>('.wm-plinth');
    const base = plinth && plate.classList.contains(side === 0 ? 'ctrl-a' : 'ctrl-b') ? boxOf(plinth) : null;
    // the number, frozen where it stands
    const ice = fx.el('div', 'im-at im-chip');
    Object.assign(ice.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, background: c.main, fontSize: `${Math.max(9, r.height * 0.62)}px`, lineHeight: `${r.height}px` });
    ice.textContent = displayText(cell.textContent);
    mount().appendChild(ice);
    try {
      anim(ice, [{ filter: 'brightness(1) saturate(1)' }, { filter: 'brightness(2.1) saturate(.25)' }], 150);
      sound?.crack();
      cracks(p, 4, 24, 700);
      await fx.wait(190);
      sound?.crack();
      cracks(p, 6, 46, 500);
      anim(plate, [{ transform: 'translateX(0)' }, { transform: 'translateX(-2px)', offset: 0.3 }, { transform: 'translateX(2px)', offset: 0.6 }, { transform: 'translateX(0)' }], 150, { add: true, fill: 'none' });
      await fx.wait(210);
    } finally {
      ice.remove();
    }
    // the plinth, if it goes, goes at once: what is left of it is in the air
    plate.classList.add('im-set');
    fx.later(() => plate.classList.remove('im-set'), 600 * pace);
    commit();
    sound?.shatter();
    sound?.thud(0.9);
    flash('#fff', 0.42, 100);
    burst(p, { kind: 'shard', n: 28, colors: [c.main, c.light, '#fff'], speed: [180, 680], gravity: 1500, life: [0.6, 1.2], size: [4, 11], area: [r.width, r.height] });
    burst(p, { kind: 'glass', n: 18, colors: ['#dff1ff', '#fff'], speed: [120, 520], gravity: 1300, life: [0.5, 1], size: [3, 8] });
    if (base) burst(mid(base), { kind: 'shard', n: 26, colors: [c.main, c.deep, '#fff'], speed: [80, 420], angle: 90, spread: 190, gravity: 1500, life: [0.6, 1.1], size: [4, 10], area: [base.width, base.height] });
    await hitStop(90);
    fx.shake(container, 9, 320);
    await fx.wait(260);
  }

  async function point(from: Element, to: Element, i: number, up: boolean): Promise<void> {
    if (calm()) return;
    mount();
    const a = mid(boxOf(from));
    const b = mid(boxOf(to));
    sound?.thud(0.5 + i * 0.04);
    streak(a, b, '#ffd27a', 3, 100, 50, '#ff9a3d');
    await fx.wait(100);
    sound?.crack();
    sound?.tick(i, up);
    burst(b, { kind: 'spark', n: 12, colors: ['#ffd27a', '#fff', '#ff8a3d'], speed: [120, 420], gravity: 600, life: [0.2, 0.45], size: [1.5, 2.5] });
    fx.shake(container, 2, 100);
  }

  async function fire(die: HTMLElement, target: HTMLElement, foe: SideIndex | null): Promise<void> {
    const beaten = (): void => {
      if (foe === null) target.classList.add('is-beaten');
      else target.style.visibility = 'hidden';
    };
    if (calm()) return beaten();
    mount();
    const d = boxOf(die);
    const w = mid(d);
    const l = mid(boxOf(target));
    const unit = d.width / 92;
    const len = Math.hypot(l.x - w.x, l.y - w.y) || 1;
    const ux = (l.x - w.x) / len;
    const uy = (l.y - w.y) / len;
    const deg = (Math.atan2(uy, ux) * 180) / Math.PI;
    const lean = ux >= 0 ? -9 : 9;
    // it rears back
    anim(die, [{ translate: '0 0', rotate: '0deg' }, { translate: `${-ux * 20 * unit}px ${-uy * 20 * unit}px`, rotate: `${lean}deg` }], 280);
    await fx.wait(340);
    // and fires: the die kicks, the ball is away
    sound?.boom(0.6);
    flash('#ffe2b0', 0.28, 90);
    fx.shake(container, 6, 200);
    const muzzle = { x: w.x + ux * d.width * 0.62, y: w.y + uy * d.width * 0.62 };
    burst(muzzle, { kind: 'spark', n: 16, colors: ['#ffd27a', '#fff', '#ff8a3d'], speed: [200, 700], angle: deg, spread: 60, gravity: 300, life: [0.15, 0.4], size: [2, 3] });
    burst(muzzle, { kind: 'smoke', n: 7, colors: ['rgb(120,108,96)'], speed: [20, 120], angle: deg, spread: 90, gravity: -40, life: [0.5, 0.9], size: [8 * unit, 14 * unit], grow: 22 });
    anim(die, [{ translate: `${-ux * 20 * unit}px ${-uy * 20 * unit}px`, rotate: `${lean}deg` }, { translate: `${-ux * 54 * unit}px ${-uy * 54 * unit}px`, rotate: `${lean * 1.8}deg`, offset: 0.14 }, { translate: '0 0', rotate: '0deg' }], 520, { ease: 'ease-out' });
    const ball = put('im-ball', muzzle, 28 * unit, 28 * unit);
    let n = 0;
    await fly(ball, muzzle, l, 170, 16 * unit, (q) => {
      if (n++ % 2 === 0) burst(q, { kind: 'ember', n: 1, colors: ['#ffb36b'], speed: [0, 30], gravity: 0, life: [0.15, 0.3], size: [3, 5] });
    });
    ball.remove();
    if (fx.dead) return;
    beaten();
    sound?.boom(1.25);
    sound?.shatter();
    flash('#fff', 0.5, 170);
    fx.shake(container, 17, 540);
    const them = foe === null ? { main: '#ffb056', light: '#ffd9a8', deep: '#8a4b12' } : tint(foe);
    const big = foe === null ? 0.6 : unit;
    burst(l, { kind: 'shard', n: foe === null ? 22 : 38, colors: [them.main, them.light, them.deep], speed: [240, 960], angle: deg, spread: 250, gravity: 1400, life: [0.8, 1.4], size: [6 * big, 17 * big], floor: l.y + 66 * big });
    if (foe !== null) burst(l, { kind: 'pip', n: 9, colors: ['#fff'], speed: [240, 700], gravity: 1400, life: [0.7, 1.2], size: [3 * unit, 5 * unit], floor: l.y + 66 * unit });
    burst(l, { kind: 'spark', n: 34, colors: ['#ffd27a', '#ff8a3d', '#fff'], speed: [260, 900], gravity: 900, life: [0.3, 0.8], size: [2, 4] });
    burst({ x: l.x, y: l.y - 10 }, { kind: 'smoke', n: 10, colors: ['rgb(70,60,52)', 'rgb(120,106,94)'], speed: [60, 190], angle: -90, spread: 200, gravity: -170, drag: 0.3, life: [0.5, 1.1], size: [10 * big, 18 * big], grow: 30 });
    ring({ x: l.x, y: l.y + 30 * big }, 420 * big, 'rgba(255,220,170,.85)', 7, 460, 0.45);
    await hitStop(120);
    await fx.wait(200);
  }

  return {
    control,
    shatter,
    point,
    fire,
    dispose(): void {
      for (const a of anims) a.cancel();
      anims.clear();
      cancelAnimationFrame(raf);
      parts.length = 0;
      window.removeEventListener('resize', size);
      root?.remove();
      root = null;
      container.querySelectorAll('.wm-plate.im-set').forEach((el) => el.classList.remove('im-set'));
    },
  };
}
