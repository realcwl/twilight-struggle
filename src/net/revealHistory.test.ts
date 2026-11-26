import assert from 'node:assert/strict';
import { test } from 'node:test';
import rawScenario from '../../data/scenarios/coldwar/scenario.json';
import type { Scenario } from '../map/types';
import { CARD } from '../game/solo/model';
import { battleText } from '../game/history';
import { evaluate, newJournal, resign, type Evaluation } from './replay';
import { encode, decode } from './protocol';
import { testAnswer } from './bot-test';
const scenario = rawScenario as unknown as Scenario;
const reveals = (e: Evaluation, viewer: 0 | 1) => e.views[viewer].hud.battleLog!.flatMap(e => e.lines).filter(l => l.kind === 'reveal');
function fixture(by: 0 | 1, card: string, viewer: 0 | 1, hand: string[]) {
  const j = newJournal(scenario, 17), s = j.checkpoint;
  Object.assign(s, { phase: 'action', active: by, round: 1 });
  s.deck.push(...s.hands.flat()); s.hands = [[], []];
  const give = (side: 0 | 1, id: string) => {
    for (const pile of [...s.hands, s.deck, s.future]) { const at = pile.indexOf(id); if (at >= 0) pile.splice(at, 1); }
    s.hands[side].push(id);
  };
  for (const id of hand) give(viewer === 0 ? 1 : 0, id);
  give(by, card);
  return j;
}
for (const { card, by, viewer, hand, expected } of [
  { card: '026', by: 0, viewer: 0, hand: ['008', '025'], expected: ['008', '025'] },
  { card: '062', by: 1, viewer: 1, hand: ['025', '003'], expected: ['025', '003'] },
  // An opponent event: the card player is not the player entitled to the reveal.
  { card: '062', by: 0, viewer: 1, hand: ['025', '003'], expected: ['025', '003'] },
  { card: '098', by: 1, viewer: 1, hand: ['025', '003'], expected: ['025', '003'] },
  { card: '104', by: 1, viewer: 1, hand: ['025', '003', '001'], expected: ['003', '001'] },
  { card: '104', by: 1, viewer: 1, hand: ['025'], expected: [] },
] as const) {
  test(`${card} played by ${by}: snapshot, seat visibility, acknowledgment, reconnect and resignation`, async () => {
    let e = await evaluate(scenario, fixture(by, card, viewer, [...hand]));
    e.journal.answers[e.prompts[0].id] = { card, use: 'event' };
    e = await evaluate(scenario, e.journal);
    const p = e.prompts[0];
    assert.equal(p.method, 'reveal'); assert.equal(p.side, viewer);
    assert.deepEqual(p.args[0], expected);
    const other = viewer === 0 ? 1 : 0;
    assert.deepEqual(reveals(e, viewer).map(l => l.reveal.cards), [expected]);
    assert.deepEqual(reveals(e, other), []);
    assert.equal(e.views[viewer].hud.battleLog!.find(x => x.card === card)!.lines.some(l => l.kind === 'reveal'), true);
    const roundtrip = decode<Evaluation['views']>(encode(e.views));
    assert.deepEqual(roundtrip, e.views);
    assert.ok(e.frames.every(f => f.views.every(v => v.hud.battleLog === undefined)));
    const again = await evaluate(scenario, e.journal);
    assert.deepEqual(again.prompts, e.prompts); assert.deepEqual(again.views, e.views);
    e.journal.answers[p.id] = true;
    e = await evaluate(scenario, e.journal);
    for (let i = 0; i < 10 && e.prompts[0]?.method !== 'decide'; i++) {
      const next = e.prompts[0]; assert.ok(next, 'event continues to next action');
      e.journal.answers[next.id] = await testAnswer(next, e.views[next.side], scenario, e.observations[next.side]);
      e = await evaluate(scenario, e.journal);
    }
    assert.equal(e.prompts[0]?.method, 'decide');
    assert.deepEqual(reveals(e, viewer).map(l => l.reveal.cards), [expected], 'acknowledgment never duplicates or alters the snapshot');
    if (card === '098') assert.equal(e.state.hands[0].length, hand.length - 1, 'snapshot predates forced discard');
    const resumed = await evaluate(scenario, JSON.parse(JSON.stringify(e.journal)));
    assert.deepEqual(reveals(resumed, viewer), reveals(e, viewer));
    const ended = resign(scenario, resumed, by);
    assert.deepEqual(reveals(ended, viewer), reveals(e, viewer)); assert.deepEqual(reveals(ended, other), []);
    for (const id of expected) assert.ok(battleText(ended.views[viewer].hud.battleLog!).includes(CARD.get(id)!.title));
    assert.doesNotMatch(battleText(ended.views[other].hud.battleLog!), /当时看到的/);
    assert.ok(ended.views.every(v => v.log.every(l => !l.includes('当时看到的'))));
  });
}
