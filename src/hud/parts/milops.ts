import { text as displayText } from '../../i18n/index.js';
// The shared status panel's bottom section: military operations. One tank for each point this turn. The
// gold line is what the turn requires. Earned points are solid; all unearned points are grey.
import { type PartFactory, demoTarget, esc, label, sideClass, times } from '../dom';
import { tank } from '../glyphs';
import type { SideIndex } from '../types';

export const milops: PartFactory = (host, ctx) => {
  const { rules, t } = ctx;
  const order: SideIndex[] = ctx.player === 0 ? [0, 1] : [1, 0];
  const row = (i: SideIndex, first: boolean): string =>
    `<div class="ar-row ${sideClass(i)}${first ? ' first' : ''}"><i class="hud-sd ${sideClass(i)}">${esc(ctx.sideShort(i))}</i><span class="ar-slots">${times(rules.milopsMax, () => `<i class="ar-slot">${tank(i)}</i>`)}<em class="ar-need"></em></span>` +
    '<span class="ar-count"><b class="hud-num"></b><i class="ar-of"></i></span><span class="ar-tag"></span></div>';
  host.className = 'ar';
  host.innerHTML = displayText(`<div class="ar-head">${label(t.milops)}<span class="ar-req">${esc(t.required)} <b></b></span></div>${order.map((i, k) => row(i, k === 0)).join('')}`);
  const rows = [...host.querySelectorAll<HTMLElement>('.ar-row')];
  rows.forEach((r, k) => demoTarget(r, ctx, `${ctx.sideName(order[k])} · ${t.milops}`, () => ctx.emit('poke', 'milops', order[k])));
  const req = host.querySelector('.ar-req b')!;
  return (s) => {
    const need = s.milopsRequired;
    host.style.setProperty('--need', String(need));
    req.textContent = displayText(String(need));
    rows.forEach((r, k) => {
      const have = s.milops[order[k]];
      r.querySelectorAll('.ar-slot').forEach((slot, j) => (slot.className = 'ar-slot ' + (j < have ? 'on' : 'off')));
      r.classList.toggle('met', have >= need);
      r.querySelector('.hud-num')!.textContent = displayText(String(have));
      r.querySelector('.ar-of')!.textContent = displayText(`/${need}`);
      r.querySelector('.ar-tag')!.textContent = displayText(have >= need ? t.met : t.short(need - have));
    });
  };
};
