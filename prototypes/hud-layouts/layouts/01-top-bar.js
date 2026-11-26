import './01-top-bar.css';

export default {
  id: '01',
  name: '顶栏',
  ref: '文明',
  idea: '计数类的放左上当“资源”，回合单独做成中间的徽章，不和资源混在一起。',
  where: [
    ['回合 / 行动轮', '顶栏正中的徽章，行动轮挂在徽章下面'],
    ['胜利点', '顶栏左一'],
    ['军事行动', '顶栏左二，双方数字 + 本回合需求'],
    ['太空竞赛', '顶栏左三'],
    ['核危机', '顶栏右侧，五格'],
    ['手牌', '底部正中扇形，悬停放大'],
    ['牌库 / 弃牌 / 废牌', '右下角三叠'],
    ['本轮出牌', '左下角'],
  ],
  pros: ['一条线读完全局，眼睛只需要在顶部横扫', '徽章把“时间”和“资源”分开，回答了回合不算资源的问题', '占地最少：顶栏只有 5% 屏高，落在北冰洋上'],
  cons: ['数字多、图形少，胜利点的“拉锯感”读不出来', '顶栏很长，左右两端离手牌最远', '全是小字，远看分不出轻重'],
  hand: { form: 'fan', w: 13, step: 8.6, arc: 2.6, sink: 6.4 },
  html: `
<div class="bar pane">
  <div class="grp left">
    <div data-w="vp" data-form="chip"></div>
    <div data-w="milops" data-form="chip"></div>
    <div data-w="space" data-form="chip"></div>
  </div>
  <div class="grp right">
    <div data-w="crisis" data-form="ladder" data-name></div>
    <div data-w="opp" data-form="chip"></div>
  </div>
</div>
<div class="clock">
  <div data-w="time" data-form="medal"></div>
  <div class="tab pane"><div data-w="time" data-form="rounds" data-label></div></div>
</div>
<div data-w="phase" class="prompt"></div>
<div data-w="played" class="table"></div>
<div class="piles">
  <div data-w="pile" data-kind="deck"></div>
  <div data-w="pile" data-kind="discard"></div>
  <div data-w="pile" data-kind="removed"></div>
</div>
<div data-hand></div>`,
};
