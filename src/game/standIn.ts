import { translateDictionary } from '../i18n/index.js';
// A stand-in for the rules engine that the play screen can be played against.
//
// It walks a turn (the headline, then action rounds, the opponent moving first) and asks a Presenter
// (src/play/types.ts) to stage each piece, so the screen can be used the way it will be: drag a card
// out, choose event or operations, choose countries, watch the dice, watch each consequence land.
//
// What is real and what is not:
//   - Operations are carried out by simple placeholder rules (placing, coups, realignment, the space
//     race), there so that a choice has consequences to stage. The numbers are to be replaced.
//   - A card's EVENT is not carried out: there is no engine for the cards' texts. Playing a card as
//     an event stages the card and says so. Nothing on the board changes.
//   - The opponent is not an opponent: it takes the first card of its hand and does something legal
//     with it, a different kind of thing each round, so that every kind is seen from the other side.
//   - The opening is a made-up moment: turn 4, the map's filler situation.
import type { Card } from '../cards/deck';
import type { HudRules, HudState, SideIndex } from '../hud/types';
import type { Lang, MapState, Scenario } from '../map/types';
import { ABORTED } from '../play/types';
import type { CardOptions, Cause, CoupPreview, Decision, Effect, Modifier, PlaceSession, Play, PlayCard, PlayQueries, Presenter, RealignPreview, Verb } from '../play/types';
import { deriveCountry, regionStatus } from '../sandbox/placeholderRule';

const TEXT = {
  zh: {
    status: { none: '无', ahead: '领先', behind: '落后', even: '均势' },
    locked: (level: number, region: string) => `核危机 ${level} 级：${region}禁止政变与调整阵营`,
    lethal: '核危机已到 2 级：再在战场国政变就是核战',
    noTargets: '没有对手影响力可动',
    allLocked: '能动手的国家都在被封锁的地区',
    noPoints: '这张牌没有行动点',
    eventLine: '按牌面文字发生',
    eventNote: (title: string) => `《${title}》的事件：规则引擎还没有接入，局面不变`,
    theirEvent: '对手的事件',
    ops: '行动点',
    bar: (s: number) => `稳定度 ${s} ×2`,
    coupOk: (net: number) => `政变成功 · 净值 ${net}`,
    coupFail: '政变失败',
    coupFailNote: (name: string) => `政变失败：${name}纹丝不动`,
    coupMilops: '政变计入军事行动',
    coupCrisis: (name: string) => `在战场国${name}政变`,
    friends: (n: number) => `相邻受控国 ×${n}`,
    home: '毗邻本土',
    lead: '影响力占优',
    tie: '平手',
    tieNote: '平手：谁也没动',
    nothingLeft: (name: string) => `${name}已经没有可移除的影响力`,
    wins: (side: string, diff: number) => `${side}胜出 · 差 ${diff}`,
    spaceTally: '计分牌不能用于太空竞赛',
    spaceTried: '本回合已经尝试过一次',
    spaceValue: (n: number) => `这一步需要至少 ${n} 点的牌`,
    spaceDone: '已经走完全程',
    spaceOk: '发射成功 · 前进一步',
    spaceFail: '发射失败',
    spaceFailNote: '发射失败：原地不动',
    spaceFirst: '率先到达',
    spaceSecond: '随后到达',
  },
  en: {
    status: { none: 'none', ahead: 'ahead', behind: 'behind', even: 'even' },
    locked: (level: number, region: string) => `Crisis level ${level}: no coups or realignment in ${region}`,
    lethal: 'Crisis level 2: another battleground coup is nuclear war',
    noTargets: 'No opposing influence to act on',
    allLocked: 'Every possible target is in a barred region',
    noPoints: 'This card has no operations points',
    eventLine: 'As the card says',
    eventNote: (title: string) => `Event of "${title}": no rules engine yet, nothing changes`,
    theirEvent: "The opponent's event",
    ops: 'operations',
    bar: (s: number) => `stability ${s} ×2`,
    coupOk: (net: number) => `Coup succeeds · net ${net}`,
    coupFail: 'Coup fails',
    coupFailNote: (name: string) => `Coup fails: ${name} does not move`,
    coupMilops: 'a coup counts as military operations',
    coupCrisis: (name: string) => `coup in the battleground ${name}`,
    friends: (n: number) => `adjacent controlled ×${n}`,
    home: 'next to the homeland',
    lead: 'more influence',
    tie: 'A tie',
    tieNote: 'A tie: nothing moves',
    nothingLeft: (name: string) => `${name} has no influence left to remove`,
    wins: (side: string, diff: number) => `${side} wins by ${diff}`,
    spaceTally: 'A scoring card cannot go to the space race',
    spaceTried: 'Already attempted this turn',
    spaceValue: (n: number) => `This step needs a card worth at least ${n}`,
    spaceDone: 'The race is run',
    spaceOk: 'Launch succeeds · one step on',
    spaceFail: 'Launch fails',
    spaceFailNote: 'Launch fails: no progress',
    spaceFirst: 'first to arrive',
    spaceSecond: 'second to arrive',
  },
 es: translateDictionary({
    status: { none: '无', ahead: '领先', behind: '落后', even: '均势' },
    locked: (level: number, region: string) => `核危机 ${level} 级：${region}禁止政变与调整阵营`,
    lethal: '核危机已到 2 级：再在战场国政变就是核战',
    noTargets: '没有对手影响力可动',
    allLocked: '能动手的国家都在被封锁的地区',
    noPoints: '这张牌没有行动点',
    eventLine: '按牌面文字发生',
    eventNote: (title: string) => `《${title}》的事件：规则引擎还没有接入，局面不变`,
    theirEvent: '对手的事件',
    ops: '行动点',
    bar: (s: number) => `稳定度 ${s} ×2`,
    coupOk: (net: number) => `政变成功 · 净值 ${net}`,
    coupFail: '政变失败',
    coupFailNote: (name: string) => `政变失败：${name}纹丝不动`,
    coupMilops: '政变计入军事行动',
    coupCrisis: (name: string) => `在战场国${name}政变`,
    friends: (n: number) => `相邻受控国 ×${n}`,
    home: '毗邻本土',
    lead: '影响力占优',
    tie: '平手',
    tieNote: '平手：谁也没动',
    nothingLeft: (name: string) => `${name}已经没有可移除的影响力`,
    wins: (side: string, diff: number) => `${side}胜出 · 差 ${diff}`,
    spaceTally: '计分牌不能用于太空竞赛',
    spaceTried: '本回合已经尝试过一次',
    spaceValue: (n: number) => `这一步需要至少 ${n} 点的牌`,
    spaceDone: '已经走完全程',
    spaceOk: '发射成功 · 前进一步',
    spaceFail: '发射失败',
    spaceFailNote: '发射失败：原地不动',
    spaceFirst: '率先到达',
    spaceSecond: '随后到达',
  }, 'es') } as const;

