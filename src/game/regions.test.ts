import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { MapState, ScenarioSource } from '../map/types.ts';
import { regionStandings, scoringFromCards, standingOf } from './regions.ts';

const scenario = JSON.parse(readFileSync(new URL('../../data/scenarios/coldwar/scenario.json', import.meta.url), 'utf8')) as ScenarioSource;

test('every region of the scenario finds its values on a scoring card', () => {
  const scoring = scoringFromCards(scenario.regions);
  assert.deepEqual(Object.keys(scoring).sort(), scenario.regions.map((r) => r.id).sort());
  for (const [id, s] of Object.entries(scoring)) {
    assert.ok(s.presence > 0 && s.domination > s.presence, `${id}: presence below domination`);
    assert.ok(s.control === 'win' || s.control > s.domination, `${id}: control above domination`);
  }
});

test('the values are read from the card, whatever they are', () => {
  const regions = [{ id: 'north', name: { zh: '北方', en: 'The North', es: 'El Norte' } }, { id: 'south', name: { zh: '南方', en: 'The South', es: 'El Sur' } }, { id: 'east', name: { zh: '东方', en: 'The East', es: 'El Este' } }];
  const cards = [
    { side: 'scoring', title: 'The North Scoring', effects: ['Both sides score: Presence 2 · Domination 4 · Control 11.', 'Something else.'] },
    { side: 'scoring', title: 'The South Scoring', effects: ['Both sides score: Presence 1 · Domination 2 · Control wins the game.'] },
    // not a scoring card, and a scoring card worded another way: neither gives values
    { side: 'us', title: 'The East Scoring', effects: ['Presence 9 · Domination 9 · Control 9.'] },
    { side: 'scoring', title: 'The East Scoring', effects: ['1 VP for each country.'] },
  ];
  assert.deepEqual(scoringFromCards(regions, cards), {
    north: { presence: 2, domination: 4, control: 11 },
    south: { presence: 1, domination: 2, control: 'win' },
  });
});

test('standing follows the glossary', () => {
  const h = (held: number, keys: number) => ({ held, keys });
  assert.equal(standingOf(h(0, 0), h(3, 2), 4), 'none');
  assert.equal(standingOf(h(1, 0), h(0, 0), 4), 'presence');
  // more countries, but no more key countries
  assert.equal(standingOf(h(5, 1), h(2, 1), 4), 'presence');
  // more key countries, but not more countries
  assert.equal(standingOf(h(2, 2), h(2, 0), 4), 'presence');
  // ahead on both counts, but holds nothing besides key countries
  assert.equal(standingOf(h(2, 2), h(1, 0), 4), 'presence');
  assert.equal(standingOf(h(3, 2), h(1, 1), 4), 'domination');
  // every key country, and more countries than the other side
  assert.equal(standingOf(h(4, 4), h(3, 0), 4), 'control');
  assert.equal(standingOf(h(5, 4), h(1, 0), 4), 'control');
  // every key country, but not more countries
  assert.equal(standingOf(h(4, 4), h(4, 0), 4), 'presence');
  // a region with no key countries cannot be controlled or dominated
  assert.equal(standingOf(h(3, 0), h(0, 0), 0), 'presence');
});

test('standings for a situation on the real map', () => {
  const state: MapState = { countries: {}, regions: {} };
  const africa = scenario.countries.filter((c) => c.region === 'africa');
  const keys = africa.filter((c) => c.key);
  const plain = africa.filter((c) => !c.key);
  const give = (id: string, side: 0 | 1): void => void (state.countries[id] = { influence: [0, 0], controller: side });
  assert.deepEqual(regionStandings(scenario, state).africa, ['none', 'none']);
  give(plain[0].id, 1);
  assert.deepEqual(regionStandings(scenario, state).africa, ['none', 'presence']);
  give(keys[0].id, 0);
  give(plain[1].id, 0);
  assert.deepEqual(regionStandings(scenario, state).africa, ['domination', 'presence']);
  for (const k of keys) give(k.id, 0);
  assert.deepEqual(regionStandings(scenario, state).africa, ['control', 'presence']);
  // a country held elsewhere changes nothing here
  assert.deepEqual(regionStandings(scenario, state).europe, ['none', 'none']);
});
