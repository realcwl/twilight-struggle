// The small moving things every display shares: a card travelling between two places, a word that
// appears beside something and goes, a stamp, a number rising off a country.
import { cardEl, fitCard } from '../../hud-layouts/cards.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;

/* ------------------------------------------------------------------ glyphs */
const svg = (d, extra = '') => `<svg class="pe-gl" viewBox="0 0 16 16" aria-hidden="true">${d}${extra}</svg>`;
export const GLYPH = {
  /** ends with the turn */
  turn: svg('<path d="M4 2h8M4 14h8M4.6 2c0 3.6 3.4 3.9 3.4 6s-3.4 2.4-3.4 6M11.4 2c0 3.6-3.4 3.9-3.4 6s3.4 2.4 3.4 6"/>', '<path class="f" d="M6.2 12.6 8 10.4l1.8 2.2Z"/>'),
  /** ended by a named card */
  card: svg('<rect x="4.4" y="1.8" width="7.6" height="11" rx="1.2" transform="rotate(8 8 8)"/><path d="M2.6 13.4 13.4 2.6"/>'),
  /** ended by something that happens */
  cond: svg('<path class="f" d="M9.4 1.4 3.8 9.2h3.6l-.9 5.4 5.7-8H8.6Z"/>'),
  /** counted in action rounds; drawn with the number, see untilMark() */
  rounds: svg('<circle cx="8" cy="8" r="6"/><path d="M8 4.4V8l2.4 1.6"/>'),
  discard: svg('<rect x="3" y="4.6" width="8" height="9.4" rx="1"/><path d="M5.4 4.6V2.4h7.8v9.4h-2.2"/>'),
  removed: svg('<rect x="3.4" y="2" width="9.2" height="12" rx="1.2"/><path d="M5.8 5.6 10.2 10.4M10.2 5.6 5.8 10.4"/>'),
  eye: svg('<path d="M1.4 8C3.4 4.6 5.6 3.4 8 3.4s4.6 1.2 6.6 4.6c-2 3.4-4.2 4.6-6.6 4.6S3.4 11.400 1.400 8Z"/><circle class="f" cx="8" cy="8" r="2"/>'),
  shield: svg('<path d="M8 1.6 13 3.4v4.2c0 3.200-2.100 5.400-5 6.800C5.100 13 3 10.800 3 7.600V3.400Z"/>'),
  pin: svg('<path d="M8 14.400V8.400"/><circle cx="8" cy="5" r="3.200"/>'),
  plus: svg('<path d="M8 3v10M3 8h10"/>'),
};

/** The mark for what ends an effect: a glyph, or the rounds left as a figure. */
export const untilMark = (info) => (info.until.kind === 'rounds' ? `<b class="pe-n">${info.until.n}</b>` : GLYPH[info.until.kind]);

/** The scene of a card's illustration, as a square SVG (for medals and thumbnails). */
export const artOf = (card) => window.DeckArt.scene(card.art);

