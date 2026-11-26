import assert from "node:assert/strict";
import { test } from "node:test";
import rawScenario from "../../data/scenarios/coldwar/scenario.json";
import type { Scenario } from "../map/types";
import type { Decision, Effect, RollSpec } from "../play/types";
import { createHeuristicAgent } from "./ai/heuristic";
import { SoloGame, type SoloPresenter } from "./solo/engine";
import { CARD, CARDS, Match, type MatchState } from "./solo/model";
import { headlessPresenter } from "./solo/headless";
import { eventAllowed } from "./solo/events";
import { availableUses } from '../play/choices';
import { trackPassive } from './solo/passives';

const scenario = rawScenario as unknown as Scenario;
const fresh = (seed = 1) =>
  new SoloGame({ scenario, lang: "zh", seed, onChange() {} });
function give(m: Match, id: string, side: 0 | 1): void {
  for (const list of [
    ...m.s.hands,
    m.s.deck,
    m.s.discard,
    m.s.removed,
    m.s.future,
    m.s.inPlay,
  ]) {
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
  }
  m.s.hands[side].push(id);
}
async function one(
  id: string,
  side: 0 | 1 = 0,
  edit: (g: SoloGame) => void = () => {},
  decision: Decision = { card: id, use: "event" },
  decorate?: (p: SoloPresenter) => SoloPresenter,
) {
  const agent = { ...createHeuristicAgent(), chooseAction: () => decision };
  const g = new SoloGame({
    scenario,
    lang: "zh",
    seed: 12,
    agent,
    onChange() {},
    onCheckpoint() {
      g.stop();
    },
  });
  const s = g.match.s;
  s.phase = "action";
  s.active = side;
  s.round = 1;
  give(g.match, id, side);
  edit(g);
  const effects: Effect[] = [];
  const p = {
    ...headlessPresenter(g),
    async decide() {
      return decision;
    },
    async step(e: Effect, commit: () => void) {
      effects.push(e);
      commit();
    },
  };
  await g.start(decorate ? decorate(p) : p);
  g.match.validate();
  return { g, effects };
}

test("opening deals eight each, China separately, and all 109 draw cards are conserved", () => {
  const m = new Match(scenario, 123);
  m.validate();
  assert.deepEqual(
    m.s.hands.map((h) => h.length),
    [8, 8],
  );
  assert.deepEqual(m.s.china, { owner: 1, available: true });
  assert.equal(m.hand(1).length, 9);
  assert.ok(m.s.deck.every((id) => CARD.get(id)!.era === "early"));
  assert.equal(m.inf("gbr")[0], 5);
  assert.deepEqual(m.snapshot(), new Match(scenario, 123).snapshot());
});

test('coup presentation reports the actual before/after situation for success and failure',async()=>{
  for(const [target,roll] of [['irn',6],['frg',1]] as const){
    let shown: import('../play/types').RollSpec | undefined;
    const {g}=await one('034',1,g=>{
      g.match.s.crisis=5;
      g.match.s.inf[target]=[target==='irn'?3:4,0];
      g.match.die=()=>roll;
    },{card:'034',use:'ops',mode:'coup',target},p=>({...p,async roll(spec){shown=spec;}}));
    assert.ok(shown?.situation);
    assert.deepEqual(shown.situation.before,[target==='irn'?3:4,0]);
    assert.deepEqual(shown.situation.after,g.match.inf(target));
    assert.equal(shown.situation.controlAfter,g.match.control(target));
    assert.equal(shown.situation.crisisAfter,g.match.s.crisis);
    assert.equal(shown.ok,target==='irn');
  }
});

test('Olympics shows every contest before awarding VP, including ties and either host', async () => {
  for (const host of [0, 1] as const) {
    const dice = host === 0 ? [2, 4, 6, 1] : [1, 6];
    const rolls: RollSpec[] = [];
    let rolled = 0;
    const { g, effects } = await one('020', host, g => {
      g.match.die = () => { assert.ok(rolled < dice.length); return dice[rolled++]; };
    }, { card: '020', use: 'event' }, p => ({ ...p, async roll(spec) {
      rolls.push(spec);
    } }));
    assert.equal(rolled, dice.length);
    assert.equal(rolls.length, host === 0 ? 2 : 1);
    assert.ok(rolls.every(r => r.kind === 'contest' && r.card === '020'));
    for (const r of rolls) {
      assert.deepEqual(r.dice.map(d => d.side), [host, 1 - host]);
      assert.equal(r.dice[0].total, r.dice[0].value + 2);
      assert.deepEqual(r.dice[0].mods, [{ label: '主办方', n: 2 }]);
      assert.equal(r.dice[1].total, r.dice[1].value);
    }
    if (host === 0) { assert.equal(rolls[0].winner, null); assert.match(rolls[0].text, /重新掷骰/); }
    assert.equal(rolls.at(-1)!.winner, 0);
    assert.equal(g.snapshot.vp, 2);
    assert.equal(effects.filter(e => e.t === 'vp').length, 1);
    assert.ok(effects.some(e => e.t === 'note' && e.text.includes('选择参加')));
    const lines = g.state.battleLog!.find(e => e.card === '020')!.lines;
    assert.equal(lines.filter(l => l.kind === 'roll').length, rolls.length);
    assert.ok(lines.map(l => l.kind).lastIndexOf('roll') < lines.findIndex(l => l.kind === 'score'));
    assert.ok(g.snapshot.discard.includes('020'));
  }
});

