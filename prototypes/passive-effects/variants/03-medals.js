// 03 勋章: a row of medals hanging from the top edge. The disc is the card's picture; the ring round
// it is a clock for anything that ends with time, and unbroken for anything only a card or an event
// can end.
import './03-medals.css';

const arc = (cx, cy, r, a0, a1) => {
  const p = (a) => `${(cx + r * Math.cos((a * Math.PI) / 180)).toFixed(2)},${(cy + r * Math.sin((a * Math.PI) / 180)).toFixed(2)}`;
  return `M${p(a0)}A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}`;
};
/** A ring of `total` segments, the last `lit` of them bright: what is left, read as a clock. */
function ring(total, lit) {
  if (!total) return '<circle cx="50" cy="50" r="46" class="lit"/>';
  const gap = total > 1 ? 7 : 0;
  const step = 360 / total;
  let s = '';
  for (let i = 0; i < total; i++) s += `<path d="${arc(50, 50, 46, -90 + i * step + gap / 2, -90 + (i + 1) * step - gap / 2)}" class="${i >= total - lit ? 'lit' : ''}"/>`;
  return s;
}

export default {
  id: '03',
  name: '勋章',
  ref: '挂在上缘的一排勋章',
  idea: '每个持续事件是一枚挂在屏幕上缘的勋章：绶带是阵营色，圆章是牌的画面，外圈是它的钟。',
  notes: {
    where: '上缘，时间角与对手手牌之间（放不下的接到对手手牌右边）。上缘 9% 的地图没有国家。',
    glance: '画面认牌，绶带认阵营；外圈分格的会随行动轮熄灭，整圈不分格的要等一张牌或一件事。',
    enter: '牌飞到上缘缩成圆章，带着绶带落下来晃两下。',
    fire: '那枚勋章摆动、闪一下。',
    leave: '章面盖章，然后牌从这里飞向它的牌堆。',
  },
  pros: ['「还剩多久」是画出来的：外圈一格一格熄灭', '密度高，七八枚也只占一条上缘', '和时间角同在上方，回合推进时顺眼就看到'],
  cons: ['小圆章里的画面要认熟了才认得出，名字字小', '离卡牌角最远，进场离场的飞行路程长', '效果内容仍要悬停'],
  mount(ctx) {
    const left = ctx.h('div', 'v03 v03-l');
    const right = ctx.h('div', 'v03 v03-r');
    left.dataset.fxSide = right.dataset.fxSide = 'below';
    ctx.layer.append(left, right);

    const make = (info) => {
      const n = ctx.h('div', `v03-medal ${info.cls}`, `<i class="v03-ribbon"></i><div class="v03-disc"><div class="v03-art">${ctx.card.art(info.card)}</div><svg class="v03-ring" viewBox="0 0 100 100"></svg><i class="v03-seal"></i></div><span class="v03-name">${ctx.esc(info.title)}</span>`);
      return n;
    };
    const update = (n, info, o) => {
      const u = info.until;
      const rules = ctx.S.hud;
      // what the clock shows: the rest of this turn's action rounds, or the rounds the effect has left
      const [total, lit] = u.kind === 'turn' ? [7, 7 - rules.round + 1] : u.kind === 'rounds' ? [u.of, u.n] : [0, 0];
      const key = `${total}:${lit}`;
      const svg = n.querySelector('.v03-ring');
      if (svg.dataset.key !== key) {
        svg.dataset.key = key;
        svg.innerHTML = ring(total, lit);
      }
      ctx.mark(n.querySelector('.v03-seal'), info, o);
    };

    let order = [];
    function sync(list, o = {}) {
      // as many as fit before the opponent's hand; the rest go to the other side of it
      const u = ctx.rem();
      const tl = ctx.part('tl').getBoundingClientRect();
      const box = ctx.root.getBoundingClientRect();
      const start = tl.right - box.left + 2.2 * u;
      const room = box.width / 2 - 11.5 * u - start;
      const cap = Math.max(1, Math.floor(room / (6.9 * u)));
      left.style.left = `${start}px`;
      order = list.map((i) => i.id);
      for (const [host, part] of [[left, list.slice(0, cap)], [right, list.slice(cap)]]) {
        ctx.keyed(host, part, (i) => i.id, make, (n, info) => {
          n.classList.toggle('pe-pending', o.entering === info.id);
          update(n, info, o);
        });
      }
    }
    const el = (id) => ctx.layer.querySelector(`.v03-medal[data-fx="${id}"]`);
    const onResize = () => sync(ctx.infos(), { instant: true });
    window.addEventListener('resize', onResize);
    ctx.onCleanup(() => window.removeEventListener('resize', onResize));

    return {
      sync,
      el,
      cardRect: (n) => ctx.fx.cardRectAt(n.querySelector('.v03-disc'), 3.6 * ctx.rem()),
      stampHost: (n) => n.querySelector('.v03-disc'),
      anchor: (n) => n.querySelector('.v03-disc'),
      landFade: 0,
      calloutSide: 'below',
    };
  },
};
