import { t as i18n, text as displayText } from '../i18n/index.js';
import { cardRectIn, type Ctx, type Rect } from './dom';
import { cardMotionPlan, type CardRoute } from './cardMotionPlan';
import type { HudState } from './types';
import type { CardLocation, CardMove, Play } from '../play/types';

// Every card that changes place makes the same journey: a straight line, one curve, no tilt, no fade,
// from the real thing it leaves to the real thing that receives it. A card dealt or discarded simply
// goes. A card an effect moves is first lifted out of where it was and held for a moment at a size
// that can be read, because that card is the news.
const GO = 460;
const LIFT = 170;
const HOLD = 100;
const FLY = 420;
const GO_EASE = 'cubic-bezier(.5,0,.2,1)';
const LIFT_EASE = 'cubic-bezier(.2,.8,.3,1)';
/** A resolving card stays at least this long, and this long after the last card landed. */
const MIN_SHOWN = 1300;
const BEAT = 420;
/** A resolving card the pointer rests on waits this much longer at most: the game never stops for a pointer left lying there. */
const READING = 2500;

/** A place a card can be: its box as if it stood upright, and how far it is turned (a hand fans out). */
type Spot = Rect & { angle?: number };
type Flight = { flip?: boolean; hide?: boolean; lift?: boolean; pace?: number; above?: boolean; keep?: boolean; move?: boolean };

/** Card choreography shared by the local game and the receiving seat of an online game. */
export class CardMotion {
  private queue = Promise.resolve();
  private generation = 0;
  private animations = new Set<Animation>();
  private resolving: { play: Play; el: HTMLElement; shownAt: number }[] = [];
  private settled = new Set<string>();
  private settledOpponent = 0;
  private arriving = new Map<HTMLElement, number>();
  private flights = new Set<HTMLElement>();
  /** A card an effect put on the table, standing where its resolving card will be shown. */
  private standIn: { id: string; el: HTMLElement } | null = null;
  private landedAt = 0;
  private lower = 0;
  private readonly layer: HTMLElement;
  private readonly rail: HTMLElement;
  private readonly notice: HTMLElement;
  private readers = new Set<() => void>();
  private onResize = (): void => { requestAnimationFrame(() => this.layoutRail()); };

