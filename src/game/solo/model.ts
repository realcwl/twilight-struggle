import { translateDictionary } from '../../i18n/index.js';
import catalog from "../../cards/catalog.json";
import type { Card } from "../../cards/deck";
import type { HudState, SideIndex } from "../../hud/types";
import type { MapState, Scenario } from "../../map/types";
import type { Effect, ScoringReport, ScoringSummary } from "../../play/types";
import { standingOf, scoringFromCards } from "../regions";
import { effectLine, battleLogFor, BATTLE_PHASES, type BattleEntry, type BattleLine } from '../history';
import { passiveEffects, restorePassives, type PassiveSource } from './passives';

export const CARDS: readonly Card[] = catalog.map((c) => ({
  id: String(c.id).padStart(3, "0"),
  kind: c.side === "scoring" ? "tally" : (c.side as Card["kind"]),
  era: c.era === "mid" ? "middle" : (c.era as Card["era"]),
  value: c.ops,
  title: c.titleZh,
  once: c.once,
  optional: c.optional,
  persistent: c.persistent,
  special: c.id === 6,
}));
export const RAW = new Map(
  catalog.map((c) => [String(c.id).padStart(3, "0"), c]),
);
export const CARD = new Map(CARDS.map((c) => [c.id, c]));
export const other = (s: SideIndex): SideIndex => (s === 0 ? 1 : 0);
export const clamp = (n: number, a: number, b: number): number =>
  Math.min(b, Math.max(a, n));
export const REGIONS: Record<string, string> = {
  "001": "asia",
  "002": "europe",
  "003": "mideast",
  "037": "camerica",
  "038": "southeast-asia",
  "079": "africa",
  "081": "samerica",
};
type ScoringOptions = { eventModifiers?: boolean; shuttleCountry?: string };
export type Result = {
  winner: SideIndex | null;
  reason:
    | "vp"
    | "europe"
    | "defcon"
    | "held-scoring"
    | "final"
    | "wargames"
    | "missile-crisis"
    | "resign";
  detail: string;
};
export type Intent =
  | { t: "inf"; id: string; side: SideIndex; d: number }
  | { t: "crisis"; d: number; why?: string }
  | { t: "vp"; side: SideIndex; d: number; why?: string }
  | { t: "space"; side: SideIndex; d: number; why?: string }
  | { t: "milops"; side: SideIndex; d: number; why?: string }
  | { t: "note"; text: string; id?: string };
