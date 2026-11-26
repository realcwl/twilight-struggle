import './02-table.css';

export default {
  id: '02',
  name: '牌桌',
  ref: '炉石传说',
  idea: '地图嵌在一张桌子里：对手在上、我在下，共用的刻度做在桌框上。作为对照组。',
  where: [
    ['回合 / 行动轮', '桌框右上角'],
    ['胜利点', '左侧桌框的竖条：标记往谁那边走，谁领先'],
    ['军事行动 / 太空竞赛', '各自跟着自己的名牌：对手在上框，我在下框'],
    ['核危机', '右侧桌框顶部的竖梯'],
    ['手牌', '下框正中；对手的牌背在上框正中'],
    ['牌库 / 弃牌 / 废牌', '右侧桌框，从下往上：牌库、弃牌与废牌'],
    ['本轮出牌', '右侧桌框中段'],
  ],
  pros: ['所有信息都不压地图，地图是一块干净的窗口', '“我的 / 对手的 / 共用的”分区最直观', '有“结束行动”按钮和对手牌背，最像一局牌'],
  cons: ['地图只剩约 65% 的屏幕，沉浸感最弱', '桌框是固定成本：信息不多时也占着', '地图窗口比 16:9 更扁，全景时南北被裁掉一点'],
  hand: { form: 'fan', w: 12.4, step: 8.2, arc: 2.2, sink: 3.4, hover: 2.1, rise: 0.8 },
  html: `
<div class="rail top pane"></div><div class="rail bottom pane"></div><div class="rail left pane"></div><div class="rail right pane"></div>
<div class="rim"></div>
<div class="plate opp">
  <div data-w="side" data-side="1"></div>
  <div class="stats"><div data-w="milops" data-form="one" data-side="1"></div><div data-w="space" data-form="one" data-side="1"></div></div>
</div>
<div data-w="opp" data-form="fan" class="opp-hand"></div>
<div class="clock"><div data-w="time" data-form="chip"></div><div data-w="time" data-form="rounds"></div></div>
<div data-w="vp" data-v data-scale class="score"></div>
<div class="col">
  <div data-w="crisis" data-form="ladder" data-v data-name></div>
  <div data-w="played"></div>
  <div class="pair"><div data-w="pile" data-kind="discard"></div><div data-w="pile" data-kind="removed"></div></div>
  <div data-w="pile" data-kind="deck"></div>
</div>
<div class="plate me">
  <div data-w="side" data-side="0"></div>
  <div class="stats"><div data-w="milops" data-form="one" data-side="0"></div><div data-w="space" data-form="one" data-side="0"></div></div>
</div>
<div class="turn pane"><div data-w="phase"></div><button type="button" class="end">结束行动</button></div>
<div data-hand></div>`,
  mount(hud, { actions }) {
    const end = hud.querySelector('.end');
    const go = () => actions.step();
    end.addEventListener('click', go);
    return () => end.removeEventListener('click', go);
  },
};
