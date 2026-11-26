import './04-corners.css';
import { on } from '../state.js';

export default {
  id: '04',
  name: '四角',
  ref: '文明 VI / 多数策略游戏',
  idea: '四个角各管一件事：时间、比分、牌、威胁。每个刻度画成它代表的东西；点刻度可以看它的下一个状态。',
  where: [
    ['回合 / 行动轮', '左上角：时间。十个回合绕一圈，时期之间留缺口'],
    ['胜利点', '右上角：比分。大数字 + 一把刻度尺，游标滑向领先的一方'],
    ['太空竞赛', '右上角，比分下面：两枚火箭沿八个里程碑飞'],
    ['核危机', '右下角：威胁。指针表，越危险亮得越多，末端是辐射标志'],
    ['军事行动', '右下角，核危机下面：一点一辆坦克，金线是本回合需求'],
    ['手牌', '底部正中扇形；对手牌背从顶部正中探出'],
    ['牌库 / 弃牌 / 废牌', '左下角：牌'],
    ['本轮出牌', '左下角最左一格'],
  ],
  pros: ['每个角一个主题，位置记忆最牢', '每块都有地方放图形，不只是数字', '四块都落在全景时没有节点的角落', '军事行动的需求和核危机等级放在同一块里，两者的关系一眼可见'],
  cons: ['四个角都占了，没有留白的角', '信息分散在四处，一次看全要转一圈', '左上角和国家信息卡共用一侧（信息卡放在时间块下面）'],
  // span is tighter than the default so that a full hand of ten still clears both bottom corners
  hand: { form: 'fan', w: 13, step: 8.6, span: 66, arc: 2.6, sink: 5 },
  html: `
<i class="dread"></i>
<div class="corner tl pane gilt">
  <div data-w="time" data-form="dial"></div>
  <div class="stack"><div data-w="phase"></div><div data-w="time" data-form="rounds" data-label></div></div>
</div>
<div class="corner tr pane gilt">
  <div data-w="vp" data-form="big"></div>
  <div class="stack"><div data-w="vp" data-form="rule"></div><div data-w="space" data-form="orbit"></div></div>
</div>
<div class="corner bl pane gilt">
  <div data-w="played"></div>
  <div data-w="pile" data-kind="deck"></div>
  <div data-w="pile" data-kind="discard"></div>
  <div data-w="pile" data-kind="removed"></div>
</div>
<div class="corner br pane gilt">
  <div data-w="crisis" data-form="gauge"></div>
  <i class="rule"></i>
  <div data-w="milops" data-form="armor"></div>
</div>
<div data-w="opp" data-form="fan" class="opp-hand"></div>
<div data-hand></div>`,
  // the whole screen takes on the crisis level, so the edge of the map can redden when it is bad
  mount(hud, { S }) {
    const set = (s) => (hud.dataset.crisis = s.crisis);
    set(S);
    const off = on(set);
    return () => {
      off();
      delete hud.dataset.crisis;
    };
  },
};
