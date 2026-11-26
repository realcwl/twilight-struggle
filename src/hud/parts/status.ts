import { t as i18n, text as displayText } from '../../i18n/index.js';
// A live thumbnail of the shared status panel; the full meters keep their original instances.
import { esc, sideClass, type PartFactory } from '../dom';
import { rocket, tank, trefoil } from '../glyphs';
import type { Lang, SideIndex } from '../types';

export const statusSummary: PartFactory = (host, ctx) => {
  const order: SideIndex[] = [ctx.player, ctx.player === 0 ? 1 : 0];
  host.innerHTML = i18n("<button class=\"hs-toggle\" type=\"button\" aria-expanded=\"false\">\n    <span class=\"hs-open-title\">{0}</span>\n    <span class=\"hs-preview\">\n      <span class=\"hs-meters\">\n        <span class=\"hs-vp\"><span>{1}</span><b></b><small></small></span>\n        <span class=\"hs-crisis\"><svg viewBox=\"0 0 32 32\" aria-hidden=\"true\"><path d=\"{2}\"/><circle cx=\"16\" cy=\"16\" r=\"3\"/></svg><span>{3}</span><b></b></span>\n      </span>\n      <span class=\"hs-lanes\"><span></span><span class=\"hs-col\">{4}{5}</span><span class=\"hs-col\">{6}{7}</span>\n        {8}\n      </span>\n    </span>\n    <span class=\"hs-chevron\" aria-hidden=\"true\">⌄</span>\n  </button>", [displayText('全局局势'), esc(ctx.t.vp), trefoil(16, 16, 5, 14), esc(ctx.t.crisis), rocket(), displayText('太空'), tank(0), displayText('军事行动'), order.map(i => `<span class="hs-side ${sideClass(i)}">${esc(ctx.sideShort(i))}</span><span class="hs-space ${sideClass(i)}" data-side="${i}"><i></i><b></b></span><span class="hs-milops ${sideClass(i)}" data-side="${i}"></span>`).join('')]);
  const vp = host.querySelector<HTMLElement>('.hs-vp')!;
  const crisis = host.querySelector<HTMLElement>('.hs-crisis')!;
  return s => {
    const lead = s.vp === 0 ? null : s.vp > 0 ? 0 : 1;
    vp.className = `hs-vp ${lead === null ? 'lead-0' : lead === 0 ? 'lead-a' : 'lead-b'}`;
    vp.querySelector('b')!.textContent = displayText(lead === null ? '0' : `+${Math.abs(s.vp)}`);
    vp.querySelector('small')!.textContent = displayText(lead === null ? ctx.t.level : ctx.t.leads(ctx.sideShort(lead)));
    crisis.style.color = `var(--l${Math.max(1, Math.min(5, s.crisis))})`;
    crisis.querySelector('b')!.textContent = displayText(String(s.crisis));
    for (const i of [0, 1] as const) {
      const space = host.querySelector<HTMLElement>(`.hs-space[data-side="${i}"]`)!;
      space.style.setProperty('--progress', `${100 * s.space[i] / Math.max(1, ctx.rules.space.length)}%`);
      space.querySelector('b')!.textContent = displayText(`${s.space[i]}/${ctx.rules.space.length}`);
      const mil = host.querySelector<HTMLElement>(`.hs-milops[data-side="${i}"]`)!;
      mil.textContent = displayText(`${s.milops[i]}/${s.milopsRequired}`);
      mil.classList.toggle('is-short', s.milops[i] < s.milopsRequired);
    }
  };
};

let nextId = 0;

/** Hover/focus reveals details. Click pins them for touch; a spotlight temporarily holds them open. */
export function bindStatusPanel(pane: HTMLElement, _lang: Lang, measure: () => void) {
  const button = pane.querySelector<HTMLButtonElement>('.hs-toggle')!;
  const detail = pane.querySelector<HTMLElement>('.hud-status-detail')!;
  detail.id = `hud-status-${++nextId}`;
  button.setAttribute('aria-controls', detail.id);
  const abort = new AbortController();
  const options = { signal: abort.signal };
  let open = false, pinned = false, hovering = false, focusing = false, spotlight = false;
  let timer = 0;
  let motion: Animation | null = null;
  const observer = new ResizeObserver(measure);
  observer.observe(pane);
  const helpOpen = () => !!pane.querySelector(':popover-open');
  const render = () => {
    const next = pinned || hovering || focusing || spotlight || helpOpen();
    button.setAttribute('aria-label', displayText((next ? i18n("收起局势详情") : i18n("展开局势详情"))));
    if (next === open) return;
    const before = { width: pane.offsetWidth, height: pane.offsetHeight };
    motion?.cancel();
    motion = null;
    open = next;
    pane.classList.toggle('status-expanded', open);
    button.setAttribute('aria-expanded', String(open));
    detail.hidden = !open;
    const after = { width: pane.offsetWidth, height: pane.offsetHeight };
    if (!spotlight && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      pane.classList.add('status-transitioning');
      const animation = pane.animate([
        { width: `${before.width}px`, height: `${before.height}px` },
        { width: `${after.width}px`, height: `${after.height}px` },
      ], { duration: open ? 340 : 280, easing: 'cubic-bezier(.22, 1, .36, 1)' });
      motion = animation;
      animation.onfinish = () => {
        if (motion !== animation) return;
        motion = null;
        pane.classList.remove('status-transitioning');
        measure();
      };
    } else pane.classList.remove('status-transitioning');
    measure();
  };
  const later = () => { clearTimeout(timer); timer = window.setTimeout(render, 200); };
  const close = () => {
    clearTimeout(timer);
    pinned = hovering = focusing = false;
    for (const help of pane.querySelectorAll<HTMLElement>(':popover-open')) help.hidePopover();
    render();
  };
  pane.addEventListener('pointerenter', e => {
    if (e.pointerType === 'touch') return;
    hovering = true;
    clearTimeout(timer);
    render();
  }, options);
  pane.addEventListener('pointerleave', e => {
    if (e.relatedTarget instanceof Node && pane.contains(e.relatedTarget)) return;
    hovering = false;
    later();
  }, options);
  pane.addEventListener('focusin', e => {
    if ((e.target as Element).matches(':focus-visible')) { focusing = true; render(); }
  }, options);
  pane.addEventListener('focusout', e => {
    if (e.relatedTarget instanceof Node && pane.contains(e.relatedTarget)) return;
    focusing = false;
    later();
  }, options);
  button.addEventListener('click', e => {
    // A hover already revealed the panel, so the mouse click acts as its close control.
    if (open) close();
    else { pinned = true; render(); }
    if (e.detail > 0) button.blur();
  }, options);
  pane.addEventListener('toggle', later, { ...options, capture: true });
  document.addEventListener('pointerdown', e => {
    if (!pane.contains(e.target as Node)) close();
  }, options);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !open || spotlight) return;
    // Let the nested space explanation consume its own Escape first.
    if (helpOpen()) return;
    const restore = pane.contains(document.activeElement);
    if (restore) button.focus({ preventScroll: true });
    close();
  }, options);
  render();
  return {
    spotlight(active: boolean) {
      spotlight = active;
      if (active) {
        motion?.cancel();
        motion = null;
        pane.classList.remove('status-transitioning');
      }
      // Moving the pane during an animation must not leave a stale hover behind.
      if (!active) hovering = pane.matches(':hover');
      render();
    },
    dispose() { clearTimeout(timer); motion?.cancel(); observer.disconnect(); abort.abort(); },
  };
}
