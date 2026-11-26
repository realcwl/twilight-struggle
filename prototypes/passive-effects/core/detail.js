// What pointing at an effect shows, the same in every display: the card at a size that can be read,
// and beside it the three things the card itself cannot say: how long this lasts, what ends it, and
// which pile the card goes to then. While it is up, whatever the effect touches is lit: its
// countries on the map (the map's own focus treatment), its meter in the HUD, the hand.
//
// A display marks an element with data-fx="<effect id>" and gets all of this for free. It can say
// where the panel should go with data-fx-side="right | left | above | below" on that element.
import { cardEl, fitCard } from '../../hud-layouts/cards.js';
import { GLYPH, esc, rem, untilMark } from './fx.js';

const METER = { crisis: '[data-part="crisis"]', score: '[data-part="scoreRead"]', rounds: '[data-part="rounds"]', milops: '[data-part="milops"]', space: '[data-part="space"]' };

export function makeDetail({ layer, hudRoot, map, infoOf }) {
  const panel = document.createElement('div');
  panel.className = 'pe-detail';
  panel.hidden = true;
  layer.appendChild(panel);

  let shown = null; // effect id
  let anchor = null;
  let timer = 0;
  let enabled = true;
  const listeners = new Set();

  function light(info) {
    unlight();
    if (!info) return;
    if (info.places.length) map.offer({ ok: info.places });
    if (info.meter) hudRoot.querySelector(METER[info.meter])?.classList.add('pe-glow');
    if (info.hand !== null) hudRoot.classList.add('pe-hand-glow');
  }
  function unlight() {
    map.offer(null);
    for (const n of hudRoot.querySelectorAll('.pe-glow')) n.classList.remove('pe-glow');
    hudRoot.classList.remove('pe-hand-glow');
  }

  function html(info) {
    return `
      <div class="pe-d-card"></div>
      <div class="pe-d-facts">
        <div class="pe-d-who"><i class="pe-chip">${info.side === 'us' ? '美' : info.side === 'ussr' ? '苏' : '中'}</i>${esc(info.who)}</div>
        <h3>${esc(info.title)}</h3>
        <p class="pe-d-line">${info.lineHTML}</p>
        <dl>
          <dt>持续</dt><dd><i class="pe-mark">${untilMark(info)}</i>${info.untilHTML}</dd>
          <dt>作用于</dt><dd>${esc(info.where)}</dd>
          <dt>之后</dt><dd><i class="pe-mark">${GLYPH[info.fate.pile]}</i>${esc(info.fate.text)}</dd>
        </dl>
      </div>`;
  }

  function place(el) {
    const u = rem();
    const r = el.getBoundingClientRect();
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const gap = 1.4 * u;
    const room = { right: W - r.right, left: r.left, below: H - r.bottom, above: r.top };
    let side = el.dataset.fxSide ?? el.closest('[data-fx-side]')?.dataset.fxSide;
    if (!side || (side === 'right' || side === 'left' ? room[side] < w + gap : room[side] < h + gap)) {
      side = ['right', 'left'].find((s) => room[s] >= w + gap) ?? (room.below >= room.above ? 'below' : 'above');
    }
    let x;
    let y;
    if (side === 'right' || side === 'left') {
      x = side === 'right' ? r.right + gap : r.left - gap - w;
      y = r.top + r.height / 2 - h / 2;
    } else {
      x = r.left + r.width / 2 - w / 2;
      y = side === 'below' ? r.bottom + gap : r.top - gap - h;
    }
    panel.style.left = Math.max(u, Math.min(W - w - u, x)) + 'px';
    panel.style.top = Math.max(u, Math.min(H - h - u, y)) + 'px';
    panel.dataset.side = side;
  }

  function show(id, el) {
    const info = infoOf(id);
    if (!info || !enabled) return;
    clearTimeout(timer);
    if (shown === id && anchor === el) return;
    shown = id;
    anchor = el;
    panel.className = `pe-detail ${info.cls}`;
    panel.innerHTML = html(info);
    const c = cardEl(info.no);
    panel.querySelector('.pe-d-card').appendChild(c);
    panel.hidden = false;
    fitCard(c);
    place(el);
    panel.classList.add('on');
    light(info);
    for (const fn of listeners) fn(id, el);
  }
  function hide(now = false) {
    clearTimeout(timer);
    const go = () => {
      if (shown === null) return;
      shown = null;
      anchor = null;
      panel.hidden = true;
      panel.classList.remove('on');
      unlight();
      for (const fn of listeners) fn(null, null);
    };
    if (now) go();
    else timer = setTimeout(go, 90);
  }

  const over = (e) => {
    const el = e.target instanceof Element ? e.target.closest('[data-fx]') : null;
    if (el && !el.classList.contains('pe-pending') && !el.closest('.pe-nodetail')) show(el.dataset.fx, el);
  };
  const out = (e) => {
    const el = e.target instanceof Element ? e.target.closest('[data-fx]') : null;
    if (!el) return;
    const to = e.relatedTarget instanceof Element ? e.relatedTarget.closest('[data-fx]') : null;
    if (to !== el) hide();
  };
  document.addEventListener('pointerover', over);
  document.addEventListener('pointerout', out);

  return {
    show,
    hide,
    /** Lights what an effect touches without the panel (a display that draws its own panel). */
    light: (id) => light(id ? infoOf(id) : null),
    get shown() { return shown; },
    /** fn(id, el) when the panel comes up, fn(null) when it goes. */
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** Off while a beat is being played, so a panel does not sit over what is being shown. */
    enable(on) { enabled = on; if (!on) hide(true); },
    dispose() {
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerout', out);
      hide(true);
      panel.remove();
    },
  };
}
