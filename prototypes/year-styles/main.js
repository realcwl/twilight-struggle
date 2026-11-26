// Ten ways to say what year it is. The stage is layout 04 of prototypes/hud-layouts, live map and
// all; only its top-left corner (the turn wheel) is swapped. Keys 1-9 and 0 pick a variant.
//
//   ?v=3        open variant 3            ?clean=1   no toolbar (F toggles)
//   ?g=1        the gallery: all ten, in an early, a middle and a late year (G toggles)
//   ?t=8&r=2    start at turn 8, action round 2
import '../hud-layouts/hud.css';
import './year.css';
import { startMap } from '../hud-layouts/mapdemo.js';
import { S, RULES, actions, on } from '../hud-layouts/state.js';
import { hydrate } from '../hud-layouts/widgets.js';
import { mountHand } from '../hud-layouts/hand.js';
import { mountBrief } from '../hud-layouts/brief.js';
import L04 from '../hud-layouts/layouts/04-corners.js';
import { VARIANTS } from './variants/index.js';
import { view } from './time.js';

const q = new URLSearchParams(location.search);
const root = document.documentElement;
const game = document.getElementById('game');
const hud = document.getElementById('hud');
const gallery = document.getElementById('gallery');
const notes = document.getElementById('notes');
const toolbar = document.getElementById('toolbar');
const loading = document.getElementById('loading');

document.body.insertAdjacentHTML('afterbegin', window.CardArt.defs());

/* ------------------------------------------------------------------ the stage: layout 04 */
game.dataset.layout = L04.id;
hud.className = 'L' + L04.id;
hud.innerHTML = L04.html;
hydrate(hud);
mountHand(hud.querySelector('[data-hand]'), L04.hand);
L04.mount?.(hud, { S, actions });
const slot = document.createElement('div');
hud.prepend(slot);

let current = -1;
let update = null;

function mountVariant(V, host) {
  host.className = `yr yr-${V.id}${V.pane ? ' pane gilt' : ''}`;
  host.replaceChildren();
  return V.mount(host);
}

function show(i) {
  i = (i + VARIANTS.length) % VARIANTS.length;
  if (i === current) return;
  current = i;
  const V = VARIANTS[i];
  update = mountVariant(V, slot);
  update(view(S));
  // the country card sits under whatever this variant's block turned out to be
  requestAnimationFrame(() => {
    const rem = parseFloat(getComputedStyle(root).fontSize);
    game.style.setProperty('--info-y', `${((slot.getBoundingClientRect().bottom - game.getBoundingClientRect().top) / rem + 1.4).toFixed(2)}rem`);
  });
  for (const b of toolbar.querySelectorAll('.tb-tabs button')) b.setAttribute('aria-pressed', String(+b.dataset.i === i));
  toolbar.querySelector('.tb-idea').textContent = V.idea;
  notes.innerHTML = `<h2>${V.id} · ${V.name}<small>${V.ref}</small></h2><p>${V.idea}</p><h3>怎么读</h3><dl>${V.read.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl><h3>好处</h3><ul>${V.pros.map((t) => `<li class="pro">${t}</li>`).join('')}</ul><h3>代价</h3><ul>${V.cons.map((t) => `<li class="con">${t}</li>`).join('')}</ul>`;
  const url = new URL(location.href);
  url.searchParams.set('v', String(i + 1));
  history.replaceState(null, '', url);
  document.title = `${V.id} ${V.name} · 年份显示实验`;
}

on((s) => {
  update?.(view(s));
  toolbar.querySelector('.tb-now').textContent = `回合 ${s.turn} · 行动轮 ${s.round} · ${view(s).year}`;
});

/* ------------------------------------------------------------------ the gallery */
// Each variant three times over: a year from each era. Drawn once, when the gallery is first opened.
const MOMENTS = [
  { turn: 2, round: 3, active: 0 },
  { turn: 5, round: 6, active: 1 },
  { turn: 9, round: 2, active: 0 },
];
function buildGallery() {
  if (gallery.childElementCount) return;
  gallery.innerHTML =
    `<div class="g-head"><span>十种手法 · 点一行在地图上看</span>${MOMENTS.map((m) => `<span><b>${view(m).era.name}</b><small>回合 ${m.turn} · 行动轮 ${m.round} · ${view(m).year}</small></span>`).join('')}</div>` +
    VARIANTS.map((V, i) => `<div class="g-row" data-i="${i}"><div class="g-name"><b><span>${V.id}</span>${V.name}</b><em>${V.ref}</em></div>${MOMENTS.map(() => '<div class="g-cell"><div></div></div>').join('')}</div>`).join('');
  gallery.querySelectorAll('.g-row').forEach((row, i) => {
    row.querySelectorAll('.g-cell > div').forEach((host, j) => mountVariant(VARIANTS[i], host)(view(MOMENTS[j])));
    row.addEventListener('click', () => {
      setFlag('gallery', false);
      show(i);
    });
  });
}

