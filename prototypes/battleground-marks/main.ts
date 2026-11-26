// Battle marks: ten small pictures a battleground country could wear on its node, in place of the
// gold ring and gold stability badge that say "battleground" today. Switchable on the live map, and
// laid side by side on a sheet (G).
//
// The page runs the game's own map module unchanged and adds each mark from outside: two empty
// elements on every battleground token (one painted under the token, one over it) and a stylesheet.
// Nothing in src/ knows about this folder.
import { WorldMap } from '../../src/map/WorldMap';
import type { MapState, Scenario } from '../../src/map/types';
import { deriveCountry } from '../../src/sandbox/placeholderRule';
import { DEFS, MARKS, type Mark, PICKED, PLACE_NAME, RECOMMENDED } from './marks';

/** The private parts of the map module this prototype reaches into. */
type Internals = {
  stage: HTMLDivElement;
  rig: { globalness: number; flyHome(): void; flyToBox(box: [number, number, number, number], opts?: { maxZoom?: number; instant?: boolean }): void };
};
type Size = 's' | 'm' | 'l';

const params = new URLSearchParams(location.search);
const SIZES: Record<Size, { label: string; scale: number }> = { s: { label: '小', scale: 0.84 }, m: { label: '中', scale: 1 }, l: { label: '大', scale: 1.22 } };

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
};

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The sandbox's own "demo" filler situation (same seed, same numbers), or an empty board. */
function situation(scenario: Scenario, filled: boolean): MapState {
  const rand = seeded(1947);
  const lean: Record<string, number> = { camerica: 0.95, samerica: 0.7, europe: 0.6, mideast: 0.5, africa: 0.4, asia: 0.42 };
  const state: MapState = { countries: {}, regions: {} };
  for (const c of scenario.countries) {
    const influence: [number, number] = [0, 0];
    if (c.superpower !== undefined || c.region === null) {
      state.countries[c.id] = { influence, controller: c.superpower ?? null };
      continue;
    }
    if (rand() >= 0.3) {
      const first = rand() < (lean[c.region] ?? 0.5) ? 0 : 1;
      const strong = Math.round(rand() * (c.stability + 2));
      const weak = rand() < 0.45 ? Math.round(rand() * 2) : 0;
      influence[first] = strong;
      influence[first === 0 ? 1 : 0] = weak;
    }
    state.countries[c.id] = filled ? deriveCountry(influence, c.stability, 'auto') : { influence: [0, 0], controller: null };
  }
  for (const r of scenario.regions) state.regions[r.id] = { status: ['—', '—'] };
  return state;
}

/** Puts a mark's picture into the two elements a token keeps for it. */
function wear(under: HTMLElement, over: HTMLElement, mark: Mark | undefined): void {
  const svg = (m: Mark): string => `<svg viewBox="0 0 ${m.place === 'halo' ? '48 48' : m.place === 'foot' ? '40 20' : '32 32'}">${m.svg}</svg>`;
  under.innerHTML = mark?.place === 'halo' ? svg(mark) : '';
  over.innerHTML = mark && mark.place !== 'halo' ? svg(mark) : '';
  under.dataset.place = over.dataset.place = mark?.place ?? '';
}

