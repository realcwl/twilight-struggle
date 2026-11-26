import { translateDictionary, text as displayText } from '../i18n/index.js';
// How an area is scored, shown: a slip of paper printed under the score in the HUD.
//
// It is printed a line at a time, so that the sum can be followed: what each standing is worth, then
// for each side its standing, the two numbers that standing comes from, every country that adds a
// point (the point leaves that country on the map and lands on its line) and its total; then the two
// totals set against each other and what is left. That result is struck off the slip, thrown into the
// score, and counted in a point at a time. Then the slip stays, whole, until the player presses 继续.
//
// The slip itself is short. What is behind it is one layer further in each time: a rules word under
// the pointer shows the game's own explanation of it; a country's name shows that country and brings
// the map to it; each side's 明细 opens the reason for its standing and the full list of its countries.
// The words are marked the way the cards mark them (src/cards/terms.js), so the explanations are the
// cards' own (src/cards/tooltips.js).
//
// All numbers arrive in the report from the rules (Match.scoring); nothing here decides anything. The
// score is only shown: the rules apply it afterwards, and the step that does so is told (by what this
// returns) that it has been seen already.
import type { SoundCue } from '../audio/cues';
import { esc } from '../cards/terms.js';
import { installTermHelp } from '../cards/tooltips.js';
import { BATTLE_GLYPH } from '../map/battleMark';
import type { Board } from './board';
import type { Fx } from './fx';
import type { ImpactSound } from './impactSound';
import { STANDING_TERM, leadText, scoringSheets, type ScoredCountry as Country, type ScoringSheet } from './scoringSheet';
import type { PlayHost, ScoringReport, SideIndex } from './types';
import './scoring.css';

/** The score this showed the HUD, for the step that applies it; null when no score was shown (a win by control). */
export type Scored = { to: number } | null;

/** How long each kind of line is given before the next one (ms at pace 1). A click or the space bar cuts all of it short. */
const PACE = {
  /** The heading: which area, and what each standing is worth. */
  head: 500,
  /** A side's standing. */
  standing: 380,
  /** Where the standing comes from. */
  why: 420,
  /** After a country's point has landed on its line. */
  country: 60,
  /** A side's total, and the breath after it. */
  sum: 520,
  /** The two totals set against each other. */
  offset: 480,
  /** The result, before it is struck off and sent to the score. */
  result: 380,
};
const OUT = 'cubic-bezier(.2,.8,.2,1)';
const IN = 'cubic-bezier(.55,0,1,.55)';
const BACK = 'cubic-bezier(.3,1.6,.5,1)';
const INOUT = 'cubic-bezier(.5,0,.2,1)';

type Pt = { x: number; y: number };
type Sheet = ScoringSheet & { short: string };

const WORDS = {
  zh: {
    scoring: '计分', final: '最终计分', presence: '存在', domination: '支配', control: '控制', wins: '直接获胜', win: '胜',
    noTiers: '逐国计分，没有档位',
    holds: (n: number) => `控制 <b>${n}</b> 国`, keys: '战场国', more: '明细', nothing: '没有控制任何国家',
    adjacent: '邻', adjacentWhy: '与对手的超级大国相邻：再加 1 分', excluded: '本次不计',
    sum: '小计', offset: '两边相抵', net: (who: string) => `${who} 净得`, even: '双方抵消',
    europe: (who: string) => `${who} 控制欧洲`,
    vp: '胜利点', unchanged: '不变',
    go: '继续', space: '空格', hint: '带虚线的词和国家，移上去看解释',
    flip: '反超', flipped: '被反超',
    label: (area: string) => `${area}计分`,
    stop: '。', seeTerm: '查看解释', seeCountry: '查看地图局势',
  },
  en: {
    scoring: 'Scoring', final: 'Final scoring', presence: 'Presence', domination: 'Domination', control: 'Control', wins: 'wins the game', win: 'WIN',
    noTiers: 'Scored country by country, no standings',
    holds: (n: number) => `Holds <b>${n}</b>`, keys: 'BGs', more: 'More', nothing: 'Controls no country',
    adjacent: 'adj', adjacentWhy: 'Borders the other superpower: 1 more', excluded: 'not counted',
    sum: 'Subtotal', offset: 'Set against each other', net: (who: string) => `${who} gains`, even: 'They cancel',
    europe: (who: string) => `${who} controls Europe`,
    vp: 'Victory points', unchanged: 'unchanged',
    go: 'Continue', space: 'Space', hint: 'Point at a dotted word or a country for more',
    flip: 'Lead taken', flipped: 'Lead lost',
    label: (area: string) => `${area} scoring`,
    stop: '.', seeTerm: 'explanation', seeCountry: 'on the map',
  },
 es: translateDictionary({
    scoring: '计分', final: '最终计分', presence: '存在', domination: '支配', control: '控制', wins: '直接获胜', win: '胜',
    noTiers: '逐国计分，没有档位',
    holds: (n: number) => `控制 <b>${n}</b> 国`, keys: '战场国', more: '明细', nothing: '没有控制任何国家',
    adjacent: '邻', adjacentWhy: '与对手的超级大国相邻：再加 1 分', excluded: '本次不计',
    sum: '小计', offset: '两边相抵', net: (who: string) => `${who} 净得`, even: '双方抵消',
    europe: (who: string) => `${who} 控制欧洲`,
    vp: '胜利点', unchanged: '不变',
    go: '继续', space: '空格', hint: '带虚线的词和国家，移上去看解释',
    flip: '反超', flipped: '被反超',
    label: (area: string) => `${area}计分`,
    stop: '。', seeTerm: '查看解释', seeCountry: '查看地图局势',
  }, 'es') };

