import type { SideIndex } from '../hud/types';
import type { CardLocation, CardMove, Effect, RollSpec, ScoringReport, Verb } from '../play/types';

/**
 * `scoring`: on the first line a scoring writes, the whole calculation, which the log lays out as a
 * table. The lines that follow it (the other side's, and one per note) say the same in words and are
 * what an export or an older reader shows.
 */
export type BattleLine = { text: string; country?: string; scoring?: ScoringReport } & (
  | { kind: 'effect' | 'roll' | 'note' | 'score' | 'passive'; reveal?: never }
  | { kind: 'reveal'; reveal: { viewer: SideIndex; label: string; cards: string[] } }
  | { kind: 'move'; move: CardMove; reveal?: never }
);
export type BattleEntry = {
  id: number;
  turn: number;
  round: number;
  phase: 'setup' | 'headline' | 'action' | 'cleanup' | 'end';
  by: SideIndex | null;
  kind: 'card' | 'system' | 'legacy';
  card?: string;
  verb?: Verb;
  title: string;
  status: 'resolving' | 'resolved';
  lines: BattleLine[];
};
export const BATTLE_VERBS: Record<Verb, string> = { event: '事件', place: '放置影响力', coup: '政变', realign: '调整阵营', space: '太空竞赛' };
export const BATTLE_PHASES: Record<BattleEntry['phase'], string> = { setup: '初始部署', headline: '头条阶段', action: '行动轮', cleanup: '回合结算', end: '对局结束' };
export function cardLocationText(location: CardLocation): string {
  if (typeof location === 'string') return { deck: '牌堆', discard: '弃牌堆', removed: '移出游戏' }[location];
  return 'hand' in location ? `${location.hand === 0 ? '美国' : '苏联'}手牌` : `${location.play === 0 ? '美国' : '苏联'}结算区`;
}
export function cardMoveLine(move: CardMove, title: string): BattleLine {
  return { kind: 'move', move: structuredClone(move), text: `《${title}》：${cardLocationText(move.from)} → ${cardLocationText(move.to)} · ${move.reason}` };
}
/** Filter on the rules/server side before serializing a seat's history, including its export. */
export function battleLogFor(entries: readonly BattleEntry[], viewer: SideIndex): BattleEntry[] {
  return entries.map(entry => {
    const lines = entry.lines.filter(line => line.kind !== 'reveal' || line.reveal.viewer === viewer);
    return lines.length === entry.lines.length ? entry : { ...entry, lines };
  });
}
const who = (s: SideIndex | null) => s === null ? '无人控制' : s === 0 ? '美国' : '苏联';
const signed = (n: number) => n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0';
const score = (n: number) => n === 0 ? '平分' : `${who(n > 0 ? 0 : 1)}领先 ${Math.abs(n)} VP`;
export function effectLine(e: Effect, country: (id: string) => string, cost?: number): BattleLine {
  if (e.t === 'note') return { kind: 'note', text: e.text, ...(e.id ? { country: e.id } : {}) };
  if (e.t === 'inf') return {
    kind: 'effect', country: e.id,
    text: `${country(e.id)} · ${who(e.side)}影响力 ${e.from} → ${e.to}（${signed(e.to - e.from)}）${cost === undefined ? '' : ` · 消耗 ${cost} 行动点`}${e.ctrlFrom === e.ctrlTo ? '' : ` · 控制权：${who(e.ctrlFrom)} → ${who(e.ctrlTo)}`}`,
  };
  const why = e.why ? ` · ${e.why}` : '';
  if (e.t === 'vp') return { kind: 'score', text: `${who(e.side)} ${signed(e.d)} VP · ${score(e.from)} → ${score(e.to)}${why}` };
  const label = e.t === 'crisis' ? '核危机等级' : `${who(e.side)}${e.t === 'space' ? '太空竞赛' : '军事行动'}`;
  return { kind: 'effect', text: `${label} ${e.from} → ${e.to}${why}` };
}
export function rollLine(r: RollSpec, country: (id: string) => string): BattleLine {
  const dice = r.dice.map(d => `${who(d.side)}骰点 ${d.value}${d.mods.map(m => ` ${signed(m.n)} ${m.label}`).join('')} = ${d.total}`).join('；');
  const gate = r.bar ? `；门槛 ${r.bar.label} = ${r.bar.n}` : r.range ? `；成功范围 ${r.range[0]}–${r.range[1]}` : r.max ? `；成功范围 1–${r.max}` : '';
  return { kind: 'roll', ...(r.id ? { country: r.id } : {}), text: `${r.id ? `${country(r.id)} · ` : ''}${dice}${gate} · ${r.text}` };
}
export function battleText(entries: readonly BattleEntry[]): string {
  return entries.map(e => `第 ${e.turn} 回合 · ${BATTLE_PHASES[e.phase]}${e.phase === 'action' && e.round ? ` ${e.round}` : ''} · ${e.by === null ? '公共记录' : who(e.by)}\n${e.title}${e.verb ? ` · ${BATTLE_VERBS[e.verb]}` : ''}${e.status === 'resolving' ? '（结算中）' : ''}\n${e.lines.map(l => `  ${l.text}`).join('\n')}`).join('\n\n');
}
