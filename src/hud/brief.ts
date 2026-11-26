import { t as i18n, text as displayText } from '../i18n/index.js';
import { isScoringBattleground } from '../map/types';
// The card of the play screen for whatever the map has under the pointer or selected.
//
// A country's is cut down to what a glance needs: whose it is, how hard it is to take, and the two
// numbers. It stands in for the map's own card (src/map/infoCard.ts), which lists a country's
// neighbours and belongs to the sandbox. Here the map already dims everything that is not a
// neighbour, so the list is left out.
//
// A region's says what the region is worth and where each side stands in it: the three values of
// its scoring, then per side the standing it holds and the countries that give it that standing.
// The words of the rules in it are marked as the cards mark theirs. Once something is selected the
// card stays where it is, so that those words can be pointed at for their explanation.
import type { WorldMap } from '../map/WorldMap';
import { BATTLE_GLYPH } from '../map/battleMark';
import { regionStyles } from '../map/regionStyle';
import { areaMembers, countryAreas, scoringAreas } from '../map/scoringAreas';
import { STRINGS } from '../map/strings';
import type { Lang, MapState } from '../map/types';
import { esc, rem } from './dom';
import { HUD_STRINGS } from './strings';
import type { CountryScoring, CountryScores, HudTerm, RegionScoring, RegionStanding, RegionStandings, TermSource } from './types';

type Target = { kind: 'country' | 'region'; id: string };
type View = { side: 0 | 1 | null; html: string };

/** What the card needs beyond the map: the scenario's region values, and how to mark a word of the rules. */
export type BriefOptions = { scoring?: Record<string, RegionScoring>; countryScoring?: Record<string, CountryScoring>; term?: TermSource };

const RANK: Record<RegionStanding, number> = { none: 0, presence: 1, domination: 2, control: 3 };
const TIERS: HudTerm[] = ['presence', 'domination', 'control'];

export class CountryBrief {
  readonly root: HTMLDivElement;
  private state: MapState = { countries: {}, regions: {} };
  private standings: RegionStandings = {};
  private scores: CountryScores = {};
  /** What is drawn now, so that a change of nothing leaves the words under the pointer alone. */
  private html = '';
  private hovered: Target | null = null;
  private selected: Target | null;
  private right = false;
  private readonly off: (() => void)[];
  private readonly styles;

  constructor(
    private readonly parent: HTMLElement,
    private readonly map: WorldMap,
    private lang: Lang,
    private readonly opts: BriefOptions = {},
  ) {
    this.styles = regionStyles(map.pack.scenario.regions);
    this.selected = map.selection;
    this.root = document.createElement('div');
    this.root.className = 'hud-brief';
    this.root.hidden = true;
    parent.appendChild(this.root);
    this.root.addEventListener('click', e => {
      const button = (e.target as Element).closest<HTMLButtonElement>('button[data-area],button[data-country]');
      if (!button || !this.selected) return;
      e.stopPropagation();
      if (button.dataset.area) {
        const id = button.dataset.area; this.map.select({ kind: 'region', id }); this.map.flyTo(id, { fit: true });
        if (e.detail === 0) this.root.querySelector<HTMLButtonElement>(`[data-area="${id}"]`)?.focus({ preventScroll: true });
      } else if (button.dataset.country) { this.map.select({ kind: 'country', id: button.dataset.country }); this.map.flyTo(button.dataset.country); }
    });
    const follow = (e: PointerEvent): void => this.follow(e.clientX, e.clientY);
    window.addEventListener('pointermove', follow);
    this.off = [
      map.on('hover', (t) => {
        this.hovered = t;
        this.render();
      }),
      map.on('select', (t) => {
        this.selected = t;
        this.render();
      }),
      () => window.removeEventListener('pointermove', follow),
    ];
  }

  /** The situation on the map and, from whoever owns the rules, each side's standing in every region. */
  setState(state: MapState, standings: RegionStandings = {}, scores: CountryScores = {}): void {
    this.state = state;
    this.standings = standings;
    this.scores = scores;
    this.render();
  }

