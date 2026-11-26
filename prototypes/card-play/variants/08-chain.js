// 08 因果链. A play is one sentence, written as a chain of medallions along the top: the card, what
// it is used for, where, the dice, and then every consequence in turn. What will follow is shown as
// ghost links before anything is rolled; each consequence lights up, sends a beam to the country or
// the meter it changes, and only then is the next one read. The opponent's move is written in the
// same place, in red, link by link.
import './08-chain.css';
import { basePresenter, carryLine, choiceList, decision, describe, ICON } from '../core/base.js';
import { ABORT, MODE_NAME, SIDE_NAME } from '../core/game.js';

const FX_ICON = {
  inf: ICON.place,
  crisis: ICON.warn,
  milops: '<svg viewBox="0 0 24 24"><path d="M4 12.500l8-6 8 6M4 18.500l8-6 8 6" fill="none" stroke="currentColor" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  vp: '<svg viewBox="0 0 24 24"><path d="M12 2.600l2.800 6.100 6.600.700-4.900 4.500 1.400 6.500L12 17.100l-5.900 3.300 1.400-6.500-4.900-4.500 6.600-.700z"/></svg>',
  space: ICON.space,
  note: '<svg viewBox="0 0 24 24"><path d="M6 12h12" stroke="currentColor" stroke-width="2.600" stroke-linecap="round"/></svg>',
  die: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3.500" fill="none" stroke="currentColor" stroke-width="2.200"/><circle cx="8.700" cy="8.700" r="1.500"/><circle cx="15.300" cy="15.300" r="1.500"/><circle cx="12" cy="12" r="1.500"/></svg>',
  target: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.500-5.600-6.500-10.700a6.500 6.500 0 0 1 13 0C18.500 15.400 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linejoin="round"/><circle cx="12" cy="10.300" r="2.200"/></svg>',
};

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const sign = (d) => (d > 0 ? '+' : '−') + Math.abs(d);

