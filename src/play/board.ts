import { text as displayText } from '../i18n/index.js';
// The map as the staging uses it: where a country is on screen, which countries are on offer, a
// click on one of them, and the small things that happen at a country (a word rising off it, a
// ring, a tag). Everything goes through the map's public interface; the nodes themselves are plain
// elements under the map (.wm-plate[data-id]), and what is hung on them here is removed again.
import type { WorldMap } from '../map/WorldMap';
import type { Fx } from './fx';

/** The part of the screen a country has to be in to count as in view: clear of the HUD's corners and the hand. */
const SAFE = { left: 0.07, right: 0.07, top: 0.14, bottom: 0.3 };

export type Marks = {
  /** Countries that can be chosen. */
  ok: Iterable<string>;
  /** Countries shown as barred, with the reason (said on hover by whoever asked). */
  locked?: Iterable<string>;
  /** Countries that carry a warning (a battleground under a coup). */
  warn?: Iterable<string>;
  /** Countries whose land stands up: what has been chosen so far. */
  lift?: Iterable<string>;
  /** Countries that stay bright without being on offer. */
  keep?: Iterable<string>;
};

export type Board = {
  /** The box of a country's node on screen, or null if it is not drawn. */
  rect(id: string): DOMRect | null;
  at(id: string): { x: number; y: number } | null;
  /**
   * Brings a country into view. In view already: nothing moves. `zoom` flies in close instead.
   * The first time the view is moved it is remembered, for restView().
   */
  show(id: string, opts?: { zoom?: boolean }): Promise<void>;
  /**
   * Frames these countries inside a box of the screen (px, in the container), remembering the view
   * for restView() like show() does.
   */
  frame(ids: string[], box: { left: number; top: number; width: number; height: number }): Promise<void>;
  /** Puts the view back where it was before show() first moved it, unless the player has moved the map since. True if it moved. */
  restView(): boolean;
  /** Says which countries are on offer. Null hands the map back. */
  mark(spec: Marks | null): void;
  /** The next click on an offered country. Resolves with null if cancelPick() is called first. */
  pick(): Promise<string | null>;
  cancelPick(): void;
  onHover(fn: (id: string | null) => void): () => void;
  /** A number or a word rising off a country's node. */
  pop(id: string, html: string, cls?: string): void;
  /** One ring spreading out from a node. */
  ring(id: string, cls?: string): void;
  /** A small tag that stays on a node until removed: badge(id, 'cost', '2') ... badge(id, 'cost', null). */
  badge(id: string, key: string, html: string | null, cls?: string): void;
  clearBadges(key?: string): void;
  /** Makes one node stand at full size with its name, at any zoom. Null lets go. */
  big(id: string | null): void;
  /** 0 at the closest zoom, 1 at the farthest. */
  readonly zoom: number;
  dispose(): void;
};

