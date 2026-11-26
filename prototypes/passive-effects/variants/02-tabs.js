// 02 档案签: index tabs standing out of the left edge of the screen, one per effect, as the tabs of
// files in a cabinet do. A tab carries the name and what ends it; pointing at it pulls the file.
import './02-tabs.css';

export default {
  id: '02',
  name: '档案签',
  ref: '文件柜里露出的索引签',
  idea: '屏幕左缘伸出一排索引签，一个事件一枚：阵营色的签头、牌名、何时结束。指上去才抽出整张牌。',
  notes: {
    where: '左缘，卡牌角上方，贴着屏幕边，不占地图中部。',
    glance: '牌名直接读得出，旁边是「本回合 / 3 轮 /《东方政策》/ 政变即止」。',
    enter: '牌飞到屏幕边缘被收进去，签从边缘滑出来。',
    fire: '那枚签向外顶一下、亮金边。',
    leave: '签上盖章，退回边缘；牌从边缘飞向它的牌堆。',
  },
  pros: ['不用悬停就能读出名字和期限，六七个也不挤', '占地最小的常驻清单：一条窄边', '颜色只在签头，一眼分得出谁的事件'],
  cons: ['看不到牌面，认牌靠名字', '国家卡片（悬停国家时）也在左边，签要让在它下面', '效果内容仍要悬停'],
  mount(ctx) {
    const host = ctx.h('div', 'v02', '<div class="v02-head"><span class="hud-lb">生效中</span><b class="hud-num">0</b></div><div class="v02-list" data-fx-side="right"></div>');
    ctx.part('bl').appendChild(host);
    ctx.onCleanup(() => host.remove());
    const num = host.querySelector('.hud-num');
    const rows = ctx.list(
      host.querySelector('.v02-list'),
      (info) => ctx.h('div', `v02-tab ${info.cls}`, `<i class="v02-cap">${ctx.SIDE_SHORT[info.side]}</i><b>${ctx.esc(info.title)}</b><span class="v02-until"><i class="v02-mark"></i><em></em></span>`),
      (n, info, o) => {
        ctx.mark(n.querySelector('.v02-mark'), info, o);
        n.querySelector('em').textContent = info.until.kind === 'rounds' ? '轮' : info.until.short;
      },
    );
    return {
      sync(list, o = {}) {
        rows.sync(list, o);
        num.textContent = String(list.length);
        host.classList.toggle('empty', list.length === 0);
      },
      el: rows.el,
      // the card goes into the edge of the screen where the tab comes out
      cardRect(el) {
        const r = el.getBoundingClientRect();
        const w = 3.4 * ctx.rem();
        return { left: -w * 0.35, top: r.top + r.height / 2 - w * 0.7, width: w, height: w * 1.4 };
      },
      landFade: 0,
      calloutSide: 'right',
    };
  },
};
