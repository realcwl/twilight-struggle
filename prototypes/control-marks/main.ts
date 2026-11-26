// Control marks: ten clearer ways to show that a country is controlled by one side, switchable on the
// live map and laid side by side on a sheet (G).
//
// The page runs the game's own map module unchanged and adds each sign from outside: two elements on
// every token (one painted under it, one over it), a layer of discs between the map and the tokens,
// two batches of coloured lines among the map's links, and a stylesheet. Nothing in src/ knows about
// this folder.
import { LineBatch } from '../../src/map/lineBatch';
import { WorldMap } from '../../src/map/WorldMap';
import type { MapState, Scenario, SideIndex } from '../../src/map/types';
import { deriveCountry } from '../../src/sandbox/placeholderRule';
import { RECOMMENDED, VARIANTS, type Variant } from './variants';

/** The private parts of the map module this prototype reaches into. */
type Internals = {
  stage: HTMLDivElement;
  rig: { globalness: number; flyHome(): void; flyToBox(box: [number, number, number, number], opts?: { maxZoom?: number; instant?: boolean }): void };
  links: { group: { add(...objects: unknown[]): void }; groundPaths: Map<string, number[][]> };
};

const params = new URLSearchParams(location.search);

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

/** East Asia as it stood in the screenshot that asked for this page; the rest is filler. */
const PINNED: Record<string, [number, number]> = { jpn: [1, 0], kor: [3, 0], prk: [0, 3], twn: [0, 0], phl: [1, 0] };

/** A filler situation: the sandbox's "demo" recipe, with East Asia pinned. */
function situation(scenario: Scenario, seed: number): MapState {
  const rand = seeded(seed);
  const lean: Record<string, number> = { camerica: 0.95, samerica: 0.7, europe: 0.6, mideast: 0.5, africa: 0.4, asia: 0.42 };
  const state: MapState = { countries: {}, regions: {} };
  for (const c of scenario.countries) {
    let influence: [number, number] = [0, 0];
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
    if (PINNED[c.id]) influence = [...PINNED[c.id]];
    state.countries[c.id] = deriveCountry(influence, c.stability, 'auto');
  }
  for (const r of scenario.regions) state.regions[r.id] = { status: ['—', '—'] };
  return state;
}

/** The shapes a token keeps beneath it: a swallowtail banner, a plinth, a shield. style.css shows one. */
const UNDER =
  '<svg class="cm-banner" viewBox="0 0 20 16" preserveAspectRatio="none"><path d="M1 0H19V15L10 10.4L1 15Z"/><path class="shine" d="M2.6 0H5.4V11.2L2.6 12.7Z"/></svg>' +
  '<svg class="cm-plinth" viewBox="0 0 100 12" preserveAspectRatio="none"><path d="M6 0.5H94L99.4 11.5H0.6Z"/></svg>' +
  '<svg class="cm-shield" viewBox="0 0 100 50" preserveAspectRatio="none"><path d="M1 1H99V27C99 37 72 44 50 49C28 44 1 37 1 27Z"/></svg>';

const hex = (colour: string): number => parseInt(colour.slice(1), 16);
/** A colour moved towards white by t (0..1). */
const lighten = (colour: number, t: number): number => {
  const ch = (shift: number): number => {
    const v = (colour >> shift) & 255;
    return Math.round(v + (255 - v) * t) << shift;
  };
  return ch(16) | ch(8) | ch(0);
};

