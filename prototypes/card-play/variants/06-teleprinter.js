// 06 电传打字机. The whole exchange is printed on one strip of teleprinter paper at the top of
// the screen: what is being asked, what was chosen, the dice, and every consequence as a line of
// its own, typed out as it happens. Both capitals print on the same tape, so the opponent's move
// reads as the same sentences in red. Keyboard first: every choice is a key printed on the tape,
// and every country on offer carries a short code that can be typed instead of clicked.
import './06-teleprinter.css';
import { basePresenter, carryLine, choiceList, decision, describe, playLine, ICON } from '../core/base.js';
import { MODE_NAME, ABORT } from '../core/game.js';

const NS = 'http://www.w3.org/2000/svg';
const CITY = ['华盛顿', '莫斯科'];
const SHORT = ['美', '苏'];
// a die face small enough to sit in a line of type
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const face = (n) => `<svg class="tp-face" viewBox="0 0 20 20"><rect x="1" y="1" width="18" height="18" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/>${PIPS[n].map((i) => `<circle cx="${5.2 + (i % 3) * 4.8}" cy="${5.2 + Math.floor(i / 3) * 4.8}" r="1.75"/>`).join('')}</svg>`;
// letters for country codes: everything the toolbar does not use for itself
const ALPHA = [...'sdghjklqwetyuizxcvbm'];
const BELL = '<svg class="tp-bell" viewBox="0 0 24 24"><path d="M12 3a5.500 5.500 0 0 0-5.500 5.500c0 5-2 6.500-2 6.500h15s-2-1.500-2-6.500A5.500 5.500 0 0 0 12 3z"/><path d="M10 19.500a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const sign = (d) => (d > 0 ? '+' : '−') + Math.abs(d);

