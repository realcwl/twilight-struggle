import './07-dossier.css';
import { pad2, times } from '../time.js';

const GRADE = { early: '绝密', middle: '机密', late: '秘密' };

export default {
  id: '07',
  name: '卷宗',
  ref: '档案柜里抽出来的一份卷宗',
  idea: '一份牛皮纸卷宗：年份打在索引标签上，标签靠左、居中、靠右对应早、中、后期；里面夹着一张打字的登记卡。',
  read: [['年份', '卷宗标签上的打字数字'], ['时期', '标签的位置（左 / 中 / 右），卡片第二行，还有红色印章的密级'], ['回合', '卡片第一行：第几号卷宗，共十号'], ['行动轮', '第三行的七个方框：打叉的是过去，涂黑的是当前'], ['轮到谁', '最后一行']],
  pros: ['间谍和档案是这个题材最贴的质感', '打字机表格天生适合列“回合、时期、行动轮”这类条目，读起来不费劲', '标签位置让时期不用读字'],
  cons: ['文字多，是“读”而不是“看”', '年份在标签上，尺寸不如翻牌和日历', '是一件实物，和深色面板不是同一种材质'],
  mount(el) {
    el.innerHTML =
      '<div class="d7-tab"><b></b></div><div class="d7-folder"><div class="d7-card"><i class="d7-clip"></i>' +
      '<p><span>卷宗</span><b class="d7-no"></b></p><p><span>时期</span><b class="d7-era"></b></p><p><span>行动轮</span><b class="d7-boxes"></b></p><p><span>现况</span><b class="d7-now"></b></p>' +
      '<em class="d7-stamp"></em></div></div>';
    let turn = 0;
    return (t) => {
      el.dataset.era = t.era.id;
      el.querySelector('.d7-tab b').textContent = t.year;
      el.querySelector('.d7-no').innerHTML = `第 ${pad2(t.turn)} 号<i> / 共 ${t.turns} 号</i>`;
      el.querySelector('.d7-era').innerHTML = `${t.era.name}<i> ${t.eraYears[0]}–${t.eraYears[1]}</i>`;
      el.querySelector('.d7-boxes').innerHTML = times(t.rounds, (i) => `<i class="${i + 1 < t.round ? 'done' : i + 1 === t.round ? 'now' : ''}"></i>`);
      const now = el.querySelector('.d7-now');
      now.textContent = t.active === 0 ? '轮到我方' : '对方行动中';
      now.className = 'd7-now ' + (t.active ? 'b' : 'a');
      el.querySelector('.d7-stamp').textContent = GRADE[t.era.id];
      if (turn && turn !== t.turn) {
        el.classList.remove('fresh');
        void el.offsetWidth;
        el.classList.add('fresh');
      }
      turn = t.turn;
    };
  },
};
