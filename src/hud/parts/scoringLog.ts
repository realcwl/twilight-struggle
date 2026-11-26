import { translateDictionary } from '../../i18n/index.js';
// A scoring as the battle log keeps it: the same calculation the slip showed (play/scoring.ts), laid
// out as a table to be read slowly. Rules words and country names are marked the way the cards mark
// them, so they explain themselves under the pointer here too.
import { referencedCountries } from '../../cards/references.js';
import { esc } from '../../cards/terms.js';
import { BATTLE_GLYPH } from '../../map/battleMark';
import { STANDING_TERM, leadText, scoringSheets, type ScoredCountry, type ScoringSheet } from '../../play/scoringSheet';
import type { ScoringReport } from '../../play/types';
import type { Lang, SideIndex } from '../types';

const WORDS = {
  zh: {
    title: (area: string) => `${area}计分`, final: '最终计分', result: '结果', even: '双方抵消 · 胜利点不变', wins: (who: string) => `${who}控制欧洲 · 直接获胜`,
    held: '控制的国家', unit: '国', none: '没有', keys: '其中战场国', keysOf: (n: number) => `本区共 ${n} 个`, tier: '档位', tierHint: '只取最高一档', win: '直接获胜',
    keyBonus: '战场国', each: '每个 +1', adjacent: '邻接对手的超级大国', total: '合计', perCountry: '逐国计分，没有档位', excluded: '本次不计', adjacentMark: '邻',
    offset: (hi: number, lo: number) => `两边相抵：${hi} − ${lo} = `, zero: '0，胜利点不变', vp: '胜利点',
    rule: (p: number, d: number, c: number | 'win') => `本区档位：存在 ${p} · 支配 ${d} · 控制 ${c === 'win' ? '直接获胜' : c}。支配：国家和战场国都比对手多，且至少有一个非战场国。控制：国家比对手多，且控制全部战场国。`,
    noRule: '这个区域按国家逐个计分，不看档位，也没有战场国和邻接加分。', stop: '。',
  },
  en: {
    title: (area: string) => `${area} scoring`, final: 'Final scoring', result: 'Result', even: 'They cancel · no change', wins: (who: string) => `${who} controls Europe and wins the game`,
    held: 'Countries controlled', unit: '', none: 'none', keys: 'of them battlegrounds', keysOf: (n: number) => `${n} in the area`, tier: 'Standing', tierHint: 'only the highest counts', win: 'wins the game',
    keyBonus: 'Battlegrounds', each: '+1 each', adjacent: 'Bordering the other superpower', total: 'Total', perCountry: 'Scored country by country, no standings', excluded: 'not counted', adjacentMark: 'adj',
    offset: (hi: number, lo: number) => `Set against each other: ${hi} − ${lo} = `, zero: '0, no change', vp: 'Victory points',
    rule: (p: number, d: number, c: number | 'win') => `Standings here: Presence ${p} · Domination ${d} · Control ${c === 'win' ? 'wins the game' : c}. Domination: more countries and more battlegrounds than the other side, and at least one non-battleground. Control: more countries, and every battleground.`,
    noRule: 'This area is scored country by country: no standings, no battleground or adjacency bonus.', stop: '.',
  },
 es: translateDictionary({
    title: (area: string) => `${area}计分`, final: '最终计分', result: '结果', even: '双方抵消 · 胜利点不变', wins: (who: string) => `${who}控制欧洲 · 直接获胜`,
    held: '控制的国家', unit: '国', none: '没有', keys: '其中战场国', keysOf: (n: number) => `本区共 ${n} 个`, tier: '档位', tierHint: '只取最高一档', win: '直接获胜',
    keyBonus: '战场国', each: '每个 +1', adjacent: '邻接对手的超级大国', total: '合计', perCountry: '逐国计分，没有档位', excluded: '本次不计', adjacentMark: '邻',
    offset: (hi: number, lo: number) => `两边相抵：${hi} − ${lo} = `, zero: '0，胜利点不变', vp: '胜利点',
    rule: (p: number, d: number, c: number | 'win') => `本区档位：存在 ${p} · 支配 ${d} · 控制 ${c === 'win' ? '直接获胜' : c}。支配：国家和战场国都比对手多，且至少有一个非战场国。控制：国家比对手多，且控制全部战场国。`,
    noRule: '这个区域按国家逐个计分，不看档位，也没有战场国和邻接加分。', stop: '。',
  }, 'es') };

