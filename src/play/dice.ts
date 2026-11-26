import { text as displayText } from '../i18n/index.js';
// A die: a real cube with six faces, thrown onto the table until it shows the number it was told
// to show. The number is decided before the throw (by whoever owns the rules); the cube only acts
// it out.
//
//   const die = makeDie(0);                  side 0 blue, 1 red, null ivory
//   host.append(die.el);                     its size is the CSS variable --die, set on the die or on anything above it
//   await die.throw(5, { from: { x: -1, y: 0.5 } });
//   die.set(3);                              show a face without throwing
//
// The table is the screen and the die is seen from above. The cube is solid: inside the six faces
// sits a second, slightly smaller cube, so the rounded corners of the faces never open onto nothing.
import type { SideIndex } from './types';

type Face = 1 | 2 | 3 | 4 | 5 | 6;

// which way the cube has to be turned for each face to look at the viewer
const FACING: Record<Face, [number, number]> = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };
// pips by cell of a 3 x 3 grid, row by row
const PIPS: Record<Face, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const SIX: Face[] = [1, 2, 3, 4, 5, 6];

const face = (n: Face): string => `<div class="sp-face f${n}">${Array.from({ length: 9 }, (_, i) => `<i${PIPS[n].includes(i) ? ' class="on"' : ''}></i>`).join('')}</div>`;
const core = (n: Face): string => `<i class="sp-core f${n}"></i>`;
const asFace = (v: number): Face => (Math.min(6, Math.max(1, Math.round(v))) as Face);

export type ThrowOptions = {
  /** Where it comes from, as a direction on screen: { x: -1, y: 0.5 } is the lower left. */
  from?: { x: number; y: number };
  /** The whole throw, in ms. */
  ms?: number;
  /** How far it travels, in die widths. */
  reach?: number;
  /** How high it is when it is let go, in die widths. */
  lift?: number;
  /** Each time it hits the table: 0, 1, 2 for the landing and the bounces, 3 when it falls flat. */
  onImpact?: (i: number) => void;
};

export type Die = {
  el: HTMLElement;
  set(v: number): void;
  throw(v: number, opts?: ThrowOptions): Promise<void>;
  readonly value: number;
};

type Stretch = { t: number; d: number; q: number; h: number; kind: 'fall' | 'hop' | 'tip' | 'rest' };

