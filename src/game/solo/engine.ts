import type { HudState, SideIndex } from "../../hud/types";
import type { Lang, MapState, Scenario } from "../../map/types";
import {
  ABORTED,
  type CardOptions,
  type CardMove,
  type Cause,
  type CoupPreview,
  type Decision,
  type Modifier,
  type PlaceSession,
  type Play,
  type PlayCard,
  type PlayQueries,
  type Presenter,
  type RealignPreview,
  type Verb,
  type RollSpec,
} from "../../play/types";
import { createHeuristicAgent } from "../ai/heuristic";
import type { Agent, LegalAction, Observation } from "../ai/types";
import {
  CARD,
  RAW,
  REGIONS,
  Match,
  other,
  type MatchState,
  type Intent,
  type Result,
} from "./model";
import { eventAllowed, resolveEvent, type Choice } from "./events";
import { rollLine, cardMoveLine } from '../history';
import { passiveEffects } from './passives';
import { SPACE_RACE } from "../spaceRace";

export type Question = { title: string; options: Choice[] };
export type SoloPresenter = Presenter & {
  choose(q: Question): Promise<string>;
  reveal(ids: string[], title: string): Promise<void>;
  result(result: Result, state: Pick<MatchState, "turn" | "vp" | "log">): Promise<void>;
};
export type SoloOptions = {
  scenario: Scenario;
  lang: Lang;
  seed?: number;
  snapshot?: MatchState;
  agent?: Agent;
  /** Network seats use the same input contract as the local player. Outputs stay on P. */
  remoteInputs?: (side: SideIndex) => SoloPresenter;
  onChange: (hud: HudState, map: MapState) => void;
  onCheckpoint?: (state: MatchState) => void;
  onError?: (error: unknown) => void;
};
const WAR = new Set(["011", "013", "024", "036", "102"]);
const mustScore = (m: Match, side: SideIndex) => {
  const count = m.s.hands[side].filter(id => CARD.get(id)!.kind === "tally").length;
  return count > 0 && count >= Math.max(0, m.rounds(side) - m.s.actions[side]);
};
const sum = (a: Modifier[]) => a.reduce((n, x) => n + x.n, 0);
export class SoloGame implements PlayQueries {
  readonly match: Match;
  readonly agent: Agent;
  private P!: SoloPresenter;
  private alive = false;
  private cause: Cause = { verb: "event", by: 0, card: "001" };
  private depth = 0;
  private phaseBase: Record<string, [number, number]> = {};

