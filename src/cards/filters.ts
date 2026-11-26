import {cardCopy} from '../i18n/cards.js';
import {getLanguage} from '../i18n/index.js';
import { t as i18n, text as displayText } from '../i18n/index.js';
// Shared catalog controls for the full library and the never-seen card list.
import catalog from './catalog.json';
import './filters.css';

const metadata = new Map(catalog.map(c => [String(c.id).padStart(3, '0'), {
  era: c.era === 'mid' ? 'middle' : c.era,
  kind: c.side === 'scoring' ? 'tally' : c.side,
  text: `${String(c.id).padStart(3, '0')} ${c.id} ${c.titleZh} ${c.title} ${c.effectsZh.join(' ')} ${c.effects.join(' ')} ${cardCopy(c,'es').title} ${cardCopy(c,'es').effects.join(' ')}`.toLowerCase(),
}]));

export function mountCardFilters(host: HTMLElement, onChange: () => void, _lang: 'zh' | 'en' | 'es' = getLanguage()) {
  host.classList.add('cl-filters');
  host.innerHTML = i18n("<input type=\"search\" class=\"sheet-field\" placeholder=\"{0}\" aria-label=\"{1}\">\n    <select class=\"cl-era sheet-field\" aria-label=\"{2}\"><option value=\"all\">{3}</option><option value=\"early\">{4}</option><option value=\"middle\">{5}</option><option value=\"late\">{6}</option></select>\n    <select class=\"cl-side sheet-field\" aria-label=\"{7}\"><option value=\"all\">{8}</option><option value=\"us\">{9}</option><option value=\"ussr\">{10}</option><option value=\"neutral\">{11}</option><option value=\"tally\">{12}</option></select><span class=\"cl-count sheet-count\" aria-live=\"polite\"></span>", [displayText('搜索牌名、编号或规则'), displayText('搜索卡牌'), displayText('时期'), displayText('全部时期'), displayText('冷战早期'), displayText('冷战中期'), displayText('冷战晚期'), displayText('卡牌阵营'), displayText('全部阵营'), displayText('美国事件'), displayText('苏联事件'), displayText('中立 / 特殊'), displayText('计分牌')]);
  const search = host.querySelector<HTMLInputElement>('input')!;
  const era = host.querySelector<HTMLSelectElement>('.cl-era')!;
  const side = host.querySelector<HTMLSelectElement>('.cl-side')!;
  search.addEventListener('input', onChange);
  era.addEventListener('change', onChange);
  side.addEventListener('change', onChange);
  return {
    matches(id: string): boolean {
      const c = metadata.get(id), q = search.value.trim().toLowerCase();
      return !!c && (era.value === 'all' || c.era === era.value)
        && (side.value === 'all' || c.kind === side.value) && (!q || c.text.includes(q));
    },
    setCount(shown: number, total: number): void {
      host.querySelector('.cl-count')!.textContent = displayText(`${shown} / ${total}`);
    },
  };
}
