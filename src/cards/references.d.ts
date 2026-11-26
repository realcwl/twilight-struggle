/** Every card of the catalogue, by its three-digit id. */
export const referencedCards: Map<string, { id: number; titleZh: string; side: string }>;
/** A card's Chinese title to its three-digit id. */
export const cardTitles: Map<string, string>;
/** A country's Chinese name (and the short forms cards use) to its id. Superpowers are left out. */
export const countryNames: Map<string, string>;
/** Every country of the scenario, by id. */
export const referencedCountries: Map<string, { id: string; name: { zh: string; en: string; es: string }; stability: number; key: boolean }>;
