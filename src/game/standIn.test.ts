import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Card } from '../cards/deck.ts';
import type { HudRules, HudState } from '../hud/types.ts';
import type { MapState, Scenario } from '../map/types.ts';
import type { Decision, Effect, PlaceSession, Presenter } from '../play/types.ts';
import { StandInGame } from './standIn.ts';

// A board small enough to reason about: two regions, five countries, two homes.
const L = (s: string): { zh: string; en: string; es: string } => ({ zh: s, en: s, es: s });
const country = (id: string, region: string, stability: number, key: boolean): Scenario['countries'][number] => ({ id, name: L(id), region, shapes: [], stability, key });
const scenario: Scenario = {
  id: 'tiny',
  name: L('tiny'),
  sides: [
    { id: 'a', name: L('A'), short: L('A'), color: '#00f' },
    { id: 'b', name: L('B'), short: L('B'), color: '#f00' },
  ],
  regions: [{ id: 'europe', name: L('Europe') }, { id: 'africa', name: L('Africa') }],
  countries: [
    { id: 'homeA', name: L('homeA'), region: null, superpower: 0, shapes: [], stability: 0, key: false },
    { id: 'homeB', name: L('homeB'), region: null, superpower: 1, shapes: [], stability: 0, key: false },
    country('e1', 'europe', 3, true),
    country('e2', 'europe', 2, false),
    country('f1', 'africa', 1, true),
    country('f2', 'africa', 2, false),
    country('f3', 'africa', 2, false),
  ],
  links: [
    { a: 'homeA', b: 'e1', kind: 'superpower' },
    { a: 'e1', b: 'e2', kind: 'regional' },
    { a: 'e2', b: 'homeB', kind: 'superpower' },
    { a: 'e2', b: 'f1', kind: 'inter-regional' },
    { a: 'f1', b: 'f2', kind: 'regional' },
    { a: 'f2', b: 'f3', kind: 'regional' },
  ],
};
const influence: Record<string, [number, number]> = { e1: [3, 0], e2: [1, 2], f1: [0, 2], f2: [1, 1], f3: [0, 0] };
const situation: MapState = { countries: Object.fromEntries(Object.entries(influence).map(([id, v]) => [id, { influence: v, controller: null }])), regions: {} };

const step = { name: L('step'), glyph: 'rocket' as const, minOps: 2, rollMax: 3, vp: [2, 1] as const };
const rules: HudRules = { turns: 10, eras: [], rounds: 2, vpMax: 20, crisis: [L('1'), L('2'), L('3'), L('4'), L('5')], milopsMax: 5, space: [step, step, step, step, step, step] };

const card = (id: string, kind: Card['kind'], value: number, once = false): Card => ({ id, kind, era: 'early', value, title: `card ${id}`, once, optional: false, persistent: false, special: false });
const cards: Card[] = [
  // the opening hand the stand-in deals, by id
  card('021', 'us', 4), card('025', 'us', 3), card('035', 'us', 2), card('041', 'us', 2, true), card('034', 'neutral', 4), card('020', 'neutral', 2), card('010', 'ussr', 1), card('016', 'ussr', 3),
  // the rest: the opponent's hand and the draw pile
  ...Array.from({ length: 30 }, (_, i) => card(String(50 + i).padStart(3, '0'), i % 3 === 0 ? 'us' : 'ussr', 2 + (i % 3))),
];

function makeGame(dice: number[] = []): { game: StandInGame; seen: { hud: HudState; map: MapState } } {
  const seen = {} as { hud: HudState; map: MapState };
  const game = new StandInGame({ scenario, rules, cards, lang: 'en', situation, dice, onChange: (hud, map) => Object.assign(seen, { hud, map }) });
  return { game, seen };
}

test('a card of the player offers the event and operations; a region can be barred by the crisis level', () => {
  const { game } = makeGame();
  const o = game.options('025');
  assert.equal(o.fires, false);
  assert.equal(o.event.ok, true);
  assert.deepEqual([...o.place.targets.keys()].sort(), ['e1', 'e2', 'f1', 'f2', 'f3']);
  assert.equal(o.place.targets.get('f1')!.cost, 2, 'the opponent controls f1, so a point there costs two');
  assert.equal(o.place.targets.get('e2')!.cost, 1);
  assert.deepEqual([...o.coup.targets.keys()].sort(), ['f1', 'f2']);
  assert.match(o.coup.locked.get('e2')!, /Crisis level 4/);
  assert.deepEqual([...o.realign.targets.keys()].sort(), ['f1', 'f2']);
});

test('a coup is worked out before it is rolled', () => {
  const { game } = makeGame();
  const p = game.options('025').coup.targets.get('f1')!;
  assert.deepEqual({ bar: p.bar, need: p.need, chance: p.chance, key: p.key, crisisTo: p.crisisTo, milopsTo: p.milopsTo }, { bar: 2, need: 1, chance: 1, key: true, crisisTo: 3, milopsTo: 3 });
  assert.deepEqual(p.table[0], { roll: 1, ok: true, net: 2, remove: 2, add: 0 });
  assert.deepEqual(p.table[3], { roll: 4, ok: true, net: 5, remove: 2, add: 3 });
  // a one-point card against a stability of two cannot do better than a six
  assert.equal(game.options('010').coup.targets.get('f2')!.need, 4);
});

test("the opponent's card cannot be played as an event, and fires when used for operations", () => {
  const { game } = makeGame();
  const o = game.options('016');
  assert.equal(o.fires, true);
  assert.equal(o.event.ok, false);
  assert.equal(o.place.ok, true);
});

