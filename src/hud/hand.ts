import { t as i18n, text as displayText } from '../i18n/index.js';
// The player's hand: a fan along the bottom edge. Hover a card and it grows until it can be read;
// drag it far enough from where it was picked up and let go, and it is played.
//
// The host element is a point, the middle of the hand's baseline. Each card is there twice: a
// picture that moves (.hd-card) and an invisible box that stays in the card's resting place and
// takes the pointer (.hd-hit). So a card can double in size under the pointer without taking the
// pointer away from its neighbours.
import { type Ctx, rem } from './dom';
import type { HudState } from './types';

/** Every length is in rem (1rem is 10 px on a 1600 x 900 screen). */
export type HandShape = {
  /** Card width. */
  width: number;
  /** From one card's centre to the next. */
  step: number;
  /** The hand never gets wider than this, first centre to last, however many cards it holds. */
  span: number;
  /** Degrees each card turns from its neighbour. */
  arc: number;
  /** How far the cards sit below the baseline at rest. */
  sink: number;
  /** Size of the card under the pointer. */
  hover: number;
  /** Where that card's bottom edge goes, above the baseline. */
  rise: number;
  /** How far its neighbours step aside. */
  push: number;
  /** Drag a card this far and it will be played on release. */
  arm: number;
  dragScale: number;
};
// span keeps a full hand of ten clear of the two bottom corners
export const HAND_SHAPE: HandShape = { width: 13, step: 8.6, span: 66, arc: 2.6, sink: 5, hover: 2.05, rise: 1, push: 1.4, arm: 10, dragScale: 1.1 };

type Pose = { x: number; y: number; r: number; s: number; z: number };
type Item = { vis: HTMLElement; hit: HTMLElement };
type Drag = { id: string; pointerId: number; x0: number; y0: number; moved: boolean; armed: boolean; listeners: AbortController };

const rad = (d: number): number => (d * Math.PI) / 180;
const css = (p: Pose): string => `translate(${p.x.toFixed(3)}rem, ${p.y.toFixed(3)}rem) rotate(${p.r.toFixed(2)}deg) scale(${p.s.toFixed(3)})`;

export class Hand {
  private readonly items = new Map<string, Item>();
  private order: string[] = [];
  private hovered: string | null = null;
  private drag: Drag | null = null;
  private availability: Map<string, string> | null = null;
  /** In the hand but not yet playable: drawn dimmed, never dragged. */
  private held = new Set<string>();
  private readonly onResize = (): void => this.layout();
  private termHeld = false;
  private readonly onTermOpen = (e: Event): void => {
    this.termHeld = this.host.contains((e as CustomEvent<{trigger:Element}>).detail.trigger);
  };
  private readonly onTermClose = (): void => {
    this.termHeld = false;
    if (!this.drag && !this.host.matches(':hover')) { this.hovered = null; this.layout(); }
  };

  constructor(
    private readonly host: HTMLElement,
    private readonly ctx: Ctx,
    private readonly shape: HandShape = HAND_SHAPE,
  ) {
    host.classList.add('hud-hand');
    host.style.setProperty('--card-w', shape.width + 'rem');
    host.addEventListener('pointerleave', () => {
      if (this.drag || this.termHeld) return;
      this.hovered = null;
      this.layout();
    });
    window.addEventListener('resize', this.onResize);
    document.addEventListener('card-term-open', this.onTermOpen);
    document.addEventListener('card-term-close', this.onTermClose);
  }

  /** Brings the hand in line with the state. A card that was not there before arrives from the draw pile. */
  sync(s: HudState, prev: HudState | null, animate: boolean): void {
    // what is held but cannot be played yet sits at the end of the hand
    this.held = new Set(s.held ?? []);
    const cards = [...s.hand, ...[...this.held].filter((id) => !s.hand.includes(id))];
    if (this.drag && (!s.hand.includes(this.drag.id) || this.held.has(this.drag.id))) this.cancelDrag();
    for (const [id, it] of this.items)
      if (!cards.includes(id)) {
        it.vis.remove();
        it.hit.remove();
        this.items.delete(id);
        if (this.hovered === id) this.hovered = null;
      }
    const from = animate && prev ? this.ctx.place('deck') : null;
    for (const id of cards) if (!this.items.has(id)) this.add(id, from);
    this.order = cards.filter((id) => this.items.has(id));
    this.setAvailability(this.availability);
    this.layout();
  }

