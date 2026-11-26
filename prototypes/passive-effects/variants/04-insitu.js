// 04 就地标记: no list anywhere. An effect is marked where it bites: a banner by the region or a
// pennant on the country it covers, a tag hung on the meter it holds, a tag over the hand it
// exposes. One effect may be marked in several places; pointing at any of them lights them all.
import './04-insitu.css';

/** A region has no element of its own (its name is painted on the map), so its banner stands by one
    of its countries, on the side where there is open sea. */
const ANCHOR = { europe: ['gbr', 'left'], africa: ['ago', 'left'], asia: ['phl', 'right'], mideast: ['sau', 'below'], camerica: ['mex', 'left'], samerica: ['per', 'left'] };
const RAIL = { crisis: 'br', milops: 'br', score: 'tr', space: 'tr', rounds: 'tl' };

export default {
  id: '04',
  name: '就地标记',
  ref: '哪里受影响，标记就在哪里',
  idea: '不设清单。事件管哪里，标记就挂在哪里：地区旁一面旗、国家上一面小旗、仪表上一枚挂签、手牌上方一枚挂签。',
  notes: {
    where: '地图上（地区、国家）、四角的仪表边、手牌上方。同一个事件可以同时出现在几处。',
    glance: '看欧洲时就看到欧洲正受什么约束；看紧张度时就看到它被什么卡住。',
    enter: '牌飞到它管的地方，标记在各处依次立起来。',
    fire: '这个事件的所有标记一起亮。',
    leave: '所有标记同时盖章褪色，牌从主标记飞向牌堆。',
  },
  pros: ['做决定时不用查表：要在哪里行动，那里就写着限制', '「它管什么」不需要悬停', '对手的事件落在我的哪块地盘上，一眼可见'],
  cons: ['没有总数，也没有一处能看全「现在一共有什么在生效」', '地图上多了东西，事件一多会和节点抢视线', '缩放和拖动地图时，旗子跟着跑，位置不固定'],
  mount(ctx) {
    const marks = new Map(); // "id@slot" -> element
    const hosts = new Map(); // slot -> container
    const stop = (e) => e.stopPropagation();

    function host(slot) {
      if (hosts.has(slot)) return hosts.get(slot);
      const [kind, key] = slot.split(':');
      let n = null;
      if (kind === 'region' || kind === 'country') {
        const [cid, side] = kind === 'region' ? ANCHOR[key] ?? [null, 'left'] : [key, 'above'];
        const plate = cid ? ctx.plate(cid) : null;
        if (!plate) return null;
        n = ctx.h('div', `v04-post v04-${side}`);
        n.dataset.fxSide = side === 'left' ? 'left' : 'right';
        if (kind === 'region') n.innerHTML = `<span class="v04-where">${ctx.scenario.regions.find((r) => r.id === key).name.zh}全境</span>`;
        // the map must not take a pointer over a banner for a pointer over the country under it
        for (const t of ['pointermove', 'pointerdown', 'mousedown', 'click', 'wheel']) n.addEventListener(t, stop);
        plate.appendChild(n);
      } else if (kind === 'meter') {
        const pane = RAIL[key];
        n = ctx.h('div', `v04-rail v04-${pane}`);
        n.dataset.fxSide = pane === 'br' ? 'above' : 'below';
        ctx.part(pane).appendChild(n);
      } else {
        n = ctx.h('div', 'v04-rail v04-hand');
        n.dataset.fxSide = 'above';
        ctx.layer.appendChild(n);
      }
      hosts.set(slot, n);
      return n;
    }
    ctx.onCleanup(() => {
      for (const n of hosts.values()) n.remove();
    });

    /** Where one effect is marked, the main place first. */
    function slots(info) {
      const out = [];
      if (info.region) out.push(`region:${info.region.id}`);
      else for (const c of info.countries ?? []) out.push(`country:${c}`);
      if (info.meter) out.push(`meter:${info.meter}`);
      if (info.hand !== null) out.push('hand');
      return out;
    }
    const tag = (info, small) =>
      ctx.h('div', `v04-tag ${info.cls}${small ? ' small' : ''}`, `<i class="v04-dot"></i><b>${ctx.esc(info.title)}</b><i class="v04-mark"></i>`);

    function sync(list, o = {}) {
      const want = new Set();
      for (const info of list) {
        slots(info).forEach((slot, i) => {
          const key = `${info.id}@${slot}`;
          want.add(key);
          let n = marks.get(key);
          if (!n) {
            const h = host(slot);
            if (!h) return;
            // a second country of the same effect carries the pennant without the name again
            n = tag(info, slot.startsWith('country:') && i > 0);
            n.dataset.fx = info.id;
            if (i === 0) n.dataset.main = '1';
            h.appendChild(n);
            marks.set(key, n);
          }
          n.classList.toggle('pe-pending', o.entering === info.id);
          ctx.mark(n.querySelector('.v04-mark'), info, o);
        });
      }
      for (const [key, n] of marks) if (!want.has(key)) { n.remove(); marks.delete(key); }
      for (const h of hosts.values()) h.classList.toggle('empty', !h.querySelector('.v04-tag'));
    }
    const all = (id) => [...marks.entries()].filter(([k]) => k.startsWith(id + '@')).map(([, n]) => n);
    const el = (id) => all(id).find((n) => n.dataset.main) ?? all(id)[0] ?? null;
    const cardRect = (n) => ctx.fx.cardRectAt(n, 3.4 * ctx.rem());

    return {
      sync,
      el,
      cardRect,
      async enter(info, from) {
        sync(ctx.infos(), { entering: info.id });
        const main = el(info.id);
        if (!main) return;
        await ctx.fx.flyCard(info.no, from, cardRect(main), { fade: 0, duration: 680, arc: 30 });
        // the marks go up one after another, the main one first
        for (const n of all(info.id)) {
          n.classList.remove('pe-pending');
          ctx.fx.pulse(n, 'pe-new', 2400);
          await ctx.fx.wait(320);
        }
        await ctx.fx.callout(main, `<b>持续生效</b>${ctx.esc(info.until.long)}`, { cls: info.cls });
      },
      async fire(info, op) {
        for (const n of all(info.id)) ctx.fx.pulse(n, 'pe-fire', 1600);
        const main = el(info.id);
        if (main) ctx.fx.callout(main, `<b>《${ctx.esc(info.title)}》触发</b>${op.text ?? ''}`, { cls: info.cls, life: 2100 });
        await ctx.fx.wait(650);
      },
      async leave(info, end) {
        const main = el(info.id);
        if (!main) return null;
        for (const n of all(info.id)) n.classList.add('pe-ending');
        const st = ctx.fx.stamp(main, end.word, end.why);
        ctx.fx.callout(main, `<b>${end.say}</b>${ctx.esc(info.fate.text)}`, { cls: `ending ${info.cls}`, life: 2000 });
        await ctx.fx.wait(1150);
        const from = cardRect(main);
        st.remove();
        return from;
      },
    };
  },
};
