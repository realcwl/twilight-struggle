import './03-slides.css';

export default {
  id: '03',
  name: '幻灯片',
  ref: '看片台上的一张反转片',
  idea: '每个回合是一张装在纸框里的幻灯片。当前这张压在看片台亮着的那一格上，透着光；看过的摞在左边，没看的还插在右边的片盒里。',
  read: [['年份', '右边的大数字；片框上写着这一张是哪几年'], ['回合', '亮着的那张，片框右上角是第几张；左边一摞是过去，右边片盒里剩几张就是还有几个回合'], ['时期', '年份下面'], ['行动轮', '一排圆点'], ['谁行动', '右上角']],
  pros: ['透光的反转片是十组里颜色最好看的：画面像自己在发光', '左边越摞越高、右边片盒越来越空，进度不用读数字', '画面比胶片那组大'],
  cons: ['一次只看得清一张，过去的只露出一角', '看片台是亮的，比其它三个角更抢眼'],
  mount(el, ctx) {
    const n = ctx.rules.turns;
    const slide = (cls) => `<div class="s3-m ${cls}"><b></b>${ctx.pic(1, '', false)}<i></i><u></u></div>`;
    el.innerHTML =
      '<div class="s3-table">' +
      `<div class="s3-past">${slide('p3')}${slide('p2')}${slide('p1')}</div>` +
      `<div class="s3-lit">${slide('now')}</div>` +
      `<div class="s3-box"><span>${ctx.times(n, () => '<i></i>')}</span><em></em></div>` +
      '</div>' +
      '<div class="s3-side">' +
      '<div class="s3-ph"><b class="ep-head" data-t="head"></b><span class="ep-hint" data-t="hint"></span></div>' +
      '<b class="ep-year" data-t="year"></b>' +
      '<div class="s3-row"><b class="ep-era" data-t="era"></b><span class="ep-meta" data-t="turn"></span></div>' +
      '<div class="s3-row"><span class="ep-lb">行动轮</span><span class="ep-pips" data-t="pips"></span></div>' +
      '</div>';
    const set = (m, turn) => {
      m.hidden = turn < 1;
      if (turn < 1) return;
      ctx.setPic(m.querySelector('.ep-pic'), turn);
      m.querySelector('b').textContent = ctx.spanOf(turn);
      m.querySelector('i').textContent = turn;
    };
    const now = el.querySelector('.s3-m.now');
    const past = [...el.querySelectorAll('.s3-past .s3-m')]; // oldest shown first, newest last
    const slots = [...el.querySelectorAll('.s3-box span i')];
    return (v, prev) => {
      set(now, v.turn);
      past.forEach((m, k) => set(m, v.turn - (past.length - k)));
      slots.forEach((s, k) => s.classList.toggle('gone', k < v.turn));
      el.querySelector('.s3-box em').textContent = v.turn < v.turns ? `余 ${v.turns - v.turn}` : '末张';
      if (prev && prev.turn !== v.turn) {
        el.classList.remove('s3-go');
        void el.offsetWidth;
        el.classList.add('s3-go');
      }
    };
  },
};
