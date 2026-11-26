// What a variant is asked to do, and a plain, complete way of doing each thing. A variant starts
// from this and replaces the parts that make it what it is:
//
//   import { basePresenter } from '../core/base.js';
//   export default { id: '02', name: '…', mount(ctx) {
//     const base = basePresenter(ctx);
//     return { ...base, async decide() { … }, async roll(spec) { … } };
//   } };
//
// The director (game.js) calls these, always awaiting the result. Both sides' moves go through the
// same calls: `play.by` or `cause.by` is 0 for the player and 1 for the opponent, so whatever a
// variant does to make a change visible it does for the opponent's changes too.
//
//   phase({ kind: 'headline' | 'round' | 'end', round, who, why })     a new phase or move begins
//   pickHeadline() -> no                         the player drags a card out: that is the headline,
//                                                with nothing to confirm (ctx.pickCard({ click: false }))
//   showHeadline({ mine, theirs, order })        both headline cards are turned over
//   decide() -> { no, use: 'event' | 'ops' | 'space', mode?: 'place' | 'realign' | 'coup', target? }
//                                                the player's whole decision for this action round
//   announce(play)                               a card has been played: say by whom and for what
//   place(session, play) -> true | false         the player spends points placing influence;
//                                                false = backed out with nothing placed
//   pickTarget(req) -> id | null                 the player chooses a country (coup, realignment,
//                                                an event that needs one); null = stop / back out
//   roll(spec)                                   dice: spec.dice[], spec.table, spec.ok, spec.text
//   step(effect, commit, cause)                  one consequence. Call commit() at the moment the
//                                                board / the meters should show it.
//   trigger(play)                                the opponent's event goes off after the player
//                                                used their card for operations
//   settle(play)                                 the card leaves the table (play.cancelled: back
//                                                to the hand)
//
// ctx is described in main.js (makeCtx). choiceList() below turns the rules' answer about a card
// into five ready-worded choices, each with the countries to preview; most variants want it.
//
// A variant that replaces decide() should set base.ui.from to the rectangle its card is shown in, so
// that announce() can fly the card from there to the table. Inside a replaced method, the plain
// version is still there to call: base.step.call(this, effect, commit, cause).
import { MODE_NAME, SIDE_NAME } from './game.js';
import { makeDie } from './dice.js';

export const ICON = {
  event: '<svg viewBox="0 0 24 24"><path d="M13.5 2 5 13.5h5.2L9.6 22 19 9.8h-5.6z"/></svg>',
  place: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 7.6v8.8M7.6 12h8.8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  realign: '<svg viewBox="0 0 24 24"><path d="M4 8.5h13l-3.2-3.3M20 15.5H7l3.2 3.3" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  coup: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/><circle cx="12" cy="12" r="1.7"/></svg>',
  space: '<svg viewBox="0 0 24 24"><path d="M12 2c3 2.6 4.4 6 4.4 9.6 0 2-.5 3.7-1.2 5H8.8c-.7-1.3-1.2-3-1.2-5C7.600 8 9 4.6 12 2zM7.4 13.200 4.5 16v3.6l3.6-1.700M16.6 13.200 19.500 16v3.6l-3.6-1.700M10.300 18.600h3.4l-.6 3.400h-2.200z"/><circle cx="12" cy="9.300" r="1.800" fill="#1b1510"/></svg>',
  warn: '<svg viewBox="0 0 24 24"><path d="M12 2.800 22.500 20.500h-21z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 9.500v5.200" stroke="currentColor" stroke-width="2.400" stroke-linecap="round"/><circle cx="12" cy="17.600" r="1.300"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10.500" width="14" height="10" rx="2"/><path d="M8 10.500V7.800a4 4 0 0 1 8 0v2.700" fill="none" stroke="currentColor" stroke-width="2.200"/></svg>',
};

export const KEYS = { event: 'e', place: 'z', realign: 'x', coup: 'c', space: 'v' };

/**
 * The five things that can be done with a card, worded for the player.
 * Each: { key, hot, label, ok, sub, why, lines?, theirs?, lethal?, mark? }.
 * `mark` is what to hand to board.mark() to show where the choice could be carried out.
 */