export type Flags = Record<string, number | string | boolean>;
export type MatchState = {
  version: 1;
  knownHands?: [string[], string[]];
  /** Identities each seat has seen, retained across transfers, reshuffles and saves. */
  seenCards?: [string[], string[]];
  seed: number;
  rng: number;
  turn: number;
  round: number;
  active: SideIndex;
  phase: "setup" | "headline" | "action" | "cleanup" | "end";
  vp: number;
  crisis: number;
  milops: [number, number];
  space: [number, number];
  attempts: [number, number];
  actions: [number, number];
  hands: [string[], string[]];
  deck: string[];
  /** Public shuffle counter; reveals neither deck order nor anyone's hand. */
  deckRecycles?: number;
  discard: string[];
  removed: string[];
  inPlay: string[];
  future: string[];
  china: { owner: SideIndex; available: boolean };
  inf: Record<string, [number, number]>;
  flags: Flags;
  passiveSources?: PassiveSource[];
  temp: Flags;
  headlines: [string | null, string | null];
  headlineDone: boolean;
  played: { card: string; by: SideIndex } | null;
  result: Result | null;
  log: string[];
  battleLog?: BattleEntry[];
  dealtEras: string[];
};
export class Match {
  s: MatchState;
  /** Runtime nesting only; durable replay rebuilds it from the checkpoint. */
  battleContext: number | null = null;
  readonly countries: Map<string, Scenario["countries"][number]>;
  readonly ids: string[];
  readonly adj = new Map<string, string[]>();
  readonly home: [string, string] = ["usa", "ussr"];
  constructor(
    readonly scenario: Scenario,
    seed = Date.now() >>> 0,
    snapshot?: MatchState,
  ) {
    this.countries = new Map(scenario.countries.map((c) => [c.id, c]));
    this.ids = scenario.countries
      .filter((c) => c.superpower === undefined)
      .map((c) => c.id);
    for (const c of scenario.countries) {
      this.adj.set(c.id, []);
      if (c.superpower !== undefined) this.home[c.superpower] = c.id;
    }
    for (const l of scenario.links) {
      this.adj.get(l.a)!.push(l.b);
      this.adj.get(l.b)!.push(l.a);
    }
    this.s = snapshot
      ? structuredClone(snapshot)
      : {
          version: 1,
          seed,
          rng: seed,
          turn: 1,
          round: 0,
          active: 1,
          phase: "setup",
          vp: 0,
          crisis: 5,
          milops: [0, 0],
          space: [0, 0],
          attempts: [0, 0],
          actions: [0, 0],
          hands: [[], []],
          seenCards: [[], []],
          deck: [],
          discard: [],
          removed: [],
          inPlay: [],
          future: [],
          china: { owner: 1, available: true },
          inf: Object.fromEntries(
            this.ids.map((id) => [id, [0, 0] as [number, number]]),
          ),
          flags: {},
          passiveSources: [],
          temp: {},
          headlines: [null, null],
          headlineDone: false,
          played: null,
          result: null,
          log: [],
          battleLog: [],
          dealtEras: ["early"],
        };
    if (snapshot) {
      this.validate();
      restorePassives(this.s);
      if (!this.s.battleLog) {
        this.s.battleLog = [];
        for (const line of this.s.log) {
          const turn = Number(/^T(\d+)/.exec(line)?.[1] ?? this.s.turn);
          const last = this.s.battleLog.at(-1);
          if (last?.turn === turn) last.lines.push({ kind: 'note', text: line.replace(/^T\d+ · /, '') });
          else this.s.battleLog.push({ id: this.s.battleLog.length + 1, turn, round: 0, phase: 'action', by: null, kind: 'legacy', title: '旧存档记录', status: 'resolved', lines: [{ kind: 'note', text: line.replace(/^T\d+ · /, '') }] });
        }
      }
      this.restoreSeenCards();
      return;
    }
    this.s.deck = CARDS.filter((c) => c.era === "early" && !c.special).map(
      (c) => c.id,
    );
    this.s.future = CARDS.filter((c) => c.era !== "early" && !c.special).map(
      (c) => c.id,
    );
    const set = (side: SideIndex, places: Record<string, number>) => {
      for (const [id, n] of Object.entries(places))
        if (this.s.inf[id]) this.s.inf[id][side] = n;
    };
    set(1, { syr: 1, irq: 1, prk: 3, gdr: 3, fin: 1 });
    set(0, {
      can: 2,
      irn: 1,
      isr: 1,
      jpn: 1,
      aus: 4,
      phl: 1,
      kor: 1,
      pan: 1,
      zaf: 1,
      gbr: 5,
    });
    this.shuffle(this.s.deck);
    this.deal();
    this.log("对局开始 · 美国对苏联");
  }
  random(): number {
    let t = (this.s.rng = (this.s.rng + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  die(): number {
    return 1 + Math.floor(this.random() * 6);
  }
  shuffle<T>(a: T[]): void {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  }
  beginBattle(data: Pick<BattleEntry, 'kind' | 'title' | 'by'> & Partial<Pick<BattleEntry, 'card' | 'verb' | 'status'>>): number {
    if (data.card) this.rememberCards(null, [data.card]);
    const id = (this.s.battleLog?.at(-1)?.id ?? 0) + 1;
    const entry: BattleEntry = { id, turn: this.s.turn, round: this.s.round, phase: this.s.phase, status: 'resolved', lines: [], ...data };
    this.s.battleLog = [...(this.s.battleLog ?? []), entry];
    return id;
  }
  updateBattle(id: number, update: Partial<BattleEntry>): void {
    this.s.battleLog = (this.s.battleLog ?? []).map(e => e.id === id ? { ...e, ...update } : e);
  }
  recordBattle(line: BattleLine): void {
    let id = this.battleContext;
    if (id === null) {
      const last = this.s.battleLog?.at(-1);
      id = last?.kind === 'system' && last.turn === this.s.turn && last.round === this.s.round && last.phase === this.s.phase && last.by === null
        ? last.id : this.beginBattle({ kind: 'system', by: null, title: BATTLE_PHASES[this.s.phase] });
    }
    const entry = this.s.battleLog?.find(e => e.id === id);
    if (entry) this.updateBattle(id, { lines: [...entry.lines, line] });
  }
  /** Immutable snapshot: subsequent draws, discards or new revelations cannot rewrite it. */
  recordReveal(viewer: SideIndex, ids: readonly string[], label: string): void {
    const cards = [...ids];
    this.rememberCards(viewer, cards);
    this.recordBattle({ kind: 'reveal', reveal: { viewer, label, cards },
      text: `当时看到的${label} · ${cards.length} 张${cards.length ? `：${cards.map(id => `《${CARD.get(id)!.title}》`).join('、')}` : '（没有符合条件的牌）'}` });
  }
  recordEffect(effect: Effect, cost?: number): void {
    this.recordBattle(effectLine(effect, id => this.countries.get(id)?.name.zh ?? id, cost));
  }
  log(text: string, record = true): void {
    this.s.log.push(`T${this.s.turn} · ${text}`);
    if (record) this.recordBattle({ kind: 'note', text });
    if (this.s.log.length > 600) this.s.log.shift();
  }
  inf(id: string): [number, number] {
    const v = this.s.inf[id];
    if (!v) throw new Error(`非可行动国家：${id}`);
    return v;
  }
  control(id: string): SideIndex | null {
    const c = this.countries.get(id);
    if (!c) throw new Error(`未知国家 ${id}`);
    if (c.superpower !== undefined) return c.superpower;
    const [a, b] = this.inf(id);
    return a - b >= c.stability ? 0 : b - a >= c.stability ? 1 : null;
  }
  region(id: string, r: string): boolean {
    const c = this.countries.get(id);
    return c?.region === r || !!c?.subregions?.some((x) => x === r);
  }
  owned(id: string): SideIndex | null {
    const c = CARD.get(id)!;
    return c.kind === "us" ? 0 : c.kind === "ussr" ? 1 : null;
  }
  has(key: string): boolean {
    return !!this.s.flags[key] || !!this.s.temp[key];
  }
  privilege(side: SideIndex, step: number): boolean {
    return this.s.space[side] >= step && this.s.space[other(side)] < step;
  }
  modifiedOps(n: number, side: SideIndex): number {
    return n ? clamp(n + Number(this.s.temp[`ops${side}`] ?? 0), 1, 4) : 0;
  }
  ops(id: string, side: SideIndex): number {
    return this.modifiedOps(CARD.get(id)!.value, side);
  }
  hand(side: SideIndex, china = true): string[] {
    return [
      ...this.s.hands[side],
      ...(china && this.s.china.owner === side && this.s.china.available
        ? ["006"]
        : []),
    ];
  }
  rounds(side: SideIndex): number {
    return this.privilege(side, 8) || (side === 0 && this.s.temp.northSea)
      ? 8
      : this.s.turn <= 3
        ? 6
        : 7;
  }
  draw(side: SideIndex, n = 1): void {
    let drawn = 0;
    for (let i = 0; i < n; i++) {
      if (!this.s.deck.length) {
        this.rememberCards(null, this.s.discard);
        this.s.deck = this.s.discard.splice(0);
        if (this.s.deck.length) this.s.deckRecycles = (this.s.deckRecycles ?? 0) + 1;
        this.shuffle(this.s.deck);
      }
      const id = this.s.deck.shift();
      if (!id) break;
      this.s.hands[side].push(id);
      this.rememberCards(side, [id]);
      drawn++;
    }
    if (drawn) this.recordBattle({ kind: 'note', text: `${side === 0 ? '美国' : '苏联'}摸 ${drawn} 张牌 · 手牌 ${this.s.hands[side].length} 张` });
  }
  deal(): void {
    for (const side of [1, 0] as const)
      this.draw(
        side,
        Math.max(0, (this.s.turn <= 3 ? 8 : 9) - this.s.hands[side].length),
      );
  }
  take(id: string, side: SideIndex): void {
    if (id === "006") {
      if (this.s.china.owner !== side || !this.s.china.available)
        throw new Error("中国牌不可用");
      this.s.china.available = false;
    } else {
      const i = this.s.hands[side].indexOf(id);
      if (i < 0) throw new Error("手中没有这张牌");
      this.s.hands[side].splice(i, 1);
    }
    this.s.played = { card: id, by: side };
    this.rememberCards(null, [id]);
  }
  discard(id: string, record = true): void {
    if (id === "006") return;
    this.rememberCards(null, [id]);
    if (!this.s.discard.includes(id)) {
      this.s.discard.push(id);
      if (record) this.recordBattle({ kind: 'note', text: `《${CARD.get(id)!.title}》进入弃牌堆` });
    }
  }
  settle(id: string, side: SideIndex, event: boolean): void {
    this.rememberCards(null, [id]);
    if (id === "006") {
      this.s.china = { owner: other(side), available: false };
      if (side === 0) delete this.s.flags.formosan;
    } else if (this.s.inPlay.includes(id)) {
    } else if (event && CARD.get(id)!.once) this.s.removed.push(id);
    else this.discard(id);
    this.s.played = null;
  }
  end(
    winner: SideIndex | null,
    reason: Result["reason"],
    detail: string,
  ): void {
    if (this.s.result) return;
    this.s.result = { winner, reason, detail };
    this.s.phase = "end";
    this.log(
      `${winner === null ? "平局" : winner === 0 ? "美国获胜" : "苏联获胜"} · ${detail}`,
    );
  }
  checkWin(): void {
    if (this.s.result) return;
    if (this.s.crisis === 1)
      this.end(
        other(this.s.active),
        "defcon",
        `${this.s.active === 0 ? "美国" : "苏联"}行动中触发核战`,
      );
    else if (this.s.vp >= 20) this.end(0, "vp", "达到 20 胜利点");
    else if (this.s.vp <= -20) this.end(1, "vp", "达到 20 胜利点");
  }
  apply(e: Intent, check = true, record = true): Effect {
    let result: Effect;
    if (e.t === "inf") {
      const v = this.inf(e.id),
        from = v[e.side],
        ctrlFrom = this.control(e.id);
      v[e.side] = Math.max(0, from + e.d);
      result = {
        ...e,
        d: v[e.side] - from,
        from,
        to: v[e.side],
        ctrlFrom,
        ctrlTo: this.control(e.id),
      };
    } else if (e.t === "crisis") {
      const from = this.s.crisis;
      this.s.crisis = clamp(from + e.d, 2, 5);
      if (from !== 2 && this.s.crisis === 2 && this.s.phase === "action")
        this.s.temp.noradPending = true;
      result = { ...e, d: this.s.crisis - from, from, to: this.s.crisis,
        why: from + e.d < 2 ? `${e.why ?? '核危机'} · 安全下限2级` : e.why };
    } else if (e.t === "vp") {
      const from = this.s.vp;
      this.s.vp += e.side === 0 ? e.d : -e.d;
      result = { ...e, from, to: this.s.vp };
    } else if (e.t === "space" || e.t === "milops") {
      const v = this.s[e.t],
        from = v[e.side];
      v[e.side] = clamp(from + e.d, 0, e.t === "space" ? 8 : 5);
      result = { ...e, from, to: v[e.side] };
    } else result = e;
    if (record) this.recordEffect(result);
    if (check) this.checkWin();
    return result;
  }
  /** Formosan Resolution is a scoring bonus, not a DEFCON-triggering battleground. */
  scoringKey(id: string): boolean {
    return (this.countries.get(id)?.key ?? false) ||
      (id === "twn" && this.has("formosan") && this.control(id) === 0);
  }
  /** One public calculation drives the totals, animation, and subsequent score. */
  scoring(region: string, final = false, options: ScoringOptions = {}): ScoringReport {
    const special = region === "southeast-asia";
    const eventModifiers = options.eventModifiers !== false;
    const rule = special ? null : scoringFromCards(this.scenario.regions)[region];
    if (!special && !rule) throw new Error(`没有计分规则 ${region}`);
    const members = this.ids.filter(id => this.region(id, region));
    const key = (id: string) => eventModifiers ? this.scoringKey(id) : this.countries.get(id)!.key;
    const allKeys = members.filter(key).length;
    const shuttleTargets = eventModifiers && !final && this.has('shuttle') && ['asia', 'mideast'].includes(region)
      ? members.filter(id => key(id) && this.control(id) === 1) : [];
    const adjacentTarget = shuttleTargets.find(id => this.adj.get(id)!.includes(this.home[0]));
    if (options.shuttleCountry && !shuttleTargets.includes(options.shuttleCountry)) throw new Error('穿梭外交目标不合法');
    const shuttleCountry = options.shuttleCountry ?? adjacentTarget ?? shuttleTargets[0];
    const shuttleChoicePending = !!adjacentTarget && shuttleTargets.length > 1 && !options.shuttleCountry;
    const sides = ([0, 1] as const).map(side => {
      const countries = members.filter(id => this.control(id) === side).map(id => ({
        id, key: key(id),
        adjacent: this.adj.get(id)!.includes(this.home[other(side)]),
        points: special ? (id === "tha" ? 2 : 1) : 0,
      }));
      const keys = countries.filter(c => c.key).length;
      const deducted = side === 1 && shuttleCountry ? 1 : 0;
      return {
        countries, held: countries.length - deducted, keys: keys - deducted,
        adjacent: countries.filter(c => c.adjacent && c.id !== shuttleCountry).length,
        base: 0 as number | 'win', deducted,
      };
    });
    const standing = ([0, 1] as const).map(side =>
      special ? (sides[side].held ? 'presence' : 'none') : standingOf(sides[side], sides[other(side)], allKeys)
    ) as ScoringReport['standing'];
    const totals: [number, number] = [0, 0];
    let winner: SideIndex | null = null;
    for (const side of [0, 1] as const) {
      const held = sides[side], rank = standing[side];
      if (special) totals[side] = held.countries.reduce((n, c) => n + c.points, 0);
      else if (rank === 'none') held.adjacent = 0;
      else {
        held.base = rule![rank];
        if (held.base === 'win') winner = side;
        else totals[side] = held.base + held.keys + held.adjacent;
      }
    }
    const formosan = eventModifiers && region === 'asia' && this.scoringKey('twn');
    const notes: ScoringReport['notes'] = [];
    if (formosan) notes.push({ zh: '台湾决议：美国控制的台湾计为战场国。', en: 'Formosan Resolution: US-controlled Taiwan counts as a battleground.' , es: translateDictionary('台湾决议：美国控制的台湾计为战场国。', 'es') });
    if (shuttleCountry) {
      const name = this.countries.get(shuttleCountry)!.name;
      const adjacent = this.adj.get(shuttleCountry)!.includes(this.home[0]);
      notes.push({
        zh: `穿梭外交：${shuttleChoicePending ? `按排除${name.zh}预览；结算时由美国选择。` : `排除${name.zh}。`}苏联国家数、战场国数各 −1${adjacent ? '，邻接加分 −1' : ''}；实际控制权不变。`,
        en: `Shuttle Diplomacy: ${shuttleChoicePending ? `preview excludes ${name.en}; the US chooses when scoring.` : `exclude ${name.en}.`} Soviet country and battleground counts −1${adjacent ? ', adjacency bonus −1' : ''}; ownership is unchanged.`,
       es: translateDictionary(`穿梭外交：${shuttleChoicePending ? `按排除${name.zh}预览；结算时由美国选择。` : `排除${name.zh}。`}苏联国家数、战场国数各 −1${adjacent ? '，邻接加分 −1' : ''}；实际控制权不变。`, 'es') });
    }
    return {
      region, name: this.scenario.regions.find(r => r.id === region)?.name ?? { zh: '东南亚', en: 'Southeast Asia' , es: translateDictionary('东南亚', 'es') },
      final, members, rule, allKeys, vpBefore: this.s.vp, totals, winner, standing, sides,
      formosan, ...(shuttleCountry ? { shuttleCountry } : {}), shuttleChoicePending, notes,
    };
  }
  score(region: string, final = false, options: ScoringOptions = {}): Intent[] {
    const result = this.scoring(region, final, options);
    const regionName = this.scenario.regions.find(r => r.id === region)?.name.zh ?? "东南亚";
    const ranks: Record<string, string> = { none: '无存在', presence: '存在', domination: '支配', control: '控制' };
    for (const side of [0, 1] as const) {
      const countries = this.ids.filter(id => this.region(id, region) && this.control(id) === side)
        .map(id => this.countries.get(id)!.name.zh).join('、') || '无';
      const rank = region === 'southeast-asia' ? '逐国计分' : ranks[result.standing[side]];
      this.recordBattle({ kind: 'score', text: `${regionName} · ${side === 0 ? '美国' : '苏联'}：${rank} · 控制国家：${countries} · ${result.winner === side ? '直接获胜' : `${result.totals[side]} VP`}`,
        // display only: the whole calculation, for the battle log to lay out as a table
        ...(side === 0 ? { scoring: structuredClone(result) } : {}) });
    }
    for (const note of result.notes) this.recordBattle({ kind: 'score', text: note.zh });
    if (result.winner !== null) this.end(result.winner, "europe", "控制欧洲");
    if (!final && this.has("shuttle") && ["asia", "mideast"].includes(region)) {
      delete this.s.flags.shuttle;
      this.s.inPlay = this.s.inPlay.filter((id) => id !== "073");
      this.discard("073");
    }
    this.log(
      `${this.scenario.regions.find(r => r.id === region)?.name.zh ?? "东南亚"}计分：美国 ${result.totals[0]} / 苏联 ${result.totals[1]}`,
    );
    return [
      {
        t: "vp",
        side: 0,
        d: result.totals[0] - result.totals[1],
        why: `${this.scenario.regions.find((r) => r.id === region)?.name.zh ?? "东南亚"}计分`,
      },
    ];
  }
  nextTurn(): void {
    const expiring = passiveEffects(this.s);
    this.s.turn++;
    this.s.round = 0;
    this.s.active = 1;
    this.s.phase = "headline";
    this.apply({ t: "crisis", d: 1, why: "新回合缓和" });
    this.s.milops = [0, 0];
    this.s.attempts = [0, 0];
    this.s.actions = [0, 0];
    this.s.temp = {};
    for (const e of expiring.filter(e => !passiveEffects(this.s).some(a => a.id === e.id))) this.recordBattle({ kind: 'passive', text: `《${e.title.zh}》回合效果到期` });
    this.s.headlines = [null, null];
    this.s.headlineDone = false;
    this.s.china.available = true;
    const era =
      this.s.turn === 4 ? "middle" : this.s.turn === 8 ? "late" : null;
    if (era && !this.s.dealtEras.includes(era)) {
      const add = this.s.future.filter((id) => CARD.get(id)!.era === era);
      this.s.future = this.s.future.filter((id) => !add.includes(id));
      this.s.deck.push(...add);
      this.shuffle(this.s.deck);
      this.s.dealtEras.push(era);
    }
    this.deal();
    this.log(`第 ${this.s.turn} 回合发牌`);
  }
  mapState(): MapState {
    return {
      countries: Object.fromEntries(
        this.scenario.countries.map((c) => [
          c.id,
          {
            influence:
              c.superpower === undefined
                ? ([...this.inf(c.id)] as [number, number])
                : [0, 0],
            controller: this.control(c.id),
            scoringKey: this.scoringKey(c.id),
          },
        ]),
      ),
      regions: Object.fromEntries([...this.scenario.regions.map(r => r.id), 'southeast-asia'].map(id => {
        const report = this.scoring(id, this.s.result?.reason === 'final');
        const { name: _name, members: _members, vpBefore: _vp, sides, ...values } = report;
        const scoring: ScoringSummary = { ...values, sides: sides.map(({ countries: _countries, ...counts }) => counts) };
        return [id, { status: ['', ''], scoring }];
      })),
    } as MapState;
  }
  /** null means publicly revealed; a seat means visible only to that player. */
  rememberCards(side: SideIndex | null, ids: readonly string[]): void {
    const seen = this.s.seenCards ??= [[], []];
    for (const seat of side === null ? [0, 1] as const : [side])
      seen[seat] = [...new Set([...seen[seat], ...ids.filter(id => CARD.has(id))])].sort();
  }
  private restoreSeenCards(): void {
    // Older saves can recover public history, but must never infer private sightings
    // from the opponent's current hand or the hidden deck.
    if (!this.s.seenCards) {
      this.s.seenCards = [[], []];
      const titleIds = new Map(CARDS.map(c => [c.title, c.id]));
      const notes = [...this.s.log];
      for (const entry of this.s.battleLog ?? []) {
        if (entry.card) this.rememberCards(null, [entry.card]);
        for (const line of entry.lines) if (line.kind === 'reveal')
          this.rememberCards(line.reveal.viewer, line.reveal.cards);
        notes.push(...entry.lines.filter(line => line.kind === 'note').map(line => line.text));
      }
      for (const note of notes) {
        if (!note.includes('进入弃牌堆') && !note.includes('双方揭示头条')) continue;
        const ids = [...note.matchAll(/《([^》]+)》/g)].map(m => titleIds.get(m[1])).filter((id): id is string => !!id);
        this.rememberCards(null, ids);
      }
    }
    this.rememberCards(null, [...this.s.discard, ...this.s.removed, ...this.s.inPlay,
      ...this.s.headlines.filter((id): id is string => id !== null), ...(this.s.played ? [this.s.played.card] : [])]);
    for (const side of [0, 1] as const)
      this.rememberCards(side, [...this.s.hands[side], ...(this.s.knownHands?.[other(side)] ?? [])]);
  }
  /** Possible opponent cards, using only own cards and current public locations.
   * Past sightings do not rule out a card after it is recycled or returned to a hand.
   * Never consult the hidden deck or opponent hand to narrow this set. */
  opponentCandidates(side: SideIndex): string[] {
    const unavailable = new Set([
      ...this.s.hands[side], ...this.s.discard, ...this.s.removed, ...this.s.inPlay,
      ...this.s.headlines.filter((id): id is string => id !== null),
      ...(this.s.played ? [this.s.played.card] : []),
    ]);
    return CARDS.filter(c => !c.special && this.s.dealtEras.includes(c.era) && !unavailable.has(c.id))
      .map(c => c.id).sort();
  }
  hudState(side: SideIndex = 0): HudState {
    return {
      turn: this.s.turn,
      round: this.s.round,
      phase: this.s.phase,
      actionLimit: this.rounds(this.s.active),
      active: this.s.active,
      vp: this.s.vp,
      crisis: this.s.crisis,
      milops: [...this.s.milops],
      milopsRequired: this.s.crisis,
      space: [...this.s.space],
      hand: this.hand(side),
      // display only: a China card this side has received but cannot use yet (not the one it is playing)
      held: this.s.china.owner === side && !this.s.china.available && this.s.played?.card !== "006" ? ["006"] : [],
      opponentHand: this.s.hands[other(side)].length,
      deck: this.s.deck.length,
      opponentCandidates: this.opponentCandidates(side),
      deckRecycles: this.s.deckRecycles ?? 0,
      discard: [...this.s.discard],
      removed: [...this.s.removed],
      played: this.s.played,
      passives: passiveEffects(this.s),
      battleLog: battleLogFor(this.s.battleLog ?? [], side),
    };
  }
  snapshot(): MatchState {
    return structuredClone(this.s);
  }
  validate(): void {
    const s = this.s;
    if (
      s.version !== 1 ||
      !Number.isInteger(s.turn) ||
      s.turn < 1 ||
      s.turn > 10 ||
      !Number.isInteger(s.crisis) ||
      s.crisis < 1 ||
      s.crisis > 5
    )
      throw new Error("存档版本或局面无效");
    const all = [
      ...s.hands.flat(),
      ...s.deck,
      ...s.discard,
      ...s.removed,
      ...s.future,
      ...s.inPlay,
      ...s.headlines.filter((id): id is string => !!id),
    ];
    if (s.played && s.played.card !== "006" && !all.includes(s.played.card))
      all.push(s.played.card);
    if (
      new Set(all).size !== all.length ||
      all.some((id) => id === "006" || !CARD.has(id))
    )
      throw new Error("存档卡牌重复或缺失");
    if (all.length !== CARDS.length - 1)
      throw new Error(`牌数不守恒：${all.length}`);
    if (
      !["setup", "headline", "action", "cleanup", "end"].includes(s.phase) ||
      !([0, 1] as number[]).includes(s.active) ||
      !Number.isFinite(s.vp) ||
      !Number.isInteger(s.rng) ||
      !s.china ||
      ![0, 1].includes(s.china.owner) ||
      typeof s.china.available !== "boolean" ||
      !Array.isArray(s.log) ||
      (s.phase === "end") !== !!s.result
    )
      throw new Error("存档阶段或结果无效");
    for (const [values, max] of [
      [s.space, 8],
      [s.milops, 5],
      [s.attempts, 2],
      [s.actions, 8],
    ] as const)
      if (
        !Array.isArray(values) ||
        values.length !== 2 ||
        values.some((v) => !Number.isInteger(v) || v < 0 || v > max)
      )
        throw new Error("存档轨道无效");
    for (const id of this.ids) {
      const v = s.inf[id];
      if (!v || v.length !== 2 || v.some((x) => !Number.isInteger(x) || x < 0))
        throw new Error(`国家影响力无效 ${id}`);
    }
  }
}