export default {
  id: '06',
  name: '电传打字机',
  ref: '电报纸带 / 命令行',
  idea: '一条电传纸带把整局对话逐行打出来：问什么、选了什么、骰子、每个后果各占一行；选择全是印在纸带上的按键，国家也能敲代号选。',
  notes: {
    choose: '牌夹到纸带左端，纸带打出“用途？”和五个键帽 [E] 事件 [Z] 放置 [X] 调整 [C] 政变 [V] 太空。指着键帽，下面一行小字写明它意味着什么、地图同时亮出能用的国家；不能用的键帽划掉并写明原因。对手的牌会多打一行红字警告。',
    target: '可选国家亮起，并各挂一张打字纸签，上面是一到两个字母的代号：敲代号等于点它。放置时每放一点，纸带上就多打一个“意大利 +1”，退格把最后一个划掉，回车发出。',
    dice: '先打出“需 ≥3（67%）”，然后“掷骰”后面的字轮咔咔乱跳，纸带右端一颗真骰子同时翻滚；骰子落定，字轮定格，算式和“成功 / 失败”紧跟着打出来。',
    guide: '每个后果单独打一行。打到那一行时，一根细线从这行字拉到出事的国家或刻度，那里随即变化。核危机那一行用红字加铃，整条纸带震一下。指着旧的一行，线会再亮一次。',
    opponent: '对手的行动打在同一条纸带上，红字，抬头“莫斯科 >”，行的顺序和你自己行动时完全一样；他的牌先从他手里落到纸带左端放大给你读。',
  },
  pros: ['所有发生过的事留在纸带上，可回看，等于自带战报', '键盘能打完一整轮：选牌之外不必碰鼠标', '每行一个后果，对手的行动读起来和自己的一样', '占地小：平时只有三行高'],
  cons: ['靠读字，不如图形直观；第一次玩的人要多读几行', '国家代号是临时编的，要先看一眼再敲', '纸带在屏幕上方，行动时最多展开到六行，会盖住北欧几个节点'],

  mount(ctx) {
    const base = basePresenter(ctx);
    const { fx, board, hand, hud, cards, layer, G, signal } = ctx;
    const wait = fx.wait;
    const el = fx.el;

    /* ------------------------------------------------------------------ the tape */
    const tp = el('div', 'tp');
    tp.innerHTML =
      '<div class="tp-head"></div>' +
      '<div class="tp-paper"><div class="tp-torn"></div><div class="tp-roll"><div class="tp-lines"></div></div><div class="tp-sub"></div><div class="tp-well"></div></div>' +
      '<div class="tp-bail"></div>';
    layer.appendChild(tp);
    const headEl = tp.querySelector('.tp-head');
    const rollEl = tp.querySelector('.tp-roll');
    const linesEl = tp.querySelector('.tp-lines');
    const subEl = tp.querySelector('.tp-sub');
    const wellEl = tp.querySelector('.tp-well');
    const wires = document.createElementNS(NS, 'svg');
    wires.setAttribute('class', 'tp-wires');
    layer.appendChild(wires);

    // the space bar hurries the line being typed, then does what it always does
    let turbo = false;
    const offSpace = ctx.keys({
      ' ': () => {
        turbo = true;
        fx.skip();
      },
    });

    const busy = (on) => tp.classList.toggle('is-busy', on);
    const stamp = () => `${G.turn}·${G.phase === 'headline' ? '头' : G.round || 1}`;
    const feed = () => (rollEl.scrollTop = rollEl.scrollHeight);

    /** Starts a line. side: 0 | 1 | null (the machine itself). Returns { el, body }. */
    function line(side, cls = '') {
      for (const n of linesEl.querySelectorAll('.is-typing')) n.classList.remove('is-typing');
      const n = el('div', `tp-line ${side === 0 ? 'a' : side === 1 ? 'b' : 'n'} ${cls}`);
      n.innerHTML = `<i class="tp-no">${stamp()}</i>${side === null ? '' : `<b class="tp-city">${CITY[side]} &gt;</b>`}<span class="tp-body"></span>`;
      linesEl.appendChild(n);
      while (linesEl.children.length > 60) linesEl.firstChild.remove();
      feed();
      return { el: n, body: n.querySelector('.tp-body') };
    }

    /**
     * Types into a line. parts: strings, [text, class] pairs, or elements (which arrive whole).
     * About eleven milliseconds a character; the space bar finishes the line at once.
     */
    async function type(L, parts) {
      turbo = false;
      L.el.classList.add('is-typing');
      for (const p of Array.isArray(parts) ? parts : [parts]) {
        if (p instanceof Node) {
          L.body.appendChild(p);
          feed();
          if (!turbo) await wait(40);
          continue;
        }
        const [text, cls = ''] = Array.isArray(p) ? p : [p];
        const span = el('span', cls);
        L.body.appendChild(span);
        const chars = [...text];
        for (let i = 0; i < chars.length; i += 2) {
          span.textContent += chars.slice(i, i + 2).join('');
          if (!turbo) await wait(22);
        }
        feed();
      }
      if (signal.aborted) throw ABORT;
      return L;
    }
    const say = (side, parts, cls) => type(line(side, cls), parts);
    const rule = (text) => say(null, [text], 'tp-rule');
    const sub = (html = '', cls = '') => {
      subEl.className = `tp-sub ${cls}`;
      subEl.innerHTML = html;
    };

    /** A key cap printed on the tape. */
    function cap(key, label, { off = false, title = '' } = {}) {
      const b = el('button', `tp-key ${off ? 'is-off' : ''}`, `<kbd>${key}</kbd>${label}`);
      b.type = 'button';
      if (title) b.title = title;
      return b;
    }

    /* ------------------------------------------------------------------ the head of the tape: the card in play */
    function headClear() {
      headEl.replaceChildren();
      headEl.className = 'tp-head';
    }
    /** The card flies to the head of the tape and is clipped there; pointing at it enlarges it. */
    async function headCard(no, from, { open = false } = {}) {
      headClear();
      headEl.classList.add('is-card');
      const to = headEl.getBoundingClientRect();
      if (from) await cards.flyNo(no, from, { left: to.left, top: to.top, width: to.width, height: to.width * 1.4 }, { duration: 380 });
      cards.put(no, headEl);
      headEl.classList.toggle('is-open', open);
    }
    const headRect = () => headEl.querySelector('.slot')?.getBoundingClientRect() ?? null;
    /** Once the card is on the table, a ticket with its value and name stays on the tape. */
    function headStub(play) {
      headClear();
      headEl.classList.add('is-stub', play.by === 0 ? 'a' : 'b');
      headEl.innerHTML = `<b>${play.card.value || '✦'}</b><span>${play.card.title}</span><i>${play.use === 'event' ? '事件' : play.use === 'space' ? '太空' : MODE_NAME[play.mode]}</i>`;
    }

    /* ------------------------------------------------------------------ wires: from a line to what it changed */
    const local = (p) => {
      const b = layer.getBoundingClientRect();
      return { x: p.x - b.left, y: p.y - b.top };
    };
    function target(ref) {
      if (!ref) return null;
      if (ref.startsWith('c:')) return board.at(ref.slice(2));
      const r = hud.rect(ref.slice(2));
      return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    }
    /** Lights a thin wire from the end of a line to a point. Resolves when the light arrives. */
    async function wire(lineEl, ref, cls = 'gold', { quick = false } = {}) {
      const to = target(ref);
      const body = lineEl.querySelector('.tp-body');
      if (!to || !body) return;
      const r = body.getBoundingClientRect();
      const paper = rollEl.getBoundingClientRect();
      const a = local({ x: Math.min(r.right + 6, paper.right - 8), y: Math.min(Math.max(r.top + r.height / 2, paper.top + 6), paper.bottom - 6) });
      const b = local(to);
      // out of the paper sideways, then down or across: a wire, not an arrow
      const midY = a.y + (b.y - a.y) * 0.12;
      const d = `M${a.x},${a.y} C${a.x + 60},${midY} ${b.x + (a.x < b.x ? -40 : 40)},${a.y + (b.y - a.y) * 0.45} ${b.x},${b.y}`;
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', `tp-wire ${cls}`);
      g.innerHTML = `<path class="glow" d="${d}"/><path class="core" d="${d}"/><circle class="end" cx="${b.x}" cy="${b.y}" r="5"/><circle class="start" cx="${a.x}" cy="${a.y}" r="3"/>`;
      wires.appendChild(g);
      const len = g.querySelector('.core').getTotalLength();
      for (const p of g.querySelectorAll('path')) {
        p.style.strokeDasharray = `${len}`;
        p.style.strokeDashoffset = `${len}`;
      }
      g.getBoundingClientRect();
      for (const p of g.querySelectorAll('path')) p.style.strokeDashoffset = '0';
      g.classList.add('is-lit');
      setTimeout(() => g.classList.add('is-out'), 1500);
      setTimeout(() => g.remove(), 2100);
      if (!quick) await wait(360);
    }

    // pointing at an old line lights its wire again and nudges what it was about
    linesEl.addEventListener('pointerover', (e) => {
      const n = e.target instanceof Element ? e.target.closest('.tp-line[data-ref]') : null;
      if (!n || n.dataset.lit) return;
      n.dataset.lit = '1';
      setTimeout(() => delete n.dataset.lit, 1200);
      const ref = n.dataset.ref;
      wire(n, ref, n.dataset.cls || 'gold', { quick: true }).catch(() => {});
      if (ref.startsWith('c:')) board.ring(ref.slice(2), n.dataset.cls);
      else {
        const m = hud.el(ref.slice(2));
        if (m) fx.flash(m, { cls: n.dataset.cls, ms: 900 });
      }
    });

    /* ------------------------------------------------------------------ codes: a country can be typed */
    /** Gives each id a code of one or two letters, reading the map left to right. */
    function codesFor(ids) {
      const list = [...ids].sort((x, y) => {
        const a = board.at(x) ?? { x: 0, y: 0 };
        const b = board.at(y) ?? { x: 0, y: 0 };
        return Math.round(a.x / 90) - Math.round(b.x / 90) || a.y - b.y;
      });
      // As many one-letter codes as possible. When there are more countries than letters, the last
      // k letters become prefixes of two-letter codes, so that no code is the start of another.
      const n = ALPHA.length;
      let k = 0;
      while (n - k + k * n < list.length) k++;
      const out = new Map();
      list.forEach((id, i) => {
        if (i < n - k) out.set(id, ALPHA[i]);
        else out.set(id, ALPHA[n - k + Math.floor((i - (n - k)) / n)] + ALPHA[(i - (n - k)) % n]);
      });
      return out;
    }
    // With a great many countries on offer (placing influence, mostly) the tags would bury the map,
    // so they stay off until Tab asks for them. The choice lasts for the card being played.
    const MANY = 30;
    let wantMany = false;
    /**
     * Hangs the codes on the map and listens for them. Returns { typed: Promise<id>, stop() }.
     * A code half typed dims every tag that no longer matches.
     */
    function codes(ids) {
      const map = codesFor(ids);
      const byCode = new Map([...map].map(([id, c]) => [c, id]));
      const d = deferred();
      const many = map.size > MANY;
      let buf = '';
      const on = () => !many || wantMany;
      const paint = () => {
        if (!on()) return board.clearBadges('code');
        for (const [id, c] of map) board.badge(id, 'code', c.startsWith(buf) ? `<u>${c.slice(0, buf.length)}</u>${c.slice(buf.length)}` : c, buf && !c.startsWith(buf) ? 'dim' : '');
      };
      const press = (ch) => {
        if (!on()) return;
        const next = buf + ch;
        if (byCode.has(next)) {
          buf = '';
          d.resolve(byCode.get(next));
        } else if ([...byCode.keys()].some((c) => c.startsWith(next))) buf = next;
        else buf = '';
        paint();
      };
      const off = ctx.keys({
        ...Object.fromEntries(ALPHA.map((ch) => [ch, () => press(ch)])),
        tab: () => {
          wantMany = !wantMany;
          buf = '';
          paint();
        },
      });
      paint();
      return {
        typed: d.promise,
        many,
        get buffer() {
          return buf;
        },
        clear() {
          buf = '';
          paint();
        },
        stop() {
          off();
          board.clearBadges('code');
        },
      };
    }

    /* ------------------------------------------------------------------ asking what a card is for */
    function detail(c, ch) {
      if (c.key === 'event') {
        if (!c.ok) return [`${ICON.lock}${c.why}`, 'bad'];
        return [c.lines.map((l) => (l.warn ? `<em>${l.text}</em>` : l.text)).join('；') + ` <small>${c.sub}</small>`, c.lines.some((l) => l.warn) ? 'warn' : ''];
      }
      if (!c.ok) return [`${ICON.lock}${c.label}：${c.why}`, 'bad'];
      const tail = c.risk ? ` · ${ICON.warn}<em>${c.risk}</em>` : c.safe ? ' · <strong>不触发对手事件</strong>' : ch.fires ? ' · <em>之后苏联事件照样发生</em>' : '';
      return [`${c.label} · ${c.sub}${tail}`, c.risk ? 'warn' : ''];
    }

    /** Prints the question and the key caps. Resolves with a choice key, or null when the card is taken back. */
    async function askUse(no, { headline = false } = {}) {
      const ch = choiceList(ctx, no);
      const c = ch.card;
      busy(true);
      const made = [];
      const head = await say(0, [`《${c.title}》`, [c.value ? ` ${c.value} 点` : ' 结算', 'tp-num'], headline ? '  作头条发出?' : '  用途?']);
      made.push(head);
      if (ch.fires || headline) {
        const ev = ch.byKey.event;
        made.push(await say(ch.fires ? 1 : null, [ch.fires ? ['注意 · 这是苏联的事件', 'tp-strong'] : '事件 · ', ch.fires ? (headline ? '：发出去就是替对手办事 · ' : '：用它行动，事件照样发生（太空竞赛除外） · ') : '', ev.lines.map((l) => l.text).join('；')], ch.fires ? 'tp-warn' : 'tp-quiet'));
      }
      const row = line(null, 'tp-caps');
      made.push(row);
      const d = deferred();
      const keymap = { escape: () => d.resolve(null) };
      const idle = headline ? '回车发出，Esc 换一张' : '按键选择，或点键帽 · 指着键帽，地图会亮出它能用在哪';
      const options = headline ? [{ key: 'event', hot: '↵', label: '发出', ok: true, lines: ch.byKey.event.lines, sub: '头条只能作为事件' }] : ch.list;
      for (const o of options) {
        const b = cap(o.hot.toUpperCase(), o.key === 'event' && !headline ? '事件' : o.label.replace('影响力', '').replace('阵营', '').replace('竞赛', ''), { off: !o.ok });
        row.body.appendChild(b);
        const [html, cls] = headline ? [idle, ''] : detail(o, ch);
        b.addEventListener('pointerenter', () => {
          sub(html, cls);
          if (o.ok && o.mark) board.mark(o.mark);
        });
        b.addEventListener('pointerleave', () => {
          sub(idle);
          board.mark(null);
        });
        if (!o.ok) continue;
        b.addEventListener('click', () => d.resolve(o.key));
        keymap[headline ? 'enter' : o.hot] = () => d.resolve(o.key);
      }
      const back = cap('Esc', headline ? '换一张' : '收回');
      back.classList.add('is-back');
      back.addEventListener('click', () => d.resolve(null));
      row.body.appendChild(back);
      feed();
      sub(idle);
      const off = ctx.keys(keymap);
      const key = await d.promise;
      off();
      board.mark(null);
      sub('');
      row.el.remove();
      if (key === null) {
        for (const m of made) m.el.remove();
        return null;
      }
      const chosen = headline ? '已加密发出' : ch.byKey[key].label;
      await type(head, [' · ', [chosen, 'tp-strong']]);
      return key;
    }

    /** A question that stays only until it is answered: it is not part of the record. */
    function prompt(side, text) {
      const L = line(side, 'tp-ask');
      L.body.textContent = text;
      L.el.classList.add('is-typing');
      return L;
    }

    /* ------------------------------------------------------------------ the presenter */
    return {
      ...base,

      async phase(info) {
        if (info.kind === 'headline') {
          busy(true);
          await rule('════ 头条阶段 · 双方各暗发一张，同时译出，都作为事件发生 ════');
          await wait(500);
        } else if (info.kind === 'round') {
          hand.live(false);
          await rule(`──── 第 ${info.round} 行动轮 · ${CITY[info.who]} ────`);
          await wait(250);
        } else {
          sub('');
          await rule(info.why === 'war' ? '════ 线路中断 ════' : '════ 通讯结束 ════');
          await base.phase.call(this, info);
        }
      },

      /* ---- headline */
      // nothing to answer in the headline: a card dragged out of the hand is sent
      async pickHeadline() {
        busy(false);
        const idle = '头条? 把一张手牌拖出来，松手即发出';
        const ask = prompt(0, idle);
        const pick = await ctx.pickCard({
          click: false,
          onCarry: (no) => (ask.body.textContent = `头条? ${carryLine(ctx, no).text}`),
          onBack: () => (ask.body.textContent = idle),
        });
        ask.el.remove();
        hand.live(false);
        await headCard(pick.no, pick.rect);
        const c = ctx.card(pick.no);
        await say(0, [`《${c.title}》`, [c.value ? ` ${c.value} 点` : ' 结算', 'tp-num'], ' · ', ['已加密发出', 'tp-strong']]);
        return pick.no;
      },

      async showHeadline(h) {
        headClear();
        busy(true);
        const mask = '▒▒▒▒▒▒▒▒';
        const rows = [];
        for (const by of [0, 1]) rows[by] = await say(by, ['头条 ', [mask, 'tp-mask']]);
        const stage = base.showHeadline.call(this, h);
        await wait(1500);
        for (const by of [0, 1]) {
          const c = ctx.card(by === 0 ? h.mine : h.theirs);
          rows[by].body.querySelector('.tp-mask').remove();
          await type(rows[by], [`《${c.title}》`, [` ${c.value} 点`, 'tp-num']]);
        }
        const first = h.order[0];
        const tie = ctx.card(h.mine).value === ctx.card(h.theirs).value;
        await say(null, [`先结算 > ${CITY[first.by]}`, tie ? ' · 点数相同，你先' : ' · 点数高者先'], 'tp-quiet');
        await stage;
      },

      /* ---- the player's decision */
      async decide() {
        for (;;) {
          busy(false);
          hand.live(true);
          const ask = prompt(0, '待命 · 点一张手牌，或把它拖出来');
          const pick = await ctx.pickCard();
          ask.el.remove();
          hand.live(false);
          await headCard(pick.no, pick.rect);
          const key = await askUse(pick.no);
          if (key) {
            base.ui.from = headRect();
            return decision(pick.no, key);
          }
          headClear();
          hand.release(pick.no);
        }
      },

      /* ---- a card is played */
      async announce(play) {
        hand.live(false);
        board.clearBadges('last');
        busy(true);
        wantMany = false;
        const p = playLine(ctx, play);
        if (play.headline) {
          await say(play.by, ['头条 ', `《${play.card.title}》`, ' · 事件生效']);
          await base.announce.call(this, play);
          headStub(play);
          return;
        }
        if (play.by === 0) {
          // the line that asked "用途?" already says what this is
          await base.ui.toTable(play.no, base.ui.from);
          base.ui.from = null;
        } else {
          // their card drops from their hand to the head of the tape and is held open to be read
          const o = hud.rect('opp');
          const from = o ? { left: o.left + o.width / 2 - 30, top: o.top, width: 60, height: 84 } : null;
          await headCard(play.no, from, { open: true });
          await say(1, [`《${play.card.title}》`, [play.card.value ? ` ${play.card.value} 点` : '', 'tp-num'], ' · ', [`${p.what.replace(/^行动 \d+ 点 · /, '')}`, 'tp-strong'], p.detail]);
          await wait(1300);
          headEl.classList.remove('is-open');
          await wait(220);
          await base.ui.toTable(play.no, headRect());
        }
        headStub(play);
        if (play.target) {
          await board.show(play.target);
          board.big(play.target);
          board.ring(play.target, play.by === 0 ? 'a' : 'b');
          await wait(300);
        }
      },

      /* ---- placing influence: one line that grows */
      async place(session) {
        busy(true);
        const L = await say(0, ['放置 > ']);
        const tokens = [];
        let act = deferred();
        let hints = null;
        const press = (what) => act.resolve(what);
        const left = el('span', 'tp-left');
        const draw = () => {
          const t = session.targets();
          const ok = new Map([...t].filter(([, v]) => v.ok));
          board.mark({ kind: 'place', ok, lift: session.spent.map((s) => s.id) });
          board.clearBadges('cost');
          board.clearBadges('put');
          for (const [id, v] of ok) if (v.cost > 1) board.badge(id, 'cost', `${v.cost}`, 'b');
          for (const id of new Set(session.spent.map((s) => s.id))) board.badge(id, 'put', `+${session.count(id)}`, 'a');
          left.textContent = ` · 余 ${session.left} 点`;
          L.body.appendChild(left);
          hints?.stop();
          hints = session.left && ok.size ? codes(ok.keys()) : null;
          const none = !session.spent.length;
          const text = session.left ? (ok.size ? `点亮着的国家放 1 点${hints?.many ? ' · <kbd>Tab</kbd>显示代号，敲代号也行' : '，或敲它的代号'} · 标 ×2 的要花 2 点` : '剩下的点数哪里都放不了') : '点数用完了';
          sub(`${text} · <kbd>⌫</kbd>撤销 ${none ? '<kbd>Esc</kbd>收回这张牌' : '<kbd>↵</kbd>发出'}`);
          return ok;
        };
        const off = ctx.keys({
          backspace: () => (hints?.buffer ? hints.clear() : press('undo')),
          enter: () => session.spent.length && press('done'),
          escape: () => !session.spent.length && press('cancel'),
        });
        let result = true;
        for (;;) {
          const ok = draw();
          act = deferred();
          const got = await Promise.race([session.left && ok.size ? board.pick(ok) : new Promise(() => {}), hints?.typed ?? new Promise(() => {}), act.promise]);
          board.cancelPick();
          if (got === 'undo') {
            if (session.undo()) tokens.pop()?.classList.add('is-struck');
          } else if (got === 'done') break;
          else if (got === 'cancel') {
            result = false;
            break;
          } else if (got) {
            const e = session.add(got);
            if (!e) continue;
            const t = el('span', 'tp-tok a', `${ctx.name(got)} +1${e.ctrlTo !== e.ctrlFrom ? (e.ctrlTo === 0 ? '（美国控制）' : '（打破控制）') : ''}`);
            L.body.insertBefore(t, left);
            tokens.push(t);
            feed();
            L.el.dataset.ref = `c:${got}`;
            L.el.dataset.cls = 'a';
            wire(L.el, `c:${got}`, 'a', { quick: true }).catch(() => {});
            board.pop(got, '+1', 'a');
            board.ring(got, 'a');
          }
        }
        off();
        hints?.stop();
        board.mark(null);
        board.clearBadges('cost');
        board.clearBadges('put');
        sub('');
        left.remove();
        if (!result) L.el.remove();
        else await type(L, [' · ', ['发出', 'tp-strong']]);
        return result;
      },

      /* ---- choosing a country */
      async pickTarget(req) {
        busy(true);
        const kind = req.mode;
        const warn = kind === 'coup' ? [...req.targets].filter(([, p]) => p.key).map(([id]) => id) : [];
        board.mark({ kind, ok: req.targets, locked: req.locked, warn });
        for (const [id, p] of req.targets) {
          if (kind === 'coup') board.badge(id, 'need', p.need ? `≥${p.need}` : '✕', p.need ? '' : 'off');
          if (kind === 'realign') board.badge(id, 'need', p.edge > 0 ? `+${p.edge}` : p.edge < 0 ? `−${-p.edge}` : '±0', p.edge > 0 ? 'good' : p.edge < 0 ? 'bad' : '');
        }
        for (const id of req.locked.keys()) board.badge(id, 'lock', ICON.lock);
        const nth = req.total > 1 ? `（${req.total - req.left + 1}/${req.total}）` : '';
        const ask = prompt(0, kind === 'event' ? `${req.hint}${nth}` : `${MODE_NAME[kind]}${nth} · 目标?`);
        const act = deferred();
        const keymap = {};
        const hints = codes(req.targets.keys());
        const tips = [hints.many ? '点亮着的国家 · <kbd>Tab</kbd>显示代号' : '点亮着的国家，或敲它的代号'];
        if (kind === 'coup') tips.push('脚下的数字是要掷出几点');
        if (kind === 'realign') tips.push('脚下的数字是你比对手多加几点');
        if (req.optional) {
          keymap.enter = () => act.resolve(null);
          tips.push('<kbd>↵</kbd>到此为止');
        }
        if (req.cancel) {
          keymap.escape = () => act.resolve(null);
          tips.push('<kbd>Esc</kbd>收回这张牌');
        }
        const idle = tips.join(' · ');
        sub(idle);
        keymap.backspace = () => hints.clear();
        const off = ctx.keys(keymap);
        const offHover = board.onHover((id) => {
          if (id && req.locked.has(id)) return sub(`${ICON.lock}${ctx.name(id)}：${req.locked.get(id)}`, 'bad');
          const p = id && req.targets.get(id);
          if (!p) return sub(idle);
          if (kind === 'coup') sub(`${ctx.name(id)} · ${p.need ? `掷出 ≥${p.need} 成功（${Math.round(p.chance * 100)}%）` : '点数不够，不可能成功'}${p.key ? ` · ${ICON.warn}<em>战场国：核危机 ${G.crisis} → ${p.crisisTo}</em>` : ''} · 军事行动 → ${p.milopsTo}`, p.key ? 'warn' : '');
          else if (kind === 'realign') sub(`${ctx.name(id)} · 你的骰子 +${p.mods[0].reduce((a, m) => a + m.n, 0)}，苏联 +${p.mods[1].reduce((a, m) => a + m.n, 0)}`);
          else sub(`${ctx.name(id)} · ${idle}`);
        });
        const id = await Promise.race([board.pick(req.targets), hints.typed, act.promise]);
        off();
        offHover();
        hints.stop();
        board.cancelPick();
        board.clearBadges('need');
        board.clearBadges('lock');
        board.mark(null);
        sub('');
        ask.el.remove();
        if (id) {
          board.big(id);
          board.ring(id, 'a');
          const L = await say(0, [kind === 'event' ? '选定 > ' : '目标 > ', [ctx.name(id), 'tp-strong'], ctx.country(id).key ? ' ★' : '']);
          L.el.dataset.ref = `c:${id}`;
          L.el.dataset.cls = 'a';
        }
        return id;
      },

      /* ---- dice: the type wheel rattles while the die tumbles at the end of the tape */
      async roll(spec) {
        busy(true);
        if (spec.id) {
          await board.show(spec.id);
          board.big(spec.id);
        }
        const name = spec.id ? ctx.name(spec.id) : '';
        const pct = (c) => `${Math.round(c * 100)}%`;
        const head =
          spec.kind === 'coup'
            ? [`政变 ${name}`, ' · ', [`${spec.dice[0].mods[0].n}`, 'tp-num'], ` 点对${spec.bar.label.replace(' ×', '×')}`, spec.need ? [` · 需 ≥${spec.need}（${pct(spec.chance)}）`, 'tp-strong'] : [' · 不可能成功', 'tp-strong']]
            : spec.kind === 'space'
              ? ['太空竞赛', [` · 需 1–${spec.max}（${pct(spec.chance)}）`, 'tp-strong']]
              : [`调整 ${name}`, ` · 美 +${spec.dice[0].total - spec.dice[0].value} 对 苏 +${spec.dice[1].total - spec.dice[1].value}`];
        const H = await say(spec.by, head);
        if (spec.id) {
          H.el.dataset.ref = `c:${spec.id}`;
          H.el.dataset.cls = spec.by === 0 ? 'a' : 'b';
        }
        const L = await say(spec.by, ['掷骰 ']);
        // one wheel per die, spinning until its die has come to rest
        const dice = spec.dice.map((d) => {
          const wheel = el('b', `tp-wheel ${d.side === 0 ? 'a' : 'b'}`, '·');
          L.body.appendChild(wheel);
          const die = ctx.makeDie({ side: d.side });
          wellEl.appendChild(die.el);
          const spin = setInterval(() => (wheel.textContent = String(1 + Math.floor(Math.random() * 6))), 55);
          signal.addEventListener('abort', () => clearInterval(spin), { once: true });
          return { d, wheel, die, spin };
        });
        tp.style.setProperty('--dice', dice.length);
        tp.classList.add('is-rolling');
        await wait(350);
        await Promise.all(
          dice.map(async (x, i) => {
            await x.die.roll(x.d.value, { ms: 1350 + i * 380, turns: 3 });
            clearInterval(x.spin);
            x.wheel.innerHTML = `${face(x.d.value)}<u>${x.d.value}</u>`;
            x.wheel.classList.add('is-set');
            fx.shake(tp, 3, 180);
          }),
        );
        await wait(280);
        const good = spec.kind === 'realign' ? (spec.winner === null ? 'even' : spec.winner === 0 ? 'good' : 'bad') : spec.ok === (spec.by === 0) ? 'good' : 'bad';
        const sum = (d) => `${d.value}${d.mods.map((m) => ` +${m.n}`).join('')} = `;
        const math =
          spec.kind === 'coup'
            ? [' ', sum(spec.dice[0]), [`${spec.dice[0].total}`, 'tp-num'], spec.dice[0].total > spec.bar.n ? ` ＞ ${spec.bar.n}` : ` ≤ ${spec.bar.n}`]
            : spec.kind === 'space'
              ? [` ${spec.dice[0].value <= spec.max ? '≤' : '＞'} ${spec.max}`]
              : [' 美 ', sum(spec.dice[0]), [`${spec.dice[0].total}`, 'tp-num'], ' ／ 苏 ', sum(spec.dice[1]), [`${spec.dice[1].total}`, 'tp-num']];
        await type(L, math);
        const verdict = el('em', `tp-verdict ${good}`, spec.text);
        await type(L, [' ', verdict]);
        await wait(950);
        tp.classList.remove('is-rolling');
        wellEl.replaceChildren();
      },

      /* ---- one consequence, one line */
      async step(e, commit, cause) {
        busy(true);
        const d = describe(ctx, e);
        const by = cause?.by ?? null;
        if (e.t === 'inf') {
          await board.show(e.id);
          board.big(e.id);
          // a coup removes and then adds in the same country: both go on one line
          const last = linesEl.lastElementChild;
          const same = last?.dataset.inf === e.id;
          const L = same ? { el: last, body: last.querySelector('.tp-body') } : await say(by, [[ctx.name(e.id), 'tp-strong'], ' ']);
          L.el.dataset.inf = e.id;
          L.el.dataset.ref = `c:${e.id}`;
          L.el.dataset.cls = d.cls;
          await type(L, [' ', [`${SHORT[e.side]} ${sign(e.d)}`, `tp-tok ${d.cls}`], d.took ? [d.took, 'tp-took'] : '']);
          await wire(L.el, `c:${e.id}`, d.cls);
          commit();
          board.ring(e.id, d.cls);
          board.pop(e.id, d.short, d.cls);
          if (d.took) board.pop(e.id, d.took.replace(' · ', ''), 'gold late');
          if (by === 1) board.badge(e.id, 'last', d.short, d.cls);
          await wait(800);
        } else if (d.meter) {
          const crisis = e.t === 'crisis';
          const down = crisis && e.d < 0;
          const text = crisis ? `核危机 ${e.from}→${e.to}` : e.t === 'milops' ? `军事行动 ${SHORT[e.side]} ${e.from}→${e.to}` : e.t === 'vp' ? `胜利点 ${SHORT[e.side]} +${e.d}` : `太空竞赛 ${SHORT[e.side]} 第 ${e.to} 步`;
          const L = await say(by, [[text, 'tp-strong'], down ? [' ‼', 'tp-strong'] : '', d.why ? [`  ${d.why}`, 'tp-why'] : ''], down ? 'tp-alarm' : crisis ? 'tp-calm' : '');
          L.el.dataset.ref = `m:${d.meter}`;
          L.el.dataset.cls = d.cls;
          if (down) {
            L.body.insertAdjacentHTML('beforeend', BELL);
            fx.shake(tp, 9, 520);
          }
          const meter = hud.el(d.meter);
          await wire(L.el, `m:${d.meter}`, d.cls === 'good' ? 'gold' : d.cls);
          commit();
          fx.flash(meter, { label: d.text, cls: d.cls, ms: 2400, place: hud.side(d.meter) });
          if (down) fx.shake(hud.pane('crisis') ?? meter, 5);
          await wait(crisis ? 1700 : 1100);
        } else {
          const L = await say(by, [e.text], 'tp-quiet');
          if (e.id) {
            L.el.dataset.ref = `c:${e.id}`;
            board.pop(e.id, '—', 'note');
          }
          commit();
          await wait(900);
        }
      },

      async trigger(play) {
        busy(true);
        await say(1, [['事件触发', 'tp-strong'], ` 《${play.card.title}》`, ' · 你用了对手的牌行动'], 'tp-warn');
        fx.flash(hud.el('played'), { cls: 'b', ms: 1200, label: '事件触发', place: 'above' });
        await wait(1100);
      },

      async settle(play) {
        sub('');
        if (play.cancelled) {
          headClear();
          await say(0, [`收回 《${play.card.title}》`], 'tp-quiet');
        }
        await base.settle.call(this, play);
        headClear();
        busy(false);
      },

      destroy() {
        offSpace();
        base.destroy();
      },
    };
  },
};