test('Olympics waits for dice presentation to finish before awarding the winner', async () => {
  let inRoll: SoloGame | undefined;
  const { g } = await one('020', 0, g => { inRoll = g; g.match.die = () => 3; }, undefined, p => ({ ...p, async roll() {
    assert.equal(inRoll!.snapshot.vp, 0);
    await Promise.resolve();
    assert.equal(inRoll!.snapshot.vp, 0);
  } }));
  assert.equal(g.snapshot.vp, 2);
});

test('Olympics allows a safe boycott and automatically participates at DEFCON 2', async () => {
  for (const crisis of [4, 2]) {
    let points = 0, rolls = 0;
    const { g, effects } = await one('020', 0, g => {
      g.match.s.crisis = crisis;
      g.match.die = () => 3;
      g.agent.chooseOption = () => 'boycott';
    }, undefined, p => ({ ...p,
      async choose(q) { return q.options.some(o => o.id === 'place') ? 'place' : p.choose(q); },
      async place(s) { points = s.points; while (s.left) { const id = [...s.targets()].find(([, t]) => t.ok)?.[0]; assert.ok(id); assert.ok(s.add(id)); } return true; },
      async roll() { rolls++; },
    }));
    assert.equal(g.snapshot.crisis, Math.max(2, crisis - 1));
    assert.equal(rolls, crisis === 2 ? 1 : 0);
    assert.equal(points, crisis === 2 ? 0 : 4);
    assert.equal(g.snapshot.vp, crisis === 2 ? 2 : 0);
    assert.ok(effects.some(e => e.t === 'note' && e.text.includes(crisis === 2 ? '选择参加' : '选择抵制')));
    assert.equal(g.result, null);
  }
});

test('all five war events present modified dice and the target before applying success or failure', async () => {
  const wars = [
    ['011', 1, 'kor', 4, 2, 2], ['013', 1, 'isr', 4, 2, 2],
    ['024', 0, 'ind', 4, 2, 2], ['024', 1, 'pak', 4, 2, 2],
    ['036', 0, 'nic', 3, 1, 3], ['102', 1, 'irq', 4, 2, 2],
  ] as const;
  for (const [id, side, target, threshold, award, milops] of wars) {
    for (const raw of [6, 1]) {
      let shown: RollSpec | undefined, current: SoloGame;
      let before: [number, number] = [0, 0];
      const penalty = id === '013' ? 2 : 1;
      const { g } = await one(id, side, g => {
        current = g;
        for (const country of g.match.ids) g.match.s.inf[country] = [0, 0];
        const v = g.match.s.inf[target]; v[side] = 1; v[1 - side] = g.country(target).stability + 2;
        before = [...v];
        const neighbor = g.match.adj.get(target)!.find(x => g.match.ids.includes(x))!;
        assert.ok(neighbor);
        g.match.s.inf[neighbor][1 - side] = g.country(neighbor).stability;
        g.match.die = () => raw;
        g.agent.chooseOption = () => target;
      }, undefined, p => ({ ...p,
        async pickTarget() { return target; },
        async roll(spec) {
          shown = spec;
          assert.deepEqual(current.match.inf(target), before);
          assert.equal(current.snapshot.vp, 0);
          assert.deepEqual(current.snapshot.milops, [0, 0]);
        },
      }));
      assert.ok(shown, id);
      assert.equal(shown.kind, 'check'); assert.equal(shown.card, id); assert.equal(shown.id, target);
      assert.deepEqual(shown.range, [threshold, 6]);
      assert.equal(shown.dice[0].value, raw); assert.equal(shown.dice[0].total, raw - penalty);
      assert.equal(shown.dice[0].mods.reduce((sum, m) => sum + m.n, 0), -penalty);
      assert.equal(shown.ok, raw === 6);
      const after: [number, number] = raw === 6 ? [0, 0] : [...before];
      if (raw === 6) after[side] = before[0] + before[1];
      assert.deepEqual(g.match.inf(target), after);
      assert.deepEqual(shown.situation?.after, after);
      assert.equal(g.snapshot.vp, raw === 6 ? (side === 0 ? award : -award) : 0);
      assert.equal(g.snapshot.milops[side], milops);
      const lines = g.state.battleLog!.find(e => e.card === id)!.lines;
      assert.equal(lines.filter(l => l.kind === 'roll').length, 1);
      assert.ok(lines.some(l => l.kind === 'roll' && l.country === target && l.text.includes(`成功范围 ${threshold}–6`)));
    }
  }
});

