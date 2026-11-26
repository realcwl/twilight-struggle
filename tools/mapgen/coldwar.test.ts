import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Scenario, ScenarioSource, MapPack } from '../../src/map/types.ts';
import { routeLinkAroundNodes, splitLinkAtMapEdge } from '../../src/map/linkPaths.ts';
import { validateScenario } from './validate.ts';

const read = (relative: string): unknown => JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8'));
const reference = read('../../data/reference/twilight-struggle-connectivity.json') as {
  nodes: { id: string; name: string; kind: string; region: string | null; neighbors: string[]; stability?: number; battleground?: boolean }[];
  connections: { a: string; b: string; kind: string }[];
};
const source = read('../../data/scenarios/coldwar/scenario.json') as ScenarioSource;
const pack = read('../../public/maps/coldwar/map.json') as MapPack;
const regionIds: Record<string, string> = {
  Europe: 'europe', 'Middle East': 'mideast', Asia: 'asia', Africa: 'africa',
  'Central America': 'camerica', 'South America': 'samerica',
};
const edgeKey = (a: string, b: string): string => [a, b].sort().join('|');

/** Compare every node and every edge with the separately transcribed board, not geographic borders. */
function audit(scenario: Scenario): void {
  validateScenario(scenario);
  assert.equal(scenario.countries.length, 86);
  assert.equal(scenario.links.length, 121);
  assert.equal(scenario.countries.filter((c) => c.superpower === undefined).length, 84);
  assert.equal(scenario.countries.filter((c) => c.key).length, 29);
  assert.deepEqual(scenario.regions.map((r) => r.id).sort(), Object.values(regionIds).sort());
  const byId = new Map(scenario.countries.map((c) => [c.id, c]));
  const byReference = new Map(scenario.countries.map((c) => [c.referenceId, c]));
  assert.deepEqual([...byReference.keys()].sort(), reference.nodes.map((n) => n.id).sort());
  for (const n of reference.nodes) {
    const c = byReference.get(n.id)!;
    assert.equal(c.region, n.region === null ? null : regionIds[n.region], `${n.name}: scoring region`);
    if (n.kind === 'superpower') {
      assert.equal(c.superpower, n.id === 'usa' ? 0 : 1);
      assert.equal(c.stability, 0);
      assert.equal(c.key, false);
    } else {
      assert.equal(c.superpower, undefined, n.name);
      assert.equal(c.stability, n.stability, `${n.name}: stability`);
      assert.equal(c.key, n.battleground, `${n.name}: battleground`);
    }
    const neighbors = scenario.links.filter((l) => l.a === c.id || l.b === c.id)
      .map((l) => byId.get(l.a === c.id ? l.b : l.a)!.referenceId).sort();
    assert.deepEqual(neighbors, [...n.neighbors].sort(), `${n.name}: complete adjacency`);
  }
  const actual = scenario.links.map((l) => `${edgeKey(byId.get(l.a)!.referenceId!, byId.get(l.b)!.referenceId!)}:${l.kind}`).sort();
  const expected = reference.connections.map((l) => `${edgeKey(l.a, l.b)}:${l.kind}`).sort();
  assert.deepEqual(actual, expected, 'every connection and printed-line category');
  assert.deepEqual(scenario.links.filter((l) => l.wrap).map((l) => edgeKey(l.a, l.b)), ['jpn|usa']);
  for (const id of ['austria', 'finland']) {
    assert.deepEqual(byReference.get(id)!.subregions, ['western-europe', 'eastern-europe']);
  }
  const southeastAsia = scenario.countries.filter((c) => c.subregions?.includes('southeast-asia')).map((c) => c.referenceId).sort();
  assert.deepEqual(southeastAsia, ['burma', 'indonesia', 'laos_cambodia', 'malaysia', 'philippines', 'thailand', 'vietnam']);
  assert.ok(!byReference.get('ussr')!.shapes.some((s) => /CHN|HKG|MAC|MNG/.test(s)), 'China and Mongolia must not be Soviet territory');
}