export function choiceList(ctx, no) {
  const o = ctx.options(no);
  const c = o.card;
  const keyIds = (t) => [...t.keys()].filter((id) => ctx.country(id).key);
  const list = [
    {
      key: 'event', hot: KEYS.event, label: '事件', ok: o.event.ok, lines: o.event.lines, theirs: o.fires, lethal: o.event.lethal,
      sub: c.once ? '一次性：之后移出游戏' : '之后进弃牌堆',
      why: o.fires ? '对手的事件：你不能主动发动它' : '',
    },
    { key: 'place', hot: KEYS.place, label: MODE_NAME.place, ok: o.place.ok, sub: `${o.points} 点 · ${o.place.targets.size} 国可放`, mark: { kind: 'place', ok: o.place.targets } },
    {
      key: 'realign', hot: KEYS.realign, label: MODE_NAME.realign, ok: o.realign.ok, why: o.realign.why,
      sub: `掷 ${o.points} 次 · ${o.realign.targets.size} 国可选`,
      mark: { kind: 'realign', ok: o.realign.targets, locked: o.realign.locked },
    },
    {
      key: 'coup', hot: KEYS.coup, label: MODE_NAME.coup, ok: o.coup.ok, why: o.coup.why,
      sub: `${o.coup.targets.size} 国可选`, risk: keyIds(o.coup.targets).length ? '战场国会让核危机降一级' : '',
      mark: { kind: 'coup', ok: o.coup.targets, locked: o.coup.locked, warn: keyIds(o.coup.targets) },
    },
    { key: 'space', hot: KEYS.space, label: MODE_NAME.space, ok: o.space.ok, why: o.space.why, sub: o.space.ok ? `弃掉这张牌 · 掷出 1–${o.space.max} 前进` : '', safe: o.fires },
  ];
  return { card: c, points: o.points, fires: o.fires, options: o, list, byKey: Object.fromEntries(list.map((x) => [x.key, x])) };
}

/** What a card's event will do, in one line, for a prompt shown while the card is being carried. */
export function carryLine(ctx, no) {
  const ch = choiceList(ctx, no);
  const ev = ch.byKey.event;
  return {
    text: `《${ch.card.title}》${ch.fires ? '（苏联的事件）' : ''}：${ev.lines.map((l) => l.text).join(' · ')}`,
    warn: ch.fires || ev.lines.some((l) => l.warn),
  };
}

/** Turns a choice key into what decide() must return. */
export const decision = (no, key, target) => (key === 'event' ? { no, use: 'event' } : key === 'space' ? { no, use: 'space' } : { no, use: 'ops', mode: key, target });

/** What one effect is in words, and how it should be coloured. */
export function describe(ctx, e) {
  const sign = (d) => (d > 0 ? '+' : '−') + Math.abs(d);
  if (e.t === 'inf') {
    const name = ctx.name(e.id);
    const took = e.ctrlTo !== e.ctrlFrom ? (e.ctrlTo === null ? ' · 无人控制' : ` · ${SIDE_NAME[e.ctrlTo]}控制`) : '';
    return { text: `${name}：${SIDE_NAME[e.side]}影响力 ${sign(e.d)}${took}`, short: sign(e.d), cls: e.side === 0 ? 'a' : 'b', took, meter: null };
  }
  if (e.t === 'crisis') return { text: `核危机 ${e.from} → ${e.to}`, short: `${e.from} → ${e.to}`, cls: e.d < 0 ? 'bad' : 'good', meter: 'crisis', why: e.why };
  if (e.t === 'milops') return { text: `${SIDE_NAME[e.side]}军事行动 ${e.from} → ${e.to}`, short: sign(e.to - e.from), cls: e.side === 0 ? 'a' : 'b', meter: 'milops', why: e.why };
  if (e.t === 'vp') return { text: `${SIDE_NAME[e.side]} +${e.d} 胜利点`, short: `+${e.d}`, cls: e.side === 0 ? 'a' : 'b', meter: 'vp' };
  if (e.t === 'space') return { text: `太空竞赛：${SIDE_NAME[e.side]}前进到第 ${e.to} 步`, short: '+1', cls: e.side === 0 ? 'a' : 'b', meter: 'space' };
  return { text: e.text, short: '', cls: 'note', meter: null };
}