async function start(): Promise<void> {
  const map = await WorldMap.create(document.getElementById('map')!, '/maps/coldwar', { lang: 'zh' });
  const inner = map as unknown as Internals;
  const { pack } = map;
  const { scenario } = pack;
  const stage = inner.stage;
  const platesRoot = stage.querySelector<HTMLElement>('.wm-plates')!;

  let seed = Number(params.get('seed')) || 1947;
  let state = situation(scenario, seed);
  map.setState(state);

  // ---------------------------------------------------------------- what the signs hang on
  type Extra = { id: string; plate: HTMLElement; sym: HTMLElement; num: HTMLElement; pool: HTMLElement; at: string; shown: string };
  const extras: Extra[] = [];
  const ground = el('div', 'cm-ground');
  stage.insertBefore(ground, platesRoot);
  for (const c of scenario.countries) {
    if (c.superpower !== undefined) continue;
    const plate = stage.querySelector<HTMLElement>(`.wm-plate[data-id="${c.id}"]`);
    if (!plate) continue;
    const under = el('i', 'cm cm-under');
    under.innerHTML = UNDER;
    const over = el('i', 'cm cm-over');
    const sym = el('b', 'cm-sym');
    const num = el('b', 'cm-num');
    over.append(sym, num);
    plate.prepend(under);
    plate.append(over);
    const pool = el('i', 'cm-pool');
    ground.append(pool);
    extras.push({ id: c.id, plate, sym, num, pool, at: '', shown: '' });
  }

  // 07: links with the same side at both ends, in that side's colour inside a white casing
  const bloc = scenario.sides.map((s) => {
    const pair = { halo: new LineBatch({ color: 0xffffff }, 8), line: new LineBatch({ color: lighten(hex(s.color), 0.16) }, 9) };
    inner.links.group.add(pair.halo.mesh, pair.line.mesh);
    return pair;
  });

  const superpowerOf = new Map(scenario.countries.filter((c) => c.superpower !== undefined).map((c) => [c.id, c.superpower as SideIndex]));
  const ctrlOf = (id: string): SideIndex | null => superpowerOf.get(id) ?? state.countries[id]?.controller ?? null;

  // ---------------------------------------------------------------- which variant is on
  const ids = ['00', ...VARIANTS.map((v) => v.id)];
  const byId = new Map(VARIANTS.map((v) => [v.id, v]));
  const asked = (params.get('v') ?? '').padStart(2, '0');
  let current = ids.includes(asked) ? asked : '00';
  let plain = params.get('deco') === 'plain';
  let quiet = params.get('quiet') === '1';

  /** Brings everything the page added into line with the situation and the variant. */
  const sync = (): void => {
    for (const x of extras) {
      const c = ctrlOf(x.id);
      x.sym.textContent = c === null ? '' : scenario.sides[c].short.zh;
      x.num.textContent = c === null ? '' : String(state.countries[x.id].influence[c]);
      x.pool.className = `cm-pool${c === 0 ? ' a' : c === 1 ? ' b' : ''}`;
    }
    bloc.forEach((pair, side) => {
      const paths = current !== '07' ? [] : scenario.links.filter((l) => ctrlOf(l.a) === side && ctrlOf(l.b) === side).flatMap((l) => inner.links.groundPaths.get([l.a, l.b].sort().join('|')) ?? []);
      pair.halo.setPaths(paths);
      pair.line.setPaths(paths);
    });
  };

  const NOW = { name: '00 现在的样子', blurb: '对照组：游戏里现在的样子。控制靠国土染色，加上铭牌上一道夹在金圈里面的细色线。', risk: '' };
  const apply = (): void => {
    const v = byId.get(current);
    stage.dataset.cm = current;
    stage.classList.toggle('cm-plain', plain);
    stage.classList.toggle('cm-quiet', quiet || current === '10');
    sync();
    for (const b of tabs.querySelectorAll<HTMLButtonElement>('button')) b.classList.toggle('on', b.dataset.v === current);
    descName.textContent = v ? `${v.id} ${v.name}` : NOW.name;
    descWhere.textContent = v?.where ?? '';
    descWhere.hidden = !v;
    descBlurb.textContent = v ? v.blurb : NOW.blurb;
    descRisk.textContent = v ? `代价：${v.risk}` : '';
    plainBtn.textContent = plain ? '战场装饰：只留步枪' : '战场装饰：游戏原样';
    quietBtn.textContent = quiet || current === '10' ? '未控制：只描数字' : '未控制：满色格';
    quietBtn.disabled = current === '10';
    refreshScenes();
    const q = new URLSearchParams(location.search);
    const set = (key: string, value: string | null): void => (value === null ? q.delete(key) : q.set(key, value));
    set('v', v ? current : null);
    set('deco', plain ? 'plain' : null);
    set('quiet', quiet ? '1' : null);
    set('seed', seed === 1947 ? null : String(seed));
    // the sheet is asked for once, by whoever made the link; a reload should not bring it back
    q.delete('sheet');
    history.replaceState(null, '', `${location.pathname}${q.size ? `?${q}` : ''}`);
  };
  const pick = (id: string): void => {
    if (!ids.includes(id)) return;
    current = id;
    apply();
  };

  // ---------------------------------------------------------------- per frame
  // The discs follow their tokens, and the coloured links keep the width of the network they lie on.
  // The map's own frame runs first (it asked for its frame first), so nothing here lags by a frame.
  const tick = (): void => {
    requestAnimationFrame(tick);
    if (current === '06') {
      ground.style.setProperty('--fit', platesRoot.style.getPropertyValue('--fit') || '1');
      ground.style.setProperty('--tight', platesRoot.style.getPropertyValue('--tight') || '0');
      for (const x of extras) {
        const at = x.plate.style.transform;
        if (at !== x.at) x.pool.style.transform = `${(x.at = at)} translate(-50%, -50%) translateY(2px)`;
        const shown = x.plate.style.display;
        if (shown !== x.shown) x.pool.style.visibility = (x.shown = shown) === 'none' ? 'hidden' : '';
      }
    } else if (current === '07') {
      const width = 3.4 - 0.9 * inner.rig.globalness;
      for (const pair of bloc) {
        pair.halo.setResolution(stage.clientWidth, stage.clientHeight);
        pair.line.setResolution(stage.clientWidth, stage.clientHeight);
        pair.halo.style(width + 4.6, 0.95);
        pair.line.style(width + 1.8, 1);
      }
    }
  };

  // ---------------------------------------------------------------- page chrome
  const ui = document.getElementById('ui')!;
  if (params.get('ui') === '0') ui.classList.add('bare');

  const bar = el('div', 'cp-bar');
  const tabs = el('div', 'cp-tabs');
  for (const id of ids) {
    const v = byId.get(id);
    const b = el('button');
    b.dataset.v = id;
    b.append(el('b', '', id), el('span', '', v?.name ?? '现在'));
    b.title = v?.blurb ?? NOW.blurb;
    b.addEventListener('click', () => pick(id));
    tabs.append(b);
  }
  const desc = el('div', 'cp-desc');
  const descName = el('b', 'cp-desc-name');
  const descWhere = el('span', 'cp-desc-where');
  const descBlurb = el('span', 'cp-desc-blurb');
  const descRisk = el('span', 'cp-desc-risk');
  desc.append(descName, descWhere, descBlurb, descRisk);
  bar.append(tabs, desc);

  const nodeBox = (list: string[], pad = 3): [number, number, number, number] => {
    const pts = pack.countries.filter((c) => list.includes(c.id)).map((c) => c.node);
    return [Math.min(...pts.map((p) => p[0])) - pad, Math.min(...pts.map((p) => p[1])) - pad, Math.max(...pts.map((p) => p[0])) + pad, Math.max(...pts.map((p) => p[1])) + pad];
  };
  const inRegions = (...regions: string[]): string[] => scenario.countries.filter((c) => c.region && regions.includes(c.region) && c.id !== 'can').map((c) => c.id);
  const views: Record<string, { label: string; go: (instant: boolean) => void }> = {
    world: { label: '全球', go: () => inner.rig.flyHome() },
    eastasia: { label: '东亚（截图处）', go: (instant) => inner.rig.flyToBox(nodeBox(['jpn', 'kor', 'prk', 'twn', 'phl'], 2.4), { instant }) },
    europe: { label: '欧洲', go: (instant) => inner.rig.flyToBox(nodeBox(inRegions('europe')), { instant }) },
    mideast: { label: '中东', go: (instant) => inner.rig.flyToBox(nodeBox(inRegions('mideast')), { instant }) },
    asia: { label: '亚洲', go: (instant) => inner.rig.flyToBox(nodeBox(inRegions('asia')), { instant }) },
    africa: { label: '非洲', go: (instant) => inner.rig.flyToBox(nodeBox(inRegions('africa')), { instant }) },
    americas: { label: '美洲', go: (instant) => inner.rig.flyToBox(nodeBox(inRegions('camerica', 'samerica')), { instant }) },
  };
  const side = el('div', 'cp-side');
  const row = el('div', 'cp-row');
  for (const v of Object.values(views)) {
    const b = el('button', 'cp-pill', v.label);
    b.addEventListener('click', () => v.go(false));
    row.append(b);
  }
  const plainBtn = el('button', 'cp-pill');
  plainBtn.title = '战场国现在有金圈、红色稳定度圆章和步枪三样。切到“只留步枪”，看控制标识不和它们抢颜色时的样子（B）';
  plainBtn.addEventListener('click', () => {
    plain = !plain;
    apply();
  });
  const quietBtn = el('button', 'cp-pill');
  quietBtn.title = '把方案 10 垫在别的方案下面：没控制的影响力只描数字，控制了才整格涂满（P）';
  quietBtn.addEventListener('click', () => {
    quiet = !quiet;
    apply();
  });
  const shuffleBtn = el('button', 'cp-pill', '换一局');
  shuffleBtn.title = '换一个随机局势，东亚保持截图里的样子（R）';
  const shuffle = (): void => {
    seed += 1;
    state = situation(scenario, seed);
    map.setState(state);
    apply();
  };
  shuffleBtn.addEventListener('click', shuffle);
  const sheetBtn = el('button', 'cp-pill cp-strong', '十个并排看');
  sheetBtn.title = '把十个方案放在一张表上比较（G）';
  const row2 = el('div', 'cp-row');
  row2.append(plainBtn, quietBtn, shuffleBtn, sheetBtn);
  side.append(row, row2, el('div', 'cp-hint', '← → 切换 · 1–9、0 直达 · ` 现在的样子 · G 并排 · B 战场装饰 · P 未控制 · R 换一局 · H 藏界面'));
  ui.append(side, bar);

  // ---------------------------------------------------------------- the sheet: all ten side by side
  // Each card shows the same five tokens twice, up close and from far away: an ordinary country and a
  // battleground held by the first side, a battleground with influence but no control, and a
  // battleground and an ordinary country held by the second side. The tokens are copies of real ones
  // from the map, so they are drawn by the game's own stylesheet.
  const SLOTS: { id: string; ctrl: SideIndex | null; inf: [number, number] }[] = [
    { id: 'phl', ctrl: 0, inf: [2, 0] },
    { id: 'kor', ctrl: 0, inf: [3, 0] },
    { id: 'jpn', ctrl: null, inf: [1, 0] },
    { id: 'prk', ctrl: 1, inf: [0, 3] },
    { id: 'vnm', ctrl: 1, inf: [1, 2] },
  ];
  const sideColours = `--side-a:${scenario.sides[0].color};--side-b:${scenario.sides[1].color}`;
  const scenes: { node: HTMLElement; id: string }[] = [];
  const scene = (id: string, far: boolean): HTMLElement => {
    const node = el('div', `cp-scene${far ? ' far' : ''}`);
    node.dataset.cm = id;
    node.style.cssText = sideColours;
    const fit = far ? '0.8' : '1';
    const tight = far ? '1' : '0';
    const xs = far ? [12, 31, 50, 69, 88] : [11, 30.5, 50, 69.5, 89];
    const pools = el('div', 'cm-ground');
    pools.style.setProperty('--fit', fit);
    pools.style.setProperty('--tight', tight);
    const wire = (from: number, to: number, cls = '', colour = ''): HTMLElement => {
      const w = el('i', `cp-wire${cls}`);
      w.style.left = `${xs[from]}%`;
      w.style.width = `${xs[to] - xs[from]}%`;
      if (colour) w.style.background = colour;
      return w;
    };
    const tint = (s: SideIndex): string => `#${lighten(hex(scenario.sides[s].color), 0.16).toString(16).padStart(6, '0')}`;
    const plates = el('div', 'wm-plates');
    plates.style.setProperty('--fit', fit);
    plates.style.setProperty('--tight', tight);
    SLOTS.forEach((slot, i) => {
      const source = stage.querySelector<HTMLElement>(`.wm-plate[data-id="${slot.id}"]`)!;
      const plate = source.cloneNode(true) as HTMLElement;
      plate.removeAttribute('style');
      plate.style.setProperty('--region', source.style.getPropertyValue('--region'));
      plate.className = `wm-plate${source.classList.contains('key') ? ' key' : ''}${far ? '' : ' named'}${slot.ctrl === null ? '' : slot.ctrl === 0 ? ' ctrl-a' : ' ctrl-b'}`;
      const [a, b] = [plate.querySelector<HTMLElement>('.wm-inf.a')!, plate.querySelector<HTMLElement>('.wm-inf.b')!];
      a.textContent = String(slot.inf[0]);
      b.textContent = String(slot.inf[1]);
      a.classList.toggle('on', slot.inf[0] > 0);
      b.classList.toggle('on', slot.inf[1] > 0);
      plate.querySelector<HTMLElement>('.cm-sym')!.textContent = slot.ctrl === null ? '' : scenario.sides[slot.ctrl].short.zh;
      plate.querySelector<HTMLElement>('.cm-num')!.textContent = slot.ctrl === null ? '' : String(slot.inf[slot.ctrl]);
      const holder = el('div', 'cp-slot');
      holder.style.left = `${xs[i]}%`;
      holder.append(plate);
      plates.append(holder);
      const pool = el('i', `cm-pool${slot.ctrl === null ? '' : slot.ctrl === 0 ? ' a' : ' b'}`);
      pool.style.left = `${xs[i]}%`;
      pools.append(pool);
    });
    node.append(pools, wire(0, 4), wire(0, 1, ' bloc', tint(0)), wire(3, 4, ' bloc', tint(1)), plates, el('span', 'cp-scene-note', far ? '拉远' : '拉近'));
    scenes.push({ node, id });
    return node;
  };
  function refreshScenes(): void {
    for (const s of scenes) {
      s.node.classList.toggle('cm-plain', plain);
      s.node.classList.toggle('cm-quiet', quiet || s.id === '10');
    }
    for (const c of document.querySelectorAll<HTMLElement>('.cp-card')) c.classList.toggle('on', c.dataset.v === current);
  }
  const card = (id: string, v: Variant | undefined): HTMLElement => {
    const node = el('button', `cp-card${v ? '' : ' now'}`);
    node.dataset.v = id;
    const name = el('div', 'cp-card-name');
    name.append(el('b', '', id), el('span', '', v?.name ?? '现在的样子'));
    if (v) name.append(el('em', '', v.where));
    if (RECOMMENDED.includes(id)) name.append(el('strong', '', '我的推荐'));
    const pair = el('div', 'cp-scenes');
    pair.append(scene(id, false), scene(id, true));
    node.append(name, el('p', '', v?.blurb ?? NOW.blurb));
    if (v) node.append(el('p', 'risk', `代价：${v.risk}`));
    node.append(pair);
    node.addEventListener('click', () => {
      pick(id);
      showSheet(false);
    });
    return node;
  };
  const sheet = el('div', 'cp-sheet');
  sheet.hidden = true;
  const head = el('header', 'cp-sheet-head');
  const title = el('div', 'cp-sheet-title');
  title.append(el('h1', '', '控制标识 · 十个方案'), el('p', '', '每张卡片是同样五块铭牌，拉近和拉远各一遍。点一张卡片，回到真实地图上看它。'));
  const close = el('button', 'cp-x', '×');
  close.title = '关闭（G 或 Esc）';
  head.append(title, close);
  const legend = el('div', 'cp-legend');
  legend.innerHTML = '<span>从左到右：</span><span><b>菲律宾</b> 普通国，美国控制</span><span><b>韩国</b> 战场国，美国控制</span><span><b>日本</b> 战场国，美国有 1 点但没控制</span><span><b>朝鲜</b> 战场国，苏联控制</span><span><b>越南</b> 普通国，苏联控制，美国还有 1 点</span>';
  const grid = el('div', 'cp-grid');
  grid.append(card('00', undefined));
  for (const v of VARIANTS) grid.append(card(v.id, v));
  sheet.append(head, legend, grid);
  document.body.append(sheet);
  const showSheet = (on: boolean): void => {
    sheet.hidden = !on;
    refreshScenes();
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
    else if (key === 'b') {
      plain = !plain;
      apply();
    } else if (key === 'p' && current !== '10') {
      quiet = !quiet;
      apply();
    } else if (key === 'r') shuffle();
  });

  apply();
  requestAnimationFrame(tick);
  views[params.get('view') ?? '']?.go(true);
  if (params.get('sheet') === '1') showSheet(true);

  document.documentElement.classList.add('ready');
  // a handle for poking at the page from the console, and for taking screenshots
  Object.assign(window, { proto: { map, pick, views, showSheet, get current() { return current; }, get state() { return state; } } });
}

start().catch((err) => {
  console.error(err);
  document.body.append(el('pre', 'cp-error', err instanceof Error ? err.message : String(err)));
});
