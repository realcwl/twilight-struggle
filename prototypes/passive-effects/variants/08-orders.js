// 08 常设指令: the only display that says what each effect does without being asked. Paper slips
// clipped down the right edge, one per effect: who, the name, what ends it, and the rule in a line.
import './08-orders.css';

export default {
  id: '08',
  name: '常设指令',
  ref: '夹在板边的一叠纸条',
  idea: '右缘夹着一叠纸条，一张一个事件：阵营、牌名、何时结束，下面直接写着它做什么。不用悬停就能读完。',
  notes: {
    where: '右缘，威胁角上方。右边 13% 的地图没有国家。',
    glance: '唯一一个把「效果内容」常驻写出来的方案，规则术语照卡牌的方式高亮。',
    enter: '牌飞到这叠纸的下端，一张新纸条从屏幕边滑进来。',
    fire: '那张纸条向外抽一下、亮起。',
    leave: '纸条上盖红章（取消 / 期满 / 终止），撕走；牌飞向牌堆。',
  },
  pros: ['不需要记牌、不需要悬停：现在有什么规则在改变，全写在这里', '新手最友好', '章盖在纸上，离场的原因留得住、看得清'],
  cons: ['字最多，六张就占掉右缘大半', '纸的浅色在深色 HUD 里最抢眼', '离卡牌角最远，进场离场的牌要横穿整个屏幕'],
  mount(ctx) {
    const host = ctx.h('div', 'v08', '<div class="v08-clip"><span class="hud-lb">常设指令</span><b class="hud-num">0</b></div><div class="v08-list" data-fx-side="left"></div>');
    ctx.part('br').appendChild(host);
    ctx.onCleanup(() => host.remove());
    const num = host.querySelector('.hud-num');
    const rows = ctx.list(
      host.querySelector('.v08-list'),
      (info) =>
        ctx.h('div', `v08-slip ${info.cls}`, `<div class="v08-top"><i class="v08-side">${ctx.SIDE_SHORT[info.side]}</i><b>${ctx.esc(info.title)}</b><span class="v08-until"><i class="v08-mark"></i><em></em></span></div><p>${info.lineHTML}</p>`),
      (n, info, o) => {
        ctx.mark(n.querySelector('.v08-mark'), info, o);
        // a canceller's name goes in without its brackets: the slip is narrow
        n.querySelector('em').textContent = info.until.kind === 'rounds' ? '轮' : info.until.short.replace(/[《》]/g, '');
      },
    );
    return {
      sync(list, o = {}) {
        rows.sync(list, o);
        num.textContent = String(list.length);
        host.classList.toggle('empty', list.length === 0);
      },
      el: rows.el,
      cardRect: (n) => ctx.fx.cardRectAt(n, 3.8 * ctx.rem()),
      landFade: 0,
      calloutSide: 'left',
    };
  },
};
