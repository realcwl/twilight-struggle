import type { SideIndex } from "../../hud/types";
import type { CardMove, RollSpec } from "../../play/types";
import { CARD, REGIONS, other, type Intent, type Match } from "./model";
import { trackPassive } from './passives';

export type Choice = {
  id: string;
  label: string;
  score?: number;
  card?: string;
};
export type EventContext = {
  m: Match;
  by: SideIndex;
  playedBy: SideIndex;
  id: string;
  stage(e: Intent[]): Promise<void>;
  roll(spec: RollSpec): Promise<void>;
  choose(side: SideIndex, title: string, choices: Choice[], confirmSingle?: boolean): Promise<string>;
  score(region: string): Promise<void>;
  target(
    side: SideIndex,
    title: string,
    ids: string[],
    score?: (id: string) => number,
    optional?: boolean,
  ): Promise<string | null>;
  ops(
    side: SideIndex,
    points: number,
    modes?: ("place" | "coup" | "realign")[],
    region?: string[],
    free?: boolean,
  ): Promise<void>;
  coup(
    side: SideIndex,
    id: string,
    ops: number,
    free?: boolean,
    ignoreDefcon?: boolean,
  ): Promise<number>;
  canCoup(side: SideIndex, id: string, ops: number, ignoreDefcon?: boolean): boolean;
  space(side: SideIndex, steps: number, onlyLast?: boolean): Promise<void>;
  play(
    side: SideIndex,
    id: string,
    mode: "event" | "ops" | "choose",
  ): Promise<void>;
  reveal(side: SideIndex, ids: string[], title: string): Promise<void>;
  move(change: CardMove, commit: () => void): Promise<void>;
};
export function eventAllowed(m: Match, id: string, by: SideIndex): boolean {
  const h = (k: string) => m.has(k),
    s = m.s;
  switch (Number(id)) {
    case 6:
      return false;
    case 7:
      return !h("ironLady");
    case 13:
      return !h("campDavid");
    case 21:
      return h("marshall") || h("warsaw");
    case 32:
      return (
        s.phase !== "headline" &&
        s.hands[by].some((c) => m.owned(c) === other(by))
      );
    case 48:
      return (
        m.ids.filter((c) => m.countries.get(c)!.key && m.control(c) === 0)
          .length >
        m.ids.filter((c) => m.countries.get(c)!.key && m.control(c) === 1)
          .length
      );
    case 55:
      return !h("wall");
    case 56:
      return !h("awacs");
    case 59:
      return !h("evilEmpire");
    case 61:
      return !h("northSea");
    case 80:
      return s.space[by] < s.space[other(by)];
    case 85:
      return s.space[0] > s.space[1];
    case 100:
      return s.crisis === 2;
    case 101:
      return h("pope");
    case 104:
      return s.turn < 8;
    case 105:
      return m.control("gbr") === 0;
    case 108:
      return m.ids.some((c) => m.region(c, "mideast") && m.control(c) === 0);
    default:
      return true;
  }
}
/** One explicit handler per catalog event. Never infer an event's effect from its prose. */
export async function resolveEvent(c: EventContext): Promise<boolean> {
  const { m, by, id } = c,
    s = m.s,
    n = Number(id),
    opp = other(by);
  if (!eventAllowed(m, id, by)) return false;
  const add = async (side: SideIndex, country: string, d: number) => {
    await c.stage([{ t: "inf", id: country, side, d }]);
  };
  const rm = async (side: SideIndex, country: string, n = Infinity) =>
    add(side, country, -Math.min(n, m.inf(country)[side]));
  const vp = async (side: SideIndex, d: number) => {
    if (d) await c.stage([{ t: "vp", side, d, why: CARD.get(id)!.title }]);
  };
  const def = async (level: number) =>
    c.stage([{ t: "crisis", d: level - s.crisis, why: CARD.get(id)!.title }]);
  const mil = async (side: SideIndex, d: number) =>
    c.stage([{ t: "milops", side, d }]);
  const flag = (key: string, value: number | string | boolean = true) => {
    s.flags[key] = value;
    trackPassive(s, id, c.playedBy, key, false);
  };
  const temp = (key: string, value: number | string | boolean = true) => {
    s.temp[key] = value;
    trackPassive(s, id, c.playedBy, key, true);
  };
  const move = (card: string, from: CardMove['from'], to: CardMove['to'], reason: string, commit: () => void) =>
    c.move({ card, source: id, from, to, reason }, commit);
  const china = (side: SideIndex, available: boolean) => move('006', { hand: s.china.owner }, { hand: side },
    available ? '中国牌转移 · 立即可用' : '中国牌转移 · 下回合可用', () => { s.china = { owner: side, available }; });
  const ids = (...r: string[]) =>
    m.ids.filter((x) => r.some((v) => m.region(x, v)));
  const countryValue = (x: string, side: SideIndex, remove = false) => {
    const v = m.inf(x),
      st = m.countries.get(x)!.stability;
    return (
      (m.countries.get(x)!.key ? 5 : 1) +
      (remove
        ? (m.control(x) === side ? 4 : 0) + Math.min(v[side], 3)
        : m.control(x) === side
          ? -3
          : Math.max(0, 6 - Math.abs(v[other(side)] + st - v[side]))) +
      (x === "tha" ? 2 : 0)
    );
  };
  const pick = async (
    side: SideIndex,
    list: string[],
    hint: string,
    remove = false,
    affected = side,
    optional = false,
  ) =>
    c.target(
      side,
      hint,
      list,
      (x) => countryValue(x, affected, remove),
      optional,
    );
  const distribute = async (
    side: SideIndex,
    list: string[],
    points: number,
    cap = Infinity,
    remove = false,
    chooser = side,
  ) => {
    const used: Record<string, number> = {};
    for (let i = 0; i < points && !s.result; i++) {
      const available = list.filter(
        (x) => (used[x] ?? 0) < cap && (!remove || m.inf(x)[side] > 0),
      );
      if (!available.length) break;
      const x = await pick(
        chooser,
        available,
        `${remove ? "移除" : "放置"}${points - i}点${side === 0 ? "美国" : "苏联"}影响力`,
        remove,
        side,
      );
      if (!x) break;
      used[x] = (used[x] ?? 0) + 1;
      await add(side, x, remove ? -1 : 1);
    }
  };
  const removeAll = async (
    side: SideIndex,
    list: string[],
    count: number,
    chooser: SideIndex,
  ) => {
    const available = list.filter((x) => m.inf(x)[side] > 0);
    for (let i = 0; i < count && available.length && !s.result; i++) {
      const x = await pick(
        chooser,
        available,
        "选择移除全部影响力的国家",
        true,
        side,
      );
      if (!x) break;
      await rm(side, x);
      available.splice(available.indexOf(x), 1);
    }
  };
  const discard = async (
    side: SideIndex,
    eligible: string[],
    optional = false,
  ) => {
    if (!eligible.length) return null;
    const options = eligible.map((card) => ({
      id: card,
      label: CARD.get(card)!.title,
      card,
      score:
        m.owned(card) === other(side)
          ? 7 - CARD.get(card)!.value
          : 3 - CARD.get(card)!.value,
    }));
    const chosen = await c.choose(side, "选择弃牌", [
      ...options,
      ...(optional ? [{ id: "skip", label: "不弃牌", score: -3 }] : []),
    ]);
    if (chosen === "skip") return null;
    const at = s.hands[side].indexOf(chosen);
    if (at < 0) throw new Error("弃牌不在手中");
    await move(chosen, { hand: side }, 'discard', '事件要求弃牌', () => {
      s.hands[side].splice(at, 1); m.discard(chosen, false);
    });
    return chosen;
  };
  const randomDiscard = async (
    side: SideIndex,
    count: number,
    triggerUS = false,
  ) => {
    for (let i = 0; i < count && s.hands[side].length && !s.result; i++) {
      const at = Math.floor(m.random() * s.hands[side].length),
        card = s.hands[side][at];
      const fires = triggerUS && m.owned(card) === 0;
      await move(card, { hand: side }, fires ? { play: 0 } : 'discard', fires ? '随机抽出 · 触发美国事件' : '随机弃牌', () => {
        s.hands[side].splice(at, 1); if (!fires) m.discard(card, false);
      });
      if (fires) await c.play(0, card, "event");
    }
  };
  const control = async (side: SideIndex, country: string) => {
    await rm(other(side), country);
    await add(
      side,
      country,
      Math.max(0, m.countries.get(country)!.stability - m.inf(country)[side]),
    );
  };
  const war = async (
    side: SideIndex,
    list: string[],
    threshold: number,
    award: number,
    ops: number,
    selfPenalty = false,
  ) => {
    const x = await pick(side, list, "选择战争目标", true, other(side));
    if (!x) return;
    const neighbors = m.adj.get(x)!.filter((y) => m.control(y) === other(side)).length;
    const targetPenalty = selfPenalty && m.control(x) === other(side) ? 1 : 0;
    const penalty = neighbors + targetPenalty;
    const roll = m.die();
    const ok = roll - penalty >= threshold;
    const before: [number, number] = [...m.inf(x)], after: [number, number] = [...before];
    if (ok) { after[side] += after[other(side)]; after[other(side)] = 0; }
    const stability = m.countries.get(x)!.stability;
    const controller = after[0] - after[1] >= stability ? 0 : after[1] - after[0] >= stability ? 1 : null;
    await c.roll({
      kind: 'check', by: side, card: id, id: x,
      rule: `修正后 ${threshold}–6 成功 · 每个相邻敌控国 −1${selfPenalty ? ' · 目标国被敌控再 −1' : ''}`,
      range: [threshold, 6],
      chance: Math.max(0, 7 - threshold - penalty) / 6,
      dice: [{ side, value: roll, total: roll - penalty, mods: [
        ...(neighbors ? [{ label: '敌方控制邻国', n: -neighbors }] : []),
        ...(targetPenalty ? [{ label: '敌方控制目标国', n: -targetPenalty }] : []),
      ] }],
      ok, text: ok ? '战争成功' : '战争失败',
      situation: { before, after, controlBefore: m.control(x), controlAfter: controller, crisisBefore: s.crisis, crisisAfter: s.crisis },
    });
    m.log(`战争掷骰 ${roll} − ${penalty}，需要 ${threshold}+`, false);
    if (ok) {
      const count = m.inf(x)[other(side)];
      await rm(other(side), x);
      await add(side, x, count);
      await vp(side, award);
    } else
      await c.stage([
        {
          t: "note",
          text: `战争失败：骰点 ${roll} − 修正 ${penalty} < ${threshold}`,
          id: x,
        },
      ]);
    await mil(side, ops);
  };
  if (REGIONS[id]) {
    await c.score(REGIONS[id]);
    return true;
  }
  switch (n) {
    case 4:
      await def(s.crisis - 1);
      await vp(0, 5 - s.crisis);
      break;
    case 5:
      await randomDiscard(1, 1, true);
      break;
    case 7:
      await distribute(0, ids("western-europe"), 3, 2, true, 1);
      break;
    case 8:
      await control(1, "cub");
      break;
    case 9:
      await add(1, "vnm", 2);
      temp("vietnam");
      break;
    case 10:
      if (
        !(await discard(
          0,
          s.hands[0].filter((x) => m.ops(x, 0) >= 3),
          true,
        ))
      )
        await rm(0, "frg");
      break;
    case 11:
      await war(1, ["kor"], 4, 2, 2);
      break;
    case 12:
      await control(1, "rou");
      break;
    case 13:
      await war(1, ["isr"], 4, 2, 2, true);
      break;
    case 14:
      await distribute(
        1,
        ids("eastern-europe").filter((x) => m.control(x) !== 0),
        4,
        1,
      );
      break;
    case 15:
      await add(1, "egy", 2);
      await rm(0, "egy", Math.ceil(m.inf("egy")[0] / 2));
      break;
    case 16: {
      const mode = await c.choose(1, "华沙条约组织", [
        { id: "add", label: "增加5点影响力", score: 4 },
        {
          id: "remove",
          label: "移除4国全部美国影响力",
          score: ids("eastern-europe").reduce((a, x) => a + m.inf(x)[0], 0),
        },
      ]);
      if (mode === "add") await distribute(1, ids("eastern-europe"), 5, 2);
      else await removeAll(0, ids("eastern-europe"), 4, 1);
      flag("warsaw");
      break;
    }
    case 17:
      await rm(0, "fra", 2);
      await add(1, "fra", 1);
      flag("deGaulle");
      break;
    case 18:
      await c.space(by, 1);
      break;
    case 19:
      await removeAll(
        1,
        ids("europe").filter((x) => m.control(x) === null),
        1,
        0,
      );
      break;
    case 20: {
      const option = await c.choose(opp, "参加奥运会？", [
        { id: "participate", label: "参加：双方掷骰，主办方+2", score: 2 },
        ...(s.crisis > 2 ? [{
          id: "boycott",
          label: "抵制：DEFCON降低1，主办方执行4点行动",
          score: -2,
        }] : []),
      ]);
      await c.stage([{ t: 'note', text: `${opp === 0 ? '美国' : '苏联'}选择${option === 'boycott' ? '抵制奥运会' : '参加奥运会'}` }]);
      if (option === "boycott") {
        await def(s.crisis - 1);
        await c.ops(by, m.modifiedOps(4, by));
      } else {
        let a = 0,
          b = 0;
        do {
          a = m.die() + 2;
          b = m.die();
          const winner = a === b ? null : a > b ? by : opp;
          await c.roll({
            kind: 'contest', by, card: id,
            rule: '主办方 +2 · 高者获得 2 VP · 平局重掷',
            dice: [
              { side: by, value: a - 2, mods: [{ label: '主办方', n: 2 }], total: a },
              { side: opp, value: b, mods: [], total: b },
            ],
            winner, ok: winner === by,
            text: winner === null ? '平局 · 重新掷骰' : `${winner === 0 ? '美国' : '苏联'}获胜 · +2 VP`,
          });
        } while (a === b);
        await vp(a > b ? by : opp, 2);
      }
      break;
    }
    case 21:
      flag("nato");
      break;
    case 22: {
      const x = await pick(
        0,
        ["yug", "rou", "bgr", "hun", "cze"],
        "选择一个国家",
      );
      if (x) await add(0, x, Math.max(0, m.inf(x)[1] - m.inf(x)[0]));
      break;
    }
    case 23:
      await distribute(
        0,
        ids("western-europe").filter((x) => m.control(x) !== 1),
        7,
        1,
      );
      flag("marshall");
      break;
    case 24:
      await war(by, ["ind", "pak"], 4, 2, 2);
      break;
    case 25:
      temp("ops0", Number(s.temp.ops0 ?? 0) + 1);
      break;
    case 26:
      await c.reveal(0, s.hands[1], "苏联手牌");
      await c.ops(0, m.modifiedOps(1, 0));
      break;
    case 27:
      await add(
        0,
        "jpn",
        Math.max(
          0,
          m.inf("jpn")[1] + m.countries.get("jpn")!.stability - m.inf("jpn")[0],
        ),
      );
      flag("japan");
      break;
    case 28:
      await distribute(0, ["fra", "gbr", "isr"], 4, 2, true, 1);
      break;
    case 29: {
      const available = ids("eastern-europe");
      for (let i = 0; i < 3 && available.length; i++) {
        const x = await pick(
          0,
          available.filter((x) => m.inf(x)[1] > 0),
          "选择东欧国家",
          true,
          1,
        );
        if (!x) break;
        await rm(1, x, s.turn >= 8 ? 2 : 1);
        available.splice(available.indexOf(x), 1);
      }
      break;
    }
    case 30:
      await distribute(1, ids("africa", "southeast-asia"), 4, 1);
      break;
    case 31:
      temp(`ops${opp}`, Number(s.temp[`ops${opp}`] ?? 0) - 1);
      break;
    case 32: {
      const cards = s.hands[by].filter((x) => m.owned(x) === opp);
      const card = await c.choose(
        by,
        "选择配合联合国干预的对手事件牌",
        cards.map((x) => ({
          id: x,
          label: CARD.get(x)!.title,
          card: x,
          score: m.ops(x, by),
        })),
        true,
      );
      await move(card, { hand: by }, { play: by }, '联合国干预 · 仅使用行动点，不触发对手事件', () => {
        s.hands[by].splice(s.hands[by].indexOf(card), 1);
      });
      if (m.has("u2")) await vp(1, 1);
      await c.play(by, card, "ops");
      break;
    }
    case 33: {
      const before = m.ids.reduce((v, x) => v + m.inf(x)[1], 0);
      const count = Number(
        await c.choose(
          1,
          "去斯大林化：转移多少影响力？",
          [0, 1, 2, 3, 4].map((n) => ({
            id: String(n),
            label: `转移${n}点`,
            score: n,
          })),
        ),
      );
      await distribute(1, m.ids, count, Infinity, true, 1);
      const removed = before - m.ids.reduce((v, x) => v + m.inf(x)[1], 0);
      await distribute(
        1,
        m.ids.filter((x) => m.control(x) !== 0),
        removed,
        2,
      );
      break;
    }
    case 34:
      await vp(by, Math.max(0, s.crisis - 2));
      await def(s.crisis + 2);
      break;
    case 35:
      flag("formosan");
      break;
    case 36:
      await war(
        by,
        m.ids.filter(
          (x) =>
            m.countries.get(x)!.stability <= 2 &&
            !(
              by === 1 &&
              m.has("nato") &&
              m.region(x, "europe") &&
              m.control(x) === 0 &&
              !(x === "fra" && m.has("deGaulle")) &&
              !(x === "frg" && m.has("brandt"))
            ),
        ),
        3,
        1,
        3,
      );
      break;
    case 39:
      if (s.milops[by] > s.milops[opp])
        await vp(by, s.milops[by] >= s.crisis ? 3 : 1);
      break;
    case 40:
      await def(2);
      temp(`missile${opp}`);
      break;
    case 41:
      temp("subs");
      break;
    case 42:
      flag("trap0");
      delete s.flags.norad;
      break;
    case 43: {
      await def(s.crisis + 2);
      temp("salt");
      const eligible = s.discard.filter((x) => CARD.get(x)!.kind !== "tally");
      if (eligible.length) {
        const chosen = await c.choose(by, "从弃牌堆回收一张牌", [
          ...eligible.map((x) => ({
            id: x,
            label: CARD.get(x)!.title,
            card: x,
            score: m.ops(x, by) + (m.owned(x) === by ? 3 : 0),
          })),
          { id: "skip", label: "不回收", score: -1 },
        ]);
        if (chosen !== "skip") {
          await move(chosen, 'discard', { hand: by }, '从弃牌堆回收', () => {
            s.discard.splice(s.discard.indexOf(chosen), 1); s.hands[by].push(chosen);
          });
        }
      }
      break;
    }
    case 44:
      flag("trap1");
      break;
    case 45: {
      const tally = (side: SideIndex) =>
        m.scenario.regions.filter((r) =>
          ["domination", "control"].includes(m.scoring(r.id, false, { eventModifiers: false }).standing[side]),
        ).length;
      const bonus = [tally(0), tally(1)];
      const a = m.die() + bonus[0], b = m.die() + bonus[1];
      const winner: SideIndex | null = a === b ? null : a > b ? 0 : 1;
      await c.roll({
        kind: 'contest', by, card: id,
        rule: '每个支配或控制地区 +1 · 胜者获 2 VP 并可调整核危机 · 平局结束',
        dice: ([0, 1] as const).map(side => ({
          side, value: (side === 0 ? a : b) - bonus[side], total: side === 0 ? a : b,
          mods: bonus[side] ? [{ label: '支配或控制地区', n: bonus[side] }] : [],
        })),
        winner, ok: winner === by,
        text: winner === null ? '平局 · 无人获胜' : `${winner === 0 ? '美国' : '苏联'}获胜 · +2 VP`,
      });
      if (winner !== null) {
        await vp(winner, 2);
        const choice = await c.choose(winner, "峰会：调整DEFCON", [
          { id: "up", label: "提高1级", score: 2 },
          { id: "stay", label: "不变", score: 1 },
          ...(s.crisis > 2 ? [{ id: "down", label: "降低1级", score: 0 }] : []),
        ]);
        if (choice !== "stay") await def(s.crisis + (choice === "up" ? 1 : -1));
      }
      break;
    }
    case 46: {
      const v = await c.choose(
        by,
        "选择DEFCON等级",
        [2, 3, 4, 5].map((x) => ({
          id: String(x),
          label: `DEFCON ${x}`,
          score: x === 5 ? 2 : x === 1 ? -20 : 0,
        })),
      );
      await def(Number(v));
      await mil(by, 5);
      break;
    }
    case 47: {
      const x = await pick(
        by,
        ids("camerica", "samerica"),
        "军政府：放置2点影响力",
      );
      if (x) await add(by, x, 2);
      await c.ops(
        by,
        m.ops(id, by),
        ["coup", "realign"],
        ["camerica", "samerica"],
        true,
      );
      break;
    }
    case 48:
      await vp(0, 2);
      break;
    case 49: {
      const hand = s.hands[opp];
      if (!hand.length) return false;
      const max = Math.max(...hand.map((x) => CARD.get(x)!.value));
      const chosen = await c.choose(
        opp,
        "导弹嫉妒：交出最高行动点牌",
        hand
          .filter((x) => CARD.get(x)!.value === max)
          .map((x) => ({
            id: x,
            label: CARD.get(x)!.title,
            card: x,
            score: m.owned(x) === by ? -3 : 1,
          })),
      );
      await move(chosen, { hand: opp }, { play: by }, m.owned(chosen) === opp ? '拿取对手最高行动点牌 · 仅使用行动点' : '拿取对手最高行动点牌 · 随后执行事件', () => {
        hand.splice(hand.indexOf(chosen), 1);
      });
      await c.play(by, chosen, m.owned(chosen) === opp ? "ops" : "event");
      hand.push(id);
      temp(`envy${opp}`);
      break;
    }
    case 50:
      await def(s.crisis - 1);
      flag("bury");
      break;
    case 51:
      temp("ops1", Number(s.temp.ops1 ?? 0) + 1);
      break;
    case 52:
      await add(1, "ago", 2);
      await add(1, "seafrica", 2);
      break;
    case 53: {
      const choice = await c.choose(1, "南非动荡", [
        { id: "south", label: "南非增加2点", score: 2 },
        { id: "adjacent", label: "南非1点，相邻国家2点", score: 3 },
      ]);
      await add(1, "zaf", choice === "south" ? 2 : 1);
      if (choice === "adjacent")
        await distribute(
          1,
          m.adj.get("zaf")!.filter((x) => m.ids.includes(x)),
          2,
        );
      break;
    }
    case 54:
      await add(1, "chl", 2);
      break;
    case 55:
      await vp(1, 1);
      await add(1, "frg", 1);
      flag("brandt");
      break;
    case 56:
      await removeAll(
        0,
        ["sdn", "irn", "irq", "egy", "lby", "sau", "syr", "jor"],
        2,
        1,
      );
      break;
    case 57:
      await def(s.crisis + 1);
      await c.ops(by, m.modifiedOps(4, by));
      break;
    case 58:
      if (s.china.owner === 1) await vp(1, 1);
      else await china(1, true);
      break;
    case 59:
      flag("flower");
      break;
    case 60:
      await vp(1, 1);
      temp("u2");
      break;
    case 61:
      await vp(
        1,
        ["egy", "irn", "lby", "sau", "irq", "gulf", "ven"].filter(
          (x) => m.control(x) === 1,
        ).length,
      );
      break;
    case 62:
      await c.reveal(1, s.hands[0], "美国手牌");
      await c.ops(1, m.modifiedOps(1, 1));
      break;
    case 63:
      await distribute(0, ids("africa", "southeast-asia"), 4, 1);
      break;
    case 64:
      for (const x of ["pan", "cri", "ven"]) await add(0, x, 1);
      break;
    case 65:
      await vp(0, 1);
      for (const x of ["isr", "jor", "egy"]) await add(0, x, 1);
      flag("campDavid");
      break;
    case 66:
      await distribute(
        0,
        m.ids.filter((x) => m.inf(x)[0] + m.inf(x)[1] === 0),
        3,
        1,
      );
      break;
    case 67: {
      const hand = s.hands[1];
      if (!hand.length) {
        await c.ops(0, m.ops(id, 0));
        break;
      }
      const at = Math.floor(m.random() * hand.length), taken = hand[at];
      await move(taken, { hand: 1 }, { play: 0 }, '粮食交易 · 随机抽取一张苏联手牌', () => { hand.splice(at, 1); });
      const choice = await c.choose(0, "粮食交易：使用或归还抽到的牌", [
        {
          id: "play",
          label: `使用《${CARD.get(taken)!.title}》`,
          card: taken,
          score: m.owned(taken) === 1 ? -2 : 4,
        },
        { id: "return", label: "归还，改用粮食交易的行动点", score: 1 },
      ]);
      if (choice === "play") await c.play(0, taken, "choose");
      else {
        await move(taken, { play: 0 }, { hand: 1 }, '归还抽到的牌 · 改用粮食交易的行动点', () => { hand.push(taken); });
        await c.ops(0, m.ops(id, 0));
      }
      break;
    }
    case 68:
      await rm(1, "pol", 2);
      await add(0, "pol", 1);
      flag("pope");
      break;
    case 69:
      temp("deathSquads", by + 1);
      break;
    case 70:
      await distribute(0, ids("camerica", "samerica"), 2);
      break;
    case 71:
      if (s.china.owner === 0) await vp(0, 2);
      else await china(0, false);
      break;
    case 72:
      await rm(1, "egy");
      await add(0, "egy", 1);
      break;
    case 73:
      flag("shuttle");
      if (!s.inPlay.includes(id)) s.inPlay.push(id);
      break;
    case 74:
      await distribute(
        1,
        m.ids.filter((x) => !m.region(x, "europe")),
        4,
        2,
        true,
        0,
      );
      break;
    case 75:
      await distribute(1, ids("camerica"), 3, 2);
      break;
    case 76:
      if (s.china.owner === 1) await china(0, true);
      else await distribute(0, ids("asia"), 4, 2);
      break;
    case 77: {
      let count = 0;
      while (s.hands[0].length) {
        const choice = await c.choose(0, "先选完所有弃牌，再补牌", [
          ...s.hands[0].map((x) => ({
            id: x,
            label: CARD.get(x)!.title,
            card: x,
            score: m.owned(x) === 1 ? 3 : -2,
          })),
          { id: "done", label: "完成，抽取替代牌", score: 0 },
        ]);
        if (choice === "done") break;
        await move(choice, { hand: 0 }, 'discard', '弃掉手牌，随后补牌', () => {
          s.hands[0].splice(s.hands[0].indexOf(choice), 1); m.discard(choice, false);
        });
        count++;
      }
      m.draw(0, count);
      break;
    }
    case 78:
      await vp(
        0,
        ids("camerica", "samerica").filter(
          (x) => m.control(x) === 0 && m.countries.get(x)!.key,
        ).length,
      );
      break;
    case 80:
      await c.space(by, 2, true);
      break;
    case 82:
      await rm(0, "irn");
      await add(1, "irn", 2);
      flag("hostage");
      break;
    case 83:
      await vp(0, 1);
      await add(1, "arg", 1);
      await rm(1, "gbr");
      flag("ironLady");
      break;
    case 84:
      await vp(0, Math.floor(m.inf("lby")[1] / 2));
      break;
    case 85: {
      const list = s.discard.filter(
        (x) => CARD.get(x)!.kind !== "tally" && x !== id,
      );
      if (!list.length) break;
      const chosen = await c.choose(
        0,
        "星球大战：选择弃牌事件",
        list.map((x) => ({
          id: x,
          label: CARD.get(x)!.title,
          card: x,
          score: m.owned(x) === 0 ? 6 : m.owned(x) === 1 ? -10 : 2,
        })),
      );
      s.discard.splice(s.discard.indexOf(chosen), 1);
      await c.play(0, chosen, "event");
      break;
    }
    case 86:
      flag("northSea");
      temp("northSea");
      break;
    case 87:
      await distribute(1, ids("europe"), s.vp < 0 ? 6 : 4, 2);
      flag("reformer");
      break;
    case 88:
      await rm(0, "lbn");
      await distribute(0, ids("mideast"), 2, Infinity, true, 1);
      break;
    case 89:
      await def(s.crisis - 1);
      await vp(0, 2);
      if (m.control("kor") === 0)
        await c.ops(0, m.modifiedOps(4, 0), ["place", "realign"]);
      break;
    case 90:
      await vp(1, 2);
      await def(s.crisis + 1);
      if (m.has("reformer"))
        await c.ops(1, m.modifiedOps(4, 1), ["place", "realign"]);
      break;
    case 91: {
      await rm(0, "nic");
      const targets = m.adj
        .get("nic")!
        .filter((x) => m.ids.includes(x) && c.canCoup(1, x, m.ops(id, 1), true));
      const x = await pick(1, targets, "奥尔特加：免费政变", true, 0, true);
      if (x) await c.coup(1, x, m.ops(id, 1), true, true);
      break;
    }
    case 92:
      await randomDiscard(opp, by === 1 && m.has("hostage") ? 2 : 1);
      break;
    case 93:
      temp("iranContra");
      break;
    case 94: {
      const selected = await c.choose(
        0,
        "切尔诺贝利：禁止苏联用行动点放置影响力的地区",
        m.scenario.regions.map((r) => ({
          id: r.id,
          label: r.name.zh,
          score: r.id === "europe" ? 3 : r.id === "asia" ? 2 : 1,
        })),
      );
      temp("chernobyl", selected);
      break;
    }
    case 95:
      if (
        !(await discard(
          0,
          s.hands[0].filter((x) => m.ops(x, 0) >= 3),
          true,
        ))
      ) {
        const available = ids("samerica").filter((x) => m.inf(x)[1] > 0);
        for (let i = 0; i < 2 && available.length; i++) {
          const x = await pick(1, available, "债务危机：苏联影响力翻倍");
          if (!x) break;
          await add(1, x, m.inf(x)[1]);
          available.splice(available.indexOf(x), 1);
        }
      }
      break;
    case 96:
      delete s.flags.brandt;
      flag("wall");
      await add(0, "gdr", 3);
      await c.ops(0, m.ops(id, 0), ["coup", "realign"], ["europe"], true);
      break;
    case 97:
      delete s.flags.flower;
      flag("evilEmpire");
      await vp(0, 1);
      break;
    case 98:
      temp("ames");
      await c.reveal(1, s.hands[0], "美国手牌");
      if (s.hands[0].length) {
        const choice = await c.choose(
          1,
          "奥尔德里奇·艾姆斯：弃掉一张美国手牌",
          s.hands[0].map((x) => ({
            id: x,
            label: CARD.get(x)!.title,
            card: x,
            score: CARD.get(x)!.value + (m.owned(x) === 0 ? 4 : 0),
          })),
        );
        await move(choice, { hand: 0 }, 'discard', '苏联指定美国弃掉此牌', () => {
          s.hands[0].splice(s.hands[0].indexOf(choice), 1); m.discard(choice, false);
        });
      }
      break;
    case 99:
      await vp(1, 1);
      await distribute(0, ids("western-europe"), 3, 1, true, 1);
      break;
    case 100: {
      const decision = await c.choose(by, "战争游戏：给对手6VP并立即结算？", [
        {
          id: "end",
          label: "给对手6VP，结束游戏",
          score: (by === 0 ? s.vp : -s.vp) > 6 ? 20 : -20,
        },
        { id: "continue", label: "继续游戏", score: 0 },
      ]);
      if (decision === "end") {
        m.apply({ t: "vp", side: opp, d: 6 }, false);
        m.end(
          s.vp === 0 ? null : s.vp > 0 ? 0 : 1,
          "wargames",
          "战争游戏结束对局",
        );
      } else return false;
      break;
    }
    case 101:
      await add(0, "pol", 3);
      break;
    case 102:
      await war(by, ["irn", "irq"], 4, 2, 2);
      break;
    case 103:
      if (s.phase !== "headline" && s.active === 1) await vp(0, 1);
      break;
    case 104: {
      const cards = s.hands[0].filter((x) => CARD.get(x)!.kind === "tally");
      await c.reveal(1, cards, "美国计分牌");
      const regions = [...new Set(cards.map((x) => REGIONS[x]))];
      if (regions.length) await distribute(1, ids(...regions), 1);
      break;
    }
    case 105:
      if (m.has("nato")) {
        const x = await pick(
          0,
          ids("western-europe"),
          "特殊关系：增加2点影响力",
        );
        if (x) await add(0, x, 2);
        await vp(0, 2);
      } else
        await distribute(
          0,
          m.adj.get("gbr")!.filter((x) => m.ids.includes(x)),
          1,
        );
      break;
    case 106:
      flag("norad");
      break;
    case 107: {
      const list = ids("africa", "camerica", "samerica").filter(
        (x) => !m.countries.get(x)!.key && c.canCoup(1, x, m.ops(id, 1), true),
      );
      const x = await pick(1, list, "切·格瓦拉：第一次政变", true, 0, true);
      if (x && (await c.coup(1, x, m.ops(id, 1), false, true)) > 0) {
        const next = await pick(
          1,
          list.filter((y) => y !== x && c.canCoup(1, y, m.ops(id, 1), true)),
          "切·格瓦拉：第二次政变",
          true,
          0,
          true,
        );
        if (next) await c.coup(1, next, m.ops(id, 1), false, true);
      }
      break;
    }
    case 108: {
      const top = s.deck.splice(0, 5),
        keep = [...top];
      for (;;) {
        const choice = await c.choose(0, "德黑兰：选择要弃掉的牌", [
          ...keep.map((x) => ({
            id: x,
            label: CARD.get(x)!.title,
            card: x,
            score: m.owned(x) === 1 ? 3 : -2,
          })),
          { id: "done", label: "保留其余并洗牌", score: 0 },
        ]);
        if (choice === "done") break;
        keep.splice(keep.indexOf(choice), 1);
        await move(choice, 'deck', 'discard', '德黑兰 · 从牌堆顶弃掉此牌', () => { m.discard(choice, false); });
      }
      s.deck.push(...keep);
      m.shuffle(s.deck);
      break;
    }
    case 109:
      temp("yuri");
      break;
    case 110:
      await add(0, "sau", 2);
      flag("awacs");
      break;
    default:
      throw new Error(`缺少事件实现：${id}`);
  }
  return true;
}
export const IMPLEMENTED_EVENTS = CARDS_WITH_EVENTS();
function CARDS_WITH_EVENTS(): string[] {
  return [...CARD.keys()].filter((id) => id !== "006");
}