test('a war with an impossible modified roll still shows the die and awards military operations', async () => {
  let shown: RollSpec | undefined;
  const { g } = await one('024', 0, g => {
    for (const x of g.match.ids) g.match.s.inf[x] = [0, 0];
    for (const x of g.match.adj.get('pak')!) if (g.match.ids.includes(x)) g.match.s.inf[x] = [0, g.country(x).stability];
    g.match.s.inf.pak = [1, 3]; g.match.die = () => 1;
  }, undefined, p => ({ ...p, async pickTarget() { return 'pak'; }, async roll(r) { shown = r; } }));
  assert.ok(shown); assert.equal(shown.chance, 0); assert.ok(shown.dice[0].total < 0);
  assert.equal(shown.ok, false); assert.deepEqual(g.match.inf('pak'), [1, 3]); assert.equal(g.snapshot.milops[0], 2);
});

test('Summit uses shared contest dice with regional bonuses, no tie reroll, and a winner-only DEFCON choice', async () => {
  for (const [a, b, winner] of [[2, 3, null], [3, 3, 0], [1, 6, 1]] as const) {
    let shown: RollSpec | undefined, rolls = 0, choices = 0;
    const choice = () => { assert.ok(shown); choices++; return 'down'; };
    const { g } = await one('045', 0, g => {
      for (const x of g.match.ids) {
        g.match.s.inf[x] = [0, 0];
        if (g.match.region(x, 'africa') || g.match.region(x, 'camerica')) g.match.s.inf[x][0] = g.country(x).stability;
        if (g.match.region(x, 'mideast')) g.match.s.inf[x][1] = g.country(x).stability;
      }
      let die = 0; g.match.die = () => [a, b][die++]; g.agent.chooseOption = choice;
    }, undefined, p => ({ ...p, async roll(r) { shown = r; rolls++; }, async choose() { return choice(); } }));
    assert.ok(shown); assert.equal(shown.kind, 'contest'); assert.equal(rolls, 1);
    assert.deepEqual(shown.dice.map(d => d.total), [a + 2, b + 1]);
    assert.deepEqual(shown.dice.map(d => d.mods[0].n), [2, 1]);
    assert.equal(shown.winner, winner); assert.equal(choices, winner === null ? 0 : 1);
    assert.equal(g.snapshot.vp, winner === null ? 0 : winner === 0 ? 2 : -2);
    assert.equal(g.snapshot.crisis, winner === null ? 5 : 4);
  }
});

test('Quagmire and Bear Trap use event checks, never a space launch, before releasing the passive', async () => {
  for (const side of [0, 1] as const) for (const value of [4, 5]) {
    let shown: RollSpec | undefined, current: SoloGame;
    const { g } = await one('025', side, g => {
      current = g; g.match.s.flags[`trap${side}`] = true;
      g.match.die = () => value; g.agent.chooseOption = () => '025';
    }, undefined, p => ({ ...p, async choose() { return '025'; }, async roll(r) {
      shown = r; assert.equal(current.match.s.flags[`trap${side}`], true);
    } }));
    assert.ok(shown); assert.equal(shown.kind, 'check'); assert.equal(shown.card, side === 0 ? '042' : '044');
    assert.deepEqual(shown.range, [1, 4]); assert.equal(shown.ok, value === 4);
    assert.equal(!!g.snapshot.flags[`trap${side}`], value === 5);
    assert.ok(g.snapshot.discard.includes('025')); assert.deepEqual(g.snapshot.space, [0, 0]);
  }
});

test('passive reminders preserve the actual player even when an opponent event benefits the other side', async () => {
  const { g: own } = await one('106');
  assert.equal(own.state.passives?.find(e => e.card === '106')?.by, 0);
  assert.ok(own.snapshot.removed.includes('106'));
  const { g: opponent } = await one('106', 1, () => {}, { card: '106', use: 'ops', mode: 'place' });
  const effect = opponent.state.passives?.find(e => e.card === '106');
  assert.equal(effect?.by, 1);
  assert.equal(opponent.snapshot.flags.norad, true);
  assert.ok(opponent.snapshot.removed.includes('106'));
  const restored = new Match(scenario, 0, JSON.parse(JSON.stringify(opponent.snapshot)));
  assert.deepEqual(restored.hudState().passives, opponent.state.passives);
});

