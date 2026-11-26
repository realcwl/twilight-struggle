import { t as i18n, text as displayText } from '../i18n/index.js';
// The spotlight: how a card being played is put on screen.
//
// Cinema: one thing on screen at a time. There are no panels and no ribbon. Whatever is not the
// subject of the moment goes dark under a veil, and the subject is lit through a hole in it: the
// card and its two readings, the countries that can be chosen, one large die between letterbox
// bars, the one country that changes, the one meter that moves. A meter does not wait in its corner
// to be noticed: its pane travels to the middle of the screen, changes there, and goes home.
//
// Both sides' moves are staged by the same code. It never works out a rule: see types.ts.
import { type Board, type Marks, makeBoard } from './board';
import { makeDie } from './dice';
import { makeImpact } from './impact';
import { makeImpactSound } from './impactSound';
import { makeFx, makeVeil, type Pending } from './fx';
import { PLAY_STRINGS } from './strings';
import { ABORTED } from './types';
import type { CardOptions, Cause, CoupPreview, Decision, Effect, Line, PhaseInfo, PlaceSession, Play, PlayHost, Presenter, RealignPreview, RollSpec, SideIndex, TargetRequest, Verb, WaitingHeadline } from './types';
import './play.css';
import type { SoundCue } from '../audio/cues';
import { esc } from '../cards/terms.js';
import { installTermHelp } from '../cards/tooltips.js';
import { availableUses } from './choices';
import { showScoring, type Scored } from './scoring';

const ICON: Record<Verb | 'warn' | 'lock', string> = {
  event: '<svg viewBox="0 0 24 24"><path d="M13.5 2 5 13.5h5.2L9.6 22 19 9.8h-5.6z"/></svg>',
  place: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 7.6v8.8M7.6 12h8.8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  realign: '<svg viewBox="0 0 24 24"><path d="M4 8.5h13l-3.2-3.3M20 15.5H7l3.2 3.3" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  coup: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/><circle cx="12" cy="12" r="1.7"/></svg>',
  space: '<svg viewBox="0 0 24 24"><path d="M12 2c3 2.6 4.4 6 4.4 9.6 0 2-.5 3.7-1.2 5H8.8c-.7-1.3-1.2-3-1.2-5C7.6 8 9 4.6 12 2zM7.4 13.2 4.5 16v3.6l3.6-1.7M16.6 13.2 19.5 16v3.6l-3.6-1.7M10.3 18.600h3.400l-.6 3.400h-2.2z"/><circle cx="12" cy="9.3" r="1.8" fill="#1b1510"/></svg>',
  warn: '<svg viewBox="0 0 24 24"><path d="M12 2.8 22.5 20.500h-21z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 9.5v5.2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.3"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.800a4 4 0 0 1 8 0v2.700" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>',
};

/** The key for each use of a card. */
const HOT: Record<Verb, string> = { event: 'e', place: 'z', realign: 'x', coup: 'c', space: 'v' };

type Meter = 'crisis' | 'milops' | 'vp' | 'space';
/** The HUD part that shows each meter (see the layout in src/hud/Hud.ts). */
const PART: Record<Meter, string> = { crisis: 'crisis', milops: 'milops', vp: 'scoreRule', space: 'space' };

type KeyMap = Record<string, () => void>;
type SubKey = { label: string; key: string; keyLabel: string; on: () => void; primary?: boolean };
type SubLine = { main?: string; small?: string; tone?: string; side?: SideIndex | null; at?: 'top' | 'bottom'; keys?: SubKey[]; big?: string | number };
type TitleCard = { kicker?: string; main?: string; small?: string; side?: SideIndex | null; ms?: number; card?: string | null; dark?: number };
/** One of the four ways to spend a card's points, worded for the player. */
type Band = { key: Exclude<Verb, 'event'>; label: string; ok: boolean; sub: string; why: string; risk: string; safe: boolean; marks: Marks | null };
/** One effect in words, and how it is coloured. */
type Told = { text: string; short: string; cls: string; took: string; meter: Meter | null; why: string };

const sideCls = (s: SideIndex | null | undefined): string => (s === 0 ? 'a' : s === 1 ? 'b' : '');
const isCoup = (p: CoupPreview | RealignPreview | Record<string, never>): p is CoupPreview => 'need' in p;
const isRealign = (p: CoupPreview | RealignPreview | Record<string, never>): p is RealignPreview => 'edge' in p;
const sum = (mods: { n: number }[]): number => mods.reduce((a, m) => a + m.n, 0);

