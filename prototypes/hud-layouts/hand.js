// The player's hand. One controller, several shapes: a fan, a flat row, a hand that hides until
// the pointer comes near, a fan round a screen corner, and a written list.
//
// The host element is a point: the middle of the hand's baseline. Each card is drawn twice over:
// a picture that moves (.hc) and an invisible box that stays in the card's resting place (.hh)
// and takes the pointer. So a card can grow to twice its size under the pointer without stealing
// the pointer from its neighbours.
//
// Drag a card far enough from where it was picked up and let go: it is played.
import { S, on, actions, byNo } from './state.js';
import { cardEl, fitCard, fly, cardRectIn } from './cards.js';

const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
const rad = (d) => (d * Math.PI) / 180;

/** Every length is in rem (1rem is 10 px on a 1600 x 900 screen). */
export const HAND_DEFAULTS = {
  form: 'fan',
  w: 13, // card width
  step: 8.6, // from one card's centre to the next
  span: 72, // the hand never gets wider than this, first centre to last
  arc: 2.6, // degrees each card turns from its neighbour; 0 keeps them upright
  sink: 5, // how far the cards sit below the baseline at rest
  hover: 2.05, // size of the card under the pointer
  rise: 1, // where that card's bottom edge goes, above the baseline
  push: 1.4, // how far its neighbours step aside
  hoverAt: null, // { x, y }: a fixed place for the enlarged card instead of above its own slot
  idle: null, // { scale, sink, step }: the hand while the pointer is elsewhere
  zone: null, // { w, h }: with idle, the area that wakes the hand up
  corner: null, // { r0, from, to }: fan the cards round the host point instead of along a line
  arm: 10, // drag a card this far and it will be played on release
  dragScale: 1.1,
};

const target = () => cardRectIn(document.querySelector('[data-w="played"] .pl-slot')) ?? cardRectIn(document.querySelector('[data-w="pile"][data-kind="discard"] .pile-card'));