/* ------------------------------------------------------------------ toolbar and keys */
function setFlag(name, onNow) {
  if (name === 'clean') root.classList.toggle('clean', onNow);
  if (name === 'notes') notes.hidden = !onNow;
  if (name === 'gallery') {
    if (onNow) buildGallery();
    gallery.hidden = !onNow;
  }
  toolbar.querySelector(`[data-act="${name}"]`)?.setAttribute('aria-pressed', String(onNow));
}

toolbar.innerHTML =
  '<span class="tb-title">年份显示实验</span>' +
  `<nav class="tb-tabs">${VARIANTS.map((V, i) => `<button type="button" data-i="${i}" title="${V.name}（${V.ref}）"><b>${V.id}</b><span>${V.name}</span></button>`).join('')}</nav>` +
  '<span class="tb-idea"></span><span class="tb-now"></span>' +
  '<div class="tb-acts">' +
  '<button type="button" data-act="round" title="下一个行动轮">行动轮<kbd>空格</kbd></button>' +
  '<button type="button" data-act="turnBack" title="上一回合">◀<kbd>[</kbd></button>' +
  '<button type="button" data-act="turn" title="下一回合">回合 ▶<kbd>]</kbd></button>' +
  '<button type="button" data-act="gallery" title="十种一起看">总览<kbd>G</kbd></button>' +
  '<button type="button" data-act="notes">说明<kbd>N</kbd></button>' +
  '<button type="button" data-act="clean">全屏<kbd>F</kbd></button>' +
  '</div>';

const wrap = (v, max) => ((v - 1 + max) % max) + 1;
const act = {
  // the next action round; after the last one the next turn begins
  round: () => actions.set(S.round >= RULES.rounds ? { turn: wrap(S.turn + 1, RULES.turns), round: 1, active: 0 } : { round: S.round + 1, active: 0 }),
  turn: () => actions.set({ turn: wrap(S.turn + 1, RULES.turns), round: 1, active: 0 }),
  turnBack: () => actions.set({ turn: wrap(S.turn - 1, RULES.turns), round: 1, active: 0 }),
  side: () => actions.set({ active: S.active ? 0 : 1 }),
  notes: () => setFlag('notes', notes.hidden),
  clean: () => setFlag('clean', !root.classList.contains('clean')),
  gallery: () => setFlag('gallery', gallery.hidden),
};
toolbar.addEventListener('click', (e) => {
  const b = e.target instanceof Element ? e.target.closest('button') : null;
  if (!b) return;
  if (b.dataset.i) {
    setFlag('gallery', false);
    show(+b.dataset.i);
  } else act[b.dataset.act]?.();
  b.blur();
});
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (/^[0-9]$/.test(k)) {
    setFlag('gallery', false);
    show(k === '0' ? 9 : +k - 1);
  } else if (k === 'arrowright') show(current + 1);
  else if (k === 'arrowleft') show(current - 1);
  else if (k === ' ') {
    e.preventDefault();
    act.round();
  } else if (k === ']') act.turn();
  else if (k === '[') act.turnBack();
  else if (k === 's') act.side();
  else if (k === 'g') act.gallery();
  else if (k === 'n') act.notes();
  else if (k === 'f') act.clean();
  else if (k === 'escape') setFlag('gallery', false);
});

if (q.get('t') || q.get('r')) Object.assign(S, { turn: Math.min(RULES.turns, Math.max(1, +(q.get('t') ?? S.turn))), round: Math.min(RULES.rounds, Math.max(1, +(q.get('r') ?? S.round))) });
setFlag('clean', q.get('clean') === '1');
setFlag('notes', q.get('notes') === '1');

const fonts = Promise.race([
  Promise.all(["48px 'Russo One'", "600 12px 'Oswald'", "800 12px 'Cinzel'", "12px 'Special Elite'", "12px 'VT323'", "700 12px 'Playfair Display'", "12px 'Share Tech Mono'"].map((f) => document.fonts.load(f))),
  new Promise((r) => setTimeout(r, 2500)),
]);
fonts.then(() => {
  show(Math.max(0, Math.min(VARIANTS.length, +(q.get('v') ?? 1)) - 1));
  actions.set({});
  setFlag('gallery', q.get('g') === '1');
  root.dataset.hud = 'ready';
});

startMap(document.getElementById('map'), (done, total) => loading.querySelector('i').style.setProperty('--p', `${Math.round((done / total) * 100)}%`))
  .then(({ map, state }) => {
    mountBrief(map, state, game);
    loading.classList.add('done');
    setTimeout(() => loading.remove(), 600);
    root.dataset.map = 'ready';
    Object.assign(window, { proto: { map, S, actions, show, VARIANTS, view } });
  })
  .catch((err) => {
    console.error(err);
    loading.firstElementChild.textContent = err instanceof Error ? err.message : String(err);
  });
