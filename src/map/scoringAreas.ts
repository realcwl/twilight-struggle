import { translateDictionary } from '../i18n/index.js';
// Selectable scoring areas. Nested areas reuse countries; they never change a country's region.
import type { Country, MapPack, Region, Scenario } from './types';

export type ScoringArea = Region & { parentId?: string; tag?: NonNullable<Country['subregions']>[number] };
const NESTED: ScoringArea[] = [
  { id: 'southeast-asia', parentId: 'asia', tag: 'southeast-asia', name: { zh: '东南亚', en: 'Southeast Asia' , es: translateDictionary('东南亚', 'es') } },
];

export function scoringAreas(scenario: Scenario): ScoringArea[] {
  return scenario.regions.flatMap(r => [r, ...NESTED.filter(s => s.parentId === r.id && scenario.countries.some(c => c.region === r.id && c.subregions?.includes(s.tag!)))]);
}
export function areaMembers(scenario: Scenario, id: string): Country[] {
  const area = scoringAreas(scenario).find(r => r.id === id);
  if (!area) return [];
  return scenario.countries.filter(c => c.superpower === undefined && c.region === (area.parentId ?? id) && (!area.tag || c.subregions?.includes(area.tag)));
}
export function countryAreas(scenario: Scenario, country: Country): ScoringArea[] {
  return scoringAreas(scenario).filter(a => a.id === country.region || (a.parentId === country.region && a.tag && country.subregions?.includes(a.tag)));
}
export function areaBounds(pack: MapPack, id: string): [number, number, number, number] | undefined {
  const base = pack.regions.find(r => r.id === id);
  if (base) return base.bbox;
  const ids = new Set(areaMembers(pack.scenario, id).map(c => c.id));
  const countries = pack.countries.filter(c => ids.has(c.id));
  if (!countries.length) return undefined;
  return [Math.min(...countries.map(c => Math.min(c.bbox[0], c.node[0]))), Math.min(...countries.map(c => Math.min(c.bbox[1], c.node[1]))), Math.max(...countries.map(c => Math.max(c.bbox[2], c.node[0]))), Math.max(...countries.map(c => Math.max(c.bbox[3], c.node[1])))];
}
