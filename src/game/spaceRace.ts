import { translateDictionary } from '../i18n/index.js';
import type { SpaceAbility, SpaceStep } from '../hud/types';

// Standard / Deluxe track. Board supplies thresholds and VP; rules §6.4 supplies abilities.
// https://s3-us-west-2.amazonaws.com/gmtwebsiteassets/nnts/TSMap11.jpg
// https://s3-us-west-2.amazonaws.com/gmtwebsiteassets/nnts/TS_Rules-2015.pdf#page=7
// FAQ v5 §6.4: discard ONE held card, never a held scoring card.
export const SPACE_ABILITIES: Record<SpaceAbility['id'], SpaceAbility> = {
  'two-attempts': {
    id: 'two-attempts', name: { zh: '双重发射', en: 'Double launch' , es: translateDictionary('双重发射', 'es') },
    summary: { zh: '每回合两次发射', en: 'Two attempts per turn' , es: translateDictionary('每回合两次发射', 'es') },
    detail: { zh: '每回合可进行两次太空竞赛尝试。', en: 'Make up to two Space Race attempts per turn.' , es: translateDictionary('每回合可进行两次太空竞赛尝试。', 'es') },
  },
  headline: {
    id: 'headline', name: { zh: '头条先知', en: 'Headline intelligence' , es: translateDictionary('头条先知', 'es') },
    summary: { zh: '看过头条再选牌', en: 'See their headline first' , es: translateDictionary('看过头条再选牌', 'es') },
    detail: { zh: '头条阶段，看过对手公开的头条牌后再选牌。', en: 'See your opponent’s revealed headline before choosing yours.' , es: translateDictionary('头条阶段，看过对手公开的头条牌后再选牌。', 'es') },
  },
  'discard-held': {
    id: 'discard-held', name: { zh: '留牌调度', en: 'Reserve discretion' , es: translateDictionary('留牌调度', 'es') },
    summary: { zh: '回合末可弃一牌', en: 'Discard one held card' , es: translateDictionary('回合末可弃一牌', 'es') },
    detail: { zh: '回合末可弃一张保留手牌，计分牌除外。', en: 'At turn end, discard one held card, excluding scoring cards.' , es: translateDictionary('回合末可弃一张保留手牌，计分牌除外。', 'es') },
  },
  'eight-rounds': {
    id: 'eight-rounds', name: { zh: '轨道主动权', en: 'Orbital initiative' , es: translateDictionary('轨道主动权', 'es') },
    summary: { zh: '第八行动轮', en: 'Eighth action round' , es: translateDictionary('第八行动轮', 'es') },
    detail: { zh: '每回合可进行第八行动轮。', en: 'You may take an eighth action round each turn.' , es: translateDictionary('每回合可进行第八行动轮。', 'es') },
  },
};

export const SPACE_RACE: SpaceStep[] = [
  { name: { zh: '人造卫星', en: 'Earth Satellite' , es: translateDictionary('人造卫星', 'es') }, glyph: 'satellite', minOps: 2, rollMax: 3, vp: [2, 1] },
  { name: { zh: '动物上太空', en: 'Animal in Space' , es: translateDictionary('动物上太空', 'es') }, glyph: 'animal', minOps: 2, rollMax: 4, vp: [0, 0], ability: SPACE_ABILITIES['two-attempts'] },
  { name: { zh: '载人航天', en: 'Man in Space' , es: translateDictionary('载人航天', 'es') }, glyph: 'capsule', minOps: 2, rollMax: 3, vp: [2, 0] },
  { name: { zh: '载人地球轨道', en: 'Man in Earth Orbit' , es: translateDictionary('载人地球轨道', 'es') }, glyph: 'earth-orbit', minOps: 2, rollMax: 4, vp: [0, 0], ability: SPACE_ABILITIES.headline },
  { name: { zh: '绕月飞行', en: 'Lunar Orbit' , es: translateDictionary('绕月飞行', 'es') }, glyph: 'lunar-orbit', minOps: 3, rollMax: 3, vp: [3, 1] },
  { name: { zh: '载人登月', en: 'Eagle / Bear Has Landed' , es: translateDictionary('载人登月', 'es') }, glyph: 'landing', minOps: 3, rollMax: 4, vp: [0, 0], ability: SPACE_ABILITIES['discard-held'] },
  { name: { zh: '航天飞机', en: 'Space Shuttle' , es: translateDictionary('航天飞机', 'es') }, glyph: 'shuttle', minOps: 3, rollMax: 3, vp: [4, 2] },
  { name: { zh: '空间站', en: 'Space Station' , es: translateDictionary('空间站', 'es') }, glyph: 'station', minOps: 4, rollMax: 2, vp: [2, 0], ability: SPACE_ABILITIES['eight-rounds'] },
];
