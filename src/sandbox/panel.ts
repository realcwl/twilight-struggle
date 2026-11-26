import { LANGUAGES, t as i18n, translateDictionary, text as displayText } from '../i18n/index.js';
// The sandbox panel: set any country's influence and controller by hand, jump around the map,
// and load a few filler situations that exercise every display state.
import type { WorldMap } from '../map/WorldMap';
import { battleGlyph } from '../map/battleMark';
import { regionBadge, regionStyles } from '../map/regionStyle';
import { el, STRINGS } from '../map/strings';
import type { Lang, MapState } from '../map/types';
import type { Cell, PresetName } from './main';
import type { Override } from './placeholderRule';

type Options = {
  lang: Lang;
  cells: Record<string, Cell>;
  onChange: () => void;
  onPreset: (name: PresetName) => void;
  onLanguage: (lang: Lang) => void;
};

const T = {
  zh: {
    title: '地图沙盒',
    tagline: '手动设置局势，检查地图的每一种显示状态。这里没有规则。',
    presets: '局势预设',
    empty: '清空',
    demo: '示例',
    random: '随机',
    states: '五种状态',
    country: '选中国家',
    pick: '在地图上点击一个国家，或从下面的列表里选。',
    stability: '稳定度',
    key: '战场国',
    controller: '控制方',
    auto: '自动',
    none: '无',
    autoNote: '“自动”按沙盒的占位规则推算：一方影响力领先达到稳定度即控制。',
    list: '全部国家',
    search: '搜索国家',
    view: '视图',
    world: '全球视角',
    fullscreen: '全屏',
    openPanel: '打开沙盒面板',
    closePanel: '收起沙盒面板',
    tilt: '移轴景深',
    flavor: '国家风物（墨线小画与悬停粒子）',
    targets: '标出相邻国（预留接口示例）',
    stats: (fps: number, view: string) => `${fps.toFixed(0)} 帧/秒 · ${view === 'global' ? '全球视角' : '局部视角'}`,
    regionHint: '飞到该大区',
  },
  en: {
    title: 'Map Sandbox',
    tagline: 'Set the situation by hand and check every display state of the map. There are no rules here.',
    presets: 'Situations',
    empty: 'Clear',
    demo: 'Demo',
    random: 'Random',
    states: 'Five states',
    country: 'Selected country',
    pick: 'Click a country on the map, or pick one from the list below.',
    stability: 'Stability',
    key: 'Battleground',
    controller: 'Controller',
    auto: 'Auto',
    none: 'None',
    autoNote: '"Auto" uses the sandbox stand-in rule: a side controls when its lead reaches the stability.',
    list: 'All countries',
    search: 'Search countries',
    view: 'View',
    world: 'Whole world',
    fullscreen: 'Full screen',
    openPanel: 'Open the sandbox panel',
    closePanel: 'Close the sandbox panel',
    tilt: 'Tilt-shift blur',
    flavor: 'Country flavour (ink vignettes, drifting particles)',
    targets: 'Mark neighbours (reserved interface demo)',
    stats: (fps: number, view: string) => `${fps.toFixed(0)} fps · ${view} view`,
    regionHint: 'Fly to this region',
  },
 es: translateDictionary({
    title: '地图沙盒',
    tagline: '手动设置局势，检查地图的每一种显示状态。这里没有规则。',
    presets: '局势预设',
    empty: '清空',
    demo: '示例',
    random: '随机',
    states: '五种状态',
    country: '选中国家',
    pick: '在地图上点击一个国家，或从下面的列表里选。',
    stability: '稳定度',
    key: '战场国',
    controller: '控制方',
    auto: '自动',
    none: '无',
    autoNote: '“自动”按沙盒的占位规则推算：一方影响力领先达到稳定度即控制。',
    list: '全部国家',
    search: '搜索国家',
    view: '视图',
    world: '全球视角',
    fullscreen: '全屏',
    openPanel: '打开沙盒面板',
    closePanel: '收起沙盒面板',
    tilt: '移轴景深',
    flavor: '国家风物（墨线小画与悬停粒子）',
    targets: '标出相邻国（预留接口示例）',
    stats: (fps: number, view: string) => `${fps.toFixed(0)} 帧/秒 · ${view === 'global' ? '全球视角' : '局部视角'}`,
    regionHint: '飞到该大区',
  }, 'es') };

