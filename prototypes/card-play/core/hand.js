// The player's hand: a fan at the bottom, a card grows under the pointer, and a card can be
// clicked or dragged out. The fan is the one from prototypes/hud-layouts (layout 04); what is new
// is that nothing happens by itself when a card leaves. The active variant is told, and decides.
//
//   hand.hooks = {
//     onPick(no, rect)                 a card was clicked
//     onDragStart(no)
//     onDrag(no, { x, y, armed })      armed: far enough from the hand that letting go plays it
//     onDrop(no, { x, y, armed, rect })   return true to keep the card out of the hand
//   }
//   hand.hold(no) / hand.release(no)   take a card out of the fan for a while, put it back
//   hand.live(on)                      the hand answers the pointer, or sits low and waits
//   hand.away(on)                      the hand leaves the screen altogether
import { cardEl, fitCard } from '../../hud-layouts/cards.js';

const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
const rad = (d) => (d * Math.PI) / 180;

export const HAND = { w: 13, step: 8.6, span: 66, arc: 2.6, sink: 5, hover: 2.05, rise: 1, push: 1.4, arm: 10, dragScale: 1.1 };

export function mountHand(host, opts = {}) {
  const P = { ...HAND, ...opts };
  host.classList.add('hand', 'f-fan', 'cp-hand');
  host.style.setProperty('--card-w', P.w + 'rem');
  const items = new Map(); // no -> { vis, hit }
  const held = new Set();
  let order = [];
  let hovered = null;
  let open = false;
  let drag = null;
  let isLive = true;
  const api = { hooks: {} };

  const shown = () => order.filter((no) => items.has(no) && !held.has(no));

  function rest(i, n) {
    const step = n > 1 ? Math.min(P.step, P.span / (n - 1)) : 0;
    const t = i - (n - 1) / 2;
    const r = t * P.arc;
    const drop = P.arc ? (step / rad(P.arc)) * (1 - Math.cos(rad(r))) : 0;
    return { x: t * step, y: P.sink + drop, r, s: 1, z: i };
  }
  const css = (p) => `translate(${p.x.toFixed(3)}rem, ${p.y.toFixed(3)}rem) rotate(${p.r.toFixed(2)}deg) scale(${p.s.toFixed(3)})`;

  function layout() {
    const list = shown();
    const n = list.length;
    const h = hovered && !drag && isLive ? list.indexOf(hovered) : -1;
    const box = host.getBoundingClientRect();
    const u = rem();
    list.forEach((no, i) => {
      const it = items.get(no);
      const base = rest(i, n);
      it.hit.style.transform = css(base);
      it.hit.style.zIndex = String(i);
      it.vis.style.visibility = '';
      it.hit.style.display = '';
      if (drag && drag.no === no && drag.moved) return;
      let p = base;
      if (i === h) {
        const half = (P.w * P.hover) / 2;
        const lo = (0.8 * u - box.left) / u + half;
        const hi = (window.innerWidth - 0.8 * u - box.left) / u - half;
        p = { x: Math.min(hi, Math.max(lo, base.x)), y: -P.rise, r: 0, s: P.hover, z: 900 };
      } else if (h >= 0) {
        const d = i - h;
        p = { ...base, x: base.x + (Math.sign(d) * P.push) / (1 + 0.7 * (Math.abs(d) - 1)) };
      }
      it.vis.style.transform = css(p);
      it.vis.style.zIndex = String(p.z);
      it.vis.classList.toggle('is-up', i === h);
    });
    for (const no of held) {
      const it = items.get(no);
      if (!it) continue;
      it.vis.style.visibility = 'hidden';
      it.hit.style.display = 'none';
    }
    host.classList.toggle('open', open || !!drag);
  }

  function add(no) {
    const vis = document.createElement('div');
    vis.className = 'hc';
    vis.appendChild(cardEl(no));
    const hit = document.createElement('div');
    hit.className = 'hh';
    hit.dataset.no = no;
    host.append(vis, hit);
    items.set(no, { vis, hit });
    fitCard(vis.firstChild);

    hit.addEventListener('pointerenter', () => {
      if (drag || !isLive) return;
      hovered = no;
      layout();
    });
    hit.addEventListener('pointerleave', () => {
      if (drag || hovered !== no) return;
      hovered = null;
      layout();
    });
    hit.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !isLive) return;
      e.preventDefault();
      hit.setPointerCapture(e.pointerId);
      drag = { no, x0: e.clientX, y0: e.clientY, moved: false, armed: false };
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
        api.hooks.onDragStart?.(no);
      }
      const box = host.getBoundingClientRect();
      const h = P.w * 1.4 * P.dragScale;
      vis.style.transform = css({ x: (e.clientX - box.left) / u, y: (e.clientY - box.bottom) / u + h * 0.5, r: 0, s: P.dragScale });
      vis.style.zIndex = '950';
      drag.armed = dist > P.arm * u;
      vis.classList.toggle('is-armed', drag.armed);
      api.hooks.onDrag?.(no, { x: e.clientX, y: e.clientY, armed: drag.armed });
    });
    const end = (e) => {
      if (!drag || drag.no !== no) return;
      const d = drag;
      drag = null;
      if (hit.hasPointerCapture(e.pointerId)) hit.releasePointerCapture(e.pointerId);
      const rect = vis.firstChild.getBoundingClientRect();
      vis.classList.remove('is-drag', 'is-armed');
      hovered = null;
      if (e.type !== 'pointerup') return layout();
      if (!d.moved) api.hooks.onPick?.(no, rect);
      else if (api.hooks.onDrop?.(no, { x: e.clientX, y: e.clientY, armed: d.armed, rect }) === true) held.add(no);
      layout();
    };
    hit.addEventListener('pointerup', end);
    hit.addEventListener('pointercancel', end);
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

  Object.assign(api, {
    /** The cards in the hand, in order. Cards no longer listed are dropped; new ones appear. */
    set(nos) {
      order = [...nos];
      for (const [no, it] of items)
        if (!order.includes(no)) {
          it.vis.remove();
          it.hit.remove();
          items.delete(no);
          held.delete(no);
          if (hovered === no) hovered = null;
        }
      for (const no of order) if (!items.has(no)) add(no);
      layout();
    },
    /** Where a card's picture is on screen right now. */
    rectOf(no) {
      const it = items.get(no);
      return it ? it.vis.firstChild.getBoundingClientRect() : null;
    },
    /** Takes a card out of the fan (it is shown somewhere else for now). Returns where it was. */
    hold(no) {
      const r = api.rectOf(no);
      held.add(no);
      hovered = null;
      layout();
      return r;
    },
    release(no) {
      if (no === undefined) held.clear();
      else held.delete(no);
      layout();
    },
    /** Slides the whole hand off the bottom of the screen, for when something else needs the space. */
    away(on) {
      host.classList.toggle('is-away', on);
    },
    live(on) {
      isLive = on;
      host.classList.toggle('is-waiting', !on);
      if (!on) hovered = null;
      layout();
    },
    /** For screenshots and tests: hold a card up without a pointer. */
    hover(no) {
      hovered = no;
      layout();
    },
    /** The cards showing in the fan right now. */
    cards: () => shown(),
    destroy() {
      window.removeEventListener('resize', layout);
      host.removeEventListener('pointerenter', onEnter);
      host.removeEventListener('pointerleave', onLeave);
      host.replaceChildren();
    },
  });
  return api;
}