export function makeDie(side: SideIndex | null = null): Die {
  const el = document.createElement('div');
  el.className = `sp-die ${side === 0 ? 'a' : side === 1 ? 'b' : 'n'}`;
  el.innerHTML = displayText(`<div class="sp-die-shadow"></div><div class="sp-die-fly"><div class="sp-cube">${SIX.map(core).join('')}${SIX.map(face).join('')}</div></div>`);
  const cube = el.querySelector<HTMLElement>('.sp-cube')!;
  const fly = el.querySelector<HTMLElement>('.sp-die-fly')!;
  const shadow = el.querySelector<HTMLElement>('.sp-die-shadow')!;
  let value: Face = 1;
  let thrown: Animation[] = [];
  const turn = ([x, y]: [number, number]): string => `rotateX(${x}deg) rotateY(${y}deg) rotateZ(0deg)`;

  function set(v: number): void {
    for (const a of thrown) a.cancel();
    thrown = [];
    fly.style.transform = shadow.style.transform = shadow.style.opacity = '';
    value = asFace(v);
    cube.style.transform = turn(FACING[value]);
    el.dataset.value = String(value);
  }

  /**
   * Throws the die onto the table so that it comes to rest where the element is, showing `v`.
   * It flies in from one side, lands, bounces twice, rolls on the way it was going and tips over
   * one last time. It only ever rolls about the line across its path, the way a thrown die does,
   * and it stops a few degrees askew. Resolves once it has stopped rocking.
   */
  function throwDie(v: number, { ms = 2000, from = { x: -1, y: 0.5 }, reach = 4.4, lift = 1.1, onImpact }: ThrowOptions = {}): Promise<void> {
    set(value);
    const to = asFace(v);
    const size = el.offsetWidth || 60;
    const len = Math.hypot(from.x, from.y) || 1;
    const ux = -from.x / len;
    const uy = -from.y / len;
    const [fx, fy] = FACING[to];
    const yaw0 = (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 25);
    const yaw1 = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 4);
    // each stretch of the throw: its share of the time, how far it carries (die widths), quarter turns, peak height
    const stretches: Stretch[] = [
      { t: 0.3, d: Math.max(0.6, reach - 2.3), q: 3, h: lift, kind: 'fall' },
      { t: 0.19, d: 0.9, q: 2, h: lift * 0.3, kind: 'hop' },
      { t: 0.12, d: 0.4, q: 1, h: lift * 0.09, kind: 'hop' },
      { t: 0.25, d: 1, q: 1, h: 0, kind: 'tip' },
      { t: 0.14, d: 0, q: 0, h: 0, kind: 'rest' },
    ];
    const way = stretches.reduce((a, x) => a + x.d, 0);
    const turns = stretches.reduce((a, x) => a + x.q, 0);
    // the last quarter turn: it climbs onto its edge, slowing, hangs there, then falls over
    const tip = (k: number): number => (k < 0.56 ? 0.5 * (1 - Math.pow(1 - k / 0.56, 1.9)) : 0.5 + 0.5 * Math.pow((k - 0.56) / 0.44, 2.3));
    const last = stretches[stretches.length - 1];
    function at(t: number): { left: number; theta: number; h: number; twist: number; yaw: number } {
      let t0 = 0;
      let done = 0;
      let turned = 0;
      for (const x of stretches) {
        if (t <= t0 + x.t || x === last) {
          const k = Math.min(1, Math.max(0, (t - t0) / x.t));
          let g = k;
          let h = 0;
          let twist = 0;
          let rock = 0;
          if (x.kind === 'fall') {
            h = x.h * (1 - k * k);
            twist = -360 * (1 - k);
          } else if (x.kind === 'hop') h = x.h * 4 * k * (1 - k);
          else if (x.kind === 'tip') {
            g = tip(k);
            h = 0.207 * Math.sin(Math.PI * g);
          } else rock = -6 * Math.sin(Math.PI * Math.min(1, k * 1.7)) * (1 - k);
          return { left: way - done - x.d * g, theta: -(turns - turned - x.q * g) * 90 + rock, h, twist, yaw: yaw1 + (yaw0 - yaw1) * Math.pow(1 - t, 2.4) };
        }
        t0 += x.t;
        done += x.d;
        turned += x.q;
      }
      return { left: 0, theta: 0, h: 0, twist: 0, yaw: yaw1 };
    }
    const n = Math.max(40, Math.round(ms / 14));
    const body: Keyframe[] = [];
    const spin: Keyframe[] = [];
    const shade: Keyframe[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const f = at(t);
      const x = -ux * f.left * size;
      const y = -uy * f.left * size;
      body.push({ offset: t, transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(1 + 0.2 * f.h).toFixed(3)})` });
      spin.push({ offset: t, transform: `rotateZ(${f.yaw.toFixed(2)}deg) rotate3d(${-uy}, ${ux}, 0, ${f.theta.toFixed(2)}deg) rotate3d(${ux}, ${uy}, 0, ${f.twist.toFixed(2)}deg) rotateX(${fx}deg) rotateY(${fy}deg)` });
      shade.push({ offset: t, transform: `translate(${(x + (0.06 + 0.42 * f.h) * size).toFixed(1)}px, ${(y + (0.09 + 0.6 * f.h) * size).toFixed(1)}px) scale(${(1 + 0.25 * f.h).toFixed(3)})`, opacity: (1 / (1 + 2.2 * f.h)).toFixed(3) });
    }
    value = to;
    el.dataset.value = '';
    el.style.visibility = '';
    el.classList.add('is-thrown');
    const opts: KeyframeAnimationOptions = { duration: ms, easing: 'linear', fill: 'forwards' };
    thrown = [fly.animate(body, opts), cube.animate(spin, opts), shadow.animate(shade, opts)];
    let t0 = 0;
    const timers = stretches.slice(0, 4).map((x, i) => {
      t0 += x.t;
      return window.setTimeout(() => onImpact?.(i), ms * t0);
    });
    return thrown[1].finished.then(
      () => {
        cube.style.transform = String(spin[n].transform);
        fly.style.transform = '';
        shadow.style.transform = shadow.style.opacity = '';
        for (const a of thrown) a.cancel();
        thrown = [];
        el.classList.remove('is-thrown');
        el.dataset.value = String(to);
      },
      () => timers.forEach(clearTimeout),
    );
  }

  set(1);
  return {
    el,
    set,
    throw: throwDie,
    get value() {
      return value;
    },
  };
}
