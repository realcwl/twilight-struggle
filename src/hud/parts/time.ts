import { t as i18n, text as displayText } from '../../i18n/index.js';
// Prototype 07 长卷, driven by the same HUD state in solo and online games.
import { type PartFactory, demoTarget, esc, label, sideClass, state3, times } from '../dom';
import { eraOf, type HudRules, type HudState } from '../types';
import './time.css';

/** Initial/headline states sit at the first year; cleanup at the final year of this turn. */
export function timePosition(s: HudState, rules: HudRules) {
  const turn = Math.max(1, Math.min(rules.turns, s.turn));
  const entry = rules.timeline?.[turn - 1];
  const limit = Math.max(1, s.actionLimit ?? entry?.rounds ?? rules.rounds);
  const round = s.phase === 'setup' || s.phase === 'headline' ? 1
    : s.phase === 'cleanup' ? limit : Math.max(1, Math.min(limit, s.round));
  const year = entry ? Math.min(entry.years[1], entry.years[0] + Math.floor((round - 1) * (entry.years[1] - entry.years[0] + 1) / limit)) : null;
  return { turn, limit, round, year, x: turn - 1 + (round - .5) / limit };
}

/** The historical panorama; the public `dial` slot also retains the solo game-menu target. */
export const timeDial: PartFactory = (host, ctx) => {
  const { rules, t, lang } = ctx;
  const grade = (turn: number) => ({ early: 'bw', middle: 'fade', late: 'full' })[eraOf(rules, turn).id] ?? 'full';
  host.className = 'ts';
  host.style.setProperty('--turns', String(rules.turns));
  host.innerHTML = displayText(`<div class="ts-window" aria-hidden="true"><div class="ts-roll">${times(rules.turns, i => {
    const p = rules.timeline?.[i];
    return `<div class="ts-scene" style="--k:${i}"><span class="ts-pic g-${grade(i + 1)}"${p ? ` style="background-image:url('${esc(p.image)}');--at:${esc(p.position ?? '50% 50%')}"` : ''}></span></div>`;
  })}<div class="ts-rule">${times(rules.turns, i => `<span style="--k:${i}"><b>${rules.timeline?.[i]?.years[0] ?? i + 1}</b><em>${times(rules.timeline?.[i]?.rounds ?? rules.rounds, () => '<i></i>')}</em></span>`)}</div></div><i class="ts-index"></i><i class="ts-rod l"></i><i class="ts-rod r"></i></div>
    <div class="ts-caption"><b class="ts-year"></b><div class="ts-middle"><div class="ts-meta"><b class="ts-era"></b><span>${esc(t.turn)} <b class="ts-turn"></b><i>/${rules.turns}</i></span></div><div class="ts-rounds"></div></div><div class="ts-phase"></div></div>
    <blockquote class="ts-quote" hidden><q></q><cite></cite></blockquote>`);
  demoTarget(host, ctx, t.turn, () => ctx.emit('step'));
  const scenes = [...host.querySelectorAll<HTMLElement>('.ts-scene')];
  const scale = [...host.querySelectorAll<HTMLElement>('.ts-rule em')];
  const track = host.querySelector<HTMLElement>('.ts-roll')!;
  const year = host.querySelector<HTMLElement>('.ts-year')!;
  const era = host.querySelector<HTMLElement>('.ts-era')!;
  const turn = host.querySelector<HTMLElement>('.ts-turn')!;
  const quote = host.querySelector<HTMLQuoteElement>('.ts-quote')!;
  const quoteText = quote.querySelector('q')!;
  const quoteAuthor = quote.querySelector('cite')!;
  let quoteKey = '';
  const updateRounds = rounds(host.querySelector<HTMLElement>('.ts-rounds')!, ctx);
  const updatePhase = phase(host.querySelector<HTMLElement>('.ts-phase')!, ctx);
  return (s, prev, animate) => {
    const v = timePosition(s, rules);
    host.dataset.phase = s.phase ?? 'action';
    host.dataset.era = eraOf(rules, v.turn).id;
    host.classList.toggle('ts-snap', !animate);
    host.style.setProperty('--x', v.x.toFixed(4));
    if (!animate) void track.offsetWidth; // loading/reconnecting restores the position without rewinding
    scenes.forEach((scene, i) => { scene.className = `ts-scene ${state3(i + 1, v.turn)}`; });
    scale.forEach((ticks, i) => {
      const count = i + 1 === v.turn ? v.limit : rules.timeline?.[i]?.rounds ?? rules.rounds;
      if (ticks.childElementCount !== count) ticks.innerHTML = displayText(times(count, () => '<i></i>'));
    });
    year.textContent = displayText(String(v.year ?? v.turn));
    era.textContent = displayText(eraOf(rules, v.turn).name[lang]);
    turn.textContent = displayText(String(v.turn));
    const key = `${v.turn}-${ctx.player}`;
    if (key !== quoteKey) {
      quoteKey = key;
      const q = rules.timeline?.[v.turn - 1]?.quotes?.[ctx.player];
      quote.hidden = !q;
      if (q) {
        quoteText.textContent = displayText(q.text[lang]);
        quoteAuthor.textContent = displayText(`— ${q.author[lang]}`);
        quote.cite = q.source;
        quote.title = displayText(`${q.text[lang]} — ${q.author[lang]} · ${q.date}\n${q.sourceTitle}`);
        quote.dataset.side = String(ctx.player);
      }
    }
    updateRounds(s, prev, animate);
    updatePhase(s, prev, animate);
  };
};

