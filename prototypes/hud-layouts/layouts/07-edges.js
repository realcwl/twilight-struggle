import './07-edges.css';

export default {
  id: '07',
  name: '边框刻度',
  ref: '取景器 / 飞行 HUD',
  idea: '四条屏幕边各是一把尺子：上边是时间，左边是比分，右边是危机，下边是牌。中间一点不占。',
  where: [
    ['回合 / 行动轮', '上边：十格时间轴，当前回合展开成七个行动轮'],
    ['胜利点', '左边：竖尺，对手在上、我在下'],
    ['核危机', '右边：竖梯，5 在上、1 在下'],
    ['军事行动', '右边：双方的标记贴在核危机的梯子上——标记够到发亮的那一格才算达标'],
    ['太空竞赛', '左下角一小段轨道'],
    ['手牌', '下边：平时只露出点数那一条，鼠标靠近整手升起'],
    ['牌库 / 弃牌 / 废牌', '右下角三个计数'],
    ['本轮出牌', '右下角，计数上方'],
  ],
  pros: ['遮挡最少的“常驻全量”方案：每个刻度都在，但只占一条边', '时间轴把十个回合、三个时期、七个行动轮画在同一条线上', '军事行动和核危机共用一把尺，“需求 = 危机等级”这条规则直接画出来了'],
  cons: ['尺子细，数字小，离眼睛远', '军事行动贴在危机梯上需要学一次才看得懂', '手牌平时只露一条，想扫一眼标题得把鼠标移下去'],
  hand: { form: 'fan', w: 13, step: 8.6, arc: 2, sink: 4.4, idle: { sink: 12.3 }, zone: { w: 84, h: 7.4 } },
  html: `
<div data-w="phase" class="who"></div>
<div data-w="time" data-form="line" class="top"></div>
<div data-w="opp" data-form="chip" class="opp pane"></div>
<div data-w="vp" data-v data-scale class="left"></div>
<div class="right">
  <span class="lb cap">核危机</span>
  <div class="gauge">
    <div data-w="crisis" data-form="ladder" data-v data-nolabel></div>
    <div data-w="milops" data-form="marks"></div>
  </div>
  <span class="lb cap sub">◂ 军事行动</span>
</div>
<div data-w="space" data-form="track" class="bl"></div>
<div data-w="played" class="table"></div>
<div class="br pane">
  <div data-w="pile" data-kind="deck" data-form="chip"></div>
  <div data-w="pile" data-kind="discard" data-form="chip"></div>
  <div data-w="pile" data-kind="removed" data-form="chip"></div>
</div>
<div data-hand></div>`,
};