  setLanguage(lang: Lang): void {
    this.lang = lang;
    this.render();
  }

  dispose(): void {
    for (const off of this.off) off();
    this.root.remove();
  }

  /**
   * Like the map's own card it keeps to one corner and steps across when the pointer comes for it,
   * until it is selected: then it stays, so that the words in it can be pointed at.
   */
  private follow(x: number, y: number): void {
    if (this.root.hidden || this.selected) return;
    const r = this.root.getBoundingClientRect();
    const pad = 5 * rem();
    if (!(x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad)) return;
    const box = this.parent.getBoundingClientRect();
    const onLeftHalf = x < box.left + box.width / 2;
    // it belongs on the half the pointer is not in
    if (this.right === onLeftHalf) return;
    this.right = onLeftHalf;
    this.root.classList.toggle('right', this.right);
  }

  private badge(regionId: string | null): string {
    const st = regionId ? this.styles.get(regionId) : undefined;
    return st ? `<i class="bf-badge" style="--region:${esc(st.color)}">${esc(st.mark[this.lang])}</i>` : '';
  }

  private pair(values: [number, number]): string {
    const { sides } = this.map.pack.scenario;
    return `<span class="bf-inf">${([0, 1] as const).map((i) => `<i class="${i === 0 ? 'is-a' : 'is-b'}${values[i] > 0 ? ' on' : ''}">${esc(sides[i].short[this.lang])}<b>${values[i]}</b></i>`).join('')}</span>`;
  }

  private country(id: string): View | null {
    const s = STRINGS[this.lang];
    const { scenario } = this.map.pack;
    const c = scenario.countries.find((x) => x.id === id);
    if (!c) return null;
    if (c.superpower !== undefined) return { side: c.superpower, html: `<div class="bf-top"><b class="bf-name">${esc(c.name[this.lang])}</b><span class="bf-meta">${esc(s.superpower)}</span></div>` };
    const st = this.state.countries[id] ?? { influence: [0, 0], controller: null };
    const who = st.controller === null ? s.uncontrolled : s.controlledBy(scenario.sides[st.controller].name[this.lang]);
    return {
      side: st.controller,
      html:
        `<div class="bf-top">${this.badge(c.region)}<b class="bf-name">${esc(c.name[this.lang])}</b>${isScoringBattleground(c, this.state) ? `<i class="bf-key" title="${esc(s.key)}">${BATTLE_GLYPH}</i>` : ''}<span class="bf-meta">${esc(s.stability)}<b>${c.stability}</b></span></div>` +
        `<div class="bf-row"><span class="bf-ctrl">${esc(who)}</span>${this.pair(st.influence)}</div>` +
        (countryAreas(scenario, c).length > 1 ? i18n("<div class=\"bf-membership\">{0}</div>{1}<p class=\"bf-scope-note\">{2}</p>", [countryAreas(scenario, c).map(a => esc(a.name[this.lang])).join(' <span>›</span> '), this.areaNav(c.region!), displayText('两种计分都包含该国')]) : ''),
    };
  }

  /** A word of the rules, marked up by the page's term source, or just set apart when there is none. */
  private term(word: HudTerm): string {
    const text = HUD_STRINGS[this.lang].standing[word];
    return this.opts.term?.(word, text, this.selected !== null) ?? `<b class="bf-term">${esc(text)}</b>`;
  }

  /** A side's name where it is as short as the labels beside it, its short form where it is not. */
  private sideLabel(i: 0 | 1): string {
    const side = this.map.pack.scenario.sides[i];
    const name = side.name[this.lang];
    return [...name].length <= 4 ? name : side.short[this.lang];
  }

