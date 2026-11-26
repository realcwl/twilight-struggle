import './02-calendar.css';
import { han, hanYear, sideName, times } from '../time.js';

export default {
  id: '02',
  name: '撕页日历',
  ref: '墙上的日历本',
  idea: '一本挂在墙上的日历：一回合一页，换回合时撕掉一页，下面露出来的纸边就是还剩几回合。',
  read: [['年份', '页面正中的大数字，页眉是汉字年份'], ['时期', '页眉右边；页眉的颜色跟着时期换'], ['回合', '大数字下面一行'], ['行动轮', '一行七格，像一周七天：过去的划掉，当前的圈起来'], ['剩余回合', '日历本底下的纸边厚度']],
  pros: ['“撕掉一页”是最不用解释的时间流逝', '纸边厚度让“还剩多少”不用读数字', '亮色的纸在深色地图上很容易找到'],
  cons: ['是一件实物，和其它三个角的深色面板不是同一种材质', '面积偏大，而且是竖的'],
  mount(el) {
    el.innerHTML =
      '<div class="c2-bind"><i></i><i></i></div><div class="c2-stack"></div>' +
      '<div class="c2-page"><div class="c2-band"><b class="c2-han"></b><span class="c2-era"></span></div><div class="c2-year"></div><div class="c2-turn"></div><div class="c2-week"></div><div class="c2-note"></div></div>';
    const page = el.querySelector('.c2-page');
    let turn = null;
    return (t) => {
      // a new turn: the old page comes away
      if (turn !== null && turn !== t.turn) {
        const old = page.cloneNode(true);
        old.classList.add('c2-torn');
        el.appendChild(old);
        setTimeout(() => old.remove(), 750);
      }
      turn = t.turn;
      el.dataset.era = t.era.id;
      el.style.setProperty('--left', t.turns - t.turn);
      page.querySelector('.c2-han').textContent = `${hanYear(t.year)}年`;
      page.querySelector('.c2-era').textContent = t.era.name;
      page.querySelector('.c2-year').textContent = t.year;
      page.querySelector('.c2-turn').innerHTML = `第<b>${han(t.turn)}</b>回合<i>共${han(t.turns)}回合</i>`;
      page.querySelector('.c2-week').innerHTML = times(t.rounds, (i) => `<i class="${i + 1 < t.round ? 'done' : i + 1 === t.round ? 'now' : ''}">${i + 1}</i>`);
      page.querySelector('.c2-note').innerHTML = t.active === 0 ? '<b>宜</b>出牌' : `<b>候</b>${sideName(1)}行动`;
    };
  },
};