export default {
  id: '08',
  name: '因果链',
  ref: '一句话写完一次出牌',
  idea: '一次出牌是一条链：牌 → 用途 → 目标 → 骰 → 后果…。还没掷骰，后面的环已经以虚影排好；每个后果点亮时射出一道光，指给你看它改了哪里。',
  notes: {
    choose: '牌挂在链的第一环下面，第二环“用途”向下分出五根枝：事件和四种行动，各写一句话；不能用的枝是断的，并写明原因。指到哪根枝，地图亮出它能用在哪，链的后面同时排出会发生什么的虚影。',
    target: '“目标”环下面挂着提示和按钮。指向一个国家，链尾的虚影立刻换成这一国的后果：要掷几点、军事行动到几、是不是战场国（核危机会降）。放置时这一环会攒起每一点的小珠。',
    dice: '“骰”环长大，骰子就在环里翻滚；加值和门槛作为小牌挂在环下，一块一块亮起，最后环上盖出结果。',
    guide: '后果一环一环点亮：每亮一环，一道光从这一环射到它改动的国家或刻度，那里才跟着变。核危机那一环是红的、更大。链尾有“自动 / 逐步”开关，逐步时按空格才走下一环；指到走过的环，它指的地方会再亮一次。',
    opponent: '对手出牌时，同一条链用红色从头写起：牌、用途、目标一环一环接上，后面排好虚影，再掷骰、逐环点亮。写完的链缩成一条细带留在上方，轮到你时还能回看。',
  },
  pros: ['出牌前就看见整串后果，选择即预告', '所有变化排成一行，读的顺序就是发生的顺序', '可以改成逐步：一环一环自己按着走，不会漏看', '对手的行动留下一条可回看的红链'],
  cons: ['链在屏幕上方，目标国在下方，视线要上下走', '调整阵营掷多次或对手事件连发时链会很长，前面的环会缩成小点', '比基准方案多一层“环”的概念，第一次要适应'],
  mount(ctx) {
    const base = basePresenter(ctx);
    const { fx, board, hand, hud, cards, layer, G } = ctx;
    const wait = fx.wait;

    /* ------------------------------------------------------------------ the rail: last play above, live chain below */
    const rail = fx.el('div', 'ch-rail');
    rail.innerHTML = '<div class="ch-past"></div><div class="ch-chain"></div>';
    layer.appendChild(rail);
    const past = rail.firstChild;
    const chain = rail.lastChild;
    const toggle = fx.el('button', 'ch-mode', '');
    toggle.type = 'button';
    layer.appendChild(toggle);
    let manual = false;
    let stepper = null; // resolves the pause of a manual step
    const paintToggle = () => {
      toggle.innerHTML = manual ? '<b>逐步</b><span>空格走下一环</span>' : '<b>自动</b><span>点这里改成逐步</span>';
      toggle.classList.toggle('is-manual', manual);
    };
    toggle.addEventListener('click', () => {
      manual = !manual;
      paintToggle();
      if (!manual) stepper?.resolve();
    });
    paintToggle();

    function node({ tag, icon = '', label = '', sub = '', cls = '', ghost = false }) {
      const n = fx.el('div', `ch-node t-${tag} ${cls} ${ghost ? 'is-ghost' : ''}`);
      n.dataset.tag = tag;
      n.innerHTML = `<i class="ch-link"></i><div class="ch-med"><i class="ch-ic">${icon}</i></div><div class="ch-cap"><b>${label}</b><span>${sub}</span></div><div class="ch-hang"></div>`;
      const firstGhost = ghost ? null : chain.querySelector('.ch-node.is-ghost');
      chain.insertBefore(n, firstGhost);
      n.addEventListener('pointerenter', () => n.classList.contains('is-done') && n._relight?.());
      fit();
      return n;
    }
    const cap = (n, label, sub) => {
      if (label !== undefined) n.querySelector('.ch-cap b').innerHTML = label;
      if (sub !== undefined) n.querySelector('.ch-cap span').innerHTML = sub;
    };
    const med = (n) => n.querySelector('.ch-med');
    const hang = (n) => n.querySelector('.ch-hang');
    function now(n) {
      for (const x of chain.children) if (x.classList.contains('is-now')) finish(x);
      n.classList.remove('is-ghost', 'is-done');
      n.classList.add('is-now');
      fit();
      return n;
    }
    function finish(n) {
      n.classList.remove('is-now', 'is-ghost');
      n.classList.add('is-done');
      hang(n).replaceChildren();
    }
    /** The next link with this tag: a waiting ghost if there is one, a new link otherwise. */
    function take(tag, spec) {
      let n = [...chain.querySelectorAll('.ch-node.is-ghost')].find((x) => x.dataset.tag === tag);
      if (n) {
        n.className = `ch-node t-${tag} ${spec.cls ?? ''} is-ghost`;
        if (spec.icon) n.querySelector('.ch-ic').innerHTML = spec.icon;
        cap(n, spec.label, spec.sub ?? '');
        // it happens now: it moves in front of the ghosts still waiting
        chain.insertBefore(n, chain.querySelector('.ch-node.is-ghost'));
      } else n = node({ tag, ...spec });
      return now(n);
    }
    const clearGhosts = () => chain.querySelectorAll('.ch-node.is-ghost').forEach((n) => n.remove());
    function ghosts(list) {
      clearGhosts();
      for (const g of list) node({ ...g, ghost: true });
    }
    /** When the chain grows past the room it has, the oldest finished links shrink to beads. */
    function fit() {
      const all = [...chain.children];
      const room = 9;
      let over = all.length - room;
      for (const n of all) {
        const mini = over > 0 && n.classList.contains('is-done');
        n.classList.toggle('is-mini', mini);
        if (mini) over--;
      }
    }
    /** A new sentence begins; the one before it is kept above as a thin strip. */
    function begin(side) {
      archive();
      chain.replaceChildren();
      chain.className = `ch-chain ${side === 0 ? 'a' : 'b'}`;
      rail.classList.add('is-on');
    }
    function archive() {
      clearGhosts();
      const done = [...chain.children].filter((n) => n.classList.contains('is-done') || n.classList.contains('is-now'));
      if (done.length < 2) return;
      past.className = `ch-past ${chain.classList.contains('b') ? 'b' : 'a'}`;
      past.replaceChildren();
      past.appendChild(fx.el('span', 'ch-past-who', chain.classList.contains('b') ? '苏联上一手' : '你上一手'));
      for (const n of done) {
        n.classList.remove('is-now', 'is-mini');
        n.classList.add('is-done');
        hang(n).replaceChildren();
        past.appendChild(n);
      }
    }

    /* ------------------------------------------------------------------ what a choice leads to, as ghost links */
    const g = (tag, label, sub = '', cls = '') => ({ tag, icon: FX_ICON[tag] ?? ICON[tag] ?? '', label, sub, cls });
    const side = (s) => (s === 0 ? 'a' : 'b');
    function eventGhosts(no, by) {
      return ctx.options(no).event.lines.map((l) => ({ tag: 'line', icon: ICON.event, label: l.text, sub: '', cls: l.lethal ? 'bad' : l.warn ? 'warn' : side(by) }));
    }
    function coupGhosts(p, by) {
      const list = [
        g('die', p.need ? `掷出 ≥${p.need}` : '不可能成功', `${Math.round(p.chance * 100)}%`),
        g('inf', '影响力增减', '看骰子', side(by)),
        g('milops', '军事行动', `${G.milops[by]} → ${p.milopsTo}`, side(by)),
      ];
      if (p.key) list.push(g('crisis', '核危机', `${G.crisis} → ${p.crisisTo}`, 'bad'));
      return list;
    }
    function forecast(ch, c) {
      const fires = ch.fires && c.key !== 'event' && c.key !== 'space' ? [{ tag: 'event', icon: ICON.event, label: '苏联事件', sub: '照样发生', cls: 'b' }] : [];
      if (c.key === 'event') return eventGhosts(ch.card.no, 0);
      if (c.key === 'place') return [g('target', '选国家', `放 ${ch.points} 点`), ...fires];
      if (c.key === 'realign') return [g('target', '选国家', `最多 ${ch.points} 次`), g('die', '双方各掷一骰'), g('inf', '输家移除差额'), ...fires];
      if (c.key === 'coup') return [g('target', '选国家'), g('die', '掷骰', `+${ch.points} 行动点`), g('inf', '影响力增减', '看骰子', 'a'), g('milops', '军事行动', `+${ch.points}`, 'a'), ...(c.risk ? [g('crisis', '核危机 −1', '若是战场国', 'bad')] : []), ...fires];
      return [g('die', '掷骰', `1–${ch.options.space.max} 成功`), g('space', '太空竞赛', '前进一步', 'a')];
    }

    /* ------------------------------------------------------------------ choosing: branches under the second link */
    function branches(no, nCard, nUse, headline) {
      const ch = choiceList(ctx, no);
      const d = deferred();
      const slot = fx.el('div', 'ch-card');
      hang(nCard).appendChild(slot);
      cards.put(no, slot);
      slot.appendChild(Object.assign(fx.el('button', 'ch-back', `${headline ? '换一张' : '收回'}<kbd>Esc</kbd>`), { type: 'button', onclick: () => d.resolve(null) }));
      const box = fx.el('div', 'ch-branches');
      const lines = (c) => c.lines.map((l) => `<em class="${l.lethal ? 'lethal' : l.warn ? 'warn' : ''}">${l.text}</em>`).join('');
      const list = headline ? [ch.byKey.event] : ch.list;
      box.innerHTML = list
        .map((c) => {
          const theirs = c.key === 'event' && c.theirs && !headline;
          const ok = c.ok || (headline && c.key === 'event');
          const body =
            c.key === 'event'
              ? `${lines(c)}<small>${theirs ? '对手的事件：怎么行动它都会发生，只有太空竞赛躲得开' : headline ? '头条只能作为事件 · 数值高的先结算' : c.sub}</small>`
              : `<small>${ok ? c.sub : c.why}</small>${ok && c.risk ? `<em class="warn">${c.risk}</em>` : ''}${ok && c.safe ? '<em class="safe">不触发对手事件</em>' : ''}`;
          return `<button type="button" class="ch-branch ${ok ? '' : theirs ? 'is-theirs' : 'is-off'}" data-key="${c.key}" ${ok ? '' : 'disabled'}><i class="ch-twig"></i><i class="ch-bic">${ICON[c.key]}</i><span class="ch-bname">${headline ? '作为头条' : theirs ? '苏联的事件' : c.label}${ok ? `<kbd>${headline ? '↵' : c.hot.toUpperCase()}</kbd>` : ''}</span><span class="ch-bsub">${body}</span></button>`;
        })
        .join('');
      hang(nUse).appendChild(box);
      const keymap = { escape: () => d.resolve(null) };
      for (const b of box.querySelectorAll('.ch-branch')) {
        const c = ch.byKey[b.dataset.key];
        const peek = () => {
          if (c.mark && !b.disabled) board.mark(c.mark);
          ghosts(headline ? eventGhosts(no, ch.card.side === 'ussr' ? 1 : 0) : c.key === 'event' && c.theirs ? eventGhosts(no, 1) : forecast(ch, c));
          box.querySelectorAll('.is-peek').forEach((x) => x.classList.remove('is-peek'));
          b.classList.add('is-peek');
        };
        b.addEventListener('pointerenter', peek);
        b.addEventListener('pointerleave', () => board.mark(null));
        if (b.disabled) continue;
        b.addEventListener('click', () => d.resolve(c.key));
        keymap[headline ? 'enter' : c.hot] = () => d.resolve(c.key);
      }
      // the first branch that can be taken shows its consequences straight away
      box.querySelector('.ch-branch:not(:disabled)')?.dispatchEvent(new PointerEvent('pointerenter'));
      board.mark(null);
      const off = ctx.keys(keymap);
      return d.promise.finally(() => {
        off();
        board.mark(null);
      }).then((key) => ({ key, ch, slot }));
    }

    async function chooseCard(headline) {
      for (;;) {
        begin(0);
        const nCard = now(node({ tag: 'card', icon: '?', label: headline ? '选头条' : '出一张牌', sub: '点手牌，或拖出来' }));
        const pick = await ctx.pickCard();
        const c = ctx.card(pick.no);
        nCard.classList.add(`s-${c.side}`);
        nCard.querySelector('.ch-ic').textContent = c.value || '✦';
        cap(nCard, `《${c.title}》`, c.side === 'tally' ? '结算牌' : `${c.value} 点`);
        finish(nCard);
        const nUse = now(node({ tag: 'use', icon: '?', label: headline ? '头条' : '用途', sub: headline ? '作为事件发生' : '事件，还是行动' }));
        hand.live(false);
        const { key, ch, slot } = await branches(pick.no, nCard, nUse, headline);
        const from = slot.querySelector('.slot')?.getBoundingClientRect();
        hang(nCard).replaceChildren();
        hang(nUse).replaceChildren();
        if (!key) {
          chain.replaceChildren();
          hand.release(pick.no);
          continue;
        }
        nUse.querySelector('.ch-ic').innerHTML = ICON[key];
        cap(nUse, headline ? '头条事件' : ch.byKey[key].label, key === 'event' || key === 'space' ? '' : `${ch.points} 点`);
        finish(nUse);
        // what the chosen branch leads to stays as ghosts until it happens
        ghosts(headline || key === 'event' ? eventGhosts(pick.no, 0) : forecast(ch, ch.byKey[key]));
        return { no: pick.no, key, from };
      }
    }

    /* ------------------------------------------------------------------ small things hung under the current link */
    function hint(n, { text = '', pips = null, buttons = [] }) {
      const box = fx.el('div', 'ch-hint');
      box.innerHTML = `<p></p><div class="ch-pips"></div><div class="ch-btns"></div>`;
      hang(n).replaceChildren(box);
      let offKeys = () => {};
      const set = ({ text: t, pips: p, buttons: bs }) => {
        if (t !== undefined) box.querySelector('p').innerHTML = t;
        if (p !== undefined) box.querySelector('.ch-pips').innerHTML = p ? Array.from({ length: p.total }, (_, i) => `<i class="${i < p.total - p.left ? 'used' : ''}"></i>`).join('') : '';
        if (bs !== undefined) {
          const row = box.querySelector('.ch-btns');
          row.replaceChildren();
          const keymap = {};
          for (const b of bs) {
            const el = fx.el('button', b.primary ? 'primary' : '', `${b.label}<kbd>${b.keyLabel}</kbd>`);
            el.type = 'button';
            el.disabled = !!b.disabled;
            el.addEventListener('click', () => b.on());
            row.appendChild(el);
            if (!b.disabled) keymap[b.key] = b.on;
          }
          offKeys();
          offKeys = ctx.keys(keymap);
        }
      };
      set({ text, pips, buttons });
      return { set, off: () => offKeys(), say: (t, cls = '') => ((box.querySelector('p').innerHTML = t), (box.querySelector('p').className = cls)) };
    }

    const dead = new Promise((_, rej) => ctx.signal.addEventListener('abort', () => rej(ABORT), { once: true }));
    dead.catch(() => {});
    /** A manual step waits for the space bar or a click on the chain; an automatic one just waits. */
    async function pause(ms) {
      if (!manual) return wait(ms);
      stepper = deferred();
      rail.classList.add('is-waiting');
      const off = ctx.keys({ ' ': () => stepper.resolve(), enter: () => stepper.resolve() });
      const click = () => stepper.resolve();
      chain.addEventListener('click', click);
      await Promise.race([stepper.promise, dead]);
      off();
      chain.removeEventListener('click', click);
      rail.classList.remove('is-waiting');
      stepper = null;
    }

    const beam = (n, to, cls) => fx.tracer(med(n), to, { cls: cls === 'good' ? 'gold' : cls, ms: 560, bend: 0.14 });

    /* ------------------------------------------------------------------ the presenter */
    return {
      ...base,

      // the headline is a chain of one link: the card. Dragged out of the hand, it is played.
      async pickHeadline() {
        begin(0);
        const nCard = now(node({ tag: 'card', icon: '?', label: '选头条', sub: '把牌拖出来，松手就打出' }));
        const pick = await ctx.pickCard({
          click: false,
          onCarry: (no) => cap(nCard, `《${ctx.card(no).title}》`, carryLine(ctx, no).text.replace(/^《[^》]*》[^：]*：/, '')),
          onBack: () => cap(nCard, '选头条', '把牌拖出来，松手就打出'),
        });
        const c = ctx.card(pick.no);
        nCard.classList.add(`s-${c.side}`);
        nCard.querySelector('.ch-ic').textContent = c.value || '✦';
        cap(nCard, `《${c.title}》`, '头条');
        finish(nCard);
        hand.live(false);
        base.ui.from = pick.rect;
        await wait(300);
        chain.replaceChildren();
        return pick.no;
      },

      async decide() {
        const r = await chooseCard(false);
        base.ui.from = r.from;
        return decision(r.no, r.key);
      },

      async announce(play) {
        if (play.by === 0 && !play.headline) {
          // the chain was begun in decide(); the card only has to reach the table
          await base.announce.call(this, play);
          return;
        }
        if (play.headline) {
          await base.announce.call(this, play);
          begin(play.by);
          const c = play.card;
          const n = node({ tag: 'card', icon: c.value || '✦', label: `《${c.title}》`, sub: `${SIDE_NAME[play.by]}的头条`, cls: `s-${c.side}` });
          finish(n);
          finish(node({ tag: 'use', icon: ICON.event, label: '头条事件' }));
          ghosts(eventGhosts(play.no, play.by));
          await wait(500);
          return;
        }
        // the opponent: the same sentence, written link by link in red
        hand.live(false);
        board.clearBadges('last');
        begin(1);
        const c = play.card;
        const show = fx.el('div', 'cp-oppcard');
        show.innerHTML = '<div class="oc-card"></div>';
        layer.appendChild(show);
        const face = cards.put(play.no, show.querySelector('.oc-card'));
        const nCard = now(node({ tag: 'card', icon: c.value || '✦', label: `《${c.title}》`, sub: '苏联打出', cls: `s-${c.side}` }));
        await wait(1300);
        const from = face.getBoundingClientRect();
        show.remove();
        await base.ui.toTable(play.no, from);
        finish(nCard);
        const what = play.use === 'event' ? '事件' : play.use === 'space' ? MODE_NAME.space : MODE_NAME[play.mode];
        const nUse = now(node({ tag: 'use', icon: ICON[play.mode] ?? ICON.event, label: what, sub: play.use === 'ops' ? `${play.points} 点` : play.use === 'space' ? '弃一张牌' : '' }));
        await wait(750);
        finish(nUse);
        if (play.use === 'event') ghosts(eventGhosts(play.no, 1));
        else if (play.use === 'space') ghosts([g('die', '掷骰', `1–${ctx.game.RULES.spaceRoll} 成功`), g('space', '太空竞赛', '前进一步', 'b')]);
        else if (play.mode === 'place') {
          const sums = new Map();
          for (const id of play.targets) sums.set(id, (sums.get(id) ?? 0) + 1);
          const n = now(node({ tag: 'target', icon: FX_ICON.target, label: [...sums.keys()].map((id) => ctx.name(id)).join('、'), sub: `放 ${play.points} 点` }));
          await board.show([...sums.keys()]);
          await wait(650);
          finish(n);
          ghosts([...sums].map(([id, d]) => g('inf', ctx.name(id), `苏联 ${sign(d)}`, 'b')));
        } else {
          const n = now(node({ tag: 'target', icon: FX_ICON.target, label: ctx.name(play.target), sub: ctx.country(play.target).key ? '战场国' : '' }));
          await board.show(play.target);
          board.big(play.target);
          board.ring(play.target, 'b');
          n._relight = () => board.ring(play.target, 'b');
          await wait(750);
          finish(n);
          ghosts(play.mode === 'coup' ? coupGhosts(ctx.R.coupPreview(G, 1, play.target, play.points), 1) : [g('die', '双方各掷一骰'), g('inf', '输家移除差额')]);
        }
        await wait(500);
      },

      async place(session) {
        const n = take('target', { icon: FX_ICON.target, label: MODE_NAME.place, sub: '' });
        let act = deferred();
        const press = (what) => () => act.resolve(what);
        const h = hint(n, {});
        const tally = () => [...new Set(session.spent.map((s) => s.id))].map((id) => `${ctx.name(id)} +${session.count(id)}`).join(' · ');
        const draw = () => {
          const ok = new Map([...session.targets()].filter(([, v]) => v.ok));
          board.mark({ kind: 'place', ok, lift: session.spent.map((s) => s.id) });
          board.clearBadges('cost');
          board.clearBadges('put');
          for (const [id, v] of ok) if (v.cost > 1) board.badge(id, 'cost', `${v.cost}`, 'b');
          for (const id of new Set(session.spent.map((s) => s.id))) board.badge(id, 'put', `+${session.count(id)}`, 'a');
          const none = !session.spent.length;
          cap(n, MODE_NAME.place, tally() || `剩 ${session.left} 点`);
          h.set({
            text: session.left ? (ok.size ? '点亮着的国家放 1 点；标 ×2 的是对手控制的，要花 2 点' : '剩下的点数放不进任何地方') : '点数用完了：确认，或撤销重放',
            pips: { total: session.points, left: session.left },
            buttons: [
              { label: '撤销', key: 'backspace', keyLabel: '⌫', on: press('undo'), disabled: none },
              none ? { label: '收回这张牌', key: 'escape', keyLabel: 'Esc', on: press('cancel') } : { label: '完成', key: 'enter', keyLabel: '↵', on: press('done'), primary: true },
            ],
          });
          return ok;
        };
        let result = true;
        for (;;) {
          const ok = draw();
          act = deferred();
          const got = await Promise.race([session.left && ok.size ? board.pick(ok) : new Promise(() => {}), act.promise]);
          board.cancelPick();
          if (got === 'undo') session.undo();
          else if (got === 'done') break;
          else if (got === 'cancel') {
            result = false;
            break;
          } else if (got) {
            const e = session.add(got);
            if (e) {
              board.pop(got, '+1', 'a');
              board.ring(got, 'a');
              if (e.ctrlTo !== e.ctrlFrom) board.pop(got, e.ctrlTo === 0 ? '美国控制' : '打破控制', 'gold late');
            }
          }
        }
        h.off();
        board.mark(null);
        board.clearBadges('cost');
        board.clearBadges('put');
        if (result) {
          cap(n, tally(), `放了 ${session.points - session.left} 点`);
          finish(n);
        }
        return result;
      },

      async pickTarget(req) {
        const kind = req.mode;
        const n = take('target', { icon: FX_ICON.target, label: kind === 'event' ? `《${req.title}》` : '选国家', sub: req.total > 1 ? `第 ${req.total - req.left + 1} / ${req.total}` : '' });
        const act = deferred();
        const warn = kind === 'coup' ? [...req.targets].filter(([, p]) => p.key).map(([id]) => id) : [];
        board.mark({ kind, ok: req.targets, locked: req.locked, warn });
        for (const [id, p] of req.targets) {
          if (kind === 'coup') board.badge(id, 'need', p.need ? `≥${p.need}` : '✕', p.need ? '' : 'off');
          if (kind === 'realign') board.badge(id, 'need', p.edge > 0 ? `+${p.edge}` : p.edge < 0 ? `−${-p.edge}` : '±0', p.edge > 0 ? 'good' : p.edge < 0 ? 'bad' : '');
        }
        for (const id of req.locked.keys()) board.badge(id, 'lock', ICON.lock);
        const baseText = kind === 'coup' ? '指向一个国家，链的后面会排出它的后果；点击即政变' : kind === 'realign' ? `还能掷 ${req.left} 次。国家脚下的数字是你比对手多加几点` : req.hint;
        const buttons = [];
        if (req.optional) buttons.push({ label: '到此为止', key: 'enter', keyLabel: '↵', on: () => act.resolve(null), primary: true });
        if (req.cancel) buttons.push({ label: '收回这张牌', key: 'escape', keyLabel: 'Esc', on: () => act.resolve(null) });
        const h = hint(n, { text: baseText, buttons });
        const general = [...chain.querySelectorAll('.ch-node.is-ghost')].map((x) => x.cloneNode(true));
        const restore = () => {
          clearGhosts();
          for (const x of general) chain.appendChild(x.cloneNode(true));
        };
        const off = board.onHover((id) => {
          if (id && req.locked.has(id)) return h.say(`${ICON.lock}${ctx.name(id)}：${req.locked.get(id)}`, 'bad');
          const p = id && req.targets.get(id);
          if (!p) {
            h.say(baseText);
            if (kind === 'coup') restore();
            return;
          }
          if (kind === 'coup') {
            h.say(`<b>${ctx.name(id)}</b>${p.key ? ' ★ 战场国' : ''}：${p.need ? `掷出 ≥${p.need} 成功，${Math.round(p.chance * 100)}%` : '这张牌点数不够，不可能成功'}`, p.key ? 'warn' : '');
            const fires = general.filter((x) => x.dataset.tag === 'event').map((x) => ({ tag: 'event', icon: ICON.event, label: '苏联事件', sub: '照样发生', cls: 'b' }));
            ghosts([...coupGhosts(p, 0), ...fires]);
          } else if (kind === 'realign') h.say(`<b>${ctx.name(id)}</b>：你 +${p.mods[0].reduce((a, m) => a + m.n, 0)}，苏联 +${p.mods[1].reduce((a, m) => a + m.n, 0)}`);
          else h.say(`<b>${ctx.name(id)}</b>：${baseText}`);
        });
        const id = await Promise.race([board.pick(req.targets), act.promise]);
        off();
        h.off();
        board.cancelPick();
        board.clearBadges('need');
        board.clearBadges('lock');
        board.mark(null);
        if (id) {
          cap(n, ctx.name(id), kind === 'coup' ? (ctx.country(id).key ? '战场国' : '') : kind === 'realign' ? `第 ${req.total - req.left + 1} 掷` : '');
          n._relight = () => board.ring(id, 'a');
          finish(n);
          board.big(id);
          board.ring(id, 'a');
          if (kind === 'coup') {
            const fires = general.filter((x) => x.dataset.tag === 'event').map(() => ({ tag: 'event', icon: ICON.event, label: '苏联事件', sub: '照样发生', cls: 'b' }));
            ghosts([...coupGhosts(req.targets.get(id), 0), ...fires]);
          }
        } else if (req.cancel) n.remove();
        else {
          // stopping early: the links that would have followed are let go
          n.remove();
          [...chain.querySelectorAll('.ch-node.is-ghost')].filter((x) => x.dataset.tag !== 'event').forEach((x) => x.remove());
        }
        return id;
      },

      async roll(spec) {
        if (spec.id) {
          await board.show(spec.id);
          board.big(spec.id);
        }
        const two = spec.dice.length > 1;
        const n = take('die', { icon: '', label: spec.kind === 'space' ? MODE_NAME.space : `${MODE_NAME[spec.kind]} · ${ctx.name(spec.id)}`, sub: '掷骰…' });
        n.classList.add('is-rolling');
        n.classList.toggle('is-two', two);
        const dice = spec.dice.map((d) => ({ d, die: ctx.makeDie({ side: d.side }) }));
        med(n).replaceChildren(...dice.map((x) => x.die.el));
        // the arithmetic hangs under the die, one small plate at a time
        const plates = fx.el('div', 'ch-math');
        const plate = (cls, big, small) => `<span class="ch-plate ${cls}"><b>${big}</b>${small}</span>`;
        if (spec.kind === 'coup') plates.innerHTML = plate('p-die', '?', '骰') + spec.dice[0].mods.map((m) => plate('p-add', `+${m.n}`, m.label)).join('') + plate('p-bar', `−${spec.bar.n}`, spec.bar.label) + plate('p-sum', '?', '净值');
        else if (two) plates.innerHTML = spec.dice.map((d) => `<span class="ch-row ${side(d.side)}"><i>${SIDE_NAME[d.side]}</i>${plate('p-die', '?', '骰')}${d.mods.map((m) => plate('p-add', `+${m.n}`, m.label)).join('')}${plate('p-sum', '?', '合计')}</span>`).join('');
        else plates.innerHTML = plate('p-die', '?', '骰') + plate('p-bar', `≤${spec.max}`, '成功');
        hang(n).replaceChildren(plates);
        await wait(420);
        await Promise.all(dice.map((x, i) => x.die.roll(x.d.value, { ms: 1300 + i * 380, settle: 0.4 })));
        const show = (el, v) => {
          el.querySelector('b').textContent = v;
          el.classList.add('is-on');
        };
        if (two) {
          plates.querySelectorAll('.ch-row').forEach((row, i) => {
            show(row.querySelector('.p-die'), spec.dice[i].value);
            row.querySelectorAll('.p-add').forEach((p) => p.classList.add('is-on'));
            show(row.querySelector('.p-sum'), spec.dice[i].total);
          });
          await wait(600);
        } else {
          show(plates.querySelector('.p-die'), spec.dice[0].value);
          for (const p of plates.querySelectorAll('.p-add, .p-bar')) {
            await wait(260);
            p.classList.add('is-on');
          }
          const sum = plates.querySelector('.p-sum');
          if (sum) {
            await wait(300);
            show(sum, spec.dice[0].total - spec.bar.n);
          }
        }
        await wait(350);
        const mine = spec.kind === 'realign' ? (spec.winner === null ? 'even' : spec.winner === 0 ? 'good' : 'bad') : spec.ok === (spec.by === 0) ? 'good' : 'bad';
        n.classList.remove('is-rolling');
        n.classList.add('is-read', `v-${mine}`);
        cap(n, undefined, spec.text);
        fx.shake(med(n), 4, 300);
        await pause(1150);
        // once read, the link keeps the short of it
        cap(n, two ? `${spec.dice[0].total} 对 ${spec.dice[1].total}` : `掷出 ${spec.dice[0].value}`, spec.kind === 'realign' ? (spec.winner === null ? '平手' : `${SIDE_NAME[spec.winner]}胜`) : spec.ok ? '成功' : '失败');
        n.classList.add('is-small');
        finish(n);
      },

      async step(e, commit, cause) {
        const d = describe(ctx, e);
        const by = cause?.by ?? 0;
        let n;
        if (e.t === 'inf') {
          n = take('inf', { icon: FX_ICON.inf, label: ctx.name(e.id), sub: `${SIDE_NAME[e.side]} ${d.short}`, cls: d.cls });
          await board.show(e.id);
          board.big(e.id);
          await beam(n, board.rect(e.id), d.cls);
          commit();
          board.ring(e.id, d.cls);
          board.pop(e.id, d.short, d.cls);
          if (d.took) {
            board.pop(e.id, d.took.replace(' · ', ''), 'gold late');
            cap(n, undefined, `${SIDE_NAME[e.side]} ${d.short}${d.took}`);
          }
          if (by === 1) board.badge(e.id, 'last', d.short, d.cls);
          n._relight = () => (board.ring(e.id, d.cls), board.show(e.id));
          await pause(900);
        } else if (d.meter) {
          const lineGhost = chain.querySelector('.ch-node.is-ghost.t-line');
          n = take(e.t, { icon: FX_ICON[e.t], label: e.t === 'crisis' ? '核危机' : e.t === 'milops' ? '军事行动' : e.t === 'vp' ? '胜利点' : '太空竞赛', sub: e.t === 'vp' ? `${SIDE_NAME[e.side]} ${d.short}` : e.t === 'space' ? `${SIDE_NAME[e.side]}到第 ${e.to} 步` : `${e.from} → ${e.to}`, cls: d.cls });
          if (lineGhost && cause?.kind === 'event') lineGhost.remove();
          const target = hud.el(d.meter);
          await beam(n, target, d.cls);
          commit();
          const lit = () => fx.flash(target, { label: d.text, cls: d.cls, ms: 2300, place: hud.side(d.meter) });
          lit();
          if (e.t === 'crisis' && e.d < 0) fx.shake(hud.pane('crisis') ?? target, 6);
          n._relight = lit;
          await pause(e.t === 'crisis' ? 1750 : 1150);
        } else {
          n = take('note', { icon: FX_ICON.note, label: d.text, sub: '', cls: 'note' });
          if (e.id) board.pop(e.id, '—', 'note');
          commit();
          await pause(1050);
        }
        // an event's lines were ghosts in words; each real consequence uses one up
        if (cause?.kind === 'event' && e.t === 'inf') chain.querySelector('.ch-node.is-ghost.t-line')?.remove();
        finish(n);
      },

      async trigger(play) {
        const n = take('event', { icon: ICON.event, label: '苏联事件', sub: `《${play.card.title}》`, cls: 'b' });
        fx.flash(hud.el('played'), { cls: 'b', ms: 1300, label: '对手事件触发', place: 'above' });
        ghosts(eventGhosts(play.no, 1));
        await pause(1300);
        finish(n);
      },

      async settle(play) {
        clearGhosts();
        for (const x of chain.children) if (x.classList.contains('is-now')) finish(x);
        if (play.cancelled) {
          chain.replaceChildren();
          rail.classList.remove('is-on');
        }
        await base.settle.call(this, play);
      },

      async phase(info) {
        if (info.kind === 'end') {
          archive();
          chain.replaceChildren();
        }
        return base.phase.call(this, info);
      },
    };
  },
};