  private region(id: string): View | null {
    const t = HUD_STRINGS[this.lang];
    const { scenario } = this.map.pack;
    const r = scoringAreas(scenario).find((x) => x.id === id);
    if (!r) return null;
    const special = this.opts.countryScoring?.[id];
    if (special) return this.countryScoring(id, special);
    const members = areaMembers(scenario, id);
    const resolved = this.state.regions[id]?.scoring;
    const keys = resolved?.allKeys ?? members.filter((c) => isScoringBattleground(c, this.state)).length;
    const sides = ([0, 1] as const).map((i) => {
      const mine = members.filter((c) => this.state.countries[c.id]?.controller === i);
      const counts = resolved?.sides[i];
      return { i, cls: i === 0 ? 'is-a' : 'is-b', held: counts?.held ?? mine.length, keys: counts?.keys ?? mine.filter((c) => isScoringBattleground(c, this.state)).length, standing: resolved?.standing[i] ?? this.standings[id]?.[i] };
    });
    const scoring = resolved?.rule ?? this.opts.scoring?.[id];
    // the three values, each with the mark of a side that stands on it now
    const tiers = !scoring
      ? ''
      : `<span class="bf-lb">${esc(t.scores)}</span><span class="bf-tiers">${TIERS.map((tier) => {
          const worth = scoring[tier];
          const on = sides.filter((s) => s.standing === tier);
          return `<span class="bf-tier${on.length ? ' on' : ''}">${this.term(tier)}<b${worth === 'win' ? ' class="win"' : ''}>${worth === 'win' ? esc(t.wins) : worth}</b><span class="bf-pips">${on.map((s) => `<i class="${s.cls}"></i>`).join('')}</span></span>`;
        }).join('')}</span><i class="bf-hr"></i>`;
    const rows = sides
      .map((s) => {
        const standing = s.standing === undefined ? '' : s.standing === 'none' ? `<span class="bf-nil">${esc(t.standing.none)}</span>` : this.term(s.standing);
        return (
          `<span class="bf-lb ${s.cls}">${esc(this.sideLabel(s.i))}</span><span class="bf-stand">${standing}</span>` +
          `<span class="bf-held${s.held ? ' on' : ''}" title="${esc(t.holdsKeys(s.keys, keys))}"><b>${s.held}</b><span>${esc(t.holds)}</span><i class="bf-key">${BATTLE_GLYPH}</i><b>${s.keys}</b><small>/${keys}</small></span>`
        );
      })
      .join('');
    const [a, b] = sides;
    const lead = resolved ? resolved.winner === null ? resolved.totals[0] - resolved.totals[1] : resolved.winner === 0 ? 1 : -1
      : RANK[a.standing ?? 'none'] - RANK[b.standing ?? 'none'] || a.held - b.held;
    const outcome = resolved ? resolved.winner !== null ? i18n("{0} {1}", [esc(this.sideLabel(resolved.winner)), displayText('直接获胜')])
      : lead === 0 ? (i18n("净得 0 VP")) : `${esc(this.sideLabel(lead > 0 ? 0 : 1))} +${Math.abs(lead)} VP` : '';
    const totals = resolved ? i18n("<div class=\"bf-score-totals\">{0}<strong>{1}</strong></div>", [sides.map(s => `<span class="${s.cls}">${esc(this.sideLabel(s.i))}<b>${resolved.winner === s.i ? (displayText('胜')) : resolved.totals[s.i]}</b><small>${resolved.winner === s.i ? '' : 'VP'}</small></span>`).join(''), outcome]) : '';
    return {
      side: lead === 0 ? null : lead > 0 ? 0 : 1,
      html:
        `<div class="bf-top">${this.badge(id)}<b class="bf-name">${esc(r.name[this.lang])}</b><span class="bf-meta">${esc(STRINGS[this.lang].countries(members.length))}</span></div>` +
        this.areaNav(id, id) + (resolved ? i18n("<div class=\"bf-preview-label\">{0} · {1}</div>", [resolved.final ? (displayText('最终计分')) : (displayText('当前结算预览')), displayText('已计入事件修正')]) : '') +
        `<div class="bf-grid">${tiers}${rows}</div>${totals}` +
        (resolved?.notes ?? []).map(note => `<p class="bf-scope-note bf-scoring-note">${esc(note[this.lang])}</p>`).join(''),
    };
  }

