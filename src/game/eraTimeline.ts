import { translateDictionary } from '../i18n/index.js';
// The ten paintings and year spans selected in prototypes/era-pictures (07 长卷).
// Dates are a visual chronology, not an extra game clock or a source of rules.
import type { HudRules } from '../hud/types';
import { ERA_QUOTES } from './eraQuotes';
export const ERA_TIMELINE: NonNullable<HudRules['timeline']> = [
  { years: [1945, 1950], name: { zh: '柏林空运', en: 'Berlin Airlift' , es: translateDictionary('柏林空运', 'es') }, position: '44% 38%', rounds: 6 },
  { years: [1951, 1956], name: { zh: '氢弹试验', en: 'Hydrogen bomb test' , es: translateDictionary('氢弹试验', 'es') }, position: '50% 38%', rounds: 6 },
  { years: [1957, 1961], name: { zh: '第一颗卫星', en: 'First satellite' , es: translateDictionary('第一颗卫星', 'es') }, position: '68% 42%', rounds: 6 },
  { years: [1962, 1965], name: { zh: '导弹危机', en: 'Missile crisis' , es: translateDictionary('导弹危机', 'es') }, position: '52% 46%', rounds: 7 },
  { years: [1966, 1969], name: { zh: '登月', en: 'Moon landing' , es: translateDictionary('登月', 'es') }, position: '42% 52%', rounds: 7 },
  { years: [1970, 1973], name: { zh: '石油危机', en: 'Oil crisis' , es: translateDictionary('石油危机', 'es') }, position: '50% 46%', rounds: 7 },
  { years: [1974, 1978], name: { zh: '西贡撤离', en: 'Evacuation of Saigon' , es: translateDictionary('西贡撤离', 'es') }, position: '50% 50%', rounds: 7 },
  { years: [1979, 1982], name: { zh: '航天飞机', en: 'Space shuttle' , es: translateDictionary('航天飞机', 'es') }, position: '54% 44%', rounds: 7 },
  { years: [1983, 1986], name: { zh: '欧洲导弹', en: 'Missiles in Europe' , es: translateDictionary('欧洲导弹', 'es') }, position: '34% 52%', rounds: 7 },
  { years: [1987, 1991], name: { zh: '柏林墙倒', en: 'Fall of the Berlin Wall' , es: translateDictionary('柏林墙倒', 'es') }, position: '50% 46%', rounds: 7 },
].map((p, i) => ({ ...p, years: p.years as [number, number], image: `/hud/eras/t${String(i + 1).padStart(2, '0')}.webp`, quotes: ERA_QUOTES[i] }));
