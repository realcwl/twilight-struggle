import './03-console.css';

export default {
  id: '03',
  name: '指挥台',
  ref: '魔兽争霸 / 星际的底部面板',
  idea: '所有东西收进底部一块实心面板，屏幕上方和两侧完全留给地图。',
  where: [
    ['回合 / 行动轮', '面板左翼：回合徽章 + 行动轮'],
    ['胜利点', '面板顶边的长条，横贯全屏，像经验条'],
    ['军事行动 / 太空竞赛', '顶边长条的右端 / 左端'],
    ['核危机', '面板左翼的表盘'],
    ['手牌', '面板正中的牌槽，一张张立着，不重叠'],
    ['牌库 / 弃牌 / 废牌', '面板右翼'],
    ['本轮出牌', '面板右翼最左一格'],
  ],
  pros: ['眼睛只有一个落点：往下看就是全部', '手牌不重叠，每张的点数和标题都直接可读', '面板 22% 屏高，正好盖在没有节点的南大洋上'],
  cons: ['底部最重，画面头轻脚重', '面板是实心的：放大地图时南美、南非要拖一下才看得到', '胜利点长条离屏幕中心远，不抬眼看不到“谁领先”'],
  hand: { form: 'row', w: 11.2, step: 11.9, span: 83.3, arc: 0, sink: 0, hover: 2.2, rise: 0, push: 0 },
  html: `
<div class="console pane">
  <div class="strip">
    <div data-w="space" data-form="chip"></div>
    <div data-w="vp" data-form="bar"></div>
    <div data-w="milops" data-form="chip"></div>
  </div>
  <div class="wing left">
    <div class="clock"><div data-w="time" data-form="medal"></div><div data-w="time" data-form="rounds"></div></div>
    <div data-w="crisis" data-form="dial"></div>
  </div>
  <div class="wing right">
    <div class="row">
      <div data-w="played"></div>
      <div data-w="pile" data-kind="deck"></div>
      <div data-w="pile" data-kind="discard"></div>
      <div data-w="pile" data-kind="removed"></div>
    </div>
    <div data-w="opp" data-form="chip"></div>
  </div>
</div>
<div data-w="phase" class="prompt"></div>
<div data-hand></div>`,
};
