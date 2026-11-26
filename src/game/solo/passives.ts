import {translateDictionary} from '../../i18n/index.js';
// Public reminders are projections of the rules' live flags, never another copy of the rules.
import catalog from '../../cards/catalog.json';
import type { PassiveEffect, SideIndex, Localized } from '../../hud/types';
import type { MatchState } from './model';

export type PassiveSource = {
  id: string;
  card: string;
  by: SideIndex | null;
  turn: number;
  round: number;
  keys: { key: string; temporary: boolean }[];
};
type Definition = { keys: string[]; summary: string; until?: string; scope: string };
const def = (keys: string, summary: string, scope: string, until?: string): Definition => ({ keys: keys.split(' '), summary, scope, until });
const DEFS: Record<string, Definition> = {
  '009': def('vietnam', '苏联将全部行动点用于东南亚时，额外获得 1 行动点。', '东南亚'),
  '016': def('warsaw', '满足《北大西洋公约组织》的触发条件。', '北约'),
  '017': def('deGaulle', '《北大西洋公约组织》不再保护法国。', '法国'),
  '021': def('nato', '保护美国控制的欧洲国家，限制苏联政变、调整阵营及局部战争。', '欧洲'),
  '023': def('marshall', '满足《北大西洋公约组织》的触发条件。', '北约'),
  '025': def('ops0', '美国卡牌行动点 +1，最多为 4。', '美国行动点'),
  '027': def('japan', '苏联不得在日本进行政变或调整阵营。', '日本'),
  '031': def('ops0 ops1', '对手卡牌行动点 −1，最低为 1。', '对手行动点'),
  '035': def('formosan', '美国控制台湾时，台湾在亚洲及最终计分中视为战场国。', '台湾', '美国打出《中国牌》时结束'),
  '040': def('missile0 missile1', '受限制的一方尝试政变将立即输掉游戏；可以移除指定影响力解除。', '政变', '至本回合结束，或移除指定影响力解除'),
  '041': def('subs', '美国在战场国政变不降低核危机等级。', '美国政变'),
  '042': def('trap0', '美国需弃掉至少 2 行动点的牌并掷骰，尝试解除泥潭。', '美国行动轮', '解除掷骰为 1–4 时结束'),
  '043': def('salt', '双方的政变掷骰结果 −1。', '双方政变'),
  '044': def('trap1', '苏联需弃掉至少 2 行动点的牌并掷骰，尝试解除捕熊陷阱。', '苏联行动轮', '解除掷骰为 1–4 时结束'),
  '049': def('envy0 envy1', '收牌方下一行动轮必须将《导弹嫉妒》用于行动点。', '收牌方行动轮', '《导弹嫉妒》用于行动点后结束'),
  '050': def('bury', '美国下一行动轮若不使用《联合国干预》事件，苏联获得 3 胜利点。', '美国下一行动轮', '美国下一行动轮结算后结束'),
  '051': def('ops1', '苏联卡牌行动点 +1，最多为 4。', '苏联行动点'),
  '055': def('brandt', '《北大西洋公约组织》不再保护西德。', '西德', '被《推倒这堵墙》取消'),
  '059': def('flower', '美国将战争牌用于事件或行动点时，苏联获得 2 胜利点。', '美国战争牌', '被《邪恶帝国》取消'),
  '060': def('u2', '本回合使用《联合国干预》事件，苏联额外获得 1 胜利点。', '联合国干预'),
  '065': def('campDavid', '阻止《阿以战争》事件。', '阿以战争'),
  '068': def('pope', '满足《团结工会》的触发条件。', '团结工会'),
  '069': def('deathSquads', '出牌方在中南美洲政变掷骰 +1，对手 −1。', '中美洲、南美洲'),
  '073': def('shuttle', '下次亚洲或中东计分，苏联的国家数和战场国数各减 1。', '亚洲、中东', '下一次亚洲或中东计分后结束'),
  '082': def('hostage', '《恐怖主义》使美国弃牌数量翻倍。', '恐怖主义'),
  '083': def('ironLady', '阻止《社会主义政府》事件。', '社会主义政府'),
  '086': def('northSea', '阻止《石油输出国组织》。', '石油输出国组织'),
  '087': def('reformer', '苏联不得在欧洲政变；增强《公开性》的效果。', '欧洲、公开性'),
  '093': def('iranContra', '美国调整阵营掷骰结果 −1。', '美国调整阵营'),
  '094': def('chernobyl', '苏联不得通过花费行动点在所选地区放置影响力。', '所选地区'),
  '096': def('wall', '阻止《维利·勃兰特》事件。', '维利·勃兰特'),
  '097': def('evilEmpire', '阻止《鲜花力量》事件。', '鲜花力量'),
  '098': def('ames', '美国向苏联公开全部手牌。', '美国手牌'),
  '106': def('norad', '行动轮内核危机变为 2 且美国控制加拿大，轮末在已有美国影响力的国家增加 1 点。', '加拿大、美国影响力', '被《泥潭》取消'),
  '109': def('yuri', '美国每次尝试政变，苏联获得 1 胜利点。', '美国政变'),
  '110': def('awacs', '阻止《穆斯林革命》事件。', '穆斯林革命'),
};
const cards = new Map(catalog.map(c => [String(c.id).padStart(3, '0'), c]));
const text = (zh: string, en = zh): Localized => ({ zh, en: translateDictionary(zh, "en") || en, es: translateDictionary(zh, "es") });
const liveKeys = (s: MatchState, source: PassiveSource) => source.keys.filter(k =>
  (!k.temporary || source.turn === s.turn) && Object.hasOwn(k.temporary ? s.temp : s.flags, k.key));