/** At this crisis level or lower, coups and realignment are barred in the region. Placeholder. */
const LOCKS = [
  { at: 4, region: 'europe' },
  { at: 3, region: 'asia' },
  { at: 2, region: 'mideast' },
];
const HAND_SIZE = 8;
const OPENING_HAND = ['021', '025', '035', '041', '034', '020', '010', '016'];

type Intent =
  | { t: 'inf'; id: string; side: SideIndex; d: number }
  | { t: 'crisis'; d: number; why?: string; id?: string }
  | { t: 'milops'; side: SideIndex; d: number; why?: string }
  | { t: 'vp'; side: SideIndex; d: number; why?: string }
  | { t: 'space'; side: SideIndex; d: number }
  | { t: 'note'; text: string; id?: string };

type Inner = Omit<HudState, 'deck' | 'opponentHand' | 'milopsRequired'> & {
  deck: string[];
  opponentCards: string[];
  inf: Record<string, [number, number]>;
  spaceTried: [boolean, boolean];
};

export type StandInOptions = {
  scenario: Scenario;
  rules: HudRules;
  cards: readonly Card[];
  lang: Lang;
  /** The situation on the map at the start. */
  situation: MapState;
  /** Called after every change with what the HUD and the map should now show. */
  onChange: (hud: HudState, map: MapState) => void;
  /** Dice to use before any are rolled, in order. For tests and screenshots. */
  dice?: number[];
};

