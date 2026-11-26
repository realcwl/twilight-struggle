import { t as i18n, text as displayText } from '../../i18n/index.js';
// Prototype 01's card shelf, with separate positions for each actual player.
import { type PartFactory, type Part, esc, sideClass, rem } from '../dom';
import type { PassiveEffect, SideIndex } from '../types';
import { highlight } from '../../cards/terms.js';
import { installTermHelp } from '../../cards/tooltips.js';
import '../../ui/sheet.css';
import '../passives.css';

const glyph = (kind: PassiveEffect['kind']) => `<svg viewBox="0 0 24 24" aria-hidden="true">${kind === 'turn'
  ? '<path d="M6 3h12M6 21h12M7 3v4l10 10v4M17 3v4L7 17v4"/>'
  : kind === 'condition' ? '<path d="M7 3h11v17H6V3M4 21L20 2"/>'
  : '<path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/>'}</svg>`;

export const passives: PartFactory = (host, ctx) => {
  host.className = 'ps-layer';
  const other = (1 - ctx.player) as SideIndex;
  const shelves = new Map<SideIndex | null, HTMLElement>();
  const rows = new Map<SideIndex | null, HTMLElement>();
  const nodes = new Map<string, HTMLElement>();
  let effects = new Map<string, PassiveEffect>();
  let shown: string | null = null;
  let timer = 0;
  let termOpen = false;
  const animations = new Set<Animation>();
  const detail = document.createElement('div');
  detail.className = 'ps-detail sheet';
  detail.hidden = true;
  detail.setAttribute('role', 'dialog');
  detail.setAttribute('aria-label', i18n("持续效果详情"));
  // Kept in the HUD for its place in the page; its look is the shared sheet (src/ui/sheet.css).
  ctx.root.append(detail);

  for (const [side, position, caption] of [
    [ctx.player, 'mine', i18n("我方打出")],
    [other, 'theirs', i18n("对手打出")],
    [null, 'legacy', i18n("来源未记录")],
  ] as const) {
    const shelf = document.createElement('section');
    shelf.className = `ps-shelf ps-${position} ${side === null ? 'is-n' : sideClass(side)}`;
    shelf.dataset.passiveSide = side === null ? 'unknown' : String(side);
    shelf.setAttribute('aria-label', i18n("{0} · {1}", [caption, displayText('持续效果')]));
    shelf.hidden = true;
    shelf.innerHTML = displayText(`<div class="ps-head"><span class="ps-who">${side === null ? '?' : esc(ctx.sideShort(side))}</span><span class="hud-lb">${caption}</span><b class="hud-num"></b></div><div class="ps-row"></div>`);
    host.append(shelf);
    shelves.set(side, shelf);
    const row = shelf.querySelector<HTMLElement>('.ps-row')!;
    rows.set(side, row);
    row.addEventListener('scroll', () => placeDetail(), { passive: true });
  }
  const who = (effect: PassiveEffect): string => effect.by === null
    ? (i18n("旧存档未记录出牌方"))
    : i18n("{0} · {1}", [effect.by === ctx.player ? (displayText('我方打出')) : (displayText('对手打出')), ctx.sideName(effect.by)]);
  function placeDetail(): void {
    if (!shown || detail.hidden) return;
    const anchor = nodes.get(shown);
    if (!anchor?.isConnected) return hide();
    const r = anchor.getBoundingClientRect(), gap = rem(), w = detail.offsetWidth, h = detail.offsetHeight;
    const below = r.top < innerHeight / 2;
    const x = Math.max(8, Math.min(innerWidth - w - 8, r.left));
    const y = Math.max(8, Math.min(innerHeight - h - 8, below ? r.bottom + gap : r.top - h - gap));
    detail.style.left = `${x}px`;
    detail.style.top = `${y}px`;
  }
  function show(id: string): void {
    clearTimeout(timer);
    const effect = effects.get(id), anchor = nodes.get(id);
    if (!effect || !anchor) return;
    if (shown === id) return;
    hide();
    shown = id;
    anchor.setAttribute('aria-expanded', 'true');
    detail.className = `ps-detail sheet ${effect.by === null ? 'is-n' : sideClass(effect.by)}`;
    detail.innerHTML = i18n("<button type=\"button\" class=\"ps-close sheet-x\" aria-label=\"{0}\">×</button><div class=\"ps-detail-card\"></div><div class=\"ps-facts\"><div class=\"sheet-head\"><div class=\"ps-by sheet-kicker\">{1}</div><h3 class=\"sheet-title\">{2}</h3></div><p>{3}</p><dl><dt>{4}</dt><dd>{5}{6}</dd><dt>{7}</dt><dd>{8}</dd><dt>{9}</dt><dd>{10}</dd></dl></div>", [displayText('关闭'), esc(who(effect)), esc(effect.title[ctx.lang]), highlight(effect.summary[ctx.lang], { interactive: true }), displayText('持续'), glyph(effect.kind), esc(effect.duration[ctx.lang]), displayText('作用于'), esc(effect.scope[ctx.lang]), displayText('牌的位置'), esc(effect.location[ctx.lang])]);
    const face = ctx.cards.face(effect.card);
    detail.querySelector('.ps-detail-card')!.append(face);
    detail.hidden = false;
    ctx.cards.fit(face);
    detail.querySelector('button')!.onclick = hide;
    placeDetail();
  }
  function hide(): void {
    if (termOpen) installTermHelp().hide();
    clearTimeout(timer);
    if (shown) nodes.get(shown)?.setAttribute('aria-expanded', 'false');
    shown = null;
    detail.hidden = true;
    detail.replaceChildren();
  }
  const later = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => { if (!termOpen && !detail.contains(document.activeElement)) hide(); }, 180);
  };
  const termOpened = (e: Event) => {
    if (!detail.contains((e as CustomEvent).detail.trigger)) return;
    termOpen = true;
    clearTimeout(timer);
  };
  const termClosed = (e: Event) => {
    if (!detail.contains((e as CustomEvent).detail.trigger)) return;
    termOpen = false;
    if (!detail.matches(':hover') && !nodes.get(shown ?? '')?.matches(':hover')) later();
  };
  document.addEventListener('card-term-open', termOpened);
  document.addEventListener('card-term-close', termClosed);
  detail.addEventListener('pointerenter', () => clearTimeout(timer));
  detail.addEventListener('pointerleave', later);
  detail.addEventListener('focusin', () => clearTimeout(timer));
  detail.addEventListener('focusout', e => { if (!detail.contains(e.relatedTarget as Node)) later(); });
  const key = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !shown || document.querySelector('.term-help:not([hidden])')) return;
    hide();
    e.stopPropagation();
  };
  const outside = (e: PointerEvent) => {
    if (termOpen && e.target instanceof Element && e.target.closest('.term-help')) return;
    if (e.target instanceof Node && !detail.contains(e.target) && !host.contains(e.target)) hide();
  };
  window.addEventListener('keydown', key, true);
  window.addEventListener('pointerdown', outside);
  window.addEventListener('resize', placeDetail);
  const watcher = new ResizeObserver(placeDetail);
  watcher.observe(host);

  const sync: Part = (s, prev, animate) => {
    const list = (s.passives ?? []).filter(effect => effect.card !== s.played?.card);
    const next = new Map(list.map(effect => [effect.id, effect]));
    if (shown && JSON.stringify(next.get(shown)) !== JSON.stringify(effects.get(shown))) hide();
    effects = next;
    for (const [id, node] of nodes) if (!next.has(id)) {
      nodes.delete(id);
      if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        // A visual reminder leaves; the rules have already handled the physical card's pile.
        const copy = node.cloneNode(true) as HTMLElement, r = node.getBoundingClientRect();
        copy.classList.add('ps-ending');
        copy.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;pointer-events:none`;
        copy.insertAdjacentHTML('beforeend', i18n("<i class=\"ps-stamp\">{0}</i>", [s.turn !== prev?.turn ? (displayText('期满')) : (displayText('已结束'))]));
        host.append(copy);
        const a = copy.animate([{ opacity: 1 }, { opacity: 1, offset: .45 }, { opacity: 0, transform: 'translateY(18px) scale(.9)' }], { duration: 650 });
        animations.add(a);
        a.finished.catch(() => {}).finally(() => { animations.delete(a); copy.remove(); });
      }
      node.remove();
    }
    for (const effect of list) {
      let node = nodes.get(effect.id);
      if (!node) {
        node = document.createElement('button');
        node.setAttribute('type', 'button');
        node.className = 'ps-item';
        node.dataset.passiveId = effect.id;
        node.dataset.passiveCard = effect.card;
        node.setAttribute('aria-expanded', 'false');
        node.innerHTML = displayText('<span class="ps-card"></span><i class="ps-seal"></i><span class="ps-name"></span>');
        const face = ctx.cards.face(effect.card);
        // Only the full detail card is interactive, not terms on a thumbnail inside a button.
        face.inert = true;
        node.querySelector('.ps-card')!.append(face);
        node.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') show(effect.id); });
        node.addEventListener('pointerleave', later);
        node.addEventListener('focus', () => show(effect.id));
        node.addEventListener('blur', later);
        node.addEventListener('click', () => show(effect.id));
        rows.get(effect.by)!.append(node);
        nodes.set(effect.id, node);
        if (animate) node.classList.add('ps-new');
      }
      node.setAttribute('aria-label', `${who(effect)} · ${effect.title[ctx.lang]} · ${effect.duration[ctx.lang]}`);
      node.querySelector('.ps-name')!.textContent = displayText(effect.title[ctx.lang]);
      node.querySelector('.ps-seal')!.innerHTML = displayText(glyph(effect.kind));
    }
    for (const [side, shelf] of shelves) {
      const count = list.filter(effect => effect.by === side).length;
      shelf.hidden = count === 0;
      shelf.querySelector('.hud-num')!.textContent = displayText(String(count));
    }
    for (const node of nodes.values()) ctx.cards.fit(node.querySelector<HTMLElement>('.slot')!);
    placeDetail();
  };
  sync.dispose = () => {
    hide();
    animations.forEach(a => a.cancel());
    watcher.disconnect();
    document.removeEventListener('card-term-open', termOpened);
    document.removeEventListener('card-term-close', termClosed);
    window.removeEventListener('keydown', key, true);
    window.removeEventListener('pointerdown', outside);
    window.removeEventListener('resize', placeDetail);
    detail.remove();
  };
  return sync;
};
