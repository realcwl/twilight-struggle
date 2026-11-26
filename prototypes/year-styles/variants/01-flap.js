import './01-flap.css';
import { pad2, phase, times } from '../time.js';

const cell = (cls = '') => `<span class="fl ${cls}"><b></b></span>`;
// a flap only turns when what it shows changes
function put(node, ch) {
  const b = node.firstChild;
  if (b.textContent === ch) return;
  const first = b.textContent === '';
  b.textContent = ch;
  if (first) return;
  node.classList.remove('flip');
  void node.offsetWidth;
  node.classList.add('flip');
}

export default {
  id: '01',
  name: '翻牌',
  ref: '车站大厅的翻牌显示屏',
  pane: true,
  idea: '年份是四块翻牌。行动轮走着走着年份翻一格，换回合时整排一起翻。',
  read: [['年份', '四块大翻牌'], ['时期', '右边两块汉字翻牌，按时期换底色'], ['回合', '时期下面，04 / 10'], ['行动轮', '底下一排七格，亮的是当前']],
  pros: ['年份最大最醒目，一眼就是“现在是哪一年”', '翻动本身就是提示：有东西变了', '和面板是同一种深色材质，不抢地图'],
  cons: ['看不到全程：十个回合走到哪了只有一个数字', '时代感来自机械而不是画面，早期和后期看起来差不多'],
  mount(el) {
    el.innerHTML =
      `<div class="f1-year">${cell().repeat(4)}</div>` +
      `<div class="f1-side"><div class="f1-era">${cell('han').repeat(2)}</div><div class="f1-turn"><i>回合</i>${cell('sm').repeat(2)}<i class="of"></i></div></div>` +
      '<div class="f1-foot"><span class="f1-rounds"></span><span class="f1-phase"></span></div>';
    const year = el.querySelectorAll('.f1-year .fl');
    const era = el.querySelectorAll('.f1-era .fl');
    const turn = el.querySelectorAll('.f1-turn .fl');
    return (t) => {
      el.dataset.era = t.era.id;
      [...String(t.year)].forEach((d, i) => put(year[i], d));
      [...t.era.name].forEach((d, i) => put(era[i], d));
      [...pad2(t.turn)].forEach((d, i) => put(turn[i], d));
      el.querySelector('.of').textContent = `/ ${t.turns}`;
      el.querySelector('.f1-rounds').innerHTML = '<em>行动轮</em>' + times(t.rounds, (i) => `<i class="${i + 1 < t.round ? 'done' : i + 1 === t.round ? 'now' : ''}">${i + 1}</i>`);
      const p = el.querySelector('.f1-phase');
      p.textContent = phase(t);
      p.className = 'f1-phase ' + (t.active ? 'b' : 'a');
    };
  },
};
