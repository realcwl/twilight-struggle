// 06 压角: what players do at a real table. A card that stays in force is tucked under the edge of
// the board next to the track it is about, with its name showing: under the threat corner if it is
// about tension, under the score corner if it gives points, under the time corner if the clock
// drives it, and under the cards corner (its default home) for everything else.
import './06-tucked.css';

const SIDE = { tl: 'down', tr: 'down', bl: 'up', br: 'up' };

export default {
  id: '06',
  name: '压角',
  ref: '把牌压在它管的那条刻度旁边',
  idea: '像真实桌面那样，把生效的牌压在它相关的那个角下面，只露出牌名：管紧张度的压在威胁角，给分的压在分数角，按轮次触发的压在时间角，其余压在卡牌角。',
  notes: {
    where: '四个角的边缘，从面板下面露出一截。哪个角 = 它和什么有关。',
    glance: '露出的一截是阵营色的牌头：牌名和「何时结束」。指上去整截抽出来。',
    enter: '牌飞到那个角的边上，滑进面板底下，只留牌头。',
    fire: '那一截往外顶一下、亮金边。',
    leave: '牌头盖章，然后抽出来飞向牌堆。',
  },
  pros: ['位置本身带信息：看威胁角时，卡住紧张度的那张牌就在手边', '分散成四处，每处只有一两张，从不拥挤', '实体桌游玩家一看就懂'],
  cons: ['要记住四个角各管什么，否则就是「东一张西一张」', '没有总数；想看全要扫四个角', '按地区生效的事件没有自己的角，只能回到卡牌角'],
  mount(ctx) {
    const rails = {};
    for (const pane of ['tl', 'tr', 'bl', 'br']) {
      const n = ctx.h('div', `v06-rail v06-${SIDE[pane]} v06-${pane}`);
      n.dataset.fxSide = SIDE[pane] === 'up' ? 'above' : 'below';
      ctx.part(pane).appendChild(n);
      rails[pane] = n;
    }
    ctx.onCleanup(() => Object.values(rails).forEach((n) => n.remove()));

    const make = (info) => ctx.h('div', `v06-slip ${info.cls}`, `<div class="v06-head"><b>${ctx.esc(info.title)}</b><i class="v06-mark"></i></div>`);
    const update = (n, info, o) => {
      n.classList.toggle('pe-pending', o.entering === info.id);
      ctx.mark(n.querySelector('.v06-mark'), info, o);
    };
    function sync(list, o = {}) {
      for (const pane of Object.keys(rails)) ctx.keyed(rails[pane], list.filter((i) => i.home === pane), (i) => i.id, make, (n, info) => update(n, info, o));
    }
    const el = (id) => {
      for (const r of Object.values(rails)) {
        const n = r.querySelector(`[data-fx="${id}"]`);
        if (n) return n;
      }
      return null;
    };
    /** Just clear of the pane's edge, where the card is before it slides under (or after it is pulled out). */
    const cardRect = (n) => {
      const up = n.parentElement.classList.contains('v06-up');
      const r = n.getBoundingClientRect();
      const w = Math.min(r.width, 6.4 * ctx.rem());
      const h = w * 1.4;
      return { left: r.left + r.width / 2 - w / 2, top: up ? r.top - h * 0.55 : r.bottom - h * 0.45, width: w, height: h };
    };
    return { sync, el, cardRect, landFade: 0 };
  },
};
