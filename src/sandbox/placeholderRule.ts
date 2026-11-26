// Sandbox-only stand-in for the rules engine, so the panel can fill in a full MapState.
// The map module itself never computes any of this: it only draws the state it is given.
import type { CountryState, SideIndex } from '../map/types';

export type Override = 'auto' | 'none' | SideIndex;

/** A side controls a country when its influence leads the other side's by at least the stability. */
export function deriveCountry(influence: [number, number], stability: number, override: Override): CountryState {
  const lead = influence[0] - influence[1];
  const auto: SideIndex | null = lead >= stability ? 0 : -lead >= stability ? 1 : null;
  const controller = override === 'auto' ? auto : override === 'none' ? null : override;
  if (controller === null) return { influence, controller };
  const other = controller === 0 ? 1 : 0;
  // how many more points the other side needs to take the country for itself
  const flipMargin = Math.max(1, influence[controller] + stability - influence[other]);
  return { influence, controller, flipMargin };
}

/** A coarse label per side from how many countries each controls in a region. */
export function regionStatus(held: [number, number], labels: { none: string; ahead: string; behind: string; even: string }): [string, string] {
  const one = (mine: number, theirs: number): string =>
    mine === 0 ? labels.none : mine > theirs ? labels.ahead : mine < theirs ? labels.behind : labels.even;
  return [one(held[0], held[1]), one(held[1], held[0])];
}
