// Ten ways to play a card. The stage is layout 04 of prototypes/hud-layouts with the live map; the
// hand, the rules stand-in and the turn's script are shared (core/); a variant decides how a choice
// is asked for and how what follows is shown.
//
//   ?v=3            open variant 3                 ?clean=1       no toolbar (F toggles)
//   ?from=action    skip the headline              ?from=opponent start at the opponent's first move
//   ?dice=5,2,6     the next dice, in order (for screenshots)     ?pace=0.5   everything twice as fast
import '../hud-layouts/hud.css';
import './core/core.css';
import { WorldMap } from '../../src/map/WorldMap.ts';
import { S, actions } from '../hud-layouts/state.js';
import { hydrate } from '../hud-layouts/widgets.js';
import { mountBrief } from '../hud-layouts/brief.js';
import { cardEl, backEl, fitCard, fly, cardRectIn } from '../hud-layouts/cards.js';
import L04 from '../hud-layouts/layouts/04-corners.js';
import { createGame, ABORT } from './core/game.js';
import { makeBoard } from './core/board.js';
import { mountHand } from './core/hand.js';
import { makeFx } from './core/fx.js';
import { makeDie } from './core/dice.js';
import { VARIANTS } from './variants/index.js';

const q = new URLSearchParams(location.search);
const root = document.documentElement;
const game = document.getElementById('game');
const hudEl = document.getElementById('hud');
const notes = document.getElementById('notes');
const toolbar = document.getElementById('toolbar');
const loading = document.getElementById('loading');
const flyLayer = document.getElementById('fly');

document.body.insertAdjacentHTML('afterbegin', window.CardArt.defs());

/* ------------------------------------------------------------------ the stage: layout 04 */
game.dataset.layout = L04.id;
hudEl.className = 'L' + L04.id;
hudEl.innerHTML = L04.html;
hydrate(hudEl);
L04.mount?.(hudEl, { S, actions });
const hand = mountHand(hudEl.querySelector('[data-hand]'), L04.hand);

const HUD = {
  crisis: '[data-w="crisis"]',
  milops: '[data-w="milops"]',
  vp: '[data-w="vp"][data-form="rule"]',
  score: '[data-w="vp"][data-form="big"]',
  space: '[data-w="space"]',
  played: '[data-w="played"] .pl-slot',
  deck: '[data-w="pile"][data-kind="deck"] .pile-card',
  discard: '[data-w="pile"][data-kind="discard"] .pile-card',
  removed: '[data-w="pile"][data-kind="removed"] .pile-card',
  time: '[data-w="time"]',
  rounds: '[data-w="time"][data-form="rounds"]',
  opp: '[data-w="opp"]',
};
const hud = {
  root: hudEl,
  /** A part of the HUD by name: crisis, milops, vp, score, space, played, deck, discard, removed, time, rounds, opp. */
  el: (name) => hudEl.querySelector(HUD[name] ?? name),
  rect: (name) => hud.el(name)?.getBoundingClientRect() ?? null,
  /** The corner pane a part sits in. */
  pane: (name) => hud.el(name)?.closest('.corner') ?? null,
  /** Where a tag for that part has room: panes at the top get it below, panes at the bottom above. */
  side: (name) => (hud.pane(name)?.matches('.tl, .tr') ? 'below' : 'above'),
  hidePlayed: (on) => hudEl.classList.toggle('cp-no-played', on),
};

/* ------------------------------------------------------------------ game, map, variant */
let map = null;
let mapState = null;
let G = null;
let gameApi = null;
let current = -1;
let live = null; // { ctx, presenter, abort, board }
let pace = Math.max(0.2, +(q.get('pace') ?? 1));
const keyStack = [];

/** Pushes the game state to the map and to the HUD's meters. */
function refresh() {
  if (!map || !G) return;
  for (const c of map.pack.scenario.countries) {
    const st = mapState.countries[c.id];
    if (c.superpower !== undefined) continue;
    const v = G.inf[c.id];
    st.influence = [v[0], v[1]];
    st.controller = gameApi.R.ctrl(G, c.id);
  }
  map.setState(mapState);
  actions.set({
    turn: G.turn, round: Math.max(1, G.round), active: G.active, vp: G.vp, crisis: G.crisis,
    milops: [...G.milops], space: [...G.space], hand: [...G.hand], oppHand: G.oppHand,
    discard: [...G.discard], removed: [...G.removed], played: G.played,
  });
  if (G.phase === 'headline') {
    const ph = hudEl.querySelector('[data-w="phase"]');
    if (ph) {
      ph.querySelector('b').textContent = '头条阶段';
      ph.querySelector('span').textContent = '双方各出一张牌';
    }
  }
  hand.set(G.hand);
}

