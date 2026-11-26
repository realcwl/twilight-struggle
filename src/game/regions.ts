import { isScoringBattleground } from '../map/types';
// Card-defined scoring values and projections of the engine's resolved reports.
// Raw-map fallbacks serve the standalone map sandbox, which has no match or active events.
import catalog from '../cards/catalog.json';
import type { CountryScoring, CountryScores, RegionScoring, RegionStanding, RegionStandings } from '../hud/types';
import type { MapState, Region, Scenario } from '../map/types';

type ScoringCard = { id?: number; side: string; title: string; effects: string[]; once?: boolean; scoringRule?: { kind: string; area: string; points: Record<string, number> } };

const VALUES = /Presence (\d+) · Domination (\d+) · Control (?:(\d+)|wins the game)/;

/**
 * The three values of every region, read off that region's scoring card, so that the map and the
 * card cannot say different things. A region with no such card, or one worded another way, is left
 * out, and the screen then shows no values for it.
 */
export function scoringFromCards(regions: Region[], cards: readonly ScoringCard[] = catalog): Record<string, RegionScoring> {
  const out: Record<string, RegionScoring> = {};
  for (const r of regions) {
    const card = cards.find((c) => c.side === 'scoring' && c.title === `${r.name.en} Scoring`);
    const m = card?.effects.map((line) => VALUES.exec(line)).find((found) => found !== null);
    if (m) out[r.id] = { presence: Number(m[1]), domination: Number(m[2]), control: m[3] === undefined ? 'win' : Number(m[3]) };
  }
  return out;
}

/** Countries a side controls in a region, and how many of them are key countries. */
export type Holdings = { held: number; keys: number };

/**
 * One side's standing in a region, as the glossary words it:
 *   presence     controls at least one country
 *   domination   controls more countries and more key countries than the other side, and at least
 *                one key country and one that is not
 *   control      controls more countries than the other side, and every key country
 */
export function standingOf(mine: Holdings, theirs: Holdings, keysInRegion: number): RegionStanding {
  if (mine.held === 0) return 'none';
  if (mine.held > theirs.held) {
    if (keysInRegion > 0 && mine.keys === keysInRegion) return 'control';
    if (mine.keys > theirs.keys && mine.held > mine.keys) return 'domination';
  }
  return 'presence';
}

/** Both sides' standing in every region of the scenario, for one situation on the map. */
export function regionStandings(scenario: Scenario, state: MapState): RegionStandings {
  const out: RegionStandings = {};
  for (const r of scenario.regions) {
    const resolved = state.regions[r.id]?.scoring;
    if (resolved) { out[r.id] = resolved.standing; continue; }
    const members = scenario.countries.filter((c) => c.region === r.id);
    const of = (side: 0 | 1): Holdings => {
      const mine = members.filter((c) => state.countries[c.id]?.controller === side);
      return { held: mine.length, keys: mine.filter((c) => isScoringBattleground(c, state)).length };
    };
    const [a, b] = [of(0), of(1)];
    const keys = members.filter((c) => isScoringBattleground(c, state)).length;
    out[r.id] = [standingOf(a, b, keys), standingOf(b, a, keys)];
  }
  return out;
}

/** The exceptional scoring rule is structured on its canonical card, not inferred from prose. */
export function countryScoringFromCards(cards: readonly ScoringCard[] = catalog): Record<string, CountryScoring> {
  return Object.fromEntries(cards.filter(c => c.side === 'scoring' && c.scoringRule?.kind === 'countries').map(c => [c.scoringRule!.area, { points: { ...c.scoringRule!.points }, cardId: c.id, once: c.once ?? false }]));
}

/** A preview of this position only: selecting an area never changes the VP track. */
export function countryScores(scoring: Record<string, CountryScoring>, state: MapState): CountryScores {
  return Object.fromEntries(Object.entries(scoring).map(([id, rule]) => {
    const resolved = state.regions[id]?.scoring;
    if (resolved) return [id, resolved.totals];
    const totals: [number, number] = [0, 0];
    for (const [country, points] of Object.entries(rule.points)) {
      const side = state.countries[country]?.controller;
      if (side === 0 || side === 1) totals[side] += points;
    }
    return [id, totals];
  }));
}
