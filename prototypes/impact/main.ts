// Impact: ten sets of "hit feel" for the moments that decide a turn, switchable on the live map.
//
//   1  控制落成   the last point is placed, the country is controlled, its plinth goes under the token
//   2  政变清场   a coup removes every point the other side had: their number (and their plinth) is destroyed
//   3  骰子对决   two dice are thrown, the bonus points come in one by one, and the winning die beats the other
//
// This file stages what is the same in all ten: the map, the situation, the numbers that change, the
// dice (the game's own die), the order and the rhythm. A set (variants.ts) only makes the four hits.
// The page runs the game's map module unchanged and draws everything of its own in two layers over
// and under the tokens. Nothing in src/ knows about this folder.
import '../../src/play/play.css';
import { makeDie } from '../../src/play/dice';
import { WorldMap } from '../../src/map/WorldMap';
import type { MapState, SideIndex } from '../../src/map/types';
import * as kit from './kit';
import { BACK, CANCELLED, IN, boxOf, chip, go, mid, mk, nudge, wait, type Box } from './kit';
import { sfx, setMuted, wake } from './sfx';
import type { Pal, Side, Tok, Variant } from './types';
import { RECOMMENDED, VARIANTS } from './variants';

type Internals = {
  stage: HTMLDivElement;
  rig: { flyToBox(box: [number, number, number, number], opts?: { maxZoom?: number; instant?: boolean }): void };
};
type Moment = 'control' | 'wipe' | 'duel';

const params = new URLSearchParams(location.search);
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
};
const mix = (hex: string, to: number, k: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number): number => Math.round(((n >> s) & 255) + (to - ((n >> s) & 255)) * k);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
};

// ---------------------------------------------------------------- the situation: southern Europe
/** Influence [US, USSR] where the three moments happen and around it. Everything else is empty. */
const BOARD: Record<string, [number, number]> = {
  fra: [3, 0], frg: [4, 1], aut: [1, 0], esp: [1, 0], ita: [1, 0], yug: [2, 3], grc: [0, 2], tur: [1, 0],
  hun: [0, 3], rou: [0, 1], bgr: [0, 3], gdr: [0, 3], pol: [0, 3], cze: [0, 2],
};
const THEATRE = ['fra', 'aut', 'ita', 'yug', 'grc', 'hun', 'rou', 'bgr', 'tur'];
/** What each moment starts from, on top of BOARD. */
const BEFORE: Record<Moment, Record<string, [number, number]>> = {
  control: {},
  wipe: { ita: [2, 0] },
  duel: { ita: [2, 0], grc: [2, 0] },
};

