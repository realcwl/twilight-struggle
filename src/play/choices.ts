import type { CardOptions, Verb } from './types';

/** A single source for highlighting a hand and skipping redundant use menus. */
export function availableUses(options: CardOptions): Verb[] {
  if (options.blocked) return [];
  return (['event', 'place', 'realign', 'coup', 'space'] as const).filter(key => options[key].ok);
}