export function createSpotlight(host: PlayHost): Presenter {
  const { container, map, hud, cards, game, audio } = host;
  const t = PLAY_STRINGS[host.lang];
  const player = host.player ?? 0;
  const fx = makeFx(host.pace ?? 1);
  const { wait, el } = fx;
  const name = (id: string): string => game.country(id).name;
  const sideName = (s: SideIndex): string => game.sideName(s);

  const layer = el('div', 'play');
  layer.dataset.lang = host.lang;
  container.appendChild(layer);
  // the two sides' colours as the HUD has them, for the layer and for what is hung on map nodes
  const tint = getComputedStyle(hud.root);
  const TINTS = ['--a', '--a-l', '--b', '--b-l'];
  for (const v of TINTS) {
    const value = tint.getPropertyValue(v).trim();
    if (value) container.style.setProperty(`--play${v.slice(1)}`, value);
  }
  hud.root.classList.add('play-on', 'play-readonly');

  const board: Board = makeBoard(map, container, fx);
  const sound = (cue: SoundCue, id?: string, gain = 1): void => {
    if (fx.dead) return;
    const r = id ? board.rect(id) : null;
    const pan = r ? ((r.left + r.width / 2) / window.innerWidth - .5) * 1.1 : 0;
    audio?.play(cue, { pan, gain });
  };
  const veil = makeVeil(layer);
  // the moments that land: a plinth set down, a number broken, a die firing on what it beat
  const hit = audio ? makeImpactSound() : null;
  const impact = makeImpact({ layer, container, fx, pace: host.pace ?? 1, sound: hit });
  /** The score a scoring has already shown the HUD: the step that applies it has nothing left to show. */
  let scored: Scored = null;
  // while the stage is busy the map takes no clicks and no drags
  const block = el('div', 'sp-block');
  block.hidden = true;
  layer.appendChild(block);
  const busy = (on: boolean): void => {
    block.hidden = !on;
  };
  const hand = {
    /** The hand leaves the screen: something else needs the room. */
    away: (on: boolean): void => {
      if (on) hud.cancelHandDrag();
      hud.root.classList.toggle('play-away', on);
    },
    /** The hand answers the pointer, or sits low and waits. */
    live: (on: boolean): void => {
      if (!on) hud.cancelHandDrag();
      hud.root.classList.toggle('play-wait', !on);
      if (on) hud.root.classList.remove('play-readonly');
    },
  };
  const part = (m: Meter): HTMLElement | null => hud.root.querySelector<HTMLElement>(`[data-part="${PART[m]}"]`);
  const scene: { pane: HTMLElement | null; country: string | null } = { pane: null, country: null };
  let headline: HTMLElement | null = null;
  let waitingHeadline: WaitingHeadline | null = null;
  const headlineArrivals = new Map<SideIndex, Promise<void>>();
  let turn = 0;
  let turnSaid = false;

  function putCard(id: string, parent: Element): HTMLElement {
    const c = cards.face(id);
    parent.appendChild(c);
    cards.fit(c);
    return c;
  }

  function headlineStage(): HTMLElement {
    if (headline) return headline;
    headline = el('div', 'sp-headline is-waiting');
    headline.innerHTML = displayText(([1, 0] as SideIndex[]).map(by => `<div class="sp-hl-seat is-empty ${sideCls(by)}"><span class="sp-hl-who">${by === player ? t.you : sideName(by)}</span><div class="sp-hl-card"><div class="sp-hl-flip"><div class="sp-hl-back"></div><div class="sp-hl-front"></div></div></div><span class="sp-hl-order"></span></div>`).join(''));
    layer.append(headline);
    return headline;
  }
  function headlineSeat(by: SideIndex): HTMLElement {
    return headlineStage().querySelector<HTMLElement>(`.sp-hl-seat.${sideCls(by)}`)!;
  }
  function placeHeadline(by: SideIndex, id: string | null, animate: boolean, from?: DOMRect): void {
    const seat = headlineSeat(by), fresh = seat.classList.contains('is-empty');
    const front = seat.querySelector<HTMLElement>('.sp-hl-front')!;
    if (id && front.dataset.card !== id) {
      front.replaceChildren(); putCard(id, front); front.dataset.card = id;
    }
    if (!fresh) return;
    seat.classList.remove('is-empty');
    seat.querySelector('.sp-hl-back')!.append(cards.back());
    if (!animate) return;
    const node = seat.querySelector<HTMLElement>('.sp-hl-card')!, to = node.getBoundingClientRect();
    const source = from ?? hud.root.querySelector(by === player ? '[data-hand]' : '.op-cards')?.getBoundingClientRect();
    const x = source ? source.left + source.width / 2 - to.left - to.width / 2 : 0;
    const y = from ? from.top - to.top : by === player ? container.clientHeight - to.top : -to.top;
    const scale = from?.width ? from.width / to.width : .48;
    const animation = node.animate([
      { transform: `translate(${x}px,${y}px) scale(${scale}) rotate(${by === player ? -8 : 8}deg)`, opacity: .7 },
      { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
    ], { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 520, easing: 'cubic-bezier(.22,.7,.2,1)' });
    const release = fx.hold(() => animation.cancel());
    headlineArrivals.set(by, animation.finished.then(() => {}, () => {}).finally(release));
  }
  function waitHeadline(h: WaitingHeadline | null, animate = true, from?: DOMRect): void {
    if (headline?.classList.contains('is-open')) return;
    waitingHeadline = h;
    hud.holdHeadline(h?.mine ?? null);
    if (!h || (!h.mine && !h.theirs)) {
      headline?.remove(); headline = null; headlineArrivals.clear();
      return;
    }
    headlineStage();
    if (h.mine) {
      placeHeadline(player, h.mine, animate, from);
      headlineSeat(player).querySelector('.sp-hl-order')!.textContent = displayText(displayText(`已打出 · ${game.card(h.mine).title}`));
    }
    if (h.theirs) {
      placeHeadline((1 - player) as SideIndex, null, animate);
      headlineSeat((1 - player) as SideIndex).querySelector('.sp-hl-order')!.textContent = displayText(displayText('已打出 · 待揭示'));
    }
  }

  /* ------------------------------------------------------------------ keys */
  const keyStack: KeyMap[] = [];
  const onKey = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey || !keyStack.length) return;
    if (document.querySelector('dialog[open]') || (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]'))) return;
    const k = e.key.toLowerCase();
    for (let i = keyStack.length - 1; i >= 0; i--) {
      const fn = keyStack[i][k];
      if (fn) {
        e.preventDefault();
        fn();
        return;
      }
    }
  };
  window.addEventListener('keydown', onKey);
  /** Key handlers that live until the returned function is called. */
  function keys(mapOf: KeyMap): () => void {
    keyStack.push(mapOf);
    return () => {
      const i = keyStack.indexOf(mapOf);
      if (i >= 0) keyStack.splice(i, 1);
    };
  }

  /** The next card the player drags out of the hand. */
  function nextCard(headline = false): Promise<string> {
    const choices = new Map(hud.handCards.map(id => {
      const o = game.options(id);
      const reason = headline
        ? o.headline?.ok === false ? o.headline.why ?? i18n("此牌不能用于头条") : ''
        : o.blocked ?? (availableUses(o).length ? '' : i18n("当前没有可用的出牌方式"));
      return [id, reason] as const;
    }));
    hud.setHandAvailability(choices);
    const restriction = headline ? '' : [...choices.values()].find(v => v.includes(i18n("须先")));
    if (restriction) {
      sub.set({ at: 'top', main: t.yourMove, small: restriction, side: player });
      subEl.classList.add('sp-hand-restriction');
    }
    hud.root.classList.add('play-card-turn');
    const p = fx.pending<string>();
    const release = fx.hold(
      hud.on('play', (id) => {
        if (!choices.has(id) || choices.get(id)) return;
        release();
        p.resolve(id);
      }),
    );
    return p.promise.finally(() => {
      hud.setHandAvailability(null);
      if (!fx.dead) hud.root.classList.remove('play-card-turn');
    });
  }

  /* ------------------------------------------------------------------ the subtitle: one line of large type */
  const subEl = el('div', 'sp-sub');
  subEl.hidden = true;
  layer.appendChild(subEl);
  let offSubKeys: (() => void) | null = null;
  let subRevision = 0;
  const sub = {
    /** main: the line; big: a numeral before it; small: the second line; keys: what can be pressed. */
    set({ main = '', small = '', tone = '', side = null, at = 'bottom', keys: list = [], big = '' }: SubLine): void {
      subRevision++;
      subEl.hidden = false;
      subEl.className = `sp-sub at-${at} ${sideCls(side)}`;
      subEl.innerHTML = displayText(`<div class="sp-sub-main">${big !== '' ? `<b class="sp-sub-big">${big}</b>` : ''}<span>${main}</span></div><div class="sp-sub-small ${tone}">${small}</div><div class="sp-sub-keys"></div>`);
      const box = subEl.lastElementChild!;
      offSubKeys?.();
      const mapOf: KeyMap = {};
      for (const k of list) {
        const b = el('button', k.primary ? 'primary' : '', `${k.label}<kbd>${k.keyLabel}</kbd>`);
        b.type = 'button';
        b.dataset.shortcut = k.key;
        b.addEventListener('click', () => k.on());
        box.appendChild(b);
        mapOf[k.key] = k.on;
      }
      offSubKeys = keys(mapOf);
    },
    /** A reminder, not an instruction that must stay while the player spends points. */
    hint(line: SubLine): void {
      sub.set(line);
      const revision = subRevision;
      fx.later(() => {
        if (revision !== subRevision) return;
        subEl.classList.add('is-leaving');
        fx.later(() => { if (revision === subRevision) sub.clear(); }, 350);
      }, 1800);
    },
    say(small: string, tone = ''): void {
      const n = subEl.querySelector('.sp-sub-small');
      if (!n) return;
      n.className = `sp-sub-small ${tone}`;
      n.innerHTML = displayText(small);
    },
    clear(): void {
      subRevision++;
      subEl.hidden = true;
      offSubKeys?.();
      offSubKeys = null;
    },
  };

  /* ------------------------------------------------------------------ a title card */
  /** Large type in the middle of a dark screen, with a card beside it if one is given. */
  async function title({ kicker = '', main = '', small = '', side = null, ms = 1300, card = null, dark = 0.74 }: TitleCard): Promise<void> {
    veil.show(dark);
    const n = el('div', `sp-title ${sideCls(side)} ${card ? 'has-card' : ''}`, `${card ? '<div class="sp-title-card"></div>' : ''}<div class="sp-title-text"><span class="sp-kick">${kicker}</span><b>${main}</b><small>${small}</small></div>`);
    layer.appendChild(n);
    if (card) putCard(card, n.querySelector('.sp-title-card')!);
    await wait(ms);
    n.classList.add('is-out');
    fx.later(() => n.remove(), 420);
    veil.hide();
  }

  /* ------------------------------------------------------------------ the two subjects a scene can hold: a country, a pane */
  async function stable(id: string, max = 1500): Promise<void> {
    let prev: { x: number; y: number } | null = null;
    const t0 = performance.now();
    while (performance.now() - t0 < max) {
      await wait(90);
      const p = board.at(id);
      if (p && prev && Math.hypot(p.x - prev.x, p.y - prev.y) < 0.6) return;
      prev = p;
    }
  }

  function releaseCountry(): void {
    if (!scene.country) return;
    scene.country = null;
    board.big(null);
    board.mark(null);
    veil.hide();
  }

  /** The camera goes to one country (in close if the view was the whole world) and everything else goes dark. */
  async function focusCountry(id: string): Promise<void> {
    if (scene.country === id) return;
    await sendPaneHome();
    const far = board.zoom > 0.62;
    scene.country = id;
    board.big(id);
    // The map points the country out itself, exactly as it does for a country in focus: lit along
    // its own borders and raised, the rest stepping back. No light of ours is laid over it.
    board.mark({ ok: [id], lift: [id] });
    veil.hide();
    await board.show(id, { zoom: far });
    if (far) await stable(id);
  }

  /** The HUD corner that holds a meter comes to the middle of the screen, enlarged, lit through the veil. */
  async function bringPane(meter: Meter): Promise<HTMLElement | null> {
    const pane = part(meter)?.closest<HTMLElement>('.hud-corner') ?? null;
    if (!pane) return null;
    if (scene.pane === pane) return pane;
    await sendPaneHome();
    if (scene.country) {
      scene.country = null;
      board.big(null);
      board.mark(null);
    }
    hud.setStatusSpotlight(true);
    const r = pane.getBoundingClientRect();
    const g = container.getBoundingClientRect();
    const s = Math.min(2, (g.width * 0.5) / r.width, (g.height * 0.44) / r.height);
    const dx = g.left + g.width / 2 - (r.left + r.width / 2);
    const dy = g.top + g.height * 0.53 - (r.top + r.height / 2);
    scene.pane = pane;
    pane.classList.add('sp-abroad');
    pane.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${s.toFixed(3)})`;
    veil.show(0.84, () => [pane.getBoundingClientRect()]);
    await wait(760);
    return pane;
  }

  async function sendPaneHome(): Promise<void> {
    const pane = scene.pane;
    if (!pane) return;
    scene.pane = null;
    pane.style.transform = '';
    await wait(620);
    pane.classList.remove('sp-abroad');
    hud.setStatusSpotlight(false);
    veil.hide();
  }

  async function clearScene(): Promise<void> {
    await hud.waitForCards();
    await sendPaneHome();
    releaseCountry();
  }

  /** A large numeral dropped on a country's node. */
  function slam(id: string, text: string, cls: string): void {
    const p = board.at(id);
    if (!p) return;
    const o = container.getBoundingClientRect();
    const n = el('b', `sp-slam ${cls}`, text);
    n.style.left = p.x - o.left + 'px';
    n.style.top = p.y - o.top + 'px';
    layer.appendChild(n);
    fx.later(() => n.remove(), 1600);
  }

  /* ------------------------------------------------------------------ words */
  /** The four ways to spend a card's points, with where on the map each could be carried out. */
  function bandsOf(o: CardOptions): Band[] {
    const keyed = [...o.coup.targets].filter(([, p]) => p.key).map(([id]) => id);
    return [
      { key: 'place', label: t.verb.place, ok: o.place.ok, sub: t.placeSub(o.points, o.place.targets.size), why: t.noPlace, risk: '', safe: false, marks: { ok: [...o.place.targets.keys()] } },
      { key: 'realign', label: t.verb.realign, ok: o.realign.ok, sub: t.realignSub(o.points, o.realign.targets.size), why: o.realign.why, risk: '', safe: false, marks: { ok: [...o.realign.targets.keys()], locked: [...o.realign.locked.keys()] } },
      { key: 'coup', label: t.verb.coup, ok: o.coup.ok, sub: t.coupSub(o.coup.targets.size), why: o.coup.why, risk: o.coup.notice ?? (keyed.length ? t.coupRisk : ''), safe: false, marks: { ok: [...o.coup.targets.keys()], locked: [...o.coup.locked.keys()], warn: keyed } },
      { key: 'space', label: t.verb.space, ok: o.space.ok, sub: o.space.ok ? t.spaceSub(o.space.max) : '', why: o.space.why, risk: '', safe: o.fires, marks: null },
    ];
  }

  /** What one effect is in words, and how it should be coloured. */
  function describe(e: Effect): Told {
    const sign = (d: number): string => (d > 0 ? '+' : '−') + Math.abs(d);
    const cls = (s: SideIndex): string => (s === 0 ? 'a' : 'b');
    if (e.t === 'inf') {
      const took = e.ctrlTo !== e.ctrlFrom ? (e.ctrlTo === null ? t.nobody : t.controls(sideName(e.ctrlTo))) : '';
      return { text: `${name(e.id)}: ${t.influence(sideName(e.side))} ${sign(e.d)}`, short: sign(e.d), cls: cls(e.side), took, meter: null, why: '' };
    }
    if (e.t === 'crisis') return { text: `${t.crisis} ${e.from} → ${e.to}`, short: `${e.from} → ${e.to}`, cls: e.d < 0 ? 'bad' : 'good', took: '', meter: 'crisis', why: e.why ?? '' };
    if (e.t === 'milops') return { text: `${t.milops(sideName(e.side))} ${e.from} → ${e.to}`, short: sign(e.to - e.from), cls: cls(e.side), took: '', meter: 'milops', why: e.why ?? '' };
    if (e.t === 'vp') return { text: `${sideName(e.side)} +${e.d} ${t.vp}`, short: `+${e.d}`, cls: cls(e.side), took: '', meter: 'vp', why: e.why ?? '' };
    if (e.t === 'space') return { text: `${t.verb.space}: ${sideName(e.side)} → ${t.spaceTo(e.to)}`, short: '+1', cls: cls(e.side), took: '', meter: 'space', why: e.why ?? '' };
    return { text: e.text, short: '', cls: 'note', took: '', meter: null, why: '' };
  }

  /** Who is doing what, in a few words. */
  function playLine(play: Play): { who: string; what: string; detail: string } {
    const who = sideName(play.by);
    if (play.use === 'event') return { who, what: play.headline ? t.headlineEvent : t.verb.event, detail: '' };
    if (play.use === 'space') return { who, what: t.verb.space, detail: ` · ${t.spaceDetail}` };
    return { who, what: t.opsLine(play.points, t.verb[play.verb]), detail: play.target ? ` → ${name(play.target)}` : '' };
  }

  const lineList = (lines: Line[]): string => lines.map((l) => `<li class="${l.warn ? 'warn' : ''}${l.lethal ? ' lethal' : ''}">${l.warn ? ICON.warn : ''}<span>${l.text}</span></li>`).join('');

  /* ------------------------------------------------------------------ choosing: two halves, then four bands */
  let choice: HTMLElement | null = null;
  function closeChoice(): void {
    choice?.remove();
    choice = null;
    board.mark(null);
    veil.hide();
  }

  /** Resolves with what the card is to be used for, or null if the player takes it back. */
  function openChoice(id: string): Promise<Verb | null> {
    closeChoice();
    const o = game.options(id);
    const uses = availableUses(o);
    if (uses.length <= 1) return Promise.resolve(uses[0] ?? null);
    const bands = bandsOf(o);
    const d = fx.pending<Verb | null>();
    const theirs = o.fires;
    const evOk = o.event.ok;
    const opp = sideName((1-player) as SideIndex);
    let lit: string[] | 'space' = [];
    const band = (c: Band): string =>
      `<button type="button" class="sp-band ${c.ok ? '' : 'is-off'}" data-key="${c.key}" ${c.ok ? '' : 'disabled'}>` +
      `<i class="sp-ic">${ICON[c.key]}</i><b>${c.label}</b><kbd>${HOT[c.key].toUpperCase()}</kbd>` +
      `<span class="sp-band-sub">${c.ok ? c.sub : c.why}` +
      (c.ok && c.risk ? `<em class="risk">${ICON.warn}${c.risk}</em>` : '') +
      (c.ok && o.fires ? (c.safe ? `<em class="safe">${t.safe}</em>` : `<em class="risk">${t.firesAfter(opp)}</em>`) : '') +
      '</span></button>';
    const node = (choice = el('div', `sp-choice ${theirs ? 'is-theirs' : ''}`));
    node.innerHTML =
      displayText(`<button type="button" class="sp-half ev" data-key="event" ${evOk ? '' : 'disabled'}>` +
      `<span class="sp-kick">${theirs ? t.kickForced : t.kickEither}</span>` +
      `<b class="sp-big">${theirs ? t.theirEvent(opp) : t.verb.event}</b>` +
      `<ul class="sp-lines">${lineList(o.event.lines)}</ul>` +
      `<span class="sp-foot">${theirs ? t.theirFoot : o.card.once ? t.once : t.reusable}${evOk ? '<kbd>E</kbd>' : ''}</span></button>` +
      `<div class="sp-mid"><div class="sp-slot"></div><button type="button" class="sp-back">${t.back}<kbd>Esc</kbd></button></div>` +
      `<button type="button" class="sp-half ops" data-key="ops" ${bands.some(b => b.ok) ? '' : 'disabled'}><span class="sp-kick">${t.kickOr}</span><b class="sp-big">${t.ops}</b><span class="sp-pts"><b>${o.points}</b>${t.points}</span><span class="sp-foot">${t.opsFoot}<kbd>Z</kbd><kbd>X</kbd><kbd>C</kbd><kbd>V</kbd></span></button>` +
      `<div class="sp-bands"><span class="sp-kick">${t.bandsKick(o.points)}</span>${bands.map(band).join('')}</div>`);
    layer.appendChild(node);
    hand.away(true);
    // The dark behind the large type. A band's countries are pointed out by the map's own highlight,
    // so while one is being looked at the dark thins to let the map through; the space race is a
    // part of the HUD, and stays lit through a hole.
    const dark = (): void => veil.show(lit !== 'space' && lit.length ? 0.4 : 0.78, () => (lit === 'space' ? [part('space')?.getBoundingClientRect() ?? null] : []));
    dark();
    putCard(id, node.querySelector('.sp-slot')!);

    const choose = (key: Verb | null): void => d.resolve(key);
    const keymap: KeyMap = {
      escape: () => {
        if (node.classList.contains('is-ops')) {
          node.classList.remove('is-ops');
          lit = [];
          board.mark(null);
          dark();
        } else choose(null);
      },
    };
    if (evOk) {
      node.querySelector('.sp-half.ev')!.addEventListener('click', () => choose('event'));
      keymap[HOT.event] = () => choose('event');
    }
    node.querySelector('.sp-half.ops')!.addEventListener('click', () => node.classList.add('is-ops'));
    for (const c of bands) {
      if (!c.ok) continue;
      const b = node.querySelector<HTMLElement>(`.sp-band[data-key="${c.key}"]`)!;
      b.addEventListener('click', () => choose(c.key));
      keymap[HOT[c.key]] = () => choose(c.key);
      b.addEventListener('pointerenter', () => {
        lit = c.key === 'space' ? 'space' : [...(c.marks?.ok ?? [])];
        if (c.marks) board.mark(c.marks);
        dark();
      });
      b.addEventListener('pointerleave', () => {
        lit = [];
        board.mark(null);
        dark();
      });
    }
    node.querySelector('.sp-back')!.addEventListener('click', () => choose(null));
    const off = keys(keymap);
    return d.promise.finally(off);
  }

  /* ------------------------------------------------------------------ the presenter */
  return {
    async idle(): Promise<void> {
      hud.cancelHandDrag();
      await clearScene();
      sub.clear();
      board.big(null);
      board.mark(null);
      busy(false);
      hand.away(false);
      hand.live(true);
      hud.root.classList.add('play-readonly');
    },

    async phase(info: PhaseInfo): Promise<void> {
      await clearScene();
      // A cancelled second headline has no announce() call to remove its seat.
      headline?.remove(); headline = null; waitingHeadline = null; headlineArrivals.clear();
      hud.holdHeadline(null);
      sub.clear();
      busy(true);
      hand.live(false);
      if (info.kind === 'end') {
        // final: it stays until the page starts the game again
        veil.show(0.8);
        layer.appendChild(el('div', 'sp-end war', `<b>${t.war}</b><small>${t.warSmall}</small>`));
      } else if (info.kind === 'turn') {
        sound('turn');
        turn = info.turn;
        turnSaid = true;
        await title({ main: t.turnNo(info.turn), ms: 1150, dark: 0.6 });
      } else if (info.kind === 'headline') {
        await title({ kicker: turn && !turnSaid ? t.turnNo(turn) : '', main: t.headlinePhase, small: t.headlineRule, ms: 1700 });
        turnSaid = false;
      } else {
        await title({ kicker: t.roundNo(info.round), main: info.who === player ? t.yourMove : t.theirMove(sideName(info.who)), side: info.who, ms: 950, dark: 0.55 });
      }
    },

    /* ---- headline: a card dragged out of the hand is played, there is no second screen */
    async pickHeadline(): Promise<string> {
      await clearScene();
      busy(false);
      hand.away(false);
      hand.live(true);
      sub.hint({ at: 'top', main: t.headlinePhase, small: t.headlinePrompt, side: player });
      const card = await nextCard(true);
      const from = hud.root.querySelector(`.hd-card[data-card="${card}"]`)?.getBoundingClientRect();
      waitHeadline({ mine: card, theirs: waitingHeadline?.theirs ?? false }, true, from);
      sub.clear();
      hand.live(true);
      hud.root.classList.add('play-readonly');
      busy(false);
      return card;
    },

    waitHeadline(h): void { waitHeadline(h); },

    async showHeadline({ mine, theirs, order }): Promise<void> {
      busy(true);
      hand.live(false);
      veil.show(0.66);
      const stage = headlineStage();
      const seat = headlineSeat;
      for (const by of [0, 1] as SideIndex[]) {
        placeHeadline(by, by === 0 ? mine : theirs, true);
        seat(by).querySelector('.sp-hl-order')!.textContent = displayText('');
      }
      hud.holdHeadline(null);
      waitingHeadline = null;
      await Promise.all(headlineArrivals.values());
      headlineArrivals.clear();
      stage.classList.remove('is-waiting');
      await wait(450);
      sound('reveal');
      stage.classList.add('is-open');
      await wait(900);
      order.forEach((o, i) => {
        const n = seat(o.by).querySelector('.sp-hl-order')!;
        n.textContent = displayText(i === 0 ? t.first : t.second);
        n.classList.add(i === 0 ? 'first' : 'second');
      });
      stage.classList.add('is-ordered');
      await wait(1500);
      // Waiting headlines dock here; announce() gives the resolving card its own readable rail.
      const from = stage.getBoundingClientRect();
      const o = container.getBoundingClientRect();
      const corner = hud.root.querySelector('.hud-tr')?.getBoundingClientRect();
      const k = 0.42;
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
      const left = o.width - from.width * k - 1.6 * rem;
      const top = (corner?.bottom ?? o.top + 12 * rem) - o.top + 1.6 * rem;
      stage.style.animation = 'none';
      stage.style.left = `${from.left - o.left}px`;
      stage.style.top = `${from.top - o.top}px`;
      stage.style.transform = 'none';
      void stage.offsetWidth;
      stage.classList.add('is-docked');
      stage.style.transform = `translate(${(left - (from.left - o.left)).toFixed(1)}px, ${(top - (from.top - o.top)).toFixed(1)}px) scale(${k})`;
      headline = stage;
      veil.hide();
      await wait(620);
    },

    /* ---- the player's decision */
    async decide(): Promise<Decision> {
      for (;;) {
        await clearScene();
        busy(false);
        hand.away(false);
        hand.live(true);
        sub.hint({ at: 'top', main: t.yourMove, small: t.playPrompt, side: player });
        const card = await nextCard();
        sub.clear();
        const key = await openChoice(card);
        closeChoice();
        if (key) {
          busy(true);
          return key === 'event' ? { card, use: 'event' } : key === 'space' ? { card, use: 'space' } : { card, use: 'ops', mode: key };
        }
        // taken back: the card never left the hand
      }
    },

    /* ---- a card is played */
    async announce(play: Play): Promise<void> {
      await clearScene();
      busy(true);
      hand.live(false);
      const line = playLine(play);
      sound('card');
      if (play.headline) {
        sub.set({ main: t.cardName(play.card.title), small: t.headlineOf(sideName(play.by)), side: play.by });
        if (headline) {
          headline.querySelector(`.sp-hl-seat.${sideCls(play.by)}`)?.classList.add('is-gone');
          await wait(460);
          if (!headline.querySelector('.sp-hl-seat:not(.is-gone)')) {
            headline.remove();
            headline = null;
          }
        }
        await hud.showResolving(play);
        await wait(1800);
        return;
      }
      board.clearBadges('last');
      hand.away(true);
      if (play.by === player) await wait(320);
      else {
        // a title card in the opponent's colour: their card, and in large type what they are doing with it
        const what = play.use === 'ops' ? `${t.verb[play.verb]}${play.verb !== 'place' && play.target ? ` · ${name(play.target)}` : ''}` : line.what;
        const small = play.use === 'ops' ? t.cardOps(play.card.title, play.points) : `${t.cardName(play.card.title)}${line.detail}`;
        await title({ kicker: t.theyPlay(sideName(play.by)), main: what, small, side: play.by, card: play.card.id, ms: 1900, dark: 0.82 });
      }
      sub.set({ main: t.cardName(play.card.title), small: `${line.who} · ${line.what}${line.detail}`, side: play.by });
      await hud.showResolving(play);
      if (play.target) {
        await focusCountry(play.target);
        board.ring(play.target, sideCls(play.by));
        await wait(650);
      }
    },

    /* ---- placing influence */
    async place(session: PlaceSession): Promise<boolean> {
      await clearScene();
      busy(false);
      let act: Pending<'undo' | 'done' | 'cancel'>;
      const press = (what: 'undo' | 'done' | 'cancel'): void => act.resolve(what);
      const draw = (): Map<string, { cost: number; ok: boolean }> => {
        const ok = new Map([...session.targets()].filter(([, v]) => v.ok));
        const put = [...new Set(session.spent.map((s) => s.id))];
        board.mark({ ok: ok.keys(), lift: put, keep: put });
        board.clearBadges('cost');
        board.clearBadges('put');
        for (const [id, v] of ok) if (v.cost > 1) board.badge(id, 'cost', `${v.cost}`, sideCls((1-player) as SideIndex));
        for (const id of put) board.badge(id, 'put', `+${session.count(id)}`, sideCls(player));
        // the countries on offer are lit by the map, along their borders
        veil.hide();
        const none = !session.spent.length;
        sub.set({
          big: session.left,
          main: t.placeMain(session.left),
          small: session.left ? (ok.size ? t.placeHint : t.placeStuck) : t.placeDone,
          side: player,
          keys: [
            ...(none ? [] : [{ label: t.undo, key: 'backspace', keyLabel: '⌫', on: () => press('undo') }]),
            ...(session.canCancel === false ? [] : [{ label: i18n("返回选择"), key: 'escape', keyLabel: 'Esc', on: () => press('cancel') }]),
            ...(!session.left || !ok.size ? [{ label: t.done, key: 'enter', keyLabel: '↵', on: () => press('done'), primary: true }] : []),
          ],
        });
        return ok;
      };
      const end = (): void => {
        board.mark(null);
        board.clearBadges('cost');
        board.clearBadges('put');
        veil.hide();
        sub.clear();
        busy(true);
      };
      for (;;) {
        const ok = draw();
        act = fx.pending<'undo' | 'done' | 'cancel'>();
        const got = await Promise.race([session.left && ok.size ? board.pick() : new Promise<never>(() => {}), act.promise]);
        board.cancelPick();
        if (got === 'undo') { if (session.undo()) sound('return'); }
        else if (got === 'done') break;
        else if (got === 'cancel') {
          while (session.undo());
          end();
          return false;
        } else if (got) {
          const e = session.add(got);
          if (e) {
            sound('influence', got);
            if (e.t === 'inf' && e.ctrlTo !== null && e.ctrlTo !== e.ctrlFrom) sound('control', got, .65);
            slam(got, '+1', `${sideCls(player)} small`);
            board.ring(got, sideCls(player));
            if (e.t === 'inf' && e.ctrlTo !== e.ctrlFrom) board.pop(got, e.ctrlTo === player ? t.controls(sideName(player)) : t.breaks, 'gold late');
            if (e.t === 'inf' && e.ctrlTo !== null && e.ctrlTo !== e.ctrlFrom) void impact.control(got, e.ctrlTo).catch(() => {});
          }
        }
      }
      end();
      return true;
    },

    /* ---- choosing a country */
    async pickTarget(req: TargetRequest): Promise<string | null> {
      await clearScene();
      // a second choice in the same play is made from the view the player had, not from close up
      if (board.restView()) await wait(650);
      busy(false);
      const act = fx.pending<null>();
      const kind = req.mode;
      const warn = [...req.targets].filter(([, p]) => isCoup(p) && p.key).map(([id]) => id);
      board.mark({ ok: req.targets.keys(), locked: req.locked.keys(), warn });
      for (const [id, p] of req.targets) {
        if (isCoup(p)) board.badge(id, 'need', p.need ? `≥${p.need}` : '✕', p.need ? '' : 'off');
        else if (isRealign(p)) {
          const edge = player === 0 ? p.edge : -p.edge;
          board.badge(id, 'need', edge > 0 ? `+${edge}` : edge < 0 ? `−${-edge}` : '±0', edge > 0 ? 'good' : edge < 0 ? 'bad' : 'even');
        }
      }
      for (const id of req.locked.keys()) board.badge(id, 'lock', ICON.lock);
      veil.hide();
      const titled = t.cardName(req.title ?? game.card(req.card).title);
      const main = kind === 'event' ? t.eventNth(req.title ?? game.card(req.card).title, req.total - req.left + 1, req.total) : kind === 'realign' ? t.realignMain(req.left) : t.coupMain;
      const hint = kind === 'coup' ? t.coupHint : kind === 'realign' ? t.realignHint : (req.hint ?? '');
      const list: SubKey[] = [];
      if (req.optional) list.push({ label: t.stop, key: 'enter', keyLabel: '↵', on: () => act.resolve(null), primary: true });
      if (req.cancel) list.push({ label: i18n("返回选择"), key: 'escape', keyLabel: 'Esc', on: () => act.resolve(null) });
      sub.set({ main, small: hint, side: player, keys: list, big: req.total > 1 ? req.left : '' });
      const off = board.onHover((id) => {
        if (id && req.locked.has(id)) return sub.say(`${ICON.lock}${name(id)}: ${req.locked.get(id) ?? ''}`, 'bad');
        const p = id ? req.targets.get(id) : undefined;
        if (!id || !p) return sub.say(hint);
        if (isCoup(p)) sub.say(`<b>${name(id)}</b>${p.need ? t.needRoll(p.need, Math.round(p.chance * 100)) : t.impossible}${p.key ? `<em>${ICON.warn}${t.keyCrisis(game.crisis, p.crisisTo)}</em>` : ''}`, p.key ? 'warn' : '');
        else if (isRealign(p)) sub.say(`<b>${name(id)}</b>${t.realignDice(sum(p.mods[player]), sideName((1-player) as SideIndex), sum(p.mods[1-player]))}`);
        else sub.say(`<b>${name(id)}</b>${hint}`);
      });
      const id = await Promise.race([board.pick(), act.promise]);
      off();
      board.cancelPick();
      board.clearBadges('need');
      board.clearBadges('lock');
      board.mark(null);
      veil.hide();
      busy(true);
      if (id) {
        sub.set({ main: `${kind === 'event' ? titled : t.verb[kind]} · ${name(id)}`, small: '', side: 0 });
        await focusCountry(id);
        board.ring(id, sideCls(player));
        await wait(450);
      } else sub.clear();
      return id;
    },

    /* ---- dice: letterbox, one large die */
    async roll(spec: RollSpec): Promise<void> {
      installTermHelp().hide();
      await clearScene();
      sub.clear();
      busy(true);
      hand.away(true);
      const country = spec.id && (spec.kind === 'coup' || spec.situation) ? game.country(spec.id) : null;
      if (country) {
        await focusCountry(country.id);
        map.panTo(country.id, container.clientWidth < 700 ? 0.5 : 0.31);
        await wait(620);
      }
      const side = spec.by;
      const percent = Math.round((spec.chance ?? 0) * 100);
      const contest = spec.kind === 'contest';
      const versus = contest || spec.kind === 'realign';
      const verb = spec.kind === 'contest' || spec.kind === 'check' ? esc(game.card(spec.card).title) : t.verb[spec.kind];
      const head = spec.id ? `${verb} · ${name(spec.id)}` : verb;
      const need = contest || spec.kind === 'check' ? esc(spec.rule ?? '') : spec.kind === 'coup' ? (spec.need ? t.needRoll(spec.need, percent) : t.impossible) : spec.kind === 'space' ? t.spaceNeed(spec.max ?? 0, percent) : t.realignRule;
      const dice = spec.dice.map((d) => ({ d, die: makeDie(d.side) }));
      const seat = (x: (typeof dice)[number], i: number): string =>
        `<div class="sp-seat ${sideCls(x.d.side)}" data-i="${i}"><span class="sp-seat-who">${sideName(x.d.side)}</span><div class="sp-diebox"></div><b class="sp-num"></b>` +
        `<div class="sp-mods">${x.d.mods.map((m) => `<span>${m.n < 0 ? '−' : '+'}${Math.abs(m.n)} ${esc(m.label)}</span>`).join('') || `<span>${t.noMods}</span>`}</div><b class="sp-total"></b></div>`;
      const stage = el('div', `sp-dice k-${spec.kind}${versus ? ' is-versus' : ''} ${sideCls(side)}${country ? ' has-situation' : ''}`);
      stage.innerHTML =
        displayText('<i class="sp-bar top"></i><i class="sp-bar bottom"></i>' +
        `<div class="sp-dice-head"><span>${sideName(side)}</span><b>${head}</b><small>${need}</small></div>` +
        `<div class="sp-seats">${dice.map(seat).join(`<i class="sp-vs">${t.versus}</i>`)}</div><div class="sp-math"></div><div class="sp-verdict"></div>`);
      if (country) {
        const s = spec.situation;
        const control = (side: SideIndex | null): string => side === null ? (i18n("尚未控制")) : i18n("{0}控制", [sideName(side)]);
        const before = s?.before ?? country.influence;
        stage.insertAdjacentHTML('beforeend', i18n("<div class=\"sp-country\" data-country=\"{0}\"><div class=\"sp-country-meta\"><span>{1}</span><span>{2} · {3} <b>{4}</b></span></div><h3>{5}</h3><div class=\"sp-country-influence\">{6}</div><div class=\"sp-country-control\"><span>{7}</span>{8}</div>{9}</div>", [country.id, displayText('当前局势'), country.key ? (displayText('战场国')) : (displayText('非战场国')), displayText('稳定度'), country.stability, esc(country.name), ([0,1] as SideIndex[]).map(side=>`<div class="${sideCls(side)}"><span>${esc(sideName(side))}</span><b>${before[side]}</b>${s ? `<i class="sp-after">→</i><strong class="sp-after">${s.after[side]}</strong>` : ''}</div>`).join(''), esc(control(s?.controlBefore ?? country.controller)), s ? `<span class="sp-after">→ ${esc(control(s.controlAfter))}</span>` : '', s && s.crisisBefore !== s.crisisAfter ? `<small class="sp-country-crisis">DEFCON ${s.crisisBefore}<span class="sp-after"> → ${s.crisisAfter}</span></small>` : '']));
      }
      layer.appendChild(stage);
      const seatEl = (i: number): HTMLElement => stage.querySelector<HTMLElement>(`.sp-seat[data-i="${i}"]`)!;
      dice.forEach((x, i) => {
        // out of sight until it is thrown in from the side
        x.die.el.style.visibility = 'hidden';
        seatEl(i).querySelector('.sp-diebox')!.appendChild(x.die.el);
      });
      veil.show(country ? 0.42 : 0.92);
      // two frames, so that the bars start from nothing
      requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.add('is-in')));
      await wait(850);
      await Promise.all(
        dice.map(async (x, i) => {
          if (i) await wait(420);
          // thrown from the roller's side of the table: it lands, bounces, rolls on and tips over.
          // The screen takes each knock; the number is struck when the die falls flat.
          await x.die.throw(x.d.value, {
            ms: 2400,
            from: x.d.side === 0 ? { x: -1, y: 0.42 } : { x: 1, y: -0.42 },
            reach: dice.length > 1 ? 3.4 : 4.3,
            onImpact: (k) => {
              if (fx.dead) return;
              sound('dice', undefined, [1, .65, .38, .55][k] ?? .4);
              if (k < 3) return fx.shake(container, [8, 4, 2][k], 240);
              const s = seatEl(i);
              s.querySelector('.sp-num')!.textContent = displayText(String(x.d.value));
              s.classList.add('is-landed');
              fx.shake(container, 5, 320);
            },
          });
        }),
      );
      await wait(520);
      const math = stage.querySelector('.sp-math')!;
      if (spec.kind === 'coup' || spec.kind === 'check') {
        const d = spec.dice[0];
        // each term is a piece of its own, so that the sum is built up one point at a time
        const formula = `<span><b>${d.value}</b>${d.mods.map(m => `<span class="sp-term"><i> ${m.n < 0 ? '−' : '+'} </i>${esc(m.label)} <b>${Math.abs(m.n)}</b></span>`).join('')}<span class="sp-term"><i> = </i><b class="sum">${d.total}</b></span></span>`;
        math.innerHTML = displayText(formula + (spec.kind === 'check'
          ? `<span class="sp-term"><em>${displayText('成功范围')}</em><b class="bar">${spec.range?.[0]}–${spec.range?.[1]}</b></span>`
          : `<span class="sp-term"><em>${t.versus}</em>${spec.bar?.label ?? ''}<i> = </i><b class="bar">${spec.bar?.n ?? ''}</b></span>`));
        math.classList.add('is-building');
        stage.classList.add('is-read');
        await wait(260);
        const struck = seatEl(0).querySelector('.sp-num')!;
        for (const [i, term] of [...math.querySelectorAll<HTMLElement>('.sp-term')].entries()) {
          const mod = d.mods[i];
          // a point added: a tracer from the die to where it is written; the sum and what it is up against just arrive
          if (mod) await impact.point(struck, term, i, mod.n >= 0);
          term.classList.add('on');
          await wait(mod ? 170 : 220);
        }
      } else if (versus) {
        math.innerHTML = displayText(`<b class="a">${spec.dice[0].total}</b><em>${t.versus}</em><b class="b">${spec.dice[1]?.total ?? ''}</b>`);
        // the points each side adds come in one at a time, turn about, and the totals climb
        const sum = dice.map((x) => x.d.value);
        const totals = dice.map((_, i) => seatEl(i).querySelector<HTMLElement>('.sp-total')!);
        const lines = dice.map((_, i) => [...seatEl(i).querySelectorAll<HTMLElement>('.sp-mods > span')]);
        totals.forEach((el, i) => (el.textContent = displayText(String(sum[i]))));
        const most = Math.max(...dice.map((x) => x.d.mods.length));
        if (most) {
          stage.classList.add('is-counting');
          await wait(260);
          let n = 0;
          for (let k = 0; k < most; k++) {
            for (const [i, x] of dice.entries()) {
              const mod = x.d.mods[k];
              if (!mod || !lines[i][k]) continue;
              await impact.point(lines[i][k], totals[i], n++, mod.n >= 0);
              lines[i][k].classList.add('on');
              sum[i] += mod.n;
              totals[i].textContent = displayText(String(sum[i]));
              totals[i].animate([{ transform: 'scale(1.4)' }, { transform: 'scale(1)' }], { duration: 200, easing: 'cubic-bezier(.3,1.6,.5,1)' });
              await wait(170);
            }
          }
        }
        totals.forEach((el, i) => (el.textContent = displayText(String(dice[i].d.total))));
        stage.classList.add('is-read');
      } else {
        math.innerHTML = displayText(`<b>${spec.dice[0].value}</b><em>${t.needs}</em><b class="bar">1–${spec.max ?? ''}</b>`);
        stage.classList.add('is-read');
      }
      await wait(versus || spec.kind === 'space' ? 520 : 300);
      const tone = versus ? (spec.winner === null || spec.winner === undefined ? 'even' : spec.winner === player ? 'good' : 'bad') : spec.ok === (spec.by === player) ? 'good' : 'bad';
      // whoever won fires on what it beat: the other die, or the number a single die had to beat
      if (versus) {
        const won = dice.find((x) => x.d.side === spec.winner);
        const lost = dice.find((x) => won && x !== won);
        if (won && lost) await impact.fire(won.die.el, lost.die.el, lost.d.side);
      } else if (spec.ok) {
        const bar = math.querySelector<HTMLElement>('b.bar');
        if (bar) await impact.fire(dice[0].die.el, bar, null);
      }
      stage.querySelector('.sp-verdict')!.textContent = displayText(spec.text);
      stage.classList.add('is-done', tone);
      audio?.duck(1800);
      if (spec.kind === 'coup') sound(spec.ok ? 'coup' : 'coup-fail', spec.id);
      else if (spec.kind === 'realign') sound('realign', spec.id);
      // A successful launch sounds when the marker advances in step().
      if (tone === 'bad') fx.shake(container, 5, 300);
      await wait(1500);
      stage.classList.add('is-out');
      veil.hide();
      await wait(480);
      stage.remove();
    },

    async score(report): Promise<void> {
      busy(true);
      hand.away(true);
      await clearScene();
      sub.clear();
      veil.hide();
      scored = await showScoring({ report, host, layer, board, fx, keys, hit, sound: (cue) => sound(cue) });
    },

    /* ---- a card an effect moves: the motion says it, the battle log keeps the words */
    async cardMove(move, commit): Promise<void> {
      busy(true);
      hud.cancelHandDrag();
      veil.hide();
      const committed = await hud.moveCard(move, commit, host.pace ?? 1);
      if (fx.dead) throw ABORTED;
      if (!committed) hud.commitCardChange(commit);
    },

    /* ---- one consequence */
    async step(e: Effect, commit: () => void, cause: Cause): Promise<void> {
      busy(true);
      // the points of a scoring were counted into the score as the scoring was shown: this only makes it so
      const seen = scored;
      scored = null;
      if (seen && e.t === 'vp' && e.to === seen.to) return commit();
      const d = describe(e);
      if (e.t === 'inf') {
        await focusCountry(e.id);
        sub.set({ main: name(e.id), small: `${t.influence(sideName(e.side))} ${d.short}${d.took ? `<em class="gold">${d.took}</em>` : ''}`, side: e.side });
        await wait(380);
        slam(e.id, d.short, d.cls);
        await wait(240);
        // a coup that leaves the other side with nothing there breaks its number to pieces; anything else just changes
        if (cause.verb === 'coup' && e.side !== cause.by && e.from > 0 && e.to === 0) await impact.shatter(e.id, e.side, commit);
        else commit();
        sound(e.d > 0 ? 'influence' : 'remove', e.id);
        if (e.ctrlTo !== null && e.ctrlTo !== e.ctrlFrom) {
          sound('control', e.id, .65);
          // whoever comes to control the country by this has its plinth set down hard
          void impact.control(e.id, e.ctrlTo).catch(() => {});
        }
        board.ring(e.id, d.cls);
        if (d.took) board.pop(e.id, d.took, 'gold late');
        // what the opponent changed stays marked until the player's next card
        if (cause.by === 1) board.badge(e.id, 'last', d.short, d.cls);
        await wait(1250);
      } else if (e.t !== 'note' && d.meter) {
        sub.clear();
        const pane = await bringPane(d.meter);
        const label = e.t === 'crisis' ? t.crisis : e.t === 'milops' ? t.milops(sideName(e.side)) : e.t === 'vp' ? t.vp : t.verb.space;
        const big = e.t === 'vp' ? `${sideName(e.side)} <i>+</i>${e.d}` : e.t === 'space' ? `${sideName(e.side)} <i>→</i> ${t.spaceTo(e.to)}` : `${e.from} <i>→</i> ${e.to}`;
        // who caused it, when it was a move and not a card's own text
        const who = cause.verb !== 'event' ? sideName(cause.by) : '';
        const cap = el('div', `sp-cap ${d.cls} t-${e.t}`, `<span>${label}</span><b>${big}</b><small>${t.join(who, d.why)}</small>`);
        layer.appendChild(cap);
        await wait(520);
        commit();
        if (e.t === 'vp') sound('vp');
        else if (e.t === 'space') { audio?.duck(2400); sound('space'); }
        if (e.t === 'crisis' && e.d < 0) {
          audio?.duck(2000);
          sound('crisis');
          if (pane) fx.shake(pane, 8, 460);
          const alarm = el('i', 'sp-alarm');
          layer.appendChild(alarm);
          fx.later(() => alarm.remove(), 1500);
        }
        await wait(e.t === 'crisis' ? 2000 : 1350);
        cap.classList.add('is-out');
        fx.later(() => cap.remove(), 350);
      } else if (e.t === 'note' && cause.verb === 'event') {
        // An event that only has something to say. Its card is the small one on the table: while a
        // card is being carried out none is held up in the middle, only its name and the words.
        await clearScene();
        sub.clear();
        commit();
        await title({ kicker: t.sideEvent(sideName(cause.by)), main: t.cardName(game.card(cause.card).title), small: e.text, side: cause.by, ms: 1700, dark: 0.7 });
      } else if (e.t === 'note') {
        if (e.id) await focusCountry(e.id);
        sub.set({ main: e.text, small: '', side: null });
        if (e.id) board.pop(e.id, '—', 'note');
        commit();
        await wait(1300);
      }
    },

    async trigger(play: Play): Promise<void> {
      await clearScene();
      sound('passive');
      sub.clear();
      busy(true);
      await title({ kicker: t.fires(sideName((1-play.by) as SideIndex)), main: t.cardName(play.card.title), small: t.firesSmall, side: (1-play.by) as SideIndex, ms: 1500 });
    },

    async settle(play: Play): Promise<void> {
      await clearScene();
      sub.clear();
      board.big(null);
      board.mark(null);
      if (play.cancelled) {
        sound('return');
        hand.away(false);
        await hud.settleResolving(play);
        return;
      }
      board.restView();
      // Hand-offs already have one journey in settleResolving; do not replay a transfer screen.
      if (!play.transfer) await wait(450);
      hand.away(false);
      await hud.settleResolving(play);
    },

    skip(): void {
      audio?.silenceEffects();
      fx.skip();
      hud.skipCardMotion();
    },

    dispose(): void {
      if (fx.dead) return;
      hud.cancelHandDrag();
      hud.holdHeadline(null);
      hud.resetCardMotion();
      audio?.silenceEffects();
      fx.dispose();
      window.removeEventListener('keydown', onKey);
      keyStack.length = 0;
      veil.dispose();
      impact.dispose();
      board.dispose();
      if (scene.pane) {
        scene.pane.style.transform = '';
        scene.pane.classList.remove('sp-abroad');
      }
      hud.setStatusSpotlight(false);
      hud.setHandAvailability(null);
      hud.root.classList.remove('play-on', 'play-away', 'play-wait', 'play-readonly', 'play-card-turn');
      for (const v of TINTS) container.style.removeProperty(`--play${v.slice(1)}`);
      layer.remove();
    },
  };
}
