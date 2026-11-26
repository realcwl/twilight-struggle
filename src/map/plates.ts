import { text as displayText } from '../i18n/index.js';
// Country nodes: the primary thing a player reads. One token per country, drawn as DOM over the canvas
// so text stays crisp. A node always shows its stability and both influence values, zeros included,
// and at its right end the mark of its region: a character up close, a sliver of the region's colour
// from far away.
// Scoring battlegrounds wear crossed rifles, a gold rim and a red stability badge.
// A country one side controls stands on a plinth of that side's colour, a little wider than the token,
// so that who holds it reads at a glance at every zoom.
// Above them sits the country's name when there is room for names, and its flag when there is not:
// zooming in turns the flags into names. From far away the token narrows to fit the room the board
// layout keeps for each node, so the whole world reads at the same density as a close view.
// Node positions come from the map pack, which already keeps them from overlapping.
import * as THREE from 'three';
import { BATTLE_MARK } from './battleMark';
import { flagMarkup } from './flags';
import { type LoadedPack, sampleHeight } from './pack';
import { regionStyles } from './regionStyle';
import { el } from './strings';
import type { Lang, Localized, MapState, SideIndex } from './types';

/** Width the board layout keeps free for every node, in world units (NODE_W in tools/mapgen). */
const SLOT = 3.2;
// Width of a token's cells (stability, both influences, region mark) at scale 1, in px: as roomy as it
// likes, and as tight as it can be while its numbers still read. map.css interpolates between the two
// with --tight, and the widths it gives the cells must add up to these.
const ROOMY = 91;
const TIGHT = 40;
/** Below this the numbers stop being legible, so on a small window tokens overlap a little instead. */
const MIN_SCALE = 0.6;
/** The slab a controlled country stands on; map.css sizes it to the token and colours it by the side. */
const PLINTH = '<svg viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true"><path d="M6 0.5H94L99.4 11.5H0.6Z"/></svg>';

type Plate = {
  id: string;
  index: number;
  root: HTMLDivElement;
  name: HTMLDivElement;
  infA: HTMLSpanElement;
  infB: HTMLSpanElement;
  /** The region cell and what it says in each language. Superpowers belong to no region and have none. */
  mark?: { cell: HTMLSpanElement; text: Localized };
  x: number;
  z: number;
  ground: number;
  key: boolean;
  baseKey: boolean;
  superpower?: SideIndex;
  area: number;
  shown: boolean;
  /** Showing its name (otherwise its flag). */
  named: boolean;
  sx: number;
  sy: number;
};

export class Plates {
  readonly root: HTMLDivElement;
  private readonly plates: Plate[] = [];
  private readonly order: Plate[];
  private readonly v = new THREE.Vector3();
  private focusIds = new Set<string>();
  private fit = '';
  private tight = '';
  private upp = 0;
  private settle = 0;

