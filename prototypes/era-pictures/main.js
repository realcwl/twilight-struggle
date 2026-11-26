// Ten ways to show "which years are we in" as a picture. The stage is the play screen itself (the
// live map and the HUD of src/hud); only the content of the top-left corner is replaced. Every turn
// has one realistic picture of its years (core/time.js); a display is the object that carries the
// ten pictures: a film strip, a contact sheet, a lantern that turns...
//
//   ?v=3        open display 3                 ?g=1       the overview: all ten, three moments each
//   ?t=5&r=3    start at turn 5, round 3       ?s=1       the opponent to move
//   ?clean=1    no toolbar (F toggles)         ?notes=1   the notes panel open
import '../../src/game/game.css';
import './core/core.css';
import { Hud } from '../../src/hud/Hud.ts';
import { HUD_STRINGS } from '../../src/hud/strings.ts';
import { WorldMap } from '../../src/map/WorldMap.ts';
import { COLDWAR_TRACKS } from '../../src/game/tracks.ts';
import { fillerSituation } from '../../src/game/placeholder.ts';
import { cardEl, backEl, fitCard, describe as describeCard } from '../hud-layouts/cards.js';
import { PICS, fill, makeCtx, makeView } from './core/time.js';
import { VARIANTS } from './variants/index.js';

const q = new URLSearchParams(location.search);
const root = document.documentElement;
const game = document.getElementById('game');
const mapEl = document.getElementById('map');
const gallery = document.getElementById('gallery');
const notes = document.getElementById('notes');
const toolbar = document.getElementById('toolbar');
const loading = document.getElementById('loading');

document.body.insertAdjacentHTML('afterbegin', window.CardArt.defs());

const RULES = COLDWAR_TRACKS;
const T = HUD_STRINGS.zh;
const SIDES = [{ name: { zh: '美国' } }, { name: { zh: '苏联' } }];
const ctx = makeCtx(RULES);
const limitOf = (turn) => (turn <= 3 ? 6 : 7);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const S = { turn: clamp(+(q.get('t') ?? 1) || 1, 1, RULES.turns), round: 1, active: q.get('s') === '1' ? 1 : 0, phase: 'action' };
S.round = clamp(+(q.get('r') ?? 1) || 1, 1, limitOf(S.turn));

let hud = null;
let map = null;
let sides = SIDES;
let current = -1;
let live = null; // { mod, el, update, view }
const loaded = new Map();

const hudState = () => ({
  turn: S.turn, round: S.round, phase: S.phase, actionLimit: limitOf(S.turn), active: S.active,
  vp: 2, crisis: 3, milops: [1, 2], milopsRequired: 3, space: [3, 2],
  hand: ['012', '020', '036', '047', '031', '028', '016'], opponentHand: 7, deck: 38,
  discard: ['001', '011', '047'], removed: ['003', '013', '025'], played: null,
});

/* ------------------------------------------------------------------ putting a display up */
async function load(entry) {
  if (!loaded.has(entry.id)) loaded.set(entry.id, (await entry.load()).default);
  return loaded.get(entry.id);
}

/** Builds a display inside a pane and returns how to bring it up to date. */
function put(mod, pane) {
  pane.classList.add('ep-host');
  pane.dataset.ep = mod.id;
  const el = document.createElement('div');
  el.className = `ep-v ep-${mod.id}`;
  pane.appendChild(el);
  const update = mod.mount(el, ctx);
  let prev = null;
  return {
    el,
    draw(view) {
      fill(el, view);
      update(view, prev);
      prev = view;
    },
    remove() {
      el.remove();
      pane.classList.remove('ep-host');
      delete pane.dataset.ep;
    },
  };
}

function render(animate = true) {
  const state = hudState();
  hud.setState(state, animate);
  live?.draw(makeView(state, RULES, T, sides));
  const now = toolbar.querySelector('.tb-now');
  now.textContent = `${RULES.eras.find((e) => S.turn >= e.from && S.turn <= e.to).name.zh} · 回合 ${S.turn}/${RULES.turns} · 行动轮 ${S.round}/${limitOf(S.turn)} · ${S.phase === 'action' ? (S.active === 0 ? '你行动' : '对手行动') : S.phase === 'headline' ? '头条阶段' : '回合结算'}`;
  const url = new URL(location.href);
  url.searchParams.set('t', String(S.turn));
  url.searchParams.set('r', String(S.round));
  history.replaceState(null, '', url);
  root.dataset.turn = String(S.turn);
  root.dataset.round = String(S.round);
}