export function mountHand(host, opts = {}) {
  if (!host) return { destroy() {} };
  const P = { ...HAND_DEFAULTS, ...opts };
  if (P.form === 'list') return mountList(host, P);

  host.classList.add('hand', 'f-' + P.form);
  host.style.setProperty('--card-w', P.w + 'rem');
  const items = new Map(); // card no -> { vis, hit }
  let hovered = null;
  let open = false;
  let drag = null;

  if (P.zone) {
    const z = document.createElement('div');
    z.className = 'hand-zone';
    z.style.cssText = `width:${P.zone.w}rem;height:${P.zone.h}rem;left:${-P.zone.w / 2 + (P.zone.x ?? 0)}rem;bottom:${-(P.zone.y ?? 0)}rem`;
    host.appendChild(z);
  }

  function rest(i, n, isOpen) {
    const k = !isOpen && P.idle ? P.idle : null;
    const s = k?.scale ?? 1;
    const sink = k?.sink ?? P.sink;
    if (P.corner) {
      const c = P.corner;
      const a = n > 1 ? c.from + ((c.to - c.from) * i) / (n - 1) : (c.from + c.to) / 2;
      return { x: Math.sin(rad(a)) * c.r0, y: -Math.cos(rad(a)) * c.r0 + sink, r: a, s, z: i };
    }
    const step = n > 1 ? Math.min(k?.step ?? P.step, P.span / (n - 1)) : 0;
    const t = i - (n - 1) / 2;
    const r = t * P.arc;
    const drop = P.arc ? (step / rad(P.arc)) * (1 - Math.cos(rad(r))) : 0;
    return { x: t * step, y: sink + drop, r, s, z: i };
  }

  const css = (p) => `translate(${p.x.toFixed(3)}rem, ${p.y.toFixed(3)}rem) rotate(${p.r.toFixed(2)}deg) scale(${p.s.toFixed(3)})`;

  function layout() {
    const order = S.hand.filter((no) => items.has(no));
    const n = order.length;
    const isOpen = open || !!drag;
    const h = hovered && !drag ? order.indexOf(hovered) : -1;
    const box = host.getBoundingClientRect();
    const u = rem();
    order.forEach((no, i) => {
      const it = items.get(no);
      const base = rest(i, n, isOpen);
      it.hit.style.transform = css(base);
      it.hit.style.zIndex = String(i);
      if (drag && drag.no === no && drag.moved) return;
      let p = base;
      if (i === h) {
        const half = (P.w * P.hover) / 2;
        let x = P.hoverAt ? P.hoverAt.x : base.x;
        // keep the enlarged card on the screen
        const lo = (0.8 * u - box.left) / u + half;
        const hi = (window.innerWidth - 0.8 * u - box.left) / u - half;
        x = Math.min(hi, Math.max(lo, x));
        p = { x, y: P.hoverAt ? P.hoverAt.y : -P.rise, r: 0, s: P.hover, z: 900 };
      } else if (h >= 0 && !P.hoverAt) {
        const d = i - h;
        const push = (Math.sign(d) * P.push) / (1 + 0.7 * (Math.abs(d) - 1));
        p = P.corner ? base : { ...base, x: base.x + push };
      }
      it.vis.style.transform = css(p);
      it.vis.style.zIndex = String(p.z);
      it.vis.classList.toggle('is-up', i === h);
    });
    host.classList.toggle('open', isOpen);
    host.classList.toggle('has-hover', h >= 0);
  }

  function add(no, born) {
    const vis = document.createElement('div');
    vis.className = 'hc';
    vis.appendChild(cardEl(no));
    const hit = document.createElement('div');
    hit.className = 'hh';
    hit.dataset.no = no;
    hit.title = '';
    host.append(vis, hit);
    items.set(no, { vis, hit });
    fitCard(vis.firstChild);
    if (born) {
      // start where the draw pile is, then travel to its place in the hand
      const box = host.getBoundingClientRect();
      const u = rem();
      vis.style.transition = 'none';
      vis.style.transform = css({ x: (born.left + born.width / 2 - box.left) / u, y: (born.top + born.height - box.bottom) / u, r: 0, s: born.width / (P.w * u) });
      void vis.offsetWidth;
      vis.style.transition = '';
    }
    hit.addEventListener('pointerenter', () => {
      if (drag) return;
      hovered = no;
      layout();
    });
    hit.addEventListener('pointerleave', () => {
      if (drag || hovered !== no) return;
      hovered = null;
      layout();
    });
    hit.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      hit.setPointerCapture(e.pointerId);
      drag = { no, x0: e.clientX, y0: e.clientY, moved: false, armed: false, id: e.pointerId };
    });
    hit.addEventListener('pointermove', (e) => {
      if (!drag || drag.no !== no) return;
      const dist = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
      const u = rem();
      if (!drag.moved) {
        if (dist < 6) return;
        drag.moved = true;
        vis.classList.add('is-drag');
        vis.classList.remove('is-up');
        layout();
      }
      const box = host.getBoundingClientRect();
      const h = P.w * 1.4 * P.dragScale;
      vis.style.transform = css({ x: (e.clientX - box.left) / u, y: (e.clientY - box.bottom) / u + h * 0.5, r: 0, s: P.dragScale });
      vis.style.zIndex = '950';
      const armed = dist > P.arm * u;
      if (armed !== drag.armed) {
        drag.armed = armed;
        vis.classList.toggle('is-armed', armed);
        document.body.classList.toggle('card-armed', armed);
      }
    });
    const end = (e) => {
      if (!drag || drag.no !== no) return;
      const d = drag;
      drag = null;
      if (hit.hasPointerCapture(e.pointerId)) hit.releasePointerCapture(e.pointerId);
      vis.classList.remove('is-drag', 'is-armed');
      document.body.classList.remove('card-armed');
      hovered = null;
      if (d.moved && d.armed && e.type === 'pointerup') {
        const from = vis.firstChild.getBoundingClientRect();
        const to = target();
        vis.style.visibility = 'hidden';
        if (to) fly(vis.firstChild, from, to);
        actions.play(no);
      } else layout();
    };
    hit.addEventListener('pointerup', end);
    hit.addEventListener('pointercancel', end);
  }

  function sync(_s, what) {
    const deck = what === 'draw' || what === 'turn' ? cardRectIn(document.querySelector('[data-w="pile"][data-kind="deck"] .pile-card')) : null;
    for (const [no, it] of items)
      if (!S.hand.includes(no)) {
        it.vis.remove();
        it.hit.remove();
        items.delete(no);
        if (hovered === no) hovered = null;
      }
    for (const no of S.hand) if (!items.has(no)) add(no, deck);
    layout();
  }

  const onEnter = () => {
    open = true;
    layout();
  };
  const onLeave = () => {
    open = false;
    if (!drag) hovered = null;
    layout();
  };
  host.addEventListener('pointerenter', onEnter);
  host.addEventListener('pointerleave', onLeave);
  window.addEventListener('resize', layout);
  const off = on(sync);
  sync(S, 'mount');

  return {
    /** For screenshots and tests: hold a card up without a pointer. */
    hover(no) {
      hovered = no;
      open = no !== null;
      layout();
    },
    destroy() {
      off();
      window.removeEventListener('resize', layout);
      host.removeEventListener('pointerenter', onEnter);
      host.removeEventListener('pointerleave', onLeave);
      document.body.classList.remove('card-armed');
      host.replaceChildren();
    },
  };
}

