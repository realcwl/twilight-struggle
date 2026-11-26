import type { LinkKind, ScenarioSource } from '../../src/map/types.ts';

/** Reject broken authored graphs before producing any map assets. */
export function validateScenario(scenario: ScenarioSource): void {
  const ids = new Set<string>();
  const regions = new Set(scenario.regions.map((r) => r.id));
  if (regions.size !== scenario.regions.length) throw new Error('duplicate region id');
  for (const c of scenario.countries) {
    if (ids.has(c.id)) throw new Error(`duplicate country id ${c.id}`);
    ids.add(c.id);
    if (c.superpower !== undefined) {
      if (![0, 1].includes(c.superpower) || c.region !== null || c.stability !== 0 || c.key) {
        throw new Error(`${c.id}: invalid superpower metadata`);
      }
    } else if (c.region === null || !regions.has(c.region) || !Number.isInteger(c.stability) || c.stability < 1) {
      throw new Error(`${c.id}: invalid country region or stability`);
    }
  }
  const kinds: LinkKind[] = ['land', 'sea', 'regional', 'inter-regional', 'superpower'];
  const edges = new Set<string>();
  for (const l of scenario.links) {
    if (!ids.has(l.a) || !ids.has(l.b)) throw new Error(`link ${l.a}-${l.b}: unknown country`);
    if (l.a === l.b) throw new Error(`link ${l.a}-${l.b}: self-loop`);
    const key = [l.a, l.b].sort().join('|');
    if (edges.has(key)) throw new Error(`duplicate link ${key}`);
    edges.add(key);
    if (!kinds.includes(l.kind)) throw new Error(`link ${key}: unknown kind ${l.kind}`);
    const a = scenario.countries.find((c) => c.id === l.a)!;
    const b = scenario.countries.find((c) => c.id === l.b)!;
    if (l.kind === 'superpower' && (a.superpower !== undefined) === (b.superpower !== undefined)) {
      throw new Error(`link ${key}: requires exactly one superpower`);
    }
    if (l.kind === 'regional' || l.kind === 'inter-regional') {
      if (a.region === null || b.region === null || (a.region === b.region) !== (l.kind === 'regional')) {
        throw new Error(`link ${key}: incorrect regional classification`);
      }
    }
  }
  if (scenario.countries.length > 200) throw new Error('too many countries for an 8 bit index');
}
