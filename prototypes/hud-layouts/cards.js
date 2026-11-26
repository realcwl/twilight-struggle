// Cards for the HUD: the deck's own card (prototypes/card-designs/deck) built at any size, a cheap
// stand-in for a face-down card, and the little flight a card makes from one place to another.
import { byNo } from './state.js';

const C = window.DeckCard;
const FX = '<div class="fx-edge"></div>';
let uid = 0;

/** A card, face up. Its width is whatever --card-w says where it is put. */
export function cardEl(no, cls = '') {
  const c = byNo[no];
  const el = document.createElement('div');
  el.className = `slot v2 e01 deck side-${c.side} ${cls}`;
  el.dataset.no = no;
  el.innerHTML = `<div class="tilt"><div class="flip"><div class="face front">${C.front(c, 'h' + uid++)}${FX}</div></div></div>`;
  return el;
}

/** The real card back, for the top of the draw pile. */
export function backEl(cls = '') {
  const el = document.createElement('div');
  el.className = `slot v2 e01 deck is-back ${cls}`;
  el.innerHTML = `<div class="tilt"><div class="flip"><div class="face front" style="background:#0b0a09">${C.back('h' + uid++)}${FX}</div></div></div>`;
  return el;
}

/** A face-down card small enough that the real back would be wasted on it. */
export const miniBack = (cls = '') => `<i class="mb ${cls}"></i>`;

/** Sizes the title and the rules text. The card has to be in the page for this. */
export function fitCard(el) {
  if (!el.isConnected || el.dataset.fitted) return;
  const face = el.querySelector('.face');
  if (!face || !face.clientWidth) return;
  C.fit(face);
  el.dataset.fitted = '1';
}

export const describe = (no) => C.describe(byNo[no]);

const layer = () => document.getElementById('fly') ?? document.body;

/**
 * Moves a copy of `node` from one screen rectangle to another and removes it.
 * `from` and `to` are DOMRects (or anything with left, top, width, height).
 */
export function fly(node, from, to, { duration = 430, fade = false, delay = 0 } = {}) {
  if (!from || !to || !from.width || !to.width) return Promise.resolve();
  const g = node.cloneNode(true);
  g.removeAttribute('style');
  g.classList.add('flying');
  g.style.setProperty('--card-w', from.width + 'px');
  layer().appendChild(g);
  const s = to.width / from.width;
  const a = g.animate(
    [
      { transform: `translate(${from.left}px, ${from.top}px) scale(1)`, opacity: 1 },
      { transform: `translate(${to.left}px, ${to.top}px) scale(${s})`, opacity: fade ? 0.2 : 1 },
    ],
    { duration, delay, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)', fill: 'both' },
  );
  return a.finished.then(
    () => g.remove(),
    () => g.remove(),
  );
}

/** The rectangle a card of the given aspect takes when centred in an element. */
export function cardRectIn(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const w = Math.min(r.width, (r.height * 5) / 7);
  return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - w * 1.4) / 2, width: w, height: w * 1.4 };
}
