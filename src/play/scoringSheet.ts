import { translateDictionary } from '../i18n/index.js';
// A scoring report laid out the way it is read: per side one standing, what that is worth, the
// countries that add to it, a total, and why the standing is what it is. Shared by the slip that shows
// a scoring as it happens (scoring.ts) and by the battle log, which keeps it (hud/parts/scoringLog.ts),
// so that the two can never say different things. Nothing here decides anything: every number comes
// out of the report from the rules (Match.scoring).
import type { ScoringReport, SideIndex } from './types';

import type {Lang} from '../map/types';
export type ScoredCountry = {
  id: string;
  name: string;
  /** A battleground of this scoring. */
  key: boolean;
  /** Borders the other side's superpower. */
  adjacent: boolean;
  /** What this country adds on top of what the standing is worth. */
  pts: number;
  /** Controlled, but left out of this one scoring by a card. */
  excluded: boolean;
};
export type ScoringSheet = {
  side: SideIndex;
  name: string;
  standing: ScoringReport['standing'][number];
  /** The area has standings and this side has one. */
  ranked: boolean;
  /** The standing in words; "逐国" where the area is scored country by country. */
  tier: string;
  /** What the standing is worth: a number, or the game. */
  base: number | 'win';
  /** Countries and battlegrounds as this scoring counts them (a card may leave one out). */
  held: number;
  keys: number;
  adjacent: number;
  /** Every controlled country of the area, battlegrounds first, then west to east. */
  countries: ScoredCountry[];
  /** Those that add points. None when the area is won outright: a win is not a sum. */
  scoring: ScoredCountry[];
  total: number;
  /** One sentence that says why the standing is what it is. */
  why: string;
};

export const SCORING_WORDS = {
  zh: {
    presence: '存在', domination: '支配', control: '控制', none: '无', each: '逐国',
    level: '平分', leads: (who: string, n: number) => `${who}领先 ${n}`,
    whyEach: '按控制的国家逐个计分', whyNone: '没有控制任何国家',
    whyControl: (all: number, a: number, b: number) => `控制全部 ${all} 个战场国，国家也更多（${a} 对 ${b}）`,
    whyDomination: (a: number, b: number, ka: number, kb: number) => `国家更多（${a} 对 ${b}），战场国也更多（${ka} 对 ${kb}）`,
    whyPresence: '至少控制 1 国', fewer: (a: number, b: number) => `国家不占多（${a} 对 ${b}）`, fewerKeys: (a: number, b: number) => `战场国不占多（${a} 对 ${b}）`, noOrdinary: '没有非战场国',
    then: '；', and: '，',
  },
  en: {
    presence: 'Presence', domination: 'Domination', control: 'Control', none: 'None', each: 'Per country',
    level: 'level', leads: (who: string, n: number) => `${who} leads by ${n}`,
    whyEach: 'One score per country controlled', whyNone: 'Controls no country',
    whyControl: (all: number, a: number, b: number) => `All ${all} battlegrounds, and more countries (${a} to ${b})`,
    whyDomination: (a: number, b: number, ka: number, kb: number) => `More countries (${a} to ${b}) and more battlegrounds (${ka} to ${kb})`,
    whyPresence: 'At least one country', fewer: (a: number, b: number) => `not more countries (${a} to ${b})`, fewerKeys: (a: number, b: number) => `not more battlegrounds (${a} to ${b})`, noOrdinary: 'no non-battleground',
    then: '; ', and: ', ',
  },
 es: translateDictionary({
    presence: '存在', domination: '支配', control: '控制', none: '无', each: '逐国',
    level: '平分', leads: (who: string, n: number) => `${who}领先 ${n}`,
    whyEach: '按控制的国家逐个计分', whyNone: '没有控制任何国家',
    whyControl: (all: number, a: number, b: number) => `控制全部 ${all} 个战场国，国家也更多（${a} 对 ${b}）`,
    whyDomination: (a: number, b: number, ka: number, kb: number) => `国家更多（${a} 对 ${b}），战场国也更多（${ka} 对 ${kb}）`,
    whyPresence: '至少控制 1 国', fewer: (a: number, b: number) => `国家不占多（${a} 对 ${b}）`, fewerKeys: (a: number, b: number) => `战场国不占多（${a} 对 ${b}）`, noOrdinary: '没有非战场国',
    then: '；', and: '，',
  }, 'es') };

/** The rules word each standing is explained under (src/cards/glossary.json). */
export const STANDING_TERM: Record<string, string> = { presence: 'presence', domination: 'domination', control: 'region-control' };

/** Both sides' sheets. `x`: where a country is, west to east, to list countries in map order. */
export function scoringSheets(r: ScoringReport, o: { lang: Lang; sideName(s: SideIndex): string; countryName(id: string): string; x?(id: string): number }): [ScoringSheet, ScoringSheet] {
  const w = SCORING_WORDS[o.lang];
  return ([0, 1] as const).map((s): ScoringSheet => {
    const h = r.sides[s];
    const other = r.sides[1 - s];
    const standing = r.standing[s];
    const ranked = r.rule !== null && standing !== 'none';
    const countries = h.countries
      .map((c): ScoredCountry => {
        const excluded = c.id === r.shuttleCountry;
        return { id: c.id, name: o.countryName(c.id), key: c.key, adjacent: c.adjacent, excluded, pts: excluded ? 0 : r.rule === null ? c.points : ranked ? Number(c.key) + Number(c.adjacent) : 0 };
      })
      .sort((a, b) => Number(b.key) - Number(a.key) || (o.x?.(a.id) ?? 0) - (o.x?.(b.id) ?? 0));
    let why: string;
    if (r.rule === null) why = h.held ? w.whyEach : w.whyNone;
    else if (standing === 'none') why = w.whyNone;
    else if (standing === 'control') why = w.whyControl(r.allKeys, h.held, other.held);
    else if (standing === 'domination') why = w.whyDomination(h.held, other.held, h.keys, other.keys);
    else {
      const lacking = [h.held <= other.held ? w.fewer(h.held, other.held) : '', h.keys <= other.keys ? w.fewerKeys(h.keys, other.keys) : '', h.held > other.held && h.keys > other.keys && h.held === h.keys ? w.noOrdinary : ''].filter(Boolean);
      why = w.whyPresence + (lacking.length ? w.then + lacking.join(w.and) : '');
    }
    return {
      side: s, name: o.sideName(s), standing, ranked,
      tier: r.rule === null ? (h.held ? w.each : w.none) : w[standing],
      base: h.base, held: h.held, keys: h.keys, adjacent: h.adjacent, countries,
      scoring: r.winner !== null ? [] : countries.filter((c) => c.pts > 0),
      total: r.totals[s], why,
    };
  }) as [ScoringSheet, ScoringSheet];
}

/** The score as the track words it. */
export const leadText = (vp: number, names: readonly string[], lang: Lang): string => (vp === 0 ? SCORING_WORDS[lang].level : SCORING_WORDS[lang].leads(names[vp > 0 ? 0 : 1], Math.abs(vp)));
