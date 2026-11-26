import './05-film.css';
import { SPANS, emblemOf, phase, scene, times } from '../time.js';

export default {
  id: '05',
  name: '胶片',
  ref: '放映机片门里的一格',
  pane: true,
  idea: '十个回合是一条胶片上的十格，每格是那几年里的一个画面。当前这格停在片门里，过去的发黄，没到的还没曝光。',
  read: [['年份', '片门下面的大数字'], ['回合', '片门里那一格，格子上有格号；左边是过去，右边是将来'], ['时期', '年份右边'], ['行动轮', '片门下沿的七段进度']],
  pros: ['每个回合有自己的画面，时代是看出来的而不是读出来的', '过去和将来同时在场：左边发黄的是历史，右边黑的是未知', '换回合时整条胶片走一格，动作很明确'],
  cons: ['宽，而且画面细节在这个尺寸上只能看个大概', '哪张画代表哪个回合是我先挑的，要你们定'],
  mount(el) {
    const frames = SPANS.map(([a, b], i) => `<div class="s5-f" data-turn="${i + 1}">${scene(emblemOf(i + 1))}<i>${i + 1}</i><em>${a}–${String(b).slice(2)}</em></div>`).join('');
    el.innerHTML = `<div class="s5-win"><div class="s5-strip">${frames}</div><i class="s5-gate"><span class="s5-prog"></span></i></div><div class="s5-cap"><b class="s5-year"></b><span class="s5-what"></span><span class="s5-phase"></span></div>`;
    return (t) => {
      el.dataset.era = t.era.id;
      el.style.setProperty('--i', t.turn - 1);
      el.querySelectorAll('.s5-f').forEach((f) => {
        const n = +f.dataset.turn;
        f.className = 's5-f ' + (n < t.turn ? 'past' : n === t.turn ? 'now' : 'next');
      });
      el.querySelector('.s5-prog').innerHTML = times(t.rounds, (i) => `<i class="${i + 1 < t.round ? 'done' : i + 1 === t.round ? 'now' : ''}"></i>`);
      el.querySelector('.s5-year').textContent = t.year;
      el.querySelector('.s5-what').innerHTML = `<b>${t.era.name}</b>回合 ${t.turn}<i>/${t.turns}</i> · 行动轮 ${t.round}<i>/${t.rounds}</i>`;
      const p = el.querySelector('.s5-phase');
      p.textContent = phase(t);
      p.className = 's5-phase ' + (t.active ? 'b' : 'a');
    };
  },
};
