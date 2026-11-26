// 07 筹码与骰盅. A card played for operations is cashed into that many enamel chips, and the chips
// are what the player handles: dragged or flicked onto countries to place influence, carried as one
// stack to the country to be overthrown, spent one at a time on realignment rolls. Dice come out of
// a leather cup that is shaken by holding it and thrown by letting go, and the sum is laid out as
// pieces against a brass bar rather than written as arithmetic. The opponent's chips are red and
// come down from the top of the screen; their cup throws onto the same tray.
import './07-chips.css';
import { basePresenter, carryLine, choiceList, decision, describe, playLine, ICON } from '../core/base.js';
import { MODE_NAME, ABORT } from '../core/game.js';

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const pipFace = (n) => `<i class="ms-face">${Array.from({ length: 9 }, (_, i) => `<u${PIPS[n].includes(i) ? ' class="on"' : ''}></u>`).join('')}</i>`;

export default {
  id: '07',
  name: '筹码与骰盅',
  ref: '实体桌游的手感',
  idea: '行动点兑成一叠筹码，拖到国家上就是放置、整叠压上去就是政变；骰子装在骰盅里，按住摇、松手掷，结果用筹码和铜尺比长短。',
  notes: {
    choose: '牌来到下方正中。左边是一个牌位：把牌推上去就是事件，上面写明会发生什么。右边是这张牌兑出的一叠蓝筹码和四个托盘（放置 / 调整 / 政变 / 太空），把筹码放进哪个托盘就是哪种行动；不能用的托盘暗着并写明原因。',
    target: '放置：从筹码堆拖一枚到亮起的国家，或直接点国家，筹码飞过去立在节点旁；对手控制的国家一次吃两枚。把节点旁的筹码拖回来或按退格就是撤销。政变：把整叠拖到（或点）目标国。调整：每掷一次花一枚。',
    dice: '骰盅在下方：按住它（或按住空格）摇，按得越久摇得越凶，松手掷出；单击则短摇一下就掷。骰子弹过皮垫停下，然后骰点和筹码一格一格排在铜尺上方，超出铜尺的那一截就是净值。',
    guide: '失去的影响力是对方筹码从节点上被打飞；得到的是筹码落上去。核危机、军事行动、胜利点、太空竞赛则有一枚铜币从出事的地方弧线飞到那个刻度，在上面敲出一块铜牌“核危机 4 → 3”。',
    opponent: '对手的筹码是红色，从屏幕上方他的手牌下一枚一枚落到国家上；他的骰盅在上方正中自己摇、自己掷，骰子飞过地图落在同一块皮垫上，用同一把铜尺量。',
  },
  pros: ['点数是看得见、数得清的东西，“还剩几点”不用读数字', '摇骰是自己动手的，输赢更有分量', '铜尺把“骰子 + 行动点 对 稳定度×2”变成比长短，不用心算', '对手的动作同样是筹码和骰子，一眼能看懂他在干什么'],
  cons: ['拖拽比点击慢，熟手打多了会嫌累（所以每一步都保留了点击和键盘）', '底部一条被托盘和皮垫占用，行动期间看不到手牌', '实物感的东西多，动画时间比别的方案长'],

  mount(ctx) {
    const base = basePresenter(ctx);
    const { fx, board, hand, hud, cards, layer, G, signal } = ctx;
    const wait = fx.wait;
    const el = fx.el;
    const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
    const toLayer = (p) => {
      const b = layer.getBoundingClientRect();
      return { x: p.x - b.left, y: p.y - b.top };
    };
    const mid = (r) => toLayer({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    const at = (id) => {
      const p = board.at(id);
      return p ? toLayer(p) : null;
    };
    const put = (n, p) => {
      n.style.left = p.x + 'px';
      n.style.top = p.y + 'px';
    };
    const pos = (n) => ({ x: parseFloat(n.style.left) || 0, y: parseFloat(n.style.top) || 0 });
    const side = (s) => (s === 0 ? 'a' : 'b');

    /* ------------------------------------------------------------------ chips */
    function chip(cls, p) {
      const n = el('i', `ch ${cls}`);
      if (p) put(n, p);
      layer.appendChild(n);
      return n;
    }
    /** Moves a chip (or anything placed by its centre) along a low arc. Resolves when it lands. */
    function fly(n, to, { ms = 380, lift = 46, spin = 0, scale = 1 } = {}) {
      const from = pos(n);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const k = Math.min(1, Math.hypot(dx, dy) / 300);
      const a = n.animate(
        [
          { transform: 'translate(-50%, -50%) translate(0, 0) rotate(0deg) scale(1)' },
          { transform: `translate(-50%, -50%) translate(${dx / 2}px, ${dy / 2 - lift * k}px) rotate(${spin / 2}deg) scale(${1 + 0.25 * k})`, offset: 0.5 },
          { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(${spin}deg) scale(${scale})` },
        ],
        { duration: ms, easing: 'cubic-bezier(0.4, 0.1, 0.3, 1)', fill: 'forwards' },
      );
      return a.finished.then(
        () => {
          put(n, to);
          a.cancel();
        },
        () => {},
      );
    }
    /** A chip knocked off a node: up and out, then down off the table. */
    function knock(p, cls, i) {
      const n = chip(`${cls} is-loose`, p);
      const dir = (i % 2 ? 1 : -1) * (0.6 + Math.random() * 0.8);
      const a = n.animate(
        [
          { transform: 'translate(-50%, -50%) translate(0, 0) rotate(0deg)', opacity: 1 },
          { transform: `translate(-50%, -50%) translate(${dir * 46}px, -58px) rotate(${dir * 220}deg)`, opacity: 1, offset: 0.32, easing: 'cubic-bezier(0.5, 0, 0.9, 0.4)' },
          { transform: `translate(-50%, -50%) translate(${dir * 120}px, 190px) rotate(${dir * 620}deg)`, opacity: 0 },
        ],
        { duration: 900 + i * 60, delay: i * 70, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)', fill: 'both' },
      );
      a.finished.then(() => n.remove(), () => n.remove());
    }
    /** The little pile shown beside a node for chips that are sitting on it. */
    const sitting = (id, n, cls) => board.badge(id, 'chips', n > 0 ? `${'<i></i>'.repeat(Math.min(n, 4))}<b>${n}</b>` : null, cls);

    /* ------------------------------------------------------------------ the purse: a card's points as a stack */
    let purse = null;
    function makePurse(by, count) {
      purse?.destroy();
      const u = rem();
      const box = layer.getBoundingClientRect();
      const home = by === 0 ? { x: 47 * u, y: box.height - 8.2 * u } : { x: 45.5 * u, y: 9.6 * u };
      const pad = el('div', `pu-pad ${side(by)}`, `<span>行动点</span><b>${count}</b>`);
      put(pad, home);
      layer.appendChild(pad);
      const chips = [];
      const slot = (i) => ({ x: home.x + ((i * 7) % 5) - 2, y: home.y - 0.9 * u - i * 0.55 * u });
      const label = () => (pad.querySelector('b').textContent = String(chips.length));
      for (let i = 0; i < count; i++) {
        const c = chip(`${side(by)} in-purse`, slot(i));
        c.style.zIndex = String(20 + i);
        c.animate([{ transform: 'translate(-50%, -50%) translateY(-3rem) scale(0.6)', opacity: 0 }, { transform: 'translate(-50%, -50%)', opacity: 1 }], { duration: 260, delay: i * 70, easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)', fill: 'backwards' });
        chips.push(c);
      }
      const p = {
        by, pad, chips, home,
        get count() {
          return chips.length;
        },
        top: () => chips[chips.length - 1] ?? null,
        /** Takes the top chip off the stack; it stays on screen for the caller to move. */
        take() {
          const c = chips.pop();
          if (c) {
            c.classList.remove('in-purse');
            c.style.zIndex = '60';
          }
          label();
          return c ?? null;
        },
        /** Puts a chip back on the stack, flying it home. */
        async give(c) {
          const i = chips.length;
          chips.push(c);
          label();
          c.style.zIndex = String(20 + i);
          await fly(c, slot(i), { ms: 300 });
          c.classList.add('in-purse');
        },
        /** A new chip appearing at a point (one that had been placed) and returning to the stack. */
        back(from) {
          return p.give(chip(side(by), from));
        },
        destroy() {
          pad.remove();
          for (const c of chips) c.remove();
          chips.length = 0;
          if (purse === p) purse = null;
        },
      };
      purse = p;
      return p;
    }

    /* ------------------------------------------------------------------ the note: what is asked, in a brass-edged slip */
    const note = el('div', 'nt');
    note.hidden = true;
    layer.appendChild(note);
    let offNoteKeys = null;
    const N = {
      set({ who = '', by = 0, title = '', text = '', buttons = [] }) {
        note.hidden = false;
        note.className = `nt ${side(by)}`;
        note.innerHTML = `<b class="nt-who">${who}</b><span class="nt-title">${title}</span><span class="nt-text"></span><span class="nt-btns"></span>`;
        N.say(text);
        offNoteKeys?.();
        const map = {};
        for (const b of buttons) {
          const n = el('button', b.primary ? 'primary' : '', `${b.label}${b.key ? `<kbd>${b.keyLabel ?? b.key}</kbd>` : ''}`);
          n.type = 'button';
          n.addEventListener('click', () => b.on());
          note.querySelector('.nt-btns').appendChild(n);
          if (b.key) map[b.key] = b.on;
        }
        offNoteKeys = ctx.keys(map);
      },
      say(html, cls = '') {
        const t = note.querySelector('.nt-text');
        if (!t) return;
        t.className = `nt-text ${cls}`;
        t.innerHTML = html;
      },
      hide() {
        note.hidden = true;
        offNoteKeys?.();
        offNoteKeys = null;
      },
    };

    /* ------------------------------------------------------------------ dragging */
    let lastDrag = 0;
    /** Follows the pointer with an element placed by its centre, from a pointerdown until release. */
    function drag(e, n, onDrop) {
      e.preventDefault();
      e.stopPropagation();
      n.classList.add('is-drag');
      const start = { x: e.clientX, y: e.clientY };
      let moved = false;
      const move = (ev) => {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 5) moved = true;
        put(n, toLayer({ x: ev.clientX, y: ev.clientY }));
        const id = board.countryAt(ev.clientX, ev.clientY);
        layer.classList.toggle('over-ok', !!id && !!board.el(id)?.classList.contains('cp-ok'));
      };
      const up = (ev) => {
        window.removeEventListener('pointermove', move, true);
        window.removeEventListener('pointerup', up, true);
        window.removeEventListener('pointercancel', up, true);
        n.classList.remove('is-drag');
        layer.classList.remove('over-ok');
        lastDrag = performance.now();
        onDrop(ev.type === 'pointerup' ? { x: ev.clientX, y: ev.clientY, moved, id: board.countryAt(ev.clientX, ev.clientY) } : null);
      };
      window.addEventListener('pointermove', move, true);
      window.addEventListener('pointerup', up, true);
      window.addEventListener('pointercancel', up, true);
      signal.addEventListener('abort', () => up({ type: 'pointercancel' }), { once: true });
    }

    /* ------------------------------------------------------------------ choosing: a card slot for the event, trays for the chips */
    let cx = null;
    function closeChoice() {
      cx?.remove();
      cx = null;
      board.mark(null);
    }
    /** Resolves with a choice key, or null if the card is taken back. */
    async function openChoice(no, from, { headline = false } = {}) {
      closeChoice();
      hand.away(true);
      const ch = choiceList(ctx, no);
      const c = ch.card;
      const ev = ch.byKey.event;
      const d = deferred();
      cx = el('div', `cx ${headline ? 'is-headline' : ''}`);
      const lines = ev.lines.map((l) => `<li class="${l.warn ? 'warn' : ''}${l.lethal ? ' lethal' : ''}">${l.warn ? ICON.warn : ''}<span>${l.text}</span></li>`).join('');
      const theirs = ch.fires && !headline;
      const evOk = ev.ok || headline;
      const tray = (o) =>
        `<button type="button" class="cx-tray ${o.ok ? '' : 'is-off'}" data-key="${o.key}" ${o.ok ? '' : 'disabled'}>` +
        `<i class="cx-well"></i><span class="cx-name"><i class="cx-ic">${ICON[o.key]}</i>${o.label.replace('影响力', '').replace('阵营', '').replace('竞赛', '')}<kbd>${o.hot.toUpperCase()}</kbd></span>` +
        `<span class="cx-sub">${o.ok ? o.sub.replace(/^弃掉这张牌 · /, '') : o.why}</span>` +
        `${o.ok && o.risk ? `<span class="cx-risk">${ICON.warn}战场国降核危机</span>` : ''}${o.ok && o.safe ? '<span class="cx-safe">躲开对手事件</span>' : ''}</button>`;
      cx.innerHTML =
        `<button type="button" class="cx-event ${theirs ? 'is-theirs' : evOk ? '' : 'is-off'}" data-key="event" ${evOk ? '' : 'disabled'}>` +
        `<span class="cx-h">${headline ? '作为头条打出' : theirs ? '苏联的事件' : '作为事件打出'}${evOk ? `<kbd>${headline ? '↵' : 'E'}</kbd>` : ''}</span>` +
        `<ul class="cx-lines">${lines}</ul>` +
        `<p class="cx-foot ${theirs ? 'bad' : ''}">${theirs ? '这是对手的牌：筹码花完以后，它的事件照样发生。只有太空竞赛能躲开。' : headline ? '头条只能作为事件 · 数值高的先结算' : `把牌推上这个牌位 · ${ev.sub}`}</p><i class="cx-slot"></i></button>` +
        '<div class="cx-card"><div class="cx-cardslot"></div><button type="button" class="cx-back">' +
        `${headline ? '换一张' : '收回'}<kbd>Esc</kbd></button></div>` +
        (headline
          ? '<div class="cx-cash is-note"><span class="cx-h">头条阶段</span><p>双方各暗出一张牌，同时翻开，都作为事件发生。</p><p class="cx-foot">头条的牌不兑筹码。</p></div>'
          : `<div class="cx-cash"><span class="cx-h">兑成<b>${ch.points}</b>枚筹码<small>放进一个托盘</small></span><div class="cx-row"><div class="cx-stack"></div>${ch.list.slice(1).map(tray).join('')}</div></div>`);
      layer.appendChild(cx);
      const slot = cx.querySelector('.cx-cardslot');
      const to = slot.getBoundingClientRect();
      if (from) await cards.flyNo(no, from, { left: to.left, top: to.top, width: to.width, height: to.width * 1.4 }, { duration: 320 });
      const cardEl = cards.put(no, slot);
      // the card's points, as chips, waiting beside it
      const stack = cx.querySelector('.cx-stack');
      const chips = [];
      if (stack)
        for (let i = 0; i < ch.points; i++) {
          const n = el('i', 'ch a');
          n.style.setProperty('--i', i);
          stack.appendChild(n);
          chips.push(n);
        }
      const keymap = { escape: () => d.resolve(null) };
      for (const b of cx.querySelectorAll('[data-key]')) {
        const o = ch.byKey[b.dataset.key];
        if (b.disabled) continue;
        b.addEventListener('click', () => d.resolve(o.key));
        keymap[headline ? 'enter' : o.hot] = () => d.resolve(o.key);
        if (o.mark) {
          b.addEventListener('pointerenter', () => board.mark(o.mark));
          b.addEventListener('pointerleave', () => board.mark(null));
        }
      }
      cx.querySelector('.cx-back').addEventListener('click', () => d.resolve(null));
      const off = ctx.keys(keymap);
      const key = await d.promise;
      off();
      board.mark(null);
      if (key === 'event') {
        // the card is pushed forward onto its place
        const s = cx.querySelector('.cx-slot').getBoundingClientRect();
        const r = cardEl.getBoundingClientRect();
        cx.classList.add('is-chosen');
        await cardEl.animate([{ transform: 'none' }, { transform: `translate(${s.left + s.width / 2 - (r.left + r.width / 2)}px, ${s.top + s.height / 2 - (r.top + r.height / 2)}px) scale(${s.width / r.width})` }], { duration: 300, easing: 'cubic-bezier(0.3, 0.8, 0.3, 1)', fill: 'forwards' }).finished;
        await wait(160);
      } else if (key) {
        // the chips drop into the chosen tray
        const well = cx.querySelector(`.cx-tray[data-key="${key}"] .cx-well`).getBoundingClientRect();
        cx.classList.add('is-chosen');
        cx.querySelector(`.cx-tray[data-key="${key}"]`).classList.add('is-picked');
        await Promise.all(
          chips.map((n, i) => {
            const r = n.getBoundingClientRect();
            return n.animate(
              [
                { transform: 'translate(0, 0)' },
                { transform: `translate(${(well.left + well.width / 2 - (r.left + r.width / 2)) / 2}px, ${(well.top - r.top) / 2 - 40}px) scale(1.15)`, offset: 0.5 },
                { transform: `translate(${well.left + well.width / 2 - (r.left + r.width / 2) + (i - (chips.length - 1) / 2) * 7}px, ${well.top + well.height / 2 - (r.top + r.height / 2)}px)` },
              ],
              { duration: 300, delay: i * 70, easing: 'ease-in-out', fill: 'forwards' },
            ).finished;
          }),
        );
        await wait(200);
      }
      return { key, rect: cardEl.getBoundingClientRect() };
    }

    /* ------------------------------------------------------------------ the dice table: cup, leather tray, brass measure */
    let dc = null;
    let oppCup = null;
    function closeDice() {
      dc?.classList.add('is-out');
      const a = dc;
      const b = oppCup;
      dc = null;
      oppCup = null;
      b?.remove();
      for (const n of layer.querySelectorAll('.dc-die')) n.remove();
      setTimeout(() => a?.remove(), 280);
    }
    function openDice(spec) {
      closeDice();
      dc = el('div', `dc k-${spec.kind}`);
      dc.innerHTML =
        '<div class="dc-seat"><div class="dc-cup"><i class="dc-cup-in"></i><i class="dc-cup-body"></i><i class="dc-cup-band"></i></div><span class="dc-hint"></span></div>' +
        '<div class="dc-tray"><i class="dc-stitch"></i><div class="dc-marks"></div></div>' +
        '<div class="dc-measure"></div>';
      layer.appendChild(dc);
      if (spec.kind === 'space') dc.querySelector('.dc-marks').innerHTML = spec.table.map((t) => `<i class="${t.ok ? 'ok' : ''}" data-n="${t.roll}">${t.roll}</i>`).join('') + `<span>掷出 1–${spec.max} 前进一步</span>`;
      return dc;
    }

    /**
     * The cup is shaken and then thrown. The player's own: hold it (or hold Space / Enter) to shake,
     * let go to throw; a short press shakes briefly by itself. The opponent's shakes on its own.
     */
    async function shake(cup, interactive) {
      const amp = (v) => cup.style.setProperty('--amp', v.toFixed(2));
      if (!interactive) {
        cup.classList.add('is-shaking');
        for (let i = 0; i <= 6; i++) {
          amp(0.35 + i * 0.1);
          await wait(130);
        }
        return;
      }
      const hint = dc.querySelector('.dc-hint');
      hint.innerHTML = '按住摇 · 松手掷<kbd>空格</kbd>';
      cup.classList.add('is-ready');
      const pressed = deferred();
      const released = deferred();
      let t0 = 0;
      let raf = 0;
      const down = (e) => {
        if (t0) return;
        e?.preventDefault?.();
        t0 = performance.now();
        cup.classList.remove('is-ready');
        cup.classList.add('is-shaking');
        hint.textContent = '松手掷出';
        const grow = () => {
          amp(Math.min(1.25, 0.3 + (performance.now() - t0) / 1300));
          raf = requestAnimationFrame(grow);
        };
        grow();
        pressed.resolve();
      };
      const up = () => t0 && released.resolve();
      const keyup = (e) => (e.key === ' ' || e.key === 'Enter') && up();
      cup.addEventListener('pointerdown', down);
      window.addEventListener('pointerup', up);
      window.addEventListener('keyup', keyup);
      const offKeys = ctx.keys({ ' ': down, enter: down });
      const abort = new Promise((_, rej) => signal.addEventListener('abort', () => rej(ABORT), { once: true }));
      try {
        await Promise.race([pressed.promise, abort]);
        await Promise.race([released.promise, abort]);
        // a tap is too short to count as a shake: give it one anyway
        const held = performance.now() - t0;
        if (held < 240) await wait(420);
      } finally {
        cancelAnimationFrame(raf);
        cup.removeEventListener('pointerdown', down);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('keyup', keyup);
        offKeys();
        hint.textContent = '';
      }
    }

    /** A die leaves a cup and comes to rest on the tray at `spot` (0..1 across it). */
    async function throwDie(d, cup, spot, { far = false, high = false } = {}) {
      const die = ctx.makeDie({ side: d.side });
      const wrap = el('div', 'dc-die');
      wrap.appendChild(die.el);
      const from = mid(cup.getBoundingClientRect());
      const tray = dc.querySelector('.dc-tray').getBoundingClientRect();
      const to = toLayer({ x: tray.left + tray.width * spot, y: tray.top + tray.height * (high ? 0.4 : 0.56) });
      put(wrap, from);
      layer.appendChild(wrap);
      cup.classList.remove('is-shaking');
      cup.classList.add('is-thrown');
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const ms = far ? 1350 : 1150;
      const T = (x, y, s = 1) => `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${s})`;
      // out of the cup, down onto the leather short of the mark, two bounces, a slide to rest
      const flight = wrap.animate(
        [
          { transform: T(0, 0, 0.5), opacity: 0.2, easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)' },
          { transform: T(dx * 0.45, Math.min(dy * 0.45, 0) - (far ? 30 : 70), 1.15), opacity: 1, offset: 0.3, easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)' },
          { transform: T(dx * 0.72, dy, 1), offset: 0.52, easing: 'cubic-bezier(0.1, 0.6, 0.4, 1)' },
          { transform: T(dx * 0.86, dy - 26, 1.04), offset: 0.66, easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)' },
          { transform: T(dx * 0.95, dy, 1), offset: 0.8, easing: 'cubic-bezier(0.1, 0.6, 0.4, 1)' },
          { transform: T(dx * 0.98, dy - 7, 1), offset: 0.88, easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)' },
          { transform: T(dx, dy, 1) },
        ],
        { duration: ms, fill: 'forwards' },
      );
      await Promise.all([die.roll(d.value, { ms, turns: 3, settle: 0.28 }), flight.finished.catch(() => {})]);
      put(wrap, to);
      flight.cancel();
      fx.shake(dc.querySelector('.dc-tray'), 3, 200);
      // the opponent's cup has done its work and goes back up
      if (cup.classList.contains('is-opp')) cup.classList.add('is-gone');
      return wrap;
    }

    /** One row of the measure: pieces laid end to end; those past `bar` stick out. units: [{ cls, html, label }] */
    const row = (who, cls, units, bar = Infinity) =>
      `<div class="ms-row ${cls}"><span class="ms-who">${who}</span><div class="ms-units">${units.map((u, i) => `<i class="ms-u ${u.cls}${i >= bar ? ' over' : ''}" style="--i:${i}" title="${u.label ?? ''}">${u.html ?? ''}</i>`).join('')}</div></div>`;
    const dieUnits = (d) => Array.from({ length: d.value }, (_, i) => ({ cls: `pip ${side(d.side)}${i === 0 ? ' first' : ''}`, html: i === 0 ? pipFace(d.value) : '' }));

    /* ------------------------------------------------------------------ the presenter */
    const P = {
      ...base,

      async phase(info) {
        if (info.kind !== 'end') N.hide();
        return base.phase.call(this, info);
      },

      /* ---- headline */
      // the headline needs no table: a card dragged out of the hand is played
      async pickHeadline() {
        const idle = { who: '头条阶段', by: 0, title: '拖出一张牌作头条', text: '松手就打出 · 它会作为事件发生' };
        N.set(idle);
        hand.away(false);
        const pick = await ctx.pickCard({
          click: false,
          onCarry: (no) => N.set({ ...idle, text: carryLine(ctx, no).text }),
          onBack: () => N.set(idle),
        });
        N.hide();
        base.ui.from = pick.rect;
        return pick.no;
      },

      /* ---- the player's decision */
      async decide() {
        for (;;) {
          N.set({ who: '你的行动', by: 0, title: '打出一张牌', text: '点一张手牌，或把它拖出来' });
          hand.away(false);
          hand.live(true);
          const pick = await ctx.pickCard();
          N.hide();
          const got = await openChoice(pick.no, pick.rect);
          closeChoice();
          if (got.key) {
            base.ui.from = got.rect;
            return decision(pick.no, got.key);
          }
          hand.away(false);
          hand.release(pick.no);
        }
      },

      /* ---- a card is played */
      async announce(play) {
        hand.live(false);
        hand.away(play.by === 0);
        board.clearBadges('last');
        closeDice();
        const line = playLine(ctx, play);
        N.set({ who: play.by === 0 ? '你的行动' : '苏联行动', by: play.by, title: `《${play.card.title}》`, text: `${line.what}${line.detail}` });
        if (play.headline) {
          await base.announce.call(this, play);
          return;
        }
        if (play.by === 0) {
          await base.ui.toTable(play.no, base.ui.from);
          base.ui.from = null;
        } else {
          // their card comes down from their hand and is held where it can be read
          const show = el('div', 'oc');
          show.innerHTML = `<div class="oc-card"></div><div class="oc-cap"><b>苏联打出</b><span>${line.what}${line.detail}</span></div>`;
          layer.appendChild(show);
          const c = cards.put(play.no, show.querySelector('.oc-card'));
          await wait(1500);
          const from = c.getBoundingClientRect();
          show.remove();
          await base.ui.toTable(play.no, from);
        }
        if (play.use === 'ops') makePurse(play.by, play.points);
        if (play.target) {
          await board.show(play.target);
          board.big(play.target);
          board.ring(play.target, side(play.by));
          // a coup: their whole stack is carried to the country
          if (play.by === 1 && play.mode === 'coup' && purse) {
            await wait(350);
            const to = at(play.target);
            if (to) await Promise.all(purse.chips.map((c, i) => wait(i * 90).then(() => fly(c, { x: to.x + 34, y: to.y - i * 5 }, { ms: 520, lift: 70 }))));
            sitting(play.target, play.points, 'b');
            purse.destroy();
          }
          await wait(250);
        }
      },

      /* ---- placing influence: chips onto countries */
      async place(session) {
        const done = deferred();
        const p = purse ?? makePurse(0, session.left);
        let queue = Promise.resolve();
        let over = false;
        let flying = 0;
        const counts = () => {
          const m = new Map();
          for (const s of session.spent) m.set(s.id, (m.get(s.id) ?? 0) + s.cost);
          return m;
        };
        const draw = () => {
          if (over) return;
          const t = session.targets();
          const ok = new Map([...t].filter(([, v]) => v.ok));
          const placed = session.spent.map((x) => x.id);
          board.mark({ kind: 'place', ok, lift: placed, keep: placed });
          board.clearBadges('cost');
          board.clearBadges('chips');
          for (const [id, v] of ok) if (v.cost > 1) board.badge(id, 'cost', `${v.cost}`, 'b');
          for (const [id, n] of counts()) sitting(id, n, 'a');
          const none = !session.spent.length;
          N.set({
            who: '你的行动', by: 0, title: MODE_NAME.place,
            text: session.left ? (ok.size ? '拖筹码到亮起的国家，或直接点 · ×2 的吃两枚' : '剩下的筹码哪里都放不了') : '筹码用完了：确认，或拿回来重放',
            buttons: [
              { label: '撤销', key: 'backspace', keyLabel: '⌫', on: () => undo() },
              none ? { label: '收回这张牌', key: 'escape', keyLabel: 'Esc', on: () => done.resolve(false) } : { label: '完成', key: 'enter', keyLabel: '↵', on: () => done.resolve(true), primary: true },
            ],
          });
          arm();
        };
        /** One point of influence goes to a country; `held` is a chip already in the player's hand. */
        const add = (id, held) =>
          (queue = queue.then(async () => {
            const t = session.targets().get(id);
            const to = at(id);
            if (over || !t?.ok || !to) {
              if (held) await p.give(held);
              return;
            }
            const moving = [held ?? p.take()];
            for (let k = 1; k < t.cost; k++) moving.push(p.take());
            flying++;
            await Promise.all(moving.filter(Boolean).map((c, k) => wait(k * 110).then(() => fly(c, { x: to.x + 30, y: to.y - 4 }, { ms: held && k === 0 ? 160 : 340, spin: 180 }))));
            flying--;
            for (const c of moving) c?.remove();
            const e = session.add(id);
            if (!e) return;
            board.pop(id, '+1', 'a');
            board.ring(id, 'a');
            if (e.ctrlTo !== e.ctrlFrom) board.pop(id, e.ctrlTo === 0 ? '美国控制' : '打破控制', 'gold late');
            draw();
          }));
        /** Takes the last placement back out of the game state, or the last one on a given country. */
        const takeBack = (id) => {
          const redo = [];
          let last = session.undo();
          while (id && last && last.id !== id && session.spent.length) {
            redo.unshift(last.id);
            last = session.undo();
          }
          for (const r of redo) session.add(r);
          return last;
        };
        const undo = () =>
          (queue = queue.then(async () => {
            if (over || !session.spent.length) return;
            const last = takeBack();
            const from = at(last.id) ?? p.home;
            draw();
            await Promise.all(Array.from({ length: last.cost }, (_, k) => wait(k * 90).then(() => p.back({ x: from.x + 30, y: from.y - 4 }))));
            arm();
          }));
        // the top chip of the stack can be picked up
        const arm = () => {
          for (const c of p.chips) c.onpointerdown = null;
          const top = p.top();
          if (!top) return;
          top.onpointerdown = (e) => {
            if (e.button !== 0) return;
            const c = p.take();
            drag(e, c, (drop) => {
              if (drop?.id && session.targets().get(drop.id)?.ok) add(drop.id, c);
              else p.give(c).then(arm);
            });
          };
        };
        // a pile sitting on a node can be picked up again: the chip comes away in the hand, and goes
        // back to the stack unless it is set down on another country
        const lift = (e) => {
          const b = e.target instanceof Element ? e.target.closest('.cp-badge-chips') : null;
          const id = b?.closest('.wm-plate')?.dataset.id;
          if (!id || e.button !== 0 || over || flying || !session.count(id)) return;
          const last = takeBack(id);
          if (!last) return;
          const from = at(last.id) ?? p.home;
          draw();
          for (let k = 1; k < last.cost; k++) p.back({ x: from.x + 30, y: from.y - 4 }).then(arm);
          const c = chip('a', toLayer({ x: e.clientX, y: e.clientY }));
          c.style.zIndex = '60';
          drag(e, c, (drop) => {
            if (drop?.id && drop.id !== id && session.targets().get(drop.id)?.ok) add(drop.id, c);
            else p.give(c).then(arm);
          });
        };
        ctx.layer.parentElement.addEventListener('pointerdown', lift, true);
        const offClick = board.onClick((id) => {
          if (id && performance.now() - lastDrag > 120) add(id);
        });
        draw();
        const result = await done.promise;
        over = true;
        await queue;
        offClick();
        ctx.layer.parentElement.removeEventListener('pointerdown', lift, true);
        for (const c of p.chips) c.onpointerdown = null;
        board.mark(null);
        board.clearBadges('cost');
        board.clearBadges('chips');
        N.hide();
        return result;
      },

      /* ---- choosing a country */
      async pickTarget(req) {
        const kind = req.mode;
        const act = deferred();
        const warn = kind === 'coup' ? [...req.targets].filter(([, x]) => x.key).map(([id]) => id) : [];
        board.mark({ kind, ok: req.targets, locked: req.locked, warn });
        for (const [id, x] of req.targets) {
          if (kind === 'coup') board.badge(id, 'need', x.need ? `≥${x.need}` : '✕', x.need ? '' : 'off');
          if (kind === 'realign') board.badge(id, 'need', x.edge > 0 ? `+${x.edge}` : x.edge < 0 ? `−${-x.edge}` : '±0', x.edge > 0 ? 'good' : x.edge < 0 ? 'bad' : '');
        }
        for (const id of req.locked.keys()) board.badge(id, 'lock', ICON.lock);
        const p = kind === 'event' ? null : (purse ?? makePurse(0, kind === 'realign' ? req.left : ctx.card(req.no).value));
        const idle =
          kind === 'coup' ? '把整叠筹码拖到一个国家上，或直接点它' : kind === 'realign' ? `每掷一次花一枚：拖到国家上，或直接点 · 还剩 ${req.left} 枚` : `${req.hint}（${req.total - req.left + 1} / ${req.total}）`;
        const buttons = [];
        if (req.optional) buttons.push({ label: '到此为止', key: 'enter', keyLabel: '↵', on: () => act.resolve(null), primary: true });
        if (req.cancel) buttons.push({ label: '收回这张牌', key: 'escape', keyLabel: 'Esc', on: () => act.resolve(null) });
        N.set({ who: '你的行动', by: 0, title: kind === 'event' ? `《${req.title}》` : MODE_NAME[kind], text: idle, buttons });
        const offHover = board.onHover((id) => {
          if (id && req.locked.has(id)) return N.say(`${ICON.lock}${ctx.name(id)}：${req.locked.get(id)}`, 'bad');
          const x = id && req.targets.get(id);
          if (!x) return N.say(idle);
          if (kind === 'coup') N.say(`${ctx.name(id)}：${x.need ? `掷出 ≥${x.need} 成功（${Math.round(x.chance * 100)}%）` : '筹码不够，不可能成功'}${x.key ? ` · ${ICON.warn}战场国：核危机 ${G.crisis} → ${x.crisisTo}` : ''}`, x.key ? 'warn' : '');
          else if (kind === 'realign') N.say(`${ctx.name(id)}：你的骰子 +${x.mods[0].reduce((a, m) => a + m.n, 0)}，苏联 +${x.mods[1].reduce((a, m) => a + m.n, 0)}`);
          else N.say(idle);
        });
        const offClick = board.onClick((id) => {
          if (id && req.targets.has(id) && performance.now() - lastDrag > 120) act.resolve(id);
        });
        // the stack (a coup) or its top chip (realignment) can be carried to the country
        let carried = null;
        if (p && kind === 'coup') {
          p.pad.classList.add('is-grab');
          const grab = (e) => {
            if (e.button !== 0) return;
            const group = el('div', 'pu-carry');
            put(group, toLayer({ x: e.clientX, y: e.clientY }));
            layer.appendChild(group);
            for (const [i, c] of p.chips.entries()) {
              c.style.visibility = 'hidden';
              const g = el('i', 'ch a');
              g.style.setProperty('--i', i);
              group.appendChild(g);
            }
            drag(e, group, (drop) => {
              group.remove();
              const hit = drop?.id && req.targets.has(drop.id);
              if (hit) for (const c of p.chips) put(c, toLayer(drop));
              for (const c of p.chips) c.style.visibility = '';
              if (hit) {
                carried = true;
                act.resolve(drop.id);
              }
            });
          };
          p.pad.onpointerdown = grab;
          for (const c of p.chips) c.onpointerdown = grab;
        } else if (p && kind === 'realign' && p.top()) {
          p.top().onpointerdown = (e) => {
            if (e.button !== 0) return;
            const c = p.take();
            drag(e, c, (drop) => {
              if (drop?.id && req.targets.has(drop.id)) {
                carried = c;
                act.resolve(drop.id);
              } else p.give(c);
            });
          };
        }
        const id = await act.promise;
        offHover();
        offClick();
        if (p) {
          p.pad.onpointerdown = null;
          p.pad.classList.remove('is-grab');
          for (const c of p.chips) c.onpointerdown = null;
        }
        board.clearBadges('need');
        board.clearBadges('lock');
        board.mark(null);
        if (!id) {
          N.hide();
          return null;
        }
        board.big(id);
        board.ring(id, 'a');
        const to = at(id);
        if (p && to && kind === 'coup') {
          // the whole stack goes to the country and waits there for the dice
          const n = p.count;
          await Promise.all(p.chips.map((c, i) => wait(i * 70).then(() => fly(c, { x: to.x + 34, y: to.y - i * 5 }, { ms: carried ? 180 : 460, lift: 70 }))));
          sitting(id, n, 'a');
          p.destroy();
        } else if (p && to && kind === 'realign') {
          const c = carried instanceof Element ? carried : p.take();
          if (c) {
            await fly(c, { x: to.x + 30, y: to.y - 4 }, { ms: carried ? 160 : 380, spin: 180 });
            c.remove();
            sitting(id, 1, 'a');
          }
        }
        return id;
      },

      /* ---- dice */
      async roll(spec) {
        hand.away(true);
        if (spec.id) {
          await board.show(spec.id);
          board.big(spec.id);
        }
        const mine = spec.by === 0;
        const panel = openDice(spec);
        const myCup = panel.querySelector('.dc-cup');
        const title = spec.kind === 'space' ? MODE_NAME.space : `${MODE_NAME[spec.kind]} · ${ctx.name(spec.id)}`;
        N.set({ who: mine ? '你的行动' : '苏联行动', by: spec.by, title, text: spec.kind === 'coup' ? (spec.need ? `要掷出 ≥${spec.need}（${Math.round(spec.chance * 100)}%）` : '不可能成功') : spec.kind === 'space' ? `掷出 1–${spec.max} 成功` : '点数高的一方胜出，输家移除差额' });
        const measure = panel.querySelector('.dc-measure');
        // the opponent throws from a cup of their own, up under their hand
        const theirCup = () => {
          oppCup = el('div', 'dc-cup b is-opp', '<i class="dc-cup-in"></i><i class="dc-cup-body"></i><i class="dc-cup-band"></i>');
          layer.appendChild(oppCup);
          return oppCup;
        };
        let good;
        if (spec.kind === 'realign') {
          if (!mine && purse?.count && spec.id) {
            const c = purse.take();
            const to = at(spec.id);
            if (to) await fly(c, { x: to.x + 30, y: to.y - 4 }, { ms: 520, lift: 80, spin: 180 });
            c.remove();
            sitting(spec.id, 1, 'b');
          }
          // blue from below, red from above, both at once
          const cupB = theirCup();
          myCup.classList.add('a');
          await Promise.all([shake(myCup, false), shake(cupB, false)]);
          await Promise.all([throwDie(spec.dice[0], myCup, 0.33), throwDie(spec.dice[1], cupB, 0.67, { far: true })]);
          const units = (d) => [...dieUnits(d), ...d.mods.flatMap((m) => Array.from({ length: m.n }, () => ({ cls: `mod ${side(d.side)}`, label: m.label })))];
          const diff = spec.dice[0].total - spec.dice[1].total;
          const short = Math.min(spec.dice[0].total, spec.dice[1].total);
          measure.innerHTML =
            row('美', 'a', units(spec.dice[0]), short) +
            row('苏', 'b', units(spec.dice[1]), short) +
            `<div class="ms-notes">${[0, 1].map((s) => `<span class="${side(s)}">${spec.dice[s].mods.length ? spec.dice[s].mods.map((m) => `+${m.n} ${m.label}`).join('　') : '没有加值'}</span>`).join('')}</div>` +
            `<div class="ms-out">${spec.dice[0].total} 对 ${spec.dice[1].total}${diff ? `，长出 ${Math.abs(diff)} 格` : ''}</div>`;
          good = spec.winner === null ? 'even' : spec.winner === 0 ? 'good' : 'bad';
          measure.classList.add('is-two');
        } else {
          const cup = mine ? myCup : theirCup();
          if (mine) myCup.classList.add('a');
          else myCup.closest('.dc-seat').classList.add('is-empty');
          await shake(cup, mine);
          await throwDie(spec.dice[0], cup, 0.5, { far: !mine, high: spec.kind === 'space' });
          const d = spec.dice[0];
          if (spec.kind === 'coup') {
            const ops = d.mods[0].n;
            measure.innerHTML =
              row(mine ? '你' : '苏', side(d.side), [...dieUnits(d), ...Array.from({ length: ops }, () => ({ cls: `chipu ${side(d.side)}`, label: '行动点' }))], spec.bar.n) +
              `<div class="ms-row bar"><span class="ms-who">尺</span><div class="ms-units"><i class="ms-bar" style="--n:${spec.bar.n}"><b>${spec.bar.label}</b></i></div></div>` +
              `<div class="ms-out">骰 ${d.value} ＋ 筹码 ${ops} ＝ ${d.total}，铜尺 ${spec.bar.n}${d.total > spec.bar.n ? `，长出 <b>${d.total - spec.bar.n}</b> 格` : '，没有长出来'}</div>`;
          } else {
            panel.querySelector(`.dc-marks i[data-n="${d.value}"]`)?.classList.add('is-hit');
            measure.innerHTML = `<div class="ms-out">掷出 <b>${d.value}</b>，${spec.ok ? `在 1–${spec.max} 之内` : `超过了 ${spec.max}`}</div>`;
          }
          good = spec.ok === mine ? 'good' : 'bad';
        }
        measure.classList.add('is-in');
        const total = Math.max(...spec.dice.map((d) => d.total));
        await wait(260 + total * 70);
        measure.classList.add('is-read');
        await wait(350);
        measure.insertAdjacentHTML('beforeend', `<div class="ms-verdict ${good}">${spec.text}</div>`);
        N.say(spec.text, good === 'bad' ? 'bad' : '');
        await wait(1300);
        // the chips that were waiting on the node have been spent
        if (spec.id) sitting(spec.id, 0);
        panel.classList.add('is-spent');
      },

      /* ---- one consequence */
      async step(e, commit, cause) {
        const d = describe(ctx, e);
        N.say(d.text + (d.why ? `<small>${d.why}</small>` : ''), d.cls === 'note' ? '' : d.cls);
        if (e.t === 'inf') {
          await board.show(e.id);
          board.big(e.id);
          const to = at(e.id);
          if (e.d < 0) {
            // their chips are knocked off the node
            board.ring(e.id, 'bad');
            await wait(180);
            commit();
            if (to) for (let i = 0; i < Math.min(-e.d, 6); i++) knock({ x: to.x + (i - 1) * 9, y: to.y - 6 }, d.cls, i);
            board.pop(e.id, d.short, d.cls);
            fx.shake(board.el(e.id), 4, 260);
          } else if (to) {
            // chips land on it: from the opponent's stack when they are placing, from above otherwise
            const n = Math.min(e.d, 6);
            const fromPurse = cause?.kind === 'place' && purse?.by === e.side;
            const landing = Array.from({ length: n }, (_, i) => {
              const c = (fromPurse && purse.take()) || chip(d.cls, { x: to.x + (i - (n - 1) / 2) * 16, y: to.y - 150 - i * 18 });
              return wait(i * 130).then(() => fly(c, { x: to.x + (i - (n - 1) / 2) * 8, y: to.y - 3 }, { ms: fromPurse ? 560 : 300, lift: fromPurse ? 90 : 0, spin: 160 })).then(() => {
                c.classList.add('is-landed');
                setTimeout(() => c.remove(), 420);
              });
            });
            await landing[0];
            commit();
            board.ring(e.id, d.cls);
            board.pop(e.id, d.short, d.cls);
            await Promise.all(landing);
          } else commit();
          if (d.took) board.pop(e.id, d.took.replace(' · ', ''), 'gold late');
          if (cause?.by === 1) board.badge(e.id, 'last', d.short, d.cls);
          await wait(850);
        } else if (d.meter) {
          const meter = hud.el(d.meter);
          const r = meter.getBoundingClientRect();
          const from = (cause?.id && at(cause.id)) || mid(hud.rect('played'));
          const coin = chip(`brass ${d.cls}`, from);
          coin.style.zIndex = '90';
          await fly(coin, mid(r), { ms: 720, lift: 150, spin: 540, scale: 1.2 });
          commit();
          coin.classList.add('is-struck');
          setTimeout(() => coin.remove(), 420);
          // the meter is struck with a brass tag
          for (const old of layer.querySelectorAll('.bt')) old.remove();
          const tag = el('div', `bt ${d.cls}`, `<b>${d.text}</b>${d.why ? `<small>${d.why}</small>` : ''}`);
          const b = layer.getBoundingClientRect();
          const pane = (hud.pane(d.meter) ?? meter).getBoundingClientRect();
          Object.assign(tag.style, { left: pane.left - b.left + 'px', top: r.top - b.top + r.height / 2 + 'px' });
          layer.appendChild(tag);
          fx.flash(meter, { cls: d.cls, ms: 2300 });
          const crisis = e.t === 'crisis' && e.d < 0;
          fx.shake(hud.pane(d.meter) ?? meter, crisis ? 7 : 3, crisis ? 520 : 260);
          setTimeout(() => tag.classList.add('is-out'), 2500);
          setTimeout(() => tag.remove(), 3000);
          await wait(e.t === 'crisis' ? 1800 : 1200);
        } else {
          if (e.id) board.pop(e.id, '—', 'note');
          commit();
          await wait(1100);
        }
      },

      async trigger(play) {
        closeDice();
        N.set({ who: '苏联事件', by: 1, title: `《${play.card.title}》`, text: '你花掉了对手这张牌的筹码：它的事件现在发生' });
        fx.flash(hud.el('played'), { cls: 'b', ms: 1200, label: '事件触发', place: 'above' });
        await wait(1300);
      },

      async settle(play) {
        closeDice();
        closeChoice();
        purse?.destroy();
        board.clearBadges('chips');
        N.hide();
        await base.settle.call(this, play);
        hand.away(false);
      },

      destroy() {
        offNoteKeys?.();
        base.destroy();
      },
    };
    return P;
  },
};
