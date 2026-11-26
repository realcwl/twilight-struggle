// Ten ways to show the events that stay in force. The stage is the play screen itself: the live map
// and the HUD of src/hud, with the original deck of prototypes/card-designs behind its CardSource.
// A played event that lasts does not go to its pile; it is drawn as an effect in force until it is
// cancelled or runs out, and only then travels to the discard pile or out of the game. The script
// (core/effects.js) is the same for every display; a variant decides where and as what the effects
// are drawn.
//
//   ?v=3          open variant 3                  ?clean=1    no toolbar (F toggles)
//   ?at=2         start with the first 2 beats already played
//   ?pace=0.5     everything twice as fast        ?hover=peace  hold one effect's detail open
//   ?notes=1      the notes panel open
import '../../src/game/game.css';
import './core/core.css';
import { Hud } from '../../src/hud/Hud.ts';
import { WorldMap } from '../../src/map/WorldMap.ts';
import { COLDWAR_TRACKS } from '../../src/game/tracks.ts';
import { fillerSituation } from '../../src/game/placeholder.ts';
import { deriveCountry } from '../../src/sandbox/placeholderRule.ts';
import { cardEl, backEl, fitCard, describe as describeCard } from '../hud-layouts/cards.js';
import { byNo } from '../hud-layouts/state.js';
import { HAND, INITIAL, SIDE_NAME, SIDE_SHORT, describe, live, makeBeats } from './core/effects.js';
import { GLYPH, artOf, esc, keyed, makeFx, rem, untilMark } from './core/fx.js';
import { makeDetail } from './core/detail.js';
import { makeStage } from './core/stage.js';
import { VARIANTS } from './variants/index.js';

const q = new URLSearchParams(location.search);
const root = document.documentElement;
const game = document.getElementById('game');
const mapEl = document.getElementById('map');
const notes = document.getElementById('notes');
const toolbar = document.getElementById('toolbar');
const loading = document.getElementById('loading');

document.body.insertAdjacentHTML('afterbegin', window.CardArt.defs());

let pace = Math.max(0.2, +(q.get('pace') ?? 1));
let hud = null;
let map = null;
let brief = null;
let scenario = null;
let stage = null;
let detail = null;
let fx = null;
let beats = [];
let S = null;
let V = null; // the mounted variant's api
let current = -1;
let at = 0; // beats played so far
const loaded = new Map();

/* ------------------------------------------------------------------ the state */
function makeState(mapState) {
  const state = {
    hud: {
      turn: 4, round: 3, phase: 'action', active: 0, vp: 2, crisis: 3, milops: [1, 2], milopsRequired: 3, space: [3, 2],
      hand: [...HAND], opponentHand: 7, deck: 38, discard: ['001', '011', '047'], removed: ['003', '013', '025'], played: null,
    },
    map: structuredClone(mapState),
    effects: INITIAL.map((id) => live(id)),
    find: (id) => state.effects.find((e) => e.id === id),
    setInfluence(id, influence) {
      const c = scenario.countries.find((x) => x.id === id);
      state.map.countries[id] = deriveCountry(influence, c.stability, 'auto');
    },
    addInfluence(id, side, n) {
      const v = [...state.map.countries[id].influence];
      v[side] += n;
      state.setInfluence(id, v);
    },
  };
  return state;
}

const render = {
  hud(animate = true) {
    const h = S.hud;
    hud.setState({ ...h, milops: [...h.milops], space: [...h.space], hand: [...h.hand], discard: [...h.discard], removed: [...h.removed], played: h.played && { ...h.played }, milopsRequired: h.crisis }, animate);
  },
  map() {
    map.setState(S.map);
    brief.setState(S.map);
  },
  all(animate = true) {
    render.hud(animate);
    render.map();
    V?.sync(stage.infos(), {});
  },
};