function makeCtx(V) {
  const abort = new AbortController();
  const signal = abort.signal;
  const layer = document.createElement('div');
  layer.className = `cp-layer v-${V.id}`;
  game.appendChild(layer);
  const fxLayer = document.createElement('div');
  fxLayer.className = `cp-fx v-${V.id}`;
  flyLayer.appendChild(fxLayer);
  const fx = makeFx(fxLayer, signal, () => pace);
  const board = makeBoard(map, game, signal);
  const keys = [];
  keyStack.length = 0;

  const cards = {
    /** A card face. Its width is --card-w where it is put, or `w` (a CSS length). */
    el(no, w) {
      const c = cardEl(no);
      if (w) c.style.setProperty('--card-w', w);
      return c;
    },
    /** Builds a card face inside `parent` and sizes its text. */
    put(no, parent, w) {
      const c = cards.el(no, w);
      parent.appendChild(c);
      fitCard(c);
      return c;
    },
    back(parent, w) {
      const c = backEl();
      if (w) c.style.setProperty('--card-w', w);
      parent?.appendChild(c);
      return c;
    },
    /** Flies a copy of a card element from one rectangle to another. */
    fly,
    /** The same for a card that is not on screen yet: flyNo('031', fromRect, toRect). */
    flyNo(no, from, to, opts) {
      if (!from || !to) return Promise.resolve();
      const c = cards.el(no, from.width + 'px');
      c.style.cssText += ';position:fixed;left:-9999px;top:0';
      flyLayer.appendChild(c);
      fitCard(c);
      const p = fly(c, from, to, opts);
      c.remove();
      return p;
    },
    rectIn: cardRectIn,
  };

  const ctx = {
    V, signal, layer, fx, board, hand, hud, cards,
    game: gameApi,
    G,
    W: gameApi.W,
    R: gameApi.R,
    card: gameApi.card,
    country: gameApi.country,
    options: gameApi.options,
    name: (id) => gameApi.W.C[id]?.name ?? id,
    wait: fx.wait,
    makeDie,
    /** Key handlers that live until the returned function is called: keys({ enter: fn, escape: fn, e: fn }). */
    keys(mapOf) {
      const entry = Object.fromEntries(Object.entries(mapOf).map(([k, v]) => [k.toLowerCase(), v]));
      keyStack.push(entry);
      return () => {
        const i = keyStack.indexOf(entry);
        if (i >= 0) keyStack.splice(i, 1);
      };
    },
    /**
     * The player takes a card out of the hand, by a click or by dragging it clear and letting go.
     * Resolves with { no, rect, via: 'click' | 'drag', x, y }; the card is then held out of the fan
     * (hand.release(no) puts it back).
     *   click: false   only a drag counts (the headline: letting go plays the card, nothing to confirm);
     *                  a click gets a word above the card saying so
     *   onCarry(no)    a card has been picked up and is being carried (say what it will do)
     *   onBack(no)     it was let go too close to the hand and went back
     */
    pickCard({ click = true, onCarry, onBack } = {}) {
      hand.live(true);
      return new Promise((resolve, reject) => {
        if (signal.aborted) return reject(ABORT);
        const done = (r) => {
          hand.hooks = {};
          hand.hold(r.no);
          resolve(r);
        };
        const nudge = (rect) => {
          for (const old of fxLayer.querySelectorAll('.cp-nudge')) old.remove();
          const n = fx.el('div', 'cp-nudge', '拖出来，松手就打出');
          n.style.left = rect.left + rect.width / 2 + 'px';
          n.style.top = rect.top + 'px';
          fxLayer.appendChild(n);
          setTimeout(() => n.remove(), 1700);
        };
        hand.hooks = {
          onPick: (no, rect) => (click ? done({ no, rect, via: 'click' }) : nudge(rect)),
          onDragStart: (no) => onCarry?.(no),
          onDrop: (no, d) => (d.armed ? (done({ no, rect: d.rect, via: 'drag', x: d.x, y: d.y }), true) : (onBack?.(no), false)),
        };
        signal.addEventListener('abort', () => reject(ABORT), { once: true });
      });
    },
  };

  return {
    ctx,
    board,
    destroy() {
      abort.abort();
      hand.hooks = {};
      hand.release();
      hand.away(false);
      hand.live(true);
      hud.hidePlayed(false);
      board.destroy();
      layer.remove();
      fxLayer.remove();
      keyStack.length = 0;
      for (const k of keys) k();
    },
  };
}