async function start(): Promise<void> {
  document.body.insertAdjacentHTML('afterbegin', DEFS);
  const map = await WorldMap.create(document.getElementById('map')!, '/maps/coldwar', { lang: 'zh' });
  const inner = map as unknown as Internals;
  const { pack } = map;
  const { scenario } = pack;
  const stage = inner.stage;

  let filled = params.get('state') !== 'empty';
  map.setState(situation(scenario, filled));

  // ---------------------------------------------------------------- what a mark hangs on
  // Every battleground token gets one element painted under it and one painted over it.
  const worn: { under: HTMLElement; over: HTMLElement }[] = [];
  const stagger = seeded(7);
  for (const c of scenario.countries) {
    if (!c.key) continue;
    const plate = stage.querySelector<HTMLElement>(`.wm-plate[data-id="${c.id}"]`);
    if (!plate) continue;
    const under = el('i', 'bm bm-under');
    const over = el('i', 'bm bm-over');
    // so that 29 flames do not flicker in step
    plate.style.setProperty('--bm-d', stagger().toFixed(2));
    plate.prepend(under);
    plate.append(over);
    worn.push({ under, over });
  }

  // ---------------------------------------------------------------- which mark is on
  const ids = ['00', ...MARKS.map((m) => m.id)];
  const byId = new Map(MARKS.map((m) => [m.id, m]));
  let current = ids.includes((params.get('v') ?? '').padStart(2, '0')) ? (params.get('v') ?? '').padStart(2, '0') : '00';
  let gold = params.get('gold') === '1';
  let size: Size = (['s', 'm', 'l'] as const).find((s) => s === params.get('size')) ?? 'm';

  const apply = (): void => {
    const mark = byId.get(current);
    stage.classList.toggle('bm-on', !!mark);
    stage.classList.toggle('bm-gold', gold);
    stage.dataset.bm = current;
    stage.style.setProperty('--bm-size', String(SIZES[size].scale));
    for (const w of worn) wear(w.under, w.over, mark);
    for (const b of tabs.querySelectorAll<HTMLButtonElement>('button')) b.classList.toggle('on', b.dataset.v === current);
    descName.textContent = mark ? `${mark.id} ${mark.name}${mark.id === PICKED ? '（已选定，已在游戏里）' : ''}` : '00 旧样式';
    descWhere.textContent = mark ? PLACE_NAME[mark.place] + (mark.alive ? ' · 会动' : '') : '';
    descWhere.hidden = !mark;
    descBlurb.textContent = mark ? mark.blurb : '对照组：接入标志之前的样子，战场国靠金色外圈和金色的稳定度圆章来区分。';
    descRisk.textContent = mark ? `代价：${mark.risk}` : '';
    goldBtn.textContent = gold ? '金圈：保留' : '金圈：去掉';
    goldBtn.disabled = !mark;
    sizeBtn.textContent = `大小：${SIZES[size].label}`;
    sizeBtn.disabled = !mark;
    const q = new URLSearchParams(location.search);
    const set = (key: string, value: string | null): void => (value === null ? q.delete(key) : q.set(key, value));
    set('v', mark ? current : null);
    set('gold', gold ? '1' : null);
    set('size', size === 'm' ? null : size);
    set('state', filled ? null : 'empty');
    // the sheet is asked for once, by whoever made the link; a reload should not bring it back
    q.delete('sheet');
    history.replaceState(null, '', `${location.pathname}${q.size ? `?${q}` : ''}`);
  };
  const pick = (id: string): void => {
    if (!ids.includes(id)) return;
    current = id;
    apply();
  };

  // ---------------------------------------------------------------- page chrome
  const ui = document.getElementById('ui')!;
  if (params.get('ui') === '0') ui.classList.add('bare');

  const bar = el('div', 'bp-bar');
  const tabs = el('div', 'bp-tabs');
  for (const id of ids) {
    const mark = byId.get(id);
    const b = el('button');
    b.dataset.v = id;
    const pic = el('i', 'bp-tab-pic');
    if (mark) pic.innerHTML = `<svg viewBox="0 0 ${mark.place === 'halo' ? '48 48' : mark.place === 'foot' ? '40 20' : '32 32'}">${mark.svg}</svg>`;
    b.append(pic, el('b', '', id), el('span', '', mark?.name ?? '旧样式'));
    b.title = mark?.blurb ?? '接入标志之前的样子';
    b.addEventListener('click', () => pick(id));
    tabs.append(b);
  }
  const desc = el('div', 'bp-desc');
  const descName = el('b', 'bp-desc-name');
  const descWhere = el('span', 'bp-desc-where');
  const descBlurb = el('span', 'bp-desc-blurb');
  const descRisk = el('span', 'bp-desc-risk');
  desc.append(descName, descWhere, descBlurb, descRisk);
  bar.append(tabs, desc);

  const nodeBox = (list: string[], pad = 3): [number, number, number, number] => {
    const pts = pack.countries.filter((c) => list.includes(c.id)).map((c) => c.node);
    return [Math.min(...pts.map((p) => p[0])) - pad, Math.min(...pts.map((p) => p[1])) - pad, Math.max(...pts.map((p) => p[0])) + pad, Math.max(...pts.map((p) => p[1])) + pad];
  };
  const inRegions = (...regions: string[]): string[] => scenario.countries.filter((c) => c.region && regions.includes(c.region) && c.id !== 'can').map((c) => c.id);
  const views: Record<string, { label: string; go: (instant: boolean) => void }> = {
    world: { label: '全球', go: () => inner.rig.flyHome() },
    europe: { label: '欧洲', go: (instant) => inner.rig.flyToBox(nodeBox(inRegions('europe')), { instant }) },
    close: { label: '特写', go: (instant) => inner.rig.flyToBox(nodeBox(['frg', 'gdr', 'pol', 'fra', 'ita'], 1.2), { instant }) },
    mideast: { label: '中东', go: (instant) => inner.rig.flyToBox(nodeBox(inRegions('mideast')), { instant }) },
    asia: { label: '亚洲', go: (instant) => inner.rig.flyToBox(nodeBox(inRegions('asia')), { instant }) },
    africa: { label: '非洲', go: (instant) => inner.rig.flyToBox(nodeBox(inRegions('africa')), { instant }) },
    americas: { label: '美洲', go: (instant) => inner.rig.flyToBox(nodeBox(inRegions('camerica', 'samerica')), { instant }) },
  };
  const side = el('div', 'bp-side');
  const row = el('div', 'bp-row');
  for (const v of Object.values(views)) {
    const b = el('button', 'bp-pill', v.label);
    b.addEventListener('click', () => v.go(false));
    row.append(b);
  }
  const stateBtn = el('button', 'bp-pill');
  stateBtn.title = '在演示局势和空盘之间切换：标志要和蓝、红的控制圈放在一起看';
  const paintState = (): void => void (stateBtn.textContent = filled ? '局势：演示' : '局势：空盘');
  stateBtn.addEventListener('click', () => {
    filled = !filled;
    map.setState(situation(scenario, filled));
    paintState();
    apply();
  });
  paintState();
  const goldBtn = el('button', 'bp-pill');
  goldBtn.title = '标志之外，要不要把原来的金色外圈和金色圆章也留着（B）';
  goldBtn.addEventListener('click', () => {
    gold = !gold;
    apply();
  });
  const sizeBtn = el('button', 'bp-pill');
  sizeBtn.title = '标志的大小：小、中、大（S）';
  const nextSize = (): void => {
    size = size === 's' ? 'm' : size === 'm' ? 'l' : 's';
    apply();
  };
  sizeBtn.addEventListener('click', nextSize);
  const sheetBtn = el('button', 'bp-pill bp-strong', '十个并排看');
  sheetBtn.title = '把十个标志放在一张表上比较（G）';
  const row2 = el('div', 'bp-row');
  row2.append(stateBtn, goldBtn, sizeBtn, sheetBtn);
  side.append(row, row2, el('div', 'bp-hint', '← → 切换 · 1–9、0 直达 · ` 旧样式 · G 并排 · B 金圈 · S 大小 · H 藏界面'));
  ui.append(side, bar);

  // ---------------------------------------------------------------- the sheet: all ten side by side
  // Each card shows the picture large, then the same token three ways: close and uncontrolled, at
  // middle distance and held by one side, far away and held by the other. The tokens are copies of a
  // real one from the map, so they are drawn by the game's own stylesheet.
  const sheet = el('div', 'bp-sheet');
  sheet.hidden = true;
  const source = stage.querySelector<HTMLElement>('.wm-plate[data-id="fra"]') ?? stage.querySelector<HTMLElement>('.wm-plate.key')!;
  const sideColours = `--side-a:${scenario.sides[0].color};--side-b:${scenario.sides[1].color}`;
  const mock = (mark: Mark | undefined, o: { fit: number; tight: number; named: boolean; ctrl: '' | 'a' | 'b'; inf: [number, number]; note: string }): HTMLElement => {
    const cell = el('div', `bp-mock${mark ? ' bm-on' : ''}`);
    cell.dataset.bm = mark?.id ?? '00';
    cell.style.cssText = `${sideColours};--bm-size:1`;
    const plates = el('div', 'wm-plates');
    plates.style.setProperty('--fit', String(o.fit));
    plates.style.setProperty('--tight', String(o.tight));
    const plate = source.cloneNode(true) as HTMLElement;
    plate.removeAttribute('style');
    plate.style.setProperty('--region', source.style.getPropertyValue('--region'));
    plate.style.setProperty('--bm-d', '0.3');
    plate.className = `wm-plate key${o.named ? ' named' : ''}${o.ctrl ? ` ctrl-${o.ctrl}` : ''}`;
    const [a, b] = [plate.querySelector<HTMLElement>('.wm-inf.a')!, plate.querySelector<HTMLElement>('.wm-inf.b')!];
    a.textContent = String(o.inf[0]);
    b.textContent = String(o.inf[1]);
    a.classList.toggle('on', o.inf[0] > 0);
    b.classList.toggle('on', o.inf[1] > 0);
    wear(plate.querySelector<HTMLElement>('.bm-under')!, plate.querySelector<HTMLElement>('.bm-over')!, mark);
    plates.append(plate);
    cell.append(plates, el('span', 'bp-mock-note', o.note));
    return cell;
  };
  const trio = (mark: Mark | undefined): HTMLElement => {
    const wrap = el('div', 'bp-trio');
    wrap.append(
      mock(mark, { fit: 1, tight: 0, named: true, ctrl: '', inf: [1, 0], note: '近 · 无人控制' }),
      mock(mark, { fit: 0.95, tight: 0.55, named: false, ctrl: 'a', inf: [4, 1], note: '中 · 美国控制' }),
      mock(mark, { fit: 0.82, tight: 1, named: false, ctrl: 'b', inf: [0, 3], note: '远 · 苏联控制' }),
    );
    return wrap;
  };
  const head = el('header', 'bp-sheet-head');
  const title = el('div', 'bp-sheet-title');
  title.append(el('h1', '', '战场国标志 · 十个方案'), el('p', '', '每张卡片：放大的标志，然后是同一块铭牌在三种距离、三种控制状态下的样子。点一张卡片，回到地图上看它。'));
  const now = el('div', 'bp-now');
  now.append(el('b', '', '00 旧样式：金圈 + 金色圆章'), trio(undefined));
  const close = el('button', 'bp-x', '×');
  close.title = '关闭（G 或 Esc）';
  head.append(title, now, close);
  const grid = el('div', 'bp-grid');
  for (const m of MARKS) {
    const card = el('button', 'bp-card');
    card.dataset.v = m.id;
    const top = el('div', 'bp-card-top');
    const art = el('i', `bp-art ${m.place}`);
    art.innerHTML = `<svg viewBox="0 0 ${m.place === 'halo' ? '48 48' : m.place === 'foot' ? '40 20' : '32 32'}">${m.svg}</svg>`;
    const text = el('div', 'bp-card-text');
    const name = el('div', 'bp-card-name');
    name.append(el('b', '', m.id), el('span', '', m.name), el('em', '', PLACE_NAME[m.place] + (m.alive ? ' · 会动' : '')));
    if (m.id === RECOMMENDED) name.append(el('strong', '', '我的推荐'));
    if (m.id === PICKED) name.append(el('strong', 'picked', '已选定'));
    text.append(name, el('p', '', m.blurb), el('p', 'risk', `代价：${m.risk}`));
    top.append(art, text);
    card.append(top, trio(m));
    card.addEventListener('click', () => {
      pick(m.id);
      showSheet(false);
    });
    grid.append(card);
  }
  sheet.append(head, grid);
  document.body.append(sheet);
  const showSheet = (on: boolean): void => {
    sheet.hidden = !on;
    for (const c of grid.querySelectorAll<HTMLElement>('.bp-card')) c.classList.toggle('on', c.dataset.v === current);
  };
  sheetBtn.addEventListener('click', () => showSheet(true));
  close.addEventListener('click', () => showSheet(false));

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') pick(ids[(ids.indexOf(current) + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length]);
    else if (e.code.startsWith('Digit')) pick(String(Number(e.code.slice(5)) || 10).padStart(2, '0'));
    else if (e.key === '`') pick('00');
    else if (key === 'g') showSheet(sheet.hidden);
    else if (e.key === 'Escape' && !sheet.hidden) showSheet(false);
    else if (key === 'h') ui.classList.toggle('bare');
    else if (key === 'b' && current !== '00') {
      gold = !gold;
      apply();
    } else if (key === 's' && current !== '00') nextSize();
  });

  apply();
  views[params.get('view') ?? '']?.go(true);
  if (params.get('sheet') === '1') showSheet(true);

  document.documentElement.classList.add('ready');
  // a handle for poking at the page from the console, and for taking screenshots
  Object.assign(window, { proto: { map, pick, views, showSheet, get current() { return current; } } });
}

start().catch((err) => {
  console.error(err);
  document.body.append(el('pre', 'bp-error', err instanceof Error ? err.message : String(err)));
});
