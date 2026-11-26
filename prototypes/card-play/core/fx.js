// Small effects every variant can use: waiting, a mote that flies from a cause to its consequence,
// a frame that lights up around a meter, a veil with holes, a banner. All of it lives in one layer
// that is thrown away when the variant is.
import { ABORT } from './game.js';

const NS = 'http://www.w3.org/2000/svg';

/** A point from an element, a rectangle or a point. */
export function centre(x) {
  if (!x) return null;
  const r = x instanceof Element ? x.getBoundingClientRect() : x;
  if ('width' in r) return r.width || r.height ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  return { x: r.x, y: r.y };
}

export function makeFx(layer, signal, pace) {
  const skips = new Set();

  /** Waits. Cut short by skip() (the space bar); stretched or shrunk by the pace setting. */
  function wait(ms) {
    return new Promise((res, rej) => {
      if (signal.aborted) return rej(ABORT);
      const done = () => {
        clearTimeout(t);
        skips.delete(done);
        res();
      };
      const t = setTimeout(done, ms * pace());
      skips.add(done);
      signal.addEventListener('abort', () => (clearTimeout(t), skips.delete(done), rej(ABORT)), { once: true });
    });
  }
  const skip = () => [...skips].forEach((fn) => fn());

  /** The next `type` event on a target, as a promise that dies with the variant. */
  function once(target, type) {
    return new Promise((res, rej) => {
      if (signal.aborted) return rej(ABORT);
      const on = (e) => {
        target.removeEventListener(type, on);
        res(e);
      };
      target.addEventListener(type, on);
      signal.addEventListener('abort', () => (target.removeEventListener(type, on), rej(ABORT)), { once: true });
    });
  }

  function el(tag, cls = '', html = '') {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html) n.innerHTML = html;
    return n;
  }

  /**
   * A mote of light flies from one place to another along a shallow arc, trailing a tail.
   * from / to: element, rectangle or point. cls: 'a' | 'b' | 'gold' | 'bad' picks the colour.
   */
  async function tracer(from, to, { cls = 'gold', ms = 620, bend = 0.22 } = {}) {
    const a = centre(from);
    const b = centre(to);
    if (!a || !b) return;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', `cp-tracer ${cls}`);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len0 = Math.hypot(dx, dy) || 1;
    // the control point sits off the straight line, on the upper side
    const side = dx >= 0 ? -1 : 1;
    const cx = (a.x + b.x) / 2 + (-dy / len0) * len0 * bend * side * -1;
    const cy = (a.y + b.y) / 2 + (dx / len0) * len0 * bend * side * -1 - len0 * 0.06;
    const d = `M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`;
    svg.innerHTML = `<path class="tail" d="${d}"/><circle class="head" r="7"/><circle class="core" r="3"/>`;
    layer.appendChild(svg);
    const tail = svg.querySelector('.tail');
    const head = svg.querySelector('.head');
    const core = svg.querySelector('.core');
    const len = tail.getTotalLength();
    const seg = Math.min(len * 0.45, 220);
    tail.style.strokeDasharray = `${seg} ${len + seg}`;
    const t0 = performance.now();
    const dur = ms * pace();
    await new Promise((res) => {
      const tick = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const p = tail.getPointAtLength(e * len);
        head.setAttribute('cx', p.x);
        head.setAttribute('cy', p.y);
        core.setAttribute('cx', p.x);
        core.setAttribute('cy', p.y);
        tail.style.strokeDashoffset = String(seg - e * len);
        if (t < 1 && !signal.aborted) requestAnimationFrame(tick);
        else res();
      };
      requestAnimationFrame(tick);
    });
    svg.classList.add('is-done');
    setTimeout(() => svg.remove(), 400);
    burst(b, cls);
  }

  /** A ring opening at a point. */
  function burst(at, cls = 'gold') {
    const p = centre(at);
    if (!p) return;
    const n = el('i', `cp-burst ${cls}`);
    n.style.left = p.x + 'px';
    n.style.top = p.y + 'px';
    layer.appendChild(n);
    setTimeout(() => n.remove(), 900);
  }

  /**
   * Lights a frame round an element (a meter, a pane) and hangs a tag on it.
   *   flash(el, { label: '核危机 4 → 3', cls: 'bad', ms: 2200, place: 'above' })
   * Returns at once; the frame takes itself away after ms. Only one frame is up at a time.
   */
  function flash(target, { label = '', cls = 'gold', ms = 2200, place = 'above', pad = 8 } = {}) {
    const r = (target instanceof Element ? target : null)?.getBoundingClientRect() ?? target;
    if (!r || !r.width) return null;
    for (const old of layer.querySelectorAll('.cp-flash')) old.remove();
    const n = el('div', `cp-flash ${cls} at-${place}`, label ? `<b>${label}</b>` : '');
    Object.assign(n.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    layer.appendChild(n);
    setTimeout(() => n.classList.add('is-out'), ms * pace());
    setTimeout(() => n.remove(), ms * pace() + 500);
    return n;
  }

  /** Words in the middle of the screen for a moment. */
  async function banner(html, { ms = 1300, cls = '' } = {}) {
    const n = el('div', `cp-banner ${cls}`, html);
    layer.appendChild(n);
    try {
      await wait(ms);
    } finally {
      n.classList.add('is-out');
      setTimeout(() => n.remove(), 450);
    }
  }

  /**
   * Darkens everything except round holes. holes: [{ x, y, r }] or elements / rectangles.
   * Returns { set(holes), close() }.
   */
  function veil(holes = [], { opacity = 0.62 } = {}) {
    const id = 'cpv' + Math.random().toString(36).slice(2, 8);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'cp-veil');
    svg.innerHTML = `<defs><filter id="${id}f"><feGaussianBlur stdDeviation="14"/></filter><mask id="${id}"><rect width="100%" height="100%" fill="#fff"/><g filter="url(#${id}f)"></g></mask></defs><rect width="100%" height="100%" fill="rgba(6,5,4,${opacity})" mask="url(#${id})"/>`;
    layer.prepend(svg);
    const g = svg.querySelector('g');
    const set = (list) => {
      g.innerHTML = list
        .map((h) => {
          if (h instanceof Element) h = h.getBoundingClientRect();
          if ('width' in h) return `<rect x="${h.left - 14}" y="${h.top - 14}" width="${h.width + 28}" height="${h.height + 28}" rx="22" fill="#000"/>`;
          return `<circle cx="${h.x}" cy="${h.y}" r="${h.r ?? 60}" fill="#000"/>`;
        })
        .join('');
    };
    set(holes);
    requestAnimationFrame(() => svg.classList.add('is-on'));
    return {
      set,
      close() {
        svg.classList.remove('is-on');
        setTimeout(() => svg.remove(), 450);
      },
    };
  }

  /** A short shake, for when something lands hard. */
  function shake(target, px = 6, ms = 380) {
    target.animate([0, 1, -1, 0.7, -0.5, 0.3, 0].map((k) => ({ transform: `translate(${k * px}px, ${-k * px * 0.4}px)` })), { duration: ms, composite: 'add' });
  }

  return { wait, skip, once, el, tracer, burst, flash, banner, veil, shake };
}
