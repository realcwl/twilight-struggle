import assert from 'node:assert/strict';
import { test } from 'node:test';
import raw from '../../data/scenarios/coldwar/scenario.json';
import type { Scenario } from '../map/types';
import { Match } from './solo/model';
import { cardMotionPlan } from '../hud/cardMotionPlan';
const fresh = () => new Match(raw as unknown as Scenario, 18);

test('dealing animates each visible card and anonymous opponent backs, without replaying unchanged states', () => {
  const m = fresh(), before = m.hudState();
  m.draw(0, 2); m.draw(1, 3);
  const after = m.hudState(), plan = cardMotionPlan(before, after);
  assert.equal(plan.recycle, false);
  assert.equal(plan.routes.filter(r => r.to === 'hand').length, 2);
  assert.equal(plan.routes.filter(r => r.to === 'opponent').length, 3);
  assert.ok(plan.routes.filter(r => r.to === 'opponent').every(r => r.id === undefined));
  assert.deepEqual(cardMotionPlan(after, after), { recycle: false, routes: [] });
});
test('exhausting the deck reports a public recycle even when the same draw consumes the refill', () => {
  const m = fresh();
  m.s.discard.push(...m.s.deck.splice(1));
  const before = m.hudState();
  m.draw(0, 4);
  const after = m.hudState(), plan = cardMotionPlan(before, after);
  assert.equal(plan.recycle, true);
  assert.equal(plan.routes.length, 4);
  assert.ok(plan.routes.every(r => r.from === 'deck'));
  assert.equal(m.s.discard.length, 0);
  m.validate();
  assert.equal(new Match(raw as unknown as Scenario, undefined, m.snapshot()).hudState().deckRecycles, 1);
});
test('a discard retrieval and a cancelled play are not mistaken for deck shuffles or draws', () => {
  const m = fresh(), id = m.s.hands[0].pop()!;
  m.s.discard.push(id);
  const before = m.hudState();
  m.s.discard.pop(); m.s.hands[0].push(id);
  assert.deepEqual(cardMotionPlan(before, m.hudState()), { recycle: false, routes: [{ id, from: 'discard', to: 'hand' }] });
  m.take(id, 0);
  const played = m.hudState();
  m.s.hands[0].push(id); m.s.played = null;
  assert.deepEqual(cardMotionPlan(played, m.hudState()).routes, [{ id, from: 'table', to: 'hand' }]);
});
test('discard and removal are distinct destinations and passive-only updates do not move cards', () => {
  for (const to of ['discard', 'removed'] as const) {
    const m = fresh(), before = m.hudState(), id = m.s.hands[0].pop()!;
    m.s[to].push(id);
    assert.deepEqual(cardMotionPlan(before, m.hudState()).routes, [{ id, from: 'hand', to }]);
  }
  const s = fresh().hudState();
  assert.deepEqual(cardMotionPlan(s, { ...s, vp: 5, crisis: 2 }), { recycle: false, routes: [] });
});

test('engine supplies special card destinations before the presenter animates settlement', async () => {
  const { SoloGame } = await import('./solo/engine');
  const { headlessPresenter } = await import('./solo/headless');
  for (const id of ['006', '073', '025']) {
    const settlements: import('../play/types').Play[] = [];
    const g = new SoloGame({ scenario: raw as unknown as Scenario, lang: 'zh', seed: 12, onChange() {}, onCheckpoint() { g.stop(); } });
    const m = g.match;
    m.s.phase = 'action'; m.s.active = 0;
    if (id === '006') m.s.china = { owner: 0, available: true };
    else {
      for (const list of [...m.s.hands, m.s.deck, m.s.discard, m.s.future, m.s.removed, m.s.inPlay]) {
        const i = list.indexOf(id); if (i >= 0) list.splice(i, 1);
      }
      m.s.hands[0].push(id);
    }
    await g.start({ ...headlessPresenter(g), async decide() { return id === '006' ? { card: id, use: 'ops', mode: 'place' } : { card: id, use: 'event' }; }, async settle(play) { settlements.push(structuredClone(play)); } });
    m.validate();
    const settled = settlements.find(p => p.card.id === id && !p.cancelled)!;
    assert.ok(settled, id);
    if (id === '006') assert.deepEqual(settled.destination, { hand: 1 });
    else if (id === '073') assert.equal(settled.destination, 'inPlay');
    else { assert.equal(settled.destination, undefined); assert.equal(settled.pile, 'removed'); }
  }
});