const loaded = new Map(); // id -> the variant's module
let lastFrom = q.get('from') ?? 'headline';

function startVariant(from = lastFrom) {
  if (!map || current < 0) return;
  lastFrom = from;
  gameApi.stop();
  live?.presenter?.destroy?.();
  live?.destroy();
  live = null;
  const V = loaded.get(VARIANTS[current].id);
  if (!V) return;
  game.dataset.cp = V.id;
  const made = makeCtx(V);
  const presenter = V.mount(made.ctx);
  live = { ...made, presenter };
  // whatever a variant does when a card leaves the table, the view then goes back to where it was
  const staged = Object.create(presenter);
  staged.settle = async (play) => {
    await presenter.settle(play);
    made.board.restView();
  };
  const dice = (q.get('dice') ?? '').split(',').map(Number).filter((n) => n >= 1 && n <= 6);
  gameApi.start(staged, from, dice);
}

async function show(i, from) {
  i = (i + VARIANTS.length) % VARIANTS.length;
  current = i;
  const entry = VARIANTS[i];
  for (const b of toolbar.querySelectorAll('.tb-tabs button')) b.setAttribute('aria-pressed', String(+b.dataset.i === i));
  const url = new URL(location.href);
  url.searchParams.set('v', String(i + 1));
  history.replaceState(null, '', url);
  document.title = `${entry.id} ${entry.name} · 打牌体验实验`;
  if (!loaded.has(entry.id)) {
    try {
      loaded.set(entry.id, (await entry.load()).default);
    } catch (err) {
      console.error(err);
      gameApi?.stop();
      live?.presenter?.destroy?.();
      live?.destroy();
      live = null;
      toolbar.querySelector('.tb-idea').textContent = `${entry.id} ${entry.name}：还没有做好`;
      notes.innerHTML = '';
      return;
    }
  }
  if (current !== i) return; // another one was asked for while this one was loading
  const V = loaded.get(entry.id);
  toolbar.querySelector('.tb-idea').textContent = V.idea;
  const n = V.notes ?? {};
  const row = (k, v) => (v ? `<dt>${k}</dt><dd>${v}</dd>` : '');
  notes.innerHTML =
    `<h2>${V.id} · ${V.name}<small>${V.ref ?? ''}</small></h2><p>${V.idea}</p>` +
    `<h3>四件事各怎么做</h3><dl>${row('选用途', n.choose)}${row('指目标', n.target)}${row('掷骰子', n.dice)}${row('看后果', n.guide)}${row('对手行动', n.opponent)}</dl>` +
    `<h3>好处</h3><ul>${(V.pros ?? []).map((t) => `<li class="pro">${t}</li>`).join('')}</ul>` +
    `<h3>代价</h3><ul>${(V.cons ?? []).map((t) => `<li class="con">${t}</li>`).join('')}</ul>`;
  startVariant(from);
}

/* ------------------------------------------------------------------ toolbar and keys */
function setFlag(name, onNow) {
  if (name === 'clean') root.classList.toggle('clean', onNow);
  if (name === 'notes') notes.hidden = !onNow;
  toolbar.querySelector(`[data-act="${name}"]`)?.setAttribute('aria-pressed', String(onNow));
}

