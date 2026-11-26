import assert from 'node:assert/strict';
import { test } from 'node:test';
import raw from '../../data/scenarios/coldwar/scenario.json';
import type { Scenario } from '../map/types';
import { CARDS, CARD, Match } from './solo/model';
import { SoloGame } from './solo/engine';
import { viewOf } from '../net/replay';
import { encode, decode } from '../net/protocol';
const scenario = raw as unknown as Scenario;
const fresh = () => new Match(scenario, 18);
const sorted = (ids: string[]) => [...ids].sort();

test('opponent candidates include draw pile and other hand, excluding own, future and China cards', () => {
  const m = fresh();
  for (const side of [0, 1] as const) {
    const unseen = m.hudState(side).opponentCandidates!;
    assert.deepEqual(unseen, sorted([...m.s.deck, ...m.s.hands[1 - side]]));
    assert.ok(unseen.every(id => !m.s.hands[side].includes(id) && !m.s.future.includes(id) && id !== '006'));
    assert.equal(m.hudState(side).deck, m.s.deck.length, 'real draw count remains available to dealing logic');
    assert.deepEqual(m.hudState(side).hand, m.hand(side));
  }
});

test('changing hidden locations or deck order cannot reveal which candidate is held by the opponent', () => {
  const m = fresh(), before = m.opponentCandidates(0);
  [m.s.deck[0], m.s.hands[1][0]] = [m.s.hands[1][0], m.s.deck[0]];
  m.s.deck.reverse();
  assert.deepEqual(m.opponentCandidates(0), before);
  m.draw(1, 2);
  assert.deepEqual(m.opponentCandidates(0), before, 'opponent draws leave the candidate set unchanged');
  const drawn = m.s.deck[0]; m.draw(0);
  assert.deepEqual(m.opponentCandidates(0), before.filter(id => id !== drawn));
});

test('public piles, resolving cards and revealed headlines leave the candidate list', () => {
  const m = fresh();
  for (const pile of ['discard', 'removed', 'inPlay'] as const) m.s[pile].push(m.s.deck.shift()!);
  const played = m.s.hands[1][0];m.take(played, 1);
  m.s.headlines = [m.s.hands[0].pop()!, m.s.hands[1].pop()!];
  for (const side of [0, 1] as const) {
    const unseen = m.opponentCandidates(side);
    for (const id of [...m.s.discard, ...m.s.removed, ...m.s.inPlay, played, ...m.s.headlines]) assert.ok(!unseen.includes(id!));
    assert.deepEqual(unseen, sorted([...m.s.deck, ...m.s.hands[1 - side]]));
  }
  m.validate();
});

test('previously seen cards return after reshuffling and remain candidates after save/reload', () => {
  const m = fresh(), own = m.s.hands[0][0], publicCard = m.s.hands[1][0];
  m.take(publicCard, 1);m.settle(publicCard, 1, false);
  m.take(own, 0);m.settle(own, 0, false);
  m.s.removed.push(...m.s.deck.splice(0));
  const before = m.opponentCandidates(0);
  m.draw(1, 2);
  assert.deepEqual(m.opponentCandidates(0), sorted([...before, own, publicCard]));
  assert.equal(m.hudState(0).deck, 0, 'opponent holds both recycled cards; draw pile is empty');
  assert.equal(m.hudState(0).deckRecycles, 1);
  const restored = new Match(scenario, 0, JSON.parse(JSON.stringify(m.snapshot())));
  for (const side of [0, 1] as const) assert.deepEqual(restored.opponentCandidates(side), m.opponentCandidates(side));
  m.validate();
});

test('revealing an opponent card does not exclude it from the possible hand', () => {
  const m = fresh(), id = m.s.hands[1][0], before = m.opponentCandidates(0);
  m.rememberCards(0, [id]);m.s.knownHands = [[], [id]];
  assert.deepEqual(m.opponentCandidates(0), before);
  m.s.knownHands = [[], []];
  const restored = new Match(scenario, 0, m.snapshot());
  assert.ok(restored.opponentCandidates(0).includes(id));
  assert.ok(!restored.opponentCandidates(1).includes(id), 'owner still excludes their own card');
});