/** Who is doing what, in a few words: "苏联 · 行动 3 点 · 政变 → 扎伊尔". */
export function playLine(ctx, play) {
  const who = SIDE_NAME[play.by];
  if (play.use === 'event') return { who, what: play.headline ? '头条事件' : '事件', detail: '' };
  if (play.use === 'space') return { who, what: MODE_NAME.space, detail: '弃一张牌，掷骰前进' };
  const where = play.target ? ` → ${ctx.name(play.target)}` : '';
  return { who, what: `行动 ${play.points} 点 · ${MODE_NAME[play.mode]}`, detail: where };
}

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};

export function basePresenter(ctx) {
  const { fx, board, hand, hud, cards, layer, G } = ctx;
  const wait = fx.wait;

  /* ------------------------------------------------------------------ the ribbon: what is being asked, top centre */
  const ribbon = fx.el('div', 'cp-ribbon pane gilt');
  ribbon.hidden = true;
  ribbon.innerHTML = '<span class="rb-who"></span><div class="rb-main"><b class="rb-title"></b><span class="rb-text"></span></div><div class="rb-pips"></div><div class="rb-btns"></div>';
  layer.appendChild(ribbon);
  let offKeys = null;
  const R = {
    /** who: small label; side: 0 | 1; title, text; pips: { total, left }; buttons: [{ label, key, on, primary, disabled }] */
    set({ who = '', side = null, title = '', text = '', pips = null, buttons = [] }) {
      ribbon.hidden = false;
      ribbon.className = `cp-ribbon pane gilt ${side === 0 ? 'a' : side === 1 ? 'b' : ''}`;
      ribbon.querySelector('.rb-who').textContent = who;
      ribbon.querySelector('.rb-title').textContent = title;
      R.say(text);
      ribbon.querySelector('.rb-pips').innerHTML = pips ? Array.from({ length: pips.total }, (_, i) => `<i class="${i < pips.total - pips.left ? 'used' : ''}"></i>`).join('') + `<b>${pips.left}</b>` : '';
      const box = ribbon.querySelector('.rb-btns');
      box.replaceChildren();
      offKeys?.();
      const map = {};
      for (const b of buttons) {
        const n = fx.el('button', b.primary ? 'primary' : '', `${b.label}${b.key ? `<kbd>${b.keyLabel ?? b.key}</kbd>` : ''}`);
        n.type = 'button';
        n.disabled = !!b.disabled;
        n.addEventListener('click', () => b.on());
        box.appendChild(n);
        if (b.key && !b.disabled) map[b.key] = b.on;
      }
      offKeys = ctx.keys(map);
    },
    say(html, cls = '') {
      const t = ribbon.querySelector('.rb-text');
      t.className = `rb-text ${cls}`;
      t.innerHTML = html;
    },
    hide() {
      ribbon.hidden = true;
      offKeys?.();
      offKeys = null;
    },
  };

  /* ------------------------------------------------------------------ the table: where the card in play lies */
  // The HUD's own "played" slot is the table. While a card is still on its way there, the slot's
  // own copy is kept out of sight.
  let onTable = null; // the element standing in for the card before it reaches the slot

  async function toTable(no, from) {
    const to = hud.rect('played');
    if (from && to) {
      hud.hidePlayed(true);
      await cards.flyNo(no, from, to, { duration: 460 });
    }
    hud.hidePlayed(false);
  }

  /* ------------------------------------------------------------------ choosing a card: the fork */
  let tray = null;
  function closeTray() {
    tray?.remove();
    tray = null;
    board.mark(null);
    hand.away(false);
  }

  /** The card in the middle, the event to its left, operations to its right. Resolves with a choice key or null. */
  function openTray(no, { headline = false } = {}) {
    closeTray();
    const ch = choiceList(ctx, no);
    const d = deferred();
    tray = fx.el('div', 'cp-tray');
    const ev = ch.byKey.event;
    const lines = ev.lines.map((l) => `<li class="${l.warn ? 'warn' : ''}${l.lethal ? ' lethal' : ''}">${l.warn ? ICON.warn : ''}<span>${l.text}</span></li>`).join('');
    const evHead = headline ? '作为头条' : ev.theirs ? '苏联的事件' : '作为事件';
    const evFoot = ev.theirs && !headline ? '<p class="tr-foot bad">用这张牌行动，事件照样发生。只有太空竞赛能躲开。</p>' : `<p class="tr-foot">${ev.sub}</p>`;
    const road = (c) =>
      `<button type="button" class="tr-mode ${c.ok ? '' : 'is-off'}${c.safe ? ' is-safe' : ''}" data-key="${c.key}" ${c.ok ? '' : 'disabled'}>` +
      `<i class="tr-ic">${ICON[c.key]}</i><span class="tr-name">${c.label}<kbd>${c.hot.toUpperCase()}</kbd></span>` +
      `<span class="tr-sub">${c.ok ? c.sub : c.why}</span>${c.ok && c.risk ? `<span class="tr-risk">${ICON.warn}${c.risk}</span>` : ''}${c.ok && c.safe ? '<span class="tr-safe">不触发对手事件</span>' : ''}</button>`;
    tray.innerHTML =
      `<button type="button" class="tr-road tr-event ${ev.theirs && !headline ? 'is-theirs' : ev.ok || headline ? '' : 'is-off'}" data-key="event" ${ev.ok || headline ? '' : 'disabled'}>` +
      `<span class="tr-head"><i class="tr-ic">${ICON.event}</i>${evHead}${ev.ok || headline ? `<kbd>${headline ? '↵' : 'E'}</kbd>` : ''}</span><ul class="tr-lines">${lines}</ul>${evFoot}</button>` +
      `<div class="tr-card"><div class="tr-slot"></div><button type="button" class="tr-back">${headline ? '换一张' : '收回'}<kbd>Esc</kbd></button></div>` +
      (headline
        ? '<div class="tr-road tr-note"><span class="tr-head">头条阶段</span><p>双方各暗出一张牌，同时翻开，都作为事件发生。数值高的先结算。</p><p class="tr-foot">头条不能用于行动。</p></div>'
        : `<div class="tr-road tr-ops"><span class="tr-head"><b class="tr-pts">${ch.points}</b>作为行动<small>四选一</small></span><div class="tr-modes">${ch.list.slice(1).map(road).join('')}</div></div>`);
    layer.appendChild(tray);
    hand.away(true);
    cards.put(no, tray.querySelector('.tr-slot'));

    const choose = (key) => d.resolve(key);
    const keymap = { escape: () => choose(null) };
    for (const b of tray.querySelectorAll('[data-key]')) {
      const c = ch.byKey[b.dataset.key];
      if (b.disabled) continue;
      b.addEventListener('click', () => choose(c.key));
      keymap[headline ? 'enter' : c.hot] = () => choose(c.key);
      // pointing at a way of acting shows where on the map it could be done
      if (c.mark) {
        b.addEventListener('pointerenter', () => board.mark(c.mark));
        b.addEventListener('pointerleave', () => board.mark(null));
      }
    }
    tray.querySelector('.tr-back').addEventListener('click', () => choose(null));
    const off = ctx.keys(keymap);
    return d.promise.finally(off);
  }

  /* ------------------------------------------------------------------ dice */
  let rollBox = null;
  function closeRoll() {
    rollBox?.classList.add('is-out');
    const n = rollBox;
    rollBox = null;
    setTimeout(() => n?.remove(), 350);
  }

  /* ------------------------------------------------------------------ the presenter */
  const P = {
    // Pieces of this plain presenter that a variant may reuse. `from` is the rectangle the played card
    // flies to the table from (set it in decide()); `headline` holds the two revealed headline cards.
    ui: { ribbon: R, openTray, closeTray, toTable, closeRoll, from: null, headline: null },

    async phase(info) {
      if (info.kind === 'headline') await fx.banner('<b>头条阶段</b><small>双方各暗出一张牌 · 同时翻开 · 都作为事件发生</small>', { ms: 1500 });
      else if (info.kind === 'round') {
        hand.live(false);
        await fx.banner(`<b class="${info.who === 0 ? 'a' : 'b'}">${info.who === 0 ? '你的行动' : '苏联行动'}</b><small>第 ${info.round} 行动轮</small>`, { ms: 850, cls: 'small' });
      } else {
        R.hide();
        hand.live(false);
        const war = info.why === 'war';
        layer.appendChild(fx.el('div', `cp-end ${war ? 'war' : ''}`, war ? '<b>核战爆发</b><small>核危机降到了 1 级 · 按 R 重来</small>' : '<b>演示到这里结束</b><small>按 R 重来，或换一个方案</small>'));
      }
    },

    /* ---- headline */
    // No second question in the headline: a card dragged out of the hand is played. While it is
    // being carried the ribbon says what its event will do.
    async pickHeadline() {
      const idle = '把一张牌拖出手牌，松手就打出 · 它会作为事件发生';
      R.set({ who: '头条阶段', side: 0, title: '拖出一张牌作为头条', text: idle });
      const pick = await ctx.pickCard({
        click: false,
        onCarry: (no) => {
          const line = carryLine(ctx, no);
          R.say(line.text, line.warn ? 'warn' : '');
        },
        onBack: () => R.say(idle),
      });
      P.ui.from = pick.rect;
      R.hide();
      return pick.no;
    },

    async showHeadline({ mine, theirs, order }) {
      hand.live(false);
      const stage = fx.el('div', 'cp-headline');
      stage.innerHTML = [1, 0].map((by) => `<div class="hl-seat ${by === 0 ? 'a' : 'b'}"><span class="hl-who">${by === 0 ? '你' : '苏联'}</span><div class="hl-card"><div class="hl-flip"><div class="hl-back"></div><div class="hl-front"></div></div></div><span class="hl-order"></span></div>`).join('');
      layer.appendChild(stage);
      const seat = (by) => stage.querySelector(`.hl-seat.${by === 0 ? 'a' : 'b'}`);
      for (const by of [0, 1]) {
        cards.back(seat(by).querySelector('.hl-back'));
        cards.put(by === 0 ? mine : theirs, seat(by).querySelector('.hl-front'));
      }
      // the player's card travels from where it was let go to its place, and lies face down there
      if (P.ui.from) {
        const place = seat(0).querySelector('.hl-card');
        place.style.visibility = 'hidden';
        await cards.flyNo(mine, P.ui.from, place.getBoundingClientRect(), { duration: 380 });
        place.style.visibility = '';
        P.ui.from = null;
      }
      await wait(900);
      stage.classList.add('is-open');
      await wait(900);
      order.forEach((o, i) => {
        const n = seat(o.by).querySelector('.hl-order');
        n.textContent = i === 0 ? '先结算' : '后结算';
        n.classList.add(i === 0 ? 'first' : 'second');
      });
      stage.classList.add('is-ordered');
      await wait(1500);
      // Nothing is carried out with a card in the way: both step aside, small, above the cards
      // corner, and wait there for their turn to go on the table.
      const box = stage.getBoundingClientRect();
      const corner = hud.pane('played')?.getBoundingClientRect();
      const k = 0.38;
      const u = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
      const to = corner ? { x: corner.left, y: corner.top - box.height * k - 1.4 * u } : { x: 1.6 * u, y: innerHeight * 0.52 };
      stage.classList.add('is-docked');
      await stage.animate(
        [{ transform: 'translateX(-50%)' }, { transform: `translateX(-50%) translate(${(to.x - box.left).toFixed(1)}px, ${(to.y - box.top).toFixed(1)}px) scale(${k})` }],
        { duration: 520, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)', fill: 'forwards' },
      ).finished;
      P.ui.headline = stage;
    },

    /* ---- the player's decision */
    async decide() {
      for (;;) {
        R.set({ who: '你的行动', side: 0, title: '打出一张牌', text: '点一张手牌，或把它拖出来' });
        hand.live(true);
        const pick = await ctx.pickCard();
        R.hide();
        const key = await openTray(pick.no);
        const from = tray?.querySelector('.tr-slot .slot')?.getBoundingClientRect();
        closeTray();
        if (key) {
          P.ui.from = from;
          return decision(pick.no, key);
        }
        hand.release(pick.no);
      }
    },

    /* ---- a card is played */
    async announce(play) {
      // the table slot already holds the card; it stays out of sight until our copy has flown there
      hud.hidePlayed(true);
      hand.live(false);
      board.clearBadges('last');
      const line = playLine(ctx, play);
      R.set({ who: play.by === 0 ? '你的行动' : '苏联行动', side: play.by, title: `《${play.card.title}》`, text: `${line.what}${line.detail}` });
      if (play.headline && P.ui.headline) {
        const seat = P.ui.headline.querySelector(`.hl-seat.${play.by === 0 ? 'a' : 'b'}`);
        const from = seat.querySelector('.hl-front .slot').getBoundingClientRect();
        seat.classList.add('is-gone');
        await toTable(play.no, from);
        if (!P.ui.headline.querySelector('.hl-seat:not(.is-gone)')) {
          P.ui.headline.remove();
          P.ui.headline = null;
        }
      } else if (play.by === 0) {
        await toTable(play.no, P.ui.from ?? hand.rectOf(play.no));
        P.ui.from = null;
      } else {
        // the opponent's card is held up long enough to be read, then goes to the table
        const show = fx.el('div', 'cp-oppcard');
        show.innerHTML = `<div class="oc-card"></div><div class="oc-cap"><b>苏联打出</b><span>${line.what}${line.detail}</span></div>`;
        layer.appendChild(show);
        const c = cards.put(play.no, show.querySelector('.oc-card'));
        await wait(1500);
        const from = c.getBoundingClientRect();
        show.remove();
        await toTable(play.no, from);
      }
      if (play.target) {
        await board.show(play.target);
        board.big(play.target);
        board.ring(play.target, play.by === 0 ? 'a' : 'b');
        await wait(350);
      }
    },

    /* ---- placing influence */
    async place(session, play) {
      let act = deferred();
      const press = (what) => act.resolve(what);
      const draw = () => {
        const t = session.targets();
        const ok = new Map([...t].filter(([, v]) => v.ok));
        board.mark({ kind: 'place', ok, lift: session.spent.map((s) => s.id) });
        board.clearBadges('cost');
        board.clearBadges('put');
        for (const [id, v] of ok) if (v.cost > 1) board.badge(id, 'cost', `${v.cost}`, 'b');
        for (const id of new Set(session.spent.map((s) => s.id))) board.badge(id, 'put', `+${session.count(id)}`, 'a');
        const none = !session.spent.length;
        R.set({
          who: '你的行动', side: 0, title: MODE_NAME.place,
          text: session.left ? (ok.size ? '点发光的国家放 1 点 · 标着 ×2 的要花 2 点' : '剩下的点数不够放在任何地方') : '点数用完了：确认，或撤销重放',
          pips: { total: session.points, left: session.left },
          buttons: [
            { label: '撤销', key: 'backspace', keyLabel: '⌫', on: () => press('undo'), disabled: none },
            none ? { label: '收回这张牌', key: 'escape', keyLabel: 'Esc', on: () => press('cancel') } : { label: '完成', key: 'enter', keyLabel: '↵', on: () => press('done'), primary: true },
          ],
        });
        return ok;
      };
      for (;;) {
        const ok = draw();
        act = deferred();
        const got = await Promise.race([session.left && ok.size ? board.pick(ok) : new Promise(() => {}), act.promise]);
        board.cancelPick();
        if (got === 'undo') session.undo();
        else if (got === 'done') break;
        else if (got === 'cancel') {
          board.mark(null);
          board.clearBadges('cost');
          R.hide();
          return false;
        } else if (got) {
          const e = session.add(got);
          if (e) {
            board.pop(got, '+1', 'a');
            board.ring(got, 'a');
            if (e.ctrlTo !== e.ctrlFrom) board.pop(got, e.ctrlTo === 0 ? '美国控制' : '打破控制', 'gold late');
          }
        }
      }
      board.mark(null);
      board.clearBadges('cost');
      board.clearBadges('put');
      R.hide();
      return true;
    },

    /* ---- choosing a country */
    async pickTarget(req) {
      const act = deferred();
      const kind = req.mode;
      const warn = kind === 'coup' ? [...req.targets].filter(([, p]) => p.key).map(([id]) => id) : [];
      board.mark({ kind, ok: req.targets, locked: req.locked, warn });
      for (const [id, p] of req.targets) {
        if (kind === 'coup') board.badge(id, 'need', p.need ? `≥${p.need}` : '✕', p.need ? '' : 'off');
        if (kind === 'realign') board.badge(id, 'need', p.edge > 0 ? `+${p.edge}` : p.edge < 0 ? `−${-p.edge}` : '±0', p.edge > 0 ? 'good' : p.edge < 0 ? 'bad' : '');
      }
      for (const id of req.locked.keys()) board.badge(id, 'lock', ICON.lock);
      const base =
        kind === 'coup' ? '选一个有对手影响力的国家 · 数字是成功所需的点数' : kind === 'realign' ? `还能掷 ${req.left} 次 · 数字是你的骰子比对手多加几点` : `${req.hint}（${req.total - req.left + 1} / ${req.total}）`;
      const buttons = [];
      if (req.optional) buttons.push({ label: '到此为止', key: 'enter', keyLabel: '↵', on: () => act.resolve(null), primary: true });
      if (req.cancel) buttons.push({ label: '收回这张牌', key: 'escape', keyLabel: 'Esc', on: () => act.resolve(null) });
      R.set({ who: '你的行动', side: 0, title: kind === 'event' ? `《${req.title}》` : MODE_NAME[kind], text: base, pips: req.total > 1 ? { total: req.total, left: req.left } : null, buttons });
      const off = board.onHover((id) => {
        if (id && req.locked.has(id)) return R.say(`${ICON.lock}${ctx.name(id)}：${req.locked.get(id)}`, 'bad');
        const p = id && req.targets.get(id);
        if (!p) return R.say(base);
        if (kind === 'coup') R.say(`${ctx.name(id)}：${p.need ? `掷出 ≥${p.need} 成功（${Math.round(p.chance * 100)}%）` : '这张牌的点数不够，不可能成功'}${p.key ? ` · ${ICON.warn}战场国：核危机 ${G.crisis} → ${p.crisisTo}` : ''}`, p.key ? 'warn' : '');
        else if (kind === 'realign') R.say(`${ctx.name(id)}：你 +${p.mods[0].reduce((a, m) => a + m.n, 0)}，苏联 +${p.mods[1].reduce((a, m) => a + m.n, 0)}`);
        else R.say(base);
      });
      const id = await Promise.race([board.pick(req.targets), act.promise]);
      off();
      board.cancelPick();
      board.clearBadges('need');
      board.clearBadges('lock');
      board.mark(null);
      if (id) {
        board.big(id);
        board.ring(id, 'a');
        R.set({ who: '你的行动', side: 0, title: kind === 'event' ? `《${req.title}》` : MODE_NAME[kind], text: ctx.name(id) });
      } else R.hide();
      return id;
    },

    /* ---- dice */
    async roll(spec) {
      closeRoll();
      if (spec.id) {
        await board.show(spec.id);
        board.big(spec.id);
      }
      const title = spec.kind === 'space' ? MODE_NAME.space : `${MODE_NAME[spec.kind]} · ${ctx.name(spec.id)}`;
      const box = (rollBox = fx.el('div', `cp-roll pane gilt k-${spec.kind}`));
      const dice = spec.dice.map((d) => ({ d, die: makeDie({ side: d.side }) }));
      const mods = (d) => d.mods.map((m) => `<span class="rl-mod"><b>+${m.n}</b>${m.label}</span>`).join('');
      const seat = (x, i) => `<div class="rl-seat ${x.d.side === 0 ? 'a' : 'b'}"><span class="rl-who">${SIDE_NAME[x.d.side]}</span><div class="rl-die" data-i="${i}"></div><div class="rl-mods">${mods(x.d)}</div><b class="rl-total">?</b></div>`;
      const need =
        spec.kind === 'coup'
          ? `<div class="rl-need">要超过 <b>${spec.bar.n}</b><small>${spec.bar.label}</small>${spec.need ? ` · 掷出 <b>≥${spec.need}</b> 成功` : ' · 不可能成功'}</div>`
          : spec.kind === 'space'
            ? `<div class="rl-need">掷出 <b>1–${spec.max}</b> 成功</div>`
            : '<div class="rl-need">点数高的一方胜出 · 输家移除差额的影响力</div>';
      box.innerHTML = `<div class="rl-title">${title}</div><div class="rl-seats">${dice.map(seat).join(spec.dice.length > 1 ? '<i class="rl-vs">对</i>' : '')}</div>${need}<div class="rl-verdict"></div>`;
      layer.appendChild(box);
      dice.forEach((x, i) => box.querySelector(`.rl-die[data-i="${i}"]`).appendChild(x.die.el));
      R.say('掷骰…');
      await wait(450);
      await Promise.all(dice.map((x, i) => x.die.roll(x.d.value, { ms: 1250 + i * 350 })));
      box.querySelectorAll('.rl-total').forEach((n, i) => (n.textContent = dice[i].d.total));
      box.classList.add('is-read');
      await wait(450);
      const v = box.querySelector('.rl-verdict');
      v.textContent = spec.text;
      const mine = spec.kind === 'realign' ? (spec.winner === null ? 'even' : spec.winner === 0 ? 'good' : 'bad') : spec.ok === (spec.by === 0) ? 'good' : 'bad';
      box.classList.add('is-done', mine);
      R.say(spec.text, mine === 'bad' ? 'bad' : '');
      await wait(1200);
      closeRoll();
    },

    /* ---- one consequence */
    async step(e, commit, cause) {
      const d = describe(ctx, e);
      const source = () => (cause?.id && board.at(cause.id)) || hud.rect('played');
      if (e.t === 'inf') {
        await board.show(e.id);
        board.big(e.id);
        board.ring(e.id, d.cls);
        R.say(d.text, d.cls);
        await wait(260);
        commit();
        board.pop(e.id, d.short, d.cls);
        if (d.took) board.pop(e.id, d.took.replace(' · ', ''), 'gold late');
        // what the opponent changed stays marked until the player's next card
        if (cause?.by === 1) board.badge(e.id, 'last', d.short, d.cls);
        await wait(950);
      } else if (d.meter) {
        const target = hud.el(d.meter);
        R.say(d.text + (d.why ? `<small>${d.why}</small>` : ''), d.cls);
        await fx.tracer(source(), target, { cls: d.cls === 'good' ? 'gold' : d.cls });
        commit();
        fx.flash(target, { label: d.text, cls: d.cls, ms: 2400, place: hud.side(d.meter) });
        if (e.t === 'crisis' && e.d < 0) fx.shake(hud.pane('crisis') ?? target, 5);
        await wait(e.t === 'crisis' ? 1700 : 1150);
      } else {
        R.say(d.text, 'note');
        if (e.id) board.pop(e.id, '—', 'note');
        commit();
        await wait(1100);
      }
    },

    async trigger(play) {
      R.set({ who: '苏联事件', side: 1, title: `《${play.card.title}》`, text: '你用了对手的牌行动：它的事件现在发生' });
      fx.flash(hud.el('played'), { cls: 'b', ms: 1200, label: '事件触发', place: 'above' });
      await wait(1300);
    },

    async settle(play) {
      closeRoll();
      board.big(null);
      board.mark(null);
      R.hide();
      const from = hud.rect('played');
      if (play.cancelled) {
        hand.release(play.no);
        hand.live(true);
        return;
      }
      const to = hud.rect(play.pile);
      if (from && to) cards.flyNo(play.no, from, to, { duration: 420, fade: true });
      await wait(450);
    },

    destroy() {
      offKeys?.();
    },
  };
  return P;
}