/** Action limit comes from the live engine, including a side's extra action. */
export const rounds: PartFactory = (host, ctx) => {
  host.innerHTML = displayText(`${label(ctx.t.round)}<span class="rd-pips"></span>`);
  const row = host.querySelector<HTMLElement>('.rd-pips')!;
  return s => {
    const { limit } = timePosition(s, ctx.rules);
    host.className = 'rd ' + sideClass(s.active);
    if (row.childElementCount !== limit) row.innerHTML = displayText(times(limit, i => `<i class="rd-pip"><b>${i + 1}</b></i>`));
    const current = s.phase === 'setup' || s.phase === 'headline' ? 0 : s.phase === 'cleanup' ? limit + 1 : s.round;
    [...row.children].forEach((p, i) => { p.className = 'rd-pip ' + state3(i + 1, current); });
    row.setAttribute('aria-label', `${ctx.t.round} ${Math.min(limit, Math.max(0, current))}/${limit}`);
  };
};

/** Whose move, including non-action phases and either online seat. */
export const phase: PartFactory = (host, ctx) => {
  host.innerHTML = displayText('<b></b><span></span>');
  const [head, hint] = [host.firstElementChild!, host.lastElementChild!];
  return s => {
    const mine = s.active === ctx.player;
    host.className = 'ph ' + sideClass(s.active);
    head.textContent = displayText(mine ? ctx.t.yourMove : ctx.t.theirMove(ctx.sideName(s.active)));
    hint.textContent = displayText(mine ? ctx.t.yourHint : ctx.t.theirHint);
    if (s.phase && s.phase !== 'action') {
      const text = {
        setup: [i18n("初始部署"), mine ? (ctx.player === 0 ? (i18n("在西欧放置7点影响力")) : (i18n("在东欧放置6点影响力"))) : (i18n("等待对方完成部署"))],
        headline: [i18n("头条阶段"), i18n("拖出一张牌作为头条")],
        cleanup: [i18n("回合结算"), i18n("军事行动 · 保留手牌 · 发牌")],
        end: [i18n("对局结束"), i18n("可查看棋盘或开始新局")],
      }[s.phase];
      head.textContent = displayText(text[0]); hint.textContent = displayText(text[1]);
    }
  };
};