test('operations alone and a space attempt do not activate a passive card', async () => {
  for (const use of ['ops', 'space'] as const) {
    const { g } = await one('106', 0, () => {}, { card: '106', use, mode: use === 'ops' ? 'place' : undefined });
    assert.equal(g.state.passives?.some(e => e.card === '106'), false);
  }
});

test('a cancelling event removes its reminder and adds its own attributed reminder', async () => {
  const { g } = await one('042', 1, g => {
    g.match.s.flags.norad = true;
    trackPassive(g.match.s, '106', 0, 'norad', false);
  });
  assert.equal(g.state.passives?.some(e => e.card === '106'), false);
  assert.equal(g.state.passives?.find(e => e.card === '042')?.by, 1);
});

test('temporary modifiers coexist even when their net total is zero, and expire with the turn', () => {
  const m = fresh().match;
  m.s.temp.ops0 = 1;
  trackPassive(m.s, '025', 0, 'ops0', true);
  m.s.temp.ops0 = 0;
  trackPassive(m.s, '031', 1, 'ops0', true);
  m.s.flags.norad = true;
  trackPassive(m.s, '106', 1, 'norad', false);
  assert.deepEqual(m.hudState().passives?.map(e => e.card), ['025', '031', '106']);
  m.nextTurn();
  assert.deepEqual(m.hudState().passives?.map(e => e.card), ['106']);
  m.s.temp.ops0 = -1;
  trackPassive(m.s, '031', 0, 'ops0', true);
  assert.deepEqual(m.hudState().passives?.map(e => e.card), ['106', '031']);
});

test('conditional reminders disappear when their live rule flag is consumed', () => {
  const m = fresh().match;
  m.s.flags.shuttle = true;
  trackPassive(m.s, '073', 0, 'shuttle', false);
  m.s.flags.trap1 = true;
  trackPassive(m.s, '044', 1, 'trap1', false);
  m.s.temp.missile0 = true;
  trackPassive(m.s, '040', 1, 'missile0', true);
  delete m.s.flags.shuttle;
  delete m.s.flags.trap1;
  delete m.s.temp.missile0;
  assert.deepEqual(m.hudState().passives, []);
});

test('North Sea Oil retains its permanent restriction after its extra-action benefit expires', async () => {
  const { g } = await one('086');
  assert.match(g.state.passives!.find(e => e.card === '086')!.summary.zh, /第八/);
  g.match.nextTurn();
  const effect = g.state.passives!.find(e => e.card === '086')!;
  assert.ok(effect);
  assert.doesNotMatch(effect.summary.zh, /第八/);
});