export class Panel {
  private lang: Lang;
  private state: MapState = { countries: {}, regions: {} };
  private selected: string | null = null;
  private filter = '';
  private markTargets = false;
  private flavor = true;
  private readonly head = el('header', 'sb-head');
  private readonly presets = el('section', 'sb-section');
  private readonly editor = el('section', 'sb-section sb-editor');
  private readonly view = el('section', 'sb-section');
  private readonly listHead = el('div', 'sb-list-head');
  private readonly list = el('div', 'sb-list');
  private readonly stats = el('div', 'sb-stats');
  private readonly tab = el('button', 'sb-tab');
  private open = false;
  private readonly rows = new Map<string, { row: HTMLElement; a: HTMLElement; b: HTMLElement; chip: HTMLElement; name: HTMLElement }>();
  private readonly regionStatus = new Map<string, HTMLElement>();

  constructor(
    root: HTMLElement,
    private readonly map: WorldMap,
    private readonly opts: Options,
  ) {
    this.lang = opts.lang;
    const scroll = el('div', 'sb-scroll');
    const listSection = el('section', 'sb-section sb-list-section');
    listSection.append(this.listHead, this.list);
    scroll.append(this.presets, this.editor, this.view, listSection);
    this.tab.type = 'button';
    this.tab.appendChild(el('i'));
    this.tab.addEventListener('click', () => this.setOpen(!this.open));
    root.append(this.tab, this.head, scroll, this.stats);
    try {
      this.open = localStorage.getItem('sandbox.panel') === 'open';
    } catch {
      // storage can be unavailable (private windows); the drawer just starts shut
    }
    map.on('select', (target) => {
      this.selected = target?.kind === 'country' ? target.id : null;
      this.renderEditor();
      this.markRows();
      this.applyTargets();
    });
    this.build();
    setInterval(() => {
      const s = this.map.stats;
      this.stats.textContent = displayText(T[this.lang].stats(s.fps, s.view));
    }, 500);
  }

  /** Slides the drawer in or out. The map underneath keeps the whole window either way. */
  private setOpen(open: boolean): void {
    this.open = open;
    document.body.classList.toggle('panel-open', open);
    const label = open ? T[this.lang].closePanel : T[this.lang].openPanel;
    this.tab.setAttribute('aria-label', label);
    this.tab.title = displayText(label);
    this.tab.setAttribute('aria-expanded', String(open));
    try {
      localStorage.setItem('sandbox.panel', open ? 'open' : 'shut');
    } catch {
      // not remembered, nothing else to do
    }
  }

  render(state: MapState): void {
    this.state = state;
    this.renderEditor();
    for (const c of this.map.pack.scenario.countries) {
      const r = this.rows.get(c.id);
      const s = state.countries[c.id];
      if (!r || !s) continue;
      r.a.textContent = displayText(c.superpower === undefined ? String(s.influence[0]) : '');
      r.b.textContent = displayText(c.superpower === undefined ? String(s.influence[1]) : '');
      r.a.classList.toggle('on', s.influence[0] > 0);
      r.b.classList.toggle('on', s.influence[1] > 0);
      r.chip.className = `wm-chip ${s.controller === 0 ? 'a' : s.controller === 1 ? 'b' : 'none'}`;
    }
    for (const [id, node] of this.regionStatus) {
      const st = state.regions[id]?.status;
      node.replaceChildren(el('span', 'sb-status a', st?.[0] ?? ''), el('span', 'sb-status b', st?.[1] ?? ''));
    }
  }

