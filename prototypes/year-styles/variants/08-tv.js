import './08-tv.css';
import { pad2, phase, scene, times } from '../time.js';

export default {
  id: '08',
  name: '电视机',
  ref: '客厅里的那台电视',
  idea: '年份是电视画面上的字幕，画面是那几年的事。电视机自己跟着时期换代：早期是木壳黑白机，中期是带天线的塑料壳，后期是黑色彩电。回合是频道。',
  read: [['年份', '画面左上的字幕'], ['时期', '电视机的款式，画面是黑白、淡彩还是彩色；右上也有字'], ['回合', '频道号：CH 05 就是第 5 回合'], ['行动轮', '画面下沿的七格']],
  pros: ['“早、中、后期各自长什么样”在这里是真的不一样：机壳、画质、字体都换了', '换回合时像换台，画面闪一下', '画面是那个回合的事，时代感来自内容'],
  cons: ['换时期时整个零件的形状会变，位置感不稳', '字幕压在画面上，年份不算大', '最花哨的一个，长时间看可能会腻'],
  mount(el) {
    el.innerHTML =
      '<i class="v8-ant"></i><div class="v8-set"><div class="v8-screen"><div class="v8-pic"></div><i class="v8-lines"></i><div class="v8-osd"><b class="v8-year"></b><span class="v8-era"></span></div><div class="v8-low"><span class="v8-ch"></span><span class="v8-rounds"></span></div></div>' +
      '<div class="v8-ctl"><b class="v8-led"></b><i class="v8-knob"></i><i class="v8-knob"></i><span class="v8-grille"></span></div></div><div class="v8-cap"></div>';
    const screen = el.querySelector('.v8-screen');
    let turn = 0;
    return (t) => {
      el.dataset.era = t.era.id;
      if (turn !== t.turn) {
        el.querySelector('.v8-pic').innerHTML = scene(t.emblem);
        if (turn) {
          // changing channel
          screen.classList.remove('zap');
          void screen.offsetWidth;
          screen.classList.add('zap');
        }
        turn = t.turn;
      }
      el.querySelector('.v8-year').textContent = t.year;
      el.querySelector('.v8-era').textContent = t.era.name;
      el.querySelector('.v8-ch').textContent = `CH ${pad2(t.turn)}`;
      el.querySelector('.v8-led').textContent = pad2(t.turn);
      el.querySelector('.v8-rounds').innerHTML = times(t.rounds, (i) => `<i class="${i + 1 < t.round ? 'done' : i + 1 === t.round ? 'now' : ''}"></i>`);
      const p = el.querySelector('.v8-cap');
      p.textContent = phase(t);
      p.className = 'v8-cap ' + (t.active ? 'b' : 'a');
    };
  },
};
