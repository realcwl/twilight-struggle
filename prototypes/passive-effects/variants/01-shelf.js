// 01 生效区: the cards corner gets a fourth place. A card that stays in force stands on a ledge over
// the piles, as itself, until it goes down to the pile it belongs on.
import './01-shelf.css';

export default {
  id: '01',
  name: '生效区',
  ref: '牌桌上的第四个位置',
  idea: '卡牌角多一层搁板：持续生效的牌以牌本身立在弃牌堆上方，结束时才落进它该去的那一堆。',
  notes: {
    where: '左下卡牌角的正上方，和桌面、三个牌堆是一家。',
    glance: '缩小的牌面（颜色 = 阵营，画面认牌）、牌名、右下角一枚「何时结束」的小印。',
    enter: '牌从桌面升到搁板上，原样立住。',
    fire: '那张牌跳一下、亮金边，旁边说明它做了什么。',
    leave: '牌面盖章（取消 / 期满 / 终止），然后落进弃牌堆或移出游戏堆。',
  },
  pros: ['最直接地回答「这张牌现在在哪」：桌面 → 生效区 → 牌堆，一条线看得见', '不新造符号，牌就是牌，认画面即可', '和牌堆挨着，离场那一下路程最短、最好懂'],
  cons: ['效果做什么要悬停才知道', '超过六七张要叠起来', '只说「有什么」，不说「管哪里」，要靠悬停点亮地图'],
  mount(ctx) {
    const host = ctx.h('div', 'v01-shelf', '<div class="v01-head"><span class="hud-lb">生效中</span><b class="hud-num">0</b></div><div class="v01-row" data-fx-side="above"></div>');
    ctx.part('bl').appendChild(host);
    ctx.onCleanup(() => host.remove());
    const row = host.querySelector('.v01-row');
    const num = host.querySelector('.hud-num');

    const make = (info) => {
      const n = ctx.h('div', `v01-item ${info.cls}`, '<div class="v01-card"></div><i class="v01-seal"></i><span class="v01-name"></span>');
      n.querySelector('.v01-card').appendChild(ctx.card.el(info.no));
      n.querySelector('.v01-name').textContent = info.title;
      return n;
    };
    const update = (n, info, o) => {
      ctx.card.fit(n.querySelector('.slot'));
      ctx.mark(n.querySelector('.v01-seal'), info, o);
    };
    const rows = ctx.list(row, make, update);

    return {
      sync(list, o = {}) {
        rows.sync(list, o);
        num.textContent = String(list.length);
        host.classList.toggle('empty', list.length === 0);
        host.classList.toggle('crowded', list.length > 5);
      },
      el: rows.el,
      cardRect: (el) => el.querySelector('.v01-card').getBoundingClientRect(),
      landFade: 1,
      calloutSide: 'above',
    };
  },
};