async function start(): Promise<void> {
  const map = await WorldMap.create(document.getElementById('map')!, '/maps/coldwar', { lang: 'zh' });
  const inner = map as unknown as Internals;
  const { pack } = map;
  const { scenario } = pack;
  const stage = inner.stage;
  const platesRoot = stage.querySelector<HTMLElement>('.wm-plates')!;
  const pal: [Pal, Pal] = [0, 1].map((i) => {
    const c = scenario.sides[i].color;
    return { main: c, light: mix(c, 255, 0.45), deep: mix(c, 0, 0.4) };
  }) as [Pal, Pal];
  const sideName = (s: Side): string => scenario.sides[s].name.zh;

  // ---- the board as it is shown: influence, and who controls (derived, unless a moment is holding it back)
  let inf: Record<string, [number, number]> = {};
  const held = new Map<string, SideIndex | null>();
  const stability = new Map(scenario.countries.map((c) => [c.id, c.stability]));
  const controller = (id: string): SideIndex | null => {
    if (held.has(id)) return held.get(id)!;
    const [a, b] = inf[id] ?? [0, 0];
    const need = stability.get(id) ?? 99;
    return a - b >= need ? 0 : b - a >= need ? 1 : null;
  };
  const show = (): void => {
    const state: MapState = { countries: {}, regions: {} };
    for (const c of scenario.countries) state.countries[c.id] = c.superpower !== undefined ? { influence: [0, 0], controller: c.superpower } : { influence: [...(inf[c.id] ?? [0, 0])] as [number, number], controller: controller(c.id) };
    for (const r of scenario.regions) state.regions[r.id] = { status: ['—', '—'] };
    map.setState(state);
  };
  const setBoard = (m: Moment): void => {
    inf = structuredClone({ ...BOARD, ...BEFORE[m] });
    held.clear();
    show();
  };

  const nameOf = new Map(scenario.countries.map((c) => [c.id, c.name.zh]));
  const tok = (id: string): Tok => {
    const root = stage.querySelector<HTMLElement>(`.wm-plate[data-id="${id}"]`)!;
    const body = root.querySelector<HTMLElement>('.wm-plate-body')!;
    const plinth = root.querySelector<HTMLElement>('.wm-plinth');
    return {
      id, name: nameOf.get(id) ?? id, root, body, plinth,
      box: () => boxOf(body),
      cell: (s) => boxOf(root.querySelector(s === 0 ? '.wm-inf.a' : '.wm-inf.b')!),
      base: () => (plinth ? boxOf(plinth) : boxOf(body)),
      at: () => mid(boxOf(body)),
    };
  };
  const near = (of: Tok): { tok: Tok; dist: number }[] => {
    const c = of.at();
    return [...stage.querySelectorAll<HTMLElement>('.wm-plate[data-id]')]
      .filter((n) => n !== of.root && n.style.display !== 'none')
      .map((n) => tok(n.dataset.id!))
      .map((x) => ({ tok: x, dist: Math.hypot(x.at().x - c.x, x.at().y - c.y) }))
      .filter((x) => x.dist < 560)
      .sort((p, q) => p.dist - q.dist);
  };

  // ---- our layers: one under the tokens, one over everything
  const ground = el('div', 'fx-ground');
  stage.insertBefore(ground, platesRoot);
  const top = el('div', 'fx-top');
  document.body.append(top);
  kit.mount({ top, ground, shake: [document.getElementById('map')!, top], zoom: document.getElementById('map')! });

  // ---- which set
  let current: Variant = VARIANTS.find((v) => v.id === (params.get('v') ?? '').padStart(2, '0')) ?? VARIANTS[0];
  let last: Moment | 'all' = 'control';
  let run = 0;
  let slow = params.get('speed') ? Number(params.get('speed')) : 1;
  kit.setSpeed(slow);
  if (params.has('mute')) setMuted(true);

  // ---------------------------------------------------------------- what every set shares
  const caption = el('div', 'im-caption');
  const say = (main: string, small = ''): void => {
    caption.innerHTML = '';
    if (!main) return void caption.classList.remove('on');
    caption.append(el('b', '', main), el('span', '', small));
    caption.classList.add('on');
  };
  /** The digit in a token's cell, shown again large for an instant where it stands: the number changed. */
  const pop = (r: Box, colour: string, text: string, power = 1): void => {
    const c = chip(r, colour, text, { cls: 'im-pop' });
    void go(c, [{ transform: `scale(${1.5 + power * 0.5})` }, { transform: 'scale(1)' }], { ms: 200 + power * 40, ease: BACK }).then(() => c.remove(), () => undefined);
  };
  /** Points put into a country: a chip drops into the cell and the number changes. */
  async function place(target: Tok, side: Side, add: number, i = 0): Promise<void> {
    const r = target.cell(side);
    const p = mid(r);
    const c = kit.put('im-plus', { x: p.x, y: p.y - 46 }, 34, 24, { background: pal[side].main });
    c.textContent = `+${add}`;
    await go(c, [{ transform: 'translateY(-26px) scale(1.3)', opacity: 0 }, { transform: 'translateY(0) scale(1.3)', opacity: 1, offset: 0.45 }, { transform: 'translateY(46px) scale(.7)', opacity: 1 }], { ms: 330, ease: IN });
    c.remove();
    const before = controller(target.id);
    inf[target.id][side] += add;
    held.delete(target.id);
    // the number changes now; if that makes for control, it is the set's to announce: hold it back
    if (controller(target.id) === side && before !== side) held.set(target.id, before);
    show();
    pop(target.cell(side), pal[side].main, String(inf[target.id][side]));
    current.tap(mid(target.cell(side)), pal[side], i, 1);
    void nudge(target.root, [{ transform: 'translateY(0)' }, { transform: 'translateY(3px)', offset: 0.3 }, { transform: 'translateY(0)' }], 160);
  }
  /** The set's first moment, for whoever now controls `id`. */
  async function crown(target: Tok, side: Side): Promise<void> {
    await current.control({
      tok: target, side, pal: pal[side], near: near(target),
      commit: () => {
        held.delete(target.id);
        show();
      },
    });
    // whatever the set did, the board is right afterwards
    held.delete(target.id);
    show();
  }

  // ---------------------------------------------------------------- 1 · 控制落成
  async function playControl(): Promise<void> {
    const ita = tok('ita');
    say('放置影响力 · 意大利', '稳定度 2：美国放到 2 点，达成控制');
    await wait(650);
    await place(ita, 0, 1);
    await wait(300);
    await crown(ita, 0);
    await wait(900);
  }

  // ---------------------------------------------------------------- 2 · 政变清场
  async function playWipe(): Promise<void> {
    const grc = tok('grc');
    say('政变 · 希腊', '苏联控制着希腊（2 点）。美国用 3 点行动点发动政变');
    await wait(600);
    // the sum, said quickly: the die is the third moment's business
    const strip = mk('im-strip');
    const terms: [string, string, string][] = [['骰', '5', ''], ['行动点', '+3', 'a'], ['稳定度 ×2', '−4', 'b'], ['', '= 4', 'sum']];
    for (let i = 0; i < terms.length; i++) {
      const [label, value, cls] = terms[i];
      const t = el('div', `im-term ${cls}`);
      t.append(el('b', '', value), el('span', '', label));
      strip.append(t);
      if (cls === 'sum') {
        await wait(120);
        sfx.ding(3);
        current.tap(mid(boxOf(t)), pal[0], 4, 2);
      } else sfx.tick(i);
      void go(t, [{ opacity: 0, transform: 'translateY(10px) scale(1.25)' }, { opacity: 1, transform: 'none' }], { ms: 200, ease: BACK });
      await wait(cls === 'sum' ? 420 : 190);
    }
    const cell = grc.cell(1);
    const base = grc.base();
    await current.wipe({
      tok: grc, loser: 1, pal: pal[1], by: pal[0], cell, base, digit: String(inf.grc[1]), hadControl: controller('grc') === 1,
      commit: () => {
        inf.grc[1] = 0;
        held.delete('grc');
        show();
      },
    });
    inf.grc[1] = 0;
    held.delete('grc');
    show();
    await wait(380);
    say('政变 · 希腊', '苏联被清空。余下的 2 点成为美国影响力：美国控制希腊');
    await place(grc, 0, 2, 2);
    await wait(280);
    await crown(grc, 0);
    void go(strip, [{ opacity: 1 }, { opacity: 0 }], { ms: 300 }).then(() => strip.remove(), () => undefined);
    await wait(900);
  }

  // ---------------------------------------------------------------- 3 · 骰子对决
  async function playDuel(): Promise<void> {
    const yug = tok('yug');
    say('调整阵营 · 南斯拉夫', '双方各掷一骰，再加上各自的加成：相邻的受控国，在该国影响力占优');
    await wait(500);
    const panel = mk('im-duel');
    const seats = ([0, 1] as Side[]).map((side) => {
      const seat = el('div', `im-seat ${side === 0 ? 'a' : 'b'}`);
      const box = el('div', 'im-diebox');
      const die = makeDie(side);
      die.el.style.visibility = 'hidden';
      box.append(die.el);
      const total = el('b', 'im-total', '');
      const mods = el('div', 'im-mods');
      seat.append(el('span', 'im-who', sideName(side)), box, total, mods);
      panel.append(seat);
      return { side, seat, die, total, mods, sum: 0 };
    });
    panel.insertBefore(el('i', 'im-vs', 'VS'), seats[1].seat);
    void go(panel, [{ opacity: 0, transform: 'translate(-50%, 16px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { ms: 240 });
    await wait(260);

    // the throw: the game's own die
    const rolled: [number, number] = [5, 3];
    const bang = (side: Side) => (i: number): void => {
      sfx.die(i);
      if (i === 0) kit.shake(2.5, 140, 'y');
      const p = mid(boxOf(seats[side].die.el));
      if (i < 2) kit.ring({ x: p.x, y: p.y + 30 }, { to: 110 - i * 30, color: 'rgba(255,255,255,.5)', width: 2, ms: 260, squash: 0.4 });
    };
    await Promise.all(seats.map((s, i) => wait(i * 120).then(() => s.die.throw(rolled[s.side], { from: { x: s.side === 0 ? -1 : 1, y: 0.55 }, ms: kit.t(1500), reach: 3.4, lift: 1.05, onImpact: bang(s.side) }))));
    const setTotal = (s: (typeof seats)[number], v: number, power = 1): void => {
      s.sum = v;
      s.total.textContent = String(v);
      void go(s.total, [{ transform: `scale(${1.3 + power * 0.25})` }, { transform: 'scale(1)' }], { ms: 220, ease: BACK });
    };
    seats.forEach((s) => setTotal(s, rolled[s.side]));
    sfx.tick(0);
    await wait(520);

    // the bonus points, one at a time, on a beat
    const bonuses: { side: Side; label: string; src: string | null }[] = [
      { side: 1, label: '邻国 匈牙利', src: 'hun' },
      { side: 1, label: '影响力占优', src: null },
      { side: 0, label: '邻国 意大利', src: 'ita' },
      { side: 0, label: '邻国 希腊', src: 'grc' },
    ];
    const count: [number, number] = [0, 0];
    for (let i = 0; i < bonuses.length; i++) {
      const b = bonuses[i];
      const s = seats[b.side];
      const src = b.src ? tok(b.src) : null;
      // the beat before the point that settles it is a little longer
      await wait(i === bonuses.length - 1 || (i > 0 && bonuses[i - 1].side !== b.side) ? 300 : 110);
      let landed = false;
      const land = (): void => {
        if (landed) return;
        landed = true;
        setTotal(s, s.sum + 1, 1 + i * 0.25);
        const tag = el('span', 'im-mod', `+1 ${b.label}`);
        s.mods.append(tag);
        void go(tag, [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { ms: 180 });
      };
      if (src) void nudge(src.root, [{ transform: 'scale(1)' }, { transform: 'scale(1.18)', offset: 0.3 }, { transform: 'scale(1)' }], 260);
      await current.bonus({
        i, n: bonuses.length, k: count[b.side]++, side: b.side, pal: pal[b.side], label: b.label, src,
        from: src ? src.at() : mid(yug.cell(b.side)), to: mid(boxOf(s.total)), die: s.die.el, other: seats[1 - b.side].die.el, land,
      });
      land();
    }

    // who won
    await wait(420);
    const winner: Side = seats[0].sum >= seats[1].sum ? 0 : 1;
    const loser = (1 - winner) as Side;
    const margin = seats[winner].sum - seats[loser].sum;
    seats[winner].seat.classList.add('won');
    seats[loser].seat.classList.add('lost');
    await current.win({
      winner, pal: pal[winner], losePal: pal[loser], win: seats[winner].die.el, lose: seats[loser].die.el, margin,
      winAt: () => mid(boxOf(seats[winner].die.el)),
      loseAt: () => mid(boxOf(seats[loser].die.el)),
      hideLoser: () => void (seats[loser].die.el.style.visibility = 'hidden'),
    });
    seats[loser].die.el.style.visibility = 'hidden';
    say('调整阵营 · 南斯拉夫', `${sideName(winner)}胜，差 ${margin}：${sideName(loser)}在南斯拉夫失去 ${margin} 点`);
    await wait(360);

    // what it costs the loser, on the map
    const from = mid(boxOf(seats[winner].total));
    for (let i = 0; i < margin; i++) {
      const cellBox = yug.cell(loser);
      const shot = kit.put('im-minus', from, 30, 22, { background: pal[winner].main });
      shot.textContent = '−1';
      sfx.whoosh(0.16);
      await kit.fly(shot, from, mid(cellBox), { ms: 240, lift: 50, ease: kit.easeIn });
      shot.remove();
      inf.yug[loser] -= 1;
      show();
      pop(yug.cell(loser), pal[loser].main, String(inf.yug[loser]), 1.4);
      current.tap(mid(yug.cell(loser)), pal[winner], 5 + i, 2);
      void nudge(yug.root, [{ transform: 'translate(0,0) rotate(0deg)' }, { transform: `translate(${loser === 1 ? 5 : -5}px, 2px) rotate(${loser === 1 ? 2 : -2}deg)`, offset: 0.25 }, { transform: 'translate(0,0) rotate(0deg)' }], 220);
      await wait(260);
    }
    await wait(700);
    // the panel goes, and with it whatever the set left standing beside the dice
    for (const node of [panel, ...top.querySelectorAll<HTMLElement>('.fx-keep')]) void go(node, [{ opacity: 1 }, { opacity: 0 }], { ms: 320 }).then(() => node.remove(), () => undefined);
    await wait(500);
  }

  // ---------------------------------------------------------------- playing
  const PLAY: Record<Moment, () => Promise<void>> = { control: playControl, wipe: playWipe, duel: playDuel };
  async function play(what: Moment | 'all'): Promise<void> {
    wake();
    const mine = ++run;
    last = what;
    kit.reset();
    say('');
    markPlaying(what);
    try {
      if (what === 'all') {
        setBoard('control');
        await wait(250);
        await playControl();
        await playWipe();
        await playDuel();
      } else {
        setBoard(what);
        await wait(250);
        await PLAY[what]();
      }
      if (mine === run) {
        say('');
        markPlaying(null);
      }
    } catch (e) {
      if (e !== CANCELLED) throw e;
    }
  }
  function pick(id: string, replay = true): void {
    const v = VARIANTS.find((x) => x.id === id);
    if (!v) return;
    current = v;
    stage.dataset.im = v.id;
    document.body.dataset.im = v.id;
    paint();
    const url = new URL(location.href);
    url.searchParams.set('v', v.id);
    history.replaceState(null, '', url);
    if (replay) void play(last);
  }

  // ---------------------------------------------------------------- the page around it
  const ui = document.getElementById('ui')!;
  const bar = el('div', 'im-bar');
  const tabs = el('div', 'im-tabs');
  tabs.append(el('b', 'im-title', '打击感 · 十套'));
  const tabOf = new Map<string, HTMLButtonElement>();
  for (const v of VARIANTS) {
    const b = el('button', 'im-tab');
    b.type = 'button';
    b.append(el('i', '', v.id), el('span', '', v.name));
    if (RECOMMENDED.includes(v.id)) b.append(el('em', '', '荐'));
    b.addEventListener('click', () => pick(v.id));
    tabOf.set(v.id, b);
    tabs.append(b);
  }
  const row = el('div', 'im-row');
  const desc = el('div', 'im-desc');
  const acts = el('div', 'im-acts');
  const actOf = new Map<string, HTMLButtonElement>();
  const act = (key: string, label: string, hot: string, fn: () => void): HTMLButtonElement => {
    const b = el('button', 'im-act');
    b.type = 'button';
    b.append(el('span', '', label), el('kbd', '', hot));
    b.addEventListener('click', fn);
    actOf.set(key, b);
    acts.append(b);
    return b;
  };
  act('control', '① 控制落成', 'Q', () => void play('control'));
  act('wipe', '② 政变清场', 'W', () => void play('wipe'));
  act('duel', '③ 骰子对决', 'E', () => void play('duel'));
  act('all', '▶ 三段连播', 'A', () => void play('all'));
  acts.append(el('i', 'im-sep'));
  const slowBtn = act('slow', '慢放', 'S', () => {
    slow = slow === 1 ? 0.35 : 1;
    kit.setSpeed(slow);
    slowBtn.classList.toggle('on', slow !== 1);
  });
  slowBtn.classList.toggle('on', slow !== 1);
  const muteBtn = act('mute', '静音', 'M', () => {
    const on = !muteBtn.classList.contains('on');
    setMuted(on);
    muteBtn.classList.toggle('on', on);
  });
  muteBtn.classList.toggle('on', params.has('mute'));
  row.append(desc, acts);
  bar.append(tabs, row);
  ui.append(bar, caption);
  function markPlaying(what: Moment | 'all' | null): void {
    for (const [key, b] of actOf) b.classList.toggle('playing', key === what);
  }
  function paint(): void {
    for (const [id, b] of tabOf) b.classList.toggle('on', id === current.id);
    desc.innerHTML = '';
    const head = el('div', 'im-desc-head');
    head.append(el('b', '', `${current.id} ${current.name}`), el('span', 'im-sign', current.sign), el('span', 'im-feel', current.feel));
    desc.append(head, el('p', '', current.blurb), el('p', 'im-risk', `代价：${current.risk}`));
    // the line that says what is going on sits just under the bar, however tall the bar is
    if (!document.body.classList.contains('bare')) caption.style.top = `${Math.round(bar.getBoundingClientRect().bottom + 10)}px`;
  }
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const at = VARIANTS.indexOf(current);
    if (e.key === 'ArrowRight') pick(VARIANTS[(at + 1) % VARIANTS.length].id);
    else if (e.key === 'ArrowLeft') pick(VARIANTS[(at + VARIANTS.length - 1) % VARIANTS.length].id);
    else if (e.code.startsWith('Digit')) pick(String(Number(e.code.slice(5)) || 10).padStart(2, '0'));
    else if (e.key === 'q' || e.key === 'Q') void play('control');
    else if (e.key === 'w' || e.key === 'W') void play('wipe');
    else if (e.key === 'e' || e.key === 'E') void play('duel');
    else if (e.key === 'a' || e.key === 'A') void play('all');
    else if (e.key === ' ') {
      e.preventDefault();
      void play(last);
    } else if (e.key === 's' || e.key === 'S') slowBtn.click();
    else if (e.key === 'm' || e.key === 'M') muteBtn.click();
    else if (e.key === 'h' || e.key === 'H') document.body.classList.toggle('bare');
  });
  window.addEventListener('pointerdown', wake, { once: true });
  if (params.get('ui') === '0') document.body.classList.add('bare');

  // ---- the view: the theatre in the upper middle, room for the dice below it
  const nodes = pack.countries.filter((c) => THEATRE.includes(c.id)).map((c) => c.node);
  const xs = nodes.map((p) => p[0]);
  const zs = nodes.map((p) => p[1]);
  const span = Math.max(...zs) - Math.min(...zs);
  inner.rig.flyToBox([Math.min(...xs) - 2.5, Math.min(...zs) - span * 0.55, Math.max(...xs) + 2.5, Math.max(...zs) + span * 1.0], { instant: true });

  setBoard('control');
  pick(current.id, false);
  await new Promise((r) => setTimeout(r, 700));
  document.documentElement.classList.add('ready');
  Object.assign(window, { proto: { map, kit, play, pick, variants: VARIANTS, tok, get current() { return current; } } });
  const auto = params.get('play') as Moment | 'all' | null;
  if (auto) void play(auto);
}

// a replay cuts off whatever was still going on; that is not an error
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason === CANCELLED) e.preventDefault();
});
void start();