test('old saves recover attribution from the play log, never from the printed card side', () => {
  const s = fresh().snapshot;
  delete s.passiveSources;
  s.flags.norad = true;
  s.log.push('T1 · 苏联 · 《北美防空司令部》 · 放置影响力');
  const m = new Match(scenario, 0, s);
  assert.equal(m.hudState().passives?.find(e => e.card === '106')?.by, 1);
  s.log = [];
  assert.equal(new Match(scenario, 0, s).hudState().passives?.find(e => e.card === '106')?.by, null);
});
test("influence uses the control margin and an action-start access snapshot", () => {
  const g = fresh(),
    m = g.match;
  for (const id of m.ids) m.s.inf[id] = [0, 0];
  m.s.inf.irn = [1, 3];
  assert.equal(m.control("irn"), 1);
  assert.equal(g.placeTargets(0).get("irn")!.cost, 2);
  const base = structuredClone(m.s.inf);
  m.apply({ t: "inf", id: "irn", side: 0, d: 1 });
  assert.equal(m.control("irn"), null);
  assert.equal(g.placeTargets(0, base).get("irn")!.cost, 1);
  assert.ok(g.placeTargets(0, base).has("pak"));
  m.apply({ t: "inf", id: "pak", side: 0, d: 1 });
  assert.equal(g.placeTargets(0, base).has("ind"), false);
});
test("operation modifiers aggregate, clamp, and apply to space and event operations", async () => {
  const g = fresh();
  g.match.s.temp.ops0 = -2;
  assert.equal(g.match.ops("026", 0), 1);
  assert.equal(g.options("023").points, 2);
  g.match.s.temp.ops0 = 2;
  assert.equal(g.match.ops("023", 0), 4);
  const { g: played } = await one("026", 0, (g) => {
    g.match.s.temp.ops0 = 1;
  });
  assert.ok(
    played.snapshot.discard.includes("026") ||
      played.snapshot.removed.includes("026"),
  );
});
test("DEFCON geography, treaty protection, coup arithmetic and realignment modifiers", () => {
  const g = fresh(),
    s = g.match.s;
  s.inf.ita = [0, 2];
  s.inf.tha = [0, 1];
  s.crisis = 4;
  assert.ok(g.coupTargets(0, 3).locked.has("ita"));
  assert.ok(g.coupTargets(0, 3).ok.has("tha"));
  s.crisis = 3;
  assert.ok(g.coupTargets(0, 3).locked.has("tha"));
  s.crisis = 2;
  assert.ok(g.coupTargets(0, 3).locked.has("irq"));
  s.crisis = 5;
  s.flags.japan = true;
  assert.ok(g.coupTargets(1, 3).locked.has("jpn"));
  s.inf.ago = [0, 2];
  const p = g.coupPreview(0, "ago", 3);
  assert.equal(p.table[5].net, 7);
  assert.equal(p.table[5].remove, 2);
  assert.equal(p.table[5].add, 5);
  s.temp.salt = true;
  assert.equal(g.coupPreview(0, "ago", 3).table[5].net, 6);
  s.temp.iranContra = true;
  assert.ok(
    g.realignMods("cub")[0].some((m) => m.label === "伊朗门" && m.n === -1),
  );
});
test("space gates, second attempt, privileges expire when opponent catches up", () => {
  const g = fresh(),
    s = g.match.s;
  s.attempts[0] = 1;
  assert.equal(g.options("023").space.ok, false);
  s.space = [2, 1];
  assert.equal(g.options("023").space.ok, true);
  s.space[1] = 2;
  assert.equal(g.options("023").space.ok, false);
  s.attempts[0] = 0;
  s.space[0] = 4;
  assert.equal(g.options("023").space.ok, true);
  assert.equal(g.options("026").space.ok, false);
  s.space = [8, 7];
  assert.equal(g.match.rounds(0), 8);
  assert.equal(g.options("023").space.ok, false);
  s.space[1] = 8;
  assert.equal(g.match.rounds(0), 6);
});
test("space discards an opponent event without firing it; China passes face down", async () => {
  const { g } = await one("008", 0, () => {}, { card: "008", use: "space" });
  assert.deepEqual(g.match.inf("cub"), [0, 0]);
  assert.ok(g.snapshot.discard.includes("008"));
  assert.equal(g.snapshot.attempts[0], 1);
  const c = fresh().match;
  c.s.china = { owner: 0, available: true };
  c.take("006", 0);
  c.settle("006", 0, false);
  assert.deepEqual(c.s.china, { owner: 1, available: false });
  c.nextTurn();
  assert.equal(c.s.china.available, true);
  c.validate();
});
test("blocked events stay in discard, and opponent events resolve around operations", async () => {
  const { g } = await one(
    "007",
    0,
    (g) => {
      g.match.s.flags.ironLady = true;
    },
    { card: "007", use: "ops", mode: "place" },
  );
  assert.ok(g.snapshot.discard.includes("007"));
  assert.ok(!g.snapshot.removed.includes("007"));
  const { g: cuba } = await one("008", 0, () => {}, {
    card: "008",
    use: "ops",
    mode: "place",
  });
  assert.equal(cuba.match.control("cub"), 1);
  assert.ok(cuba.snapshot.removed.includes("008"));
});
test("region scoring: Europe control, Taiwan and Shuttle Diplomacy", () => {
  const m = fresh().match;
  for (const id of m.ids) m.s.inf[id] = [0, 0];
  for (const id of ["fra", "frg", "gdr", "pol", "ita", "gbr"])
    m.inf(id)[0] = m.countries.get(id)!.stability;
  assert.equal(m.scoring("europe").winner, 0);
  m.score("europe");
  assert.equal(m.s.result?.reason, "europe");
  const a = fresh().match;
  for (const id of a.ids) a.s.inf[id] = [0, 0];
  a.inf("twn")[0] = 3;
  a.s.flags.formosan = true;
  assert.equal(a.scoring("asia").totals[0], 4);
  a.inf("prk")[1] = 3;
  a.s.flags.shuttle = true;
  give(a, "073", 0);
  a.s.hands[0].splice(a.s.hands[0].indexOf("073"), 1);
  a.s.inPlay.push("073");
  assert.equal(a.scoring("asia").totals[1], 0);
  a.score("asia");
  assert.ok(!a.has("shuttle"));
  assert.ok(a.s.discard.includes("073"));
  a.validate();
});
test("forced opponent events respect the DEFCON safety floor without ending the match", async () => {
  const { g } = await one(
    "050",
    0,
    (g) => {
      g.match.s.crisis = 2;
    },
    { card: "050", use: "ops", mode: "place" },
  );
  assert.equal(g.result, null);
  assert.equal(g.snapshot.crisis, 2);
  assert.ok(g.snapshot.battleLog?.some(e => e.lines.some(l => l.text.includes('安全下限'))));
});
test("remaining scoring resolves before military victory; final scoring and China still produce a result", async () => {
  const g = fresh(),
    s = g.match.s;
  s.phase = "cleanup";
  s.vp = 19;
  s.crisis = 3;
  s.milops = [3, 0];
  give(g.match, "001", 0);
  await g.start(headlessPresenter(g));
  assert.notEqual(g.result?.reason, "held-scoring");
  assert.ok(!g.snapshot.hands[0].includes('001'));
  assert.ok(g.snapshot.battleLog?.some(e => e.card === '001' && e.status === 'resolved'));
  const final = fresh(),
    f = final.match.s;
  f.phase = "cleanup";
  f.turn = 10;
  f.milops = [5, 5];
  f.vp = 0;
  for (const id of final.match.ids) f.inf[id] = [0, 0];
  for (const hand of f.hands) {
    f.discard.push(...hand);
    hand.splice(0);
  }
  f.china.owner = 0;
  await final.start(headlessPresenter(final));
  assert.equal(final.result?.reason, "final");
  assert.equal(final.result?.winner, 0);
  assert.equal(final.snapshot.vp, 1);
  final.match.validate();
});
test("era entry mixes only future-era cards into draw pile; kept cards and removals persist", () => {
  const m = fresh().match;
  m.s.turn = 3;
  const kept = [...m.s.hands[0]];
  m.nextTurn();
  assert.equal(m.s.hands[0].length, 9);
  assert.ok(kept.every((id) => m.s.hands[0].includes(id)));
  assert.ok(m.s.dealtEras.includes("middle"));
  assert.ok(m.s.future.every((id) => CARD.get(id)!.era === "late"));
  m.validate();
  m.s.turn = 7;
  m.nextTurn();
  assert.equal(m.s.future.length, 0);
  m.validate();
});
test("AI observation hides enemy hand, draw order and RNG, is detached and JSON-only", () => {
  const g = fresh(),
    a = g.observation(1),
    s = g.match.s;
  const first = s.hands[0][0];
  s.hands[0][0] = s.deck[0];
  s.deck[0] = first;
  s.deck.reverse();
  s.rng = 987654;
  assert.deepEqual(g.observation(1), a);
  const json = JSON.stringify(a);
  assert.ok(!json.includes('"rng"'));
  assert.ok(!json.includes('"deck"'));
  a.countries[0].influence[0] = 999;
  a.space[0] = 8;
  a.hand.splice(0);
  assert.notEqual(g.observation(1).countries[0].influence[0], 999);
  assert.equal(g.observation(1).space[0], 0);
});
test("corrupt and incompatible saves are rejected", () => {
  const good = fresh().snapshot;
  for (const edit of [
    (s: MatchState) => {
      s.version = 2 as 1;
    },
    (s: MatchState) => {
      s.deck.push(s.deck[0]);
    },
    (s: MatchState) => {
      s.space[0] = NaN;
    },
    (s: MatchState) => {
      s.inf.ita[0] = -1;
    },
    (s: MatchState) => {
      s.phase = "end";
    },
  ]) {
    const bad = structuredClone(good);
    edit(bad);
    assert.throws(() => new Match(scenario, 0, bad));
  }
});
test("all 109 catalog events execute through the public match loop and conserve cards", async (t) => {
  for (const card of CARDS.filter((c) => c.id !== "006"))
    await t.test(`${card.id} ${card.title}`, async () => {
      const side: 0 | 1 = card.kind === "ussr" || card.id === "080" ? 1 : 0;
      const { g } = await one(card.id, side, (g) => {
        const m = g.match,
          s = m.s;
        s.flags.marshall = true;
        s.flags.pope = true;
        s.space = [3, 1];
        s.crisis = card.id === "100" ? 2 : 5;
        s.inf.gbr = [5, 0];
        s.inf.isr = [4, 0];
        s.inf.fra = [3, 0];
        s.inf.jpn = [4, 0];
        s.inf.tha = [2, 0];
        s.inf.ago = [1, 0];
        s.inf.zwe = [1, 0];
        give(m, "019", 1);
        give(m, "008", 0);
        give(m, card.id, side);
        assert.ok(
          eventAllowed(m, card.id, m.owned(card.id) ?? side),
          `fixture prerequisite ${card.id}`,
        );
      });
      assert.ok(
        g.snapshot.log.some((x) => x.includes(card.title)) || g.result,
        `event never completed ${card.id}`,
      );
    });
});
test("30 seeded full games terminate, cover both winners and final scoring, and resume deterministically", async () => {
  const wins = new Set(),
    reasons = new Set();
  let saved: MatchState | undefined, original: MatchState | undefined;
  for (let seed = 1; seed <= 30; seed++) {
    const g = new SoloGame({
      scenario,
      lang: "zh",
      seed,
      onChange() {},
      onCheckpoint(s) {
        g.match.validate();
        if (seed === 1 && s.turn === 3 && s.phase === "action" && !saved)
          saved = s;
      },
    });
    const r = await g.start(headlessPresenter(g));
    assert.ok(r);
    wins.add(r.winner);
    reasons.add(r.reason);
    g.match.validate();
    if (seed === 1) original = g.snapshot;
  }
  assert.ok(wins.has(0) && wins.has(1));
  assert.ok(reasons.has("final"));
  assert.ok(saved);
  const resumed = new SoloGame({
    scenario,
    lang: "zh",
    snapshot: JSON.parse(JSON.stringify(saved)),
    onChange() {},
  });
  await resumed.start(headlessPresenter(resumed));
  assert.deepEqual(resumed.snapshot, original);
});

