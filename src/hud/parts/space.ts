import { t as i18n, text as displayText } from '../../i18n/index.js';
// Two launch lanes, inspectable milestones, and the privileges that have not yet been matched.
import { type Part, type PartFactory, demoTarget, esc, label, sideClass, times } from '../dom';
import { rocket, spaceGlyph } from '../glyphs';
import { activeSpaceAbilities, spaceAbilityOwner } from '../spaceState';
import { spaceEmblem } from '../spaceEmblem';
import type { HudState, SideIndex } from '../types';

let instance = 0;
export const spaceRace: PartFactory = (host, ctx) => {
  const { rules, lang, t } = ctx;
  const say = (cn: string, _en: string) => i18n(cn, [], lang);
  const top = ctx.player;
  const bottom: SideIndex = top === 0 ? 1 : 0;
  const lanes: [SideIndex, 'top' | 'bottom'][] = [[top, 'top'], [bottom, 'bottom']];
  const now = lanes.map(([i]) => `<i class="${sideClass(i)}">${esc(ctx.sideShort(i))}<b></b></i>`).join('');
  const stops = times(rules.space.length, (i) => `<button type="button" class="so-stop" data-space="${i + 1}" aria-label="${i + 1} · ${esc(rules.space[i].name[lang])}"><span>${spaceGlyph(rules.space[i].glyph)}</span></button>`);
  const lane = ([i, where]: [SideIndex, string]): string =>
    `<button type="button" class="hud-sd so-pad ${where} ${sideClass(i)}" data-side="${i}" aria-label="${esc(ctx.sideName(i))}">${esc(ctx.sideShort(i))}</button><i class="so-trail ${where} ${sideClass(i)}"></i><b class="so-mk ${where} ${sideClass(i)}">${rocket()}</b>`;
  host.className = 'so';
  host.innerHTML = i18n("<div class=\"so-head\">{0}<span class=\"so-now\">{1}</span></div><div class=\"so-track\"><i class=\"so-path\"></i><span class=\"so-stops\">{2}</span>{3}</div><div class=\"so-abilities\" aria-label=\"{4}\" hidden></div><div class=\"so-help\" id=\"space-help-{5}\" popover=\"auto\" role=\"tooltip\"></div>", [label(t.space), now, stops, lanes.map(lane).join(''), say('当前太空能力', 'Active space abilities'), ++instance]);
  host.style.setProperty('--stops', String(rules.space.length));
  host.style.setProperty('--lane-top', `var(--${top === 0 ? 'a' : 'b'}-l)`);
  host.style.setProperty('--lane-bottom', `var(--${bottom === 0 ? 'a' : 'b'}-l)`);
  // Keep the demo control only on the faction seals. Inspecting rules never moves a rocket.
  host.querySelectorAll<HTMLButtonElement>('.so-pad').forEach((pad) => {
    if (!ctx.demo) { pad.disabled = true; return; }
    demoTarget(pad, ctx, t.space, () => ctx.emit('poke', 'space', Number(pad.dataset.side) as SideIndex));
  });
  const names = host.querySelectorAll('.so-now b');
  const stopEls = host.querySelectorAll<HTMLButtonElement>('.so-stop');
  const badges = host.querySelector<HTMLElement>('.so-abilities')!;
  const tip = host.querySelector<HTMLElement>('.so-help')!;
  let state: HudState;
  let anchor: HTMLElement | null = null;
  let pinned = false;
  let pointerFocus = false;
  let closeTimer = 0;
  let badgeKey = '';

  function content(n: number, earned: boolean): string {
    const step = rules.space[n - 1];
    const owner = spaceAbilityOwner(state.space, n);
    const both = state.space.every((p) => p >= n);
    const ability = step.ability;
    const status = earned ? say(i18n("生效中"), 'Active') : both ? say(i18n("已失效"), 'Expired') : owner === null ? say(i18n("先到者获得"), 'First arrival') : i18n("{0}{1}", [esc(ctx.sideName(owner)), say('生效中', ' · active')]);
    const vp = i18n("<span>{0} <b>+{1}</b></span><span>{2} <b>+{3}</b></span>", [say('先到', 'First'), step.vp[0], say('后到', 'Second'), step.vp[1]]);
    const reward = ability
      ? i18n("<section class=\"so-help-ability {0} {1}\">{2}<div><small>{3} · {4}</small><p>{5}</p><span class=\"so-expiry\">{6}</span>{7}</div></section>", [earned ? 'so-held-ability' : '', owner !== null ? sideClass(owner) : '', spaceEmblem(ability.id), earned ? say('当前能力', 'PRIVILEGE') : say('纹章奖励', 'PRIVILEGE'), status, esc(ability.detail[lang]), say('对手到达本格即失效', 'Ends when the opponent reaches this box'), !earned && step.vp.some(Boolean) ? `<div class="so-bonus-vp"><small>VP</small>${vp}</div>` : ''])
      : i18n("<section class=\"so-arrival\"><small>{0}</small>{1}</section>", [say('奖励 VP', 'VP REWARD'), vp]);
    return i18n("<header class=\"so-help-head\"><span class=\"so-help-icon\">{0}</span><div><small>{1} {2} / {3}</small><h3>{4}</h3></div></header>\n      {5}{6}", [spaceGlyph(step.glyph), say('太空里程碑', 'SPACE MILESTONE'), String(n).padStart(2, '0'), String(rules.space.length).padStart(2, '0'), esc(step.name[lang]), earned ? '' : `<div class="so-requirements"><div aria-label="${say('最低行动点，计算事件修正后', 'Minimum Ops after event modifiers')}"><small>${say('行动点', 'OPS')}</small><strong>${step.minOps}<i>+</i></strong></div><div><small>${say('成功骰点', 'D6 ROLL')}</small><strong>1–${step.rollMax}</strong></div></div>`, reward]);
  }
  function place(): void {
    if (!anchor || !tip.matches(':popover-open')) return;
    const r = anchor.getBoundingClientRect();
    const p = tip.getBoundingClientRect();
    tip.style.left = `${Math.max(10, Math.min(innerWidth - p.width - 10, r.right - p.width / 2 - r.width / 2))}px`;
    tip.style.top = `${Math.max(10, Math.min(innerHeight - p.height - 10, r.bottom + 12))}px`;
  }
  function clear(): void {
    window.clearTimeout(closeTimer);
    anchor?.removeAttribute('aria-describedby');
    anchor = null;
    pinned = false;
  }
  function hide(): void {
    if (tip.matches(':popover-open')) tip.hidePopover();
    clear();
  }
  function show(el: HTMLElement): void {
    window.clearTimeout(closeTimer);
    if (!state) return;
    if (anchor !== el) { anchor?.removeAttribute('aria-describedby'); pinned = false; }
    anchor = el;
    tip.innerHTML = displayText(content(Number(el.dataset.space), el.classList.contains('so-buff')));
    el.setAttribute('aria-describedby', tip.id);
    if (!tip.matches(':popover-open')) tip.showPopover();
    place();
  }
  function later(): void {
    window.clearTimeout(closeTimer);
    if (!pinned) closeTimer = window.setTimeout(hide, 180);
  }
  function bind(el: HTMLElement): void {
    el.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch' && !pinned) show(el); });
    el.addEventListener('pointerleave', later);
    el.addEventListener('pointerdown', () => { pointerFocus = true; });
    el.addEventListener('focus', () => { if (!pointerFocus) show(el); pointerFocus = false; });
    el.addEventListener('blur', () => { pointerFocus = false; later(); });
    el.addEventListener('click', (e) => {
      e.stopPropagation(); pointerFocus = false;
      if (anchor === el && pinned) hide();
      else { show(el); pinned = true; }
    });
  }
  stopEls.forEach(bind);
  tip.addEventListener('pointerenter', () => window.clearTimeout(closeTimer));
  tip.addEventListener('pointerleave', later);
  tip.addEventListener('toggle', () => { if (!tip.matches(':popover-open')) clear(); });
  host.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && anchor) { e.preventDefault(); e.stopPropagation(); hide(); }
  });
  window.addEventListener('resize', place);
  const update: Part = (s) => {
    state = s;
    lanes.forEach(([i, where], k) => {
      host.style.setProperty(`--n-${where}`, String(s.space[i]));
      const step = rules.space[s.space[i] - 1];
      names[k].textContent = displayText(step?.name[lang] ?? '');
      names[k].parentElement!.hidden = !step;
    });
    stopEls.forEach((c, i) => {
      c.classList.toggle('by-top', i < s.space[top]);
      c.classList.toggle('by-bottom', i < s.space[bottom]);
      c.classList.toggle('lit', i < Math.max(...s.space));
    });
    const active = activeSpaceAbilities(rules.space, s.space);
    const key = active.map((a) => `${a.step}:${a.owner}`).join('|');
    if (key !== badgeKey) {
      if (anchor && badges.contains(anchor)) hide();
      badgeKey = key;
      badges.innerHTML = displayText(active.map((a) => `<button type="button" class="so-buff ${sideClass(a.owner)}" data-space="${a.step}" data-ability="${a.ability.id}" data-owner="${a.owner}" aria-label="${esc(ctx.sideName(a.owner))}：${esc(a.ability.summary[lang])}">${spaceEmblem(a.ability.id)}<span class="so-buff-caption">${esc(a.ability.summary[lang])}</span></button>`).join(''));
      badges.querySelectorAll<HTMLElement>('.so-buff').forEach(bind);
    }
    badges.hidden = !active.length;
    if (anchor && tip.matches(':popover-open')) { tip.innerHTML = displayText(content(Number(anchor.dataset.space), anchor.classList.contains('so-buff'))); place(); }
  };
  update.dispose = () => { hide(); window.removeEventListener('resize', place); };
  return update;
};
