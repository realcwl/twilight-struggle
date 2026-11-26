import { translateDictionary, text as displayText } from '../i18n/index.js';
import type { Lang } from './types';

type Strings = {
  stability: string;
  key: string;
  influence: string;
  controlledBy: (side: string) => string;
  uncontrolled: string;
  flip: (side: string, n: number) => string;
  neighbours: string;
  land: string;
  sea: string;
  regional: string;
  'inter-regional': string;
  superpower: string;
  superpowerNote: string;
  countries: (n: number) => string;
  controls: (n: number, keys: number) => string;
  noStatus: string;
  hintSelect: string;
  hintRegion: string;
  regions: string;
};

export const STRINGS: Record<Lang, Strings> = {
  zh: {
    stability: '稳定度',
    key: '战场国',
    influence: '影响力',
    controlledBy: (side) => `${side}控制`,
    uncontrolled: '无人控制',
    flip: (side, n) => `${side}再投入 ${n} 点可翻转控制`,
    neighbours: '相邻',
    land: '陆路',
    sea: '海路',
    regional: '区域内',
    'inter-regional': '跨区域',
    superpower: '超级大国',
    superpowerNote: '本土空间，只提供相邻关系，不放置影响力。',
    countries: (n) => `${n} 个国家`,
    controls: (n, keys) => `控制 ${n} 国，其中战场国 ${keys} 个`,
    noStatus: '—',
    hintSelect: '点击固定 · Esc 取消',
    hintRegion: '双击飞到该大区',
    regions: '大区',
  },
  en: {
    stability: 'Stability',
    key: 'Battleground',
    influence: 'Influence',
    controlledBy: (side) => `Controlled by ${side}`,
    uncontrolled: 'Uncontrolled',
    flip: (side, n) => `${side} needs ${n} more to flip control`,
    neighbours: 'Adjacent',
    land: 'land',
    sea: 'sea',
    regional: 'regional',
    'inter-regional': 'inter-regional',
    superpower: 'Superpower',
    superpowerNote: 'Home space: provides adjacency and does not receive influence.',
    countries: (n) => `${n} countries`,
    controls: (n, keys) => `controls ${n}, of which ${keys} battlegrounds`,
    noStatus: '—',
    hintSelect: 'Click to pin · Esc to clear',
    hintRegion: 'Double-click to fly here',
    regions: 'Regions',
  },
 es: translateDictionary({
    stability: '稳定度',
    key: '战场国',
    influence: '影响力',
    controlledBy: (side) => `${side}控制`,
    uncontrolled: '无人控制',
    flip: (side, n) => `${side}再投入 ${n} 点可翻转控制`,
    neighbours: '相邻',
    land: '陆路',
    sea: '海路',
    regional: '区域内',
    'inter-regional': '跨区域',
    superpower: '超级大国',
    superpowerNote: '本土空间，只提供相邻关系，不放置影响力。',
    countries: (n) => `${n} 个国家`,
    controls: (n, keys) => `控制 ${n} 国，其中战场国 ${keys} 个`,
    noStatus: '—',
    hintSelect: '点击固定 · Esc 取消',
    hintRegion: '双击飞到该大区',
    regions: '大区',
  }, 'es') };

/** Tiny DOM helper. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = displayText(text);
  return node;
}
