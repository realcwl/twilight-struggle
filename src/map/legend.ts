// The key to the region marks on the nodes: one row per scoring region, in a corner of the map.
// A row stands for its region. The map treats pointing at a row, clicking it or double-clicking it
// exactly as it treats the region's own land seen from far away.
import { regionBadge, regionStyles } from './regionStyle';
import { scoringAreas } from './scoringAreas';
import { STRINGS, el } from './strings';
import type { Lang, Scenario } from './types';

export class RegionLegend {
  readonly root: HTMLDivElement;
  private focus: string | null = null;

  constructor(parent: HTMLElement, private readonly scenario: Scenario) {
    this.root = el('div', 'wm-legend');
    parent.appendChild(this.root);
  }

  setLanguage(lang: Lang): void {
    const styles = regionStyles(this.scenario.regions);
    this.root.replaceChildren(el('div', 'wm-legend-h', STRINGS[lang].regions));
    for (const r of scoringAreas(this.scenario)) {
      const row = el('button', 'wm-legend-row' + (r.parentId ? ' nested' : ''));
      row.type = 'button';
      row.dataset.region = r.id;
      row.append(regionBadge(styles.get(r.parentId ?? r.id)!, lang), el('span', 'wm-legend-name', (r.parentId ? '↳ ' : '') + r.name[lang]));
      this.root.appendChild(row);
    }
    this.setFocus(this.focus);
  }

  /** Marks the row of the region in focus, or of the region the country in focus belongs to. */
  setFocus(regionId: string | null): void {
    this.focus = regionId;
    for (const row of this.root.querySelectorAll<HTMLElement>('.wm-legend-row')) {
      row.classList.toggle('on', row.dataset.region === regionId);
    }
  }

  /** The region whose row the pointer is on; null elsewhere on the legend; undefined off the legend. */
  regionAt(target: EventTarget | null): string | null | undefined {
    if (!(target instanceof Element) || !this.root.contains(target)) return undefined;
    return target.closest<HTMLElement>('.wm-legend-row')?.dataset.region ?? null;
  }
}