test('old save history does not incorrectly exclude cards that are no longer in public piles', () => {
  const m = fresh(), publicCard = m.s.deck[0], revealed = m.s.deck[1], privateCard = m.s.deck[2];
  const snapshot = m.snapshot();delete snapshot.seenCards;
  snapshot.battleLog!.push({id:999,turn:1,round:1,phase:'action',by:1,kind:'card',card:publicCard,title:'test',status:'resolved',lines:[{kind:'note',text:`《${CARD.get(revealed)!.title}》进入弃牌堆`}]});
  snapshot.knownHands = [[], [privateCard]];
  const restored = new Match(scenario, 0, snapshot);
  for (const side of [0, 1] as const) {
    assert.ok(restored.opponentCandidates(side).includes(publicCard));
    assert.ok(restored.opponentCandidates(side).includes(revealed));
  }
  assert.ok(restored.opponentCandidates(0).includes(privateCard));
  assert.ok(restored.opponentCandidates(1).includes(privateCard));
  assert.ok(restored.opponentCandidates(0).includes(m.s.hands[1][0]), 'an unrevealed opponent card is still a candidate');
});

test('a publicly returned card re-enters candidates until it enters the viewer’s own hand', () => {
  const m = fresh(), id = m.s.hands[1][0];
  m.take(id, 1);m.settle(id, 1, false);
  assert.ok(!m.opponentCandidates(0).includes(id));
  m.s.discard.splice(m.s.discard.indexOf(id), 1);
  m.s.hands[1].push(id);
  assert.ok(m.opponentCandidates(0).includes(id));
  m.s.hands[1].splice(m.s.hands[1].indexOf(id), 1);
  m.s.hands[0].push(id);
  assert.ok(!m.opponentCandidates(0).includes(id));
  m.validate();
});

test('new-era cards enter only when that era is added, and candidates survive reload', () => {
  const m = fresh();m.s.turn = 3;
  assert.ok(m.opponentCandidates(0).every(id => CARDS.find(c => c.id === id)!.era === 'early'));
  m.nextTurn();
  assert.ok(m.opponentCandidates(0).some(id => CARDS.find(c => c.id === id)!.era === 'middle'));
  assert.ok(m.opponentCandidates(0).every(id => CARDS.find(c => c.id === id)!.era !== 'late'));
  const restored = new Match(scenario, 0, JSON.parse(JSON.stringify(m.snapshot())));
  assert.deepEqual(restored.opponentCandidates(0), m.opponentCandidates(0));
  assert.deepEqual(restored.opponentCandidates(1), m.opponentCandidates(1));
});

test('an empty candidate list does not fall back to future or removed cards', () => {
  const m = fresh();m.s.discard.push(...m.s.deck.splice(0), ...m.s.hands[1].splice(0));
  assert.deepEqual(m.opponentCandidates(0), []);
  m.validate();
});

test('network projections carry each seat’s own candidates, also in intermediate frames', () => {
  const g = new SoloGame({scenario, lang:'zh', seed:18, onChange(){}});
  for (const side of [0, 1] as const) for (const history of [true, false]) {
    const v = decode<ReturnType<typeof viewOf>>(encode(viewOf(g, side, history)));
    assert.deepEqual(v.hud.opponentCandidates, sorted([...g.match.s.deck, ...g.match.s.hands[1 - side]]));
    assert.deepEqual(v.hud.hand, g.match.hand(side));
    assert.equal(typeof v.hud.deck, 'number');
    assert.equal(v.hud.deck, g.match.s.deck.length);
    assert.equal('unseenCards' in v.hud, false, 'the old never-seen list is not sent');
    assert.equal('hands' in v, false);
    assert.equal('rng' in v, false);
    assert.equal('future' in v.hud, false);
    assert.equal('seenCards' in v.hud, false);
  }
  assert.notDeepEqual(viewOf(g, 0).hud.opponentCandidates, viewOf(g, 1).hud.opponentCandidates);
});
