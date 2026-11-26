import './09-medals.css';
import { ERA_YEARS, emblemOf, phase, scene, times } from '../time.js';

const pt = (r, deg) => `${(50 + r * Math.cos((deg * Math.PI) / 180)).toFixed(2)},${(50 + r * Math.sin((deg * Math.PI) / 180)).toFixed(2)}`;
const arc = (r, a0, a1) => `M${pt(r, a0)}A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${pt(r, a1)}`;

export default {
  id: '09',
  name: '三枚徽章',
  ref: '现在这个转盘，拆成三枚',
  pane: true,
  idea: '转盘拆成三枚珐琅徽章，一个时期一枚，和牌面是同一种画框。当前时期那枚放大，画面是这个回合的事；过去的发黄，没到的只有年份。',
  read: [['年份', '右边的大数字'], ['时期', '三枚徽章里放大的那枚，下面有名字'], ['回合', '徽章外圈的分段：早期三段、中期四段、后期三段，亮的是当前回合'], ['行动轮', '年份下面的一排点']],
  pros: ['和现在的转盘、和牌面的金圈画框是同一种语言，换上去最不突兀', '三个时期各有一张脸，而且过去 / 现在 / 未来一眼分得出', '外圈分段保留了转盘“走到第几段”的读法'],
  cons: ['比现在的转盘宽一倍多', '小的那两枚里的画看不清，只起占位作用'],
  mount(el) {
    const pin = (era) => {
      const n = era.to - era.from + 1;
      const gap = 6;
      const each = (290 - gap * (n - 1)) / n;
      // the rim is open at the bottom, where the name hangs
      const segs = times(n, (i) => `<path class="seg" data-turn="${era.from + i}" d="${arc(46, 125 + i * (each + gap), 125 + i * (each + gap) + each)}"/>`);
      return `<div class="e9-pin" data-era="${era.id}" data-from="${era.from}" data-to="${era.to}"><svg viewBox="0 0 100 100" class="e9-rim">${segs}</svg><div class="e9-disc"></div><span class="e9-name">${era.name}</span></div>`;
    };
    el.innerHTML = '<div class="e9-pins"></div><div class="e9-read"><b class="e9-year"></b><span class="e9-turn"></span><span class="e9-rounds"></span><span class="e9-phase"></span></div>';
    let built = false;
    let key = '';
    return (t) => {
      if (!built) {
        el.querySelector('.e9-pins').innerHTML = t.eras.map(pin).join('');
        built = true;
      }
      el.dataset.era = t.era.id;
      el.querySelectorAll('.e9-pin').forEach((p) => {
        const from = +p.dataset.from;
        const to = +p.dataset.to;
        const when = t.turn > to ? 'past' : t.turn < from ? 'next' : 'now';
        p.className = 'e9-pin ' + when;
        p.querySelectorAll('.seg').forEach((s) => s.setAttribute('class', 'seg ' + (+s.dataset.turn < t.turn ? 'done' : +s.dataset.turn === t.turn ? 'on' : '')));
        // the picture: this turn's for the current era, the era's last one once it is over, nothing yet for the future
        const show = when === 'now' ? t.turn : when === 'past' ? to : 0;
        if (+p.dataset.show === show) return;
        p.dataset.show = show;
        const [a, b] = ERA_YEARS[p.dataset.era];
        p.querySelector('.e9-disc').innerHTML = show ? scene(emblemOf(show)) : `<i>${a}<br>${b}</i>`;
      });
      el.querySelector('.e9-year').textContent = t.year;
      el.querySelector('.e9-turn').innerHTML = `回合 <b>${t.turn}</b><i>/${t.turns}</i>`;
      if (key !== `${t.rounds}`) el.querySelector('.e9-rounds').innerHTML = '<em>行动轮</em>' + times(t.rounds, (i) => `<i>${i + 1}</i>`);
      key = `${t.rounds}`;
      el.querySelectorAll('.e9-rounds i').forEach((d, i) => (d.className = i + 1 < t.round ? 'done' : i + 1 === t.round ? 'now' : ''));
      const p = el.querySelector('.e9-phase');
      p.textContent = phase(t);
      p.className = 'e9-phase ' + (t.active ? 'b' : 'a');
    };
  },
};
