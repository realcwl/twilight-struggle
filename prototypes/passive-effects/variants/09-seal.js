// 09 一枚印: the least on screen. One bar in the cards corner says how many events are in force and
// whose; pointing at it lists them, clicking it (or E) lays the cards out to be read. Everything
// else is said at the moment it happens: an effect arriving, firing or ending speaks up from the bar.
import './09-seal.css';

export default {
  id: '09',
  name: '一枚印',
  ref: '平时只留一行，要看再展开',
  idea: '卡牌角里只多一行「生效中 6」和几粒阵营色的点。指上去出清单，点开（或按 E）把这些牌摊开细读。进场、触发、离场时由这一行开口说话。',
  notes: {
    where: '左下卡牌角内，三个牌堆上方的一行（主干里「全部卡牌」那一行的同一位置）。',
    glance: '数量，以及几粒点的颜色（谁的事件）。别的都要指一下。',
    enter: '牌从桌面跳进这一行，多一粒点，旁边报出「持续生效 · 到什么时候」。',
    fire: '这一行亮起并报出哪张牌做了什么。',
    leave: '那粒点熄灭，这一行报出原因，牌飞进旁边的牌堆。',
  },
  pros: ['地图最干净，HUD 几乎不变', '摊开时每张牌都是能读的大小，带期限和去向', '和牌堆在同一个角，点开的窗口和「查看弃牌堆」是同一种东西'],
  cons: ['平时不知道具体是哪些事件，全靠记', '每次确认都要多一步', '过场时的提示一旦错过，就只剩一个数字'],
  mount(ctx) {
    const bar = ctx.h('button', 'v09-bar', '<i class="v09-glyph"></i><span class="hud-lb">生效中</span><span class="v09-pips"></span><b class="hud-num">0</b><i class="v09-go"></i>');
    bar.type = 'button';
    bar.title = '查看生效中的事件 · E';
    bar.querySelector('.v09-glyph').innerHTML = ctx.GLYPH.turn;
    const piles = ctx.part('piles');
    piles.insertBefore(bar, piles.querySelector('.hud-pile-row'));
    const peek = ctx.h('div', 'v09-peek pe-nodetail');
    peek.hidden = true;
    ctx.part('bl').appendChild(peek);
    const over = ctx.h('div', 'v09-over pe-nodetail');
    over.hidden = true;
    // on the HUD itself, not on this display's layer: the sheet has to cover the hand as well
    ctx.root.appendChild(over);
    ctx.onCleanup(() => { bar.remove(); peek.remove(); over.remove(); ctx.detail.light(null); });

    const pips = ctx.list(bar.querySelector('.v09-pips'), (info) => ctx.h('i', `v09-pip ${info.cls}`));
    let list = [];
    let hideT = 0;

    function paintPeek() {
      peek.innerHTML = list.length
        ? list.map((i) => `<div class="v09-line ${i.cls}" data-row="${i.id}"><i class="pe-chip">${ctx.SIDE_SHORT[i.side]}</i><b>${ctx.esc(i.title)}</b><span><i class="v09-mark">${ctx.untilMark(i)}</i>${ctx.esc(i.until.kind === 'rounds' ? '轮' : i.until.short)}</span></div>`).join('') + '<p class="v09-hint">点击摊开细读<kbd>E</kbd></p>'
        : '<p class="v09-hint">当前没有生效的事件</p>';
    }
    function openPeek(on) {
      clearTimeout(hideT);
      if (on && over.hidden) {
        paintPeek();
        peek.hidden = false;
      } else hideT = setTimeout(() => { peek.hidden = true; ctx.detail.light(null); }, on ? 0 : 140);
    }
    bar.addEventListener('pointerenter', () => openPeek(true));
    bar.addEventListener('pointerleave', () => openPeek(false));
    peek.addEventListener('pointerenter', () => clearTimeout(hideT));
    peek.addEventListener('pointerleave', () => openPeek(false));
    // a line under the pointer lights what that effect touches, without another panel
    peek.addEventListener('pointerover', (e) => {
      const row = e.target.closest('[data-row]');
      for (const n of peek.querySelectorAll('.on')) n.classList.remove('on');
      row?.classList.add('on');
      ctx.detail.light(row ? row.dataset.row : null);
    });

    function paintOver() {
      over.innerHTML =
        `<div class="v09-sheet"><header><h2>生效中的事件</h2><span>${list.length} 张 · 结束后各归其位</span><button type="button" class="v09-x" aria-label="关闭">×</button></header>` +
        `<div class="v09-grid">${list.map((i) => `<article class="${i.cls}" data-row="${i.id}"><div class="v09-card" data-no="${i.no}"></div><p>${i.lineHTML}</p><dl><dt>持续</dt><dd><i class="v09-mark">${ctx.untilMark(i)}</i>${i.untilHTML}</dd><dt>之后</dt><dd><i class="v09-mark">${ctx.GLYPH[i.fate.pile]}</i>${ctx.esc(i.fate.text)}</dd></dl></article>`).join('') || '<p class="v09-none">当前没有生效的事件</p>'}</div></div>`;
      for (const slot of over.querySelectorAll('.v09-card')) {
        const c = ctx.card.el(slot.dataset.no);
        slot.appendChild(c);
        ctx.card.fit(c);
      }
    }
    function openOver(on) {
      if (on === !over.hidden) return;
      over.hidden = !on;
      peek.hidden = true;
      ctx.detail.light(null);
      if (on) paintOver();
    }
    bar.addEventListener('click', () => openOver(true));
    over.addEventListener('click', (e) => {
      if (e.target === over || e.target.closest('.v09-x')) openOver(false);
    });
    over.addEventListener('pointerover', (e) => ctx.detail.light(e.target.closest('[data-row]')?.dataset.row ?? null));

    return {
      sync(next, o = {}) {
        list = next;
        pips.sync(list, o);
        const num = bar.querySelector('.hud-num');
        if (num.textContent !== String(list.length) && !o.instant) ctx.fx.pulse(num, 'tick', 700);
        num.textContent = String(list.length);
        bar.classList.toggle('empty', list.length === 0);
        if (!peek.hidden) paintPeek();
        if (!over.hidden) paintOver();
      },
      el: (id) => pips.el(id),
      anchor: () => bar,
      cardRect: () => ctx.fx.cardRectAt(bar, 2.6 * ctx.rem()),
      landFade: 0,
      calloutSide: 'above',
      async enter(info, from) {
        openOver(false);
        this.sync(ctx.infos(), { entering: info.id });
        await ctx.fx.flyCard(info.no, from, this.cardRect(), { fade: 0, duration: 520, arc: 26 });
        pips.el(info.id)?.classList.remove('pe-pending');
        ctx.fx.pulse(bar, 'pe-new', 2200);
        await ctx.fx.callout(bar, `<b>持续生效</b>《${ctx.esc(info.title)}》· ${ctx.esc(info.until.long)}`, { side: 'above', cls: info.cls, life: 2300 });
      },
      async fire(info, op) {
        ctx.fx.pulse(bar, 'pe-fire', 1600);
        ctx.fx.pulse(pips.el(info.id), 'blink', 1600);
        ctx.fx.callout(bar, `<b>《${ctx.esc(info.title)}》触发</b>${op.text ?? ''}`, { side: 'above', cls: info.cls, life: 2100 });
        await ctx.fx.wait(650);
      },
      async leave(info, end) {
        ctx.fx.pulse(bar, 'pe-fire', 1500);
        pips.el(info.id)?.classList.add('out');
        ctx.fx.callout(bar, `<b>《${ctx.esc(info.title)}》${end.say}</b>${ctx.esc(info.fate.text)}`, { side: 'above', cls: `ending ${info.cls}`, life: 2000 });
        await ctx.fx.wait(1150);
        return this.cardRect();
      },
      /** For a screenshot: the list up, with one line lit. */
      hover(id) {
        openPeek(true);
        peek.querySelector(`[data-row="${id}"]`)?.classList.add('on');
        ctx.detail.light(id);
      },
      key(k) {
        if (k === 'e') return openOver(over.hidden), true;
        if (k === 'escape' && !over.hidden) return openOver(false), true;
        return false;
      },
    };
  },
};