  /** Empty reason = playable; a reason = inspectable, but cannot be dragged into play. */
  setAvailability(choices: Map<string, string> | null): void {
    this.availability = choices;
    if (this.drag && this.locked(this.drag.id)) this.cancelDrag();
    for (const [id, { vis, hit }] of this.items) {
      const held = this.held.has(id);
      const reason = held ? this.ctx.t.heldCard : choices ? choices.get(id) ?? i18n("当前不能打出此牌") : '';
      vis.classList.toggle('is-playable', !!choices && !reason);
      vis.classList.toggle('is-locked', !!reason && !held);
      vis.classList.toggle('is-held', held);
      for (const el of [vis, hit]) {
        el.setAttribute('aria-disabled', String(!!reason));
        el.title = displayText(reason);
      }
    }
  }

  private locked(id: string): boolean {
    return this.held.has(id) || (!!this.availability && (!this.availability.has(id) || !!this.availability.get(id)));
  }

  private inputBlocked(): boolean {
    return ['play-readonly', 'play-wait', 'play-away'].some(cls => this.ctx.root.classList.contains(cls));
  }

  /** Interruptions cancel a drag; they must never turn into a delayed card play. */
  readonly cancelDrag = (): void => this.finishDrag(false);

  private finishDrag(play: boolean): void {
    const drag = this.drag;
    if (!drag) return;
    // Clear ownership before releasing capture: its lost event may arrive later.
    this.drag = null;
    drag.listeners.abort();
    const item = this.items.get(drag.id);
    if (item?.hit.hasPointerCapture(drag.pointerId)) item.hit.releasePointerCapture(drag.pointerId);
    item?.vis.classList.remove('is-drag', 'is-armed');
    this.ctx.root.classList.remove('is-armed');
    this.hovered = null;
    if (!item || !play || !drag.moved || !drag.armed || this.locked(drag.id) || this.inputBlocked()) return this.layout();
    const face = item.vis.firstElementChild!;
    if (this.ctx.playFlight) this.ctx.fly(face, face.getBoundingClientRect(), this.ctx.place('table'));
    item.vis.style.visibility = 'hidden';
    this.ctx.emit('play', drag.id);
    // Nobody took it: return the same card, not a replacement added after a state update.
    setTimeout(() => {
      if (this.items.get(drag.id) !== item) return;
      item.vis.style.visibility = '';
      this.layout();
    }, 480);
  }

  private readonly onPointerUp = (e: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const captured = this.items.get(drag.id)?.hit.hasPointerCapture(e.pointerId);
    const inside = e.clientX >= 0 && e.clientY >= 0 && e.clientX < innerWidth && e.clientY < innerHeight;
    this.finishDrag(!!captured && inside && e.button === 0 && e.buttons === 0);
  };

  private readonly onPointerCancel = (e: PointerEvent): void => {
    if (this.drag?.pointerId === e.pointerId) this.cancelDrag();
  };