// Regression from the large simulation sweep: Missile Envy in the headline must not
// prevent the already-committed opposing headline from resolving.
test("seed 406 resolves Missile Envy before the opposing headline and finishes", async () => {
  const g = fresh(406);
  const result = await g.start(headlessPresenter(g));
  assert.ok(result);
  g.match.validate();
});

test('scoring deadlines restrict every card and use, for either seat and extra action rounds', async () => {
  for (const side of [0, 1] as const) for (const extra of [false, true]) {
    const g = fresh(12), m = g.match, s = m.s;
    s.phase = 'action'; s.active = side;
    for (const h of s.hands) s.discard.push(...h.splice(0));
    for (const id of ['001', '002', '025', '049']) give(m, id, side);
    s.china = { owner: side, available: true };
    if (extra) { s.space[side] = 8; s.space[1-side] = 7; }
    s.actions[side] = m.rounds(side) - 3;
    assert.ok(availableUses(g.options('025', side)).length);
    s.actions[side]++;
    s.temp[`envy${side}`] = true; // scoring takes priority over forced Missile Envy
    for (const id of ['025', '049', '006']) {
      assert.match(g.options(id, side).blocked!, /2 次行动.*2 张计分牌/);
      assert.deepEqual(availableUses(g.options(id, side)), []);
    }
    assert.deepEqual(availableUses(g.options('001', side)), ['event']);
    assert.deepEqual(new Set(g.observation(side).legalActions.map(a => a.card)), new Set(['001', '002']));
    const before = g.snapshot;
    await assert.rejects(g.play({ card: '025', use: 'ops', mode: 'place' }, side), /须先/);
    assert.deepEqual(g.snapshot, before, 'invalid play changes nothing');
    s.hands[side].splice(s.hands[side].indexOf('001'), 1); s.discard.push('001'); s.actions[side]++;
    assert.deepEqual(new Set(g.observation(side).legalActions.map(a => a.card)), new Set(['002']));
    s.hands[side].splice(s.hands[side].indexOf('002'), 1); s.discard.push('002');
    assert.deepEqual(new Set(g.observation(side).legalActions.map(a => a.card)), new Set(['049']));
    s.phase = 'headline';
    assert.equal(g.options('006', side).headline!.ok, false);
    assert.equal(g.options('032', side).headline!.ok, false);
    assert.equal(g.options('025', side).headline!.ok, true);
  }
});

