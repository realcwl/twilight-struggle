import './08-minimal.css';

export default {
  id: '08',
  name: '极简',
  ref: '沉浸式：按需展开',
  idea: '常驻的只有一行状态和一小撮手牌，其余按住 Tab 才出现。问的是：到底哪些必须一直看着？',
  where: [
    ['回合 / 行动轮', '顶部正中的一行状态里'],
    ['胜利点', '同一行状态里，只有数字'],
    ['核危机', '同一行状态里，数字 + 五小格'],
    ['军事行动 / 太空竞赛', '平时不显示；按住 Tab（或点状态行）在“态势板”里看'],
    ['手牌', '底部正中缩成半大小，鼠标靠近展开成完整扇形'],
    ['牌库 / 弃牌 / 废牌', '右下角三个小计数；态势板里有完整牌叠'],
    ['本轮出牌', '左下角一张小牌'],
  ],
  pros: ['地图几乎是全屏的，最沉浸', '把“随时要看的”和“想起来才看的”分成两层', '态势板有整块空间，可以把每个刻度画到最大'],
  cons: ['军事行动差几点、太空走到哪，都要多按一次键', '新手不知道还有一层', '按住 Tab 的时候地图被盖住，不能边看边点'],
  hand: { form: 'fan', w: 13, step: 8.6, arc: 2.4, sink: 5, idle: { scale: 0.5, sink: 2.4, step: 4.6 }, zone: { w: 46, h: 6.8 } },
  html: `
<div class="mini pane">
  <div data-w="pile" data-kind="deck" data-form="chip"></div>
  <div data-w="pile" data-kind="discard" data-form="chip"></div>
  <div data-w="pile" data-kind="removed" data-form="chip"></div>
</div>
<button type="button" class="pill pane" title="点一下固定 / 取消，或按住 Tab">
  <div data-w="time" data-form="chip"></div>
  <div data-w="vp" data-form="chip"></div>
  <div data-w="crisis" data-form="chip"></div>
  <span class="more"><kbd>Tab</kbd> 态势</span>
</button>
<div data-w="played" class="table"></div>
<div class="board pane gilt">
  <header><h2>态势</h2><div data-w="phase"></div><div data-w="opp" data-form="chip"></div></header>
  <section class="wide"><div data-w="time" data-form="line"></div></section>
  <section class="wide"><div data-w="vp" data-form="bar" data-scale></div></section>
  <div class="cols">
    <section><div data-w="crisis" data-form="dial"></div></section>
    <section><div data-w="milops" data-form="rows"></div></section>
    <section><div data-w="space" data-form="track" data-v></div></section>
    <section class="piles">
      <div data-w="pile" data-kind="deck"></div>
      <div data-w="pile" data-kind="discard"></div>
      <div data-w="pile" data-kind="removed"></div>
    </section>
  </div>
</div>
<div data-hand></div>`,
  mount(hud) {
    const set = (onNow) => hud.classList.toggle('show-board', onNow);
    let pinned = new URLSearchParams(location.search).get('board') === '1';
    set(pinned);
    const down = (e) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      set(true);
    };
    const up = (e) => {
      if (e.key === 'Tab') set(pinned);
    };
    const click = () => {
      pinned = !pinned;
      set(pinned);
    };
    const pill = hud.querySelector('.pill');
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    pill.addEventListener('click', click);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  },
};
