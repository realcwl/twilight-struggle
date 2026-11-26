import './06-stamp.css';
import { han, nextId, phase, scene, times } from '../time.js';

const pt = (r, deg) => `${(62 + r * Math.cos((deg * Math.PI) / 180)).toFixed(2)},${(62 + r * Math.sin((deg * Math.PI) / 180)).toFixed(2)}`;

export default {
  id: '06',
  name: '邮票与邮戳',
  ref: '一枚盖销的纪念邮票',
  idea: '每个回合是一枚邮票，画的是那几年的事，面值就是回合数；年份盖在邮戳里。每个行动轮多一道销票的波纹。',
  read: [['年份', '邮戳正中'], ['回合', '邮票左下角的面值，邮戳上沿也写着'], ['时期', '邮票的油墨颜色：早期砖红、中期青蓝、后期紫；邮戳下沿有字'], ['行动轮', '邮戳右边的七道波纹，盖到第几道就是第几轮']],
  pros: ['十枚邮票就是一套“冷战纪念票”，有收集感', '单色雕版的画面比彩色小图耐看，也不抢地图的颜色', '邮戳是天然的“日期”符号'],
  cons: ['读数分散：年份在邮戳里、回合在面值上', '邮戳是斜的，年份不如翻牌和日历好认', '是一件实物，和深色面板不是同一种材质'],
  mount(el) {
    const id = nextId();
    const waves = times(7, (i) => `<path class="p6-w" d="M120,${28 + i * 11.4}q7,-5 14,0t14,0t14,0t14,0t14,0t14,0t14,0"/>`);
    el.innerHTML =
      '<div class="p6-stamp"><div class="p6-in"><div class="p6-top"><b></b><span></span></div><div class="p6-art"></div><b class="p6-val"></b><span class="p6-bot"></span></div></div>' +
      `<svg class="p6-mark" viewBox="0 0 224 124"><defs><path id="${id}-t" d="M${pt(37.5, 190)}A37.5,37.5 0 0 1 ${pt(37.5, 350)}"/><path id="${id}-b" d="M${pt(46.5, 160)}A46.5,46.5 0 0 0 ${pt(46.5, 20)}"/></defs>` +
      `<circle class="p6-ring" cx="62" cy="62" r="56"/><circle class="p6-ring thin" cx="62" cy="62" r="52"/><circle class="p6-ring thin" cx="62" cy="62" r="30.5"/>` +
      `<text class="p6-arc"><textPath href="#${id}-t" startOffset="50%"></textPath></text><text class="p6-arc"><textPath href="#${id}-b" startOffset="50%"></textPath></text>` +
      `<text class="p6-year" x="62" y="66"></text><text class="p6-sub" x="62" y="80"></text>${waves}</svg><div class="p6-phase"></div>`;
    let turn = 0;
    return (t) => {
      el.dataset.era = t.era.id;
      if (turn !== t.turn) {
        turn = t.turn;
        el.querySelector('.p6-art').innerHTML = scene(t.emblem);
        el.classList.remove('fresh');
        void el.offsetWidth;
        el.classList.add('fresh');
      }
      el.querySelector('.p6-top b').textContent = t.era.name;
      el.querySelector('.p6-top span').textContent = `${t.eraYears[0]}–${t.eraYears[1]}`;
      el.querySelector('.p6-val').textContent = t.turn;
      el.querySelector('.p6-bot').textContent = t.emblem.title;
      const arcs = el.querySelectorAll('textPath');
      arcs[0].textContent = `第${han(t.turn)}回合 · 共${han(t.turns)}回合`;
      arcs[1].textContent = `${t.era.name} · 第${han(t.round)}行动轮`;
      el.querySelector('.p6-year').textContent = t.year;
      el.querySelector('.p6-sub').textContent = `${t.round} / ${t.rounds}`;
      el.querySelectorAll('.p6-w').forEach((w, i) => w.setAttribute('class', 'p6-w ' + (i + 1 < t.round ? 'done' : i + 1 === t.round ? 'now' : '')));
      const p = el.querySelector('.p6-phase');
      p.textContent = phase(t);
      p.className = 'p6-phase ' + (t.active ? 'b' : 'a');
    };
  },
};
