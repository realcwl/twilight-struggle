import './06-monitors.css';

export default {
  id: '06',
  name: '监视墙',
  ref: '指挥中心的一面监视器',
  idea: '十个回合是墙上的十台小监视器，过去的还亮着，没到的没开机。当前这一台切到了旁边的主屏上放大。早期的画面是黑白的，中期开始有了发灰的彩色，后期才是鲜艳的彩色，就像电视本身走过的路。',
  read: [['年份', '主屏右边的大数字；主屏下沿的字幕条写着这是哪件事'], ['回合', '墙上亮着金框的那台'], ['时期', '年份旁边；也看主屏是黑白还是彩色'], ['行动轮', '控制台上的一排方灯'], ['谁行动', '右下']],
  pros: ['黑白到彩色的变化在显像管上最说得通', '主屏够大，写实画面看得清；小墙给出十个回合的全貌', '扫描线和玻璃反光让它像一件真东西'],
  cons: ['显像管是冷色的玻璃，和其它三个角的漆面金线不完全是一种材质', '信息分在主屏、小墙、文字三处，比胶片那组散'],
  mount(el, ctx) {
    const n = ctx.rules.turns;
    el.innerHTML =
      `<div class="m6-main"><div class="m6-tube">${ctx.pic(1)}<i class="m6-scan"></i><em><b data-t="title"></b><span></span></em><i class="m6-glass"></i></div></div>` +
      '<div class="m6-right">' +
      `<div class="m6-wall">${ctx.times(n, (i) => `<div class="m6-s" data-turn="${i + 1}"><span class="m6-t">${ctx.pic(i + 1)}<i class="m6-glass"></i></span><b>${i + 1}</b></div>`)}</div>` +
      '<div class="m6-read"><b class="ep-year" data-t="year"></b><div><b class="ep-era" data-t="era"></b><span class="ep-meta" data-t="turn"></span></div></div>' +
      '<div class="m6-desk"><b class="ep-head" data-t="head"></b><span class="ep-pips" data-t="pips"></span></div>' +
      '</div>';
    const tube = el.querySelector('.m6-tube');
    const pic = tube.querySelector('.ep-pic');
    const small = [...el.querySelectorAll('.m6-s')];
    return (v, prev) => {
      for (const s of small) s.className = 'm6-s ' + ctx.state3(+s.dataset.turn, v.turn);
      if (!prev || prev.turn !== v.turn) {
        ctx.setPic(pic, v.turn);
        tube.querySelector('em span').textContent = ctx.spanOf(v.turn);
        if (prev) {
          tube.classList.remove('switch');
          void tube.offsetWidth;
          tube.classList.add('switch');
        }
      }
    };
  },
};
