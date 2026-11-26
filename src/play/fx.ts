import { text as displayText } from '../i18n/index.js';
// The small machinery under the staging: pauses that can be cut short, questions that die with
// the presenter, a shake, and the veil (darkness with holes that follow things).
import { ABORTED } from './types';

const NS = 'http://www.w3.org/2000/svg';

/** Something the veil leaves lit: a round pool of light, or a rectangle (an element's box). */
export type Hole = { x: number; y: number; r: number } | { left: number; top: number; width: number; height: number } | null;

export type Pending<T> = { promise: Promise<T>; resolve(value: T): void };

export type Fx = {
  /** Waits. Cut short by skip(); stretched or shrunk by the pace; rejects with ABORTED once disposed. */
  wait(ms: number): Promise<void>;
  /** Ends every pause that is running now. */
  skip(): void;
  /** A question the presenter answers itself. Rejects with ABORTED if the presenter goes first. */
  pending<T>(): Pending<T>;
  /** Runs something a little later, unless the presenter is gone by then. */
  later(fn: () => void, ms: number): void;
  /** Registers something to undo when the presenter is disposed. Returns how to undo it sooner. */
  hold(undo: () => void): () => void;
  el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K];
  /** A short shake, for when something lands hard. */
  shake(target: Element, px?: number, ms?: number): void;
  readonly dead: boolean;
  dispose(): void;
};

export function makeFx(pace: number): Fx {
  const skips = new Set<() => void>();
  const rejects = new Set<(reason: unknown) => void>();
  const undos = new Set<() => void>();
  const timers = new Set<number>();
  let dead = false;

  function wait(ms: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (dead) return reject(ABORTED);
      const done = (): void => {
        clearTimeout(t);
        skips.delete(done);
        rejects.delete(stop);
        resolve();
      };
      const stop = (reason: unknown): void => {
        clearTimeout(t);
        skips.delete(done);
        reject(reason);
      };
      const t = window.setTimeout(done, ms * pace);
      skips.add(done);
      rejects.add(stop);
    });
  }

  function pending<T>(): Pending<T> {
    let settle: (value: T) => void = () => {};
    const promise = new Promise<T>((resolve, reject) => {
      if (dead) return reject(ABORTED);
      rejects.add(reject);
      settle = (value) => {
        rejects.delete(reject);
        resolve(value);
      };
    });
    return { promise, resolve: (value) => settle(value) };
  }

  return {
    wait,
    skip: () => [...skips].forEach((fn) => fn()),
    pending,
    later(fn, ms) {
      const t = window.setTimeout(() => {
        timers.delete(t);
        if (!dead) fn();
      }, ms);
      timers.add(t);
    },
    hold(undo) {
      undos.add(undo);
      return () => {
        if (undos.delete(undo)) undo();
      };
    },
    el(tag, cls = '', html = '') {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (html) n.innerHTML = displayText(html);
      return n;
    },
    shake(target, px = 6, ms = 380) {
      target.animate(
        [0, 1, -1, 0.7, -0.5, 0.3, 0].map((k) => ({ transform: `translate(${k * px}px, ${-k * px * 0.4}px)` })),
        { duration: ms, composite: 'add' },
      );
    },
    get dead() {
      return dead;
    },
    dispose() {
      if (dead) return;
      dead = true;
      for (const t of timers) clearTimeout(t);
      timers.clear();
      for (const undo of [...undos]) undo();
      undos.clear();
      skips.clear();
      const all = [...rejects];
      rejects.clear();
      for (const reject of all) reject(ABORTED);
    },
  };
}

export type Veil = {
  /** Darkens the stage. `holes` is asked every frame for what stays lit. */
  show(opacity?: number, holes?: (() => Hole[]) | null): void;
  /** Lets the light back in. The holes stay where they are while it fades. */
  hide(): void;
  dispose(): void;
};

/** `layer` is what the veil covers; holes are given in screen coordinates. */
export function makeVeil(layer: HTMLElement): Veil {
  const id = 'spv' + Math.random().toString(36).slice(2, 7);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'sp-veil');
  svg.innerHTML =
    displayText(`<defs><filter id="${id}f" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="16"/></filter>` +
    `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%"><rect width="100%" height="100%" fill="#fff"/><g filter="url(#${id}f)"></g></mask></defs>` +
    `<rect class="dark" width="100%" height="100%" mask="url(#${id})"/>`);
  layer.prepend(svg);
  const g = svg.querySelector('g')!;
  const dark = svg.querySelector<SVGRectElement>('.dark')!;
  let source: (() => Hole[]) | null = null;
  let last = '';
  let raf = 0;
  const draw = (): void => {
    const o = layer.getBoundingClientRect();
    const html = (source ? source() : [])
      .map((h) => {
        if (!h) return '';
        return 'r' in h
          ? `<circle cx="${(h.x - o.left).toFixed(1)}" cy="${(h.y - o.top).toFixed(1)}" r="${h.r}" fill="#000"/>`
          : `<rect x="${(h.left - o.left - 14).toFixed(1)}" y="${(h.top - o.top - 14).toFixed(1)}" width="${(h.width + 28).toFixed(1)}" height="${(h.height + 28).toFixed(1)}" rx="26" fill="#000"/>`;
      })
      .join('');
    if (html !== last) g.innerHTML = displayText(last = html);
  };
  const loop = (): void => {
    draw();
    raf = requestAnimationFrame(loop);
  };
  return {
    show(opacity = 0.6, holes = null) {
      cancelAnimationFrame(raf);
      source = holes;
      dark.style.fillOpacity = String(opacity);
      svg.classList.add('is-on');
      if (holes) loop();
      else g.innerHTML = displayText(last = '');
    },
    hide() {
      svg.classList.remove('is-on');
      cancelAnimationFrame(raf);
      source = null;
    },
    dispose() {
      cancelAnimationFrame(raf);
      svg.remove();
    },
  };
}