/* ------------------------------------------------------------------ what happens, in order */
let chain = Promise.resolve();
let queued = 0;
/** One thing at a time; asking for the next while one is being shown hurries the one on screen. */
function enqueue(job) {
  queued++;
  fx.hurry(queued > 1);
  chain = chain
    .then(job)
    .catch((err) => console.error(err))
    .finally(() => {
      queued--;
      fx.hurry(queued > 1);
    });
  return chain;
}

function reset(upTo = 0) {
  fx.clear();
  detail.hide(true);
  S = makeState(baseMap);
  stageBind();
  for (let i = 0; i < upTo; i++) stage.skip(beats[i]);
  at = upTo;
  render.hud(false);
  render.map();
  V?.sync(stage.infos(), { instant: true });
  paintSteps();
}

let baseMap = null;
function stageBind() {
  stage = makeStage({ hudRoot: hud.root, mapEl, scenario, fx, detail, S, render, variant: () => V });
}

const next = () =>
  enqueue(async () => {
    if (at >= beats.length) return reset(0);
    const beat = beats[at];
    at++;
    paintSteps(true);
    await stage.play(beat);
    paintSteps();
  });
const jump = (n) => enqueue(async () => reset(Math.max(0, Math.min(beats.length, n))));

/* ------------------------------------------------------------------ variants */
function mountVariant(mod) {
  V?.destroy?.();
  V = null;
  fx.clear();
  detail.hide(true);
  for (const n of hud.root.querySelectorAll('.pe-v')) n.remove();
  const layer = document.createElement('div');
  layer.className = `pe-v v-${mod.id}`;
  hud.root.appendChild(layer);
  game.dataset.pe = mod.id;
  const cleanups = [];
  const ctx = {
    id: mod.id,
    root: hud.root,
    layer,
    game,
    map,
    scenario,
    fx,
    detail,
    get S() { return S; },
    part: (name) => stage.part(name),
    plate: (id) => stage.plate(id),
    node: (id) => stage.node(id),
    infos: () => stage.infos(),
    infoOf: (id) => stage.infoOf(id),
    card: { el: cardEl, back: backEl, fit: fitCard, art: artOf, byNo },
    keyed,
    /**
     * A row of elements, one per effect, kept in step with the list: list(row, make, update) gives
     * { sync, el }. make(info) builds an element; update(el, info, opts) brings it up to date.
     */
    list(row, make, update) {
      return {
        sync(list, o = {}) {
          keyed(row, list, (i) => i.id, make, (n, info) => {
            n.classList.toggle('pe-pending', o.entering === info.id);
            update?.(n, info, o);
          });
        },
        el: (id) => row.querySelector(`:scope > [data-fx="${id}"]`),
      };
    },
    /** Puts the mark for what ends an effect into an element, and lets it be seen when it changes. */
    mark(el, info, o = {}) {
      const html = untilMark(info);
      if (el.dataset.mark === html) return;
      if (el.dataset.mark && !o.instant) fx.pulse(el, 'tick', 700);
      el.dataset.mark = html;
      el.dataset.kind = info.until.kind;
      el.innerHTML = html;
    },
    GLYPH,
    untilMark,
    esc,
    rem,
    SIDE_NAME,
    SIDE_SHORT,
    /** A new element: h('div', 'cls', html). */
    h: fx.el,
    /** Runs when this variant leaves the stage. */
    onCleanup: (fn) => cleanups.push(fn),
    /** Tells the HUD its corners may have changed size (the country card sits under the top ones). */
    remeasure: () => window.dispatchEvent(new Event('resize')),
  };
  const api = mod.mount(ctx);
  V = {
    ...api,
    destroy() {
      api.destroy?.();
      for (const fn of cleanups.splice(0)) fn();
      layer.remove();
      delete game.dataset.pe;
    },
  };
  V.sync(stage.infos(), { instant: true });
}

