import './05-rail.css';

export default {
  id: '05',
  name: '左侧栏',
  ref: '桌游数字版常见的状态栏',
  idea: '一条竖栏把所有刻度从上到下排好，像桌游说明书里的“状态卡”。右边和上方全空。',
  where: [
    ['回合 / 行动轮', '侧栏第一格'],
    ['胜利点', '侧栏第二格：数字 + 拉锯条'],
    ['核危机', '侧栏第三格：五格梯'],
    ['军事行动', '侧栏第四格：双方进度与差额'],
    ['太空竞赛', '侧栏第五格：一条共用轨道'],
    ['手牌', '底部，在侧栏以外的区域居中'],
    ['牌库 / 弃牌 / 废牌', '侧栏最下面三小叠'],
    ['本轮出牌', '侧栏右边，贴着底'],
  ],
  pros: ['固定的阅读顺序，新手照着从上往下读就行', '每个刻度都有完整图形，不用悬停', '侧栏只占 12% 屏宽，全景时正好盖在太平洋上，不挡任何节点'],
  cons: ['地图不再左右对称，视觉重心偏左', '七格等权重，看不出哪个更重要', '竖栏很长，底部的牌堆离手牌近、离眼睛远'],
  hand: { form: 'fan', w: 13, step: 9, arc: 1.2, sink: 4.6 },
  html: `
<div class="rail pane">
  <section class="s-time">
    <div data-w="time" data-form="medal"></div>
    <div data-w="time" data-form="rounds" data-label></div>
    <div data-w="phase"></div>
  </section>
  <section><div data-w="vp" data-form="chip"></div><div data-w="vp" data-form="bar"></div></section>
  <section><div data-w="crisis" data-form="ladder" data-name></div></section>
  <section><div data-w="milops" data-form="rows"></div></section>
  <section><div data-w="space" data-form="track"></div></section>
  <section class="s-piles">
    <div data-w="pile" data-kind="deck"></div>
    <div data-w="pile" data-kind="discard"></div>
    <div data-w="pile" data-kind="removed"></div>
  </section>
  <section><div data-w="opp" data-form="chip"></div></section>
</div>
<div data-w="played" class="table"></div>
<div data-hand></div>`,
};