  private areaNav(parentId: string, active?: string): string {
    const areas = scoringAreas(this.map.pack.scenario).filter(a => a.id === parentId || a.parentId === parentId);
    if (areas.length < 2) return '';
    return i18n("<nav class=\"bf-area-nav\" aria-label=\"{0}\">{1}</nav>", [displayText('计分范围'), areas.map(a => {
      const label = a.parentId ? (displayText(`${a.name.zh}独立计分`)) : (displayText(`${a.name.zh}全区`));
      return `<button type="button" data-area="${a.id}" aria-pressed="${a.id === active}"${!this.selected ? ' disabled' : ''}>${esc(label)}</button>`;
    }).join('')]) + (active === parentId ? i18n("<p class=\"bf-scope-note\">{0}</p>", [displayText('包含东南亚的 7 个国家')]) : '');
  }

  private countryScoring(id: string, rule: CountryScoring): View {
    const { scenario } = this.map.pack;
    const area = scoringAreas(scenario).find(a => a.id === id)!;
    const parent = scenario.regions.find(r => r.id === area.parentId)!;
    const members = areaMembers(scenario, id);
    const scores = this.state.regions[id]?.scoring?.totals ?? this.scores[id];
    const difference = scores ? scores[0] - scores[1] : 0;
    const lead = difference === 0 ? null : difference > 0 ? 0 : 1;
    const rows = members.map(c => {
      const owner = this.state.countries[c.id]?.controller;
      const cls = owner === 0 ? 'is-a' : owner === 1 ? 'is-b' : 'none';
      const ownerLabel = owner === 0 || owner === 1 ? scenario.sides[owner].short[this.lang] : '—';
      return `<button type="button" class="bf-country-score ${cls}" data-country="${c.id}"${!this.selected ? ' disabled' : ''}><span>${esc(c.name[this.lang])}</span><i>${esc(ownerLabel)}</i><b>${rule.points[c.id] ?? '—'} <small>VP</small></b></button>`;
    }).join('');
    const totals = scores ? i18n("<div class=\"bf-score-totals\">{0}<strong>{1}</strong></div>", [([0, 1] as const).map(i => `<span class="${i === 0 ? 'is-a' : 'is-b'}">${esc(this.sideLabel(i))}<b>${scores[i]}</b><small>VP</small></span>`).join(''), lead === null ? (displayText('平分')) : `${esc(this.sideLabel(lead))} ${displayText('净得')} ${Math.abs(difference)}`]) : '';
    return { side: lead, html:
      i18n("<div class=\"bf-top\">{0}<b class=\"bf-name\">{1}</b><span class=\"bf-meta\">{2}</span></div>", [this.badge(parent.id), esc(area.name[this.lang]), displayText('亚洲子区域')]) +
      this.areaNav(parent.id, id) +
      i18n("<p class=\"bf-score-rule\">{0}</p>", [displayText('控制泰国得 2 VP，其余每国 1 VP')]) +
      i18n("<div class=\"bf-score-list\">{0}</div><div class=\"bf-preview-label\">{1}</div>{2}", [rows, displayText('当前局面 · 计分预览'), totals]) +
      i18n("<p class=\"bf-scope-note\">{0}</p>", [displayText('不使用存在 / 支配 / 区域控制档位。')]) +
      i18n("<p class=\"bf-scope-note\">{0}{1}</p>", [displayText('仍属于亚洲；最终计分时只随亚洲结算。'), rule.once ? (displayText('本计分牌用后移除。')) : ''])
    };
  }

  private render(): void {
    const t = this.selected ?? this.hovered;
    const view = !t ? null : t.kind === 'country' ? this.country(t.id) : this.region(t.id);
    this.root.hidden = !view;
    if (!t || !view) return;
    this.root.dataset.area = t.kind === 'region' ? t.id : '';
    const cls = `hud-brief ${t.kind} ${view.side === 0 ? 'is-a' : view.side === 1 ? 'is-b' : 'none'}${this.selected ? ' pinned' : ''}${this.right ? ' right' : ''}`;
    if (this.root.className !== cls) this.root.className = cls;
    if (view.html === this.html) return;
    this.html = view.html;
    this.root.innerHTML = displayText(view.html);
  }
}
