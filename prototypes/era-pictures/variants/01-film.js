import './01-film.css';

export default {
  id: '01',
  name: '胶片',
  ref: '放映机片门里的一格',
  idea: '十个回合是一条胶片上的十格，每格是那几年的一个画面。当前这格停在片门里；过去的暗下去，没到的还没曝光。早期是黑白片，中期是褪色的彩色，后期是鲜艳的彩色。',
  read: [['年份', '片门下面的大数字'], ['回合', '片门里那一格，格角有格号；左边是过去，右边是将来'], ['时期', '年份右边，也看胶片本身：黑白、褪色、彩色'], ['行动轮', '第二行的一排圆点'], ['谁行动', '右下角']],
  pros: ['上一轮你说不错的那一组，结构没动，只把画面换成写实的', '过去和将来同时在场，换回合时整条胶片走一格', '三个时期的胶片质感不同，时代是看出来的'],
  cons: ['宽：一条胶片要露出四五格才成立', '每格只有六七十像素宽，写实画面的细节只能看个大概'],
  mount(el, ctx) {
    const frames = ctx.times(ctx.rules.turns, (i) => `<div class="f1-f" data-turn="${i + 1}">${ctx.pic(i + 1)}<i>${i + 1}</i></div>`);
    el.innerHTML =
      `<div class="f1-win"><div class="f1-strip">${frames}</div><i class="f1-gate"></i></div>` +
      '<div class="f1-cap">' +
      '<b class="ep-year" data-t="year"></b>' +
      '<div class="f1-mid"><div><b class="ep-era" data-t="era"></b><span class="ep-meta" data-t="turn"></span></div><div><span class="ep-lb">行动轮</span><span class="ep-pips" data-t="pips"></span></div></div>' +
      '<div class="f1-ph"><b class="ep-head" data-t="head"></b><span class="ep-hint" data-t="hint"></span></div>' +
      '</div>';
    const cells = [...el.querySelectorAll('.f1-f')];
    return (v) => {
      el.style.setProperty('--i', v.turn - 1);
      for (const f of cells) f.className = 'f1-f ' + ctx.state3(+f.dataset.turn, v.turn);
    };
  },
};
