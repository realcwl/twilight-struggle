import { text as displayText } from '../i18n/index.js';
// Small helpers shared by the HUD's parts.
import type { HudStrings } from './strings';
import type { CardSource, HudEvents, HudOptions, HudRules, HudState, Lang, Pile, Side, SideIndex } from './types';

export const esc = (s: unknown): string => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const times = (n: number, fn: (i: number) => string): string => Array.from({ length: n }, (_, i) => fn(i)).join('');
/** Where step i stands against the current one. */
export const state3 = (i: number, now: number): 'done' | 'now' | 'todo' => (i < now ? 'done' : i === now ? 'now' : 'todo');
export const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
export const pt = (cx: number, cy: number, r: number, deg: number): string => polar(cx, cy, r, deg).map((v) => v.toFixed(2)).join(',');
export const arc = (cx: number, cy: number, r: number, a0: number, a1: number): string => `M${pt(cx, cy, r, a0)}A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${pt(cx, cy, r, a1)}`;
/** The HUD's unit in pixels: 1rem, which the page ties to the size of the window (see hud.css). */
export const rem = (): number => parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
export const label = (text: string): string => `<span class="hud-lb">${esc(text)}</span>`;
export const sideClass = (i: SideIndex): string => (i === 0 ? 'is-a' : 'is-b');

export type Rect = { left: number; top: number; width: number; height: number };

/** The rectangle a card takes when centred in an element. */
export function cardRectIn(el: Element | null): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const w = Math.min(r.width, (r.height * 5) / 7);
  return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - w * 1.4) / 2, width: w, height: w * 1.4 };
}

/** What every part is handed when it is built. */
export type Ctx = {
  lang: Lang;
  t: HudStrings;
  rules: HudRules;
  sides: [Side, Side];
  player: SideIndex;
  cards: CardSource;
  /** How many cards there are in all, when the page offers a look through them. */
  catalog: number | null;
  demo: boolean;
  /** Whether a card played from the hand flies to the table by itself. */
  playFlight: boolean;
  /** The HUD's root element. */
  root: HTMLElement;
  emit<K extends keyof HudEvents>(event: K, ...args: Parameters<HudEvents[K]>): void;
  /** Sends a copy of a card from one place on screen to another. */
  fly(node: Element, from: Rect | null, to: Rect | null, opts?: { duration?: number; fade?: boolean }): void;
  /** Where a card lands on (or leaves from) one of the fixed places. */
  place(where: Pile | 'table' | 'opponent'): Rect | null;
  openPile(pile: Exclude<Pile, 'deck'> | 'candidates'): void;
  sideName(i: SideIndex): string;
  sideShort(i: SideIndex): string;
};

/** A part draws itself once and returns how to bring it up to date. `prev` is null the first time. */
export type Part = ((s: HudState, prev: HudState | null, animate: boolean) => void) & { dispose?: () => void };
export type PartFactory = (host: HTMLElement, ctx: Ctx) => Part;
export type { HudOptions };

/** With `demo`, marks an element as something to click through. */
export function demoTarget(el: HTMLElement, ctx: Ctx, what: string, onClick: (e: MouseEvent) => void): void {
  if (!ctx.demo) return;
  el.classList.add('hud-demo');
  el.title = displayText(ctx.t.demoNext(what));
  el.addEventListener('click', onClick);
}
