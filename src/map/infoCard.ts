import { t as i18n } from '../i18n/index.js';
import { isScoringBattleground } from './types';
// The information card shown for the hovered or selected country or region.
import { battleGlyph } from './battleMark';
import { type RegionStyle, regionBadge, regionStyles } from './regionStyle';
import { STRINGS, el } from './strings';
import { areaMembers, countryAreas, scoringAreas } from './scoringAreas';
import type { Lang, LinkKind, MapPack, MapState } from './types';

export type CardTarget = { kind: 'country' | 'region'; id: string };

export class InfoCard {
  readonly root: HTMLDivElement;
  private lang: Lang = 'zh';
  private target: CardTarget | null = null;
  private pinned = false;
  private right = false;
  private state: MapState = { countries: {}, regions: {} };
  private readonly styles: Map<string, RegionStyle>;

  constructor(
    private readonly parent: HTMLElement,
    private readonly pack: MapPack,
    private readonly neighboursOf: (id: string) => { id: string; kind: LinkKind }[],
    private readonly onArea?: (id: string) => void,
  ) {
    this.styles = regionStyles(pack.scenario.regions);
    this.root = el('div', 'wm-card');
    this.root.hidden = true;
    parent.appendChild(this.root);
    this.root.addEventListener('pointerdown', e => e.stopPropagation());
    this.root.addEventListener('click', e => {
      e.stopPropagation();
      const id = (e.target as Element).closest<HTMLElement>('[data-area]')?.dataset.area;
      if (id && this.pinned) this.onArea?.(id);
    });
  }

  setLanguage(lang: Lang): void {
    this.lang = lang;
    this.render();
  }

  setState(state: MapState): void {
    this.state = state;
    this.render();
  }

  show(target: CardTarget | null, pinned: boolean): void {
    this.target = target;
    this.pinned = pinned;
    this.render();
  }

  /**
   * A hover card sits in a top corner of the map rather than at the cursor, so it never covers the
   * country being read or its neighbours. It moves to the other corner when the cursor comes near.
   */
  follow(clientX: number, clientY: number): void {
    if (this.pinned || !this.target) return;
    const box = this.parent.getBoundingClientRect();
    const x = clientX - box.left;
    const y = clientY - box.top;
    const nearLeft = x < this.root.offsetWidth + 90 && y < this.root.offsetHeight + 90;
    const leaveLeft = x < this.root.offsetWidth + 150 && y < this.root.offsetHeight + 150;
    // a little hysteresis so the card does not flicker between corners
    if (this.right ? !leaveLeft : nearLeft) this.right = !this.right;
    this.root.classList.toggle('right', this.right);
  }

  private sideClass(controller: 0 | 1 | null | undefined): string {
    return controller === 0 ? 'a' : controller === 1 ? 'b' : 'none';
  }

  private render(): void {
    const t = this.target;
    this.root.hidden = !t;
    if (!t) return;
    if (this.pinned) this.right = false;
    this.root.className = `wm-card ${t.kind}${this.pinned ? ' pinned' : ''}${this.right ? ' right' : ''}`;
    this.root.replaceChildren(...(t.kind === 'country' ? this.country(t.id) : this.region(t.id)));
  }

  private header(name: { zh: string; en: string; es: string }, meta: (Node | string)[]): HTMLElement {
    const header = el('header', 'wm-card-head');
    const title = el('div', 'wm-card-title', name[this.lang]);
    if (this.lang === 'zh') title.appendChild(el('span', 'wm-card-sub', name.en));
    const line = el('div', 'wm-card-meta');
    for (const m of meta) line.append(typeof m === 'string' ? el('span', '', m) : m);
    header.append(title, line);
    return header;
  }