test('authored scenario matches all audited countries, attributes, regions and connections', () => {
  assert.equal(source.landLinks, 'manual', 'geographic adjacency must not replace board adjacency');
  audit(source);
});

test('generated runtime pack preserves the audited graph and complete country roster', () => {
  audit(pack.scenario);
  // Mapgen calculates/snaps geographic anchors; all authored game attributes must survive intact.
  const withoutAnchor = (c: Scenario['countries'][number]) => {
    const { anchor: _anchor, ...authored } = c;
    return authored;
  };
  assert.deepEqual(pack.scenario.countries.map(withoutAnchor), source.countries.map(withoutAnchor));
  assert.deepEqual(pack.scenario.links, source.links);
  assert.deepEqual(pack.countries.map((c) => c.id), source.countries.map((c) => c.id));
  assert.equal(new Set(pack.countries.map((c) => c.index)).size, 86);
  assert.ok(pack.countries.every((c) => c.area > 0 && c.node.every(Number.isFinite)));
});

test('USA–Japan wraps once at both map edges and works in either direction', () => {
  const from: [number, number] = [-60, -10];
  const to: [number, number] = [80, 20];
  const forward = splitLinkAtMapEdge(from, to, 200, true);
  assert.deepEqual(forward, [[from, [-100, 10]], [[100, 10], to]]);
  const reverse = splitLinkAtMapEdge(to, from, 200, true);
  assert.deepEqual(reverse, [[to, [100, 10]], [[-100, 10], from]]);
  assert.deepEqual(splitLinkAtMapEdge(from, to, 200), [[from, to]]);
});

test('invalid authored edges fail before map generation', () => {
  const duplicate = structuredClone(source);
  duplicate.links.push({ ...duplicate.links[0], a: duplicate.links[0].b, b: duplicate.links[0].a });
  assert.throws(() => validateScenario(duplicate), /duplicate link/);
  const loop = structuredClone(source);
  loop.links[0].b = loop.links[0].a;
  assert.throws(() => validateScenario(loop), /self-loop/);
  const unknown = structuredClone(source);
  unknown.links[0].b = 'not-on-the-board';
  assert.throws(() => validateScenario(unknown), /unknown country/);
  const category = structuredClone(source);
  category.links[0].kind = 'inter-regional';
  assert.throws(() => validateScenario(category), /incorrect regional classification/);
});

test('all 121 drawn connections avoid unrelated country markers, including East Germany–Austria', () => {
  let detours = 0;
  for (const edge of pack.scenario.links) {
    const a = pack.countries.find((c) => c.id === edge.a)!;
    const b = pack.countries.find((c) => c.id === edge.b)!;
    const obstacles = pack.countries.filter((c) => c.id !== edge.a && c.id !== edge.b).map((c) => ({ id: c.id, point: c.node }));
    for (const [start, end] of splitLinkAtMapEdge(a.node, b.node, pack.world.width, edge.wrap)) {
      const path = routeLinkAroundNodes(start, end, obstacles);
      assert.deepEqual(path[0], start);
      assert.deepEqual(path.at(-1), end);
      if (path.length > 2) detours++;
      if (edgeKey(edge.a, edge.b) === 'aut|gdr') assert.ok(path.length > 2, 'must go around the Czechoslovakia marker');
      // Sample independently of the router's slab-intersection calculation.
      for (let i = 1; i < path.length; i++) {
        const from = path[i - 1]; const to = path[i];
        const steps = Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 0.05);
        for (let j = 0; j <= steps; j++) {
          const x = from[0] + (to[0] - from[0]) * j / steps;
          const z = from[1] + (to[1] - from[1]) * j / steps;
          const hit = obstacles.find((o) => Math.abs(x - o.point[0]) < 1.44 && Math.abs(z - o.point[1]) < 0.89);
          assert.equal(hit, undefined, `${edge.a}–${edge.b} crosses unrelated ${hit?.id}`);
        }
      }
    }
  }
  assert.ok(detours > 0);
});