/** Called where a real event sets a lasting rule flag. `by` is the card's player, not beneficiary. */
export function trackPassive(s: MatchState, card: string, by: SideIndex, key: string, temporary: boolean): void {
  if (!DEFS[card]?.keys.includes(key)) return;
  const id = `${card}-${by}-${s.turn}-${s.round}`;
  const sources = (s.passiveSources ??= []);
  // A fresh value replaces the old source, except additive Operation modifiers which coexist.
  for (const source of sources) if (source.id !== id && !/^ops[01]$/.test(key))
    source.keys = source.keys.filter(k => k.key !== key || k.temporary !== temporary);
  s.passiveSources = sources.filter(source => liveKeys(s, source).length);
  let source = s.passiveSources.find(source => source.id === id);
  if (!source) s.passiveSources.push(source = { id, card, by, turn: s.turn, round: s.round, keys: [] });
  if (!source.keys.some(k => k.key === key && k.temporary === temporary)) source.keys.push({ key, temporary });
}

/** Older saves have flags and a bounded play log, but no explicit attribution. Never infer a player from card colour. */
export function restorePassives(s: MatchState): void {
  if (s.passiveSources) return;
  s.passiveSources = [];
  for (const [card, definition] of Object.entries(DEFS)) {
    const raw = cards.get(card)!;
    const sharedOps = definition.keys.some(k => /^ops[01]$/.test(k));
    const log = [...s.log].reverse().find(line => {
      if (!line.includes(` · 《${raw.titleZh}》 · `)) return false;
      if (!sharedOps) return true;
      const opponentPlayed = raw.side === 'us' ? line.includes(' · 苏联 · ') : raw.side === 'ussr' && line.includes(' · 美国 · ');
      return line.startsWith(`T${s.turn} · `) && (line.endsWith('事件') || (opponentPlayed && !line.endsWith('太空竞赛')));
    });
    const keys = definition.keys.flatMap(key => [false, true].filter(temporary =>
      Object.hasOwn(temporary ? s.temp : s.flags, key)).map(temporary => ({ key, temporary })));
    // Shared additive keys cannot prove which modifier was played. Require its play record.
    if (!keys.length || (sharedOps && !log)) continue;
    s.passiveSources.push({ id: `legacy-${card}`, card, by: log?.includes(' · 美国 · ') ? 0 : log?.includes(' · 苏联 · ') ? 1 : null, turn: s.turn, round: 0, keys });
  }
}

export function passiveEffects(s: MatchState): PassiveEffect[] {
  return (s.passiveSources ?? []).flatMap(source => {
    const keys = liveKeys(s, source), definition = DEFS[source.card], raw = cards.get(source.card);
    if (!keys.length || !definition || !raw) return [];
    const temporary = keys.every(k => k.temporary);
    const duration = definition.until ?? (temporary ? '至本回合结束' : '持续生效');
    const summary = definition.summary + (source.card === '086' && s.temp.northSea ? ' 美国本回合可进行第八行动轮。' : '');
    const location = s.inPlay.includes(source.card) ? '保留在场上' : s.removed.includes(source.card) ? '已移出游戏，效果仍生效' : s.discard.includes(source.card) ? '在弃牌堆，效果仍生效' : '效果已生效';
    return [{ id: source.id, card: source.card, by: source.by, title: text(raw.titleZh, raw.title), summary: text(summary), duration: text(duration), scope: text(definition.scope), kind: definition.until ? 'condition' : temporary ? 'turn' : 'permanent', location: text(location) }];
  });
}
