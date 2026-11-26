// Region identity: ten ways to show which region a country belongs to, switchable on the live map.
//
// The page runs the game's own map module unchanged and adds each treatment from outside: classes and
// a few extra elements on the node tokens, one transparent layer over the terrain, and a recoloured
// copy of the link network. Nothing in src/ knows about this folder.
import type * as THREE from 'three';
import { WorldMap } from '../../src/map/WorldMap';
import type { MapState, Scenario } from '../../src/map/types';
import { deriveCountry } from '../../src/sandbox/placeholderRule';
import { GroundOverlay } from './ground';
import { type LinkInternals, LinkTint } from './linkTint';
import { RECOMMENDED, REGIONS, VARIANTS } from './variants';

type Target = { kind: 'country' | 'region'; id: string } | null;

/** The private parts of the map module this prototype reaches into. */
type Internals = {
  stage: HTMLDivElement;
  terrain: { group: THREE.Group; uniforms: Record<string, THREE.IUniform> };
  links: LinkInternals;
  rig: { globalness: number; flyHome(): void; flyToBox(box: [number, number, number, number], opts?: { maxZoom?: number; instant?: boolean }): void };
  hovered: Target;
  selected: Target;
  applyFocus(): void;
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

async function start(): Promise<void> {
  const map = await WorldMap.create(document.getElementById('map')!, '/maps/coldwar', { lang: 'zh' });
  const inner = map as unknown as Internals;
  const { pack } = map;
  const { scenario } = pack;
  const stage = inner.stage;
  const regionOf = new Map(scenario.countries.map((c) => [c.id, c.region]));

  let filled = params.get('state') !== 'empty';
  map.setState(situation(scenario, filled));

  // ---------------------------------------------------------------- what each treatment hangs on
  // Every token learns its region; the two treatments that need an element of their own get one.
  for (const plate of stage.querySelectorAll<HTMLElement>('.wm-plate')) {
    const region = regionOf.get(plate.dataset.id ?? '');
    const meta = region ? REGIONS[region] : undefined;
    if (!region || !meta) continue;
    plate.dataset.region = region;
    plate.style.setProperty('--rc', meta.color);
    const body = plate.querySelector('.wm-plate-body')!;
    plate.insertBefore(el('i', 'ri-base'), body);
    body.append(el('span', 'ri-chip', meta.letter));
  }
  const ground = new GroundOverlay(pack, inner.terrain, inner.links.groundPaths);
  const linkTint = new LinkTint(pack, inner.links);

  // ---------------------------------------------------------------- which treatments are on
  const valid = new Set(VARIANTS.map((v) => v.id));
  const active = new Set((params.get('v') ?? '').split(',').map((s) => s.trim().padStart(2, '0')).filter((s) => valid.has(s) && s !== '00'));
  let last = [...active].pop() ?? '00';
  let stack = active.size > 1;

  const apply = (): void => {
    for (const v of VARIANTS) stage.classList.toggle(`ri-${v.id}`, active.has(v.id));
    stage.classList.toggle('ri-on', active.size > 0);
    ui.classList.toggle('ri-on', active.size > 0);
    ui.classList.toggle('ri-hatch', active.has('08'));
    ui.classList.toggle('ri-letter', active.has('04'));
    ground.set({ wash: +active.has('06'), outline: +active.has('07'), hatch: +active.has('08'), mat: +active.has('10') });
    linkTint.setEnabled(active.has('09'));
    for (const b of tabs.querySelectorAll<HTMLButtonElement>('button')) {
      const id = b.dataset.v!;
      b.classList.toggle('on', id === '00' ? active.size === 0 : active.has(id));
    }
    const v = VARIANTS.find((x) => x.id === (active.size ? last : '00'))!;
    const others = [...active].filter((id) => id !== v.id).sort();
    descName.textContent = `${v.id} ${v.name}` + (others.length ? `　＋ ${others.join(' ')}` : '');
    descWhere.textContent = v.where === '—' ? '' : `画在${v.where}上`;
    descWhere.hidden = v.where === '—';
    descBlurb.textContent = v.blurb;
    descRisk.textContent = v.risk ? `代价：${v.risk}` : '';
    stackBox.checked = stack;
    const q = new URLSearchParams(location.search);
    if (active.size) q.set('v', [...active].sort().join(','));
    else q.delete('v');
    history.replaceState(null, '', `${location.pathname}${q.size ? `?${q}` : ''}`);
  };

  const pick = (id: string, toggle: boolean): void => {
    if (id === '00') active.clear();
    else if (toggle) {
      if (active.has(id)) active.delete(id);
      else active.add(id);
    } else {
      active.clear();
      active.add(id);
    }
    last = active.has(id) ? id : ([...active].pop() ?? '00');
    apply();
  };

  // ---------------------------------------------------------------- page chrome
  const ui = document.getElementById('ui')!;
  if (params.get('ui') === '0') ui.classList.add('bare');

  const bar = el('div', 'ri-bar');
  const tabs = el('div', 'ri-tabs');
  for (const v of VARIANTS) {
    const b = el('button');
    b.dataset.v = v.id;
    b.append(el('b', '', v.id), el('span', '', v.name));
    b.title = v.blurb;
    b.addEventListener('click', (e) => pick(v.id, stack || e.shiftKey));
    tabs.append(b);
  }
  const desc = el('div', 'ri-desc');
  const descName = el('b', 'ri-desc-name');
  const descWhere = el('span', 'ri-desc-where');
  const descBlurb = el('span', 'ri-desc-blurb');
  const descRisk = el('span', 'ri-desc-risk');
  desc.append(descName, descWhere, descBlurb, descRisk);
  const tools = el('div', 'ri-tools');
  const stackLabel = el('label', 'ri-check');
  const stackBox = el('input');
  stackBox.type = 'checkbox';
  stackBox.addEventListener('change', () => {
    stack = stackBox.checked;
  });
  stackLabel.append(stackBox, el('span', '', '叠加'));
  stackLabel.title = '勾上后点方案是加减，不是替换（也可以按住 Shift 点）';
  const recommend = el('button', 'ri-pill', `推荐组合 ${RECOMMENDED.join(' + ')}`);
  recommend.addEventListener('click', () => {
    active.clear();
    for (const id of RECOMMENDED) active.add(id);
    last = RECOMMENDED[0];
    stack = true;
    apply();
  });
  tools.append(stackLabel, recommend);
  bar.append(tabs, desc, tools);

  // views and situation
  const side = el('div', 'ri-side');
  const nodeBox = (ids: string[], pad = 3): [number, number, number, number] => {
    const pts = pack.countries.filter((c) => ids.includes(c.id)).map((c) => c.node);
    return [Math.min(...pts.map((p) => p[0])) - pad, Math.min(...pts.map((p) => p[1])) - pad, Math.max(...pts.map((p) => p[0])) + pad, Math.max(...pts.map((p) => p[1])) + pad];
  };
  const inRegions = (...regions: string[]): string[] => scenario.countries.filter((c) => c.region && regions.includes(c.region) && c.id !== 'can').map((c) => c.id);
  const views: Record<string, { label: string; go: (instant: boolean) => void }> = {
    world: { label: '全球', go: () => inner.rig.flyHome() },
    europe: { label: '欧洲', go: (instant) => inner.rig.flyToBox(nodeBox(inRegions('europe')), { instant }) },
    junction: { label: '欧·中东·非交界', go: (instant) => inner.rig.flyToBox(nodeBox(['ita', 'grc', 'tur', 'syr', 'egy', 'lby', 'tun', 'dza', 'isr', 'lbn'], 1.5), { instant }) },
    africa: { label: '非洲', go: (instant) => inner.rig.flyToBox(nodeBox(inRegions('africa')), { instant }) },
    asia: { label: '亚洲', go: (instant) => inner.rig.flyToBox(nodeBox(inRegions('asia')), { instant }) },
    americas: { label: '美洲', go: (instant) => inner.rig.flyToBox(nodeBox(inRegions('camerica', 'samerica')), { instant }) },
  };
  const viewRow = el('div', 'ri-row');
  for (const [, v] of Object.entries(views)) {
    const b = el('button', 'ri-pill', v.label);
    b.addEventListener('click', () => v.go(false));
    viewRow.append(b);
  }
  const stateBtn = el('button', 'ri-pill');
  const paintState = (): void => {
    stateBtn.textContent = filled ? '局势：演示' : '局势：空盘';
    stateBtn.title = '在演示局势和空盘之间切换，看大区色和控制方的蓝、红会不会打架';
  };
  stateBtn.addEventListener('click', () => {
    filled = !filled;
    map.setState(situation(scenario, filled));
    paintState();
  });
  paintState();
  viewRow.append(stateBtn);
  side.append(viewRow, el('div', 'ri-hint', '← → 切换 · 1–9、0 直达 · ` 回到现状 · Shift 叠加 · H 藏界面'));

  // The legend is the one piece of this chrome that would ship with whichever treatment is chosen.
  const legend = el('div', 'ri-legend');
  legend.append(el('div', 'ri-legend-h', '大区'));
  for (const r of scenario.regions) {
    const meta = REGIONS[r.id];
    if (!meta) continue;
    const row = el('button', 'ri-legend-row');
    row.style.setProperty('--rc', meta.color);
    const count = scenario.countries.filter((c) => c.region === r.id).length;
    row.append(el('i', `ri-swatch p${meta.code}`), el('span', 'ri-legend-letter', meta.letter), el('span', 'ri-legend-name', r.name.zh), el('span', 'ri-legend-n', String(count)));
    // pointing at a region in the legend lights it up on the map, as pointing at its land does from far away
    row.addEventListener('pointerenter', () => {
      inner.hovered = { kind: 'region', id: r.id };
      if (!inner.selected) {
        inner.applyFocus();
        tint(inner.hovered);
      }
    });
    row.addEventListener('pointerleave', () => {
      inner.hovered = null;
      if (!inner.selected) {
        inner.applyFocus();
        tint(null);
      }
    });
    row.addEventListener('click', () => map.flyTo(r.id));
    legend.append(row);
  }
  ui.append(side, legend, bar);

  // the info card of whatever is in focus carries its region's colour
  const tint = (t: Target): void => {
    const region = t ? (t.kind === 'region' ? t.id : regionOf.get(t.id)) : null;
    const meta = region ? REGIONS[region] : undefined;
    if (meta) stage.style.setProperty('--focus-rc', meta.color);
    else stage.style.removeProperty('--focus-rc');
  };
  map.on('hover', (t) => tint(map.selection ?? t));
  map.on('select', (t) => tint(t));

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const order = VARIANTS.map((v) => v.id);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const at = order.indexOf(active.size ? last : '00');
      pick(order[(at + (e.key === 'ArrowRight' ? 1 : order.length - 1)) % order.length], false);
    } else if (e.code.startsWith('Digit')) {
      const n = Number(e.code.slice(5));
      pick(String(n === 0 ? 10 : n).padStart(2, '0'), stack || e.shiftKey);
    } else if (e.key === '`') pick('00', false);
    else if (e.key === 'h' || e.key === 'H') ui.classList.toggle('bare');
  });

  apply();
  views[params.get('view') ?? '']?.go(true);

  let prev = performance.now();
  const frame = (now: number): void => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (now - prev) / 1000));
    prev = now;
    ground.update(dt);
    linkTint.update(stage.clientWidth, stage.clientHeight, inner.rig.globalness);
  };
  requestAnimationFrame(frame);

  document.documentElement.classList.add('ready');
  // a handle for poking at the page from the console, and for taking the screenshots in shots/
  Object.assign(window, { proto: { map, pick, views, active } });
}

start().catch((err) => {
  console.error(err);
  document.body.append(el('pre', 'ri-error', err instanceof Error ? err.message : String(err)));
});
