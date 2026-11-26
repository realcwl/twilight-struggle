import { translateDictionary } from '../i18n/index.js';
// The Cold War scenario's tracks. Space milestones use the standard Deluxe rules.
import type { HudRules } from '../hud/types';
import { SPACE_RACE } from './spaceRace';
import { ERA_TIMELINE } from './eraTimeline';

const noCoupOrRealignment = { zh: '禁止政变 · 调整阵营', en: 'No coups or realignment' , es: translateDictionary('禁止政变 · 调整阵营', 'es') };

export const COLDWAR_TRACKS: HudRules = {
  turns: 10,
  timeline: ERA_TIMELINE,
  eras: [
    { id: 'early', name: { zh: '早期', en: 'Early' , es: translateDictionary('早期', 'es') }, from: 1, to: 3 },
    { id: 'middle', name: { zh: '中期', en: 'Middle' , es: translateDictionary('中期', 'es') }, from: 4, to: 7 },
    { id: 'late', name: { zh: '后期', en: 'Late' , es: translateDictionary('后期', 'es') }, from: 8, to: 10 },
  ],
  rounds: 7,
  vpMax: 20,
  // Level 1 remains on the gauge, but simplified play never enters it.
  crisis: [
    { zh: '核战', en: 'Nuclear war' , es: translateDictionary('核战', 'es') },
    { zh: '一触即发', en: 'On the brink' , es: translateDictionary('一触即发', 'es') },
    { zh: '高度戒备', en: 'High alert' , es: translateDictionary('高度戒备', 'es') },
    { zh: '局势紧张', en: 'Tension' , es: translateDictionary('局势紧张', 'es') },
    { zh: '和平', en: 'Peace' , es: translateDictionary('和平', 'es') },
  ],
  // Cumulative restrictions, GMT Deluxe rules 8.1.3 / 8.1.5. Events may explicitly override them.
  crisisEffects: [
    { label: { zh: '核战已禁用', en: 'Nuclear war disabled' , es: translateDictionary('核战已禁用', 'es') }, detail: { zh: '核危机最低保持在 2 级', en: 'DEFCON stays at 2 or higher' , es: translateDictionary('核危机最低保持在 2 级', 'es') }, restricted: true },
    { label: noCoupOrRealignment, detail: { zh: '欧洲 · 亚洲 · 中东', en: 'Europe · Asia · Middle East' , es: translateDictionary('欧洲 · 亚洲 · 中东', 'es') }, restricted: true },
    { label: noCoupOrRealignment, detail: { zh: '欧洲 · 亚洲', en: 'Europe · Asia' , es: translateDictionary('欧洲 · 亚洲', 'es') }, restricted: true },
    { label: noCoupOrRealignment, detail: { zh: '欧洲', en: 'Europe' , es: translateDictionary('欧洲', 'es') }, restricted: true },
    { label: { zh: '政变 · 调整阵营', en: 'Coups & realignment' , es: translateDictionary('政变 · 调整阵营', 'es') }, detail: { zh: '无 DEFCON 地区限制', en: 'No DEFCON region restrictions' , es: translateDictionary('无 DEFCON 地区限制', 'es') } },
  ],
  milopsMax: 5,
  space: SPACE_RACE,
};