async function show(i) {
  i = (i + VARIANTS.length) % VARIANTS.length;
  current = i;
  const entry = VARIANTS[i];
  for (const b of toolbar.querySelectorAll('.tb-tabs button')) b.setAttribute('aria-pressed', String(+b.dataset.i === i));
  const url = new URL(location.href);
  url.searchParams.set('v', String(i + 1));
  history.replaceState(null, '', url);
  document.title = `${entry.id} ${entry.name} · 年代画面实验`;
  let mod;
  try {
    mod = await load(entry);
  } catch (err) {
    console.error(err);
    toolbar.querySelector('.tb-idea').textContent = `${entry.id} ${entry.name}：还没有做好`;
    return;
  }
  if (current !== i) return;
  toolbar.querySelector('.tb-idea').textContent = mod.idea;
  notes.innerHTML =
    `<h2>${mod.id} · ${mod.name}<small>${mod.ref ?? ''}</small></h2><p>${mod.idea}</p>` +
    `<h3>怎么读</h3><dl>${(mod.read ?? []).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>` +
    `<h3>好处</h3><ul>${(mod.pros ?? []).map((t) => `<li class="pro">${t}</li>`).join('')}</ul>` +
    `<h3>代价</h3><ul>${(mod.cons ?? []).map((t) => `<li class="con">${t}</li>`).join('')}</ul>`;
  live?.remove();
  live = put(mod, hud.root.querySelector('.hud-tl'));
  live.el.addEventListener('click', () => act.next());
  render(false);
  // the country card sits under this corner: let the HUD measure the corner's new height
  window.dispatchEvent(new Event('resize'));
  root.dataset.variant = mod.id;
}

/* ------------------------------------------------------------------ the overview */
const MOMENTS = [
  { turn: 2, round: 3, active: 0 },
  { turn: 5, round: 6, active: 1 },
  { turn: 9, round: 2, active: 0 },
];
let galleryBuilt = false;
async function buildGallery() {
  if (galleryBuilt) return;
  galleryBuilt = true;
  const head = MOMENTS.map((m) => {
    const v = makeView({ ...m, actionLimit: limitOf(m.turn) }, RULES, T, sides);
    return `<div class="gl-th"><b>${v.eraName}</b>回合 ${m.turn} · 行动轮 ${m.round} · ${PICS[m.turn - 1].title} ${PICS[m.turn - 1].year}</div>`;
  }).join('');
  gallery.innerHTML = `<div class="gl-row gl-head"><div class="gl-name">十组 · 点一行在地图上看</div>${head}</div>`;
  for (const [i, entry] of VARIANTS.entries()) {
    const row = document.createElement('div');
    row.className = 'gl-row';
    row.dataset.i = String(i);
    row.innerHTML = `<div class="gl-name"><b>${entry.id}</b><span>${entry.name}</span><small></small></div>`;
    gallery.appendChild(row);
    let mod;
    try {
      mod = await load(entry);
    } catch (err) {
      console.error(err);
      continue;
    }
    row.querySelector('small').textContent = mod.ref ?? '';
    for (const m of MOMENTS) {
      const cell = document.createElement('div');
      cell.className = 'gl-cell hud';
      cell.innerHTML = '<div class="hud-corner hud-tl hud-pane"></div>';
      row.appendChild(cell);
      put(mod, cell.firstElementChild).draw(makeView({ ...m, phase: 'action', actionLimit: limitOf(m.turn) }, RULES, T, sides));
    }
  }
  root.dataset.gallery = 'ready';
}
function setGallery(on) {
  gallery.hidden = !on;
  root.classList.toggle('in-gallery', on);
  toolbar.querySelector('[data-act="gallery"]').setAttribute('aria-pressed', String(on));
  const url = new URL(location.href);
  if (on) url.searchParams.set('g', '1');
  else url.searchParams.delete('g');
  history.replaceState(null, '', url);
  if (on) buildGallery();
}
gallery.addEventListener('click', (e) => {
  const row = e.target instanceof Element ? e.target.closest('.gl-row[data-i]') : null;
  if (!row) return;
  setGallery(false);
  show(+row.dataset.i);
});

/* ------------------------------------------------------------------ toolbar and keys */
function setFlag(name, onNow) {
  if (name === 'clean') root.classList.toggle('clean', onNow);
  if (name === 'notes') notes.hidden = !onNow;
  toolbar.querySelector(`[data-act="${name}"]`)?.setAttribute('aria-pressed', String(onNow));
  if (name === 'clean') window.dispatchEvent(new Event('resize'));
}

toolbar.innerHTML =
  '<span class="tb-title">年代画面实验</span>' +
  `<nav class="tb-tabs">${VARIANTS.map((v, i) => `<button type="button" data-i="${i}" title="${v.name}"><b>${v.id}</b><span>${v.name}</span></button>`).join('')}</nav>` +
  '<span class="tb-idea"></span>' +
  '<span class="tb-now"></span>' +
  '<div class="tb-acts">' +
  '<button type="button" data-act="next" title="走一个行动轮；最后一轮之后进入下一回合">下一轮<kbd>空格</kbd></button>' +
  '<button type="button" data-act="prevTurn" title="上一回合">‹ 回合<kbd>[</kbd></button>' +
  '<button type="button" data-act="nextTurn" title="下一回合">回合 ›<kbd>]</kbd></button>' +
  '<button type="button" data-act="side" title="换成对手行动 / 换回你">换边<kbd>S</kbd></button>' +
  '<button type="button" data-act="phase" title="行动轮 / 头条阶段 / 回合结算">阶段<kbd>P</kbd></button>' +
  '<button type="button" data-act="gallery" title="十组一起看">总览<kbd>G</kbd></button>' +
  '<button type="button" data-act="notes">说明<kbd>N</kbd></button>' +
  '<button type="button" data-act="clean" title="隐藏这条工具栏，再按 F 恢复">全屏<kbd>F</kbd></button>' +
  '</div>';