test('the space race takes a card worth enough, once a turn', () => {
  const { game } = makeGame();
  assert.equal(game.options('025').space.ok, true);
  assert.equal(game.options('010').space.ok, false);
  assert.match(game.options('010').space.why, /at least 2/);
});

test('a turn is walked through a presenter: headline, then both sides in each action round', async () => {
  // dice in the order they are thrown: the player's coup, then the opponent's
  const { game, seen } = makeGame([4, 2]);
  const calls: string[] = [];
  const effects: Effect[] = [];
  const decisions: Decision[] = [{ card: '025', use: 'ops', mode: 'coup', target: 'f1' }, { card: '035', use: 'ops', mode: 'place' }];
  let headlines = 0;
  let finish!: () => void;
  const done = new Promise<void>((r) => (finish = r));
  const P: Presenter = {
    async phase(info) {
      calls.push(info.kind === 'round' ? `round ${info.round} side ${info.who}` : info.kind);
    },
    async pickHeadline() {
      if (headlines++) {
        // the second turn's headline: far enough
        finish();
        return new Promise<string>(() => {});
      }
      return '021';
    },
    async showHeadline(h) {
      calls.push(`headline ${h.order.map((o) => o.by).join('')}`);
    },
    async decide() {
      return decisions.shift()!;
    },
    async announce(play) {
      calls.push(`${play.by === 0 ? 'A' : 'B'} ${play.verb}${play.headline ? ' headline' : ''}`);
    },
    async place(session: PlaceSession) {
      assert.equal(session.points, 2);
      assert.ok(session.add('f3'));
      assert.ok(session.add('f3'));
      assert.equal(session.left, 0);
      assert.equal(session.add('f2'), null, 'no points left');
      return true;
    },
    async pickTarget() {
      throw new Error('the decision named its target');
    },
    async roll(spec) {
      calls.push(`roll ${spec.kind} ${spec.dice.map((d) => d.value).join('/')} ${spec.ok ? 'ok' : 'no'}`);
    },
    async step(effect, commit) {
      effects.push(effect);
      commit();
    },
    async trigger() {},
    async settle() {},
    skip() {},
    dispose() {},
  };
  game.start(P, 'headline');
  await done;
  game.stop();

  // the higher card resolves first; the player's 4 beats whatever the opponent holds
  assert.equal(calls[0], 'headline');
  assert.equal(calls[1], 'headline 01');
  assert.deepEqual(calls.slice(2, 4), ['A event headline', 'B event headline']);
  // round 1: the opponent places, the player coups the battleground f1
  const r1 = calls.indexOf('round 1 side 1');
  assert.deepEqual(calls.slice(r1, r1 + 5), ['round 1 side 1', 'B place', 'round 1 side 0', 'A coup', 'roll coup 4 ok']);
  // the opponent's points went where it already stood, one country at a time
  const firstLoss = effects.findIndex((e) => e.t === 'inf' && e.d < 0);
  const placed = effects.slice(0, firstLoss).filter((e) => e.t === 'inf' && e.side === 1 && e.d > 0);
  assert.ok(placed.length >= 1 && placed.every((e) => e.t === 'inf' && e.d <= 2));
  // the coup: a 4 plus 3 points against twice a stability of 1 nets 5. All the opponent's influence
  // in f1 goes, what is left over becomes the player's, and a battleground costs a crisis level.
  const there = placed.filter((e) => e.t === 'inf' && e.id === 'f1').reduce((a, e) => a + (e.t === 'inf' ? e.d : 0), 2);
  const removed = effects.find((e) => e.t === 'inf' && e.id === 'f1' && e.side === 1 && e.d < 0);
  assert.deepEqual(removed?.t === 'inf' && { d: removed.d, to: removed.to, ctrlFrom: removed.ctrlFrom, ctrlTo: removed.ctrlTo }, { d: -Math.min(5, there), to: there - Math.min(5, there), ctrlFrom: 1, ctrlTo: there > 5 ? 1 : null });
  if (there < 5) assert.ok(effects.some((e) => e.t === 'inf' && e.id === 'f1' && e.side === 0 && e.d === 5 - there && e.ctrlTo === 0));
  const crisis = effects.find((e) => e.t === 'crisis');
  assert.deepEqual(crisis && { from: crisis.from, to: crisis.to }, { from: 4, to: 3 });
  assert.ok(effects.some((e) => e.t === 'milops' && e.side === 0 && e.to === 3));
  // round 2: the opponent coups, the player places two points
  assert.ok(calls.includes('round 2 side 1') && calls.includes('B coup') && calls.includes('A place'));
  // every event said that it was not carried out
  assert.equal(effects.filter((e) => e.t === 'note' && /no rules engine/.test(e.text)).length, 2);
  // the turn turned over: back to a full hand, the crisis eased by one, military operations cleared
  assert.equal(calls.at(-2), 'turn');
  assert.equal(seen.hud.turn, 5);
  assert.equal(seen.hud.hand.length, 8);
  const lastCrisis = effects.filter((e) => e.t === 'crisis').at(-1);
  assert.equal(seen.hud.crisis, Math.min(5, (lastCrisis?.t === 'crisis' ? lastCrisis.to : 4) + 1));
  assert.deepEqual(seen.hud.milops, [0, 0]);
  assert.equal(seen.hud.played, null);
  assert.deepEqual(seen.map.countries.f3.influence.slice(0, 1), [2]);
  for (const id of ['021', '025', '035']) assert.ok(seen.hud.discard.includes(id) || seen.hud.hand.includes(id), `${id} went to the discard pile`);
});