async function show(i) {
  i = (i + VARIANTS.length) % VARIANTS.length;
  current = i;
  const entry = VARIANTS[i];
  for (const b of toolbar.querySelectorAll('.tb-tabs button')) b.setAttribute('aria-pressed', String(+b.dataset.i === i));
  const url = new URL(location.href);
  url.searchParams.set('v', String(i + 1));
  history.replaceState(null, '', url);
  document.title = `${entry.id} ${entry.name} · 持续效果实验`;
  if (!loaded.has(entry.id)) {
    try {
      loaded.set(entry.id, (await entry.load()).default);
    } catch (err) {
      console.error(err);
      toolbar.querySelector('.tb-idea').textContent = `${entry.id} ${entry.name}：还没有做好`;
      return;
    }
  }
  if (current !== i) return;
  const mod = loaded.get(entry.id);
  toolbar.querySelector('.tb-idea').textContent = mod.idea;
  const n = mod.notes ?? {};
  const row = (k, v) => (v ? `<dt>${k}</dt><dd>${v}</dd>` : '');
  notes.innerHTML =
    `<h2>${mod.id} · ${mod.name}<small>${mod.ref ?? ''}</small></h2><p>${mod.idea}</p>` +
    `<h3>五件事各怎么做</h3><dl>${row('放在哪', n.where)}${row('一眼看到', n.glance)}${row('进场', n.enter)}${row('触发时', n.fire)}${row('离场', n.leave)}</dl>` +
    `<h3>好处</h3><ul>${(mod.pros ?? []).map((t) => `<li class="pro">${t}</li>`).join('')}</ul>` +
    `<h3>代价</h3><ul>${(mod.cons ?? []).map((t) => `<li class="con">${t}</li>`).join('')}</ul>`;
  await enqueue(async () => mountVariant(mod));
  root.dataset.variant = mod.id;
}

/* ------------------------------------------------------------------ toolbar and keys */
function setFlag(name, onNow) {
  if (name === 'clean') root.classList.toggle('clean', onNow);
  if (name === 'notes') notes.hidden = !onNow;
  toolbar.querySelector(`[data-act="${name}"]`)?.setAttribute('aria-pressed', String(onNow));
  if (name === 'clean') window.dispatchEvent(new Event('resize'));
}

toolbar.innerHTML =
  '<span class="tb-title">持续效果实验</span>' +
  `<nav class="tb-tabs">${VARIANTS.map((v, i) => `<button type="button" data-i="${i}" title="${v.name}"><b>${v.id}</b><span>${v.name}</span></button>`).join('')}</nav>` +
  '<span class="tb-idea"></span>' +
  '<div class="tb-steps"></div>' +
  '<div class="tb-acts">' +
  '<button type="button" data-act="next" class="tb-next" title="演出下一步"><span></span><kbd>空格</kbd></button>' +
  '<button type="button" data-act="reset" title="回到开头">重来<kbd>R</kbd></button>' +
  '<button type="button" data-act="pace" title="演出速度：常速 / 快 / 慢">常速<kbd>P</kbd></button>' +
  '<button type="button" data-act="notes">说明<kbd>N</kbd></button>' +
  '<button type="button" data-act="clean" title="隐藏这条工具栏，再按 F 恢复">全屏<kbd>F</kbd></button>' +
  '</div>';

function paintSteps(running = false) {
  const steps = toolbar.querySelector('.tb-steps');
  steps.innerHTML = beats.map((b, i) => `<button type="button" data-step="${i + 1}" class="${i < at ? 'done' : ''}${running && i === at - 1 ? ' now' : ''}" title="${esc(b.title)}">${i + 1}</button>`).join('');
  const label = toolbar.querySelector('.tb-next span');
  label.textContent = at >= beats.length ? '演完了，重来' : `下一步：${beats[at].title}`;
  root.dataset.at = String(at);
  root.dataset.busy = String(running);
}

