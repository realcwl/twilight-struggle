import assert from 'node:assert/strict';
import { test } from 'node:test';
import rawScenario from '../../data/scenarios/coldwar/scenario.json';
import type { Scenario } from '../map/types';
import { Match } from '../game/solo/model';
import { evaluate, newJournal, type Evaluation } from './replay';
import { testAnswer } from './bot-test';

const scenario = rawScenario as unknown as Scenario;
function fixture(side: 0 | 1, card = '034') {
  const j = newJournal(scenario, 12), s = j.checkpoint;
  Object.assign(s, { phase: 'action', active: side, round: 1, crisis: 5 });
  for (const pile of [...s.hands, s.deck, s.discard, s.removed, s.future, s.inPlay]) {
    const at = pile.indexOf(card); if (at >= 0) pile.splice(at, 1);
  }
  s.hands[side].push(card);
  s.inf.irn = [2, 2]; s.inf.zwe = [2, 2];
  return j;
}
async function answer(e: Evaluation, value: unknown) {
  const j = structuredClone(e.journal);
  j.answers[e.prompts[0].id] = value;
  return evaluate(scenario, j);
}
function privatePreview(before: Evaluation, after: Evaluation, side: 0 | 1) {
  assert.deepEqual(after.views[1 - side], before.views[1 - side], 'preview must not expose the card through any public field');
  assert.deepEqual(after.state.hands, before.state.hands);
  assert.equal(after.state.rng, before.state.rng);
  assert.equal(after.frames.length, 0, 'no review, dice, or effect animation before commitment');
}

for (const side of [0, 1] as const) {
  test(`seat ${side}: coup preview and cancellation remain private; confirming a country publishes once`, async () => {
    const start = await evaluate(scenario, fixture(side));
    let e = await answer(start, { card: '034', use: 'ops', mode: 'coup' });
    assert.equal(e.prompts[0].method, 'pickTarget');
    assert.equal(e.prompts[0].args[0].cancel, true);
    privatePreview(start, e, side);
    const restored = await evaluate(scenario, JSON.parse(JSON.stringify(e.journal)));
    privatePreview(start, restored, side);
    assert.deepEqual(restored.prompts, e.prompts);
    e = await answer(e, null);
    assert.equal(e.prompts[0].method, 'decide');
    privatePreview(start, e, side);
    // The player can switch modes and return again, keeping the same card private.
    e = await answer(e, { card: '034', use: 'ops', mode: 'realign' });
    privatePreview(start, e, side);
    e = await answer(e, null);
    e = await answer(e, { card: '034', use: 'ops', mode: 'coup' });
    e = await answer(e, 'irn');
    const announcements = e.frames.filter(f => f.method === 'announce');
    assert.equal(announcements.length, 1);
    assert.equal(announcements[0].args[0].target, 'irn');
    assert.equal(announcements[0].args[0].verb, 'coup');
    assert.ok(e.frames.findIndex(f => f.method === 'announce') < e.frames.findIndex(f => f.method === 'roll'));
    assert.equal(e.state.hands[side].includes('034'), false);
    assert.equal(e.state.battleLog?.filter(x => x.card === '034').length, 1);
    const resumed = await evaluate(scenario, e.journal);
    assert.deepEqual(resumed.state, e.state);
    assert.equal(resumed.frames.length, 0);
    new Match(scenario, undefined, e.journal.checkpoint).validate();
  });

  test(`seat ${side}: influence placement is private until a complete legal allocation is confirmed`, async () => {
    const start = await evaluate(scenario, fixture(side));
    let e = await answer(start, { card: '034', use: 'ops', mode: 'place' });
    assert.equal(e.prompts[0].method, 'place');
    privatePreview(start, e, side);
    await assert.rejects(answer(e, { accept: true, ids: ['usa'] }), /不合法/);
    await assert.rejects(answer(e, { accept: true, ids: [] }), /用完/);
    e = await answer(e, { accept: false, ids: [] });
    privatePreview(start, e, side);
    e = await answer(e, { card: '034', use: 'ops', mode: 'place' });
    const allocation = await testAnswer(e.prompts[0], e.views[side], scenario, e.observations[side]);
    e = await answer(e, allocation);
    const announce = e.frames.find(f => f.method === 'announce')!;
    assert.ok(announce);
    assert.deepEqual(announce.views[1 - side].map, start.views[1 - side].map, 'review starts with the original board, before replaying placements');
    assert.equal(announce.views[1 - side].hud.opponentHand, start.views[1 - side].hud.opponentHand - 1);
    assert.ok(e.frames.findIndex(f => f.method === 'announce') < e.frames.findIndex(f => f.method === 'step'));
    assert.notDeepEqual(e.views[side].map, start.views[side].map);
    assert.equal(e.state.battleLog?.filter(x => x.card === '034').length, 1);
    new Match(scenario, undefined, e.journal.checkpoint).validate();
  });
}

