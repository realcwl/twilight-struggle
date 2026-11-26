// HUD layout study: ten ways to arrange the score, the clock, the meters, the hand and the piles
// over the live map. One page, one map, one made-up game state; keys 1-9 and 0 swap the layout.
//
//   ?v=3        open layout 3          ?clean=1   no toolbar (F toggles)
//   ?notes=1    notes panel open (N toggles)
import './hud.css';
import { startMap } from './mapdemo.js';
import { S, actions } from './state.js';
import { hydrate } from './widgets.js';
import { mountHand } from './hand.js';
import { LAYOUTS } from './layouts/index.js';
import { mountBrief } from './brief.js';

const q = new URLSearchParams(location.search);
const root = document.documentElement;
const game = document.getElementById('game');
const hud = document.getElementById('hud');
const notes = document.getElementById('notes');
const toolbar = document.getElementById('toolbar');
const loading = document.getElementById('loading');

// the filters and metals every card face refers to
document.body.insertAdjacentHTML('afterbegin', window.CardArt.defs());

let current = -1;
let cleanup = null;
let hand = null;

function show(i) {
  i = (i + LAYOUTS.length) % LAYOUTS.length;
  if (i === current) return;
  cleanup?.();
  current = i;
  const L = LAYOUTS[i];
  game.dataset.layout = L.id;
  hud.className = 'L' + L.id;
  hud.innerHTML = L.html;
  const stop = hydrate(hud);
  hand = mountHand(hud.querySelector('[data-hand]'), L.hand);
  const extra = L.mount?.(hud, { S, actions });
  cleanup = () => {
    stop();
    hand.destroy();
    extra?.();
  };
  for (const b of toolbar.querySelectorAll('.tb-tabs button')) b.setAttribute('aria-pressed', String(+b.dataset.i === i));
  toolbar.querySelector('.tb-idea').textContent = L.idea;
  renderNotes(L);
  const url = new URL(location.href);
  url.searchParams.set('v', String(i + 1));
  history.replaceState(null, '', url);
  document.title = `${L.id} ${L.name} · HUD 布局实验`;
}

function renderNotes(L) {
  notes.innerHTML =
    `<h2>${L.id} · ${L.name}<small>${L.ref}</small></h2><p>${L.idea}</p>` +
    `<h3>东西在哪</h3><dl>${L.where.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>` +
    `<h3>好处</h3><ul>${L.pros.map((t) => `<li class="pro">${t}</li>`).join('')}</ul>` +
    `<h3>代价</h3><ul>${L.cons.map((t) => `<li class="con">${t}</li>`).join('')}</ul>`;
}

function setFlag(name, onNow) {
  if (name === 'clean') root.classList.toggle('clean', onNow);
  if (name === 'notes') notes.hidden = !onNow;
  toolbar.querySelector(`[data-act="${name}"]`)?.setAttribute('aria-pressed', String(onNow));
}

toolbar.innerHTML =
  '<span class="tb-title">HUD 布局实验</span>' +
  `<nav class="tb-tabs">${LAYOUTS.map((L, i) => `<button type="button" data-i="${i}" title="${L.name}（${L.ref}）"><b>${L.id}</b><span>${L.name}</span></button>`).join('')}</nav>` +
  '<span class="tb-idea"></span>' +
  '<div class="tb-acts">' +
  '<button type="button" data-act="step" title="对手出牌 / 推进一个行动轮">下一步<kbd>空格</kbd></button>' +
  '<button type="button" data-act="reset">重置<kbd>R</kbd></button>' +
  '<button type="button" data-act="notes">说明<kbd>N</kbd></button>' +
  '<button type="button" data-act="clean" title="隐藏这条工具栏，再按 F 恢复">全屏<kbd>F</kbd></button>' +
  '</div>';

const act = {
  step: () => actions.step(),
  reset: () => actions.reset(),
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
  if (/^[0-9]$/.test(k)) show(k === '0' ? 9 : +k - 1);
  else if (k === 'arrowright') show(current + 1);
  else if (k === 'arrowleft') show(current - 1);
  else if (k === ' ') {
    e.preventDefault();
    act.step();
  } else if (k === 'r') act.reset();
  else if (k === 'n') act.notes();
  else if (k === 'f') act.clean();
});

setFlag('clean', q.get('clean') === '1');
setFlag('notes', q.get('notes') === '1');

const fonts = Promise.race([
  Promise.all(["500 20px 'Card Chinese'", "750 20px 'Card Chinese'", "48px 'Russo One'", "600 12px 'Oswald'", "400 12px 'Oswald'", "700 12px 'Oswald'", "800 12px 'Cinzel'"].map((f) => document.fonts.load(f))),
  new Promise((r) => setTimeout(r, 2500)),
]);

fonts.then(() => {
  // 04 is the layout that was picked, so it is where the page opens
  show(Math.max(0, Math.min(LAYOUTS.length, +(q.get('v') ?? 4)) - 1));
  root.dataset.hud = 'ready';
});

startMap(document.getElementById('map'), (done, total) => loading.querySelector('i').style.setProperty('--p', `${Math.round((done / total) * 100)}%`))
  .then(({ map, state }) => {
    mountBrief(map, state, game);
    loading.classList.add('done');
    setTimeout(() => loading.remove(), 600);
    root.dataset.map = 'ready';
    // for poking at the page from the console, and for the screenshot script
    Object.assign(window, { proto: { map, S, actions, show, LAYOUTS, hand: () => hand } });
  })
  .catch((err) => {
    console.error(err);
    loading.firstElementChild.textContent = err instanceof Error ? err.message : String(err);
  });
