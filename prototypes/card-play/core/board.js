// The map as the card-play variants use it: where a country is on screen, which countries are
// offered for a move, a click on one of them, and the small things that happen at a country
// (a number popping up, a ring, a badge). The live map module is used as it is; this file is the
// one place that reaches into its private parts, so a variant never has to.
import { ABORT } from './game.js';

const SAFE = { left: 0.07, right: 0.07, top: 0.14, bottom: 0.3 };

export function makeBoard(map, host, signal) {
  const inner = map;
  const rig = inner.rig;
  const plateOf = new Map([...inner.stage.querySelectorAll('.wm-plate')].map((el) => [el.dataset.id, el]));
  const nodeOf = new Map(map.pack.countries.map((c) => [c.id, c.node]));
  const indexOf = (id) => inner.indexOf.get(id);
  const fxLayer = document.createElement('div');
  fxLayer.className = 'cp-board-fx';
  host.appendChild(fxLayer);

  let marks = null; // { kind, ok:Set, locked:Map, warn:Set, lift:Set }
  let pending = null; // { ok:Set, resolve, reject }
  let viewBefore = null; // where the view was before we first moved it for the play in hand
  let userMoved = false;
  const hoverFns = new Set();
  const clickFns = new Set();

  /* ------------------------------------------------------------------ where things are */
  const el = (id) => plateOf.get(id) ?? null;
  function rect(id) {
    const p = plateOf.get(id);
    if (!p || p.style.display === 'none') return null;
    const r = p.querySelector('.wm-plate-body').getBoundingClientRect();
    return r.width ? r : null;
  }
  function at(id) {
    const r = rect(id);
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  }
  function frame() {
    const b = host.getBoundingClientRect();
    return { left: b.left + b.width * SAFE.left, right: b.right - b.width * SAFE.right, top: b.top + b.height * SAFE.top, bottom: b.bottom - b.height * SAFE.bottom };
  }
  /** The country at a screen point: a node if the point is on or near one, else the land under it. */
  function countryAt(x, y, reach = 26) {
    let best = null;
    let bestD = reach;
    for (const [id, p] of plateOf) {
      if (p.style.display === 'none' || p.classList.contains('superpower')) continue;
      const r = p.querySelector('.wm-plate-body').getBoundingClientRect();
      const dx = Math.max(r.left - x, 0, x - r.right);
      const dy = Math.max(r.top - y, 0, y - r.bottom);
      const d = Math.hypot(dx, dy);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    if (best) return best;
    const id = inner.pickCountry(x, y);
    return id && plateOf.has(id) && !plateOf.get(id).classList.contains('superpower') ? id : null;
  }

  /** On screen and clear of the HUD's corners and the hand. */
  function inView(id) {
    const p = at(id);
    const f = frame();
    return !!p && p.x > f.left && p.x < f.right && p.y > f.top && p.y < f.bottom;
  }

  const sleep = (ms) =>
    new Promise((res, rej) => {
      if (signal.aborted) return rej(ABORT);
      const t = setTimeout(res, ms);
      signal.addEventListener('abort', () => (clearTimeout(t), rej(ABORT)), { once: true });
    });

  /**
   * Brings countries into view. Does nothing if they already are. One country: the view slides to
   * it at the zoom it has; several: the view pulls back just enough to hold them all.
   * `zoom: true` flies in close to a single country instead.
   */
  async function show(ids, { zoom = false, force = false } = {}) {
    ids = [ids].flat().filter((id) => nodeOf.has(id));
    if (!ids.length) return;
    if (!force && !zoom && ids.every(inView)) return;
    if (!viewBefore) {
      viewBefore = { ...rig.goal };
      userMoved = false;
    }
    if (zoom && ids.length === 1) map.flyTo(ids[0]);
    else if (ids.length === 1) {
      const [x, z] = nodeOf.get(ids[0]);
      // a touch north of centre, so the hand does not sit on it
      rig.panTo(rig.nearestX(x), z + rig.unitsPerPixel * host.clientHeight * 0.07);
    } else {
      const xs = ids.map((id) => rig.nearestX(nodeOf.get(id)[0]));
      const zs = ids.map((id) => nodeOf.get(id)[1]);
      const pad = 9;
      rig.flyToBox([Math.min(...xs) - pad, Math.min(...zs) - pad, Math.max(...xs) + pad, Math.max(...zs) + pad * 1.6], { maxZoom: 1 });
    }
    await sleep(620);
  }
  const home = () => (rig.flyHome(), sleep(620));
  /**
   * Puts the view back where it was before show() first moved it, unless the player has moved the
   * map themselves since. Called by the page after every play; a variant need not call it.
   */
  function restView() {
    if (viewBefore && !userMoved) {
      rig.goal = { ...viewBefore, x: rig.nearestX(viewBefore.x) };
      rig.dirty = true;
    }
    viewBefore = null;
  }
  const onUserMove = (e) => {
    if (viewBefore && (e.type === 'wheel' || rig.dragging)) userMoved = true;
  };
  inner.stage.addEventListener('wheel', onUserMove, { passive: true });
  inner.stage.addEventListener('pointermove', onUserMove);

  /* ------------------------------------------------------------------ offering countries */
  // While countries are on offer the map's own idea of focus is replaced by ours: the offered ones
  // stay lit, the rest step back, and the one under the pointer stands up.
  function ourFocus() {
    const hov = inner.hovered?.kind === 'country' ? inner.hovered.id : null;
    const lit = [...marks.ok];
    const up = [...marks.lift, ...(hov && marks.ok.has(hov) ? [hov] : [])];
    inner.territories.setFocus({ primary: (marks.land ? lit : up).map(indexOf), lifted: up.map(indexOf) });
    inner.plates.setFocus(new Set([...lit, ...marks.keep]), null, hov && (marks.ok.has(hov) || marks.locked.has(hov)) ? hov : null);
    inner.links.show(null);
    inner.labels.setFocus(null);
    inner.vignettes.setFocus(-1);
    inner.motes.setFocus(null);
  }

  /**
   * Says which countries are on offer. Pass null to hand the map back.
   *   kind     'place' | 'coup' | 'realign' | 'event' | 'show': picks the colour of the marks
   *   ok       ids that can be chosen
   *   locked   Map(id -> reason): shown as barred, with the reason on hover
   *   warn     ids that carry a warning (a battleground under a coup)
   *   lift     ids whose land stands up (what has been chosen so far)
   *   keep     ids that stay bright without being on offer
   *   land     false leaves the land alone and marks only the nodes
   */
  function mark(spec) {
    for (const p of plateOf.values()) p.classList.remove('cp-ok', 'cp-lock', 'cp-warn', 'cp-lift');
    if (!spec) {
      marks = null;
      delete inner.stage.dataset.cp;
      delete inner.applyFocus;
      inner.applyFocus();
      return;
    }
    marks = { kind: spec.kind ?? 'show', ok: new Set(spec.ok?.keys?.() ?? spec.ok ?? []), locked: new Map(spec.locked ?? []), warn: new Set(spec.warn ?? []), lift: new Set(spec.lift ?? []), keep: new Set(spec.keep ?? []), land: spec.land !== false };
    inner.stage.dataset.cp = marks.kind;
    for (const id of marks.ok) plateOf.get(id)?.classList.add('cp-ok');
    for (const id of marks.locked.keys()) plateOf.get(id)?.classList.add('cp-lock');
    for (const id of marks.warn) plateOf.get(id)?.classList.add('cp-warn');
    for (const id of marks.lift) plateOf.get(id)?.classList.add('cp-lift');
    inner.applyFocus = ourFocus;
    ourFocus();
  }

  /** The next click on one of `ok`. Resolves with null if cancelPick() is called first. */
  function pick(ok) {
    cancelPick();
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(ABORT);
      pending = { ok: new Set(ok?.keys?.() ?? ok), resolve, reject };
    });
  }
  function cancelPick() {
    const p = pending;
    pending = null;
    p?.resolve(null);
  }

  // Every click on the map comes here first. The map's own "select and pin" is switched off on
  // this page: a click either answers a question a variant asked, or it does nothing.
  const countryUnder = (e) => inner.plates.countryAt(e.target) ?? inner.pickCountry(e.clientX, e.clientY);
  function onClick(e) {
    if (!(e.target instanceof Element) || !inner.stage.contains(e.target)) return;
    e.stopPropagation();
    if (rig.dragged) return;
    const id = countryUnder(e);
    if (pending && id && pending.ok.has(id)) {
      const p = pending;
      pending = null;
      p.resolve(id);
      return;
    }
    for (const fn of [...clickFns]) fn(id, e);
  }
  host.addEventListener('click', onClick, true);

  // bare land always answers with its country here, never with its region
  const targetAt = inner.targetAt.bind(inner);
  inner.targetAt = (x, y, t) => {
    const r = targetAt(x, y, t);
    if (r?.kind !== 'region') return r;
    const id = inner.pickCountry(x, y);
    return id ? { kind: 'country', id } : null;
  };
  const offHover = map.on('hover', (t) => {
    const id = t?.kind === 'country' ? t.id : null;
    for (const fn of [...hoverFns]) fn(id);
  });

  /* ------------------------------------------------------------------ things that happen at a country */
  /** A number or a word rising off a country's node. cls: 'a' | 'b' for a side, 'gold', 'bad'. */
  function pop(id, html, cls = '') {
    const p = plateOf.get(id);
    if (!p) return;
    const n = document.createElement('i');
    n.className = `cp-pop ${cls}`;
    n.innerHTML = html;
    p.appendChild(n);
    setTimeout(() => n.remove(), 1500);
  }
  /** One ring spreading out from a node. */
  function ring(id, cls = '') {
    const p = plateOf.get(id);
    if (!p) return;
    const n = document.createElement('i');
    n.className = `cp-ring ${cls}`;
    p.appendChild(n);
    setTimeout(() => n.remove(), 1100);
  }
  /** A small tag that stays on a node until removed: badge(id, 'cost', '2') ... badge(id, 'cost', null). */
  function badge(id, key, html, cls = '') {
    const p = plateOf.get(id);
    if (!p) return;
    let n = p.querySelector(`:scope > .cp-badge[data-key="${key}"]`);
    if (html === null || html === undefined) return void n?.remove();
    if (!n) {
      n = document.createElement('i');
      n.dataset.key = key;
      p.appendChild(n);
    }
    n.className = `cp-badge cp-badge-${key} ${cls}`;
    n.innerHTML = html;
  }
  function clearBadges(key) {
    for (const n of inner.stage.querySelectorAll(key ? `.cp-badge[data-key="${key}"]` : '.cp-badge')) n.remove();
  }
  /** Makes one node stand at full size with its name, at any zoom. Pass null to let go. */
  function big(id) {
    for (const p of plateOf.values()) p.classList.toggle('cp-big', p.dataset.id === id);
  }

  function destroy() {
    // whoever is still waiting for a click is waiting for a variant that has gone
    pending?.reject(ABORT);
    pending = null;
    inner.stage.removeEventListener('wheel', onUserMove);
    inner.stage.removeEventListener('pointermove', onUserMove);
    mark(null);
    big(null);
    clearBadges();
    host.removeEventListener('click', onClick, true);
    inner.targetAt = targetAt;
    offHover();
    fxLayer.remove();
    for (const n of inner.stage.querySelectorAll('.cp-pop, .cp-ring')) n.remove();
  }

  return {
    map, el, rect, at, countryAt, inView, show, home, restView, mark, pick, cancelPick, pop, ring, badge, clearBadges, big, destroy,
    get hovered() {
      return inner.hovered?.kind === 'country' ? inner.hovered.id : null;
    },
    get zoom() {
      return rig.zoom;
    },
    onHover: (fn) => (hoverFns.add(fn), () => hoverFns.delete(fn)),
    onClick: (fn) => (clickFns.add(fn), () => clickFns.delete(fn)),
  };
}