  private readonly checkPointer = (e: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (!(e.buttons & 1) || !this.items.get(drag.id)?.hit.hasPointerCapture(e.pointerId) || this.inputBlocked()) this.cancelDrag();
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) this.cancelDrag();
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.cancelDrag();
  };

  /** Holds a card up without a pointer, for screenshots and tests. */
  hover(id: string | null): void {
    this.hovered = id;
    this.layout();
  }

  dispose(): void {
    this.cancelDrag();
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('card-term-open', this.onTermOpen);
    document.removeEventListener('card-term-close', this.onTermClose);
    this.ctx.root.classList.remove('is-armed');
    this.host.replaceChildren();
  }

  private rest(i: number, n: number): Pose {
    const P = this.shape;
    const step = n > 1 ? Math.min(P.step, P.span / (n - 1)) : 0;
    const t = i - (n - 1) / 2;
    const r = t * P.arc;
    // the cards stand on a circle, so the outer ones hang a little lower
    const drop = P.arc ? (step / rad(P.arc)) * (1 - Math.cos(rad(r))) : 0;
    return { x: t * step, y: P.sink + drop, r, s: 1, z: i };
  }

  private layout(): void {
    const P = this.shape;
    const n = this.order.length;
    const h = this.hovered && !this.drag ? this.order.indexOf(this.hovered) : -1;
    const box = this.host.getBoundingClientRect();
    const u = rem();
    this.order.forEach((id, i) => {
      const it = this.items.get(id)!;
      const base = this.rest(i, n);
      it.hit.style.transform = css(base);
      it.hit.style.zIndex = String(i);
      if (this.drag?.id === id && this.drag.moved) return;
      let p = base;
      if (i === h) {
        // straight up from its own place, but never off the side of the screen
        const half = (P.width * P.hover) / 2;
        const lo = (0.8 * u - box.left) / u + half;
        const hi = (window.innerWidth - 0.8 * u - box.left) / u - half;
        p = { x: Math.min(hi, Math.max(lo, base.x)), y: -P.rise, r: 0, s: P.hover, z: 900 };
      } else if (h >= 0) {
        const d = i - h;
        p = { ...base, x: base.x + (Math.sign(d) * P.push) / (1 + 0.7 * (Math.abs(d) - 1)) };
      }
      it.vis.style.transform = css(p);
      it.vis.style.zIndex = String(p.z);
      it.vis.classList.toggle('is-up', i === h);
    });
  }

  private add(id: string, born: { left: number; top: number; width: number; height: number } | null): void {
    const P = this.shape;
    const vis = document.createElement('div');
    vis.className = 'hd-card';
    vis.dataset.card = id;
    const face = this.ctx.cards.face(id);
    vis.appendChild(face);
    const hit = document.createElement('div');
    hit.className = 'hd-hit';
    hit.dataset.card = id;
    hit.setAttribute('aria-label', this.ctx.cards.describe(id));
    this.host.append(vis, hit);
    this.items.set(id, { vis, hit });
    this.ctx.cards.fit(face);
    if (born) {
      // start where the draw pile is, then travel to its place in the hand
      const box = this.host.getBoundingClientRect();
      const u = rem();
      vis.style.transition = 'none';
      vis.style.transform = css({ x: (born.left + born.width / 2 - box.left) / u, y: (born.top + born.height - box.bottom) / u, r: 0, s: born.width / (P.width * u), z: 0 });
      void vis.offsetWidth;
      vis.style.transition = '';
    }

    hit.addEventListener('pointerenter', () => {
      if (this.drag) return;
      this.hovered = id;
      this.layout();
    });
    hit.addEventListener('pointerleave', (e) => {
      if (e.relatedTarget instanceof Node && vis.contains(e.relatedTarget)) return;
      if (this.termHeld) return;
      if (this.drag || this.hovered !== id) return;
      this.hovered = null;
      this.layout();
    });
    vis.addEventListener('pointerleave', (e) => {
      if (this.termHeld || this.drag || e.relatedTarget === hit || this.hovered !== id) return;
      this.hovered = null;
      this.layout();
    });
    const onDown = (e: PointerEvent): void => {
      if (e.button !== 0 || this.drag || vis.style.visibility === 'hidden') return;
      if (this.locked(id) || this.inputBlocked()) return;
      e.preventDefault();
      try { hit.setPointerCapture(e.pointerId); } catch { return; }
      const listeners = new AbortController();
      this.drag = { id, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, armed: false, listeners };
      const opts = { capture: true, signal: listeners.signal };
      // Only listen globally during a drag. These also catch a release outside the hand.
      window.addEventListener('pointerup', this.onPointerUp, opts);
      window.addEventListener('pointercancel', this.onPointerCancel, opts);
      window.addEventListener('pointermove', this.checkPointer, opts);
      window.addEventListener('blur', this.cancelDrag, { signal: listeners.signal });
      window.addEventListener('pagehide', this.cancelDrag, opts);
      window.addEventListener('keydown', this.onKeyDown, opts);
      document.addEventListener('visibilitychange', this.onVisibilityChange, opts);
      hit.addEventListener('lostpointercapture', (lost) => {
        // Ignore a late lost event from an older drag if a new one already owns capture.
        if (!hit.hasPointerCapture(lost.pointerId)) this.onPointerCancel(lost);
      }, opts);
    };
    hit.addEventListener('pointerdown', onDown);
    vis.addEventListener('pointerdown', onDown);
    hit.addEventListener('pointermove', (e) => {
      const drag = this.drag;
      if (!drag || drag.id !== id || drag.pointerId !== e.pointerId) return;
      const dist = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
      const u = rem();
      if (!drag.moved) {
        if (dist < 6) return;
        drag.moved = true;
        vis.classList.add('is-drag');
        vis.classList.remove('is-up');
        this.layout();
      }
      const box = this.host.getBoundingClientRect();
      const h = P.width * 1.4 * P.dragScale;
      vis.style.transform = css({ x: (e.clientX - box.left) / u, y: (e.clientY - box.bottom) / u + h * 0.5, r: 0, s: P.dragScale, z: 950 });
      vis.style.zIndex = '950';
      const armed = dist > P.arm * u;
      if (armed !== drag.armed) {
        drag.armed = armed;
        vis.classList.toggle('is-armed', armed);
        this.ctx.root.classList.toggle('is-armed', armed);
      }
    });
  }
}
