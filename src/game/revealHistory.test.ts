import assert from 'node:assert/strict';
import { test } from 'node:test';
import rawScenario from '../../data/scenarios/coldwar/scenario.json';
import type { Scenario } from '../map/types';
import { CARD, Match } from './solo/model';
import { battleText } from './history';
const scenario = rawScenario as unknown as Scenario;

test('revealed cards are a historical snapshot, not a live hand or the latest reveal', () => {
  const m = new Match(scenario, 17);
  m.battleContext = m.beginBattle({ kind: 'card', card: '062', title: CARD.get('062')!.title, by: 1 });
  const hand = ['025', '003'];
  m.recordReveal(1, hand, '美国手牌');
  const published = JSON.stringify(m.hudState(1).battleLog);
  hand.splice(0, hand.length, '008');
  m.recordReveal(1, hand, '美国手牌');
  const lines = m.hudState(1).battleLog!.at(-1)!.lines;
  assert.deepEqual(lines.filter(l => l.kind === 'reveal').map(l => l.reveal.cards), [['025', '003'], ['008']]);
  assert.ok(published.includes('025') && !published.includes('008'));
  const restored = new Match(scenario, 0, JSON.parse(JSON.stringify(m.snapshot())));
  assert.deepEqual(restored.hudState(1).battleLog, m.hudState(1).battleLog);
});

test('history and export contain only the requesting seat’s reveal snapshots', () => {
  const m = new Match(scenario, 17);
  m.recordReveal(1, ['025'], '美国手牌');
  m.recordReveal(0, ['008'], '苏联手牌');
  const us = battleText(m.hudState(0).battleLog!), su = battleText(m.hudState(1).battleLog!);
  assert.ok(us.includes(CARD.get('008')!.title));
  assert.ok(!us.includes(CARD.get('025')!.title));
  assert.ok(su.includes(CARD.get('025')!.title));
  assert.ok(!su.includes(CARD.get('008')!.title));
  assert.equal(m.s.log.some(l => l.includes('当时看到')), false, 'private cards never enter the public summary log');
});

test('an empty reveal is explicit and older saves cannot invent historical hands', () => {
  const m = new Match(scenario, 17);
  m.recordReveal(1, [], '美国计分牌');
  assert.match(battleText(m.hudState(1).battleLog!), /0 张（没有符合条件的牌）/);
  assert.doesNotMatch(battleText(m.hudState(0).battleLog!), /美国计分牌/);
  const old = m.snapshot();
  old.battleLog = old.battleLog!.map(e => ({ ...e, lines: e.lines.filter(l => l.kind !== 'reveal') }));
  delete old.seenCards;
  const restored = new Match(scenario, 0, old);
  assert.equal(restored.s.battleLog!.flatMap(e => e.lines).some(l => l.kind === 'reveal'), false);
});

test('recovering sightings from saved reveals respects their original viewer', () => {
  const m = new Match(scenario, 17), id = '098'; // Undealt late-war card, absent from both hands.
  m.recordReveal(1, [id], '美国手牌');
  const saved = m.snapshot(); delete saved.seenCards;
  const restored = new Match(scenario, 0, saved);
  assert.ok(restored.s.seenCards![1].includes(id));
  assert.ok(!restored.s.seenCards![0].includes(id));
});
