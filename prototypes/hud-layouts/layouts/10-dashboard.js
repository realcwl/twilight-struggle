import './10-dashboard.css';

export default {
  id: '10',
  name: '仪表盘',
  ref: '驾驶舱：表盘 + 手里的牌',
  idea: '左下角一组表盘（比分、回合、危机），右下角像真的握着一手牌。上半屏全空。',
  where: [
    ['回合 / 行动轮', '表盘组正中：十段圆环 + 行动轮'],
    ['胜利点', '表盘组左：指针往哪边偏，谁领先'],
    ['太空竞赛', '比分表盘下面一行'],
    ['核危机', '表盘组右：指针从绿走到红'],
    ['军事行动', '危机表盘下面一行'],
    ['手牌', '右下角绕着屏幕角展开，悬停时整张牌在扇子左边弹出'],
    ['牌库 / 弃牌 / 废牌', '底部正中一排'],
    ['本轮出牌', '底部正中那排的最左'],
  ],
  pros: ['指针比数字好读：余光就能看到“偏了多少”“快到红区了”', '上半屏一个像素都不占', '握牌的姿势有手感，放大的牌不挡住扇子本身'],
  cons: ['表盘占地大，左下角是全屏最重的一块', '绕角的扇形里，靠边的几张只露出很窄一条', '左重右重，中间下方反而空，构图不对称'],
  hand: { form: 'corner', w: 12.6, corner: { r0: 5.5, from: -84, to: -8 }, sink: 0, hover: 2, hoverAt: { x: -37, y: 5.4 } },
  html: `
<div class="dash pane gilt">
  <div class="gauge"><div data-w="vp" data-form="dial"></div><div data-w="space" data-form="chip"></div></div>
  <div class="gauge mid"><div data-w="time" data-form="medal"></div><div data-w="time" data-form="rounds"></div></div>
  <div class="gauge"><div data-w="crisis" data-form="dial"></div><div data-w="milops" data-form="chip"></div></div>
</div>
<div data-w="phase" class="prompt"></div>
<div class="piles">
  <div data-w="played"></div>
  <div data-w="pile" data-kind="deck"></div>
  <div data-w="pile" data-kind="discard"></div>
  <div data-w="pile" data-kind="removed"></div>
  <div data-w="opp" data-form="chip" class="pane"></div>
</div>
<div data-hand></div>`,
};
