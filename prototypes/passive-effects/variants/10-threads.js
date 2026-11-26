// 10 连线: a key and the marks it explains, tied together. A short list by the cards corner numbers
// the effects in force; the same numbered tokens sit on what each one touches (a region, a country,
// a meter, the hand). Pointing at either end draws a thread between them, and a thread is also how
// an effect is seen arriving and firing: from the card to where it lands.
import './10-threads.css';

const ANCHOR = { europe: ['gbr', 'left'], africa: ['ago', 'left'], asia: ['phl', 'right'], mideast: ['sau', 'below'], camerica: ['mex', 'left'], samerica: ['per', 'left'] };
const PANE = { crisis: 'br', milops: 'br', score: 'tr', space: 'tr', rounds: 'tl' };
const NS = 'http://www.w3.org/2000/svg';

export default {
  id: '10',
  name: '连线',
  ref: '图例 + 编号 + 一根线',
  idea: '卡牌角上方一张编号的图例；同样的编号小圆片放在它管的地方（地区、国家、仪表、手牌）。指任何一头，都拉出一根线把两头连起来；进场和触发也用这根线演出。',
  notes: {
    where: '图例在左下卡牌角上方；编号圆片分散在地图和四角。',
    glance: '图例读名字和期限；地图上只多几枚很小的编号。看到欧洲旁有 ①③，回头查图例或直接指它。',
    enter: '牌飞进图例成为一行，然后一根线从这一行伸到它管的每一处，圆片在线头落下。',
    fire: '线从这一行射向它这次作用的那个国家。',
    leave: '这一行盖章，各处圆片一起熄灭，牌飞向牌堆。',
  },
  pros: ['清单和「就地」两种看法都有，而且互相指得到', '地图上的负担最小：一枚编号，不是一面旗', '「逐步发生、指给你看」的演出最自然：线就是指'],
  cons: ['要学一层对应关系（编号）', '编号在事件离场后会空出来，数字不连续', '零件最多，做进主干的成本最高'],
  mount(ctx) {
    const host = ctx.h('div', 'v10-key hud-pane', '<div class="v10-head"><span class="hud-lb">生效中</span><b class="hud-num">0</b></div><div class="v10-rows" data-fx-side="right"></div>');
    ctx.part('bl').appendChild(host);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'v10-threads');
    ctx.layer.appendChild(svg);

    const numbers = new Map(); // effect id -> its number while it stands
    const numberOf = (id) => {
      if (!numbers.has(id)) {
        let n = 1;
        const used = new Set(numbers.values());
        while (used.has(n)) n++;
        numbers.set(id, n);
      }
      return numbers.get(id);
    };

    const rows = ctx.list(
      host.querySelector('.v10-rows'),
      (info) => ctx.h('div', `v10-row ${info.cls}`, `<i class="v10-token">${numberOf(info.id)}</i><b>${ctx.esc(info.title)}</b><span class="v10-until"><i class="v10-mark"></i><em></em></span>`),
      (n, info, o) => {
        ctx.mark(n.querySelector('.v10-mark'), info, o);
        n.querySelector('em').textContent = info.until.kind === 'rounds' ? '轮' : info.until.short;
      },
    );

    /* ---------------- the tokens on what an effect touches */
    const tokens = new Map(); // "id@slot" -> element
    const hosts = new Map();
    const stop = (e) => e.stopPropagation();
    function slotHost(slot) {
      if (hosts.has(slot)) return hosts.get(slot);
      const [kind, key] = slot.split(':');
      let n = null;
      if (kind === 'region' || kind === 'country') {
        const [cid, side] = kind === 'region' ? ANCHOR[key] ?? [null, 'left'] : [key, 'corner'];
        const plate = cid ? ctx.plate(cid) : null;
        if (!plate) return null;
        n = ctx.h('div', `v10-post v10-${side}`);
        if (kind === 'region') n.innerHTML = `<span class="v10-where">${ctx.scenario.regions.find((r) => r.id === key).name.zh}</span>`;
        for (const t of ['pointermove', 'pointerdown', 'mousedown', 'click']) n.addEventListener(t, stop);
        plate.appendChild(n);
      } else if (kind === 'meter') {
        n = ctx.h('div', 'v10-post v10-meter');
        n.dataset.meter = key;
        ctx.part(PANE[key]).appendChild(n);
      } else {
        n = ctx.h('div', 'v10-post v10-hand');
        ctx.layer.appendChild(n);
      }
      hosts.set(slot, n);
      return n;
    }
    const slots = (info) => {
      const out = [];
      if (info.region) out.push(`region:${info.region.id}`);
      else for (const c of info.countries ?? []) out.push(`country:${c}`);
      if (info.meter) out.push(`meter:${info.meter}`);
      if (info.hand !== null) out.push('hand');
      return out;
    };
    /** A token on a meter stands at that meter's top right corner, inside its pane. */
    function placeMeters() {
      for (const n of hosts.values()) {
        if (!n.dataset.meter) continue;
        const pane = n.parentElement.getBoundingClientRect();
        const m = ctx.part(n.dataset.meter).getBoundingClientRect();
        n.style.left = `${m.right - pane.left}px`;
        n.style.top = `${m.top - pane.top}px`;
      }
    }

    function sync(list, o = {}) {
      for (const id of [...numbers.keys()]) if (!list.some((i) => i.id === id)) numbers.delete(id);
      rows.sync(list, o);
      host.querySelector('.hud-num').textContent = String(list.length);
      host.classList.toggle('empty', list.length === 0);
      const want = new Set();
      for (const info of list) {
        for (const slot of slots(info)) {
          const key = `${info.id}@${slot}`;
          want.add(key);
          let n = tokens.get(key);
          if (!n) {
            const h = slotHost(slot);
            if (!h) continue;
            n = ctx.h('i', `v10-token ${info.cls}`, String(numberOf(info.id)));
            n.dataset.fx = info.id;
            h.appendChild(n);
            tokens.set(key, n);
          }
          n.classList.toggle('pe-pending', o.entering === info.id);
        }
      }
      for (const [key, n] of tokens) if (!want.has(key)) { n.remove(); tokens.delete(key); }
      for (const h of hosts.values()) h.classList.toggle('empty', !h.querySelector('.v10-token'));
      placeMeters();
    }
    const tokensOf = (id) => [...tokens.entries()].filter(([k]) => k.startsWith(id + '@')).map(([, n]) => n);

    /* ---------------- threads */
    let drawn = []; // { path, casing, from, to }
    let raf = 0;
    const centre = (n) => {
      const r = n.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    };
    function shape(a, b) {
      const [x0, y0] = centre(a);
      const [x1, y1] = centre(b);
      // leaves the key sideways and arrives from above or below, so it never runs along the list
      const dx = Math.max(60, Math.abs(x1 - x0) * 0.45);
      return `M${x0.toFixed(1)},${y0.toFixed(1)}C${(x0 + dx).toFixed(1)},${y0.toFixed(1)} ${(x1 - dx * 0.25).toFixed(1)},${(y1 + (y0 - y1) * 0.35).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
    }
    function tick() {
      for (const t of drawn) {
        if (!t.from.isConnected || !t.to.isConnected) continue;
        const d = shape(t.from, t.to);
        t.casing.setAttribute('d', d);
        t.path.setAttribute('d', d);
      }
      raf = drawn.length ? requestAnimationFrame(tick) : 0;
    }
    /** Draws a thread from one element to another. It follows them until clear(). */
    function thread(from, to, cls = '') {
      if (!from || !to) return;
      const casing = document.createElementNS(NS, 'path');
      const path = document.createElementNS(NS, 'path');
      casing.setAttribute('class', 'casing');
      path.setAttribute('class', `line ${cls}`);
      const d = shape(from, to);
      casing.setAttribute('d', d);
      path.setAttribute('d', d);
      svg.append(casing, path);
      const len = path.getTotalLength();
      for (const p of [casing, path]) {
        p.style.strokeDasharray = String(len);
        p.style.strokeDashoffset = String(len);
        p.getBoundingClientRect();
        p.style.transition = 'stroke-dashoffset 0.42s cubic-bezier(0.3, 0.7, 0.3, 1)';
        p.style.strokeDashoffset = '0';
        // once drawn it must stay whole while its ends move
        setTimeout(() => { p.style.transition = 'none'; p.style.strokeDasharray = 'none'; }, 460);
      }
      drawn.push({ path, casing, from, to });
      if (!raf) raf = requestAnimationFrame(tick);
    }
    function clear() {
      drawn = [];
      svg.replaceChildren();
    }
    const rowToken = (id) => rows.el(id)?.querySelector('.v10-token') ?? null;
    function tie(id) {
      clear();
      if (!id) return;
      const info = ctx.infoOf(id);
      for (const t of tokensOf(id)) thread(rowToken(id), t, info?.cls);
    }
    // pointing at a row or at a token ties the two ends together
    const off = ctx.detail.onChange((id) => tie(id));
    window.addEventListener('resize', placeMeters);
    ctx.onCleanup(() => {
      off();
      window.removeEventListener('resize', placeMeters);
      cancelAnimationFrame(raf);
      host.remove();
      for (const n of hosts.values()) n.remove();
    });

    return {
      sync,
      el: rows.el,
      cardRect: (n) => ctx.fx.cardRectAt(n.querySelector('.v10-token'), 3.2 * ctx.rem()),
      landFade: 0,
      calloutSide: 'right',
      async enter(info, from) {
        sync(ctx.infos(), { entering: info.id });
        const row = rows.el(info.id);
        await ctx.fx.flyCard(info.no, from, this.cardRect(row), { fade: 0, duration: 560, arc: 20 });
        row.classList.remove('pe-pending');
        ctx.fx.pulse(row, 'pe-new', 2600);
        await ctx.fx.wait(350);
        // one thread at a time, and the token lands where the thread ends
        for (const t of tokensOf(info.id)) {
          t.classList.remove('pe-pending');
          t.classList.add('unseen');
          thread(rowToken(info.id), t, info.cls);
          await ctx.fx.wait(430);
          t.classList.remove('unseen');
          ctx.fx.pulse(t, 'pe-new', 1800);
          await ctx.fx.wait(260);
        }
        await ctx.fx.callout(row, `<b>持续生效</b>${ctx.esc(info.until.long)}`, { side: 'right', cls: info.cls, life: 1700 });
        clear();
      },
      async fire(info, op) {
        const row = rows.el(info.id);
        ctx.fx.pulse(row, 'pe-fire', 1700);
        const target = op.at?.country ? ctx.node(op.at.country) : null;
        if (target) thread(rowToken(info.id), target, `${info.cls} hot`);
        ctx.fx.callout(row, `<b>《${ctx.esc(info.title)}》触发</b>${op.text ?? ''}`, { side: 'right', cls: info.cls, life: 2100 });
        await ctx.fx.wait(700);
        setTimeout(clear, 1500);
      },
      async leave(info, end) {
        const row = rows.el(info.id);
        if (!row) return null;
        for (const t of tokensOf(info.id)) t.classList.add('pe-ending');
        row.classList.add('pe-ending');
        const st = ctx.fx.stamp(row, end.word, end.why);
        ctx.fx.callout(row, `<b>${end.say}</b>${ctx.esc(info.fate.text)}`, { side: 'right', cls: `ending ${info.cls}`, life: 2000 });
        await ctx.fx.wait(1150);
        const from = this.cardRect(row);
        st.remove();
        return from;
      },
    };
  },
};