  private button(label: string, onClick: () => void, className = 'sb-btn'): HTMLButtonElement {
    const b = el('button', className, label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  /** Builds everything that depends on the language. */
  private build(): void {
    const t = T[this.lang];
    const { scenario } = this.map.pack;

    const langBtn = document.createElement('select');
    langBtn.className = 'sb-btn sb-lang';
    langBtn.setAttribute('aria-label', i18n('语言'));
    for (const language of LANGUAGES) {
      const option = document.createElement('option');
      option.value = language.id; option.textContent = language.label;
      option.selected = language.id === this.lang; langBtn.append(option);
    }
    langBtn.onchange = () => this.opts.onLanguage(langBtn.value as Lang);
    const titles = el('div', 'sb-titles');
    titles.append(el('h1', '', t.title), el('div', 'sb-scenario', scenario.name[this.lang]));
    this.head.replaceChildren(titles, langBtn);

    const presetRow = el('div', 'sb-row');
    for (const name of ['empty', 'demo', 'random', 'states'] as const) {
      presetRow.appendChild(this.button(t[name], () => this.opts.onPreset(name)));
    }
    this.presets.replaceChildren(el('p', 'sb-tagline', t.tagline), el('h2', '', t.presets), presetRow);

    const tilt = el('label', 'sb-check');
    const tiltBox = el('input');
    tiltBox.type = 'checkbox';
    tiltBox.name = 'tilt-shift';
    tiltBox.checked = true;
    tiltBox.addEventListener('change', () => this.map.setTiltShift(tiltBox.checked));
    tilt.append(tiltBox, t.tilt);
    const flavor = el('label', 'sb-check');
    const flavorBox = el('input');
    flavorBox.type = 'checkbox';
    flavorBox.name = 'country-flavour';
    flavorBox.checked = this.flavor;
    flavorBox.addEventListener('change', () => {
      this.flavor = flavorBox.checked;
      this.map.setFlavor(this.flavor);
    });
    flavor.append(flavorBox, t.flavor);
    const mark = el('label', 'sb-check');
    const markBox = el('input');
    markBox.type = 'checkbox';
    markBox.name = 'mark-neighbours';
    markBox.checked = this.markTargets;
    markBox.addEventListener('change', () => {
      this.markTargets = markBox.checked;
      this.applyTargets();
    });
    mark.append(markBox, t.targets);
    const viewRow = el('div', 'sb-row');
    viewRow.appendChild(this.button(t.world, () => this.map.flyTo('world')));
    viewRow.appendChild(
      this.button(t.fullscreen, () => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      }),
    );
    this.view.replaceChildren(el('h2', '', t.view), viewRow, tilt, flavor, mark);

    const search = el('input', 'sb-search');
    search.type = 'search';
    search.name = 'country-search';
    search.setAttribute('aria-label', t.search);
    search.placeholder = displayText(t.search);
    search.value = this.filter;
    search.addEventListener('input', () => {
      this.filter = search.value.trim().toLowerCase();
      this.applyFilter();
    });
    this.listHead.replaceChildren(el('h2', '', t.list), search);

    this.rows.clear();
    this.regionStatus.clear();
    this.list.replaceChildren();
    const groups = [...scenario.regions, { id: null, name: { zh: '超级大国', en: 'Superpowers' , es: translateDictionary('超级大国', 'es') } }];
    const styles = regionStyles(scenario.regions);
    for (const r of groups) {
      if (!scenario.countries.some((c) => c.region === r.id)) continue;
      const group = el('div', 'sb-group');
      group.dataset.region = r.id ?? 'superpowers';
      const head = this.button('', () => {
        this.map.select(null);
        this.map.flyTo(r.id ?? 'world');
      }, 'sb-region');
      head.title = displayText(t.regionHint);
      const status = el('span', 'sb-statuses');
      const style = r.id === null ? undefined : styles.get(r.id);
      if (style) head.append(regionBadge(style, this.lang));
      head.append(el('span', 'sb-region-name', r.name[this.lang]), status);
      if (r.id !== null) this.regionStatus.set(r.id, status);
      group.appendChild(head);
      for (const c of scenario.countries.filter((x) => x.region === r.id)) {
        const row = this.button('', () => {
          this.map.select({ kind: 'country', id: c.id });
          this.map.flyTo(c.id);
        }, 'sb-country');
        row.dataset.search = `${c.name.zh} ${c.name.en} ${c.id}`.toLowerCase();
        const chip = el('i', 'wm-chip none');
        const name = el('span', 'sb-country-name', c.name[this.lang]);
        if (c.key) name.appendChild(battleGlyph());
        const a = el('span', 'sb-num a', '0');
        const b = el('span', 'sb-num b', '0');
        row.append(chip, name, a, b);
        this.rows.set(c.id, { row, a, b, chip, name });
        group.appendChild(row);
      }
      this.list.appendChild(group);
    }
    this.render(this.state);
    this.markRows();
    this.applyFilter();
    this.setOpen(this.open);
  }

  private applyFilter(): void {
    for (const group of this.list.querySelectorAll<HTMLElement>('.sb-group')) {
      let any = false;
      for (const row of group.querySelectorAll<HTMLElement>('.sb-country')) {
        const hit = !this.filter || (row.dataset.search ?? '').includes(this.filter);
        row.hidden = !hit;
        any ||= hit;
      }
      group.hidden = !any;
    }
  }

  private markRows(): void {
    for (const [id, r] of this.rows) r.row.classList.toggle('selected', id === this.selected);
  }

  private applyTargets(): void {
    if (!this.markTargets || !this.selected) {
      this.map.setHighlights([]);
      return;
    }
    const near = this.map.pack.scenario.links
      .filter((l) => l.a === this.selected || l.b === this.selected)
      .map((l) => (l.a === this.selected ? l.b : l.a));
    this.map.setHighlights(near, 'target');
  }

  private renderEditor(): void {
    const t = T[this.lang];
    const { scenario } = this.map.pack;
    const c = this.selected ? scenario.countries.find((x) => x.id === this.selected) : undefined;
    if (!c) {
      this.editor.replaceChildren(el('h2', '', t.country), el('p', 'sb-hint', t.pick));
      return;
    }
    const cell = this.opts.cells[c.id];
    const title = el('div', 'sb-edit-title', c.name[this.lang]);
    if (c.superpower !== undefined) {
      this.editor.replaceChildren(
        el('h2', '', STRINGS[this.lang].superpower),
        title,
        el('p', 'sb-hint', STRINGS[this.lang].superpowerNote),
      );
      return;
    }
    const region = scenario.regions.find((r) => r.id === c.region)!;
    const meta = el('div', 'sb-edit-meta');
    meta.appendChild(el('span', '', `${region.name[this.lang]} · ${t.stability} ${c.stability}`));
    if (c.key) {
      const key = el('span', 'wm-key');
      key.append(battleGlyph(), t.key);
      meta.appendChild(key);
    }

    const steppers = el('div', 'sb-steppers');
    ([0, 1] as const).forEach((i) => {
      const box = el('div', `sb-stepper ${i === 0 ? 'a' : 'b'}`);
      const value = el('b', '', String(cell.influence[i]));
      const change = (d: number): void => {
        cell.influence[i] = Math.min(20, Math.max(0, cell.influence[i] + d));
        this.opts.onChange();
      };
      const minus = this.button('−', () => change(-1), 'sb-step');
      const plus = this.button('+', () => change(1), 'sb-step');
      minus.setAttribute('aria-label', `${scenario.sides[i].name[this.lang]} −1`);
      plus.setAttribute('aria-label', `${scenario.sides[i].name[this.lang]} +1`);
      box.append(el('span', 'sb-stepper-side', scenario.sides[i].name[this.lang]), minus, value, plus);
      steppers.appendChild(box);
    });

    // the full name when it fits a quarter of the control, otherwise the short form
    const sideLabel = (i: 0 | 1): string => {
      const side = scenario.sides[i];
      return side.name[this.lang].length <= 6 ? side.name[this.lang] : side.short[this.lang];
    };
    const seg = el('div', 'sb-seg');
    const choices: [Override, string, string][] = [
      ['auto', t.auto, ''],
      ['none', t.none, ''],
      [0, sideLabel(0), 'a'],
      [1, sideLabel(1), 'b'],
    ];
    for (const [value, label, cls] of choices) {
      const b = this.button(label, () => {
        cell.override = value;
        this.opts.onChange();
      }, `sb-seg-btn ${cls}${cell.override === value ? ' on' : ''}`);
      b.setAttribute('aria-pressed', String(cell.override === value));
      seg.appendChild(b);
    }
    this.editor.replaceChildren(
      el('h2', '', t.country),
      title,
      meta,
      steppers,
      el('div', 'sb-label', t.controller),
      seg,
      el('p', 'sb-hint', t.autoNote),
    );
  }
}