  constructor(parent: HTMLElement, private readonly loaded: LoadedPack, relief: number) {
    this.root = el('div', 'wm-plates');
    parent.appendChild(this.root);
    const { pack } = loaded;
    const styles = regionStyles(pack.scenario.regions);
    pack.scenario.countries.forEach((c, i) => {
      const meta = pack.countries[i];
      const region = c.region === null ? undefined : styles.get(c.region);
      const root = el('div', 'wm-plate' + (c.key ? ' key' : '') + (c.superpower !== undefined ? ' superpower' : ''));
      root.dataset.id = c.id;
      const name = el('div', 'wm-plate-name');
      const flag = el('div', 'wm-flag');
      flag.innerHTML = displayText(flagMarkup(c.id));
      const body = el('div', 'wm-plate-body');
      const infA = el('span', 'wm-inf a', '0');
      const stab = el('span', 'wm-stab', String(c.stability));
      const infB = el('span', 'wm-inf b', '0');
      let mark: Plate['mark'];
      if (c.superpower !== undefined) body.append(el('span', 'wm-power-symbol', '★'));
      else {
        // first in the token, so that the rest of it is drawn over the plinth
        const plinth = el('i', 'wm-plinth');
        plinth.innerHTML = displayText(PLINTH);
        root.append(plinth);
        body.append(stab, infA, infB);
        if (region) {
          mark = { cell: el('span', 'wm-mark'), text: region.mark };
          root.dataset.region = c.region!;
          root.style.setProperty('--region', region.color);
          body.append(mark.cell);
        }
      }
      root.append(name, flag, body);
      if (c.key) {
        const battle = el('i', 'wm-battle');
        battle.innerHTML = displayText(BATTLE_MARK);
        root.append(battle);
      }
      this.root.appendChild(root);
      this.plates.push({
        id: c.id,
        index: meta.index,
        root,
        name,
        infA,
        infB,
        mark,
        x: meta.node[0],
        z: meta.node[1],
        ground: sampleHeight(loaded, meta.node[0], meta.node[1]) * relief,
        key: c.key,
        baseKey: c.key,
        superpower: c.superpower,
        area: meta.area,
        shown: true,
        named: false,
        sx: 0,
        sy: 0,
      });
    });
    // Names are placed in this order, so when two would overlap the more important country keeps its name.
    this.order = [...this.plates].sort((a, b) => Number(b.key) - Number(a.key) || b.area - a.area);
  }

  setLanguage(lang: Lang): void {
    this.loaded.pack.scenario.countries.forEach((c, i) => {
      const p = this.plates[i];
      p.name.textContent = displayText(c.name[lang]);
      if (!p.mark) return;
      p.mark.cell.textContent = displayText(p.mark.text[lang]);
      // one CJK character fills the cell; a two-letter Latin mark is set smaller to fit it
      p.mark.cell.classList.toggle('wide', [...p.mark.text[lang]].length > 1);
    });
  }

  setState(state: MapState): void {
    let reorder = false;
    for (const p of this.plates) {
      const s = state.countries[p.id];
      const key = s?.scoringKey ?? p.baseKey;
      if (p.key !== key) {
        p.key = key;
        reorder = true;
        p.root.classList.toggle('key', key);
        if (key) {
          const battle = el('i', 'wm-battle');
          battle.innerHTML = displayText(BATTLE_MARK);
          p.root.append(battle);
        } else p.root.querySelector('.wm-battle')?.remove();
      }
      const a = p.superpower === undefined ? s?.influence[0] ?? 0 : 0;
      const b = p.superpower === undefined ? s?.influence[1] ?? 0 : 0;
      p.infA.textContent = displayText(String(a));
      p.infB.textContent = displayText(String(b));
      p.infA.classList.toggle('on', a > 0);
      p.infB.classList.toggle('on', b > 0);
      const ctrl = p.superpower ?? s?.controller ?? null;
      p.root.classList.toggle('ctrl-a', ctrl === 0);
      p.root.classList.toggle('ctrl-b', ctrl === 1);
    }
    if (reorder) this.order.sort((a, b) => Number(b.key) - Number(a.key) || b.area - a.area);
  }

  /**
   * Marks which nodes belong to the current focus so the rest can recede. `expanded` is the one
   * country in focus, if any: its node shows itself in full even from far away.
   */
  setFocus(primary: Set<string> | null, secondary: Set<string> | null, expanded: string | null = null): void {
    this.root.classList.toggle('focused', primary !== null);
    this.focusIds = new Set([...(primary ?? []), ...(secondary ?? [])]);
    for (const p of this.plates) {
      p.root.classList.toggle('primary', primary?.has(p.id) ?? false);
      p.root.classList.toggle('secondary', secondary?.has(p.id) ?? false);
      p.root.classList.toggle('expanded', p.id === expanded);
    }
  }

  setTargets(ids: Set<string>): void {
    for (const p of this.plates) p.root.classList.toggle('target', ids.has(p.id));
  }

  countryAt(target: EventTarget | null): string | null {
    const node = target instanceof Element ? target.closest<HTMLElement>('.wm-plate') : null;
    return node?.dataset.id ?? null;
  }