/** The table for one scoring. `sideName` as the HUD names the sides. */
export function scoringLogHTML(r: ScoringReport, o: { lang: Lang; sideName(s: SideIndex): string }): string {
  const w = WORDS[o.lang];
  const names = [o.sideName(0), o.sideName(1)];
  const sheets = scoringSheets(r, { lang: o.lang, sideName: (s) => names[s], countryName: (id) => referencedCountries.get(id)?.name[o.lang] ?? id });
  const cls = (s: number): string => (s === 0 ? 'is-a' : 'is-b');
  const term = (id: string, label: string): string => `<span class="game-term term-${id === 'battleground' ? 'influence' : 'scoring'}" data-term="${id}" tabindex="0" role="button">${esc(label)}</span>`;
  const chip = (c: ScoredCountry): string =>
    `<span class="bl-sc-country${c.excluded ? ' out' : ''}">${c.key ? `<i class="bl-sc-key">${BATTLE_GLYPH}</i>` : ''}<span class="game-term game-ref term-influence" data-country-ref="${c.id}" tabindex="0" role="button">${esc(c.name)}</span>${c.adjacent ? `<i class="bl-sc-adj">${w.adjacentMark}</i>` : ''}${r.rule === null && c.pts ? `<b>+${c.pts}</b>` : ''}${c.excluded ? `<small>${w.excluded}</small>` : ''}</span>`;
  const num = (n: number | string, unit = ''): string => `<b class="bl-sc-num">${n}</b>${unit ? `<span>${unit}</span>` : ''}`;
  const dash = '<span class="bl-sc-none">—</span>';
  const row = (label: string, hint: string, cell: (s: ScoringSheet) => string, extra = ''): string => `<tr class="${extra}"><th>${label}${hint ? `<small>${hint}</small>` : ''}</th>${sheets.map((s) => `<td class="${cls(s.side)}">${cell(s)}</td>`).join('')}</tr>`;
  const countries = (s: ScoringSheet): string => `${num(s.countries.length, w.unit)}<div class="bl-sc-countries">${s.countries.map(chip).join('') || `<span class="bl-sc-none">${w.none}</span>`}</div>`;
  const delta = r.totals[0] - r.totals[1];
  const gainer = delta === 0 ? null : delta > 0 ? 0 : 1;
  const result = r.winner !== null ? w.wins(esc(names[r.winner])) : gainer === null ? w.even : `${esc(names[gainer])} +${Math.abs(delta)} VP`;
  const rows = r.rule
    ? [
        row(w.held, '', countries),
        row(term('battleground', w.keys), w.keysOf(r.allKeys), (s) => num(s.keys, `/ ${r.allKeys}`)),
        row(w.tier, w.tierHint, (s) => `<div class="bl-sc-tier"><strong>${s.ranked ? term(STANDING_TERM[s.standing], s.tier) : s.tier}</strong>${s.ranked ? `<b class="bl-sc-num">${s.base === 'win' ? w.win : s.base}</b>` : ''}</div><p>${s.why}${w.stop}</p>`),
        ...(r.winner !== null
          ? []
          : [
              row(w.keyBonus, w.each, (s) => (s.ranked && s.keys ? num(`+${s.keys}`) : dash)),
              row(w.adjacent, w.each, (s) => (s.adjacent ? `${num(`+${s.adjacent}`)}<span>${s.countries.filter((c) => c.adjacent && !c.excluded).map((c) => esc(c.name)).join('、')}</span>` : dash)),
              row(w.total, '', (s) => num(s.total, 'VP'), 'total'),
            ]),
      ]
    : [row(w.held, w.perCountry, countries), row(w.total, '', (s) => num(s.total, 'VP'), 'total')];
  const [hi, lo] = [Math.max(r.totals[0], r.totals[1]), Math.min(r.totals[0], r.totals[1])];
  const net = r.winner !== null
    ? ''
    : `<p class="bl-sc-net"><strong>${w.offset(hi, lo)}${gainer === null ? w.zero : `<b class="${cls(gainer)}">${esc(names[gainer])} +${Math.abs(delta)} VP</b>`}</strong><span>${term('vp', w.vp)}：${leadText(r.vpBefore, names, o.lang)} → ${leadText(r.vpBefore + delta, names, o.lang)}</span></p>`;
  return `<div class="bl-sc">
    <header class="bl-sc-head"><b>${r.final ? `<small>${w.final}</small>` : ''}${esc(w.title(r.name[o.lang]))}</b><span class="bl-sc-result ${r.winner !== null ? cls(r.winner) : gainer === null ? '' : cls(gainer)}"><small>${w.result}</small>${result}</span></header>
    <table class="bl-sc-table"><thead><tr><th></th>${sheets.map((s) => `<th class="${cls(s.side)}">${esc(s.name)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>
    ${net}
    <p class="bl-sc-rule">${r.rule ? w.rule(r.rule.presence, r.rule.domination, r.rule.control) : w.noRule}</p>
    ${r.notes.map((n) => `<p class="bl-sc-note">${esc(n[o.lang])}</p>`).join('')}
  </div>`;
}
