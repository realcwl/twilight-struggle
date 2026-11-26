// Scoring: ten ways of showing how an area is scored, switchable on the live map with the game's HUD.
//
// What is the same in all ten is staged here: the board, the numbers (the engine's own scoring report),
// the camera, the tokens that answer, the points that leave them, and the ending: the net result goes
// to the score in the HUD. A way (variants.ts) only decides where the information is put and how it
// comes together. No way has pages, steps or buttons; a click or the space bar runs what is left at once.
//
// The page mounts the game's map, HUD and rules model unchanged. Nothing in src/ knows about this folder.
import '../../src/game/game.css';
import '../../src/play/play.css';
import { CARDS, cardBack, cardFace, cardFontsReady, connectCardMap, describeCard, fitCard } from '../../src/cards/deck';
import { countryScoringFromCards, scoringFromCards } from '../../src/game/regions';
import { Match } from '../../src/game/solo/model';
import { termSource } from '../../src/game/terms';
import { COLDWAR_TRACKS } from '../../src/game/tracks';
import { Hud } from '../../src/hud/Hud';
import type { HudState } from '../../src/hud/types';
import { BATTLE_GLYPH } from '../../src/map/battleMark';
import { flagMarkup } from '../../src/map/flags';
import { WorldMap } from '../../src/map/WorldMap';
import type { Play } from '../../src/play/types';
import { sfx, setMuted, wake, type Sfx } from '../impact/sfx';
import * as kit from './kit';
import { BACK, CANCELLED, IN, boxOf, easeIn, fly, go, gone, mid, mk, nudge, popIn, put, rem, wait, type Pt } from './kit';
import { openLog } from './log';
import type { Ctx, Frame, Pal, Side, Tok, Variant } from './types';
import { CHOSEN, RECOMMENDED, VARIANTS } from './variants';
import { viewOf, type ScoreView } from './view';

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

// ---------------------------------------------------------------- the situations
/** Influence [first side, second side]; every country not named is empty. `vp` is the score before. */
type Situation = { id: string; region: string; name: string; note: string; vp: number; turn: number; inf: Record<string, [number, number]> };
const SITUATIONS: Situation[] = [
  {
    id: 'europe', region: 'europe', name: '欧洲', note: '存在 对 支配', vp: -2, turn: 3,
    inf: { gbr: [5, 0], can: [2, 0], fra: [3, 0], frg: [4, 1], ita: [0, 2], gdr: [0, 3], pol: [0, 3], cze: [0, 3], hun: [0, 3], rou: [0, 3], bgr: [0, 3], fin: [0, 1], aut: [1, 0], esp: [1, 0], yug: [1, 2], tur: [1, 0], grc: [1, 1] },
  },
  {
    id: 'asia', region: 'asia', name: '亚洲', note: '支配 对 存在 · 有邻接加分', vp: 3, turn: 5,
    inf: { jpn: [4, 0], kor: [3, 0], tha: [2, 0], aus: [4, 0], phl: [2, 0], afg: [2, 0], prk: [0, 3], ind: [0, 3], vnm: [0, 1], lao: [0, 1], pak: [1, 1], twn: [1, 0], mys: [1, 0], mmr: [0, 1] },
  },
  {
    id: 'mideast', region: 'mideast', name: '中东', note: '势均力敌 · 双方抵消', vp: 1, turn: 4,
    inf: { isr: [4, 0], sau: [3, 0], irq: [0, 3], egy: [0, 2], syr: [0, 2], irn: [1, 0], lby: [0, 1], jor: [1, 0] },
  },
  {
    id: 'camerica', region: 'camerica', name: '中美洲', note: '控制 对 存在', vp: -4, turn: 6,
    inf: { mex: [2, 0], pan: [2, 0], cub: [3, 0], cri: [3, 0], nic: [0, 1], gtm: [1, 0], hnd: [1, 0] },
  },
  {
    id: 'africa', region: 'africa', name: '非洲', note: '一方没有国家', vp: 0, turn: 7,
    inf: { zaf: [3, 0], nga: [1, 0], ago: [1, 1], dza: [0, 1], cod: [1, 1], ken: [1, 0] },
  },
  {
    id: 'sea', region: 'southeast-asia', name: '东南亚', note: '逐国计分 · 没有档位', vp: 2, turn: 5,
    inf: { tha: [2, 0], phl: [2, 0], mys: [2, 0], vnm: [0, 1], lao: [0, 1], mmr: [0, 2], idn: [0, 0], jpn: [4, 0], kor: [3, 0], prk: [0, 3] },
  },
];