export async function showScoring({ report: r, host, layer, board, fx, keys, hit, sound }: {
  report: ScoringReport; host: PlayHost; layer: HTMLElement; board: Board; fx: Fx;
  /** Key handlers that live until the returned function is called (keys as KeyboardEvent.key, lower case). */
  keys(map: Record<string, () => void>): () => void;
  /** The sounds of a hit, or null when there is no sound. */
  hit: ImpactSound | null;
  /** One of the game's cues. */
  sound(cue: SoundCue): void;
}): Promise<Scored> {
  const w = WORDS[host.lang];
  const pace = host.pace ?? 1;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // A stage run faster than anyone can read is run by a script (the test suites): nobody is there to press 继续.
  const unattended = pace <= 0.1;
  const player = (host.player ?? 0) as SideIndex;
  const cl = (s: number): string => (s === 0 ? 'a' : 'b');
  const rem = (n: number): number => n * parseFloat(getComputedStyle(document.documentElement).fontSize);
  const clamp = (n: number, a: number, b: number): number => Math.min(b, Math.max(a, n));
  const names = ([0, 1] as const).map((s) => host.game.sideName(s));
  const short = (name: string): string => (host.lang === 'zh' ? [...name][0] : name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase());

  // ---------------------------------------------------------------- the numbers, laid out to be printed
  const where = new Map(host.map.pack.countries.map((c) => [c.id, c.node]));
  const sheets: Sheet[] = scoringSheets(r, { lang: host.lang, sideName: (s) => names[s], countryName: (id) => host.game.country(id).name, x: (id) => where.get(id)?.[0] ?? 0 }).map((sheet) => ({ ...sheet, short: short(sheet.name) }));
  const delta = r.totals[0] - r.totals[1];
  const gainer: SideIndex | null = delta === 0 ? null : delta > 0 ? 0 : 1;
  const net = Math.abs(delta);
  const vpAfter = r.vpBefore + delta;
  /** How much this result is worth feeling: 1 at six points, never nothing, never endless. */
  const weight = r.winner !== null ? 1.6 : clamp(net / 6, 0.45, 1.6);
  const lead = (vp: number): string => leadText(vp, names, host.lang);

  // ---------------------------------------------------------------- what things are made of
  const TERM_GROUP: Record<string, string> = { battleground: 'influence' };
  /** A rules word, marked as the cards mark it: under the pointer it shows the game's explanation. */
  const term = (id: string, label: string): string => `<span class="game-term term-${TERM_GROUP[id] ?? 'scoring'}" data-term="${id}" tabindex="0" role="button" aria-label="${esc(label)}：${w.seeTerm}">${esc(label)}</span>`;
  /** A country's name: under the pointer it shows the country and brings the map to it. */
  const named = (k: Country): string => `<span class="game-term game-ref term-influence" data-country-ref="${k.id}" tabindex="0" role="button" aria-label="${esc(k.name)}：${w.seeCountry}">${esc(k.name)}</span>`;
  const rifles = `<i class="sc-rifles">${BATTLE_GLYPH}</i>`;
  const sd = (s: Sheet): string => `<i class="sc-sd ${cl(s.side)}">${esc(s.short)}</i>`;

  const made = new Set<HTMLElement>();
  const box = (): DOMRect => layer.getBoundingClientRect();
  const mk = (cls: string, html = '', style: Partial<CSSStyleDeclaration> = {}): HTMLElement => {
    const n = fx.el('div', cls, html);
    Object.assign(n.style, style);
    layer.appendChild(n);
    made.add(n);
    return n;
  };
  const drop = (n: HTMLElement): void => {
    made.delete(n);
    n.remove();
  };
  const sub = (parent: Element, cls: string, html = ''): HTMLElement => {
    const n = fx.el('div', cls, html);
    parent.appendChild(n);
    return n;
  };
  /** A point of the screen, as the layer places things. */
  const at = (p: Pt): { left: string; top: string } => ({ left: `${p.x - box().left}px`, top: `${p.y - box().top}px` });
  const mid = (el: Element): Pt => {
    const b = el.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  };

  // ---------------------------------------------------------------- time: paced, cut short, cut off
  /** The player has seen enough of the sum: what is left of it is run through at once. */
  let rushed = false;
  /** The slip is complete and waits for the player. */
  let waiting = false;
  const ms = (n: number): number => Math.max(1, (rushed ? n * 0.06 : n) * pace);
  const play = (el: Element, frames: Keyframe[], n: number, opts: KeyframeAnimationOptions = {}): Animation => el.animate(frames, { duration: ms(n), easing: OUT, fill: 'both', ...opts });
  const pause = async (n: number): Promise<void> => {
    if (rushed) return fx.wait(n * 0.05);
    const since = performance.now();
    await fx.wait(n);
    // a pause that ended long before its time was cut short (the space bar): enough, show the result
    if (n * pace > 80 && performance.now() - since < n * pace * 0.5) rushed = true;
  };
  const after = (a: Animation, fn: () => void): void => void a.finished.then(fn, () => undefined);

  // ---------------------------------------------------------------- on the map
  const pulse = (id: string, side: SideIndex): void => {
    board.ring(id, cl(side));
    if (still) return;
    host.container.querySelector(`.wm-plate[data-id="${id}"] .wm-plate-body`)?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.16)', offset: 0.3 }, { transform: 'scale(1)' }], { duration: 300 * pace, composite: 'add' });
  };
  /** A side's countries answer one after another. */
  const wave = (list: readonly Country[], side: SideIndex, gap: number): void => list.forEach((c, i) => fx.later(() => pulse(c.id, side), (rushed ? 0 : i * gap) * pace));
  /** Thrown from one point to another along a low arc. */
  const fly = async (el: HTMLElement, from: Pt, to: Pt, n: number, o: { lift?: number; scale?: [number, number]; ease?: string; trail?: string } = {}): Promise<void> => {
    const [s0, s1] = o.scale ?? [1, 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lift = o.lift ?? Math.min(80, Math.hypot(dx, dy) * 0.18);
    const pose = (k: number): string => `translate(-50%, -50%) translate(${(dx * k).toFixed(1)}px, ${(dy * k - Math.sin(k * Math.PI) * lift).toFixed(1)}px) scale(${(s0 + (s1 - s0) * k).toFixed(3)})`;
    play(el, [0, 0.25, 0.5, 0.75, 1].map((k) => ({ transform: pose(k), offset: k })), n, { easing: o.ease ?? INOUT });
    // what it leaves behind on the way: light that stays for a moment where it has been
    if (o.trail && !still && !rushed) {
      for (let i = 1; i <= 7; i++) {
        const k = i / 8;
        const size = rem(2.6) * (s0 + (s1 - s0) * k);
        const dot = mk(`sc-at sc-trail ${o.trail}`, '', { ...at({ x: from.x + dx * k, y: from.y + dy * k - Math.sin(k * Math.PI) * lift }), width: `${size}px`, height: `${size}px` });
        // the flight eases in: it is at k of the way after about the square root of k of the time
        after(play(dot, [{ opacity: 0 }, { opacity: 0.85, offset: 0.12 }, { opacity: 0, transform: 'translate(-50%, -50%) scale(.2)' }], 360, { delay: ms(n * Math.sqrt(k)), easing: 'ease-out' }), () => drop(dot));
      }
    }
    await pause(n);
  };
  /** A country's points leave it on the map and fly to where they are written. */
  const pip = async (k: Country, side: SideIndex, target: () => Pt): Promise<void> => {
    pulse(k.id, side);
    const from = board.rect(k.id);
    if (!from || still || rushed) return pause(still ? 160 : 0);
    const start = { x: from.left + from.width / 2, y: from.top - rem(0.6) };
    const chip = mk(`sc-at sc-pip ${cl(side)}`, `+${k.pts}`, at(start));
    play(chip, [{ opacity: 0, transform: 'translate(-50%, 10%) scale(.5)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1.15)' }], 130, { easing: BACK });
    await pause(130);
    await fly(chip, start, target(), 230, { scale: [1.15, 0.8] });
    drop(chip);
  };

  // ---------------------------------------------------------------- the blow: what the ending is made of
  const ring = (p: Pt, cls: string, to: number, n = 440, width = 3, delay = 0): void => {
    if (still) return;
    const e = mk(`sc-at sc-ring ${cls}`, '', { ...at(p), width: `${to}px`, height: `${to}px`, borderWidth: `${width}px` });
    after(play(e, [{ opacity: 0.95, transform: 'translate(-50%, -50%) scale(.16)' }, { opacity: 0, transform: 'translate(-50%, -50%) scale(1)' }], n, { delay: ms(delay) }), () => drop(e));
  };
  const sparks = (p: Pt, classes: string[], count: number, reach: number, n = 520, size = 5): void => {
    if (still) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = reach * (0.45 + Math.random() * 0.75);
      const s = size * (0.6 + Math.random() * 0.8);
      const e = mk(`sc-at sc-spark ${classes[i % classes.length]}`, '', { ...at(p), width: `${s}px`, height: `${s}px` });
      after(play(e, [{ opacity: 1, transform: 'translate(-50%, -50%)' }, { opacity: 0, transform: `translate(calc(-50% + ${(Math.cos(a) * d).toFixed(0)}px), calc(-50% + ${(Math.sin(a) * d + 18).toFixed(0)}px)) scale(.3)` }], n * (0.7 + Math.random() * 0.6), { easing: 'cubic-bezier(.1,.7,.3,1)' }), () => drop(e));
    }
  };
  /** One flash of light over everything, and the edges of the screen in the colour of whose moment it is. */
  const light = (cls: string, strength: number): void => {
    if (still) return;
    const f = mk(`sc-flash ${cls}`);
    after(play(f, [{ opacity: 0.14 + 0.13 * strength }, { opacity: 0 }], 260, { easing: 'ease-out' }), () => drop(f));
    const edge = mk(`sc-wash ${cls}`);
    const peak = 0.44 + 0.24 * strength;
    after(play(edge, [{ opacity: 0 }, { opacity: peak, offset: 0.12 }, { opacity: peak * 0.55, offset: 0.5 }, { opacity: 0 }], 1000, { easing: 'linear' }), () => drop(edge));
  };
  const rays = (p: Pt, cls: string, size: number, n: number): void => {
    if (still) return;
    const e = mk(`sc-at sc-rays ${cls}`, '', { ...at(p), width: `${size}px`, height: `${size}px` });
    after(play(e, [{ opacity: 0, transform: 'translate(-50%, -50%) rotate(0deg) scale(.3)' }, { opacity: 0.95, transform: 'translate(-50%, -50%) rotate(9deg) scale(1)', offset: 0.16 }, { opacity: 0.7, offset: 0.6 }, { opacity: 0, transform: 'translate(-50%, -50%) rotate(55deg) scale(1.08)' }], n, { easing: 'linear' }), () => drop(e));
  };
  /** Where the score is shown in the HUD: the folded corner's number, or the full one when the corner is open. */
  const scoreEl = (): HTMLElement => [...host.hud.root.querySelectorAll<HTMLElement>('.hs-vp b, .vp-read .hud-num')].find((e) => e.getClientRects().length > 0) ?? host.hud.root.querySelector<HTMLElement>('.hud-tr') ?? host.hud.root;

  /**
   * The result comes down hard where it was decided: a large chip slammed into place, the frame held,
   * the table shaken, light, the winner's colour at the edges, and the countries that earned it answering
   * together. How hard follows how much was gained. Returns the chip, standing, after a breath.
   */
  const slam = async (from: Pt, side: SideIndex, html: string): Promise<{ chip: HTMLElement; at: Pt }> => {
    const good = side === player;
    const chip = mk(`sc-at sc-net ${cl(side)}`, html, at(from));
    chip.style.setProperty('--m', (0.8 + 0.32 * weight).toFixed(2));
    // wherever it was decided, the result stands inside the screen
    const half = chip.offsetWidth / 2 + rem(1.5);
    const b = box();
    const here = { x: clamp(from.x, b.left + half, b.right - half), y: clamp(from.y, b.top + rem(6), b.bottom - rem(8)) };
    Object.assign(chip.style, at(here));
    play(chip, still ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translate(-50%, -50%) scale(2.9)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }], 140, { easing: IN });
    await pause(140);
    hit?.thud(1 + 0.4 * weight);
    if (weight >= 0.8) hit?.boom(0.35 + 0.2 * weight);
    light(cl(side), weight);
    if (!still) fx.shake(host.container, 2.5 + 5 * weight, (240 + 110 * weight) * pace);
    rays(here, good ? 'gold' : cl(side), rem(24 + 12 * weight), 760 + 90 * weight);
    ring(here, 'white', rem(17 + 12 * weight), 440, 4);
    ring(here, cl(side), rem(11 + 8 * weight), 560, 3, 80);
    sparks(here, good ? [cl(side), 'gold', 'white'] : [cl(side), 'white'], Math.round(12 + 14 * weight), rem(9 + 6 * weight), 680, 6);
    // the countries that earned it answer together
    for (const c of sheets[side].countries) pulse(c.id, side);
    if (!still) play(chip, [{ transform: 'translate(-50%, -50%) scale(1)' }, { transform: 'translate(-50%, -50%) scale(1.08)' }, { transform: 'translate(-50%, -50%) scale(1)' }], 440, { easing: 'ease-in-out', fill: 'none' });
    await pause(250 + 80 * weight);
    return { chip, at: here };
  };

  /**
   * The score takes the result. The corner is struck, then the number counts one point at a time and
   * every point is heard: rising for the seat at this screen, falling for the other side. A lead that
   * changes hands on the way is called out. The last point lands harder than the rest.
   */
  const countIn = async (side: SideIndex): Promise<void> => {
    const good = side === player;
    const dir = Math.sign(vpAfter - r.vpBefore);
    const steps = Math.abs(vpAfter - r.vpBefore);
    const corner = host.hud.root.querySelector<HTMLElement>('.hud-tr');
    if (corner && !still) {
      const c = corner.getBoundingClientRect();
      const glow = mk(`sc-hudglow ${cl(side)}`, '', { left: `${c.left - box().left}px`, top: `${c.top - box().top}px`, width: `${c.width}px`, height: `${c.height}px` });
      after(play(glow, [{ opacity: 1 }, { opacity: 0 }], 500 + 60 * steps, { easing: 'ease-out' }), () => drop(glow));
      fx.shake(corner, 3 + 3 * weight, 260 * pace);
    }
    ring(mid(scoreEl()), cl(side), rem(9 + 5 * weight), 420);
    sparks(mid(scoreEl()), [cl(side), 'white'], Math.round(6 + 6 * weight), rem(5 + 2 * weight), 420, 4);
    hit?.thock(good ? 1.3 : 0.8);
    const lead = (n: number): SideIndex | null => (n > 0 ? 0 : n < 0 ? 1 : null);
    const was = lead(r.vpBefore);
    const gap = clamp(390 / steps, 38, 85);
    for (let i = 1; i <= steps; i++) {
      await pause(gap);
      const now = r.vpBefore + dir * i;
      host.hud.previewVp(now);
      hit?.tick(Math.min(9, i - 1), good);
      const last = i === steps;
      if (!still) scoreEl().animate([{ transform: 'scale(1)' }, { transform: `scale(${last ? 1.85 : 1.3})`, offset: 0.3 }, { transform: 'scale(1)' }], { duration: (last ? 420 : Math.max(90, gap * 1.4)) * pace, easing: last ? BACK : 'ease-out', composite: 'add' });
      if (!last) sparks(mid(scoreEl()), [cl(side)], 2, rem(3), 260, 3);
      // the lead has just changed hands
      if (was !== null && was !== side && lead(now) === side && lead(now - dir) !== side) {
        ring(mid(scoreEl()), 'gold', rem(16), 520, 4);
        hit?.clack(4);
        const p = mid(scoreEl());
        const tag = mk(`sc-at sc-flip ${cl(side)}`, good ? w.flip : w.flipped, at({ x: p.x, y: p.y + rem(5.4) }));
        play(tag, [{ opacity: 0, transform: 'translate(-50%, -50%) scale(.4)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }], 220, { easing: BACK });
        fx.later(() => after(play(tag, [{ opacity: 1 }, { opacity: 0 }], 260, { fill: 'forwards' }), () => drop(tag)), 1150 * pace);
      }
    }
    // and the last point lands
    const p = mid(scoreEl());
    ring(p, 'white', rem(13 + 7 * weight), 560, 4);
    ring(p, cl(side), rem(8 + 5 * weight), 640, 3, 90);
    sparks(p, good ? [cl(side), 'gold', 'white'] : [cl(side), 'white'], Math.round(10 + 12 * weight), rem(7 + 4 * weight), 640, 5);
    sound('vp');
    if (!good && net >= 4) hit?.thud(0.9 + 0.3 * weight);
  };

  // ---------------------------------------------------------------- the slip
  const slip = mk('sp-scoring');
  slip.dataset.helpBeside = '';
  slip.setAttribute('role', 'region');
  slip.setAttribute('aria-label', w.label(r.name[host.lang]));
  const narrow = box().width <= 800;
  const corner = host.hud.root.querySelector<HTMLElement>('.hud-tr')?.getBoundingClientRect();
  // under the score it is about; on a narrow screen the stylesheet docks it at the bottom instead
  if (corner && !narrow) Object.assign(slip.style, { right: `${box().right - corner.right}px`, top: `${corner.bottom - box().top + rem(1.2)}px`, maxHeight: `${box().bottom - corner.bottom - rem(3)}px` });
  const list = sub(slip, 'sc-list');
  let printed = 0;
  /** A line comes out of the slip. */
  const print = (into: Element, cls: string, html: string): HTMLElement => {
    const row = sub(into, cls, html);
    if (!still) play(row, [{ height: '0px', opacity: 0 }, { height: `${row.scrollHeight}px`, opacity: 1 }], 150, { fill: 'none' });
    hit?.clack(printed++ % 6);
    slip.scrollTop = slip.scrollHeight;
    return row;
  };
  // a click anywhere but on the slip, while it prints: enough, show the result
  const onDown = (e: PointerEvent): void => {
    if (waiting || !(e.target instanceof Element) || slip.contains(e.target) || e.target.closest('.term-help')) return;
    rushed = true;
    fx.skip();
  };
  window.addEventListener('pointerdown', onDown, true);
  const release = fx.hold(() => {
    window.removeEventListener('pointerdown', onDown, true);
    for (const n of [...made]) n.remove();
    made.clear();
  });

  /** The slip is whole: it stays until the player says to go on. */
  const untilTold = async (): Promise<void> => {
    const bar = print(slip, 'sc-go', `<span>${w.hint}</span><button type="button" class="sc-continue">${w.go}<kbd>${w.space}</kbd></button>`);
    const button = bar.querySelector<HTMLButtonElement>('.sc-continue')!;
    slip.scrollTop = slip.scrollHeight;
    slip.dataset.state = 'waiting';
    waiting = true;
    rushed = false;
    const told = fx.pending<void>();
    const go = (): void => told.resolve();
    button.addEventListener('click', go, { once: true });
    const offKeys = keys({ ' ': go, enter: go });
    // not out from under somebody who is typing somewhere else
    if (!document.activeElement || document.activeElement === document.body) button.focus({ preventScroll: true });
    if (unattended) fx.later(go, 350);
    try {
      await told.promise;
    } finally {
      offKeys();
    }
    installTermHelp().hide();
    waiting = false;
    slip.dataset.state = 'leaving';
    play(slip, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-1.6rem)' }], 220, { easing: IN });
    await pause(220);
  };

  try {
    // ---- the area is framed: its battlegrounds and what adds points for certain, the rest of what is held
    // from the nearest outwards as long as that does not pull the view back much
    board.mark({ ok: [], keep: r.members });
    const slipBox = slip.getBoundingClientRect();
    const card = host.container.querySelector('.hr-card')?.getBoundingClientRect();
    const b = box();
    const room = narrow
      ? { left: 12, top: rem(5), width: b.width - 24, height: Math.max(120, slipBox.top - b.top - rem(8)) }
      : { left: (card ? card.right - b.left : 0) + rem(4), top: rem(11), width: 0, height: b.height - rem(11) - rem(17) };
    if (!narrow) room.width = Math.max(200, slipBox.left - b.left - rem(4) - room.left);
    const keyIds = r.members.filter((id) => host.game.country(id).key);
    await board.frame(framed(r, sheets, keyIds, where, room.width / room.height), room);

    if (!still) play(slip, [{ opacity: 0, transform: 'translateY(-1rem)' }, { opacity: 1, transform: 'translateY(0)' }], 180);
    slip.dataset.state = 'printing';
    await pause(160);

    // ---- which area, and what each standing is worth
    const worth = r.rule
      ? `${term('presence', w.presence)} ${r.rule.presence} · ${term('domination', w.domination)} ${r.rule.domination} · ${term('region-control', w.control)} ${r.rule.control === 'win' ? w.wins : r.rule.control}`
      : w.noTiers;
    print(list, 'sc-line head', `<b>${r.final ? `<small>${w.final}</small>` : ''}${esc(r.name[host.lang])}${host.lang === 'zh' ? '' : ' '}${term('scoring', w.scoring)}</b><span>${worth}</span>`);
    await pause(PACE.head);

    // ---- each side in turn: its standing, where that comes from, the countries that add to it, its total
    for (const S of sheets) {
      const side = S.side;
      const block = sub(list, `sc-block ${cl(side)}`);
      wave(S.countries, side, 55);
      const worthOf = S.base === 'win' ? w.win : S.ranked ? String(S.base) : S.countries.length ? '' : '0';
      print(block, `sc-line side ${cl(side)}`, `<span>${sd(S)}${esc(S.name)}${S.ranked ? term(STANDING_TERM[S.standing], S.tier) : `<em>${S.tier}</em>`}</span><b>${worthOf}</b>`);
      await pause(PACE.standing);
      if (S.countries.length) {
        // the two numbers a standing comes from; the sentence and the full list are behind 明细
        const why = print(block, `sc-line why ${cl(side)}`, `<span>${w.holds(S.countries.length)}${r.rule ? ` · ${term('battleground', w.keys)} <b>${S.keys}</b>/${r.allKeys}` : ''}</span><button type="button" class="sc-toggle" aria-expanded="false">${w.more}</button>`);
        const more = sub(block, `sc-more ${cl(side)}`, `<p>${S.why}${w.stop}</p><p class="sc-all">${S.countries.map((k) => `<span class="${k.excluded ? 'out' : ''}">${k.key ? rifles : ''}${named(k)}${k.adjacent && k.pts ? `<u title="${w.adjacentWhy}">${w.adjacent}</u>` : ''}${k.excluded ? `<small>${w.excluded}</small>` : ''}</span>`).join('')}</p>`);
        more.hidden = true;
        const toggle = why.querySelector<HTMLButtonElement>('.sc-toggle')!;
        toggle.addEventListener('click', () => {
          more.hidden = !more.hidden;
          toggle.setAttribute('aria-expanded', String(!more.hidden));
          if (more.hidden) return;
          if (!still) play(more, [{ height: '0px', opacity: 0 }, { height: `${more.scrollHeight}px`, opacity: 1 }], 180, { fill: 'none' });
          wave(S.countries, side, 35);
        });
        // pointing at the line points at the countries it counts
        why.addEventListener('pointerenter', () => wave(S.countries, side, 30));
        await pause(PACE.why);
      } else {
        print(block, `sc-line why ${cl(side)}`, `<span class="sc-none">${w.nothing}</span>`);
        await pause(PACE.why * 0.7);
      }
      if (r.winner !== null) continue;
      // every country that adds points: the points leave it on the map and land on its line
      for (const [i, k] of S.scoring.entries()) {
        const row = print(block, `sc-line item ${cl(side)}`, `<span>${k.key ? rifles : ''}${named(k)}${k.adjacent ? `<u title="${w.adjacentWhy}">${w.adjacent}</u>` : ''}</span><b class="sc-amount">+${k.pts}</b>`);
        const amount = row.querySelector<HTMLElement>('.sc-amount')!;
        amount.style.visibility = 'hidden';
        await pip(k, side, () => mid(amount));
        amount.style.visibility = '';
        if (!still) play(amount, [{ transform: 'scale(1.45)' }, { transform: 'scale(1)' }], 200, { easing: BACK, fill: 'none' });
        hit?.tick(Math.min(9, i + side * 2), true);
        await pause(PACE.country);
      }
      const from = S.ranked && typeof S.base === 'number' ? S.base : 0;
      const sum = print(block, `sc-line sum ${cl(side)}`, `<span>${w.sum}</span><b>${rushed || still ? S.total : from}</b>`);
      const total = sum.querySelector('b')!;
      const climb = Math.min(S.total - from, 6);
      for (let i = 1; i <= climb && !rushed && !still; i++) {
        await pause(200 / climb);
        total.textContent = displayText(String(from + Math.round(((S.total - from) * i) / climb)));
      }
      total.textContent = displayText(String(S.total));
      if (!still) play(total, [{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], 220, { easing: BACK, fill: 'none' });
      hit?.thock(1.1);
      await pause(PACE.sum - (climb > 0 ? 200 : 0));
    }
    for (const note of r.notes) print(list, 'sc-line note', `<span>${esc(note[host.lang])}</span>`);

    // ---- a win by control of every battleground is not a sum: it is said, it lands, and the slip waits
    if (r.winner !== null) {
      const foot = sub(slip, `sc-foot ${cl(r.winner)}`, `<span>${w.europe(esc(names[r.winner]))}</span><b class="word">${w.wins}</b>`);
      if (!still) play(foot, [{ height: '0px', opacity: 0 }, { height: `${foot.scrollHeight}px`, opacity: 1 }], 160, { fill: 'none' });
      slip.scrollTop = slip.scrollHeight;
      await pause(PACE.result);
      rushed = false;
      const p = mid(foot);
      const { chip } = await slam({ x: p.x - rem(3), y: p.y }, r.winner, `<small>${esc(names[r.winner])}</small><b class="word">${w.wins}</b>`);
      await pause(520);
      after(play(chip, [{ opacity: 1 }, { opacity: 0 }], 260, { fill: 'forwards' }), () => drop(chip));
      await untilTold();
      return null;
    }

    // ---- the two totals set against each other, and what is left
    print(list, 'sc-line offset', `<span>${w.offset}</span><b>${Math.max(r.totals[0], r.totals[1])} − ${Math.min(r.totals[0], r.totals[1])}</b>`);
    await pause(PACE.offset);
    const foot = sub(slip, `sc-foot ${gainer === null ? 'none' : cl(gainer)}`, gainer === null ? `<span>${w.even}</span><b>±0</b>` : `<span>${w.net(esc(names[gainer]))}</span><b>+${net}</b>`);
    if (!still) {
      play(foot, [{ height: '0px', opacity: 0 }, { height: `${foot.scrollHeight}px`, opacity: 1 }], 160, { fill: 'none' });
      const band = sub(foot, 'sc-sheen');
      after(play(band, [{ transform: 'translateX(-110%)' }, { transform: 'translateX(290%)' }], 380, { easing: 'ease-in-out', delay: ms(140) }), () => band.remove());
    }
    slip.scrollTop = slip.scrollHeight;
    hit?.thud(0.6);
    await pause(PACE.result);

    // ---- the result is struck off the line and goes into the score; the line stays to be read.
    // However much of the sum was skipped, this is seen at its own speed: it is what the sum was for.
    rushed = false;
    const p = mid(foot);
    if (gainer === null) {
      // nothing gained: the two cancel with a dull knock
      hit?.thud(0.7);
      ring(p, 'dull', rem(15), 420, 2);
      sparks(p, ['dull'], 12, rem(7), 520, 5);
      await pause(420);
    } else {
      const { chip, at: here } = await slam({ x: p.x - rem(3), y: p.y }, gainer, `<small>${esc(names[gainer])}</small><b>+${net}</b>`);
      if (still) {
        after(play(chip, [{ opacity: 1 }, { opacity: 0 }], 200, { fill: 'forwards' }), () => drop(chip));
        await pause(200);
      } else {
        await fly(chip, here, mid(scoreEl()), 290, { lift: rem(2), scale: [1, 0.36], ease: IN, trail: cl(gainer) });
        drop(chip);
      }
      await countIn(gainer);
      await pause(150);
    }
    print(slip, 'sc-vp', `<span>${term('vp', w.vp)}</span><b>${gainer === null ? `${w.unchanged} · ${lead(vpAfter)}` : `${lead(r.vpBefore)} → ${lead(vpAfter)}`}</b>`);
    await untilTold();
    return { to: vpAfter };
  } finally {
    release();
    installTermHelp().hide();
    board.mark(null);
    board.restView();
  }
}

/**
 * The countries the view is fitted to. The area's battlegrounds and the countries that add points must
 * be seen. The other controlled countries are taken in from the nearest outwards, as long as that does
 * not pull the view back much: Australia does not make all of Asia small, and a far-off member nobody
 * holds (Canada, for Europe) is not looked for at all.
 */
function framed(r: ScoringReport, sheets: Sheet[], keyIds: string[], where: Map<string, [number, number]>, aspect: number): string[] {
  const held = sheets.flatMap((s) => s.countries);
  const must = new Set([...keyIds, ...held.filter((c) => c.key || c.pts > 0).map((c) => c.id)]);
  if (!must.size) for (const id of held.length ? held.map((c) => c.id) : r.members) must.add(id);
  type B = [number, number, number, number];
  const grow = (b: B | null, id: string): B | null => {
    const node = where.get(id);
    if (!node) return b;
    const [x, z] = node;
    return b ? [Math.min(b[0], x), Math.min(b[1], z), Math.max(b[2], x), Math.max(b[3], z)] : [x, z, x, z];
  };
  const size = (b: B): number => Math.max(b[2] - b[0], (b[3] - b[1]) * aspect);
  let frame = [...must].reduce<B | null>(grow, null);
  if (!frame) return [...must];
  const limit = Math.max(size(frame) * 1.25, 30);
  const centre = [(frame[0] + frame[2]) / 2, (frame[1] + frame[3]) / 2];
  const far = (id: string): number => Math.hypot((where.get(id)?.[0] ?? 0) - centre[0], ((where.get(id)?.[1] ?? 0) - centre[1]) * aspect);
  const ids = [...must];
  for (const c of held.filter((x) => !must.has(x.id)).sort((p, q) => far(p.id) - far(q.id))) {
    const wider = grow(frame, c.id);
    if (wider && size(wider) <= limit) {
      frame = wider;
      ids.push(c.id);
    }
  }
  return ids;
}
