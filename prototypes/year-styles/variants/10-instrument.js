import './10-instrument.css';
import { phase, times } from '../time.js';

const xy = (r, deg) => [100 + r * Math.cos((deg * Math.PI) / 180), 100 + r * Math.sin((deg * Math.PI) / 180)];
const pt = (r, deg) => xy(r, deg).map((v) => v.toFixed(2)).join(',');
const arc = (r, a0, a1) => `M${pt(r, a0)}A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${pt(r, a1)}`;
const A0 = 135; // where the scale starts, lower left; it runs clockwise over the top
const SWEEP = 270;

export default {
  id: '10',
  name: '仪表钟',
  ref: '驾驶舱里的航空钟',
  pane: true,
  idea: '和右下角的核危机表是一对：一块航空钟。长针指行动轮，上面一道小弧是十个回合，年份是下面的滚轮计数器。',
  read: [['年份', '表盘下方的四位滚轮，换年时滚动'], ['行动轮', '长针指着 1 到 7'], ['回合', '表盘上方的小弧，十格，时期之间留缺口'], ['时期', '小弧下面的字']],
  pros: ['和核危机表同一套材质和画法，整个界面是一套仪表', '行动轮是这里最显眼的读数，而它正是打牌时最常看的', '最紧凑，和现在的转盘差不多大'],
  cons: ['时代感最弱：早期和后期只是换两个字', '读数分三处（针、弧、滚轮），第一次看要学'],
  mount(el) {
    el.innerHTML = '<div class="i10-dial"><svg viewBox="0 0 200 200"></svg><div class="i10-year"></div></div><div class="i10-read"><b class="i10-phase"></b><span class="i10-turns"></span><span class="i10-round"></span><span class="i10-span"></span></div>';
    const svg = el.querySelector('svg');
    const drums = el.querySelector('.i10-year');
    drums.innerHTML = times(4, () => `<span><i>${times(10, (d) => `<b>${d}</b>`)}</i></span>`);
    let built = '';
    return (t) => {
      el.dataset.era = t.era.id;
      if (built !== `${t.rounds}/${t.turns}`) {
        built = `${t.rounds}/${t.turns}`;
        const step = SWEEP / (t.rounds - 1);
        const ticks = times((t.rounds - 1) * 4 + 1, (i) => `<path class="i10-tick${i % 4 ? '' : ' x'}" d="M${pt(88, A0 + (i * step) / 4)}L${pt(i % 4 ? 84.5 : 80.5, A0 + (i * step) / 4)}"/>`);
        const nums = times(t.rounds, (i) => {
          const [x, y] = xy(70.5, A0 + i * step);
          return `<text class="i10-n" data-round="${i + 1}" x="${x.toFixed(2)}" y="${(y + 4.6).toFixed(2)}">${i + 1}</text>`;
        });
        // ten turns on a small arc, split where an era ends
        const gaps = Array.from({ length: t.turns }, (_, i) => (t.eras.some((e) => e.to === i + 1) ? 9 : 2.6));
        const each = (150 - gaps.slice(0, -1).reduce((a, b) => a + b, 0)) / t.turns;
        let at = 195;
        const turns = gaps.map((g, i) => {
          const d = arc(47, at, at + each);
          at += each + g;
          return `<path class="i10-turn" data-turn="${i + 1}" d="${d}"/>`;
        }).join('');
        svg.innerHTML =
          `<circle class="i10-bezel" cx="100" cy="100" r="97"/><circle class="i10-face" cx="100" cy="100" r="92"/><path class="i10-hair" d="${arc(88, A0, A0 + SWEEP)}"/><path class="i10-done" d=""/>${ticks}${nums}${turns}` +
          '<text class="i10-era" x="100" y="127"></text>' +
          '<g class="i10-hand"><path d="M100,112L97.9,100L99.5,26H100.5L102.1,100Z"/></g><circle class="i10-hub" cx="100" cy="100" r="6"/><circle class="i10-pin" cx="100" cy="100" r="2"/>';
      }
      const step = SWEEP / (t.rounds - 1);
      svg.querySelector('.i10-hand').style.transform = `rotate(${A0 + (t.round - 1) * step - 270}deg)`;
      svg.querySelector('.i10-done').setAttribute('d', t.round > 1 ? arc(88, A0, A0 + (t.round - 1) * step) : '');
      svg.querySelectorAll('.i10-n').forEach((n) => n.setAttribute('class', 'i10-n ' + (+n.dataset.round < t.round ? 'done' : +n.dataset.round === t.round ? 'on' : '')));
      svg.querySelectorAll('.i10-turn').forEach((n) => n.setAttribute('class', 'i10-turn ' + (+n.dataset.turn < t.turn ? 'done' : +n.dataset.turn === t.turn ? 'on' : '')));
      svg.querySelector('.i10-era').textContent = t.era.name;
      [...String(t.year)].forEach((d, i) => drums.children[i].style.setProperty('--d', d));
      const p = el.querySelector('.i10-phase');
      p.textContent = phase(t);
      p.className = 'i10-phase ' + (t.active ? 'b' : 'a');
      el.querySelector('.i10-turns').innerHTML = `回合 <b>${t.turn}</b><i>/${t.turns}</i>`;
      el.querySelector('.i10-round').innerHTML = `行动轮 <b>${t.round}</b><i>/${t.rounds}</i>`;
      el.querySelector('.i10-span').textContent = `${t.from} – ${t.to}`;
    };
  },
};