toolbar.innerHTML =
  '<span class="tb-title">打牌体验实验</span>' +
  `<nav class="tb-tabs">${VARIANTS.map((V, i) => `<button type="button" data-i="${i}" title="${V.name}"><b>${V.id}</b><span>${V.name}</span></button>`).join('')}</nav>` +
  '<span class="tb-idea"></span>' +
  '<div class="tb-acts">' +
  '<button type="button" data-act="headline" title="从头条阶段重新开始">头条<kbd>R</kbd></button>' +
  '<button type="button" data-act="opponent" title="跳过头条，从对手的第一个行动开始">对手行动<kbd>O</kbd></button>' +
  '<button type="button" data-act="action" title="跳过头条和对手，直接轮到你">我的行动<kbd>A</kbd></button>' +
  '<button type="button" data-act="pace" title="演出速度：慢 / 常速 / 快">常速<kbd>P</kbd></button>' +
  '<button type="button" data-act="notes">说明<kbd>N</kbd></button>' +
  '<button type="button" data-act="clean" title="隐藏这条工具栏，再按 F 恢复">全屏<kbd>F</kbd></button>' +
  '</div>';

const PACES = [
  [1, '常速'],
  [0.5, '快'],
  [1.7, '慢'],
];
function setPace(p) {
  pace = p;
  const b = toolbar.querySelector('[data-act="pace"]');
  b.firstChild.textContent = (PACES.find((x) => x[0] === p) ?? [p, `×${p}`])[1];
}
const act = {
  headline: () => startVariant('headline'),
  opponent: () => startVariant('opponent'),
  action: () => startVariant('action'),
  pace: () => setPace(PACES[(PACES.findIndex((x) => x[0] === pace) + 1) % PACES.length][0]),
  notes: () => setFlag('notes', notes.hidden),
  clean: () => setFlag('clean', !root.classList.contains('clean')),
};
toolbar.addEventListener('click', (e) => {
  const b = e.target instanceof Element ? e.target.closest('button') : null;
  if (!b) return;
  if (b.dataset.i) show(+b.dataset.i);
  else act[b.dataset.act]?.();
  b.blur();
});
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  // the variant on stage hears a key first
  for (let i = keyStack.length - 1; i >= 0; i--) {
    const fn = keyStack[i][k];
    if (fn) {
      e.preventDefault();
      fn(e);
      return;
    }
  }
  if (/^[0-9]$/.test(k)) show(k === '0' ? 9 : +k - 1);
  else if (k === 'arrowright') show(current + 1);
  else if (k === 'arrowleft') show(current - 1);
  else if (k === ' ') {
    e.preventDefault();
    live?.ctx.fx.skip();
  } else if (k === 'r') act.headline();
  else if (k === 'o') act.opponent();
  else if (k === 'a') act.action();
  else if (k === 'p') act.pace();
  else if (k === 'n') act.notes();
  else if (k === 'f') act.clean();
});

setFlag('clean', q.get('clean') === '1');
setFlag('notes', q.get('notes') === '1');
setPace(pace);

const fonts = Promise.race([
  Promise.all(["500 20px 'Card Chinese'", "750 20px 'Card Chinese'", "48px 'Russo One'", "600 12px 'Oswald'", "800 12px 'Cinzel'"].map((f) => document.fonts.load(f))),
  new Promise((r) => setTimeout(r, 2500)),
]);

const mapReady = WorldMap.create(document.getElementById('map'), `${import.meta.env.BASE_URL}maps/coldwar`, {
  lang: 'zh',
  onProgress: (done, total) => loading.querySelector('i').style.setProperty('--p', `${Math.round((done / total) * 100)}%`),
});

Promise.all([mapReady, fonts])
  .then(([m]) => {
    map = m;
    const { scenario } = map.pack;
    mapState = { countries: {}, regions: {} };
    for (const c of scenario.countries) mapState.countries[c.id] = { influence: [0, 0], controller: c.superpower ?? null };
    for (const r of scenario.regions) mapState.regions[r.id] = { status: ['—', '—'] };
    gameApi = createGame({ scenario, deck: window.DECK, refresh });
    G = gameApi.G;
    gameApi.reset();
    mountBrief(map, mapState, game);
    loading.classList.add('done');
    setTimeout(() => loading.remove(), 600);
    show(Math.max(0, Math.min(VARIANTS.length, +(q.get('v') ?? 1)) - 1));
    root.dataset.map = 'ready';
    root.dataset.hud = 'ready';
    // for poking at the page from the console, and for the screenshot script
    Object.assign(window, { proto: { map, G, game: gameApi, hand, hud, show, VARIANTS, live: () => live, start: startVariant } });
  })
  .catch((err) => {
    console.error(err);
    loading.firstElementChild.textContent = err instanceof Error ? err.message : String(err);
  });
