import './10-finder.css';

export default {
  id: '10',
  name: '取景器',
  ref: '从一台旁轴相机的取景器里看出去',
  idea: '你是带着相机的人。取景器里就是这个回合的画面，占满整个面板；右边机顶的计数盘显示拍到第几张，也就是第几回合。行动轮是取景器右沿的测光刻度，指针一轮一轮往上走。换回合时快门一闪。',
  read: [['年份', '右边的大数字；画面右下角橙色的日期印也是它'], ['回合', '机顶计数盘正中的数字'], ['时期', '年份下面；早期的取景器里是黑白的'], ['行动轮', '取景器右沿的刻度和指针'], ['谁行动', '右下']],
  pros: ['画面是十组里最大的，写实的画看得最清楚，代入感最强', '只讲“现在”，不分心：一张画、一个年份', '快门一闪换回合，干脆'],
  cons: ['看不到过去和将来，进度只剩计数盘上的一个数字', '面板本身是十组里最大的一块'],
  mount(el, ctx) {
    const n = ctx.rules.turns;
    el.innerHTML =
      `<div class="v10-f"><div class="v10-img">${ctx.pic(1, 'on')}${ctx.pic(1)}</div>` +
      '<i class="v10-lines"></i><i class="v10-patch"></i>' +
      '<div class="v10-scale"></div>' +
      '<em class="v10-what"><span data-t="title"></span></em><em class="v10-stamp"></em>' +
      '<i class="v10-shut"></i></div>' +
      '<div class="v10-side">' +
      `<div class="v10-count"><div class="v10-dial">${ctx.times(n, (i) => `<b style="--k:${i}">${i + 1}</b>`)}</div><i></i></div>` +
      '<div class="v10-yr"><b class="ep-year" data-t="year"></b><div><b class="ep-era" data-t="era"></b><span class="ep-meta" data-t="turn"></span></div></div>' +
      '<div class="v10-ph"><b class="ep-head" data-t="head"></b><span class="ep-hint" data-t="hint"></span></div>' +
      '</div>';
    const layers = [...el.querySelectorAll('.v10-img .ep-pic')];
    const scale = el.querySelector('.v10-scale');
    const finder = el.querySelector('.v10-f');
    let front = 0;
    return (v, prev) => {
      el.style.setProperty('--i', v.turn - 1);
      if (!prev) ctx.setPic(layers[front], v.turn);
      else if (prev.turn !== v.turn) {
        front = 1 - front;
        ctx.setPic(layers[front], v.turn);
        layers[front].classList.add('on');
        layers[1 - front].classList.remove('on');
        finder.classList.remove('click');
        void finder.offsetWidth;
        finder.classList.add('click');
      }
      el.querySelector('.v10-stamp').textContent = `'${String(v.year).slice(2)}`;
      // the scale reads upwards: round 1 at the foot
      scale.innerHTML = `<span>${ctx.times(v.rounds, (i) => `<i class="${ctx.state3(v.rounds - i, v.round)}"></i>`)}</span><u style="--at:${(v.rounds - v.round + 0.5) / v.rounds}"></u>`;
    };
  },
};
