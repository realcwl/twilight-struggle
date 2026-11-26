import { text as displayText } from '../../i18n/index.js';
// The top-right corner, upper half: the score. One number shared by both sides, so it is drawn as
// a tug of war: the player's end on the left, a rider that slides toward whoever leads.
import { type PartFactory, demoTarget, esc, label, sideClass, times } from '../dom';
import type { HudState, SideIndex } from '../types';

const leader = (s: HudState): SideIndex | null => (s.vp === 0 ? null : s.vp > 0 ? 0 : 1);
const leadClass = (s: HudState): string => (s.vp === 0 ? 'lead-0' : s.vp > 0 ? 'lead-a' : 'lead-b');

/** The lead as one large number, with who holds it underneath. */
export const scoreRead: PartFactory = (host, ctx) => {
  host.innerHTML = displayText(`${label(ctx.t.vp)}<b class="hud-num"></b><span class="vp-who"></span>`);
  const num = host.querySelector('.hud-num')!;
  const who = host.querySelector('.vp-who')!;
  return (s) => {
    const lead = leader(s);
    host.className = 'vp-read ' + leadClass(s);
    num.textContent = displayText(lead === null ? '0' : '+' + Math.abs(s.vp));
    who.textContent = displayText(lead === null ? ctx.t.level : ctx.t.leads(ctx.sideName(lead)));
  };
};

/** An engraved rule from one side's win to the other's, zero in the middle. */
export const scoreRule: PartFactory = (host, ctx) => {
  const max = ctx.rules.vpMax;
  const left = ctx.player;
  const right: SideIndex = left === 0 ? 1 : 0;
  const ticks = times(2 * max + 1, (i) => `<i class="vr-t${i % 10 === 0 ? ' x' : i % 5 === 0 ? ' v' : ''}" style="--i:${i}"></i>`);
  const nums = [max, max / 2, 0, max / 2, max].map((n, i) => `<i class="vr-n" style="--i:${(i * max) / 2}">${n}</i>`).join('');
  const end = (i: SideIndex): string => `<span class="vr-end ${sideClass(i)}" title="${esc(ctx.t.winsAt(ctx.sideName(i), max))}"><b>${esc(ctx.sideShort(i))}</b></span>`;
  host.className = 'vr';
  host.innerHTML = displayText(`${end(left)}<div class="vr-rail"><i class="vr-groove"></i>${ticks}<i class="vr-fill"></i><i class="vr-zero"></i><b class="vr-rider"></b>${nums}</div>${end(right)}`);
  host.style.setProperty('--steps', String(2 * max));
  const rail = host.querySelector('.vr-rail')!;
  demoTarget(host, ctx, ctx.t.vp, (e) => {
    const r = rail.getBoundingClientRect();
    ctx.emit('poke', 'vp', e.clientX < r.left + r.width / 2 ? left : right);
  });
  return (s) => {
    // how far along the rail, counted from the left end, where the player's own win is
    host.style.setProperty('--at', String(left === 0 ? max - s.vp : max + s.vp));
    host.className = `vr ${leadClass(s)}${ctx.demo ? ' hud-demo' : ''}`;
  };
};
