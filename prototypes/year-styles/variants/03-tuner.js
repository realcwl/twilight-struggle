import './03-tuner.css';
import { SPANS, ERA_YEARS, times } from '../time.js';

const Y0 = 1945;
const Y1 = 1991;
const X = (y) => 16 + (y - Y0) * 9.5; // the scale is drawn 470 wide
const W = 470;

export default {
  id: '03',
  name: '调谐刻度',
  ref: '短波收音机的调谐窗',
  idea: '整段冷战是一条调谐刻度，红针停在今年。三个时期是三个波段，十个回合是十个台。',
  read: [['年份', '红针的位置，左下角亮着的数字是读数'], ['时期', '刻度上方的三段波段，当前一段点亮'], ['回合', '波段下面的台号 1 到 10，当前台点亮'], ['行动轮', '右下七盏小灯；每过一轮红针往右挪一点'], ['轮到谁', '最右的指示灯：蓝是你，红是对手']],
  pros: ['唯一一个把“全程”和“现在”放在同一条线上的：一眼知道走了多远、还剩多少', '指针每个行动轮都动，时间是连续流过去的', '发光的刻度在深色地图上很有气氛'],
  cons: ['很宽，占掉左上一长条', '刻度上的年份字小，精确年份要看读数'],
  mount(el) {
    const eras = Object.entries(ERA_YEARS);
    const bands = eras.map(([id, [a, b]], i) => `<g class="t3-band" data-era="${id}"><path d="M${X(a) - 3},17H${X(b) + 3}"/><text x="${(X(a) + X(b)) / 2}" y="11">${['早期', '中期', '后期'][i]}</text></g>`).join('');
    const stations = SPANS.map(([a, b], i) => `<g class="t3-st" data-turn="${i + 1}"><path d="M${X(a)},33V30H${X(b)}V33"/><text x="${(X(a) + X(b)) / 2}" y="27">${i + 1}</text></g>`).join('');
    const ticks = times(Y1 - Y0 + 1, (i) => `<path class="t3-tick${(Y0 + i) % 5 ? '' : ' x'}" d="M${X(Y0 + i)},40V${(Y0 + i) % 5 ? 46 : 51}"/>`);
    const labels = times(Y1 - Y0 + 1, (i) => ((Y0 + i) % 5 ? '' : `<text class="t3-y" x="${X(Y0 + i)}" y="63">${Y0 + i}</text>`));
    el.innerHTML =
      `<div class="t3-glass"><svg viewBox="0 0 ${W} 70">${bands}${stations}<path class="t3-line" d="M${X(Y0)},40H${X(Y1)}"/>${ticks}${labels}</svg><i class="t3-needle"></i></div>` +
      '<div class="t3-row"><b class="t3-year"></b><span class="t3-what"></span><span class="t3-rounds"></span><span class="t3-eye"><i></i><em></em></span></div>';
    return (t) => {
      el.dataset.era = t.era.id;
      // the needle moves a little every action round, even when the year on the readout has not turned
      const at = t.from + ((t.round - 1) * (t.to - t.from + 1)) / t.rounds + 0.5 * ((t.to - t.from + 1) / t.rounds);
      el.style.setProperty('--at', (X(at) / W).toFixed(4));
      el.querySelectorAll('.t3-band').forEach((b) => b.classList.toggle('on', b.dataset.era === t.era.id));
      el.querySelectorAll('.t3-st').forEach((s) => {
        s.classList.toggle('on', +s.dataset.turn === t.turn);
        s.classList.toggle('done', +s.dataset.turn < t.turn);
      });
      el.querySelector('.t3-year').textContent = t.year;
      el.querySelector('.t3-what').innerHTML = `<b>${t.era.name}</b>回合 ${t.turn}<i>/${t.turns}</i>`;
      el.querySelector('.t3-rounds').innerHTML = times(t.rounds, (i) => `<i class="${i + 1 < t.round ? 'done' : i + 1 === t.round ? 'now' : ''}"></i>`);
      const eye = el.querySelector('.t3-eye');
      eye.className = 't3-eye ' + (t.active ? 'b' : 'a');
      eye.querySelector('em').textContent = t.active ? '对手行动' : '轮到你';
    };
  },
};