const PACES = [[1, '常速'], [0.5, '快'], [1.7, '慢']];
function setPace(p) {
  pace = p;
  toolbar.querySelector('[data-act="pace"]').firstChild.textContent = (PACES.find((x) => x[0] === p) ?? [p, `×${p}`])[1];
}
const act = {
  next,
  reset: () => jump(0),
  pace: () => setPace(PACES[(PACES.findIndex((x) => x[0] === pace) + 1) % PACES.length][0]),
  notes: () => setFlag('notes', notes.hidden),
  clean: () => setFlag('clean', !root.classList.contains('clean')),
};
toolbar.addEventListener('click', (e) => {
  const b = e.target instanceof Element ? e.target.closest('button') : null;
  if (!b) return;
  if (b.dataset.i) show(+b.dataset.i);
  else if (b.dataset.step) jump(+b.dataset.step);
  else act[b.dataset.act]?.();
  b.blur();
});
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || !hud) return;
  const k = e.key.toLowerCase();
  if (V?.key?.(k, e)) return void e.preventDefault();
  if (/^[0-9]$/.test(k)) show(k === '0' ? 9 : +k - 1);
  else if (k === 'arrowright') show(current + 1);
  else if (k === 'arrowleft') show(current - 1);
  else if (k === ' ' || k === 'enter') {
    e.preventDefault();
    next();
  } else if (k === 'r') act.reset();
  else if (k === 'p') act.pace();
  else if (k === 'n') act.notes();
  else if (k === 'f') act.clean();
});

setFlag('clean', q.get('clean') === '1');
setFlag('notes', q.get('notes') === '1');
setPace(pace);

/* ------------------------------------------------------------------ start */
const fonts = Promise.race([
  Promise.all(["500 20px 'Card Chinese'", "750 20px 'Card Chinese'", "48px 'Russo One'", "600 12px 'Oswald'", "800 12px 'Cinzel'"].map((f) => document.fonts.load(f))),
  new Promise((r) => setTimeout(r, 2500)),
]);
const bar = loading.querySelector('.loading-bar i');
const mapReady = WorldMap.create(mapEl, `${import.meta.env.BASE_URL}maps/coldwar`, {
  lang: 'zh',
  onProgress: (done, total) => (bar.style.width = `${Math.round((done / total) * 100)}%`),
});

Promise.all([mapReady, fonts])
  .then(async ([m]) => {
    map = m;
    scenario = map.pack.scenario;
    hud = Hud.create(game, {
      lang: 'zh',
      rules: COLDWAR_TRACKS,
      sides: scenario.sides,
      cards: { face: (id) => cardEl(id), back: () => backEl(), fit: fitCard, describe: describeCard },
      demo: false,
      // the stage sends the card to the table itself, so the same flight serves a click on "next"
      playFlight: false,
    });
    brief = hud.briefFor(map);
    baseMap = fillerSituation(scenario, { none: '—', ahead: '领先', behind: '落后', even: '均势' });

    const fxLayer = document.createElement('div');
    fxLayer.className = 'pe-fx';
    hud.root.appendChild(fxLayer);
    fx = makeFx(fxLayer, () => pace);
    detail = makeDetail({ layer: hud.root, hudRoot: hud.root, map, infoOf: (id) => stage?.infoOf(id) });
    S = makeState(baseMap);
    beats = makeBeats({ scenario, mapState: baseMap });
    stageBind();
    reset(Math.max(0, Math.min(beats.length, +(q.get('at') ?? 0))));

    // the lasting event in the hand can be played the way any card is: dragged out and let go
    hud.on('play', (card) => {
      if (at === 0 && card === beats[0].ops[0].card && queued === 0) next();
    });

    loading.classList.add('done');
    setTimeout(() => loading.remove(), 700);
    await show(Math.max(0, Math.min(VARIANTS.length, +(q.get('v') ?? 1)) - 1));
    const held = q.get('hover');
    if (held) {
      const el = V?.el(held) ?? document.querySelector(`[data-fx="${held}"]`);
      if (el) (V?.hover ?? detail.show)(held, el);
    }
    root.dataset.ready = 'true';
    Object.assign(window, { proto: { map, hud, get S() { return S; }, get V() { return V; }, stage: () => stage, detail, next, jump, show, beats, VARIANTS, idle: () => chain } });
  })
  .catch((err) => {
    console.error(err);
    loading.classList.add('error');
    loading.querySelector('.loading-text').textContent = err instanceof Error ? err.message : String(err);
  });
