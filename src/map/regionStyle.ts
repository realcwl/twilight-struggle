import { translateDictionary } from '../i18n/index.js';
// How a scoring region is told apart on the map: one colour and one short mark per region, worn by
// every node of that region. Presentation only, keyed by region id like the flags and the country
// flavour. The colours keep clear of what already carries meaning on the board: the blue and red of
// the two sides, the gold of key countries, and the blue-green of the sea.
import { el } from './strings';
import type { Lang, Localized, Region } from './types';

export type RegionStyle = { color: string; mark: Localized };

const STYLES: Record<string, RegionStyle> = {
  // Europe and Asia have the most coastline, so they take the two colours furthest from the sea's.
  europe: { color: '#ab8fff', mark: { zh: '欧', en: 'EU' , es: translateDictionary('欧', 'es') } },
  mideast: { color: '#2fc6b4', mark: { zh: '东', en: 'ME' , es: translateDictionary('东', 'es') } },
  africa: { color: '#b4d23c', mark: { zh: '非', en: 'AF' , es: translateDictionary('非', 'es') } },
  asia: { color: '#f27ab1', mark: { zh: '亚', en: 'AS' , es: translateDictionary('亚', 'es') } },
  camerica: { color: '#dc9058', mark: { zh: '中', en: 'CA' , es: translateDictionary('中', 'es') } },
  samerica: { color: '#4fc272', mark: { zh: '南', en: 'SA' , es: translateDictionary('南', 'es') } },
};

/** The style of every region of a scenario, by region id. A region not listed above still gets one. */
export function regionStyles(regions: Region[]): Map<string, RegionStyle> {
  const spare = Object.values(STYLES);
  return new Map(
    regions.map((r, i) => {
      const initials = r.name.en.split(/\s+/).map((word) => word[0] ?? '').join('').slice(0, 2).toUpperCase();
      return [r.id, STYLES[r.id] ?? { color: spare[i % spare.length].color, mark: { zh: [...r.name.zh][0] ?? '', en: initials , es: translateDictionary([...r.name.zh][0] ?? '', 'es') } }];
    }),
  );
}

/** A region's mark on a small tile of its colour, for cards and lists. Styled by `.wm-badge` in map.css. */
export function regionBadge(style: RegionStyle, lang: Lang): HTMLElement {
  const badge = el('i', 'wm-badge', style.mark[lang]);
  badge.style.setProperty('--region', style.color);
  return badge;
}