test('realignment commits on the first country; stopping subsequent rolls does not return the card', async () => {
  let e = await evaluate(scenario, fixture(0));
  e = await answer(e, { card: '034', use: 'ops', mode: 'realign' });
  e = await answer(e, 'irn');
  assert.equal(e.frames.filter(f => f.method === 'announce').length, 1);
  assert.equal(e.frames.filter(f => f.method === 'roll').length, 1);
  assert.equal(e.prompts[0].method, 'pickTarget');
  assert.equal(e.prompts[0].args[0].cancel, false);
  assert.equal(e.prompts[0].args[0].optional, true);
  const rng = e.state.rng, inf = structuredClone(e.state.inf);
  e = await answer(e, null);
  assert.equal(e.state.rng, rng); assert.deepEqual(e.state.inf, inf);
  assert.equal(e.state.hands[0].includes('034'), false);
  assert.ok(e.state.discard.includes('034'));
  assert.equal(e.frames.filter(f => f.method === 'announce').length, 0);
});

test('opponent-event ordering stays private until choosing to resolve that event first', async () => {
  const start = await evaluate(scenario, fixture(1, '025'));
  let e = await answer(start, { card: '025', use: 'ops', mode: 'coup' });
  assert.equal(e.prompts[0].method, 'choose');
  privatePreview(start, e, 1);
  const after = await answer(e, 'after');
  privatePreview(start, after, 1);
  const cancelled = await answer(after, null);
  privatePreview(start, cancelled, 1);
  e = await answer(e, 'before');
  assert.equal(e.frames.filter(f => f.method === 'announce').length, 1);
  assert.equal(e.state.temp.ops0, 1);
  assert.equal(e.state.hands[1].includes('025'), false);
  assert.equal(e.prompts[0].method, 'pickTarget');
  e = await answer(e, null);
  assert.equal(e.prompts[0].method, 'choose', 'a committed opponent event allows changing the remaining operations, not taking back the card');
  assert.equal(e.state.temp.ops0, 1);
  e = await answer(e, 'realign');
  e = await answer(e, 'irn');
  assert.equal(e.frames.filter(f => f.method === 'announce').length, 0);
  assert.equal(e.frames.filter(f => f.method === 'roll').length, 1);
  e = await answer(e, null);
  assert.equal(e.frames.find(f => f.method === 'settle')!.args[0].verb, 'realign');
  assert.match(e.state.log.at(-1)!, /调整阵营/);
});

test('explicit event and space choices still publish immediately before their irreversible effects', async () => {
  for (const use of ['event', 'space'] as const) {
    let e = await evaluate(scenario, fixture(0, '025'));
    e = await answer(e, { card: '025', use });
    assert.equal(e.frames.filter(f => f.method === 'announce').length, 1);
    assert.equal(e.state.hands[0].includes('025'), false);
    if (use === 'space') {
      assert.ok(e.frames.findIndex(f => f.method === 'announce') < e.frames.findIndex(f => f.method === 'roll'));
      assert.equal(e.state.attempts[0], 1);
    } else assert.equal(e.state.temp.ops0, 1);
  }
});

test('Flower Power cannot award VP for an unconfirmed war-card preview, and a winning award prevents the action', async () => {
  for (const mode of ['coup', 'place'] as const) {
    const j = fixture(0, '024'); j.checkpoint.flags.flower = true; j.checkpoint.vp = -19;
    const start = await evaluate(scenario, j);
    let e = await answer(start, { card: '024', use: 'ops', mode });
    privatePreview(start, e, 0);
    const cancel = mode === 'coup' ? null : { accept: false, ids: [] };
    privatePreview(start, await answer(e, cancel), 0);
    const value = mode === 'coup' ? 'irn' : await testAnswer(e.prompts[0], e.views[0], scenario, e.observations[0]);
    e = await answer(e, value);
    assert.equal(e.state.result?.winner, 1);
    assert.equal(e.state.vp, -21);
    assert.deepEqual(e.state.inf, start.state.inf, 'a game-ending commitment must not apply the pending operation');
    assert.equal(e.frames.filter(f => f.method === 'roll').length, 0);
    assert.equal(e.frames.filter(f => f.method === 'announce').length, 1);
  }
});

test('We Will Bury You stays pending through cancelled previews and charges only the committed action', async () => {
  const j = fixture(0); j.checkpoint.flags.bury = true;
  const start = await evaluate(scenario, j);
  let e = await answer(start, { card: '034', use: 'ops', mode: 'coup' });
  privatePreview(start, e, 0); assert.equal(e.state.flags.bury, true);
  e = await answer(e, null);
  privatePreview(start, e, 0); assert.equal(e.state.flags.bury, true);
  e = await answer(e, { card: '034', use: 'ops', mode: 'coup' });
  e = await answer(e, 'irn');
  assert.equal(e.state.vp, -3);
  assert.equal(e.state.flags.bury, undefined);
  assert.equal(e.frames.filter(f => f.method === 'step' && f.args[0].t === 'vp').length, 1);
  const restored = await evaluate(scenario, e.journal);
  assert.deepEqual(restored.state, e.state);
  assert.equal(restored.frames.length, 0);
  const terminal = fixture(0);
  terminal.checkpoint.flags.bury = true; terminal.checkpoint.vp = -18;
  const ended = await answer(await evaluate(scenario, terminal), { card: '034', use: 'space' });
  assert.equal(ended.state.result?.winner, 1);
  assert.equal(ended.state.attempts[0], 0);
  assert.equal(ended.frames.some(f => f.method === 'roll'), false);
});
