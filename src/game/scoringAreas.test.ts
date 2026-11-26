import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { areaBounds, areaMembers, countryAreas, scoringAreas } from '../map/scoringAreas.ts';
import type { MapPack, MapState, Scenario } from '../map/types.ts';
import { countryScoringFromCards, countryScores, regionStandings, scoringFromCards } from './regions.ts';

const scenario = JSON.parse(readFileSync(new URL('../../data/scenarios/coldwar/scenario.json', import.meta.url), 'utf8')) as Scenario;
const pack = JSON.parse(readFileSync(new URL('../../public/maps/coldwar/map.json', import.meta.url), 'utf8')) as MapPack;
const SEA = ['mmr', 'lao', 'tha', 'vnm', 'mys', 'idn', 'phl'].sort();

test('Southeast Asia is a selectable subset, not a seventh canonical region', () => {
  const before = JSON.stringify(scenario);
  for (const source of [scenario, pack.scenario]) {
    const members = areaMembers(source, 'southeast-asia');
    assert.deepEqual(members.map(c => c.id).sort(), SEA);
    const asia = areaMembers(source, 'asia');
    assert.equal(new Set(asia.map(c => c.id)).size, asia.length);
    for (const c of members) {
      assert.equal(c.region, 'asia');
      assert.ok(asia.includes(c));
      assert.deepEqual(countryAreas(source, c).map(a => a.id), ['asia', 'southeast-asia']);
    }
    assert.deepEqual(countryAreas(source, source.countries.find(c => c.id === 'jpn')!).map(a => a.id), ['asia']);
    assert.equal(source.regions.length, 6);
    assert.equal(scoringAreas(source).length, 7);
    assert.equal(Object.keys(scoringFromCards(source.regions)).length, 6);
  }
  assert.equal(JSON.stringify(scenario), before);
});

test('a scenario without tagged Asian countries has no Southeast Asia selector', () => {
  assert.equal(scoringAreas({ ...scenario, countries: [] }).length, 6);
  assert.deepEqual(areaMembers(scenario, 'unknown'), []);
  assert.equal(scoringAreas({ ...scenario, regions: scenario.regions.filter(r => r.id !== 'asia') }).length, 5);
});

test('Southeast Asia uses card 38: Thailand 2, six other countries 1, removed after play', () => {
  const rules = countryScoringFromCards();
  assert.deepEqual(Object.keys(rules), ['southeast-asia']);
  const rule = rules['southeast-asia'];
  assert.equal(rule.cardId, 38);
  assert.equal(rule.once, true);
  assert.deepEqual(Object.keys(rule.points).sort(), SEA);
  assert.equal(rule.points.tha, 2);
  for (const id of SEA.filter(id => id !== 'tha')) assert.equal(rule.points[id], 1);
  // This card never uses the three tiers, even when asked alongside the six primary regions.
  assert.equal(scoringFromCards(scoringAreas(scenario))['southeast-asia'], undefined);
});

test('preview scores only controlled countries; Asia continues to count those same countries', () => {
  const rules = countryScoringFromCards();
  const state: MapState = { countries: {}, regions: {} };
  assert.deepEqual(countryScores(rules, state)['southeast-asia'], [0, 0]);
  state.countries.tha = { influence: [3, 1], controller: 0 };
  state.countries.vnm = { influence: [0, 2], controller: 1 };
  state.countries.mys = { influence: [2, 0], controller: 0 };
  state.countries.mmr = { influence: [1, 1], controller: null };
  state.countries.jpn = { influence: [4, 0], controller: 0 };
  const before = JSON.stringify(state);
  assert.deepEqual(countryScores(rules, state)['southeast-asia'], [3, 1]);
  assert.deepEqual(regionStandings(scenario, state).asia, ['domination', 'presence']);
  assert.equal(JSON.stringify(state), before, 'a preview never changes the supplied situation');
  for (const id of SEA) state.countries[id] = { influence: [5, 0], controller: 0 };
  assert.deepEqual(countryScores(rules, state)['southeast-asia'], [8, 0]);
  for (const id of SEA) state.countries[id].controller = 1;
  assert.deepEqual(countryScores(rules, state)['southeast-asia'], [0, 8]);
});

test('subregion framing includes all seven countries and their nodes', () => {
  const b = areaBounds(pack, 'southeast-asia')!;
  assert.ok(b.every(Number.isFinite));
  for (const c of pack.countries.filter(c => SEA.includes(c.id))) {
    assert.ok(b[0] <= c.bbox[0] && b[1] <= c.bbox[1] && b[2] >= c.bbox[2] && b[3] >= c.bbox[3], c.id);
    assert.ok(b[0] <= c.node[0] && b[1] <= c.node[1] && b[2] >= c.node[0] && b[3] >= c.node[1], `${c.id} node`);
  }
  assert.deepEqual(areaBounds(pack, 'asia'), pack.regions.find(r => r.id === 'asia')!.bbox);
  assert.equal(areaBounds(pack, 'unknown'), undefined);
});