  constructor(private ctx: Ctx) {
    this.layer = ctx.root.querySelector('.hud-fly')!;
    this.rail = document.createElement('div');
    this.rail.className = 'hud-resolution';
    this.notice = document.createElement('div');
    this.notice.className = 'hud-card-notice';
    this.notice.setAttribute('role', 'status');
    ctx.root.append(this.rail, this.notice);
    window.addEventListener('resize', this.onResize);
  }
  private get reduced(): boolean { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
  private async animate(el: Element, frames: Keyframe[], ms: number, delay = 0, readingTime = false, easing = 'cubic-bezier(.22,.7,.2,1)'): Promise<void> {
    const a = el.animate(frames, { duration: this.reduced && !readingTime ? 1 : Math.max(1, ms), delay: this.reduced ? 0 : delay, easing, fill: 'both' });
    this.animations.add(a);
    try { await a.finished; } catch { /* reset / skip */ }
    this.animations.delete(a);
    a.cancel();
  }
  private enqueue(fn: () => Promise<void>): Promise<void> {
    const g = this.generation;
    this.queue = this.queue.then(async () => { if (g === this.generation) await fn(); });
    return this.queue;
  }
  async drain(): Promise<void> { await this.queue; }
  skip(): void { for (const a of this.animations) a.finish(); for (const done of this.readers) done(); }
  reset(): void {
    this.generation++;
    for (const done of this.readers) done();
    for (const a of this.animations) a.cancel();
    this.animations.clear();
    for (const el of this.arriving.keys()) delete el.dataset.arriving;
    this.arriving.clear();
    this.ctx.root.querySelectorAll<HTMLElement>('.hd-card[data-arriving], .hd-card[data-leaving]').forEach(el => { delete el.dataset.arriving; delete el.dataset.leaving; });
    for (const el of this.flights) el.remove();
    this.flights.clear();
    this.standIn = null;
    clearTimeout(this.lower);
    this.layer.replaceChildren();
    this.rail.replaceChildren();
    this.notice.textContent = displayText('');
    this.resolving = [];
    this.settled.clear();
    this.settledOpponent = 0;
    this.ctx.root.classList.remove('has-resolution', 'is-dealing', 'is-receiving');
    this.queue = Promise.resolve();
  }
  dispose(): void { this.reset(); window.removeEventListener('resize', this.onResize); this.rail.remove(); this.notice.remove(); }

  private layoutRail(): void {
    const css = getComputedStyle(this.ctx.root);
    for (const key of ['--under-left', '--over-piles', '--under-corners']) this.rail.style.setProperty(key, css.getPropertyValue(key));
  }
  /** A card being read (the pointer is on it, or it has the focus) is left a little longer, but never held for good. */
  private readUntilLeave(node: HTMLElement, atMost = READING): Promise<void> {
    if (!node.matches(':hover, :focus-within')) return Promise.resolve();
    return new Promise(resolve => {
      const finish = () => { clearTimeout(timer); node.removeEventListener('pointerleave', check); node.removeEventListener('focusout', check); this.readers.delete(finish); resolve(); };
      const check = () => { if (!node.matches(':hover, :focus-within')) finish(); };
      const timer = window.setTimeout(finish, atMost);
      this.readers.add(finish);
      node.addEventListener('pointerleave', check);
      node.addEventListener('focusout', check);
    });
  }

  private handElement(id?: string): HTMLElement | null {
    return id ? this.ctx.root.querySelector<HTMLElement>(`.hd-card[data-card="${id}"]`) : null;
  }
  /** How far below its place the hand sits just now (it waits low, or is away). */
  private handDrop(): number {
    const hand = this.ctx.root.querySelector('.hud-hand');
    return hand ? new DOMMatrixReadOnly(getComputedStyle(hand).transform).m42 : 0;
  }
  /** A card in this seat's hand. `raised`: where it will be once the hand has come up, not where the hand has it now. */
  private handSpot(id?: string, raised = false): Spot | null {
    const el = this.handElement(id);
    // a card just added is still sliding to its place: `raised` wants the place, not the slide
    if (el && raised) { el.style.transition = 'none'; void el.offsetWidth; }
    const box = el?.firstElementChild?.getBoundingClientRect();
    if (el && raised) el.style.transition = '';
    if (!el || !box?.width) return null;
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    const width = el.offsetWidth * Math.hypot(m.a, m.b);
    // a turned card's bounding box is centred where the card is
    return { left: box.left + box.width / 2 - width / 2, top: box.top + box.height / 2 - width * .7 - (raised ? this.handDrop() : 0), width, height: width * 1.4, angle: Math.atan2(m.b, m.a) * 180 / Math.PI };
  }
  private at(where: CardRoute['from'] | CardRoute['to'], id?: string): Spot | null {
    const root = this.ctx.root.getBoundingClientRect();
    if (where === 'hand') {
      const own = this.handSpot(id);
      if (own) return own;
      // not in the hand yet: it will join at the right-hand end
      const ends = [...this.ctx.root.querySelectorAll<HTMLElement>('.hd-card')].map(el => this.handSpot(el.dataset.card)).filter((r): r is Spot => !!r);
      const end = ends.sort((a, b) => b.left - a.left)[0];
      if (end) return { ...end, left: end.left + end.width * .55 };
      return { left: root.left + root.width * .5 - 65, top: root.bottom - 140, width: 130, height: 182 };
    }
    if (where === 'opponent') {
      // one of the backs in the fan that hangs from the top edge: a card goes into the fan, or comes out of it
      const fan = this.ctx.root.querySelector('.op-cards'), r = fan?.getBoundingClientRect();
      const width = fan ? parseFloat(getComputedStyle(fan).fontSize) * 2.8 : 0;
      if (r && width) return { left: r.left + r.width / 2 - width / 2, top: r.top, width, height: width * 1.4 };
      return { left: root.left + root.width / 2 - 42, top: root.top + 8, width: 84, height: 118 };
    }
    if (where === 'table') {
      const shown = [...this.resolving].reverse().find(r => !id || r.play.card.id === id);
      return cardRectIn(shown?.el.querySelector('.hr-card') ?? null) ?? this.ctx.place('table');
    }
    return this.ctx.place(where);
  }
  /** Above the play stage when there is one: a card an effect moves must not pass under the resolving card. */
  private get above(): HTMLElement {
    return this.ctx.root.parentElement?.querySelector<HTMLElement>('.play') ?? this.layer;
  }
  private drop(el: HTMLElement | null): void {
    if (!el) return;
    el.remove();
    this.flights.delete(el);
  }
  private async pause(ms: number): Promise<void> {
    const marker = document.createElement('i');
    this.layer.append(marker);
    await this.animate(marker, [{ opacity: 0 }, { opacity: 0 }], ms);
    marker.remove();
  }
  /** One card from one place to another. With `keep` it stays where it landed and is handed back. */
  private async travel(id: string | undefined, from: Spot | null, to: Spot | null, o: Flight = {}): Promise<HTMLElement | null> {
    if (!from?.width || !to?.width) return null;
    const pace = o.pace ?? 1;
    const cx = (r: Rect): number => r.left + r.width / 2, cy = (r: Rect): number => r.top + r.height / 2;
    // lifted: at reading size, wholly on screen, and a step towards where it is going
    const lw = Math.max(from.width, Math.min(176, Math.max(120, innerWidth * .11)));
    const within = (v: number, half: number, size: number): number => Math.min(size - 12 - half, Math.max(12 + half, v));
    const lifted: Spot = {
      left: within(cx(from) + (cx(to) - cx(from)) * .06, lw / 2, innerWidth) - lw / 2,
      top: within(cy(from) + (cy(to) - cy(from)) * .06, lw * .7, innerHeight) - lw * .7,
      width: lw, height: lw * 1.4,
    };
    // drawn at the largest size it will have, so that its text is only ever scaled down
    const W = Math.max(from.width, to.width, o.lift ? lw : 0), H = W * 1.4;
    const at = (r: Spot): string => `translate(${(cx(r) - W / 2).toFixed(1)}px,${(cy(r) - H / 2).toFixed(1)}px) rotate(${(r.angle ?? 0).toFixed(2)}deg) scale(${(r.width / W).toFixed(4)})`;
    const wrapper = document.createElement('div');
    wrapper.className = 'hud-card-flight';
    wrapper.dataset.face = id ? 'public' : 'back';
    if (o.move && id) wrapper.dataset.move = id;
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.style.width = `${W}px`;
    wrapper.style.setProperty('--card-w', `${W}px`);
    wrapper.style.transformOrigin = '50% 50%';
    // where it rests once the animation lets go of it
    wrapper.style.transform = at(to);
    if (o.above) wrapper.style.zIndex = '82';
    const face = id ? this.ctx.cards.face(id) : this.ctx.cards.back();
    wrapper.append(face);
    (o.above ? this.above : this.layer).append(wrapper);
    this.flights.add(wrapper);
    this.ctx.cards.fit(face);
    const total = o.lift ? LIFT + HOLD + FLY : GO;
    const frames: Keyframe[] = o.lift
      ? [{ transform: at(from), easing: LIFT_EASE }, { transform: at(lifted), offset: LIFT / total }, { transform: at(lifted), offset: (LIFT + HOLD) / total, easing: GO_EASE }, { transform: at(to) }]
      : [{ transform: at(from), easing: GO_EASE }, { transform: at(to) }];
    const jobs = [this.animate(wrapper, frames, total * pace, 0, false, 'linear')];
    if (o.flip && id) {
      // out of a face-down place: the back gives way to the face as the card leaves it
      const back = this.ctx.cards.back();
      back.classList.add('flight-cover');
      // gone for good once it has faded, also on a card that stays where it lands
      back.style.opacity = '0';
      wrapper.append(back);
      const turned = o.lift ? LIFT / total : .6;
      jobs.push(this.animate(back, [{ opacity: 1 }, { opacity: 1, offset: turned * .45 }, { opacity: 0, offset: turned }, { opacity: 0 }], total * pace, 0, false, 'linear'));
    } else if (o.hide && id) {
      // into a face-down place: the back closes over the face as the card arrives
      const back = this.ctx.cards.back();
      back.classList.add('flight-cover');
      wrapper.append(back);
      jobs.push(this.animate(back, [{ opacity: 0 }, { opacity: 0, offset: .6 }, { opacity: 1, offset: .92 }, { opacity: 1 }], total * pace, 0, false, 'linear'));
    }
    await Promise.all(jobs);
    if (o.keep && this.flights.has(wrapper)) return wrapper;
    this.drop(wrapper);
    return null;
  }
  /** What receives a card answers with a short glow: the one sign that it arrived. */
  private received(el: Element | null): Promise<void> {
    // back to whatever it looks like at rest: a card held but not yet playable stays dimmed
    return el ? this.animate(el, [{ filter: 'brightness(1.65)' }], 380) : Promise.resolve();
  }

  private async shuffle(): Promise<void> {
    const r = this.at('deck');
    if (!r) return;
    await Promise.all(Array.from({ length: 6 }, async (_, i) => {
      const packet = document.createElement('div');
      packet.className = 'hud-card-flight';
      packet.dataset.face = 'back';
      packet.style.width = `${r.width}px`;
      packet.style.setProperty('--card-w', `${r.width}px`);
      packet.append(this.ctx.cards.back());
      this.layer.append(packet);
      const direction = i % 2 ? 1 : -1;
      await this.animate(packet, [
        { transform: `translate(${r.left}px,${r.top-i}px)` },
        { transform: `translate(${r.left + direction * r.width * .62}px,${r.top-24-i*4}px) rotate(${direction*12}deg)`, offset: .36 },
        { transform: `translate(${r.left + direction * 4}px,${r.top-i*2}px) rotate(${direction*2}deg)`, offset: .76 },
        { transform: `translate(${r.left}px,${r.top}px)` },
      ], 650, i * 38);
      packet.remove();
    }));
  }

  /** Called after rendering the destination state; incoming hand faces remain hidden until landing. */
  sync(after: HudState, before: HudState | null): void {
    if (!before) return;
    const plan = cardMotionPlan(before, after);
    plan.routes = plan.routes.filter(route => {
      if (route.id && this.settled.delete(route.id)) return false;
      // A returned/transferred resolving card already has an explicit settle journey.
      if (route.to === 'hand' && this.resolving.some(r => r.play.card.id === route.id)) return false;
      if (route.to === 'opponent' && this.settledOpponent) { this.settledOpponent--; return false; }
      return true;
    });
    // Suppress exactly the following state commit, not an unrelated later draw of the same card.
    this.settled.clear();
    this.settledOpponent = 0;
    if (!plan.recycle && !plan.routes.length) return;
    const hidden = plan.routes.filter(r => r.to === 'hand').map(r => this.handElement(r.id)).filter((e): e is HTMLElement => !!e);
    hidden.forEach(e => { this.arriving.set(e, (this.arriving.get(e) ?? 0) + 1); e.dataset.arriving = ''; });
    const g = this.generation;
    void this.enqueue(async () => {
      const current = () => g === this.generation;
      this.ctx.root.classList.add('is-dealing');
      if (plan.recycle) {
        this.notice.textContent = i18n("弃牌洗回牌堆");
        await Promise.all(Array.from({ length: 5 }, async (_, i) => {
          await this.animate(this.notice, [{ opacity: 1 }, { opacity: 1 }], 1, i * 80);
          if (current()) await this.travel(undefined, this.at('discard'), this.at('deck'));
        }));
        if (current()) await this.shuffle();
      }
      if (current()) {
        this.notice.textContent = displayText(plan.routes.some(r => r.from === 'deck') ? '从牌堆发牌' : '');
        // Staggered cards share one timeline; a full round's deal never waits sixteen full flights.
        await Promise.all(plan.routes.map(async (r, i) => {
          const marker = document.createElement('i');
          this.layer.append(marker);
          await this.animate(marker, [{ opacity: 0 }, { opacity: 0 }], 1, i * 110);
          marker.remove();
          if (!current()) return;
          await this.travel(r.id, this.at(r.from, r.id), this.at(r.to, r.id), { flip: r.from === 'deck' && r.to === 'hand' });
          if (r.to === 'hand') {
            const el = this.handElement(r.id);
            if (el) { delete el.dataset.arriving; this.arriving.delete(el); }
          }
          const target = ['discard', 'removed'].includes(r.to) ? this.ctx.root.querySelector(`.hp-${r.to}`) : null;
          if (target && current()) await this.received(target);
        }));
      }
      if (current()) {
        hidden.forEach(el => { delete el.dataset.arriving; this.arriving.delete(el); });
        this.notice.textContent = displayText('');
        this.ctx.root.classList.remove('is-dealing');
      }
    });
  }
  opening(state: HudState): Promise<void> {
    this.sync(state, { ...state, hand: state.hand.filter(id => id === '006'), opponentHand: 0, deck: state.deck + state.hand.filter(id => id !== '006').length + state.opponentHand });
    return this.drain();
  }

  private mountRail(): void {
    // Above the stage's input blocker, so readers can hover or focus the actual card.
    const stage = this.ctx.root.parentElement?.querySelector('.play');
    (stage ?? this.ctx.root).append(this.rail);
    this.layoutRail();
  }
  /** Where the resolving card is shown. */
  private railSlot(id?: string): Rect | null {
    const own = id ? this.rail.querySelector(`.hr-entry[data-card="${id}"]:not([hidden]) .hr-card`) : null;
    const shown = own ?? this.rail.querySelector('.hr-entry:not([hidden]) .hr-card');
    if (shown) return cardRectIn(shown);
    // nothing is resolving: measure the place a card would take
    const probe = document.createElement('div');
    probe.className = 'hr-entry';
    probe.style.visibility = 'hidden';
    probe.innerHTML = displayText('<div class="hr-caption">&nbsp;</div><div class="hr-card"></div>');
    this.mountRail();
    this.rail.append(probe);
    const r = cardRectIn(probe.querySelector('.hr-card'));
    probe.remove();
    return r;
  }
  private clearStandIn(): void {
    this.drop(this.standIn?.el ?? null);
    this.standIn = null;
  }
  private spot(p: CardLocation, id: string): Spot | null {
    if (typeof p === 'string') return this.at(p);
    if ('hand' in p) return this.at(p.hand === this.ctx.player ? 'hand' : 'opponent', id);
    return this.railSlot(id);
  }
  private receiver(p: CardLocation): Element | null {
    if (typeof p === 'string') return this.ctx.root.querySelector(`.hp-${p} .hp-card`);
    return 'hand' in p && p.hand !== this.ctx.player ? this.ctx.root.querySelector('.op-cards') : null;
  }

  /**
   * A card an effect moves from one place to another, said by the motion alone: lifted out of where it
   * was, held where it can be read, set down on what receives it, which answers with a glow. The words
   * are in the battle log. `commit` puts the new state in place: before the flight when the card comes
   * into this seat's hand, so that the hand makes room and the card lands in the gap; on landing
   * otherwise. Resolves false if it was cut off before it committed.
   */
  async move(move: CardMove, commit: () => void, pace = 1): Promise<boolean> {
    const g = this.generation, root = this.ctx.root, id = move.card;
    await this.drain();
    if (g !== this.generation) return false;
    const mine = (p: CardLocation): boolean => typeof p !== 'string' && 'hand' in p && p.hand === this.ctx.player;
    const leaving = mine(move.from) ? this.handElement(id) : null;
    const arriving = mine(move.to);
    if (leaving || arriving) {
      clearTimeout(this.lower);
      const low = this.handDrop() > 6;
      root.classList.add('is-receiving');
      // a card taken out of the hand is seen leaving it: the hand comes up first
      if (leaving && low) {
        await this.pause(280 * pace);
        if (g !== this.generation) return false;
      }
    }
    // a card this put on the table a moment ago leaves from where it stands
    const held = this.standIn?.id === id ? this.standIn.el.getBoundingClientRect() : null;
    const from = held ? { left: held.left, top: held.top, width: held.width, height: held.height } : this.spot(move.from, id);
    if (held) this.clearStandIn();
    if (leaving) leaving.dataset.leaving = '';
    let committed = false;
    const apply = (): void => { if (!committed) { committed = true; commit(); } };
    let slot: HTMLElement | null = null;
    if (arriving) {
      apply();
      slot = this.handElement(id);
      if (slot) slot.dataset.arriving = '';
    }
    const to = slot ? this.handSpot(id, true) : this.spot(move.to, id);
    const onTable = typeof move.to !== 'string' && 'play' in move.to;
    const hidden = move.from === 'deck' || (typeof move.from !== 'string' && 'hand' in move.from && !mine(move.from));
    // a card this hand receives but does not show (it cannot be used yet) is put away rather than cut off
    const unseen = arriving && !slot;
    const away = move.to === 'deck' || (typeof move.to !== 'string' && 'hand' in move.to && !arriving);
    const flight = await this.travel(id, from, to, { lift: true, flip: hidden, hide: away, pace, above: true, keep: onTable || unseen, move: true });
    if (g !== this.generation) return committed;
    apply();
    if (slot) delete slot.dataset.arriving;
    if (leaving) delete leaving.dataset.leaving;
    this.landedAt = performance.now();
    if (flight && onTable) {
      this.clearStandIn();
      this.standIn = { id, el: flight };
    } else if (flight) {
      void this.animate(flight, [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 28px' }], 260 * pace, 0, false, 'ease-in').then(() => this.drop(flight));
    } else void this.received(slot ?? this.receiver(move.to));
    if (leaving || arriving) this.lower = window.setTimeout(() => root.classList.remove('is-receiving'), 520);
    await this.pause(120 * pace);
    return true;
  }

  async show(play: Play): Promise<void> {
    const generation = this.generation;
    await this.drain();
    if (generation !== this.generation) return;
    // set down on the table by an effect a moment ago: it is already where it will be shown
    const landed = this.standIn?.id === play.card.id ? this.standIn.el : null;
    if (!landed) this.clearStandIn();
    const node = document.createElement('div');
    node.className = `hr-entry ${play.by === 0 ? 'is-a' : 'is-b'}`;
    node.dataset.card = play.card.id;
    const caption = document.createElement('div');
    caption.className = 'hr-caption';
    caption.textContent = i18n("{0} · {1}结算中", [play.by === this.ctx.player ? '你' : '对手', play.headline ? '头条' : '卡牌']);
    const slot = document.createElement('div'); slot.className = 'hr-card';
    slot.tabIndex = 0;
    slot.setAttribute('aria-label', this.ctx.cards.describe(play.card.id));
    slot.addEventListener('keydown', e => { if (e.key === 'Escape') { slot.blur(); this.skip(); } });
    const face = this.ctx.cards.face(play.card.id); slot.append(face);
    node.append(caption, slot);
    this.mountRail();
    this.rail.append(node);
    this.ctx.cards.fit(face);
    this.resolving.forEach(r => { r.el.hidden = true; });
    this.resolving.push({ play, el: node, shownAt: performance.now() });
    this.ctx.root.classList.add('has-resolution');
    if (landed) this.clearStandIn();
    else await this.animate(node, [{ opacity: 0, transform: 'translateX(-24px)' }, { opacity: 1, transform: 'none' }], 320);
  }
  async settle(play: Play): Promise<void> {
    const generation = this.generation;
    await this.drain();
    if (generation !== this.generation) return;
    this.clearStandIn();
    const item = [...this.resolving].reverse().find(r => r.play.card.id === play.card.id);
    if (!item) return;
    if (!play.cancelled) {
      // Its effects are over by now. It only waits if it has hardly been seen, or a card has just landed.
      const now = performance.now();
      const remaining = Math.max(MIN_SHOWN - (now - item.shownAt), BEAT - (now - this.landedAt));
      if (remaining > 0) await this.animate(item.el, [{ opacity: 1 }, { opacity: 1 }], remaining, 0, true);
      await this.readUntilLeave(item.el);
      if (generation !== this.generation) return;
    }
    const from = cardRectIn(item.el.querySelector('.hr-card'));
    const destination = play.cancelled ? { hand: play.by } : play.destination;
    let to: Rect | null;
    if (destination === 'inPlay') to = cardRectIn(this.ctx.root.querySelector('.ps-mine .slot, .ps-theirs .slot'));
    else if (destination) {
      const mine = destination.hand === this.ctx.player;
      to = this.at(mine ? 'hand' : 'opponent', play.card.id);
      if (!play.cancelled) { if (mine) this.settled.add(play.card.id); else if (play.card.id !== '006') this.settledOpponent++; }
    } else { to = this.at(play.pile); this.settled.add(play.card.id); }
    if (to) {
      item.el.style.visibility = 'hidden';
      await this.travel(play.card.id, from, to, { hide: !!destination && destination !== 'inPlay' && destination.hand !== this.ctx.player });
      this.landedAt = performance.now();
      if (generation === this.generation && destination !== 'inPlay')
        void this.received(destination ? (destination.hand === this.ctx.player ? null : this.ctx.root.querySelector('.op-cards')) : this.ctx.root.querySelector(`.hp-${play.pile} .hp-card`));
    } else await this.animate(item.el, [{ opacity: 1 }, { opacity: 0 }], 280);
    if (generation !== this.generation) return;
    item.el.remove();
    this.resolving = this.resolving.filter(r => r !== item);
    const previous = this.resolving.at(-1);
    if (previous) previous.el.hidden = false;
    this.ctx.root.classList.toggle('has-resolution', !!previous);
  }
}