test('nuclear coups are blocked in queries, AI actions and execution, including free event coups', async () => {
  for (const side of [0, 1] as const) {
    const g = fresh(), m = g.match, s = m.s;
    s.phase = 'action'; s.active = side; s.crisis = 2;
    for (const id of m.ids) s.inf[id] = [0,0];
    s.inf.ago[1-side] = 2; s.inf.zwe[1-side] = 2;
    give(m, '025', side);
    assert.equal(m.countries.get('ago')!.key, true);
    assert.equal(m.countries.get('zwe')!.key, false);
    const targets = g.coupTargets(side, 3);
    assert.match(targets.locked.get('ago')!, /核战/);
    assert.ok(targets.ok.has('zwe'));
    assert.ok(!g.observation(side).legalActions.some(a => a.mode === 'coup' && a.target === 'ago'));
    const before = g.snapshot;
    assert.equal(await g.coup(side, 'ago', 3, true, true), 0);
    assert.deepEqual(g.snapshot, before);
    s.inf.zwe = [0,0];
    assert.equal(g.options('025', side).coup.ok, false);
    await assert.rejects(g.play({ card: '025', use: 'ops', mode: 'coup' }, side), /核战/);
    if (side === 0) {
      s.flags.subs = true;
      assert.ok(g.coupTargets(side, 3).ok.has('ago'), 'Nuclear Subs permits a genuinely safe battleground coup');
    }
  }
});

