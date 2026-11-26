import assert from 'node:assert/strict';
import { test } from 'node:test';
import rawScenario from '../../data/scenarios/coldwar/scenario.json';
import type { Scenario } from '../map/types';
import { CARD, Match } from './solo/model';
import { SoloGame, type SoloPresenter } from './solo/engine';
import { headlessPresenter } from './solo/headless';
import { createHeuristicAgent } from './ai/heuristic';
import type { Decision } from '../play/types';
import { battleText } from './history';
const scenario = rawScenario as unknown as Scenario;
function give(m: Match, id: string, side: 0 | 1) {
  for (const pile of [...m.s.hands, m.s.deck, m.s.discard, m.s.removed, m.s.future, m.s.inPlay]) {
    const at = pile.indexOf(id); if (at >= 0) pile.splice(at, 1);
  }
  m.s.hands[side].push(id);
}
async function once(d: Decision, side: 0 | 1 = 0, edit: (g: SoloGame) => void = () => {}, decorate: (p: SoloPresenter) => SoloPresenter = p => p) {
  const g = new SoloGame({ scenario, lang: 'zh', seed: 17, agent: { ...createHeuristicAgent(), chooseAction: () => d }, onChange() {}, onCheckpoint() { g.stop(); } });
  Object.assign(g.match.s, { phase: 'action', active: side, round: 1 });
  give(g.match, d.card, side); edit(g);
  await g.start(decorate({ ...headlessPresenter(g), async decide() { return d; } }));
  g.match.validate(); return g;
}
test('card journal records the actual actor, influence and control changes, and survives a save', async () => {
  const g = await once({ card: '008', use: 'event' }, 1, g => { g.match.s.inf.cub = [3, 0]; });
  const e = g.state.battleLog!.find(e => e.card === '008')!;
  assert.equal(e.by, 1); assert.equal(e.status, 'resolved');
  assert.ok(e.lines.some(l => l.country === 'cub' && /3 → 0/.test(l.text)));
  assert.ok(e.lines.some(l => /无人控制 → 苏联/.test(l.text)));
  assert.ok(e.lines.some(l => /移出游戏/.test(l.text)));
  const restored = new Match(scenario, 0, JSON.parse(JSON.stringify(g.snapshot)));
  assert.deepEqual(restored.hudState().battleLog, g.state.battleLog);
});
test('confirmed placements record final allocations and costs, excluding undo previews', async () => {
  const g = await once({ card: '025', use: 'ops', mode: 'place' }, 0, g => { g.match.s.inf.frg = [3, 0]; }, p => ({ ...p, async place(s) {
    assert.ok(s.add('fra')); assert.ok(s.undo());
    while (s.left) assert.ok(s.add('frg'));
    return true;
  } }));
  const e = g.state.battleLog!.find(e => e.card === '025')!;
  assert.equal(e.lines.some(l => l.country === 'fra'), false);
  const changes = e.lines.filter(l => l.country === 'frg');
  assert.equal(changes.length, 1); assert.match(changes[0].text, /3 → 6/); assert.match(changes[0].text, /消耗 3 行动点/);
});
test('a cancelled card does not leave a fictitious play or allocation in the journal', async () => {
  let attempts = 0;
  const g = await once({ card: '025', use: 'ops', mode: 'place' }, 0, g => { g.match.s.inf.frg = [3, 0]; }, p => ({ ...p, async place(s) {
    if (++attempts === 1) { assert.ok(s.add('fra')); return false; }
    while (s.left) s.add('frg'); return true;
  } }));
  const plays = g.state.battleLog!.filter(e => e.card === '025');
  assert.equal(plays.length, 1); assert.equal(plays[0].lines.some(l => l.country === 'fra'), false);
});
test('coup logs contain dice arithmetic, target, influence, military operations and DEFCON', async () => {
  const g = await once({ card: '025', use: 'ops', mode: 'coup', target: 'irn' }, 0, g => { g.match.s.inf.irn = [1, 2]; g.match.die = () => 6; });
  const e = g.state.battleLog!.find(e => e.card === '025')!;
  assert.equal(e.verb, 'coup');
  assert.ok(e.lines.some(l => l.kind === 'roll' && /骰点 6.*行动点.*9.*门槛/.test(l.text)));
  assert.ok(e.lines.some(l => l.country === 'irn' && /1 → 4/.test(l.text)));
  assert.ok(e.lines.some(l => /军事行动 0 → 3/.test(l.text)));
  assert.ok(e.lines.some(l => /核危机等级 5 → 4/.test(l.text)));
});
test('failed space attempts and passive activation are recorded even without a board change', async () => {
  const failed = await once({ card: '025', use: 'space' }, 0, g => { g.match.die = () => 6; });
  assert.ok(failed.state.battleLog!.some(e => e.lines.some(l => l.kind === 'roll' && /发射失败/.test(l.text))));
  const norad = await once({ card: '106', use: 'event' });
  assert.ok(norad.state.battleLog!.some(e => e.lines.some(l => l.kind === 'passive' && /北美防空/.test(l.text))));
});
test('public draw records never contain hidden cards or RNG, and old saves retain only their known summaries', () => {
  const m = new Match(scenario, 42), text = battleText(m.hudState().battleLog!);
  assert.match(text, /摸 8 张牌/);
  for (const id of m.s.hands.flat()) assert.equal(text.includes(CARD.get(id)!.title), false);
  assert.equal(text.includes(String(m.s.rng)), false);
  const s = m.snapshot(); delete s.battleLog; s.log = ['T2 · 美国 · 《遏制》 · 事件'];
  const restored = new Match(scenario, 0, s).hudState().battleLog!;
  assert.equal(restored[0].kind, 'legacy'); assert.equal(restored[0].turn, 2);
  assert.match(battleText(restored), /遏制/); assert.doesNotMatch(battleText(restored), /骰点/);
});
test('published history snapshots are not mutated by a later effect', () => {
  const m = new Match(scenario, 4), before = m.hudState().battleLog!, json = JSON.stringify(before);
  m.apply({ t: 'inf', id: 'irn', side: 0, d: 1 });
  assert.equal(JSON.stringify(before), json); assert.notDeepEqual(before, m.hudState().battleLog);
});
test('regional scoring records standings and held countries at the time of scoring', () => {
  const m = new Match(scenario, 4);
  for (const id of m.ids) m.s.inf[id] = [0, 0];
  m.s.inf.irn = [2, 0]; m.s.inf.syr = [0, 2];
  m.score('mideast');
  const text = battleText(m.hudState().battleLog!);
  assert.match(text, /美国：存在 · 控制国家：伊朗 · 4 VP/);
  assert.match(text, /苏联：存在 · 控制国家：叙利亚 · 3 VP/);
});