const act = {
  next() {
    S.phase = 'action';
    if (S.round < limitOf(S.turn)) S.round++;
    else {
      S.turn = (S.turn % RULES.turns) + 1;
      S.round = 1;
    }
    render();
  },
  nextTurn() {
    S.turn = (S.turn % RULES.turns) + 1;
    S.round = 1;
    render();
  },
  prevTurn() {
    S.turn = ((S.turn + RULES.turns - 2) % RULES.turns) + 1;
    S.round = 1;
    render();
  },
  side() {
    S.active = 1 - S.active;
    render();
  },
  phase() {
    S.phase = { action: 'headline', headline: 'cleanup', cleanup: 'action' }[S.phase];
    render();
  },
  gallery: () => setGallery(gallery.hidden),
  notes: () => setFlag('notes', notes.hidden),
  clean: () => setFlag('clean', !root.classList.contains('clean')),
};
toolbar.addEventListener('click', (e) => {
  const b = e.target instanceof Element ? e.target.closest('button') : null;
  if (!b) return;
  if (b.dataset.i) {
    setGallery(false);
    show(+b.dataset.i);
  } else act[b.dataset.act]?.();
  b.blur();
});
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || !hud) return;
  const k = e.key.toLowerCase();
  if (/^[0-9]$/.test(k)) {
    setGallery(false);
    show(k === '0' ? 9 : +k - 1);
  } else if (k === 'arrowright') show(current + 1);
  else if (k === 'arrowleft') show(current - 1);
  else if (k === ' ' || k === 'enter') {
    e.preventDefault();
    act.next();
  } else if (k === ']') act.nextTurn();
  else if (k === '[') act.prevTurn();
  else if (k === 's') act.side();
  else if (k === 'p') act.phase();
  else if (k === 'g') act.gallery();
  else if (k === 'n') act.notes();
  else if (k === 'f') act.clean();
});

setFlag('clean', q.get('clean') === '1');
setFlag('notes', q.get('notes') === '1');

/* ------------------------------------------------------------------ start */
const fonts = Promise.race([
  Promise.all(["500 20px 'Card Chinese'", "750 20px 'Card Chinese'", "48px 'Russo One'", "600 12px 'Oswald'", "800 12px 'Cinzel'"].map((f) => document.fonts.load(f))),
  new Promise((r) => setTimeout(r, 2500)),
]);
// the pictures are small; have them in before the first display is drawn
const pictures = Promise.race([
  Promise.all(PICS.map((p) => new Promise((r) => { const im = new Image(); im.onload = im.onerror = r; im.src = p.src; }))),
  new Promise((r) => setTimeout(r, 4000)),
]);
const bar = loading.querySelector('.loading-bar i');
const mapReady = WorldMap.create(mapEl, `${import.meta.env.BASE_URL}maps/coldwar`, {
  lang: 'zh',
  onProgress: (done, total) => (bar.style.width = `${Math.round((done / total) * 100)}%`),
});

Promise.all([mapReady, fonts, pictures])
  .then(async ([m]) => {
    map = m;
    const scenario = map.pack.scenario;
    sides = scenario.sides;
    hud = Hud.create(game, {
      lang: 'zh',
      rules: RULES,
      sides: scenario.sides,
      cards: { face: (id) => cardEl(id), back: () => backEl(), fit: fitCard, describe: describeCard },
      demo: false,
    });
    const brief = hud.briefFor(map);
    const mapState = fillerSituation(scenario, { none: '—', ahead: '领先', behind: '落后', even: '均势' });
    map.setState(mapState);
    brief.setState(mapState);
    hud.setState(hudState(), false);

    loading.classList.add('done');
    setTimeout(() => loading.remove(), 700);
    await show(clamp(+(q.get('v') ?? 1) || 1, 1, VARIANTS.length) - 1);
    if (q.get('g') === '1') setGallery(true);
    root.dataset.ready = 'true';
    Object.assign(window, { proto: { map, hud, S, act, show, render, setGallery, VARIANTS, set: (turn, round = 1, active = S.active) => { Object.assign(S, { turn, round, active }); render(); } } });
  })
  .catch((err) => {
    console.error(err);
    loading.classList.add('error');
    loading.querySelector('.loading-text').textContent = err instanceof Error ? err.message : String(err);
  });