const other = (side: SideIndex): SideIndex => (side === 0 ? 1 : 0);
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const sum = (mods: Modifier[]): number => mods.reduce((a, m) => a + m.n, 0);

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class StandInGame implements PlayQueries {
  private s!: Inner;
  private readonly t: (typeof TEXT)[Lang];
  private readonly byId: Map<string, Card>;
  private readonly countries: Map<string, Scenario['countries'][number]>;
  private readonly adj = new Map<string, string[]>();
  private readonly home: [string | null, string | null] = [null, null];
  private readonly ids: string[];
  private forced: number[];
  private run: { alive: boolean } | null = null;

  constructor(private readonly o: StandInOptions) {
    this.t = TEXT[o.lang];
    this.byId = new Map(o.cards.map((c) => [c.id, c]));
    this.countries = new Map(o.scenario.countries.map((c) => [c.id, c]));
    for (const c of o.scenario.countries) {
      this.adj.set(c.id, []);
      if (c.superpower !== undefined) this.home[c.superpower] = c.id;
    }
    for (const l of o.scenario.links) {
      this.adj.get(l.a)?.push(l.b);
      this.adj.get(l.b)?.push(l.a);
    }
    this.ids = o.scenario.countries.filter((c) => c.superpower === undefined).map((c) => c.id);
    this.forced = [...(o.dice ?? [])];
    this.deal();
  }

  // ------------------------------------------------------------------ what the screen is given

  /** The state as the HUD is given it. */
  get state(): HudState {
    const s = this.s;
    return {
      turn: s.turn, round: s.round, active: s.active, vp: s.vp, crisis: s.crisis,
      milops: [...s.milops], space: [...s.space],
      // the one rule relation the HUD draws: a turn's requirement is the crisis level
      milopsRequired: s.crisis,
      hand: [...s.hand], opponentHand: s.opponentCards.length, deck: s.deck.length,
      discard: [...s.discard], removed: [...s.removed], played: s.played,
    };
  }

  /** The situation as the map is given it. */
  get mapState(): MapState {
    const { scenario } = this.o;
    const state: MapState = { countries: {}, regions: {} };
    for (const c of scenario.countries) {
      state.countries[c.id] = c.superpower !== undefined ? { influence: [0, 0], controller: c.superpower } : deriveCountry([...this.inf(c.id)], c.stability, 'auto');
    }
    for (const r of scenario.regions) {
      const held: [number, number] = [0, 0];
      for (const c of scenario.countries) {
        const ctrl = state.countries[c.id].controller;
        if (c.region === r.id && ctrl !== null) held[ctrl]++;
      }
      state.regions[r.id] = { status: regionStatus(held, this.t.status) };
    }
    return state;
  }

  private changed(): void {
    this.o.onChange(this.state, this.mapState);
  }

  // ------------------------------------------------------------------ questions (PlayQueries)

  get crisis(): number {
    return this.s.crisis;
  }

  sideName(side: SideIndex): string {
    return this.o.scenario.sides[side].name[this.o.lang];
  }

  country(id: string): ReturnType<PlayQueries['country']> {
    const c = this.countries.get(id)!;
    return { id, name: c.name[this.o.lang], stability: c.stability, key: c.key, region: c.region, influence: [...this.inf(id)], controller: this.ctrl(id) };
  }

  card(id: string): PlayCard {
    const c = this.byId.get(id);
    if (!c) throw new Error(`No card "${id}"`);
    const owner = c.kind === 'us' ? 'mine' : c.kind === 'ussr' ? 'theirs' : c.kind;
    return { id, title: c.title, value: c.value, owner, once: c.once };
  }

  options(cardId: string, side: SideIndex = 0): CardOptions {
    const card = this.card(cardId);
    const theirs = card.owner === (side === 0 ? 'theirs' : 'mine');
    const none = (t: { locked: Map<string, string> }): string => (card.value === 0 ? this.t.noPoints : t.locked.size ? this.t.allLocked : this.t.noTargets);
    const place = card.value > 0 ? this.placeTargets(side) : new Map<string, { cost: number }>();
    const coup = card.value > 0 ? this.coupTargets(side, card.value) : { ok: new Map<string, CoupPreview>(), locked: new Map<string, string>() };
    const realign = card.value > 0 ? this.realignTargets(side) : { ok: new Map<string, RealignPreview>(), locked: new Map<string, string>() };
    return {
      card,
      points: card.value,
      fires: theirs,
      event: { ok: !theirs, lines: [{ text: theirs ? this.t.theirEvent : this.t.eventLine, warn: theirs }], lethal: false },
      place: { ok: place.size > 0, targets: place },
      coup: { ok: coup.ok.size > 0, targets: coup.ok, locked: coup.locked, why: coup.ok.size ? '' : none(coup) },
      realign: { ok: realign.ok.size > 0, targets: realign.ok, locked: realign.locked, why: realign.ok.size ? '' : none(realign) },
      space: this.spaceOption(side, card),
    };
  }

  // ------------------------------------------------------------------ placeholder rules for operations

  private inf(id: string): [number, number] {
    return (this.s.inf[id] ??= [0, 0]);
  }

  /** A side controls a country when its influence leads by at least the stability. */
  private ctrl(id: string): SideIndex | null {
    const c = this.countries.get(id)!;
    if (c.superpower !== undefined) return c.superpower;
    const [a, b] = this.inf(id);
    return a - b >= c.stability ? 0 : b - a >= c.stability ? 1 : null;
  }

  private lockOf(id: string): string | null {
    const region = this.countries.get(id)!.region;
    const lock = LOCKS.find((l) => l.region === region && this.s.crisis <= l.at);
    if (!lock) return null;
    const name = this.o.scenario.regions.find((r) => r.id === lock.region)?.name[this.o.lang] ?? lock.region;
    return this.t.locked(this.s.crisis, name);
  }

  /** Where a side may place: wherever it stood when the action began, and next door to that. */
  private placeTargets(side: SideIndex, base: Record<string, [number, number]> = this.s.inf): Map<string, { cost: number }> {
    const out = new Map<string, { cost: number }>();
    const stood = (id: string): boolean => (base[id]?.[side] ?? 0) > 0;
    for (const id of this.ids) {
      const near = stood(id) || this.adj.get(id)!.some((n) => n === this.home[side] || (this.countries.get(n)!.superpower === undefined && stood(n)));
      if (near) out.set(id, { cost: this.ctrl(id) === other(side) ? 2 : 1 });
    }
    return out;
  }

  private coupPreview(side: SideIndex, id: string, ops: number): CoupPreview {
    const c = this.countries.get(id)!;
    const theirs = this.inf(id)[other(side)];
    const bar = c.stability * 2;
    const table = [1, 2, 3, 4, 5, 6].map((roll) => {
      const net = Math.max(0, roll + ops - bar);
      const remove = Math.min(net, theirs);
      return { roll, ok: net > 0, net, remove, add: net - remove };
    });
    const wins = table.filter((r) => r.ok).length;
    return {
      id, ops, stability: c.stability, bar, table,
      need: wins ? 7 - wins : null,
      chance: wins / 6,
      key: c.key,
      crisisTo: c.key ? Math.max(1, this.s.crisis - 1) : this.s.crisis,
      milopsTo: Math.min(this.o.rules.milopsMax, this.s.milops[side] + ops),
    };
  }

  private coupTargets(side: SideIndex, ops: number): { ok: Map<string, CoupPreview>; locked: Map<string, string> } {
    const ok = new Map<string, CoupPreview>();
    const locked = new Map<string, string>();
    for (const id of this.ids) {
      if (this.inf(id)[other(side)] <= 0) continue;
      const why = this.lockOf(id);
      const p = this.coupPreview(side, id, ops);
      if (why) locked.set(id, why);
      else if (p.key && p.crisisTo <= 1) locked.set(id, this.t.lethal);
      else ok.set(id, p);
    }
    return { ok, locked };
  }

  /** What each side adds to its die in a country. */
  private realignMods(id: string): [Modifier[], Modifier[]] {
    const of = (side: SideIndex): Modifier[] => {
      const mods: Modifier[] = [];
      const friends = this.adj.get(id)!.filter((n) => this.countries.get(n)!.superpower === undefined && this.ctrl(n) === side).length;
      if (friends) mods.push({ label: this.t.friends(friends), n: friends });
      if (this.adj.get(id)!.includes(this.home[side] ?? '')) mods.push({ label: this.t.home, n: 1 });
      if (this.inf(id)[side] > this.inf(id)[other(side)]) mods.push({ label: this.t.lead, n: 1 });
      return mods;
    };
    return [of(0), of(1)];
  }

  private realignTargets(side: SideIndex): { ok: Map<string, RealignPreview>; locked: Map<string, string> } {
    const ok = new Map<string, RealignPreview>();
    const locked = new Map<string, string>();
    for (const id of this.ids) {
      if (this.inf(id)[other(side)] <= 0) continue;
      const why = this.lockOf(id);
      if (why) locked.set(id, why);
      else {
        const mods = this.realignMods(id);
        ok.set(id, { id, mods, edge: sum(mods[side]) - sum(mods[other(side)]) });
      }
    }
    return { ok, locked };
  }

  private spaceOption(side: SideIndex, card: PlayCard): CardOptions['space'] {
    const at = this.s.space[side];
    const step = this.o.rules.space[at];
    const no = (why: string): CardOptions['space'] => ({ ok: false, why, max: step?.rollMax ?? 0, chance: 0, step: at + 1 });
    if (card.owner === 'tally') return no(this.t.spaceTally);
    if (!step) return no(this.t.spaceDone);
    if (this.s.spaceTried[side]) return no(this.t.spaceTried);
    if (card.value < step.minOps) return no(this.t.spaceValue(step.minOps));
    return { ok: true, why: '', max: step.rollMax, chance: step.rollMax / 6, step: at + 1 };
  }

  /** Carries out one change and returns it with what it changed filled in. */
  private apply(e: Intent): Effect {
    const s = this.s;
    if (e.t === 'inf') {
      const v = this.inf(e.id);
      const ctrlFrom = this.ctrl(e.id);
      const from = v[e.side];
      v[e.side] = Math.max(0, from + e.d);
      return { ...e, d: v[e.side] - from, from, to: v[e.side], ctrlFrom, ctrlTo: this.ctrl(e.id) };
    }
    if (e.t === 'crisis') {
      const from = s.crisis;
      s.crisis = clamp(from + e.d, 1, this.o.rules.crisis.length);
      return { ...e, from, to: s.crisis };
    }
    if (e.t === 'milops') {
      const from = s.milops[e.side];
      s.milops[e.side] = clamp(from + e.d, 0, this.o.rules.milopsMax);
      return { ...e, from, to: s.milops[e.side] };
    }
    if (e.t === 'vp') {
      const from = s.vp;
      s.vp = clamp(from + (e.side === 0 ? e.d : -e.d), -this.o.rules.vpMax, this.o.rules.vpMax);
      return { ...e, from, to: s.vp };
    }
    if (e.t === 'space') {
      const from = s.space[e.side];
      s.space[e.side] = clamp(from + e.d, 0, this.o.rules.space.length);
      return { ...e, from, to: s.space[e.side] };
    }
    return e;
  }

  // ------------------------------------------------------------------ the made-up opening

  private deal(): void {
    const { cards, rules, situation } = this.o;
    const known = new Set(cards.map((c) => c.id));
    const hand = OPENING_HAND.filter((id) => known.has(id));
    const rest = cards.filter((c) => c.era !== 'late' && c.kind !== 'tally' && !hand.includes(c.id)).map((c) => c.id);
    // a fixed shuffle, so the opening is the same every time
    const r = seeded(7);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    const once = (id: string): boolean => this.byId.get(id)!.once;
    const spent = rest.splice(0, 16);
    this.s = {
      turn: 4,
      round: 1,
      active: 0,
      vp: -3,
      crisis: Math.min(4, rules.crisis.length),
      milops: [0, 0],
      space: [Math.min(4, rules.space.length), Math.min(3, rules.space.length)],
      hand,
      opponentCards: rest.splice(0, HAND_SIZE),
      deck: rest,
      discard: spent.filter((id) => !once(id)),
      removed: spent.filter(once),
      played: null,
      inf: Object.fromEntries(this.ids.map((id) => [id, [...(situation.countries[id]?.influence ?? [0, 0])] as [number, number]])),
      spaceTried: [false, false],
    };
  }

  // ------------------------------------------------------------------ the turn

  stop(): void {
    if (this.run) this.run.alive = false;
    this.run = null;
  }

  /** Starts over from the opening and walks the turn, asking `P` to stage it. */
  start(P: Presenter, from: 'headline' | 'opponent' | 'action' = 'headline'): void {
    this.stop();
    this.forced = [...(this.o.dice ?? [])];
    this.deal();
    this.changed();
    const me = { alive: true };
    this.run = me;
    const s = (): Inner => this.s;
    const check = (): void => {
      if (!me.alive) throw ABORTED;
    };
    const die = (): number => this.forced.shift() ?? 1 + Math.floor(Math.random() * 6);

    const stage = async (intents: Intent[], cause: Cause): Promise<void> => {
      for (const intent of intents) {
        check();
        const effect = this.apply(intent);
        let shown = false;
        const commit = (): void => {
          if (shown) return;
          shown = true;
          this.changed();
        };
        await P.step(effect, commit, cause);
        check();
        commit();
        if (this.s.crisis <= 1) {
          await P.phase({ kind: 'end', why: 'war' });
          throw ABORTED;
        }
      }
    };

    const take = (id: string, by: SideIndex): void => {
      const pile = by === 0 ? s().hand : s().opponentCards;
      const i = pile.indexOf(id);
      if (i >= 0) pile.splice(i, 1);
      s().played = { card: id, by };
      this.changed();
    };
    const leave = (play: Play): void => {
      s().played = null;
      s()[play.pile].push(play.card.id);
      this.changed();
    };
    const makePlay = (by: SideIndex, card: PlayCard, verb: Verb, extra: Partial<Play> = {}): Play => ({
      by, card, verb,
      use: verb === 'event' || verb === 'space' ? verb : 'ops',
      points: card.value,
      // a card that is played once leaves the game when its event has happened
      pile: card.once && (verb === 'event' || extra.fires) ? 'removed' : 'discard',
      ...extra,
    });

    // No engine reads the cards' texts yet: an event is staged, and says that nothing changes.
    const runEvent = (play: Play, by: SideIndex): Promise<void> => stage([{ t: 'note', text: this.t.eventNote(play.card.title) }], { verb: 'event', by, card: play.card.id });

    const runCoup = async (play: Play, id: string): Promise<void> => {
      const roll = die();
      const p = this.coupPreview(play.by, id, play.points);
      const row = p.table[roll - 1];
      const name = this.country(id).name;
      await P.roll({
        kind: 'coup', by: play.by, card: play.card.id, id,
        dice: [{ side: play.by, value: roll, mods: [{ label: this.t.ops, n: play.points }], total: roll + play.points }],
        bar: { label: this.t.bar(p.stability), n: p.bar },
        need: p.need, chance: p.chance, ok: row.ok,
        text: row.ok ? this.t.coupOk(row.net) : this.t.coupFail,
      });
      check();
      const intents: Intent[] = [];
      if (row.remove) intents.push({ t: 'inf', id, side: other(play.by), d: -row.remove });
      if (row.add) intents.push({ t: 'inf', id, side: play.by, d: row.add });
      if (!row.ok) intents.push({ t: 'note', id, text: this.t.coupFailNote(name) });
      intents.push({ t: 'milops', side: play.by, d: play.points, why: this.t.coupMilops });
      if (p.key) intents.push({ t: 'crisis', d: -1, id, why: this.t.coupCrisis(name) });
      await stage(intents, { verb: 'coup', by: play.by, card: play.card.id, id });
    };

    const runRealign = async (play: Play, id: string, left: number): Promise<void> => {
      const rolls: [number, number] = [die(), die()];
      const mods = this.realignMods(id);
      const totals = [rolls[0] + sum(mods[0]), rolls[1] + sum(mods[1])];
      const diff = totals[0] - totals[1];
      const loser: SideIndex | null = diff > 0 ? 1 : diff < 0 ? 0 : null;
      const lose = loser === null ? 0 : Math.min(Math.abs(diff), this.inf(id)[loser]);
      await P.roll({
        kind: 'realign', by: play.by, card: play.card.id, id, left,
        dice: ([0, 1] as const).map((side) => ({ side, value: rolls[side], mods: mods[side], total: totals[side] })),
        ok: loser === other(play.by),
        winner: loser === null ? null : other(loser),
        text: loser === null ? this.t.tie : this.t.wins(this.sideName(other(loser)), Math.abs(diff)),
      });
      check();
      const intent: Intent = lose && loser !== null ? { t: 'inf', id, side: loser, d: -lose } : { t: 'note', id, text: loser === null ? this.t.tieNote : this.t.nothingLeft(this.country(id).name) };
      await stage([intent], { verb: 'realign', by: play.by, card: play.card.id, id });
    };

    const runSpace = async (play: Play): Promise<void> => {
      const at = s().space[play.by];
      const step = this.o.rules.space[at];
      const roll = die();
      const ok = roll <= step.rollMax;
      s().spaceTried[play.by] = true;
      await P.roll({
        kind: 'space', by: play.by, card: play.card.id,
        dice: [{ side: play.by, value: roll, mods: [], total: roll }],
        max: step.rollMax, chance: step.rollMax / 6, ok,
        text: ok ? this.t.spaceOk : this.t.spaceFail,
      });
      check();
      const intents: Intent[] = ok ? [{ t: 'space', side: play.by, d: 1 }] : [{ t: 'note', text: this.t.spaceFailNote }];
      // what the step is worth depends on who got there first
      const first = s().space[other(play.by)] <= at;
      const vp = ok ? step.vp[first ? 0 : 1] : 0;
      if (vp) intents.push({ t: 'vp', side: play.by, d: vp, why: first ? this.t.spaceFirst : this.t.spaceSecond });
      await stage(intents, { verb: 'space', by: play.by, card: play.card.id });
    };

    /** The opponent's event goes off after the player has used their card for operations. */
    const fire = async (play: Play): Promise<void> => {
      if (!play.fires) return;
      await P.trigger(play);
      check();
      await runEvent(play, 1);
    };

    const placeSession = (play: Play): PlaceSession => {
      const base = structuredClone(s().inf);
      const spent: { id: string; cost: number }[] = [];
      const left = (): number => play.points - spent.reduce((a, x) => a + x.cost, 0);
      const targets = (): Map<string, { cost: number; ok: boolean }> => new Map([...this.placeTargets(play.by, base)].map(([id, v]) => [id, { cost: v.cost, ok: v.cost <= left() }]));
      return {
        side: play.by,
        points: play.points,
        spent,
        get left() {
          return left();
        },
        count: (id) => spent.filter((x) => x.id === id).length,
        targets,
        add: (id) => {
          const t = targets().get(id);
          if (!t?.ok) return null;
          const effect = this.apply({ t: 'inf', id, side: play.by, d: 1 });
          spent.push({ id, cost: t.cost });
          this.changed();
          return effect;
        },
        undo: () => {
          const last = spent.pop();
          if (!last) return false;
          this.apply({ t: 'inf', id: last.id, side: play.by, d: -1 });
          this.changed();
          return true;
        },
      };
    };

    /** One play by the player, from the decision on. False: backed out before anything happened. */
    const playerPlay = async (d: Decision): Promise<boolean> => {
      const card = this.card(d.card);
      const o = this.options(d.card);
      const verb: Verb = d.use === 'ops' ? d.mode ?? 'place' : d.use;
      const play = makePlay(0, card, verb, { fires: d.use === 'ops' && o.fires });
      const index = s().hand.indexOf(d.card);
      if (index < 0) return false;
      const back = async (): Promise<boolean> => {
        s().played = null;
        s().hand.splice(index, 0, d.card);
        this.changed();
        await P.settle({ ...play, cancelled: true });
        return false;
      };
      take(d.card, 0);
      await P.announce(play);
      check();
      if (verb === 'event') await runEvent(play, 0);
      else if (verb === 'space') await runSpace(play);
      else if (verb === 'place') {
        const session = placeSession(play);
        if (d.target) session.add(d.target);
        const ok = await P.place(session, play);
        check();
        if (!ok || !session.spent.length) {
          while (session.undo());
          return back();
        }
        await fire(play);
      } else if (verb === 'coup') {
        const t = this.coupTargets(0, card.value);
        const id = d.target && t.ok.has(d.target) ? d.target : await P.pickTarget({ mode: 'coup', by: 0, card: d.card, targets: t.ok, locked: t.locked, left: 1, total: 1, optional: false, cancel: true });
        check();
        if (!id) return back();
        play.target = id;
        await runCoup(play, id);
        await fire(play);
      } else {
        let rolled = 0;
        for (let i = 0; i < card.value; i++) {
          const t = this.realignTargets(0);
          if (!t.ok.size) break;
          const id = i === 0 && d.target && t.ok.has(d.target) ? d.target : await P.pickTarget({ mode: 'realign', by: 0, card: d.card, targets: t.ok, locked: t.locked, left: card.value - i, total: card.value, optional: i > 0, cancel: i === 0 });
          check();
          if (!id) break;
          play.target = id;
          rolled++;
          await runRealign(play, id, card.value - i - 1);
        }
        if (!rolled) return back();
        await fire(play);
      }
      check();
      await P.settle(play);
      leave(play);
      return true;
    };

    const playerTurn = async (): Promise<void> => {
      for (;;) {
        check();
        const d = await P.decide();
        check();
        if (await playerPlay(d)) return;
      }
    };

    /** The opponent takes its first card and does something legal with it: a different thing each round. */
    const opponentTurn = async (round: number): Promise<void> => {
      const id = s().opponentCards[0];
      if (!id) return;
      const card = this.card(id);
      const o = this.options(id, 1);
      const wish: Verb[] = [['place', 'coup', 'realign', 'space', 'event'] as Verb[], ['coup', 'place'] as Verb[], ['realign', 'place'] as Verb[], ['space', 'place'] as Verb[], ['event'] as Verb[]][(round - 1) % 5];
      const can = (v: Verb): boolean => (v === 'event' ? card.owner !== 'mine' || card.value === 0 : v === 'space' ? o.space.ok : o[v].ok);
      const verb = wish.find(can) ?? (['place', 'coup', 'realign', 'space', 'event'] as Verb[]).find(can) ?? 'event';
      const best = <T,>(m: Map<string, T>, score: (id: string, v: T) => number): string => [...m].sort((a, b) => score(b[0], b[1]) - score(a[0], a[1]))[0][0];
      const play = makePlay(1, card, verb);
      if (verb === 'coup') play.target = best(o.coup.targets, (_id, p) => p.chance * 10 + (p.key && this.s.crisis > 3 ? 2 : 0));
      if (verb === 'realign') play.target = best(o.realign.targets, (_id, p) => -p.edge);
      take(id, 1);
      await P.announce(play);
      check();
      if (verb === 'event') await runEvent(play, 1);
      else if (verb === 'space') await runSpace(play);
      else if (verb === 'place') {
        // the points go one at a time to the best of what can be afforded, at most two to a country;
        // nothing changes until it is staged, one country at a time
        const put = new Map<string, number>();
        let left = card.value;
        for (;;) {
          const open = new Map([...o.place.targets].filter(([cid, v]) => v.cost <= left && (put.get(cid) ?? 0) < 2));
          if (!open.size) break;
          const cid = best(open, (c, v) => (this.countries.get(c)!.key ? 3 : 0) + (this.inf(c)[1] > 0 ? 1 : 0) - v.cost + this.inf(c)[0] * 0.2);
          put.set(cid, (put.get(cid) ?? 0) + 1);
          left -= open.get(cid)!.cost;
        }
        await stage([...put].map(([cid, d]) => ({ t: 'inf' as const, id: cid, side: 1 as const, d })), { verb: 'place', by: 1, card: id });
      } else if (verb === 'coup') await runCoup(play, play.target!);
      else {
        for (let i = 0; i < card.value; i++) {
          if (!this.realignTargets(1).ok.has(play.target!)) break;
          await runRealign(play, play.target!, card.value - i - 1);
        }
      }
      check();
      await P.settle(play);
      leave(play);
    };

    const headline = async (): Promise<void> => {
      s().round = 1;
      s().active = 0;
      this.changed();
      await P.phase({ kind: 'headline' });
      check();
      const mine = await P.pickHeadline();
      check();
      const theirs = s().opponentCards[0];
      const order = [{ card: mine, by: 0 as SideIndex }, ...(theirs ? [{ card: theirs, by: 1 as SideIndex }] : [])].sort((a, b) => this.card(b.card).value - this.card(a.card).value || a.by - b.by);
      // both cards leave their hands, face down, before either is seen
      s().hand.splice(s().hand.indexOf(mine), 1);
      if (theirs) s().opponentCards.shift();
      this.changed();
      if (theirs) await P.showHeadline({ mine, theirs, order });
      for (const turn of order) {
        check();
        const play = makePlay(turn.by, this.card(turn.card), 'event', { headline: true });
        s().played = { card: turn.card, by: turn.by };
        this.changed();
        await P.announce(play);
        check();
        await runEvent(play, turn.by);
        check();
        await P.settle(play);
        leave(play);
      }
    };

    const nextTurn = (): void => {
      const st = s();
      st.turn = st.turn >= this.o.rules.turns ? 1 : st.turn + 1;
      st.round = 1;
      st.crisis = clamp(st.crisis + 1, 1, this.o.rules.crisis.length);
      st.milops = [0, 0];
      st.spaceTried = [false, false];
      for (const pile of [st.hand, st.opponentCards])
        while (pile.length < HAND_SIZE) {
          if (!st.deck.length) st.deck = st.discard.splice(0);
          const id = st.deck.shift();
          if (!id) break;
          pile.push(id);
        }
      this.changed();
    };

    (async () => {
      let first = from;
      for (;;) {
        if (first === 'headline') await headline();
        for (let r = 1; r <= this.o.rules.rounds; r++) {
          check();
          s().round = r;
          if (!(first === 'action' && r === 1)) {
            s().active = 1;
            this.changed();
            await P.phase({ kind: 'round', round: r, who: 1 });
            check();
            await opponentTurn(r);
          }
          check();
          if (!s().hand.length) break;
          s().active = 0;
          this.changed();
          await P.phase({ kind: 'round', round: r, who: 0 });
          await playerTurn();
        }
        check();
        nextTurn();
        await P.phase({ kind: 'turn', turn: s().turn });
        first = 'headline';
      }
    })().catch((err) => {
      if (err !== ABORTED) console.error(err);
    });
  }
}