  private country(id: string): Node[] {
    const s = STRINGS[this.lang];
    const { scenario } = this.pack;
    const c = scenario.countries.find((x) => x.id === id);
    if (!c) return [];
    const st = this.state.countries[id] ?? { influence: [0, 0], controller: null };
    const region = scenario.regions.find((r) => r.id === c.region);
    const sideName = (i: 0 | 1): string => scenario.sides[i].name[this.lang];

    const path = countryAreas(scenario, c).map(a => a.name[this.lang]).join(' › ');
    const meta: (Node | string)[] = [c.superpower !== undefined ? s.superpower : `${path} · ${s.stability} ${c.stability}`];
    const style = region && this.styles.get(region.id);
    if (style) meta.unshift(regionBadge(style, this.lang));
    if (isScoringBattleground(c, this.state)) {
      const key = el('span', 'wm-key');
      key.append(battleGlyph(), s.key);
      meta.push(key);
    }
    const out: Node[] = [this.header(c.name, meta)];
    if (countryAreas(scenario, c).length > 1) out.push(this.areaLinks(c.region!));

    if (c.superpower !== undefined) {
      out.push(el('p', 'wm-card-hint', s.superpowerNote));
    } else {
      const inf = el('div', 'wm-card-inf');
      ([0, 1] as const).forEach((i) => {
        const box = el('div', `wm-inf-box ${i === 0 ? 'a' : 'b'}${st.influence[i] > 0 ? ' on' : ''}`);
        box.append(el('span', 'wm-inf-side', sideName(i)), el('b', '', String(st.influence[i])));
        inf.appendChild(box);
      });
      out.push(inf);

      const ctrl = el('div', `wm-card-ctrl ${this.sideClass(st.controller)}`);
      ctrl.append(el('i', 'wm-chip'), st.controller === null ? s.uncontrolled : s.controlledBy(sideName(st.controller)));
      out.push(ctrl);
      if (st.controller !== null && st.flipMargin !== undefined) {
        out.push(el('div', 'wm-card-flip', s.flip(sideName(st.controller === 0 ? 1 : 0), st.flipMargin)));
      }
    }

    const links = this.neighboursOf(id);
    if (links.length) {
      out.push(el('div', 'wm-card-h', `${s.neighbours} · ${links.length}`));
      const list = el('ul', 'wm-card-nb');
      for (const l of links) {
        const n = scenario.countries.find((x) => x.id === l.id)!;
        const li = el('li', l.kind);
        li.append(
          el('i', `wm-chip ${this.sideClass(this.state.countries[l.id]?.controller)}`),
          el('span', 'wm-nb-name', n.name[this.lang]),
          el('span', 'wm-nb-kind', s[l.kind]),
        );
        list.appendChild(li);
      }
      out.push(list);
    }
    if (!this.pinned) out.push(el('footer', 'wm-card-hint', s.hintSelect));
    return out;
  }

  private areaLinks(parent: string, active?: string): HTMLElement {
    const nav = el('div', 'wm-area-links');
    const areas = scoringAreas(this.pack.scenario).filter(a => a.id === parent || a.parentId === parent);
    for (const a of areas) {
      const button = el('button', a.id === active ? 'on' : '', a.name[this.lang] + (i18n("计分")));
      button.type = 'button'; button.dataset.area = a.id; button.disabled = !this.pinned;
      button.setAttribute('aria-pressed', String(a.id === active)); nav.append(button);
    }
    nav.append(el('small', '', i18n("东南亚仍计入亚洲全区")));
    return nav;
  }

  private region(id: string): Node[] {
    const s = STRINGS[this.lang];
    const { scenario } = this.pack;
    const r = scoringAreas(scenario).find((x) => x.id === id);
    if (!r) return [];
    const members = areaMembers(scenario, id);
    const style = this.styles.get(r.parentId ?? id);
    const out: Node[] = [this.header(r.name, [...(style ? [regionBadge(style, this.lang)] : []), s.countries(members.length)])];
    if (scoringAreas(scenario).some(a => a.parentId === (r.parentId ?? id))) out.push(this.areaLinks(r.parentId ?? id, id));
    const status = this.state.regions[id]?.status;
    const scoring = this.state.regions[id]?.scoring;
    ([0, 1] as const).forEach((i) => {
      const held = members.filter((c) => this.state.countries[c.id]?.controller === i);
      const row = el('div', `wm-region-row ${i === 0 ? 'a' : 'b'}`);
      const text = el('div', 'wm-region-text');
      text.append(
        el('b', '', scenario.sides[i].name[this.lang]),
        el('span', '', s.controls(scoring?.sides[i].held ?? held.length, scoring?.sides[i].keys ?? held.filter((c) => isScoringBattleground(c, this.state)).length)),
      );
      row.append(el('i', `wm-chip ${i === 0 ? 'a' : 'b'}`), text, el('span', 'wm-region-status', scoring ? scoring.winner === i ? (i18n("直接获胜")) : `${scoring.totals[i]} VP` : status?.[i] || s.noStatus));
      out.push(row);
    });
    for (const note of scoring?.notes ?? []) out.push(el('p', 'wm-card-hint', note[this.lang]));
    if (!this.pinned) out.push(el('footer', 'wm-card-hint', `${s.hintSelect} · ${s.hintRegion}`));
    return out;
  }
}
