import './04-paper.css';
import { han, hanYear, scene, sideName } from '../time.js';

export default {
  id: '04',
  name: '头版',
  ref: '当天的报纸',
  idea: '左上角压着一份报纸：报头是年份，头条是桌上那张牌。每出一张牌就是一条新闻，每个行动轮是一版。',
  read: [['年份', '报头右边的大数字，日期栏里是汉字年份'], ['时期 / 回合', '日期栏中间'], ['行动轮', '日期栏右边：第几版，共七版'], ['刚出的牌', '头条和配图：谁打出的、牌名、地点和日期']],
  pros: ['把“年份”和“刚才发生了什么”合成一件事，代入感最强', '牌本来就有地点和日期，头条不用另外写内容', '后期的报纸换成彩色照片，时代在往前走'],
  cons: ['信息多，年份不是最大的东西', '和出牌区重复：桌上那张牌在左下角已经有了'],
  mount(el) {
    el.innerHTML =
      '<div class="n4-mast"><b>环球纪事</b><span class="n4-year"></span></div><div class="n4-date"><span class="n4-han"></span><span class="n4-turn"></span><span class="n4-ed"></span></div>' +
      '<div class="n4-body"><div class="n4-pic"></div><div class="n4-text"><em class="n4-kick"></em><h3></h3><p class="n4-by"></p><i class="n4-lines"></i></div></div>';
    let shown = null;
    return (t) => {
      el.dataset.era = t.era.id;
      el.querySelector('.n4-year').textContent = t.year;
      el.querySelector('.n4-han').textContent = `${hanYear(t.year)}年`;
      el.querySelector('.n4-turn').textContent = `${t.era.name} · 第${han(t.turn)}回合`;
      el.querySelector('.n4-ed').textContent = `第 ${t.round} 版 / 共 ${t.rounds} 版`;
      // the story is the card on the table; with nothing on the table, something from these years
      const card = t.played?.card ?? t.emblem;
      el.querySelector('.n4-kick').textContent = t.played ? `${sideName(t.played.by)}出牌` : '本回合要闻';
      if (shown === card.no) return;
      shown = card.no;
      el.querySelector('.n4-pic').innerHTML = scene(card);
      el.querySelector('h3').textContent = card.title;
      el.querySelector('.n4-by').textContent = `${card.place} · ${card.date}`;
      el.querySelector('.n4-body').classList.remove('fresh');
      void el.offsetWidth;
      el.querySelector('.n4-body').classList.add('fresh');
    };
  },
};