  constructor(private readonly o: SoloOptions) {
    this.match = new Match(o.scenario, o.seed, o.snapshot);
    this.agent = o.agent ?? createHeuristicAgent();
  }
  private input(side: SideIndex): SoloPresenter { return this.o.remoteInputs?.(side) ?? this.P; }
  private human(side: SideIndex): boolean { return side === 0 || !!this.o.remoteInputs; }
  get state(): HudState {
    return this.match.hudState();
  }
  get mapState(): MapState {
    return this.match.mapState();
  }
  get crisis(): number {
    return this.match.s.crisis;
  }
  get result(): Result | null {
    return this.match.s.result;
  }
  get snapshot(): MatchState {
    return this.match.snapshot();
  }
  sideName(side: SideIndex): string {
    return this.o.scenario.sides[side].name[this.o.lang];
  }
  country(id: string): ReturnType<PlayQueries["country"]> {
    const c = this.match.countries.get(id)!;
    return {
      id,
      name: c.name[this.o.lang],
      stability: c.stability,
      key: c.key,
      region: c.region,
      influence: c.superpower === undefined ? [...this.match.inf(id)] : [0, 0],
      controller: this.match.control(id),
    };
  }
  card(id: string): PlayCard {
    const c = CARD.get(id);
    if (!c) throw new Error(`未知卡牌 ${id}`);
    return {
      id,
      title: c.title,
      value: c.value,
      owner: c.kind === "us" ? "mine" : c.kind === "ussr" ? "theirs" : c.kind,
      once: c.once,
    };
  }
  private changed(): void {
    this.o.onChange(this.state, this.mapState);
  }
  private checkpoint(): void {
    this.match.validate();
    this.o.onCheckpoint?.(this.snapshot);
    this.changed();
  }
  stop(): void {
    this.alive = false;
  }
  private check(): void {
    if (!this.alive) throw ABORTED;
  }
  private async stage(intents: Intent[]): Promise<void> {
    for (const intent of intents) {
      this.check();
      if (this.result) break;
      const effect = this.match.apply(intent);
      if (effect.t === "note") this.match.log(effect.text, false);
      else if (effect.t === "vp" || effect.t === "crisis")
        this.match.log(
          `${effect.t === "vp" ? "胜利点" : "DEFCON"} ${effect.from} → ${effect.to}${effect.why ? ` · ${effect.why}` : ""}`, false,
        );
      let done = false;
      const commit = () => {
        if (!done) {
          done = true;
          this.changed();
        }
      };
      await this.P.step(effect, commit, this.cause);
      this.check();
      commit();
    }
  }
  private filterRegion(id: string, scope?: string[]): boolean {
    return !scope || scope.some((r) => this.match.region(id, r));
  }
  private protected(
    id: string,
    side: SideIndex,
    mode: "coup" | "realign",
  ): string | null {
    const m = this.match;
    if (side === 1 && id === "jpn" && m.has("japan")) return "美日安保条约";
    if (side === 1 && m.region(id, "europe")) {
      if (mode === "coup" && m.has("reformer"))
        return "改革者禁止苏联在欧洲政变";
      if (
        m.has("nato") &&
        m.control(id) === 0 &&
        !(id === "fra" && m.has("deGaulle")) &&
        !(id === "frg" && m.has("brandt"))
      )
        return "北约保护";
    }
    return null;
  }
  private lock(
    id: string,
    side: SideIndex,
    mode: "coup" | "realign",
    ignore = false,
  ): string | null {
    const protection = this.protected(id, side, mode);
    if (protection) return protection;
    const m = this.match;
    const r = m.countries.get(id)!.region;
    if (
      !ignore &&
      ((r === "europe" && m.s.crisis <= 4) ||
        (r === "asia" && m.s.crisis <= 3) ||
        (r === "mideast" && m.s.crisis <= 2))
    )
      return `DEFCON ${m.s.crisis}：该地区禁止${mode === "coup" ? "政变" : "调整阵营"}`;
    return null;
  }
  placeTargets(
    side: SideIndex,
    base = this.match.s.inf,
    scope?: string[],
  ): Map<string, { cost: number }> {
    const m = this.match;
    return new Map(
      m.ids
        .filter(
          (id) =>
            this.filterRegion(id, scope) &&
            !(
              side === 1 &&
              m.s.temp.chernobyl &&
              m.region(id, String(m.s.temp.chernobyl))
            ) &&
            ((base[id]?.[side] ?? 0) > 0 ||
              m.adj
                .get(id)!
                .some((x) => x === m.home[side] || (base[x]?.[side] ?? 0) > 0)),
        )
        .map((id) => [id, { cost: m.control(id) === other(side) ? 2 : 1 }]),
    );
  }
  private coupMod(side: SideIndex, id: string): number {
    const m = this.match;
    return (
      (m.has("salt") ? -1 : 0) +
      (m.s.temp.deathSquads &&
      ["camerica", "samerica"].some((r) => m.region(id, r))
        ? m.s.temp.deathSquads === side + 1
          ? 1
          : -1
        : 0)
    );
  }
  coupPreview(side: SideIndex, id: string, ops: number): CoupPreview {
    const m = this.match,
      c = m.countries.get(id)!,
      bar = c.stability * 2,
      mod = this.coupMod(side, id);
    const table = [1, 2, 3, 4, 5, 6].map((roll) => {
      const net = Math.max(0, roll + ops + mod - bar),
        remove = Math.min(net, m.inf(id)[other(side)]);
      return { roll, ok: net > 0, net, remove, add: net - remove };
    });
    const wins = table.filter((x) => x.ok).length;
    return {
      id,
      ops,
      stability: c.stability,
      bar,
      table,
      need: wins ? 7 - wins : null,
      chance: wins / 6,
      key: c.key,
      crisisTo:
        c.key && !(side === 0 && m.has("subs"))
          ? Math.max(1, m.s.crisis - 1)
          : m.s.crisis,
      milopsTo: Math.min(5, m.s.milops[side] + ops),
    };
  }
  coupTargets(
    side: SideIndex,
    ops: number,
    scope?: string[],
    ignore = false,
  ): { ok: Map<string, CoupPreview>; locked: Map<string, string> } {
    const m = this.match,
      ok = new Map<string, CoupPreview>(),
      locked = new Map<string, string>();
    for (const id of m.ids) {
      if (m.inf(id)[other(side)] <= 0 || !this.filterRegion(id, scope))
        continue;
      const preview = this.coupPreview(side, id, ops);
      const why = preview.crisisTo < 2 ? "会触发核战：请选择非战场国或其他行动"
        : m.s.temp[`missile${side}`] && !this.missileReleaseTargets(side).length
          ? "古巴导弹危机：无法支付解除所需的2点影响力，禁止政变"
          : this.lock(id, side, "coup", ignore);
      if (why) locked.set(id, why);
      else ok.set(id, preview);
    }
    return { ok, locked };
  }
  realignMods(id: string): [Modifier[], Modifier[]] {
    const m = this.match;
    return ([0, 1] as const).map((side) => {
      const out: Modifier[] = [];
      const near = m.adj.get(id)!.filter((x) => m.control(x) === side).length;
      if (near) out.push({ label: "相邻受控国与本土", n: near });
      if (m.inf(id)[side] > m.inf(id)[other(side)])
        out.push({ label: "影响力占优", n: 1 });
      if (side === 0 && m.has("iranContra"))
        out.push({ label: "伊朗门", n: -1 });
      return out;
    }) as [Modifier[], Modifier[]];
  }
  realignTargets(
    side: SideIndex,
    scope?: string[],
    ignore = false,
  ): { ok: Map<string, RealignPreview>; locked: Map<string, string> } {
    const m = this.match,
      ok = new Map<string, RealignPreview>(),
      locked = new Map<string, string>();
    for (const id of m.ids) {
      if (m.inf(id)[other(side)] <= 0 || !this.filterRegion(id, scope))
        continue;
      const why = this.lock(id, side, "realign", ignore);
      if (why) locked.set(id, why);
      else {
        const mods = this.realignMods(id);
        ok.set(id, { id, mods, edge: sum(mods[0]) - sum(mods[1]) });
      }
    }
    return { ok, locked };
  }
  private handRestriction(id: string, side: SideIndex): string | undefined {
    const m = this.match;
    if (m.s.phase !== 'action') return;
    if (mustScore(m, side)) {
      if (CARD.get(id)!.kind !== 'tally') {
        const count = m.s.hands[side].filter(x => CARD.get(x)!.kind === 'tally').length;
        return `剩余 ${Math.max(0, m.rounds(side) - m.s.actions[side])} 次行动，须先打出 ${count} 张计分牌`;
      }
    } else if (m.s.temp[`envy${side}`] && m.s.hands[side].includes('049') && id !== '049') {
      return '本行动轮须先使用导弹嫉妒的行动点';
    }
  }
  options(id: string, side: SideIndex = 0, enforceHand = true): CardOptions {
    const m = this.match,
      card = this.card(id),
      points = m.ops(id, side),
      owned = m.owned(id),
      fires = owned !== null && owned !== side;
    const space = SPACE_RACE[m.s.space[side]];
    const limit = m.privilege(side, 2) ? 2 : 1;
    const blocked = enforceHand ? this.handRestriction(id, side) : undefined;
    const spaceWhy = blocked
      ? blocked
      : !space
        ? "已抵达空间站"
        : !points
          ? "计分牌不能送太空"
          : m.s.attempts[side] >= limit
            ? "本回合太空尝试次数已用完"
            : points < space.minOps
              ? `至少需要 ${space.minOps} 行动点`
              : "";
    const place = points
        ? this.placeTargets(side)
        : new Map<string, { cost: number }>(),
      coup = this.coupTargets(side, points),
      realign = this.realignTargets(side);
    const envy = m.s.temp[`envy${side}`] && id === "049";
    const canEvent =
      id !== "006" && !envy && !blocked && eventAllowed(m, id, owned ?? side);
    return {
      card: { ...card, owner: owned === null ? card.owner : owned === side ? "mine" : "theirs" },
      points,
      fires,
      blocked,
      headline: { ok: id !== '006' && id !== '032', why: id === '006' ? '中国牌不能用于头条' : id === '032' ? '联合国干涉不能用于头条' : undefined },
      event: {
        ok: canEvent,
        lines: [
          {
            text: canEvent
              ? RAW.get(id)!.effectsZh.join(" ")
              : blocked ?? "当前不满足事件条件",
            warn: !canEvent,
          },
        ],
        lethal: false,
      },
      place: {
        ok:
          !blocked &&
          points > 0 &&
          [...place.values()].some((x) => x.cost <= points),
        targets: place,
      },
      coup: {
        ok: !blocked && points > 0 && coup.ok.size > 0,
        targets: coup.ok,
        locked: coup.locked,
        why: blocked ?? (points ? (coup.ok.size ? '' : [...coup.locked.values()][0] ?? "没有合法政变目标") : "计分牌不能用于行动"),
        notice: m.s.temp[`missile${side}`] ? '须先移除2点影响力解除古巴导弹危机' : undefined,
      },
      realign: {
        ok: !blocked && points > 0 && realign.ok.size > 0,
        targets: realign.ok,
        locked: realign.locked,
        why: points ? "没有合法调整目标" : "计分牌不能用于行动",
      },
      space: {
        ok: !spaceWhy && !envy,
        why: envy ? "导弹嫉妒必须用于行动" : spaceWhy,
        max: space?.rollMax ?? 0,
        chance: space ? space.rollMax / 6 : 0,
        step: m.s.space[side] + 1,
      },
    };
  }
  private countryValue(id: string, side: SideIndex): number {
    const m = this.match,
      c = m.countries.get(id)!,
      inf = m.inf(id),
      need = inf[other(side)] + c.stability - inf[side];
    return (
      (c.key ? 3 : 0) +
      (m.control(id) === side ? -3 : Math.max(0, 4 - need)) +
      (id === "tha" ? 2 : 0) +
      (m.adj
        .get(id)!
        .some(
          (x) =>
            m.ids.includes(x) &&
            m.countries.get(x)!.key &&
            m.inf(x)[side] === 0,
        )
        ? 1
        : 0)
    );
  }
  observation(side: SideIndex): Observation {
    const m = this.match,
      s = m.s;
    let hand = m.hand(side);

    const cards = hand.map((id) => {
      const c = CARD.get(id)!,
        scoring = c.kind === "tally",
        owner = m.owned(id);
      let scoringDelta = 0;
      if (scoring) {
        const r = m.scoring(REGIONS[id]);
        scoringDelta =
          r.totals[side] -
          r.totals[other(side)] +
          (r.winner === side ? 100 : r.winner === other(side) ? -100 : 0);
      }
      let eventValue =
        owner === side ? c.value + 2 : owner === null ? c.value : 0;
      if (["008", "023", "030", "033", "063", "074", "087", "096"].includes(id))
        eventValue += 3;
      if (["034", "004", "061", "078", "084"].includes(id)) eventValue += 1;
      if (id === "100")
        eventValue = (side === 0 ? s.vp : -s.vp) > 6 ? 100 : -10;
      if (["004", "050", "089", "020"].includes(id) && s.crisis === 2)
        eventValue = -100;
      const immediateVP: Record<string, number> = {
        "048": 2,
        "055": 1,
        "060": 1,
        "065": 1,
        "083": 1,
        "089": 2,
        "090": 2,
        "097": 1,
        "099": 1,
      };
      if (
        owner === side &&
        (side === 0 ? s.vp : -s.vp) + (immediateVP[id] ?? 0) >= 20
      )
        eventValue = 100;
      if (scoring) eventValue = scoringDelta;
      return {
        id,
        title: c.title,
        ops: m.ops(id, side),
        owner,
        scoring,
        eventAllowed: eventAllowed(m, id, owner ?? side),
        eventValue,
        scoringDelta,
      };
    });
    const legal: LegalAction[] = [];
    for (const id of hand) {
      const o = this.options(id, side);
      const bad = o.fires
        ? ["004", "050", "089", "062", "026", "040", "096"].includes(id) &&
          s.crisis === 2
          ? 100
          : 3
        : 0;
      if (o.event.ok)
        legal.push({
          card: id,
          use: "event",
          ops: 0,
          eventRisk: o.event.lethal ? 100 : 0,
        });
      if (o.place.ok) {
        const best = [...o.place.targets].sort(
          (a, b) =>
            this.countryValue(b[0], side) - this.countryValue(a[0], side),
        )[0];
        legal.push({
          card: id,
          use: "ops",
          mode: "place",
          ops: o.points,
          eventRisk: bad,
          targetValue: this.countryValue(best[0], side),
        });
      }
      if (o.coup.ok)
        for (const [target, p] of o.coup.targets) {
          legal.push({
            card: id,
            use: "ops",
            mode: "coup",
            target,
            ops: o.points,
            success: p.chance,
            expectedSwing: p.table.reduce((a, x) => a + x.net, 0) / 6,
            milopsNeeded: Math.max(0, s.crisis - s.milops[side]),
            targetValue: this.countryValue(target, side) * 0.5,
            eventRisk:
              bad + (p.crisisTo <= 1 || s.temp[`missile${side}`] ? 100 : 0),
          });
        }
      if (o.realign.ok)
        for (const [target, p] of o.realign.targets) {
          const edge = side === 0 ? p.edge : -p.edge;
          legal.push({
            card: id,
            use: "ops",
            mode: "realign",
            target,
            ops: o.points,
            expectedSwing: Math.max(0, edge + 1),
            targetValue: this.countryValue(target, side),
            eventRisk: bad,
          });
        }
      if (o.space.ok)
        legal.push({
          card: id,
          use: "space",
          ops: o.points,
          success: o.space.chance,
        });
    }
    return {
      version: 1,
      side,
      revealedOpponentCards:
        side === 1 && m.has("ames")
          ? [...s.hands[0]]
          : (s.knownHands ??= [[], []])[other(side)].filter((id) =>
              s.hands[other(side)].includes(id),
            ),
      turn: s.turn,
      round: s.round,
      phase: s.phase,
      vp: s.vp,
      defcon: s.crisis,
      actionsRemaining: Math.max(0, m.rounds(side) - s.actions[side]),
      opponentHandCount: s.hands[other(side)].length,
      hand: cards,
      countries: m.ids.map((id) => {
        const c = m.countries.get(id)!;
        return {
          id,
          region: c.region,
          stability: c.stability,
          battleground: c.key,
          influence: [...m.inf(id)] as [number, number],
          controller: m.control(id),
          neighbors: [...m.adj.get(id)!],
        };
      }),
      space: [...s.space],
      milops: [...s.milops],
      china: { ...s.china },
      activeEvents: { ...s.flags, ...s.temp },
      discard: [...s.discard],
      removed: [...s.removed],
      legalActions: legal,
      headlineCandidates: hand.filter((id) => this.options(id, side).headline!.ok),
    };
  }
  private async choose(
    side: SideIndex,
    title: string,
    options: Choice[],
    confirmSingle = false,
  ): Promise<string> {
    this.check();
    if (!options.length) throw new Error(`没有选项：${title}`);
    this.match.rememberCards(side, options.flatMap(option => option.card ? [option.card] : []));
    if (options.length === 1 && !confirmSingle) return options[0].id;
    const id =
      this.human(side)
        ? await this.input(side).choose({ title, options })
        : await this.agent.chooseOption({
            observation: this.observation(side),
            title,
            options: structuredClone(options),
          });
    this.check();
    if (!options.some((x) => x.id === id))
      throw new Error("返回了不合法的选择");
    return id;
  }
  private async target(
    side: SideIndex,
    title: string,
    ids: string[],
    rank = (id: string) => this.countryValue(id, side),
    optional = false,
  ): Promise<string | null> {
    if (!ids.length || this.result) return null;
    if (ids.length === 1 && !optional) return ids[0];
    if (!this.human(side)) {
      const chosen = await this.choose(side, title, [
        ...ids.map((id) => ({
          id,
          label: this.country(id).name,
          score: rank(id),
        })),
        ...(optional ? [{ id: "skip", label: "跳过", score: -1 }] : []),
      ]);
      return chosen === "skip" ? null : chosen;
    }
    const id = await this.input(side).pickTarget({
      mode: "event",
      by: side,
      card: this.cause.card,
      targets: new Map(ids.map((x) => [x, {}])),
      locked: new Map(),
      left: 1,
      total: 1,
      optional,
      cancel: false,
      title,
      hint: title,
    });
    this.check();
    if (id && !ids.includes(id)) throw new Error("非法事件目标");
    return id;
  }
  private playObject(side: SideIndex, id: string, verb: Verb): Play {
    const card = this.card(id);
    return {
      by: side,
      card,
      verb,
      use: verb === "event" || verb === "space" ? verb : "ops",
      points: this.match.ops(id, side),
      pile: "discard",
    };
  }
  private async space(
    side: SideIndex,
    steps: number,
    onlyLast = false,
  ): Promise<void> {
    const m = this.match;
    for (let i = 0; i < steps && !this.result; i++) {
      const at = m.s.space[side];
      if (at >= 8) break;
      const first = m.s.space[other(side)] <= at;
      await this.stage([{ t: "space", side, d: 1 }]);
      if (!onlyLast || i === steps - 1 || at === 7) {
        const vp = SPACE_RACE[at].vp[first ? 0 : 1];
        if (vp)
          await this.stage([{ t: "vp", side, d: vp, why: "太空竞赛奖励" }]);
      }
    }
  }
  private async roll(spec: RollSpec): Promise<void> {
    this.match.recordBattle(rollLine(spec, id => this.country(id).name));
    await this.P.roll(spec);
    this.check();
  }
  private async runSpace(play: Play): Promise<void> {
    if (this.result) return;
    const m = this.match,
      step = SPACE_RACE[m.s.space[play.by]],
      roll = m.die();
    m.s.attempts[play.by]++;
    await this.roll({
      kind: "space",
      by: play.by,
      card: play.card.id,
      dice: [{ side: play.by, value: roll, mods: [], total: roll }],
      max: step.rollMax,
      chance: step.rollMax / 6,
      ok: roll <= step.rollMax,
      text: roll <= step.rollMax ? "发射成功" : "发射失败",
    });
    this.check();
    if (roll <= step.rollMax) await this.space(play.by, 1);
    else await this.stage([{ t: "note", text: "发射失败，原地不动" }]);
  }
  private missileReleaseTargets(side: SideIndex): string[] {
    return (side === 1 ? ['cub'] : ['frg', 'tur']).filter(id => this.match.inf(id)[side] >= 2);
  }
  private async cancelMissile(side: SideIndex): Promise<boolean> {
    const m = this.match;
    if (!m.s.temp[`missile${side}`]) return true;
    const ids = this.missileReleaseTargets(side);
    if (!ids.length) return false;
    const option = await this.choose(side, '政变前解除古巴导弹危机：移除2点影响力',
      ids.map(id => ({ id, label: `${this.country(id).name} −2`, score: 5 })));
    await this.stage([{ t: 'inf', id: option, side, d: -2 }]);
    delete m.s.temp[`missile${side}`];
    return true;
  }
  async coup(
    side: SideIndex,
    id: string,
    ops: number,
    free = false,
    ignore = false,
  ): Promise<number> {
    const m = this.match;
    if (this.result) return 0;
    if (!this.coupTargets(side, ops, undefined, ignore).ok.has(id)) return 0;
    if (!(await this.cancelMissile(side))) return 0;
    const roll = m.die(),
      p = this.coupPreview(side, id, ops),
      r = p.table[roll - 1],
      mod = this.coupMod(side, id);
    const before: [number, number] = [...m.inf(id)], after: [number, number] = [...before];
    after[other(side)] -= r.remove;
    after[side] += r.add;
    const controlAfter = after[0] - after[1] >= p.stability ? 0 : after[1] - after[0] >= p.stability ? 1 : null;
    await this.roll({
      kind: "coup",
      by: side,
      card: this.cause.card,
      id,
      dice: [
        {
          side,
          value: roll,
          mods: [
            { label: "行动点", n: ops },
            ...(mod ? [{ label: "事件修正", n: mod }] : []),
          ],
          total: roll + ops + mod,
        },
      ],
      bar: { label: `稳定度 ${p.stability} ×2`, n: p.bar },
      need: p.need,
      chance: p.chance,
      ok: r.ok,
      text: r.ok ? `政变成功 · 净值 ${r.net}` : "政变失败",
      situation: { before, after, controlBefore: m.control(id), controlAfter, crisisBefore: m.s.crisis, crisisAfter: p.crisisTo },
    });
    this.check();
    const intents: Intent[] = [];
    if (r.remove)
      intents.push({ t: "inf", id, side: other(side), d: -r.remove });
    if (r.add) intents.push({ t: "inf", id, side, d: r.add });
    if (!r.ok) intents.push({ t: "note", text: "政变失败", id });
    if (!free) intents.push({ t: "milops", side, d: ops });
    if (p.crisisTo < m.s.crisis)
      intents.push({ t: "crisis", d: -1, why: "战场国政变" });
    if (side === 0 && m.has("yuri"))
      intents.push({ t: "vp", side: 1, d: 1, why: "尤里与萨曼莎" });
    await this.stage(intents);
    return r.remove;
  }
  private async realign(
    side: SideIndex,
    id: string,
    left: number,
  ): Promise<void> {
    const m = this.match,
      rolls = [m.die(), m.die()],
      mods = this.realignMods(id),
      totals = [rolls[0] + sum(mods[0]), rolls[1] + sum(mods[1])],
      diff = totals[0] - totals[1],
      winner: SideIndex | null = diff > 0 ? 0 : diff < 0 ? 1 : null;
    await this.roll({
      kind: "realign",
      by: side,
      card: this.cause.card,
      id,
      dice: ([0, 1] as const).map((i) => ({
        side: i,
        value: rolls[i],
        mods: mods[i],
        total: totals[i],
      })),
      ok: winner === side,
      winner,
      left,
      text:
        winner === null
          ? "平局"
          : `${this.sideName(winner)}胜出 · 差 ${Math.abs(diff)}`,
    });
    this.check();
    if (winner !== null)
      await this.stage([
        { t: "inf", id, side: other(winner), d: -Math.abs(diff) },
      ]);
  }
  private session(
    side: SideIndex,
    points: number,
    base: Record<string, [number, number]>,
    scope?: string[],
    setup = false,
  ): PlaceSession {
    const m = this.match,
      spent: { id: string; cost: number }[] = [];
    const initial = structuredClone(m.s.inf);
    const controllers = new Map(m.ids.map(id => [id, m.control(id)]));
    let committed = false;
    const left = () => points - spent.reduce((n, x) => n + x.cost, 0);
    const targets = () =>
      new Map(
        [
          ...(setup
            ? new Map(
                m.ids
                  .filter((id) => m.region(id, side === 0 ? "western-europe" : "eastern-europe"))
                  .map((id) => [id, { cost: 1 }]),
              )
            : this.placeTargets(side, base, scope)),
        ].map(([id, x]) => [id, { cost: x.cost, ok: x.cost <= left() }]),
      );
    return {
      side,
      points,
      canCancel: !setup,
      spent,
      get left() {
        return left();
      },
      count: (id) => spent.filter((x) => x.id === id).length,
      targets,
      add: (id) => {
        const t = targets().get(id);
        if (!t?.ok) return null;
        const e = m.apply({ t: "inf", id, side, d: 1 }, true, false);
        spent.push({ id, cost: t.cost });
        this.changed();
        return e;
      },
      commit: () => {
        if (committed) return;
        committed = true;
        for (const id of new Set(spent.map(x => x.id))) {
          const from = initial[id][side], to = m.inf(id)[side];
          m.recordEffect({ t: 'inf', id, side, d: to - from, from, to, ctrlFrom: controllers.get(id)!, ctrlTo: m.control(id) }, setup ? undefined : spent.filter(x => x.id === id).reduce((n, x) => n + x.cost, 0));
        }
      },
      undo: () => {
        const x = spent.pop();
        if (!x) return false;
        m.apply({ t: "inf", id: x.id, side, d: -1 }, true, false);
        this.changed();
        return true;
      },
    };
  }
  private async operations(
    side: SideIndex,
    points: number,
    modes: ("place" | "coup" | "realign")[] = ["place", "coup", "realign"],
    scope?: string[],
    free = false,
    decision?: Decision,
    commit?: (mode: Exclude<Verb, 'event' | 'space'>, points: number, target?: string) => Promise<void>,
  ): Promise<boolean> {
    if (this.result) return true;
    const m = this.match;
    let mode = decision?.mode;
    let pts = points;
    let region = scope;
    if (
      !free &&
      !scope &&
      (this.cause.card === "006" || (side === 1 && m.s.temp.vietnam))
    ) {
      const scopes = [
        { id: "any", label: `任意地区 · ${points}行动点`, score: 1 },
        ...(this.cause.card === "006"
          ? [{ id: "asia", label: `仅亚洲 · ${points + 1}行动点`, score: 2 }]
          : []),
        ...(side === 1 && m.s.temp.vietnam
          ? [
              {
                id: "southeast-asia",
                label: `仅东南亚 · ${points + 1 + (this.cause.card === "006" ? 1 : 0)}行动点`,
                score: 2,
              },
            ]
          : []),
      ];
      const viable = scopes.filter(
        (x) =>
          x.id === "any" ||
          ((!decision?.target || m.region(decision.target, x.id)) &&
            (mode === "coup"
              ? this.coupTargets(side, points + 1, [x.id]).ok.size > 0
              : mode === "realign"
                ? this.realignTargets(side, [x.id]).ok.size > 0
                : [
                    ...this.placeTargets(side, this.phaseBase, [x.id]).values(),
                  ].some((t) => t.cost <= points + 1))),
      );
      const chosen = await this.choose(side, "选择行动范围", viable);
      if (chosen !== "any") {
        region = [chosen];
        pts +=
          1 +
          (chosen === "southeast-asia" && this.cause.card === "006" ? 1 : 0);
      }
    }
    if (!mode) {
      const choices: Choice[] = modes
        .filter((v) =>
          v === "place"
            ? this.placeTargets(side, this.phaseBase, region).size > 0
            : v === "coup"
              ? this.coupTargets(side, pts, region, free).ok.size > 0
              : this.realignTargets(side, region, free).ok.size > 0,
        )
        .map((v) => ({
          id: v,
          label:
            v === "place"
              ? "放置影响力"
              : v === "coup"
                ? "发动政变"
                : "调整阵营",
          score: v === "place" ? 3 : v === "coup" && m.s.crisis > 2 ? 4 : 0,
        }));
      if (!choices.length) return true;
      if (free)
        choices.push({ id: "skip", label: "不进行额外行动", score: -1 });
      const v = await this.choose(side, "使用行动点", choices);
      if (v === "skip") return true;
      mode = v as Decision["mode"];
    }
    if (!mode || !modes.includes(mode)) throw new Error("不允许的行动类型");
    const play = this.playObject(side, this.cause.card, mode);
    play.points = pts;
    let begun = false;
    const begin = async (target?: string): Promise<void> => {
      if (begun) return;
      begun = true;
      await commit?.(mode!, pts, target);
      if (this.result) return;
      const entry = m.s.battleLog?.find(e => e.id === m.battleContext);
      if (entry && entry.verb !== 'event') m.updateBattle(entry.id, { verb: mode });
      m.recordBattle({ kind: 'note', text: `${this.sideName(side)}使用 ${pts} 行动点${region ? ` · 限定地区：${region.map(r => m.scenario.regions.find(x => x.id === r)?.name.zh ?? (r === 'southeast-asia' ? '东南亚' : r)).join('、')}` : ''}` });
    };
    if (mode === "place") {
      const session = this.session(side, pts, this.phaseBase, region);
      session.confirm = () => begin();
      if (this.human(side)) {
        const accepted = await this.input(side).place(session, play);
        this.check();
        if (this.result) return true;
        if (!accepted) {
          while (session.undo());
          return false;
        }
      } else {
        await begin();
        if (this.result) return true;
        for (let i = 0; i < pts; i++) {
          const targets = [...session.targets()].filter(([, x]) => x.ok);
          if (!targets.length) break;
          const id = await this.choose(
            side,
            "放置影响力",
            targets.map(([id, x]) => ({
              id,
              label: this.country(id).name,
              score: this.countryValue(id, side) - x.cost * 0.1,
            })),
          );
          const e = session.add(id);
          if (e)
            await this.P.step(e, () => this.changed(), {
              ...this.cause,
              verb: "place",
              id,
            });
        }
      }
      if (!session.spent.length && [...session.targets().values()].some(x => x.ok)) return false;
      if (!begun) {
        // Local placement is an undoable preview too. Restore the original board
        // while committing the card, then apply the accepted allocation.
        const allocation = session.spent.map(x => x.id);
        while (session.undo());
        await begin();
        if (this.result) return true;
        for (const id of allocation) session.add(id);
      }
      session.commit?.();
      return (
        session.spent.length > 0 ||
        ![...session.targets().values()].some((x) => x.ok)
      );
    }
    const max = mode === "coup" ? 1 : pts;
    for (let i = 0; i < max && !this.result; i++) {
      const targets =
        mode === "coup"
          ? this.coupTargets(side, pts, region, free)
          : this.realignTargets(side, region, free);
      if (!targets.ok.size) return i > 0 || !this.human(side);
      let id =
        decision?.target && i === 0 && targets.ok.has(decision.target)
          ? decision.target
          : null;
      if (!id && this.human(side))
        id = await this.input(side).pickTarget({
          mode,
          by: side,
          card: this.cause.card,
          targets: targets.ok,
          locked: targets.locked,
          left: max - i,
          total: max,
          optional: i > 0 || free,
          cancel: i === 0 && !free,
        });
      if (!id && !this.human(side)) {
        const choices = [...targets.ok]
          .filter(([, p]) => !("crisisTo" in p) || p.crisisTo > 1)
          .map(([id, p]) => ({
            id,
            label: this.country(id).name,
            score:
              ("chance" in p ? p.chance * 4 + (p.key ? 2 : 0) : -p.edge) +
              this.countryValue(id, side) * 0.2,
          }));
        if (!choices.length) return true;
        id = await this.choose(side, "选择行动目标", choices);
      }
      this.check();
      if (!id) return i > 0 || free;
      if (!targets.ok.has(id)) throw new Error("非法目标");
      await begin(id);
      if (this.result) return true;
      if (mode === "coup") await this.coup(side, id, pts, free, free);
      else await this.realign(side, id, max - i - 1);
    }
    return true;
  }
  private async moveCard(change: CardMove, commit: () => void): Promise<void> {
    this.check();
    let committed = false;
    const apply = () => {
      if (committed) return;
      committed = true;
      commit();
      this.match.rememberCards(null, [change.card]);
      this.match.recordBattle(cardMoveLine(change, CARD.get(change.card)!.title));
      this.changed();
    };
    if (this.P.cardMove) await this.P.cardMove(change, apply);
    else apply();
    this.check();
    if (!committed) throw new Error('卡牌转移未提交');
  }
  private async scoreRegion(region: string, final = false): Promise<void> {
    const m = this.match;
    let report = m.scoring(region, final);
    if (report.shuttleChoicePending) {
      const shuttleCountry = await this.choose(0, '穿梭外交：本次计分排除哪个苏联战场国？', report.sides[1].countries.filter(c => c.key).map(c => ({
        id: c.id, label: `${this.country(c.id).name}${c.adjacent ? ' · 同时扣除邻接加分' : ''}`, score: c.adjacent ? 2 : 1,
      })));
      report = m.scoring(region, final, { shuttleCountry });
    }
    await this.P.score?.(report);
    this.check();
    const effects = m.score(region, final, { shuttleCountry: report.shuttleCountry });
    if (!final) await this.stage(effects);
    else for (const e of effects) {
      // Final scoring evaluates every region before the VP victory threshold.
      const effect = m.apply(e, false);
      await this.P.step(effect, () => this.changed(), this.cause);
    }
  }
  private async event(id: string, side: SideIndex, playedBy: SideIndex): Promise<boolean> {
    if (this.result) return false;
    if (++this.depth > 12) {
      this.depth--;
      throw new Error("事件递归超过限制");
    }
    const previous = this.cause;
    this.cause = { verb: "event", by: side, card: id };
    const before = passiveEffects(this.match.s);
    try {
      if (playedBy !== side) this.match.recordBattle({ kind: 'note', text: `触发${this.sideName(side)}事件 · 《${CARD.get(id)!.title}》` });
      if (!eventAllowed(this.match, id, side)) this.match.recordBattle({ kind: 'note', text: '事件条件不满足，事件未生效' });
      const occurred = await resolveEvent({
        m: this.match,
        by: side,
        playedBy,
        id,
        stage: (e) => this.stage(e),
        roll: spec => this.roll(spec),
        choose: (s, t, x, confirm) => this.choose(s, t, x, confirm),
        score: (region) => this.scoreRegion(region),
        move: (change, commit) => this.moveCard(change, commit),
        target: (s, t, x, rank, optional) =>
          this.target(s, t, x, rank, optional),
        ops: async (s, p, modes, region, free) => {
          while (
            !this.result &&
            !(await this.operations(s, p, modes, region, free))
          )
            this.check();
        },
        coup: (s, x, p, free, ignore) => this.coup(s, x, p, free, ignore),
        canCoup: (s, x, p, ignore) => this.coupTargets(s, p, undefined, ignore).ok.has(x),
        space: (s, n, last) => this.space(s, n, last),
        play: async (s, card, mode) => {
          let use: Decision["use"] = mode === "ops" ? "ops" : "event";
          let op: Decision["mode"];
          if (mode === "choose") {
            const o = this.options(card, s, false);
            const choices: Choice[] = [
              ...(o.event.ok
                ? [
                    {
                      id: "event",
                      label: "执行事件",
                      score: this.match.owned(card) === s ? 5 : 0,
                    },
                  ]
                : []),
              ...(o.place.ok
                ? [{ id: "place", label: "放置影响力", score: 3 }]
                : []),
              ...(o.coup.ok
                ? [
                    {
                      id: "coup",
                      label: "政变",
                      score: this.crisis > 2 ? 4 : 0,
                    },
                  ]
                : []),
              ...(o.realign.ok
                ? [{ id: "realign", label: "调整阵营", score: 1 }]
                : []),
              ...(o.space.ok
                ? [
                    {
                      id: "space",
                      label: "送入太空",
                      score: this.match.owned(card) === other(s) ? 6 : 1,
                    },
                  ]
                : []),
            ];
            const choice = await this.choose(
              s,
              `使用《${CARD.get(card)!.title}》`,
              choices,
            );
            use = choice === "event" || choice === "space" ? choice : "ops";
            if (use === "ops") op = choice as Decision["mode"];
          }
          await this.play({ card, use, mode: op }, s, false, mode === "ops");
        },
        reveal: async (s, cards, title) => {
          this.match.recordReveal(s, cards, title);
          if (this.human(s)) {
            (this.match.s.knownHands ??= [[], []])[other(s)] = [...cards];
            await this.input(s).reveal(cards, title);
          } else {
            (this.match.s.knownHands ??= [[], []])[0] = [...cards];
            this.match.log(`${this.sideName(s)}查看了${cards.length}张牌`);
          }
        },
      });
      const after = passiveEffects(this.match.s);
      for (const effect of after.filter(e => !before.some(b => b.id === e.id)))
        this.match.recordBattle({ kind: 'passive', text: `持续效果生效 · 《${effect.title.zh}》 · ${effect.summary.zh}（${effect.duration.zh}）` });
      for (const effect of before.filter(e => !after.some(a => a.id === e.id)))
        this.match.recordBattle({ kind: 'passive', text: `持续效果结束 · 《${effect.title.zh}》` });
      return occurred;
    } finally {
      this.cause = previous;
      this.depth--;
    }
  }
  /** Execute a validated card play. Opponent events use their owner's decisions, not the phasing side. */
  async play(
    d: Decision,
    side: SideIndex,
    fromHand = true,
    suppressEvent = false,
  ): Promise<boolean> {
    const m = this.match,
      s = m.s,
      id = d.card,
      card = this.card(id),
      options = this.options(id, side, fromHand && this.depth === 0);
    if (fromHand && this.depth === 0 && options.blocked) throw new Error(options.blocked);
    const eventFirst =
      d.use === "event" &&
      m.owned(id) !== null &&
      m.owned(id) !== side &&
      s.phase !== "headline" &&
      fromHand;
    if (eventFirst) d = { card: id, use: "ops" };
    const verb: Verb = d.use === "ops" ? (d.mode ?? "place") : d.use;
    if (fromHand && !m.hand(side).includes(id))
      throw new Error("这张牌不在当前玩家手中");
    if (card.owner === "tally" && d.use !== "event")
      throw new Error("计分牌必须用于事件");
    if (d.use === "space" && !options.space.ok)
      throw new Error(options.space.why);
    if (d.use === "event" && !options.event.ok) {
      if (fromHand) throw new Error("不满足事件使用条件");
    }
    if (d.use === "ops" && !options.points) throw new Error("没有行动点");
    if (fromHand && this.depth === 0 && d.mode && !options[d.mode].ok)
      throw new Error(d.mode === 'coup' ? options.coup.why : '当前不能使用这种行动');
    if (d.target && d.mode === "coup" && !options.coup.targets.has(d.target))
      throw new Error("非法政变目标");
    if (
      d.target &&
      d.mode === "realign" &&
      !options.realign.targets.has(d.target)
    )
      throw new Error("非法调整目标");
    if (
      fromHand &&
      s.phase === "action" &&
      !mustScore(m, side) &&
      s.temp[`envy${side}`] &&
      m.hand(side).includes("049") &&
      (id !== "049" || d.use !== "ops")
    )
      throw new Error("必须使用导弹嫉妒的行动点");
    const previous = this.cause,
      oldPlayed = s.played,
      oldBase = this.phaseBase;
    if (!this.depth) this.phaseBase = structuredClone(s.inf);
    this.cause = { verb, by: side, card: id };
    const oldBattle = m.battleContext;
    let battle: number | null = null;
    let committed = false;
    const play = this.playObject(side, id, verb);
    play.headline = s.phase === "headline";
    play.fires = d.use === "ops" && options.fires && !suppressEvent;
    const commitPlay = async (mode?: Exclude<Verb, 'event' | 'space'>, points?: number, target?: string): Promise<void> => {
      if (mode) { play.verb = mode; this.cause.verb = mode; }
      if (points !== undefined) play.points = points;
      if (target) play.target = target;
      if (committed) return;
      committed = true;
      if (fromHand) m.take(id, side);
      else s.played = { card: id, by: side };
      battle = m.beginBattle({ kind: 'card', by: side, card: id, verb: play.verb, title: card.title, status: 'resolving' });
      m.battleContext = battle;
      this.changed();
      await this.P.announce(play);
      this.check();
      if (fromHand && !this.depth && s.phase === 'action' && side === 0 && m.has('bury')) {
        delete s.flags.bury;
        if (!(id === '032' && d.use === 'event'))
          await this.stage([{ t: 'vp', side: 1, d: 3, why: '我们将埋葬你' }]);
      }
      if (this.result) return;
      if (side === 0 && d.use !== 'space' && WAR.has(id) && m.has('flower'))
        await this.stage([{ t: 'vp', side: 1, d: 2, why: '鲜花力量' }]);
    };
    let occurred = false;
    try {
      // Event/space selection is a commitment. Operations remain private until a
      // target or final allocation is confirmed (or the opponent event goes first).
      if (d.use !== 'ops' || !fromHand || play.headline) await commitPlay();
      if (d.use === "event")
        occurred = await this.event(id, m.owned(id) ?? side, side);
      else if (d.use === "space") await this.runSpace(play);
      else {
        let before = eventFirst;
        const enemy = m.owned(id);
        if (
          !eventFirst &&
          play.fires &&
          enemy !== null &&
          eventAllowed(m, id, enemy)
        )
          before =
            (await this.choose(side, "对手事件的执行顺序", [
              { id: "after", label: "先行动，再执行对手事件", score: 2 },
              { id: "before", label: "先执行对手事件，再行动", score: 1 },
            ])) === "before";
        if (before && enemy !== null) {
          await commitPlay();
          await this.P.trigger(play);
          occurred = await this.event(id, enemy, side);
        }
        let done =
          this.result !== null ||
          (await this.operations(
            side,
            m.ops(id, side),
            undefined,
            undefined,
            false,
            d,
            commitPlay,
          ));
        if (!done && committed)
          while (!done && !this.result)
            done = await this.operations(
              side,
              m.ops(id, side),
              undefined,
              undefined,
              false,
              { ...d, mode: undefined, target: undefined },
              commitPlay,
            );
        if (!done) {
          // No public mutation or announcement exists to undo.
          return false;
        }
        await commitPlay();
        if (!before && play.fires && enemy !== null && !this.result) {
          await this.P.trigger(play);
          occurred = await this.event(id, enemy, side);
        }
      }
      if (id === "049" && s.temp[`envy${side}`]) delete s.temp[`envy${side}`];
      play.pile = occurred && card.once ? "removed" : "discard";
      const recipient = s.hands.findIndex(h => h.includes(id));
      play.destination = id === '006' ? { hand: other(side) }
        : recipient >= 0 ? { hand: recipient as SideIndex }
        : s.inPlay.includes(id) ? 'inPlay' : undefined;
      if (play.destination && typeof play.destination === 'object') {
        play.transfer = { card: id, source: id, from: { play: side }, to: play.destination,
          reason: id === '006' ? '中国牌交给对手 · 下回合可用' : id === '049' ? '交给对手 · 下个行动轮必须用于行动点' : '卡牌转入手牌' };
        m.recordBattle(cardMoveLine(play.transfer, card.title));
      }
      await this.P.settle(play);
      this.check();
      // Missile Envy transfers itself into the other hand; Shuttle Diplomacy stays in play.
      if (!s.hands.some((h) => h.includes(id))) m.settle(id, side, occurred);
      else s.played = null;
      if (this.depth) s.played = oldPlayed;
      const destination = id === '006' ? `交给${this.sideName(other(side))}，下回合可用` : s.removed.includes(id) ? '移出游戏' : s.inPlay.includes(id) ? '保留在场上' : s.hands.some(h => h.includes(id)) ? '转入手牌' : '进入弃牌堆';
      if (destination !== '进入弃牌堆' && !play.transfer) m.recordBattle({ kind: 'note', text: `《${card.title}》${destination}` });
      if (battle !== null) m.updateBattle(battle, { status: 'resolved' });
      m.log(
        `${this.sideName(side)} · 《${card.title}》 · ${d.use === "event" ? "事件" : d.use === "space" ? "太空竞赛" : play.verb === "place" ? "放置影响力" : play.verb === "coup" ? "政变" : "调整阵营"}`, false,
      );
      this.changed();
      return true;
    } finally {
      m.battleContext = oldBattle;
      this.cause = previous;
      this.phaseBase = oldBase;
    }
  }
  private async setup(): Promise<void> {
    const m = this.match;
    this.cause = { verb: "event", by: 1, card: "001" };
    // Deployment also belongs to the replaceable agent, with exactly six legal placements.
    if (this.o.remoteInputs) {
      m.s.active = 1;
      const session = this.session(1, 6, m.s.inf, undefined, true);
      await this.input(1).place(session, this.playObject(1, "001", "place"));
      if (session.left) throw new Error("请完成苏联的6点初始部署");
      session.commit?.();
    } else for (let i = 0; i < 6; i++) {
      const id = await this.choose(
        1,
        "初始部署：东欧增加1点影响力",
        m.ids
          .filter((id) => m.region(id, "eastern-europe"))
          .map((id) => ({
            id,
            label: this.country(id).name,
            score: this.countryValue(id, 1),
          })),
      );
      await this.stage([{ t: "inf", id, side: 1, d: 1 }]);
    }
    m.s.active = 0;
    this.cause = { verb: "place", by: 0, card: "001" };
    await this.input(0).reveal([], "初始部署：在西欧放置7点美国影响力");
    let ready = false;
    while (!ready) {
      const session = this.session(0, 7, m.s.inf, undefined, true);
      const ok = await this.input(0).place(
        session,
        this.playObject(0, "001", "place"),
      );
      this.check();
      if (ok && session.left === 0) { session.commit?.(); ready = true; }
      else {
        while (session.undo());
        await this.P.reveal([], "请放置全部7点初始影响力后完成部署");
      }
    }
    m.s.phase = "headline";
    m.s.active = 1;
    this.checkpoint();
  }
  private async headline(): Promise<void> {
    const m = this.match,
      s = m.s;
    await this.P.phase({ kind: "headline" });
    this.check();
    const human = async (): Promise<string> => {
      for (;;) {
        const id = await this.input(0).pickHeadline();
        this.check();
        if (s.hands[0].includes(id) && id !== "032") return id;
        await this.P.reveal([], "头条不能使用中国牌或联合国干预，请重新选择。");
      }
    };
    const computer = async (): Promise<string> => {
      const o = this.observation(1);
      const id = this.o.remoteInputs ? await this.input(1).pickHeadline() : await this.agent.chooseHeadline(o);
      if (!o.headlineCandidates.includes(id))
        throw new Error("AI选择了非法头条");
      return id;
    };
    let mine: string, theirs: string;
    if (this.o.remoteInputs && !m.privilege(0, 4) && !m.privilege(1, 4)) {
      [mine, theirs] = await Promise.all([human(), computer()]);
    } else if (m.privilege(1, 4)) {
      mine = await human();
      m.rememberCards(1, [mine]);
      (this.match.s.knownHands ??= [[], []])[0] = [mine];
      if (this.o.remoteInputs) await this.input(1).reveal([mine], "头条先知：对手已选择并公开");
      theirs = await computer();
    } else {
      theirs = await computer();
      if (m.privilege(0, 4)) {
        m.rememberCards(0, [theirs]);
        await this.input(0).reveal([theirs], "头条先知：对手已选择并公开");
      }
      mine = await human();
    }
    s.headlines = [mine, theirs];
    m.rememberCards(null, [mine, theirs]);
    for (const side of [0, 1] as const) {
      const id = s.headlines[side]!;
      s.hands[side].splice(s.hands[side].indexOf(id), 1);
    }
    const order = [
      { card: mine, by: 0 as SideIndex },
      { card: theirs, by: 1 as SideIndex },
    ].sort(
      (a, b) =>
        CARD.get(b.card)!.value - CARD.get(a.card)!.value || a.by - b.by,
    );
    m.recordBattle({ kind: 'note', text: `双方揭示头条 · 美国《${CARD.get(mine)!.title}》 · 苏联《${CARD.get(theirs)!.title}》` });
    m.recordBattle({ kind: 'note', text: `结算顺序：${order.map(x => `${this.sideName(x.by)}《${CARD.get(x.card)!.title}》`).join(' → ')}` });
    this.changed();
    await this.P.showHeadline({ mine, theirs, order });
    // Defectors cancels the Soviet headline regardless of resolution order.
    if (mine === "103") {
      s.headlines[1] = null;
      m.discard(theirs);
      m.log(`叛逃取消苏联头条《${CARD.get(theirs)!.title}》`);
    }
    for (const turn of order) {
      if (!s.headlines[turn.by] || this.result) continue;
      s.active = turn.by;
      this.phaseBase = structuredClone(s.inf);
      s.headlines[turn.by] = null;
      await this.play({ card: turn.card, use: "event" }, turn.by, false);
    }
    // Unresolved headlines still belong to their owners if a game ended mid-headline.
    for (const side of [0, 1] as const)
      if (s.headlines[side]) {
        m.discard(s.headlines[side]!);
        s.headlines[side] = null;
      }
    s.headlineDone = true;
    if (!this.result) {
      s.phase = "action";
      s.active = 1;
      s.round = 1;
    }
    this.checkpoint();
  }
  private async trapped(side: SideIndex): Promise<boolean> {
    const m = this.match,
      s = m.s;
    if (!m.has(`trap${side}`)) return false;
    const eligible = s.hands[side].filter((id) => m.ops(id, side) >= 2),
      scoring = s.hands[side].filter((id) => CARD.get(id)!.kind === "tally");
    if (
      scoring.length >= m.rounds(side) - s.actions[side] ||
      !eligible.length
    ) {
      if (scoring.length) {
        const id = await this.choose(
          side,
          "困境中仍须打出计分牌",
          scoring.map((id) => ({
            id,
            label: CARD.get(id)!.title,
            card: id,
            score: 0,
          })),
        );
        await this.play({ card: id, use: "event" }, side);
      } else
        await this.stage([
          {
            t: "note",
            text: `${this.sideName(side)}被困住，没有符合条件的弃牌，本行动轮跳过`,
          },
        ]);
      return true;
    }
    const id = await this.choose(
      side,
      "弃掉2点以上的牌并掷骰，1–4脱困",
      eligible.map((id) => ({
        id,
        label: CARD.get(id)!.title,
        card: id,
        score:
          m.owned(id) === other(side)
            ? 5 - m.ops(id, side)
            : 1 - m.ops(id, side),
      })),
    );
    await this.moveCard({ card: id, source: side === 0 ? '042' : '044', from: { hand: side }, to: 'discard', reason: '弃牌，随后掷骰尝试脱困' }, () => {
      s.hands[side].splice(s.hands[side].indexOf(id), 1); m.discard(id, false);
    });
    const roll = m.die();
    await this.roll({
      kind: "check",
      by: side,
      card: side === 0 ? '042' : '044',
      rule: '已弃牌 · 骰点 1–4 脱困，5–6 仍被困住',
      dice: [{ side, value: roll, mods: [], total: roll }],
      range: [1, 4],
      chance: 4 / 6,
      ok: roll <= 4,
      text: roll <= 4 ? "成功脱困" : "仍被困住",
    });
    if (roll <= 4) {
      delete s.flags[`trap${side}`];
      m.recordBattle({ kind: 'passive', text: `${this.sideName(side)}解除${side === 0 ? '泥潭' : '捕熊陷阱'}` });
    }
    return true;
  }
  private async action(side: SideIndex): Promise<void> {
    const m = this.match,
      s = m.s;
    s.active = side;
    s.round = s.actions[side] + 1;
    this.phaseBase = structuredClone(s.inf);
    this.changed();
    await this.P.phase({ kind: "round", round: s.round, who: side });
    this.check();
    if (!(await this.trapped(side))) {
      if (!s.hands[side].length) {
        const useChina =
          m.hand(side).includes("006") &&
          (await this.choose(side, "没有普通手牌，可选择使用中国牌", [
            { id: "pass", label: "跳过本行动轮", score: 1 },
            { id: "china", label: "使用中国牌", score: 0 },
          ])) === "china";
        if (useChina) await this.play({ card: "006", use: "ops" }, side);
        else m.log(`${this.sideName(side)}跳过行动轮`);
      } else if (!this.human(side)) {
        const o = this.observation(1);
        if (!o.legalActions.length)
          throw new Error("电脑存在手牌却没有合法行动");
        const d = await this.agent.chooseAction(o);
        if (
          !o.legalActions.some(
            (a) =>
              a.card === d.card &&
              a.use === d.use &&
              a.mode === d.mode &&
              a.target === d.target,
          )
        )
          throw new Error("AI返回非法行动");
        await this.play(d, 1);
      } else
        for (;;) {
          let d: Decision;
          const required = !mustScore(m, side) && s.temp[`envy${side}`] && s.hands[side].includes("049");
          if (required) {
            await this.input(side).reveal(
              ["049"],
              "导弹嫉妒：本行动轮必须用此牌的行动点",
            );
            d = { card: "049", use: "ops" };
          } else d = await this.input(side).decide();
          this.check();
          if (!m.hand(side).includes(d.card)) continue;
          if (this.result || (await this.play(d, side))) break;
        }
    }
    s.actions[side]++;
    if (s.temp.noradPending && !this.result) {
      delete s.temp.noradPending;
      if (m.has("norad") && m.control("can") === 0) {
        const id = await this.target(
          0,
          "北美防空司令部：增加1点影响力",
          m.ids.filter((id) => m.inf(id)[0] > 0),
        );
        if (id) {
          m.recordBattle({ kind: 'passive', text: '北美防空司令部触发 · 美国增加 1 点影响力' });
          await this.stage([{ t: "inf", id, side: 0, d: 1 }]);
        }
      }
    }
    if (!this.result) {
      s.active = other(side);
      const done = ([0, 1] as const).every((i) => s.actions[i] >= m.rounds(i));
      if (done) s.phase = "cleanup";
    }
    this.checkpoint();
  }
  private async cleanup(): Promise<void> {
    const m = this.match,
      s = m.s;
    for (const side of [1, 0] as const) {
      const remaining = s.hands[side].filter(id => CARD.get(id)!.kind === 'tally');
      for (const id of remaining) {
        m.log(`回合末自动结算${this.sideName(side)}剩余计分牌《${CARD.get(id)!.title}》`);
        await this.play({ card: id, use: 'event' }, side);
        if (this.result) return;
      }
    }
    this.cause = { verb: "event", by: 0, card: "001" };
    const penalty = ([0, 1] as const).map((i) =>
      Math.max(0, s.crisis - s.milops[i]),
    );
    const effect = m.apply(
      {
        t: "vp",
        side: 0,
        d: penalty[1] - penalty[0],
        why: `军事行动不足：美国 −${penalty[0]}，苏联 −${penalty[1]}`,
      },
      false,
    );
    await this.P.step(effect, () => this.changed(), this.cause);
    m.checkWin();
    if (this.result) return;
    for (const side of [1, 0] as const)
      if (m.privilege(side, 6) && s.hands[side].length) {
        const eligible = s.hands[side].filter(
          (id) => CARD.get(id)!.kind !== "tally",
        );
        const id = await this.choose(side, "太空能力：回合末可弃一张保留手牌", [
          ...eligible.map((id) => ({
            id,
            label: CARD.get(id)!.title,
            card: id,
            score: m.owned(id) === other(side) ? 4 : 0,
          })),
          { id: "keep", label: "保留手牌", score: 1 },
        ]);
        if (id !== "keep") {
          await this.moveCard({ card: id, source: id, from: { hand: side }, to: 'discard', reason: '太空能力 · 回合末弃牌' }, () => {
            s.hands[side].splice(s.hands[side].indexOf(id), 1); m.discard(id, false);
          });
        }
      }
    if (s.turn === 10) {
      for (const r of m.scenario.regions) {
        await this.scoreRegion(r.id, true);
        if (this.result) break;
      }
      if (!this.result) {
        m.apply({ t: "vp", side: s.china.owner, d: 1, why: "中国牌" }, false);
        m.end(
          s.vp === 0 ? null : s.vp > 0 ? 0 : 1,
          "final",
          "第10回合最终计分",
        );
      }
    } else {
      m.nextTurn();
      this.match.s.knownHands = [[], []];
      this.checkpoint();
      await this.P.phase({ kind: "turn", turn: s.turn });
    }
  }
  async start(P: SoloPresenter): Promise<Result | null> {
    this.P = P;
    this.alive = true;
    this.changed();
    try {
      if (this.match.s.phase === "setup") await this.setup();
      while (!this.result) {
        this.check();
        const s = this.match.s;
        if (s.phase === "headline") await this.headline();
        else if (s.phase === "cleanup") await this.cleanup();
        else if (s.phase === "action") {
          const side = s.active;
          if (s.actions[side] >= this.match.rounds(side)) {
            s.active = other(side);
            if (s.actions[s.active] >= this.match.rounds(s.active))
              s.phase = "cleanup";
            continue;
          }
          if (s.actions[side] === 7) {
            const yes = await this.choose(side, "是否使用第八行动轮？", [
              {
                id: "yes",
                label: "进行第八行动轮",
                score: s.hands[side].some(
                  (id) => CARD.get(id)!.kind === "tally",
                )
                  ? 10
                  : 1,
              },
              ...(s.hands[side].some(id => CARD.get(id)!.kind === 'tally') ? [] : [{ id: "no", label: "不使用", score: 0 }]),
            ]);
            if (yes === "no") {
              s.actions[side] = 8;
              s.active = other(side);
              continue;
            }
          }
          await this.action(side);
        } else throw new Error(`未知阶段 ${s.phase}`);
      }
      this.match.validate();
      this.changed();
      this.o.onCheckpoint?.(this.snapshot);
      await P.result(this.result!, this.snapshot);
      return this.result;
    } catch (error) {
      if (error === ABORTED) return null;
      this.o.onError?.(error);
      throw error;
    }
  }
  resign(): void {
    this.match.end(1, "resign", "美国认输");
    this.changed();
    this.o.onCheckpoint?.(this.snapshot);
    this.stop();
    this.P?.dispose();
  }
}