/* ------------------------------------------------------------------ the hand as a list */

const KIND = { us: '美方事件', ussr: '苏方事件', neutral: '中立事件', tally: '计分' };
const ERA = { early: '早期', middle: '中期', late: '后期' };

function mountList(host, P) {
  host.classList.add('hand-list');
  host.innerHTML = '<div class="hl-rows"></div><div class="hl-preview" hidden></div>';
  const rows = host.firstChild;
  const preview = host.lastChild;
  preview.style.setProperty('--card-w', P.w * P.hover + 'rem');
  let shown = null;
  let drag = null;

  function show(no, row) {
    if (shown === no) return;
    shown = no;
    preview.replaceChildren();
    preview.hidden = !no;
    for (const r of rows.children) r.classList.toggle('is-on', r.dataset.no === no);
    if (!no) return;
    const card = cardEl(no);
    preview.appendChild(card);
    fitCard(card);
    // beside the list, level with the row, kept on the screen
    const hostBox = host.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    const h = preview.offsetHeight;
    const u = rem();
    const top = Math.min(window.innerHeight - h - 1.2 * u, Math.max(1.2 * u, r.top + r.height / 2 - h / 2));
    preview.style.top = top - hostBox.top + 'px';
  }

  function render() {
    rows.innerHTML = S.hand
      .map((no) => {
        const c = byNo[no];
        return (
          `<div class="hl-row side-${c.side}" data-no="${no}">` +
          `<b class="hl-val">${c.side === 'tally' ? '✦' : c.value}</b>` +
          `<span class="hl-text"><span class="hl-title">${c.title}</span><span class="hl-meta">${KIND[c.side]} · ${ERA[c.era]}${c.once ? ' · 一次性' : ''}</span></span>` +
          '</div>'
        );
      })
      .join('');
    shown = null;
    preview.hidden = true;
  }

  const rowOf = (e) => (e.target instanceof Element ? e.target.closest('.hl-row') : null);
  const over = (e) => {
    const row = rowOf(e);
    if (row && !drag) show(row.dataset.no, row);
  };
  const out = (e) => {
    if (!drag && !(e.relatedTarget instanceof Node && rows.contains(e.relatedTarget))) show(null);
  };
  const down = (e) => {
    const row = rowOf(e);
    if (!row || e.button !== 0) return;
    e.preventDefault();
    rows.setPointerCapture(e.pointerId);
    drag = { no: row.dataset.no, row, x0: e.clientX, y0: e.clientY, ghost: null, armed: false };
  };
  const move = (e) => {
    if (!drag) return;
    const dist = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
    const u = rem();
    if (!drag.ghost) {
      if (dist < 6) return;
      show(null);
      const g = cardEl(drag.no, 'hl-ghost');
      g.style.setProperty('--card-w', P.w + 'rem');
      (document.getElementById('fly') ?? document.body).appendChild(g);
      fitCard(g);
      drag.ghost = g;
      drag.row.classList.add('is-gone');
    }
    const w = P.w * u;
    drag.ghost.style.transform = `translate(${e.clientX - w / 2}px, ${e.clientY - w * 0.7}px)`;
    const armed = dist > P.arm * u;
    if (armed !== drag.armed) {
      drag.armed = armed;
      drag.ghost.classList.toggle('is-armed', armed);
      document.body.classList.toggle('card-armed', armed);
    }
  };
  const up = (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (rows.hasPointerCapture(e.pointerId)) rows.releasePointerCapture(e.pointerId);
    document.body.classList.remove('card-armed');
    d.row.classList.remove('is-gone');
    if (!d.ghost) return;
    const from = d.ghost.getBoundingClientRect();
    const to = target();
    if (d.armed && e.type === 'pointerup') {
      if (to) fly(d.ghost, from, to);
      d.ghost.remove();
      actions.play(d.no);
    } else d.ghost.remove();
  };
  rows.addEventListener('pointerover', over);
  rows.addEventListener('pointerout', out);
  rows.addEventListener('pointerdown', down);
  rows.addEventListener('pointermove', move);
  rows.addEventListener('pointerup', up);
  rows.addEventListener('pointercancel', up);
  const off = on(render);
  render();

  return {
    hover(no) {
      const row = no && rows.querySelector(`[data-no="${no}"]`);
      show(row ? no : null, row);
    },
    destroy() {
      off();
      document.body.classList.remove('card-armed');
      host.replaceChildren();
    },
  };
}
