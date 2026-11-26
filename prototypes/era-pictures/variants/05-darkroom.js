import './05-darkroom.css';

const SHOWN = 3; // prints on the line; older ones are stacked behind the first

export default {
  id: '05',
  name: '显影',
  ref: '暗房里，显影盘中的一张相纸',
  idea: '这个回合的照片正泡在显影盘里：行动轮每过一轮，画面就显出来一些，最后一轮才完全清楚。回合结束，它被夹到绳子上晾着，下一张白纸进盘。',
  read: [['年份', '右下的大数字'], ['回合', '盘里那张是现在；绳子上晾的是过去的几个回合，最右是刚过去的'], ['时期', '年份右边'], ['行动轮', '画面显影的程度，旁边的圆点是准数'], ['谁行动', '右下角']],
  pros: ['十组里只有它把“行动轮”也做进了画面：一回合的推进看得见', '回合一开始画面是淡的，越打越清楚，有悬念', '绳子上越挂越多，历史是自己攒出来的'],
  cons: ['回合头两轮画面看不清，这是它的手法，也是它的代价', '安全灯下全是单色，三个时期在颜色上没有区别'],
  mount(el, ctx) {
    el.innerHTML =
      '<div class="d5-tray"><div class="d5-paper">' + ctx.pic(1, '', false) + '</div><i class="d5-bath"></i><i class="d5-tongs"></i></div>' +
      '<div class="d5-right">' +
      '<div class="d5-line"><svg class="d5-wire" viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M0,1 Q50,9 100,1"/></svg><div class="d5-hung"></div></div>' +
      '<div class="d5-read"><b class="ep-year" data-t="year"></b><div><b class="ep-era" data-t="era"></b><span class="ep-meta" data-t="turn"></span></div></div>' +
      '<div class="d5-desk"><b class="ep-head" data-t="head"></b><span class="ep-pips" data-t="pips"></span></div>' +
      '</div><i class="d5-lamp"></i>';
    const paper = el.querySelector('.d5-paper');
    const pic = paper.querySelector('.ep-pic');
    const hung = el.querySelector('.d5-hung');
    return (v, prev) => {
      const turned = !prev || prev.turn !== v.turn;
      if (turned) {
        ctx.setPic(pic, v.turn, false);
        const from = Math.max(1, v.turn - SHOWN);
        hung.innerHTML =
          (from > 1 ? `<span class="d5-more">${from - 1}</span>` : '') +
          ctx.times(v.turn - from, (k) => {
            const t = from + k;
            return `<div class="d5-h${prev && t === v.turn - 1 && prev.turn === t ? ' new' : ''}" style="--tilt:${((t * 53) % 7) - 3}deg;--sag:${Math.abs(2 * (k + 0.5) / Math.max(1, v.turn - from) - 1)}"><i></i>${ctx.pic(t, '', false)}</div>`;
          });
        // a fresh sheet goes into the bath with nothing on it yet
        paper.classList.remove('fresh');
        void paper.offsetWidth;
        if (prev) paper.classList.add('fresh');
      }
      el.style.setProperty('--p', (v.round / v.rounds).toFixed(3));
      if (prev && prev.round !== v.round) {
        el.classList.remove('rock');
        void el.offsetWidth;
        el.classList.add('rock');
      }
    };
  },
};