  update(
    camera: THREE.Camera,
    width: number,
    height: number,
    zoom: number,
    globalness: number,
    liftOf: (index: number) => number,
    liftHeight: number,
    unitsPerPixel: number,
    /** Of the copies of a world x (the map repeats east-west), the one nearest the view. */
    nearX: (x: number) => number,
  ): void {
    // ---- size. A token wants to be `roomy`; it gets what the board has room for.
    const t = Math.min(1, Math.max(0, zoom / 0.55));
    const roomy = 1.1 - 0.3 * t * t * (3 - 2 * t);
    const room = SLOT / unitsPerPixel - 5; // px across one node's share of the board, less its outline
    let scale = roomy;
    let tight = 0;
    if (room < ROOMY * roomy) {
      if (room >= TIGHT * roomy) tight = (ROOMY * roomy - room) / ((ROOMY - TIGHT) * roomy);
      else {
        tight = 1;
        scale = Math.max(MIN_SCALE, room / TIGHT);
      }
    }
    const fit = scale.toFixed(3);
    const tightness = tight.toFixed(2);
    if (fit !== this.fit) this.root.style.setProperty('--fit', (this.fit = fit));
    if (tightness !== this.tight) this.root.style.setProperty('--tight', (this.tight = tightness));
    // While the zoom is changing, sizes follow it exactly; the eased transitions in map.css are for
    // changes of state (a node coming into focus, a flag giving way to a name) and would lag behind here.
    if (Math.abs(unitsPerPixel - this.upp) > this.upp * 1e-4) {
      this.upp = unitsPerPixel;
      this.root.classList.add('zooming');
      clearTimeout(this.settle);
      this.settle = window.setTimeout(() => this.root.classList.remove('zooming'), 140);
    }

    for (const p of this.plates) {
      this.v.set(nearX(p.x), p.ground + liftOf(p.index) * liftHeight, p.z).project(camera);
      const sx = (this.v.x * 0.5 + 0.5) * width;
      const sy = (-this.v.y * 0.5 + 0.5) * height;
      const visible = this.v.z < 1 && sx > -80 && sx < width + 80 && sy > -60 && sy < height + 60;
      if (visible !== p.shown) {
        p.shown = visible;
        p.root.style.display = visible ? '' : 'none';
      }
      if (!visible) continue;
      p.sx = sx;
      p.sy = sy;
      p.root.style.transform = `translate3d(${sx.toFixed(1)}px,${sy.toFixed(1)}px,0)`;
      // Where tokens crowd, the one further north lies on top: a flag reaches up from its token, and
      // this way it slips behind the neighbour above instead of covering that neighbour's numbers.
      p.root.style.zIndex = String(20000 - Math.round(sy));
    }

    // ---- names. In the global view every node flies its flag. In the local view it shows its name,
    // unless that would run into a more important neighbour's, in which case it keeps the flag.
    const local = globalness <= 0.5;
    const placed: { x: number; y: number; w: number }[] = [];
    const ranked = local && this.focusIds.size
      ? [...this.order].sort((a, b) => Number(this.focusIds.has(b.id)) - Number(this.focusIds.has(a.id)))
      : this.order;
    for (const p of ranked) {
      if (!p.shown) continue;
      let named = false;
      if (local) {
        const text = p.name.textContent ?? '';
        // CJK glyphs are about a full em wide, Latin ones about half
        const w = [...text].reduce((sum, ch) => sum + (ch.charCodeAt(0) > 0x2e7f ? 15 : 8.5), 0) * scale + 8;
        const y = p.sy - 24 * scale;
        named = !placed.some((o) => Math.abs(o.x - p.sx) < (o.w + w) / 2 && Math.abs(o.y - y) < 16 * scale);
        if (named) placed.push({ x: p.sx, y, w });
      }
      if (named !== p.named) {
        p.named = named;
        p.root.classList.toggle('named', named);
      }
    }
  }
}
