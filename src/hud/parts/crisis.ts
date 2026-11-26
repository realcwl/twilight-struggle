import { text as displayText } from '../../i18n/index.js';
// The shared status panel: the nuclear crisis level as a meter. The arc lights up
// from the calm end as things get worse, so there is more light and more red on it the nearer the
// needle is to the radiation sign at the far end.
import { type PartFactory, arc, demoTarget, esc, label, polar, pt, times } from '../dom';
import { trefoil } from '../glyphs';

export const crisisGauge: PartFactory = (host, ctx) => {
  const n = ctx.rules.crisis.length;
  const each = 180 / n;
  const cx = 88;
  const cy = 86;
  // zone 0 is the calm end, on the left
  const level = (i: number): number => n - i;
  // the scale has five colours, hottest first; a track of another length is spread over them
  const heat = (l: number): number => (n === 1 ? 1 : Math.round(1 + ((l - 1) * 4) / (n - 1)));
  const at = (i: number): string => `data-l="${level(i)}" data-h="${heat(level(i))}"`;
  const title = (i: number): string => {
    const effect = ctx.rules.crisisEffects?.[level(i) - 1];
    return effect ? `<title>${esc(`DEFCON ${level(i)} · ${effect.label[ctx.lang]}：${effect.detail[ctx.lang]}`)}</title>` : '';
  };
  const zones = times(n, (i) => `<path class="cg-zone" ${at(i)} d="${arc(cx, cy, 56, 180 + i * each + 1.1, 180 + (i + 1) * each - 1.1)}">${title(i)}</path>`);
  const ticks = times(n * 4 + 1, (i) => {
    const a = 180 + (i * each) / 4;
    return `<path class="cg-tick${i % 4 ? '' : ' x'}" d="M${pt(cx, cy, 64, a)}L${pt(cx, cy, i % 4 ? 66.3 : 68.6, a)}"/>`;
  });
  // the scale is lettered outside the arc, so the needle never covers the number it points at
  const marks = times(n, (i) => {
    const [x, y] = polar(cx, cy, 76.5, 180 + (i + 0.5) * each);
    if (level(i) > 1) return `<text class="cg-n" ${at(i)} x="${x.toFixed(2)}" y="${(y + 3.8).toFixed(2)}">${level(i)}</text>`;
    return `<g class="cg-sign" ${at(i)} transform="translate(${(x + 1).toFixed(2)},${y.toFixed(2)})"><circle r="1.75"/><path d="${trefoil(0, 0, 3.1, 8.1)}"/></g>`;
  });
  host.className = 'cg';
  host.innerHTML =
    displayText(`<div class="cg-dial"><svg viewBox="3 1 170 93"><path class="cg-hair" d="${arc(cx, cy, 64, 180, 360)}"/><path class="cg-hair in" d="${arc(cx, cy, 47.6, 180, 360)}"/>${ticks}${zones}${marks}` +
    `<g class="cg-needle"><g class="cg-shake"><path class="cg-arm" d="M${cx},${cy + 7.5}L${cx - 1.55},${cy}L${cx - 0.3},${cy - 61.5}H${cx + 0.3}L${cx + 1.55},${cy}Z"/></g></g>` +
    `<circle class="cg-hub" cx="${cx}" cy="${cy}" r="5.4"/><circle class="cg-pin" cx="${cx}" cy="${cy}" r="1.8"/></svg></div>` +
    `<div class="cg-read">${label(ctx.t.crisis)}<b class="hud-num"></b><em class="cg-name"></em></div>` +
    `<div class="cg-effects" role="status" aria-live="polite" aria-atomic="true" hidden><span class="cg-effect-label"></span><strong class="cg-effect-detail"></strong></div>`);
  demoTarget(host, ctx, ctx.t.crisis, () => ctx.emit('poke', 'crisis', ctx.player));
  const num = host.querySelector('.hud-num')!;
  const name = host.querySelector('.cg-name')!;
  const needle = host.querySelector<SVGGElement>('.cg-needle')!;
  const lit = host.querySelectorAll<SVGElement>('[data-l]');
  const effects = host.querySelector<HTMLElement>('.cg-effects')!;
  const effectLabel = effects.querySelector('.cg-effect-label')!;
  const effectDetail = effects.querySelector('.cg-effect-detail')!;
  let shownLevel: number | undefined;
  return (s) => {
    host.dataset.heat = String(heat(s.crisis));
    num.textContent = displayText(String(s.crisis));
    name.textContent = displayText(ctx.rules.crisis[s.crisis - 1]?.[ctx.lang] ?? '');
    lit.forEach((c) => {
      const l = +c.dataset.l!;
      c.classList.toggle('on', l === s.crisis);
      c.classList.toggle('lit', l > s.crisis);
    });
    needle.style.transform = `rotate(${-90 + (n - s.crisis + 0.5) * each}deg)`;
    if (shownLevel !== s.crisis) {
      shownLevel = s.crisis;
      const effect = ctx.rules.crisisEffects?.[s.crisis - 1];
      effects.hidden = !effect;
      effects.classList.toggle('restricted', !!effect?.restricted);
      effectLabel.textContent = displayText(effect?.label[ctx.lang] ?? '');
      effectDetail.textContent = displayText(effect?.detail[ctx.lang] ?? '');
    }
  };
};
