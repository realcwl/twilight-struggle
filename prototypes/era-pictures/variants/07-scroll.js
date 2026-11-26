import './07-scroll.css';

export default {
  id: '07',
  name: '长卷',
  ref: '一幅从左卷到右的全景画',
  idea: '十个回合的画面连成一幅长卷，在窗口里慢慢从右往左走。中间那根金线是“现在”，底下的刻度读出年份。行动轮每过一轮，长卷就挪一小段，所以时间是连着走的，不是一格一格跳的。',
  read: [['年份', '下面的大数字；金线压在卷底刻度上的位置也是它'], ['回合', '金线所在的那一段画面'], ['时期', '年份右边；画面本身从黑白走到彩色'], ['行动轮', '金线在这一段里走了多远，旁边的圆点是准数'], ['还剩多少', '左边的卷轴越卷越粗，右边的越来越细']],
  pros: ['只有它让时间连续地走：每个行动轮画面都在动一点', '画面互相融在一起，像一幅完整的画，而不是十张小图', '两头卷轴的粗细就是进度，不用读数字'],
  cons: ['画面的边界是模糊的，“这是第几回合”要靠下面的数字', '和胶片那组的读法相近：都是一条横着走的带子'],
  mount(el, ctx) {
    const n = ctx.rules.turns;
    const limit = (t) => (t <= 3 ? 6 : 7);
    el.innerHTML =
      '<div class="p7-win"><div class="p7-roll">' +
      ctx.times(n, (i) => `<div class="p7-s" data-turn="${i + 1}" style="--k:${i}">${ctx.pic(i + 1)}</div>`) +
      `<div class="p7-rule">${ctx.times(n, (i) => `<span style="--k:${i}"><b>${ctx.spans[i][0]}</b>${ctx.times(limit(i + 1), () => '<i></i>')}</span>`)}</div>` +
      '</div><i class="p7-index"></i><i class="p7-rod l"></i><i class="p7-rod r"></i></div>' +
      ctx.cap();
    const scenes = [...el.querySelectorAll('.p7-s')];
    return (v) => {
      el.style.setProperty('--x', (v.turn - 1 + (v.round - 0.5) / v.rounds).toFixed(4));
      el.style.setProperty('--done', ((v.turn - 1 + v.round / v.rounds) / v.turns).toFixed(3));
      for (const s of scenes) s.className = 'p7-s ' + ctx.state3(+s.dataset.turn, v.turn);
    };
  },
};
