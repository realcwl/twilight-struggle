import './09-ledger.css';

export default {
  id: '09',
  name: '牌册',
  ref: '把手牌当清单读',
  idea: '手牌不是扇形，而是右侧一列清单：点数、标题、阵营一行一张，悬停才出整张牌。所有刻度也收在这一列。',
  where: [
    ['回合 / 行动轮', '右栏顶部'],
    ['胜利点 / 核危机 / 军事行动 / 太空竞赛', '右栏上半：四行读数，胜利点带一根小拉锯条'],
    ['手牌', '右栏中段的清单；悬停在左边弹出整张牌，往左拖到地图上打出'],
    ['牌库 / 弃牌 / 废牌', '右栏底部三个计数'],
    ['本轮出牌', '右栏左边，贴着底'],
  ],
  pros: ['八张牌的点数和标题同时可读，不用一张张悬停', '所有信息在同一列，地图左边和上下都是空的', '清单天然可以排序、分组（按点数、按阵营）'],
  cons: ['没有“手里拿着牌”的感觉，卡面美术平时看不到', '右栏是实心的，地图要让出 16% 的宽度', '牌多的时候清单变长，挤占读数的位置'],
  hand: { form: 'list', w: 13, hover: 2.05 },
  html: `
<div class="col pane">
  <header>
    <div data-w="time" data-form="chip"></div>
    <div data-w="time" data-form="rounds"></div>
    <div data-w="phase"></div>
  </header>
  <div class="stats">
    <div data-w="vp" data-form="chip"></div>
    <div data-w="vp" data-form="bar"></div>
    <div data-w="crisis" data-form="chip"></div>
    <div data-w="milops" data-form="chip"></div>
    <div data-w="space" data-form="chip"></div>
  </div>
  <div class="cards">
    <div class="cap"><span class="lb">手牌</span><span class="hint">悬停看牌 · 往左拖出打出</span></div>
    <div data-hand></div>
  </div>
  <footer>
    <div data-w="pile" data-kind="deck" data-form="chip"></div>
    <div data-w="pile" data-kind="discard" data-form="chip"></div>
    <div data-w="pile" data-kind="removed" data-form="chip"></div>
    <div data-w="opp" data-form="chip"></div>
  </footer>
</div>
<div data-w="played" class="table"></div>`,
};
