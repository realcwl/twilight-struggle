// 05 有效期: the time corner owns "until when". Under it, each effect is a bar on a ruler of this
// turn's action rounds: it starts where the effect began, ends where it will end, and runs off the
// ruler if only a card or an event can end it. What is left of a bar is what is left of the effect.
import './05-calendar.css';

const ROUNDS = 7;

export default {
  id: '05',
  name: '有效期',
  ref: '时间角下面的一张日程',
  idea: '时间角下面挂一张本回合的行动轮刻度，每个事件是一条横杠：从哪轮开始、到哪轮结束；要等一张牌或一件事的，横杠直接伸出刻度。',
  notes: {
    where: '左上时间角的正下方，同属「时间」这个主题。',
    glance: '横杠还剩多长就是还剩多久；金色竖线是现在；伸出刻度的写着等什么（《东方政策》/ 政变）。',
    enter: '牌飞到「现在」那一格，横杠从那里向右长出来。',
    fire: '横杠亮一下，并在当轮留下一枚小菱形：它在这轮触发过。',
    leave: '横杠在「现在」处盖章截断；牌从那里飞向牌堆。',
  },
  pros: ['唯一一个把「什么时候结束」画成几何的：到期的顺序一目了然', '触发留痕，回头能看到它哪几轮动过', '回合结束时哪些会一起离场，提前就看得出'],
  cons: ['最占地方，而且在国家卡片的位置上，卡片要再往下让', '不说「管哪里」', '以回合为界；跨回合的事件只能画成「伸出去」'],
  mount(ctx) {
    const host = ctx.h('div', 'v05 hud-pane');
    host.innerHTML =
      `<div class="v05-ruler"><span class="hud-lb">本回合行动轮</span><div class="v05-ticks">${Array.from({ length: ROUNDS }, (_, i) => `<i data-r="${i + 1}">${i + 1}</i>`).join('')}<em>之后</em></div></div>` +
      '<div class="v05-rows" data-fx-side="right"></div><i class="v05-now"></i>';
    ctx.layer.appendChild(host);
    const rowsEl = host.querySelector('.v05-rows');

    const make = (info) =>
      ctx.h('div', `v05-row ${info.cls}`, `<i class="v05-bar"></i><span class="v05-name">${ctx.esc(info.title)}</span><span class="v05-fired"></span><span class="v05-end"><i class="v05-mark"></i><em></em></span>`);
    const update = (n, info, o) => {
      const u = info.until;
      const from = (info.since ?? 1) - 1;
      const open = u.kind === 'card' || u.kind === 'cond';
      const to = u.kind === 'rounds' ? Math.min(ROUNDS, from + u.of) : ROUNDS;
      n.style.setProperty('--from', String(from));
      n.style.setProperty('--to', String(to));
      n.classList.toggle('open', open);
      n.classList.toggle('early', info.since === null);
      ctx.mark(n.querySelector('.v05-mark'), info, o);
      n.querySelector('.v05-end em').textContent = open ? u.short : '';
      n.querySelector('.v05-fired').innerHTML = info.fired.map((r) => `<i style="--at:${r}"></i>`).join('');
    };
    const rows = ctx.list(rowsEl, make, update);

    function sync(list, o = {}) {
      rows.sync(list, o);
      const round = ctx.S.hud.round;
      host.style.setProperty('--now', String(round));
      for (const t of host.querySelectorAll('.v05-ticks i')) t.className = +t.dataset.r < round ? 'done' : +t.dataset.r === round ? 'now' : '';
      host.classList.toggle('empty', list.length === 0);
      // the country card goes below this, wherever it ends
      ctx.root.style.setProperty('--v05-h', `${host.offsetHeight}px`);
    }
    ctx.onCleanup(() => ctx.root.style.removeProperty('--v05-h'));

    /** The card lands on, and leaves from, the bar at "now". */
    const cardRect = (n) => {
      const now = host.querySelector('.v05-ticks i.now') ?? host.querySelector('.v05-ticks i');
      const r = n.getBoundingClientRect();
      const t = now.getBoundingClientRect();
      const w = 3.2 * ctx.rem();
      return { left: t.left + t.width / 2 - w / 2, top: r.top + r.height / 2 - w * 0.7, width: w, height: w * 1.4 };
    };

    return { sync, el: rows.el, cardRect, landFade: 0, calloutSide: 'right' };
  },
};
