import assert from 'node:assert/strict';
import test from 'node:test';
import { SPACE_RACE } from './spaceRace';
import { activeSpaceAbilities } from '../hud/spaceState';

const ids = (a: number, b: number) => activeSpaceAbilities(SPACE_RACE, [a, b]).map(({ owner, ability }) => [owner, ability.id]);
test('the standard board has eight destination thresholds and five immediate VP awards', () => {
  assert.deepEqual(SPACE_RACE.map((s) => [s.minOps, s.rollMax, ...s.vp]), [
    [2, 3, 2, 1], [2, 4, 0, 0], [2, 3, 2, 0], [2, 4, 0, 0],
    [3, 3, 3, 1], [3, 4, 0, 0], [3, 3, 4, 2], [4, 2, 2, 0],
  ]);
});
test('the current 4 / 3 position grants only headline selection, not double launch', () => {
  assert.deepEqual(ids(4, 3), [[0, 'headline']]);
});
test('privileges stack immediately for either side and end on the second arrival', () => {
  const all = ['two-attempts', 'headline', 'discard-held', 'eight-rounds'];
  assert.deepEqual(ids(8, 0), all.map((id) => [0, id]));
  assert.deepEqual(ids(0, 8), all.map((id) => [1, id]));
  assert.deepEqual(ids(8, 6), [[0, 'eight-rounds']]);
  assert.deepEqual(ids(4, 4), []);
  assert.deepEqual(ids(8, 8), []);
  assert.deepEqual(ids(0, 0), []);
});
test('a matched milestone never reactivates just because one side moves ahead', () => {
  assert.deepEqual(ids(2, 1), [[0, 'two-attempts']]);
  assert.deepEqual(ids(2, 2), []);
  assert.deepEqual(ids(3, 2), []);
  assert.deepEqual(ids(4, 2), [[0, 'headline']]);
});
test('every reachable pair shows each ability iff exactly one marker reached its milestone', () => {
  for (let a = 0; a <= 8; a++) for (let b = 0; b <= 8; b++) {
    const active = activeSpaceAbilities(SPACE_RACE, [a, b]);
    for (let i = 0; i < SPACE_RACE.length; i++) {
      if (!SPACE_RACE[i].ability) continue;
      const actual = active.find((entry) => entry.step === i + 1);
      const heldA = a >= i + 1, heldB = b >= i + 1;
      assert.equal(!!actual, heldA !== heldB, `${a}/${b}, milestone ${i + 1}`);
      if (actual) assert.equal(actual.owner, heldA ? 0 : 1);
    }
  }
});