export function makeBoard(map: WorldMap, container: HTMLElement, fx: Fx): Board {
  const plateOf = new Map<string, HTMLElement>();
  for (const el of container.querySelectorAll<HTMLElement>('.wm-plate[data-id]')) plateOf.set(el.dataset.id!, el);
  const mapEl = container.querySelector<HTMLElement>('.wm-stage') ?? container;
  const MARKS = ['pl-ok', 'pl-lock', 'pl-warn', 'pl-lift'];

  let waiting: { resolve(id: string | null): void } | null = null;
  let viewBefore: WorldMap['view'] | null = null;
  let userMoved = false;

  function rect(id: string): DOMRect | null {
    const p = plateOf.get(id);
    if (!p || p.style.display === 'none') return null;
    const r = p.querySelector('.wm-plate-body')?.getBoundingClientRect();
    return r && r.width ? r : null;
  }
  function at(id: string): { x: number; y: number } | null {
    const r = rect(id);
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  }
  function inView(id: string): boolean {
    const p = at(id);
    if (!p) return false;
    const b = container.getBoundingClientRect();
    const rail = container.querySelector('.hud-resolution')?.getBoundingClientRect();
    if (container.querySelector('.has-resolution') && rail && p.x < rail.right + 45 && p.y > rail.top - 40 && p.y < rail.bottom + 40) return false;
    return p.x > b.left + b.width * SAFE.left && p.x < b.right - b.width * SAFE.right && p.y > b.top + b.height * SAFE.top && p.y < b.bottom - b.height * SAFE.bottom;
  }

  async function show(id: string, { zoom = false }: { zoom?: boolean } = {}): Promise<void> {
    if (!plateOf.has(id)) return;
    if (!zoom && inView(id)) return;
    if (!viewBefore) {
      viewBefore = map.view;
      userMoved = false;
    }
    if (zoom) map.flyTo(id);
    else map.panTo(id, container.querySelector('.has-resolution') ? 0.6 : 0.5);
    await fx.wait(620);
    if (zoom && container.querySelector('.has-resolution')) {
      map.panTo(id, 0.6);
      await fx.wait(420);
    }
  }
  function restView(): boolean {
    const back = viewBefore;
    viewBefore = null;
    if (!back || userMoved) return false;
    map.view = back;
    return true;
  }
  // a view the player has moved themselves is theirs to keep
  const onWheel = (): void => {
    if (viewBefore) userMoved = true;
  };
  const onMove = (): void => {
    if (viewBefore && map.dragging) userMoved = true;
  };
  mapEl.addEventListener('wheel', onWheel, { passive: true });
  mapEl.addEventListener('pointermove', onMove);

  function mark(spec: Marks | null): void {
    for (const p of plateOf.values()) p.classList.remove(...MARKS);
    if (!spec) return map.offer(null);
    const ok = [...spec.ok];
    const locked = [...(spec.locked ?? [])];
    const lift = [...(spec.lift ?? [])];
    for (const id of ok) plateOf.get(id)?.classList.add('pl-ok');
    for (const id of locked) plateOf.get(id)?.classList.add('pl-lock');
    for (const id of spec.warn ?? []) plateOf.get(id)?.classList.add('pl-warn');
    for (const id of lift) plateOf.get(id)?.classList.add('pl-lift');
    // barred countries stay readable (and say why under the pointer) without being choosable
    map.offer({ ok, lift, keep: [...(spec.keep ?? []), ...locked] });
  }

  const offPick = map.on('pick', (t) => {
    if (!t || !waiting) return;
    const w = waiting;
    waiting = null;
    w.resolve(t.id);
  });

  function pick(): Promise<string | null> {
    cancelPick();
    const p = fx.pending<string | null>();
    waiting = p;
    return p.promise;
  }
  function cancelPick(): void {
    const w = waiting;
    waiting = null;
    w?.resolve(null);
  }

  const hoverFns = new Set<(id: string | null) => void>();
  const offHover = map.on('hover', (t) => {
    const id = t?.kind === 'country' ? t.id : null;
    for (const fn of [...hoverFns]) fn(id);
  });

  function hang(id: string, cls: string, html: string, life: number): void {
    const p = plateOf.get(id);
    if (!p) return;
    const n = fx.el('i', cls, html);
    p.appendChild(n);
    window.setTimeout(() => n.remove(), life);
  }

  function badge(id: string, key: string, html: string | null, cls = ''): void {
    const p = plateOf.get(id);
    if (!p) return;
    let n = p.querySelector<HTMLElement>(`:scope > .pl-badge[data-key="${key}"]`);
    if (html === null) return void n?.remove();
    if (!n) {
      n = fx.el('i');
      n.dataset.key = key;
      p.appendChild(n);
    }
    n.className = `pl-badge pl-badge-${key} ${cls}`;
    n.innerHTML = displayText(html);
  }
  function clearBadges(key?: string): void {
    for (const n of mapEl.querySelectorAll(key ? `.pl-badge[data-key="${key}"]` : '.pl-badge')) n.remove();
  }
  function big(id: string | null): void {
    for (const [pid, p] of plateOf) p.classList.toggle('pl-big', pid === id);
  }

  return {
    rect,
    at,
    show,
    async frame(ids, box) {
      if (!ids.length) return;
      if (!viewBefore) { viewBefore = map.view; userMoved = false; }
      const canvas = container.getBoundingClientRect();
      map.frameCountries(ids, 3.2, { left: box.left / canvas.width, top: box.top / canvas.height, width: Math.max(100, box.width) / canvas.width, height: Math.max(100, box.height) / canvas.height });
      await fx.wait(650);
    },
    restView,
    mark,
    pick,
    cancelPick,
    onHover(fn) {
      hoverFns.add(fn);
      return () => hoverFns.delete(fn);
    },
    pop: (id, html, cls = '') => hang(id, `pl-pop ${cls}`, html, 1500),
    ring: (id, cls = '') => hang(id, `pl-ring ${cls}`, '', 1100),
    badge,
    clearBadges,
    big,
    get zoom() {
      return map.stats.zoom;
    },
    dispose() {
      waiting = null;
      offPick();
      offHover();
      hoverFns.clear();
      mapEl.removeEventListener('wheel', onWheel);
      mapEl.removeEventListener('pointermove', onMove);
      mark(null);
      big(null);
      clearBadges();
      for (const n of mapEl.querySelectorAll('.pl-pop, .pl-ring')) n.remove();
    },
  };
}