/** The card that scores each area. */
const SCORING_CARD: Record<string, string> = { asia: '001', europe: '002', mideast: '003', camerica: '037', 'southeast-asia': '038', africa: '079', samerica: '081' };

async function start(): Promise<void> {
  const [map] = await Promise.all([WorldMap.create(document.getElementById('map')!, '/maps/coldwar', { lang: 'zh' }), cardFontsReady()]);
  const { pack } = map;
  const { scenario } = pack;
  connectCardMap(map);
  const game = document.getElementById('game')!;
  const hud = Hud.create(game, {
    lang: 'zh',
    rules: { ...COLDWAR_TRACKS, scoring: scoringFromCards(scenario.regions), countryScoring: countryScoringFromCards() },
    sides: scenario.sides,
    cards: { face: cardFace, back: cardBack, fit: fitCard, describe: describeCard },
    catalog: CARDS.length,
    term: termSource,
    demo: false,
    playFlight: false,
  });
  const stage = document.querySelector<HTMLElement>('.wm-stage')!;
  const rig = (map as unknown as { rig: { nearestX(x: number): number; flyToBox(box: [number, number, number, number], opts?: { viewport?: Frame; instant?: boolean }): void } }).rig;
  const pal: [Pal, Pal] = [0, 1].map((i) => {
    const c = scenario.sides[i].color;
    return { main: c, light: mix(c, 255, 0.45), deep: mix(c, 0, 0.4) };
  }) as [Pal, Pal];
  document.documentElement.style.setProperty('--sa', pal[0].main);
  document.documentElement.style.setProperty('--sa-l', pal[0].light);
  document.documentElement.style.setProperty('--sa-d', pal[0].deep);
  document.documentElement.style.setProperty('--sb', pal[1].main);
  document.documentElement.style.setProperty('--sb-l', pal[1].light);
  document.documentElement.style.setProperty('--sb-d', pal[1].deep);
  const names: [string, string] = [scenario.sides[0].name.zh, scenario.sides[1].name.zh];

  // ---- our layer: over the map and over the HUD, so that a result can travel into the HUD
  const top = el('div', 'sc-top');
  document.body.append(top);
  kit.mount(top, [game]);

  // ---- the board: the game's own model holds it, so that the numbers shown are the engine's
  const match = new Match(scenario, 7);
  let hudState!: HudState;
  let view!: ScoreView;
  let situation = SITUATIONS.find((s) => s.id === params.get('s')) ?? SITUATIONS[0];
  let shownCard = '';
  const nodeX = new Map(pack.countries.map((c) => [c.id, c.node[0]]));
  const nameOf = new Map(scenario.countries.map((c) => [c.id, c.name.zh]));
  function setBoard(s: Situation): void {
    situation = s;
    for (const id of Object.keys(match.s.inf)) match.s.inf[id] = [...(s.inf[id] ?? [0, 0])] as [number, number];
    Object.assign(match.s, { vp: s.vp, turn: s.turn, round: 4, phase: 'action', active: 0 });
    view = viewOf(match.scoring(s.region), {
      country: (id) => ({ name: nameOf.get(id) ?? id, x: nodeX.get(id) ?? 0 }),
      side: (i) => ({ name: names[i], short: scenario.sides[i].short.zh }),
      key: (id) => match.scoringKey(id),
    });
    hudState = match.hudState(0);
    hud.setState(hudState, false);
    map.setState(match.mapState());
    // the scoring card stands where a resolving card stands in play, so that every way is judged with it there
    if (shownCard !== SCORING_CARD[s.region]) {
      shownCard = SCORING_CARD[s.region];
      hud.resetCardMotion();
      void hud.showResolving({ by: 0, card: { id: shownCard }, use: 'event', verb: 'event', points: 0, pile: 'discard' } as unknown as Play);
    }
  }
  const setVp = (vp: number): void => {
    hudState = { ...hudState, vp };
    hud.setState(hudState);
  };

  // ---- tokens
  const tok = (id: string): Tok | null => {
    const root = stage.querySelector<HTMLElement>(`.wm-plate[data-id="${id}"]`);
    const body = root?.querySelector<HTMLElement>('.wm-plate-body');
    if (!root || !body || root.style.display === 'none') return null;
    return { id, name: nameOf.get(id) ?? id, root, body, box: () => boxOf(body), at: () => mid(boxOf(body)) };
  };
  const cls = (s: Side): string => (s === 0 ? 'a' : 'b');

  // ---- the score in the HUD: the corner stays as it is in play (folded), and its number is where a result lands
  const readEl = (): HTMLElement => hud.root.querySelector<HTMLElement>('.hs-vp b') ?? hud.root.querySelector<HTMLElement>('.hud-tr')!;
  const score = (): Pt => mid(boxOf(readEl()));

  // ---- which way
  let current: Variant = VARIANTS.find((v) => v.id === (params.get('v') ?? CHOSEN).padStart(2, '0')) ?? VARIANTS[0];
  let run = 0;
  let playing = false;
  /** Set while a way waits for the player to say "go on". */
  let goOn: (() => void) | null = null;
  /** Time spent waiting there: not part of how long a way takes. */
  let waited = 0;
  /** A script drives the page: nobody is there to press the button. */
  let auto = params.has('auto');
  let slow = params.get('speed') ? Number(params.get('speed')) : 1;
  kit.setSpeed(slow);
  if (params.has('mute')) setMuted(true);
  const sound = new Proxy(sfx, {
    get: (all, name: keyof Sfx) => (...args: number[]): void => {
      if (!kit.rushing()) (all[name] as (...a: number[]) => void)(...args);
    },
  }) as Sfx;
  /** How much a result is worth feeling: 1 at six points, never nothing, never endless. */
  const weight = (): number => kit.clamp(view.net / 6, 0.45, 1.6);
  /** The seat at this screen: its gains are celebrated, the other side's are felt. */
  const PLAYER: Side = 0;

  /**
   * The score takes the result. The corner is struck, then the number counts one point at a time, and
   * every point is heard: rising for the seat at this screen, heavy for the other side. A lead that
   * changes hands on the way is called out. The last point lands harder than the rest.
   */
  async function arrive(): Promise<void> {
    const from = hudState.vp;
    const to = view.vpAfter;
    if (from === to) return;
    const side: Side = to > from ? 0 : 1;
    const good = side === PLAYER;
    const w = weight();
    const dir = to > from ? 1 : -1;
    const steps = Math.abs(to - from);
    const light = pal[side].light;
    const p = score();
    const pane = hud.root.querySelector<HTMLElement>('.hud-tr')!;
    // struck
    const r = boxOf(pane);
    const glow = mk(`sc-hudglow ${cls(side)}`, '', { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    void go(glow, [{ opacity: 1 }, { opacity: 0 }], { ms: 500 + 60 * steps, ease: 'ease-out' }).then(() => glow.remove(), () => undefined);
    void nudge(pane, [{ transform: 'translate(0,0)' }, { transform: `translate(${(3 + 3 * w).toFixed(1)}px, ${(-2 - 3 * w).toFixed(1)}px)`, offset: 0.2 }, { transform: `translate(${(-1.5 * w).toFixed(1)}px, ${(1.5 * w).toFixed(1)}px)`, offset: 0.55 }, { transform: 'translate(0,0)' }], 260).catch(() => undefined);
    kit.ring(p, light, { from: 12, to: rem(9 + 5 * w), ms: 420, width: 3 });
    kit.sparks(p, [light, '#fff'], Math.round(6 + 6 * w), rem(5 + 2 * w), { ms: 420, size: 4 });
    sound.thock(good ? 1.3 : 0.8);
    // counted
    const lead = (n: number): Side | null => (n > 0 ? 0 : n < 0 ? 1 : null);
    const was = lead(from);
    const gap = kit.clamp(390 / steps, 38, 85);
    for (let i = 1; i <= steps; i++) {
      await wait(gap);
      const now = from + dir * i;
      setVp(now);
      if (good) sound.coin(Math.min(9, i - 1));
      else sound.drum(i);
      const last = i === steps;
      void nudge(readEl(), [{ transform: 'scale(1)' }, { transform: `scale(${last ? 1.85 : 1.3})`, offset: 0.3 }, { transform: 'scale(1)' }], last ? 420 : Math.max(90, gap * 1.4), last ? BACK : 'ease-out').catch(() => undefined);
      if (!last) kit.sparks(score(), light, 2, rem(3), { ms: 260, size: 3 });
      // the lead has just changed hands
      if (was !== null && lead(now) === side && was !== side && lead(now - dir) !== side) {
        kit.flash('#ffe9a8', 0.16, 260);
        kit.ring(score(), '#ffe9a8', { from: 14, to: rem(16), ms: 520, width: 4 });
        sound.lock();
        const tag = put(`sc-flip ${cls(side)}`, { x: score().x, y: score().y + rem(5.4) }, good ? '反超' : '被反超');
        void popIn(tag, 220, 0.4).then(() => wait(900)).then(() => gone(tag, 260), () => undefined);
      }
    }
    // and the last point lands
    const at = score();
    kit.ring(at, '#fff7e4', { from: 14, to: rem(13 + 7 * w), ms: 560, width: 4 });
    kit.ring(at, light, { from: 10, to: rem(8 + 5 * w), ms: 640, width: 3, delay: 90 });
    kit.sparks(at, good ? [light, '#ffe9a8', '#fff'] : [light, '#fff'], Math.round(10 + 12 * w), rem(7 + 4 * w), { ms: 640, size: 5 });
    if (good) {
      if (view.net >= 4) sound.fanfare();
      else sound.ding(5);
    } else {
      sound.thud(0.9 + 0.3 * w);
      if (view.net >= 4) sound.rumble(0.6);
    }
  }

  function context(): Ctx {
    const tl = boxOf(hud.root.querySelector('.hud-tl')!);
    const tr = boxOf(hud.root.querySelector('.hud-tr')!);
    const gap = rem(2);
    const top = rem(7.4);
    const left = tl.left + tl.width + gap;
    const free = { left, top, width: tr.left - gap - left, height: innerHeight - top - rem(document.body.classList.contains('bare') ? 12 : 16) };
    const pulse: Ctx['pulse'] = (id, side, power = 1) => {
      const k = tok(id);
      if (!k) return;
      void nudge(k.body, [{ transform: 'scale(1)' }, { transform: `scale(${1 + 0.16 * power})`, offset: 0.3 }, { transform: 'scale(1)' }], 300).catch(() => undefined);
      kit.ring(k.at(), pal[side].light, { from: 20, to: rem(7 + 2.6 * power), ms: 420, width: 2 + power });
    };
    const wave: Ctx['wave'] = async (list, side, gap = 45, power = 0.8) => {
      for (let i = 0; i < list.length; i++) {
        pulse(list[i].id, side, power);
        if (i < list.length - 1) await wait(gap);
      }
    };
    const pip: Ctx['pip'] = async (c, side, to, o = {}) => {
      if (o.delay) await wait(o.delay);
      const k = tok(c.id);
      const from = k ? { x: k.at().x, y: k.box().top - rem(0.6) } : mid(area());
      const chip = put(`sc-pip ${cls(side)}`, from, o.text ?? `+${c.pts}`);
      pulse(c.id, side, 0.7);
      await go(chip, [{ opacity: 0, translate: '0 1.4rem', scale: '.5' }, { opacity: 1, translate: '0 0', scale: '1.15' }], { ms: 150, ease: BACK });
      await fly(chip, from, typeof to === 'function' ? to() : to, { ms: o.ms ?? 300, scale: [1.15, 0.8] });
      chip.remove();
    };
    function area(): kit.Box {
      const boxes = view.members.map((id) => tok(id)?.box()).filter((b): b is kit.Box => !!b && b.left > -40 && b.left < innerWidth);
      if (!boxes.length) return { left: innerWidth * 0.3, top: innerHeight * 0.3, width: innerWidth * 0.4, height: innerHeight * 0.4 };
      const l = Math.min(...boxes.map((b) => b.left));
      const t = Math.min(...boxes.map((b) => b.top));
      return { left: l, top: t, width: Math.max(...boxes.map((b) => b.left + b.width)) - l, height: Math.max(...boxes.map((b) => b.top + b.height)) - t };
    }
    const ctx: Ctx = {
      view, pal, free, area, tok,
      cx: innerWidth / 2,
      under: Math.max(tl.top + tl.height, tr.top + tr.height) + rem(1.4),
      flag: flagMarkup,
      rifles: BATTLE_GLYPH,
      pulse,
      wave,
      waves: (gap = 40) => Promise.all(([0, 1] as Side[]).map((s) => wave(view.sides[s].countries, s, gap))).then(() => undefined),
      pip,
      async pips(to, land, o = {}) {
        const gap = o.gap ?? 80;
        await Promise.all(
          ([0, 1] as Side[]).flatMap((s) =>
            view.sides[s].scoring.map((c, i) =>
              pip(c, s, () => to(s), { delay: i * gap, ms: o.ms }).then(() => {
                sound.tick(i + (s === 0 ? 0 : 2));
                land(s, c, i);
              }),
            ),
          ),
        );
      },
      async net(nums) {
        const totals = [view.sides[0].total, view.sides[1].total];
        if (view.lead === null) {
          for (const n of nums) void go(n, [{ opacity: 1 }, { opacity: 0.35 }], { ms: 220 }).catch(() => undefined);
          sound.tick(0);
          await wait(240);
          const [p, q] = nums.map((n) => mid(boxOf(n)));
          return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
        }
        const hi = view.lead;
        const lo = (1 - hi) as Side;
        const to = mid(boxOf(nums[hi]));
        if (totals[lo] > 0) {
          const from = mid(boxOf(nums[lo]));
          const ghost = put(`sc-minus ${cls(lo)}`, from, `−${totals[lo]}`);
          void go(nums[lo], [{ opacity: 1 }, { opacity: 0.3 }], { ms: 200 }).catch(() => undefined);
          sound.whoosh(0.12);
          await fly(ghost, from, to, { ms: 280, lift: rem(2.4), ease: easeIn, scale: [1, 0.8] });
          ghost.remove();
          kit.sparks(to, [pal[lo].light, '#fff'], 12, rem(5.4), { ms: 420, size: 5 });
          kit.ring(to, pal[lo].light, { from: 10, to: rem(8), ms: 320, width: 3 });
          kit.shake([nums[hi]], 5, 200);
          sound.thock(0.9);
          await kit.hitStop(40);
          await kit.count(nums[hi], totals[hi], view.net, 180);
        } else await wait(120);
        nums[hi].textContent = `+${view.net}`;
        kit.beat(nums[hi], 1.5, 240);
        await wait(40);
        return mid(boxOf(nums[hi]));
      },
      score,
      async land(from, o = {}) {
        if (view.lead === null) {
          // nothing gained: the two cancel with a dull knock and a puff of nothing
          const c = put('sc-net none', from, '<small>双方抵消</small><b>±0</b>');
          await go(c, [{ opacity: 0, scale: '1.9' }, { opacity: 1, scale: '1' }], { ms: 150, ease: IN });
          sound.thud(0.7);
          kit.bump(3, 200);
          kit.sparks(from, ['#8a7a62', '#c9b890'], 12, rem(7), { ms: 520, size: 5 });
          kit.ring(from, '#c9b890', { from: rem(3), to: rem(15), ms: 420, width: 2 });
          await wait(760);
          void gone(c, 240);
          return;
        }
        const side = view.lead;
        const good = side === PLAYER;
        const w = weight();
        const { light, main } = pal[side];
        const chip = put(`sc-net big ${cls(side)}`, from, `<small>${names[side]}</small><b>+${view.net}</b>`);
        chip.style.setProperty('--m', (0.8 + 0.32 * w).toFixed(2));
        // wherever it was decided, the result stands clear of the HUD's corners and inside the screen
        const half = chip.offsetWidth / 2 + rem(1.5);
        const high = from.y < ctx.under;
        from = { x: kit.clamp(from.x, (high ? free.left : 0) + half, (high ? free.left + free.width : innerWidth) - half), y: kit.clamp(from.y, free.top + rem(4), innerHeight - rem(16)) };
        kit.moveTo(chip, from);
        // it comes down hard, and the whole table knows whose moment this is
        await go(chip, [{ opacity: 0, scale: '2.9' }, { opacity: 1, scale: '1' }], { ms: 140, ease: IN });
        sound.stamp(1 + 0.4 * w);
        if (w >= 0.8) sound.boom(0.35 + 0.2 * w);
        if (good) sound.ding(3);
        else if (view.net >= 4) sound.brass();
        kit.flash(light, 0.14 + 0.13 * w, 260);
        kit.wash(main, 0.44 + 0.24 * w, 1000);
        kit.quake(2.5 + 5 * w, 240 + 110 * w);
        kit.rays(from, good ? '#ffe9a8' : light, rem(24 + 12 * w), 760 + 90 * w);
        kit.ring(from, '#fff7e4', { from: rem(4), to: rem(17 + 12 * w), ms: 440, width: 4 });
        kit.ring(from, light, { from: rem(3), to: rem(11 + 8 * w), ms: 560, width: 3, delay: 80 });
        kit.sparks(from, good ? [light, '#ffe9a8', '#fff'] : [light, '#fff', main], Math.round(12 + 14 * w), rem(9 + 6 * w), { ms: 680, size: 6 });
        // the countries that earned it answer together
        for (const c of view.sides[side].countries) pulse(c.id, side, 1.25);
        await kit.hitStop(40 + 30 * w);
        // held for a breath
        void go(chip, [{ scale: '1' }, { scale: '1.08' }, { scale: '1' }], { ms: 440, ease: 'ease-in-out', fill: 'none' }).catch(() => undefined);
        await wait(o.delay ?? 210 + 70 * w);
        sound.whoosh(0.2);
        await fly(chip, from, score(), { ms: 290, lift: rem(2), scale: [1, 0.36], ease: easeIn, trail: light });
        chip.remove();
        await arrive();
        await wait(150);
      },
      arrive,
      weight,
      names,
      proceed(button) {
        const g = kit.gate();
        kit.calm();
        const since = performance.now();
        const done = (): void => g.open();
        goOn = done;
        button.addEventListener('click', done, { once: true });
        button.focus({ preventScroll: true });
        if (auto) window.setTimeout(done, 500);
        return g.promise.finally(() => {
          if (goOn === done) goOn = null;
          waited += performance.now() - since;
        });
      },
      sound,
    };
    return ctx;
  }

  // ---------------------------------------------------------------- playing
  const caption = el('div', 'sx-caption');
  const say = (text: string): void => {
    caption.textContent = text;
    caption.classList.toggle('on', !!text);
  };
  /**
   * Frames what this scoring is about. The area's battlegrounds and the countries that add points must
   * be in view. The other controlled countries are taken in from the nearest outwards, as long as that
   * does not pull the view back much: Australia does not make all of Asia small, and an area's far-off
   * member nobody holds (Canada, for Europe) is not looked for at all.
   */
  function frame(instant = false): void {
    const node = new Map(pack.countries.map((c) => [c.id, [rig.nearestX(c.node[0]), c.node[1]] as [number, number]]));
    const held = view.sides.flatMap((s) => s.countries);
    const must = new Set([...view.keyIds, ...held.filter((c) => c.pts > 0).map((c) => c.id)]);
    if (!must.size) for (const id of held.length ? held.map((c) => c.id) : view.members) must.add(id);
    type B = [number, number, number, number];
    const grow = (b: B | null, id: string): B => {
      const [x, z] = node.get(id)!;
      return b ? [Math.min(b[0], x), Math.min(b[1], z), Math.max(b[2], x), Math.max(b[3], z)] : [x, z, x, z];
    };
    const aspect = (current.frame.width * innerWidth) / (current.frame.height * innerHeight);
    const size = (b: B): number => Math.max(b[2] - b[0], (b[3] - b[1]) * aspect);
    let box = [...must].reduce<B | null>(grow, null)!;
    const limit = Math.max(size(box) * 1.25, 30);
    const centre = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
    const far = (id: string): number => Math.hypot(node.get(id)![0] - centre[0], (node.get(id)![1] - centre[1]) * aspect);
    for (const c of held.filter((x) => !must.has(x.id)).sort((p, q) => far(p.id) - far(q.id))) {
      const wider = grow(box, c.id);
      if (size(wider) <= limit) box = wider;
    }
    const pad = 3.2;
    rig.flyToBox([box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad], { viewport: current.frame, instant });
  }
  async function play(): Promise<void> {
    wake();
    const mine = ++run;
    goOn = null;
    kit.reset();
    playing = true;
    mark();
    setBoard(situation);
    hud.root.classList.add('play-wait');
    try {
      map.offer(null);
      frame();
      await wait(560);
      map.offer({ ok: [], keep: view.members, land: true });
      await wait(160);
      const began = performance.now();
      waited = 0;
      await current.run(context());
      const spent = Math.round(performance.now() - began - waited);
      if (mine === run) say(`${current.id} ${current.name} · ${view.name} · 用时 ${(spent / 1000).toFixed(1)} 秒（不含镜头 0.7 秒）`);
      await wait(350);
      // whatever a way left standing goes
      await Promise.all([...top.children].map((n) => gone(n, 260)));
    } catch (e) {
      if (e !== CANCELLED) throw e;
      return;
    }
    if (mine !== run) return;
    // however it was told, the board is right afterwards
    if (hudState.vp !== view.vpAfter) setVp(view.vpAfter);
    map.offer(null);
    playing = false;
    mark();
    document.documentElement.dataset.done = `${current.id}:${situation.id}:${mine}`;
  }
  function pick(id: string, replay = true): void {
    const v = VARIANTS.find((x) => x.id === id);
    if (!v) return;
    current = v;
    document.body.dataset.sc = v.id;
    paint();
    const url = new URL(location.href);
    url.searchParams.set('v', v.id);
    history.replaceState(null, '', url);
    if (replay) void play();
  }
  function choose(id: string, replay = true): void {
    const s = SITUATIONS.find((x) => x.id === id);
    if (!s) return;
    situation = s;
    const url = new URL(location.href);
    url.searchParams.set('s', s.id);
    history.replaceState(null, '', url);
    paint();
    if (replay) void play();
  }

  // ---------------------------------------------------------------- the page around it
  const ui = document.getElementById('ui')!;
  const bar = el('div', 'sx-bar');
  const tabs = el('div', 'sx-tabs');
  tabs.append(el('b', 'sx-title', '记分 · 十种'));
  const tabOf = new Map<string, HTMLButtonElement>();
  for (const v of VARIANTS) {
    const b = el('button', 'sx-tab');
    b.type = 'button';
    b.append(el('i', '', v.id), el('span', '', v.name));
    if (v.id === CHOSEN) b.append(el('em', 'picked', '已选'));
    else if (RECOMMENDED.includes(v.id)) b.append(el('em', '', '荐'));
    b.addEventListener('click', () => pick(v.id));
    tabOf.set(v.id, b);
    tabs.append(b);
  }
  const row = el('div', 'sx-row');
  const desc = el('div', 'sx-desc');
  const acts = el('div', 'sx-acts');
  const sits = el('div', 'sx-sits');
  const sitOf = new Map<string, HTMLButtonElement>();
  for (const s of SITUATIONS) {
    const b = el('button', 'sx-sit');
    b.type = 'button';
    b.title = s.note;
    b.append(el('span', '', s.name), el('small', '', s.note));
    b.addEventListener('click', () => choose(s.id));
    sitOf.set(s.id, b);
    sits.append(b);
  }
  const actOf = new Map<string, HTMLButtonElement>();
  const act = (key: string, label: string, hot: string, fn: () => void): HTMLButtonElement => {
    const b = el('button', 'sx-act');
    b.type = 'button';
    b.append(el('span', '', label), el('kbd', '', hot));
    b.addEventListener('click', fn);
    actOf.set(key, b);
    acts.append(b);
    return b;
  };
  act('play', '▶ 重播', '空格', () => void play());
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
  const log = (): void => openLog(view, { names, turn: situation.turn, rifles: BATTLE_GLYPH });
  act('log', '日志里的明细', 'L', log);
  row.append(desc, el('div', 'sx-side'));
  row.lastElementChild!.append(sits, acts);
  bar.append(tabs, row);
  ui.append(bar, caption);
  function mark(): void {
    actOf.get('play')!.classList.toggle('playing', playing);
  }
  function paint(): void {
    for (const [id, b] of tabOf) b.classList.toggle('on', id === current.id);
    for (const [id, b] of sitOf) b.classList.toggle('on', id === situation.id);
    desc.innerHTML = '';
    const head = el('div', 'sx-desc-head');
    head.append(el('b', '', `${current.id} ${current.name}`), el('span', 'sx-sign', current.sign), el('span', 'sx-feel', current.feel));
    desc.append(head, el('p', '', current.blurb), el('p', 'sx-risk', `代价：${current.risk}`));
    document.documentElement.style.setProperty('--bar-h', `${Math.round(bar.getBoundingClientRect().height)}px`);
  }
  const bare = (on: boolean): void => {
    document.body.classList.toggle('bare', on);
    // the bar stands where the hand is; without the bar the hand is back, lowered as it is while a card resolves
    hud.root.classList.toggle('play-away', !on);
  };
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
    const at = VARIANTS.indexOf(current);
    if (e.key === 'ArrowRight') pick(VARIANTS[(at + 1) % VARIANTS.length].id);
    else if (e.key === 'ArrowLeft') pick(VARIANTS[(at + VARIANTS.length - 1) % VARIANTS.length].id);
    else if (e.code.startsWith('Digit')) pick(String(Number(e.code.slice(5)) || 10).padStart(2, '0'));
    else if (e.key === ' ' || (e.key === 'Enter' && goOn)) {
      e.preventDefault();
      // waited for: go on. While it plays, space is what it is in the game: enough, show me the result
      if (goOn) goOn();
      else if (playing) kit.rush();
      else void play();
    } else if (e.key === 's' || e.key === 'S') slowBtn.click();
    else if (e.key === 'm' || e.key === 'M') muteBtn.click();
    else if (e.key === 'l' || e.key === 'L') log();
    else if (e.key === 'h' || e.key === 'H') bare(!document.body.classList.contains('bare'));
    else if (e.key === 'r' || e.key === 'R') choose(SITUATIONS[(SITUATIONS.indexOf(situation) + 1) % SITUATIONS.length].id);
  });
  // a click on the map while it plays: enough, show me the result
  document.getElementById('map')!.addEventListener('pointerdown', () => {
    if (playing) kit.rush();
  });
  window.addEventListener('pointerdown', wake, { once: true });

  setBoard(situation);
  bare(params.get('ui') === '0');
  pick(current.id, false);
  frame(true);
  await new Promise((r) => setTimeout(r, 900));
  document.documentElement.classList.add('ready');
  Object.assign(window, { proto: { map, hud, kit, match, play, pick, choose, variants: VARIANTS, situations: SITUATIONS, context, openLog: log, get view() { return view; }, get current() { return current; }, get playing() { return playing; }, get auto() { return auto; }, set auto(on: boolean) { auto = on; } } });
  if (params.has('log')) log();
  else if (params.has('play')) void play();
}

// a replay cuts off whatever was still going on; that is not an error
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason === CANCELLED) e.preventDefault();
});
void start();
