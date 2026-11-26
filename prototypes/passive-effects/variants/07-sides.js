// 07 对坐: what you played stands in front of you, what the opponent played stands in front of them.
// Two rows of nameplates, one over the player's hand and one under the opponent's, mirrored.
import './07-sides.css';

export default {
  id: '07',
  name: '对坐',
  ref: '谁打出的，就立在谁面前',
  idea: '像牌桌两边各自面前的名牌：你打出的事件立在你的手牌上方，对手打出的立在对手手牌下方，上下对称。',
  notes: {
    where: '下：你的手牌正上方一排；上：对手手牌正下方一排。',
    glance: '位置 = 谁打出的；名牌上是阵营、牌名、何时结束。',
    enter: '你的牌落到你这一排，对手的牌落到对手那一排，名牌「搁」下去。',
    fire: '那块名牌跳一下、亮金边。',
    leave: '名牌盖章后倒下，牌飞向牌堆。',
  },
  pros: ['「这是谁干的」不用读就知道，和对手出牌的对称演出是一套语言', '离手牌最近：出牌前目光本来就在这里', '两排各自都短'],
  cons: ['「谁打出的」和「对谁有利」不总是一回事（中立牌、打出对手的事件）', '占了手牌上方的地图下缘；手牌悬停放大时会盖住自己这一排', '对手那排在最上面，离视线中心远'],
  mount(ctx) {
    const mine = ctx.h('div', 'v07 v07-mine', '<span class="v07-cap">你打出 · 生效中</span><div class="v07-row" data-fx-side="above"></div>');
    const theirs = ctx.h('div', 'v07 v07-theirs', '<span class="v07-cap">对手打出 · 生效中</span><div class="v07-row" data-fx-side="below"></div>');
    ctx.layer.append(theirs, mine);
    const make = (info) => ctx.h('div', `v07-plate ${info.cls}`, `<i class="pe-chip">${ctx.SIDE_SHORT[info.side]}</i><b>${ctx.esc(info.title)}</b><i class="v07-mark"></i>`);
    const update = (n, info, o) => {
      n.classList.toggle('pe-pending', o.entering === info.id);
      ctx.mark(n.querySelector('.v07-mark'), info, o);
    };
    function sync(list, o = {}) {
      for (const [host, part] of [[mine, list.filter((i) => i.mine)], [theirs, list.filter((i) => !i.mine)]]) {
        ctx.keyed(host.querySelector('.v07-row'), part, (i) => i.id, make, (n, info) => update(n, info, o));
        host.classList.toggle('empty', part.length === 0);
      }
    }
    return {
      sync,
      el: (id) => ctx.layer.querySelector(`.v07-plate[data-fx="${id}"]`),
      cardRect: (n) => ctx.fx.cardRectAt(n, 3.6 * ctx.rem()),
      landFade: 0,
    };
  },
};
