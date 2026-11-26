import { t as i18n, text as displayText } from '../i18n/index.js';
// Looking through public piles or possible opponent cards over the dimmed screen.
import { type Ctx, esc } from './dom';
import { mountCardFilters } from '../cards/filters';
import { compareCardOps } from '../cards/order';
import '../ui/sheet.css';

type Options = { catalogOrder?: boolean; description?: string; count?: (n: number) => string; empty?: string; onClose?: () => void };

export function openPileBrowser(overlay: HTMLElement, ctx: Ctx, title: string, ids: string[], opts: Options = {}): { update(ids: string[]): void; close(): void } {
  const previousFocus = document.activeElement;
  let closed = false, signature: string | undefined, list: string[] = [];
  overlay.innerHTML =
    // a sheet (src/ui/sheet.css): how many cards is the small label over the title
    displayText(`<div class="pb sheet${opts.catalogOrder ? ' pb-catalog' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><div class="sheet-head"><span class="pb-count sheet-kicker"></span><h2 class="sheet-title">${esc(title)}</h2></div><button type="button" class="pb-x sheet-x" aria-label="${esc(ctx.t.close)}">×</button></header>` +
    `${opts.description ? `<p class="pb-note sheet-sub">${esc(opts.description)}</p>` : ''}${opts.catalogOrder ? '<div class="pb-filters"></div>' : ''}<div class="pb-grid"></div></div>`);
  overlay.hidden = false;
  const grid = overlay.querySelector<HTMLElement>('.pb-grid')!;
  const filters = opts.catalogOrder ? mountCardFilters(overlay.querySelector('.pb-filters')!, () => render(true), ctx.lang) : null;
  const fit = () => grid.querySelectorAll<HTMLElement>('.slot').forEach(face => ctx.cards.fit(face));
  function render(resetScroll = false): void {
    const shown = filters ? list.filter(id => filters.matches(id)) : list;
    filters?.setCount(shown.length, list.length);
    const scroll = resetScroll ? 0 : grid.scrollTop;
    grid.replaceChildren();
    if (!shown.length) grid.innerHTML = i18n("<p class=\"pb-none\">{0}</p>", [esc(list.length ? displayText('没有符合条件的卡牌。') : opts.empty ?? ctx.t.emptyPile)]);
    for (const id of shown) {
      const face = ctx.cards.face(id);
      grid.appendChild(face);
      ctx.cards.fit(face);
    }
    grid.scrollTop = scroll;
  }
  const observer = new ResizeObserver(fit);
  observer.observe(grid);
  const update = (next: string[]): void => {
    if (closed) return;
    const ordered = opts.catalogOrder ? [...next].sort(compareCardOps) : [...next].reverse();
    const key = JSON.stringify(ordered);
    if (key === signature) return;
    signature = key;
    list = ordered;
    overlay.querySelector('.pb-count')!.textContent = displayText((opts.count ?? ctx.t.cardCount)(list.length));
    render();
  };
  const close = (): void => {
    if (closed) return;
    closed = true;
    observer.disconnect();
    overlay.hidden = true;
    overlay.replaceChildren();
    overlay.onclick = null;
    window.removeEventListener('keydown', onKey, true);
    opts.onClose?.();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || document.querySelector('.term-help:not([hidden])')) return;
    e.stopPropagation();
    close();
  };
  window.addEventListener('keydown', onKey, true);
  overlay.onclick = (e) => {
    if (e.target === overlay || (e.target instanceof Element && e.target.closest('.pb-x'))) close();
  };
  update(ids);
  overlay.querySelector<HTMLButtonElement>('.pb-x')!.focus({ preventScroll: true });
  return { update, close };
}