test('Cuban Missile Crisis blocks unaffordable coups and pays release cost before a safe coup', async () => {
  for (const side of [0, 1] as const) {
    const g = fresh(), m = g.match, s = m.s;
    s.crisis = 2; s.temp[`missile${side}`] = true;
    s.inf.zwe[1-side] = 2;
    for (const id of ['cub', 'frg', 'tur']) s.inf[id][side] = 0;
    assert.match(g.coupTargets(side, 3).locked.get('zwe')!, /无法支付/);
    assert.equal(await g.coup(side, 'zwe', 3), 0);
    assert.equal(g.result, null);
    const release = side === 0 ? 'frg' : 'cub';
    const { g: paid } = await one('025', side, g => {
      g.match.s.crisis = 2; g.match.s.temp[`missile${side}`] = true;
      for (const id of ['cub', 'frg', 'tur']) g.match.s.inf[id][side] = 0;
      g.match.s.inf[release][side] = 2;
      g.match.s.inf.zwe[1-side] = 2;
    }, {card:'025',use:'ops',mode:'coup',target:'zwe'});
    assert.equal(paid.match.inf(release)[side], 0);
    assert.equal(paid.snapshot.temp[`missile${side}`], undefined);
    assert.equal(paid.result, null);
  }
});

test('DEFCON floor protects every effect and explicit DEFCON choices omit nuclear outcomes', async () => {
  const m = fresh().match;
  m.s.crisis = 3;
  const e = m.apply({t:'crisis',d:-10,why:'test'});
  assert.equal(m.s.crisis, 2); assert.equal(m.s.result, null);
  assert.ok(e.t === 'crisis' && e.d === -1 && e.to === 2);
  const { g } = await one('046', 0, () => {}, undefined, p => ({...p, async choose(q) {
    if(q.title.includes('DEFCON')) {
      assert.deepEqual(q.options.map(o => o.id), ['2','3','4','5']);
      return '2';
    }
    return p.choose(q);
  }}));
  assert.equal(g.crisis, 2); assert.equal(g.result, null);
});

test('trapped player must score at the deadline instead of wasting the remaining action on escape', async () => {
  const { g } = await one('001', 0, g => {
    for (const h of g.match.s.hands) g.match.s.discard.push(...h.splice(0));
    give(g.match, '001', 0); give(g.match, '025', 0);
    g.match.s.actions[0] = g.match.rounds(0) - 1;
    g.match.s.flags.trap0 = true;
  }, undefined, p => ({...p, async roll() { assert.fail('must score, not roll for escape'); }}));
  assert.ok(!g.snapshot.hands[0].includes('001'));
  assert.ok(g.snapshot.hands[0].includes('025'));
  assert.equal(g.snapshot.flags.trap0, true);
});

test('event-granted coups use the same safe target gate before asking for a country', async () => {
  for (const id of ['091','107']) {
    let asked = false, rolled = false;
    const {g}=await one(id,1,g=>{
      g.match.s.crisis=2;g.match.s.temp.missile1=true;
      g.match.s.inf.cub=[0,0];g.match.s.inf.zwe=[1,0];g.match.s.inf.hnd=[1,0];
    },undefined,p=>({...p,async pickTarget(req){
      if(req.title?.includes('政变'))asked=true;
      return p.pickTarget(req);
    },async roll(){rolled=true;}}));
    assert.equal(asked,false);assert.equal(rolled,false);
    assert.equal(g.result,null);
  }
});

test('the eighth action cannot be skipped with scoring still held and no redundant confirmation appears',async()=>{
  let prompted=false;
  const {g}=await one('001',0,g=>{
    for(const h of g.match.s.hands)g.match.s.discard.push(...h.splice(0));
    give(g.match,'001',0);give(g.match,'025',0);
    g.match.s.space=[8,7];g.match.s.actions[0]=7;
  },undefined,p=>({...p,async choose(q){
    if(q.title.includes('第八'))prompted=true;
    return p.choose(q);
  }}));
  assert.equal(prompted,false);
  assert.ok(!g.snapshot.hands[0].includes('001'));
  assert.equal(g.snapshot.actions[0],8);
});