/* ------------------------------------------------------------------ the fx set */
export function makeFx(layer, pace) {
  let hurry = false;
  const k = () => (hurry ? 0.03 : pace());
  const wait = (ms) => new Promise((r) => setTimeout(r, ms * k()));
  const el = (tag, cls = '', html = '') => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html) n.innerHTML = html;
    return n;
  };
  const rectOf = (t) => (t instanceof Element ? t.getBoundingClientRect() : t);

  /** A card-shaped rectangle of width `w` (px) centred on an element or rectangle. */
  function cardRectAt(target, w) {
    const r = rectOf(target);
    if (!r || (!r.width && !r.height)) return null;
    const width = w ?? Math.min(r.width, (r.height * 5) / 7);
    return { left: r.left + r.width / 2 - width / 2, top: r.top + r.height / 2 - width * 0.7, width, height: width * 1.4 };
  }

  /** Sends a card from one rectangle to another. Resolves when it lands; the card is then gone. */
  function flyCard(no, from, to, { duration = 560, fade = 1, arc = 0, delay = 0 } = {}) {
    if (!from || !to || !from.width || !to.width) return Promise.resolve();
    const c = cardEl(no);
    c.classList.add('pe-flying');
    c.style.setProperty('--card-w', from.width + 'px');
    layer.appendChild(c);
    fitCard(c);
    const s = to.width / from.width;
    const mx = (from.left + to.left) / 2;
    const my = (from.top + to.top) / 2 - arc;
    const a = c.animate(
      [
        { transform: `translate(${from.left}px, ${from.top}px) scale(1)`, opacity: 1 },
        { transform: `translate(${mx}px, ${my}px) scale(${(1 + s) / 2})`, opacity: 1, offset: 0.5 },
        { transform: `translate(${to.left}px, ${to.top}px) scale(${s})`, opacity: fade },
      ],
      { duration: Math.max(1, duration * k()), delay: delay * k(), easing: 'cubic-bezier(0.35, 0.1, 0.2, 1)', fill: 'both' },
    );
    const done = () => c.remove();
    return a.finished.then(done, done);
  }

  /**
   * A word beside something, for a moment: callout(el, '持续生效 · 至本回合结束').
   * side: 'auto' | 'above' | 'below' | 'left' | 'right'.
   */
  function callout(target, html, { side = 'auto', life = 1900, cls = '', gap = 0.9 } = {}) {
    const r = rectOf(target);
    if (!r) return Promise.resolve();
    const n = el('div', `pe-callout ${cls}`, html);
    layer.appendChild(n);
    const u = rem();
    const w = n.offsetWidth;
    const h = n.offsetHeight;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let where = side;
    if (where === 'auto') where = cy < window.innerHeight * 0.42 ? 'below' : 'above';
    let x = cx - w / 2;
    let y = where === 'below' ? r.bottom + gap * u : r.top - h - gap * u;
    if (where === 'right') { x = r.right + gap * u; y = cy - h / 2; }
    if (where === 'left') { x = r.left - w - gap * u; y = cy - h / 2; }
    x = Math.max(0.8 * u, Math.min(window.innerWidth - w - 0.8 * u, x));
    y = Math.max(0.8 * u, Math.min(window.innerHeight - h - 0.8 * u, y));
    n.style.left = x + 'px';
    n.style.top = y + 'px';
    n.dataset.side = where;
    n.style.setProperty('--life', `${Math.max(0.2, (life / 1000) * k())}s`);
    n.classList.add('on');
    return new Promise((res) => setTimeout(() => { n.remove(); res(); }, Math.max(200, life * k())));
  }

  /** Presses a stamp onto an element: 取消, 期满, 终止. Returns the stamp, which stays until removed. */
  function stamp(target, word, cls = '') {
    const n = el('i', `pe-stamp ${cls}`, `<b>${esc(word)}</b>`);
    target.appendChild(n);
    return n;
  }

  /** Lets an element be noticed once. */
  function pulse(target, cls = 'pe-fire', ms = 1500) {
    if (!target) return;
    target.classList.remove(cls);
    void target.offsetWidth;
    target.classList.add(cls);
    setTimeout(() => target.classList.remove(cls), Math.max(300, ms * k()));
  }

  return {
    wait, el, cardRectAt, flyCard, callout, stamp, pulse,
    /** While set, everything already queued runs through at once. */
    hurry(on) { hurry = on; },
    get hurried() { return hurry; },
    clear() { layer.replaceChildren(); },
  };
}

/** Keeps the children of `host` in step with a list, by key, so what has not changed is not rebuilt. */
export function keyed(host, list, key, make, update) {
  const have = new Map([...host.children].filter((n) => n.dataset.fx).map((n) => [n.dataset.fx, n]));
  let prev = null;
  for (const item of list) {
    const id = key(item);
    let n = have.get(id);
    if (n) have.delete(id);
    else {
      n = make(item);
      n.dataset.fx = id;
    }
    const want = prev ? prev.nextElementSibling : host.firstElementChild;
    if (want !== n) host.insertBefore(n, want);
    // in the page before it is brought up to date, so a card inside it can be measured
    update?.(n, item);
    prev = n;
  }
  for (const n of have.values()) n.remove();
}
