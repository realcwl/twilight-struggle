import './06-versus.css';

export default {
  id: '06',
  name: '对峙',
  ref: '格斗游戏的血条',
  idea: '按“归谁”来分：我的在左、对手的在右，中间一根拉锯条就是胜负。共用的时间和危机夹在正中。',
  where: [
    ['回合 / 行动轮', '顶部正中，拉锯条下面'],
    ['胜利点', '顶部一整根拉锯条，连着双方的徽记'],
    ['军事行动 / 太空竞赛', '各自写在自己的名牌里：我在左上，对手在右上'],
    ['核危机', '顶部正中，和回合并排'],
    ['手牌', '底部正中扇形；对手牌背挂在对手名牌下面'],
    ['牌库', '左下角（抽牌从左来）'],
    ['弃牌 / 废牌', '右下角（出牌往右走），废牌是弃牌上方的小标签'],
    ['本轮出牌', '右下角，弃牌堆左边'],
  ],
  pros: ['胜负一眼可读：条往哪边伸，谁在赢', '双方的数字左右对照，天然适合两人对抗', '牌的流向有方向感：牌库在左 → 手牌 → 出牌 → 弃牌在右'],
  cons: ['顶部占了一整行，比顶栏高', '军事行动、太空竞赛拆成两处，比较双方要左右来回看', '时间和危机被挤在中间一小块'],
  hand: { form: 'fan', w: 13, step: 8.6, arc: 2.6, sink: 5 },
  html: `
<div class="head">
  <div class="plate me pane">
    <div class="stats"><div data-w="milops" data-form="one" data-side="0"></div><div data-w="space" data-form="one" data-side="0"></div></div>
    <div data-w="side" data-side="0"></div>
  </div>
  <div data-w="vp" data-form="bar" data-scale></div>
  <div class="plate opp pane">
    <div data-w="side" data-side="1"></div>
    <div class="stats"><div data-w="milops" data-form="one" data-side="1"></div><div data-w="space" data-form="one" data-side="1"></div></div>
  </div>
</div>
<div class="world pane">
  <div data-w="time" data-form="chip"></div>
  <div data-w="crisis" data-form="ladder" data-name></div>
</div>
<div data-w="opp" data-form="fan" class="opp-hand"></div>
<div data-w="phase" class="prompt"></div>
<div data-w="pile" data-kind="deck" class="draw"></div>
<div class="out">
  <div data-w="played"></div>
  <div class="stack"><div data-w="pile" data-kind="removed" data-form="chip" class="pane"></div><div data-w="pile" data-kind="discard"></div></div>
</div>
<div data-hand></div>`,
};
