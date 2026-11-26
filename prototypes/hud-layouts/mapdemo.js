// The live map from src/map, showing a filler situation. Read-only use of the game's map module:
// nothing in src/ knows about these prototypes.
import { WorldMap } from '../../src/map/WorldMap.ts';
import { deriveCountry, regionStatus } from '../../src/sandbox/placeholderRule.ts';

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STATUS = { none: '无', ahead: '领先', behind: '落后', even: '均势' };

/** The same picture as the sandbox's "demo" preset. */
function demoState(scenario) {
  const rand = seeded(1947);
  const lean = { camerica: 0.95, samerica: 0.7, europe: 0.6, mideast: 0.5, africa: 0.4, asia: 0.42 };
  const state = { countries: {}, regions: {} };
  for (const c of scenario.countries) {
    const influence = [0, 0];
    if (c.superpower === undefined && c.region !== null && rand() >= 0.3) {
      const first = rand() < (lean[c.region] ?? 0.5) ? 0 : 1;
      const strong = Math.round(rand() * (c.stability + 2));
      const weak = rand() < 0.45 ? Math.round(rand() * 2) : 0;
      influence[first] = strong;
      influence[1 - first] = weak;
    }
    state.countries[c.id] = c.superpower !== undefined ? { influence: [0, 0], controller: c.superpower } : deriveCountry(influence, c.stability, 'auto');
  }
  for (const r of scenario.regions) {
    const held = [0, 0];
    for (const c of scenario.countries) {
      const ctrl = state.countries[c.id].controller;
      if (c.region === r.id && ctrl !== null) held[ctrl]++;
    }
    state.regions[r.id] = { status: regionStatus(held, STATUS) };
  }
  return state;
}

export async function startMap(container, onProgress) {
  const map = await WorldMap.create(container, `${import.meta.env.BASE_URL}maps/coldwar`, { lang: 'zh', onProgress });
  const state = demoState(map.pack.scenario);
  map.setState(state);
  return { map, state };
}
