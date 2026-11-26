// The engine's scoring report, laid out the way a screen wants to read it: per side one standing, one
// base value, the countries that add to it, a total; and between the two sides one net result.
// Nothing here decides anything: every number comes out of Match.scoring().
import type { ScoringReport, SideIndex } from '../../src/play/types';

export type Standing = 'none' | 'presence' | 'domination' | 'control';
export type CountryView = {
  id: string;
  name: string;
  /** A battleground of this scoring. */
  key: boolean;
  /** Borders the other side's superpower. */
  adjacent: boolean;
  /** What this country adds on top of the standing's base value. */
  pts: number;
  /** Controlled, but left out of this one scoring by a card. */
  excluded: boolean;
};
export type SideView = {
  side: SideIndex;
  name: string;
  short: string;
  standing: Standing;
  /** The standing in words; "逐国" where the area is scored country by country. */
  tier: string;
  /** What the standing is worth. */
  base: number;
  held: number;
  keys: number;
  adjacent: number;
  /** Every controlled country of the area, battlegrounds first. */
  countries: CountryView[];
  /** Those that add points. */
  scoring: CountryView[];
  bonus: number;
  total: number;
  /** One line that says why the standing is what it is. */
  why: string;
};
export type ScoreView = {
  region: string;
  name: string;
  members: string[];
  /** The area's battlegrounds, west to east. */
  keyIds: string[];
  rule: { presence: number; domination: number; control: number | 'win' } | null;
  sides: [SideView, SideView];
  /** Who gains, and how much. Null and 0 when the two totals cancel out. */
  lead: SideIndex | null;
  net: number;
  vpBefore: number;
  vpAfter: number;
  notes: string[];
};

export const TIERS: Record<Standing, string> = { none: '无', presence: '存在', domination: '支配', control: '控制' };
export const STANDINGS: Standing[] = ['presence', 'domination', 'control'];

export function viewOf(r: ScoringReport, q: { country(id: string): { name: string; x: number }; side(s: SideIndex): { name: string; short: string }; key(id: string): boolean }): ScoreView {
  const byX = (a: string, b: string): number => q.country(a).x - q.country(b).x;
  const sides = ([0, 1] as const).map((s): SideView => {
    const h = r.sides[s];
    const o = r.sides[1 - s];
    const standing = r.standing[s];
    const scores = r.rule !== null && standing !== 'none';
    const countries = h.countries
      .map((c): CountryView => {
        const excluded = c.id === r.shuttleCountry;
        const pts = excluded ? 0 : r.rule === null ? c.points : scores ? Number(c.key) + Number(c.adjacent) : 0;
        return { id: c.id, name: q.country(c.id).name, key: c.key, adjacent: c.adjacent, pts, excluded };
      })
      .sort((a, b) => Number(b.key) - Number(a.key) || byX(a.id, b.id));
    const base = typeof h.base === 'number' ? h.base : 0;
    const total = r.totals[s];
    let why: string;
    if (r.rule === null) why = h.held ? '按控制的国家逐个计分' : '没有控制任何国家';
    else if (standing === 'none') why = '没有控制任何国家';
    else if (standing === 'control') why = `控制全部 ${r.allKeys} 个战场国，国家也更多（${h.held} 对 ${o.held}）`;
    else if (standing === 'domination') why = `国家更多（${h.held} 对 ${o.held}），战场国也更多（${h.keys} 对 ${o.keys}）`;
    else {
      const short = [h.held <= o.held ? `国家不占多（${h.held} 对 ${o.held}）` : '', h.keys <= o.keys ? `战场国不占多（${h.keys} 对 ${o.keys}）` : '', h.held > o.held && h.keys > o.keys && h.held === h.keys ? '没有非战场国' : ''].filter(Boolean);
      why = `至少控制 1 国${short.length ? `；${short.join('，')}` : ''}`;
    }
    return {
      side: s,
      ...q.side(s),
      standing,
      tier: r.rule === null ? (h.held ? '逐国' : '无') : TIERS[standing],
      base,
      held: h.held,
      keys: h.keys,
      adjacent: h.adjacent,
      countries,
      scoring: countries.filter((c) => c.pts > 0),
      bonus: total - base,
      total,
      why,
    };
  }) as [SideView, SideView];
  const delta = r.totals[0] - r.totals[1];
  return {
    region: r.region,
    name: r.name.zh,
    members: r.members,
    keyIds: r.members.filter((id) => q.key(id)).sort(byX),
    rule: r.rule,
    sides,
    lead: delta === 0 ? null : delta > 0 ? 0 : 1,
    net: Math.abs(delta),
    vpBefore: r.vpBefore,
    vpAfter: r.vpBefore + delta,
    notes: r.notes.map((n) => n.zh),
  };
}

/** The score as the track words it. */
export const lead = (vp: number, names: [string, string]): string => (vp === 0 ? '平分' : `${names[vp > 0 ? 0 : 1]}领先 ${Math.abs(vp)}`);
