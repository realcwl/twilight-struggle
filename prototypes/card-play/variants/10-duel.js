// 10 对局桌. Two seats at one table, and what happened stays on the map.
//
// A slim table hangs under the opponent's hand: their seat on the left in red, the player's on the
// right in blue, each with a card slot and a dice well, and between them a plate that says what is
// being asked or done. Both sides act through the same furniture, in the same order: the card goes
// to the seat, five tokens open under it and one is taken, the seat's die is thrown, and every
// consequence leaves something behind: a pin planted on the map where it happened, a tag on the
// meter it moved. Pins last the round, a side's tags until that side moves again, so after the
// opponent has acted everything they changed can still be read off the screen.
import './10-duel.css';
import { basePresenter, carryLine, choiceList, decision, describe, playLine, ICON } from '../core/base.js';
import { MODE_NAME, SIDE_NAME } from '../core/game.js';
import { CRISIS } from '../../hud-layouts/state.js';

const SEAT = ['你', '苏联'];
const LETTER = ['美', '苏'];
const VERB = { event: '事件', place: '放置', realign: '调整', coup: '政变', space: '太空' };
const cls = (side) => (side === 0 ? 'a' : 'b');
const sign = (d) => (d > 0 ? '+' : '−') + Math.abs(d);
const sum = (mods) => mods.reduce((a, m) => a + m.n, 0);
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};

export default {
  id: '10',
  name: '对局桌',
  ref: '两人对坐 · 落子留痕',
  idea: '顶部一张桌子，苏联坐左、你坐右，双方用同一套家具出牌掷骰；每个动作在地图上插一面小旗，在刻度上留一张签，对手动过什么一眼可查。',
  notes: {
    choose: '牌飞进你那一侧的牌位，座位下面打开一排五枚牌子：事件一枚（写明会发生什么），行动四枚（各一句话、不能用的写明原因）。指到哪枚，地图就亮出它能用在哪。',
    target: '可选的国家头顶悬一枚下指的小箭头，像等着被插旗；中间的铭牌写着问的是什么、还剩几点。',
    dice: '每个座位自带一口骰井。政变和太空竞赛时出手一方的骰子跳出井口放大翻滚，算式写在中间；调整阵营时两口井同时出骰，中间变成一杆天平，向点数高的一方倾斜。',
    guide: '每个动作都在出事的国家插一面旗：旗色是谁干的，旗上是动作图标和净变化，整轮不撤，指上去能重读骰子和明细。刻度变化由出手一方的牌位飞出光点，刻度旁留下该方颜色的签，直到他下次行动。核危机变化另在桌下垂出大字。',
    opponent: '对手走完全相同的流程：牌进左边牌位、举起给你读、同一排牌子在他座位下亮出他的选择、他的骰井掷骰、插红旗留红签。座位下的“上一手”可以把他刚才的旗和签按顺序再点亮一遍。',
  },
  pros: ['双方动作的语法完全一致，对手做了什么读法和自己一样', '旗和签留在原地，走神之后仍然查得到', '调整阵营的“比大小”用天平一眼看懂'],
  cons: ['桌子常驻顶部正中，占掉一条地图（北欧一带）', '牌位里的牌很小，要悬停才看得清牌面', '一轮动作多了以后旗子会挤'],
  mount(ctx) {
    const { fx, board, hand, hud, cards, layer, G } = ctx;
    const wait = fx.wait;
    const base = basePresenter(ctx);
    const R = base.ui.ribbon;

    /* ------------------------------------------------------------------ the table */
    const seatHTML = (s) => {
      const well = `<div class="dl-well"><div class="dl-pop"></div><i class="sd">${LETTER[s]}</i></div>`;
      const slot = `<div class="dl-slot"><span class="dl-empty">${SEAT[s]}</span><div class="dl-flip"><div class="dl-back"></div><div class="dl-front"></div></div><i class="dl-verb"></i><i class="dl-order"></i></div>`;
      return `<div class="dl-seat ${cls(s)}" data-side="${s}">${s === 1 ? well + slot : slot + well}</div>`;
    };
    const table = fx.el('div', 'dl-table');
    table.innerHTML =
      seatHTML(1) +
      '<div class="dl-plate"><div class="dl-idle"><small></small><b></b></div><div class="dl-leaf" hidden></div></div>' +
      seatHTML(0) +
      '<button type="button" class="dl-last" hidden>上一手<kbd>L</kbd></button>';
    layer.appendChild(table);
    const plate = table.querySelector('.dl-plate');
    const leaf = table.querySelector('.dl-leaf');
    // the plain presenter's ribbon becomes the plate between the seats: whatever it is told, it says here
    plate.prepend(layer.querySelector('.cp-ribbon'));
    const seatEl = (s) => table.querySelector(`.dl-seat.${cls(s)}`);
    const slotEl = (s) => seatEl(s).querySelector('.dl-slot');
    const wellEl = (s) => seatEl(s).querySelector('.dl-well');
    const slotRect = (s) => slotEl(s).getBoundingClientRect();
    const dice = [0, 1].map((s) => {
      const die = ctx.makeDie({ side: s });
      wellEl(s).querySelector('.dl-pop').appendChild(die.el);
      return die;
    });
    const seatCard = [null, null];
    hud.hidePlayed(true);

    function setIdle(small, big) {
      plate.querySelector('.dl-idle small').textContent = small;
      plate.querySelector('.dl-idle b').textContent = big;
    }
    /** Whose move it is: that seat stands forward, the other sits back. null: neither. */
    function setActive(side) {
      for (const s of [0, 1]) {
        seatEl(s).classList.toggle('is-active', side === s);
        seatEl(s).classList.toggle('is-idle', side !== null && side !== s);
      }
      table.dataset.turn = side === null ? '' : cls(side);
    }
    function setVerb(side, key, text) {
      const v = slotEl(side).querySelector('.dl-verb');
      v.innerHTML = key ? `${ICON[key] ?? ''}<span>${text ?? VERB[key]}</span>` : '';
      v.classList.toggle('on', !!key);
    }
    function setOrder(side, text, first) {
      const o = slotEl(side).querySelector('.dl-order');
      o.textContent = text ?? '';
      o.className = `dl-order ${text ? 'on' : ''} ${first ? 'first' : ''}`;
    }
    function clearSlot(side) {
      const s = slotEl(side);
      s.querySelector('.dl-front').replaceChildren();
      s.querySelector('.dl-back').replaceChildren();
      s.classList.remove('has', 'is-down', 'is-past');
      seatCard[side] = null;
    }
    function putCard(side, no, down = false) {
      const s = slotEl(side);
      clearSlot(side);
      cards.put(no, s.querySelector('.dl-front'));
      cards.back(s.querySelector('.dl-back'));
      s.classList.add('has');
      s.classList.toggle('is-down', down);
      seatCard[side] = no;
    }
    /** A card travels to a seat's slot. `down`: it arrives and lies face down. */
    async function toSlot(side, no, from, { down = false } = {}) {
      const to = slotRect(side);
      clearSlot(side);
      setVerb(side, null);
      if (from?.width) {
        if (down) await cards.fly(cards.back(null, from.width + 'px'), from, to, { duration: 430 });
        else await cards.flyNo(no, from, to, { duration: 430 });
      }
      putCard(side, no, down);
    }
    const oppHandRect = () => {
      const r = hud.rect('opp');
      const w = slotRect(1).width;
      return r?.width ? { left: r.left + r.width / 2 - w / 2, top: r.top, width: w, height: w * 1.4 } : null;
    };
    const handRect = (no) => {
      const r = hand.rectOf(no);
      if (r?.width) return r;
      const g = layer.getBoundingClientRect();
      const w = slotRect(0).width * 2;
      return { left: g.left + g.width / 2 - w / 2, top: g.bottom - w * 0.9, width: w, height: w * 1.4 };
    };

    /* ---- reading a card that lies in a slot: it is held up under its seat */
    const peeks = [null, null];
    function showPeek(side, no, hover = false) {
      hidePeek(side);
      const p = fx.el('div', `dl-peek ${cls(side)} ${hover ? 'is-hover' : ''}`);
      table.appendChild(p);
      cards.put(no, p);
      peeks[side] = p;
    }
    function hidePeek(side) {
      peeks[side]?.remove();
      peeks[side] = null;
    }
    for (const s of [0, 1]) {
      slotEl(s).addEventListener('pointerenter', () => {
        if (seatCard[s] && !slotEl(s).classList.contains('is-down') && !peeks[s] && !row) showPeek(s, seatCard[s], true);
      });
      slotEl(s).addEventListener('pointerleave', () => {
        if (peeks[s]?.classList.contains('is-hover')) hidePeek(s);
      });
    }

    /* ---- the leaf under the plate: arithmetic, the balance, a change of crisis level */
    function showLeaf(html, kind = '') {
      leaf.className = `dl-leaf ${kind}`;
      leaf.innerHTML = html;
      leaf.hidden = false;
    }
    function hideLeaf() {
      leaf.hidden = true;
      leaf.replaceChildren();
    }

    /* ------------------------------------------------------------------ the row of five tokens under a seat */
    let row = null;
    function closeRow() {
      row?.remove();
      row = null;
      board.mark(null);
    }

    /** The player's row. Resolves with a choice key, or null for "take the card back". */
    function openRow(no, { headline = false } = {}) {
      closeRow();
      const ch = choiceList(ctx, no);
      const d = deferred();
      const ev = ch.byKey.event;
      const lines = ev.lines.map((l) => `<li class="${l.warn ? 'warn' : ''}${l.lethal ? ' lethal' : ''}">${l.warn ? ICON.warn : ''}<span>${l.text}</span></li>`).join('');
      const evHead = (label, key) => `<span class="tk-head"><i class="tk-ic">${ICON.event}</i><b class="tk-name">${label}</b>${key ? `<kbd>${key}</kbd>` : ''}</span>`;
      const evTok = headline
        ? `<button type="button" class="dl-tok ev" data-key="event">${evHead('作为头条', '↵')}<ul class="tk-lines">${lines}</ul><span class="tk-foot">${ev.theirs ? '这是苏联的事件：头条里它照样发生' : '翻开后作为事件发生'}</span></button>`
        : ev.theirs
          ? `<div class="dl-tok ev theirs">${evHead('苏联的事件', '')}<ul class="tk-lines">${lines}</ul><span class="tk-foot bad">用这张牌行动，事件照样发生；只有太空竞赛能躲开</span></div>`
          : `<button type="button" class="dl-tok ev ${ev.ok ? '' : 'is-off'}" data-key="event" ${ev.ok ? '' : 'disabled'}>${evHead('作为事件', 'E')}<ul class="tk-lines">${lines}</ul><span class="tk-foot">${ev.sub}</span></button>`;
      const o = ch.options;
      // one short line each: these sit in a narrow token, the long form goes on the plate
      const brief = {
        place: `${ch.points} 点 · ${o.place.targets.size} 国`,
        realign: `掷 ${ch.points} 次 · ${o.realign.targets.size} 国`,
        coup: `掷 1 次 · ${o.coup.targets.size} 国`,
        space: o.space.ok ? `掷 1–${o.space.max} 前进` : '',
      };
      const tok = (c) =>
        `<button type="button" class="dl-tok ${c.ok ? '' : 'is-off'}" data-key="${c.key}" ${c.ok ? '' : 'disabled'}>` +
        `<span class="tk-head"><i class="tk-ic">${ICON[c.key]}</i><kbd>${c.hot.toUpperCase()}</kbd></span><b class="tk-name">${c.label}</b>` +
        `<span class="tk-sub">${c.ok ? brief[c.key] : c.why}</span>` +
        (c.ok && c.risk ? `<span class="tk-risk">${ICON.warn}战场国：核危机 −1</span>` : '') +
        (c.ok && c.safe ? '<span class="tk-safe">不触发对手事件</span>' : '') +
        '</button>';
      row = fx.el('div', `dl-row a ${headline ? 'is-headline' : ''}`);
      row.innerHTML =
        evTok +
        (headline
          ? '<div class="dl-tok note"><span class="tk-head"><b class="tk-name">头条阶段</b></span><span class="tk-sub">双方各暗出一张牌，同时翻开，都作为事件发生。点数高的先结算，头条不能用于行动。</span></div>'
          : ch.list.slice(1).map(tok).join('')) +
        `<button type="button" class="dl-back-btn">${headline ? '换一张' : '收回这张牌'}<kbd>Esc</kbd></button>`;
      table.appendChild(row);
      table.classList.add('has-row');

      const rest = headline ? '确认后牌面朝下盖在你的牌位上' : `行动点 ${ch.points} · 指到一枚牌子上，地图会亮出它能用在哪`;
      R.set({ who: headline ? '头条阶段' : '你的行动', side: 0, title: `《${ch.card.title}》`, text: rest });
      const keymap = { escape: () => d.resolve(null) };
      for (const b of row.querySelectorAll('[data-key]')) {
        if (b.disabled) continue;
        const c = ch.byKey[b.dataset.key];
        b.addEventListener('click', () => d.resolve(c.key));
        keymap[headline ? 'enter' : c.hot] = () => d.resolve(c.key);
        b.addEventListener('pointerenter', () => {
          if (c.mark) board.mark(c.mark);
          if (c.key !== 'event') R.say(`${c.label} · ${c.sub}${c.risk ? ` · ${ICON.warn}${c.risk}` : ''}`, c.risk ? 'warn' : '');
        });
        b.addEventListener('pointerleave', () => {
          board.mark(null);
          R.say(rest);
        });
      }
      row.querySelector('.dl-back-btn').addEventListener('click', () => d.resolve(null));
      const off = ctx.keys(keymap);
      return d.promise.finally(() => {
        off();
        table.classList.remove('has-row');
      });
    }

    /** The same row under the opponent's seat, for a moment: all five, then the one they take. */
    async function oppRow(play) {
      closeRow();
      const chosen = play.use === 'ops' ? play.mode : play.use;
      const line = playLine(ctx, play);
      row = fx.el('div', 'dl-row b is-theirs');
      row.innerHTML = ['event', 'place', 'realign', 'coup', 'space']
        .map((k) => `<div class="dl-tok" data-key="${k}"><span class="tk-head"><i class="tk-ic">${ICON[k]}</i></span><b class="tk-name">${k === 'event' ? '事件' : MODE_NAME[k]}</b><span class="tk-sub">${k === chosen ? (k === 'event' ? '发动这张牌的事件' : k === 'space' ? '弃牌，掷骰前进' : `${play.points} 点${line.detail}`) : ''}</span></div>`)
        .join('');
      table.appendChild(row);
      table.classList.add('has-row');
      R.say('对手在选怎么用这张牌…');
      await wait(650);
      for (const t of row.children) t.classList.add(t.dataset.key === chosen ? 'is-on' : 'is-dim');
      R.say(`${line.what}${line.detail}`, 'b');
      await wait(1150);
      table.classList.remove('has-row');
      closeRow();
    }

    /* ------------------------------------------------------------------ what stays behind: pins and tags */
    const pins = [new Map(), new Map()]; // per acting side: country -> { by, no, kind, d: [a, b], rolls: [], miss }
    const lastMove = [null, null]; // per side: { play, items: [{ pin: id } | { tag: el, meter }] }
    let tip = null; // the country whose pins are being re-read

    function pinHTML(p) {
      const chips = [0, 1].filter((s) => p.d[s]).map((s) => `<b class="pd ${cls(s)}">${sign(p.d[s])}</b>`).join('');
      return `${ICON[p.kind] ?? ICON.event}${chips || (p.miss ? '<b class="pd miss">✕</b>' : '')}`;
    }
    function pinTip(p) {
      const head = `<b class="${cls(p.by)}">${SIDE_NAME[p.by]}</b> · 《${ctx.card(p.no).title}》 · ${p.kind === 'event' ? '事件' : MODE_NAME[p.kind]}`;
      const deltas = [0, 1].filter((s) => p.d[s]).map((s) => `${SIDE_NAME[s]}影响力 ${sign(p.d[s])}`);
      return `<div class="tp-head">${head}</div>${p.rolls.map((r) => `<div class="tp-roll">${r}</div>`).join('')}<div class="tp-delta">${deltas.join(' · ') || '没有变化'}</div>`;
    }
    function drawPin(by, id) {
      const key = 'pin' + cls(by);
      const p = pins[by].get(id);
      if (!p || (!p.d[0] && !p.d[1] && !p.miss && !p.rolls.length)) {
        pins[by].delete(id);
        return board.badge(id, key, null);
      }
      board.badge(id, key, pinHTML(p), cls(by));
      if (tip === id) showTip(id);
    }
    // Pointing at a country that carries pins re-reads what happened there this round. The note
    // rides on the node itself, so it stays put while the node grows under the pointer.
    function showTip(id) {
      if (tip && tip !== id) board.badge(tip, 'tip', null);
      tip = null;
      const here = id ? [1, 0].map((s) => pins[s].get(id)).filter(Boolean) : [];
      if (!here.length) return;
      board.badge(id, 'tip', here.map((p) => `<div class="tp ${cls(p.by)}">${pinTip(p)}</div>`).join(''));
      tip = id;
    }
    const offTip = board.onHover(showTip);
    function pinOf(by, id, kind, no) {
      let p = pins[by].get(id);
      if (!p) pins[by].set(id, (p = { by, no, kind, d: [0, 0], rolls: [], miss: false }));
      p.kind = kind;
      p.no = no;
      return p;
    }
    function note(by, item) {
      const m = lastMove[by];
      if (!m) return;
      if (item.pin && m.items.some((x) => x.pin === item.pin)) return;
      m.items.push(item);
    }
    function clearPins() {
      for (const s of [0, 1]) {
        for (const id of pins[s].keys()) board.badge(id, 'pin' + cls(s), null);
        pins[s].clear();
      }
      showTip(null);
    }

    // tags hang on the corner pane of the meter they speak of: above a bottom pane, below a top one
    const tagBoxes = new Map();
    function tagBox(meter) {
      const pane = hud.pane(meter);
      if (!pane) return null;
      let box = tagBoxes.get(pane);
      if (!box) {
        box = fx.el('div', `dl-tags at-${hud.side(meter)}`);
        layer.appendChild(box);
        tagBoxes.set(pane, box);
      }
      const r = pane.getBoundingClientRect();
      const g = layer.getBoundingClientRect();
      box.style.right = g.right - r.right + 'px';
      if (hud.side(meter) === 'above') box.style.bottom = g.bottom - r.top + 12 + 'px';
      else box.style.top = r.bottom - g.top + 12 + 'px';
      return box;
    }
    function addTag(meter, by, text) {
      const box = tagBox(meter);
      if (!box) return null;
      const t = fx.el('div', `dl-tag ${cls(by)}`, `<i class="sd">${LETTER[by]}</i><span>${text}</span>`);
      t.dataset.by = by;
      box.appendChild(t);
      note(by, { tag: t, meter });
      return t;
    }
    function clearTags(by) {
      for (const box of tagBoxes.values()) for (const t of [...box.children]) if (by === undefined || +t.dataset.by === by) t.remove();
    }
    const onResize = () => {
      for (const [pane, box] of tagBoxes) {
        const r = pane.getBoundingClientRect();
        const g = layer.getBoundingClientRect();
        box.style.right = g.right - r.right + 'px';
        if (box.classList.contains('at-above')) box.style.bottom = g.bottom - r.top + 12 + 'px';
        else box.style.top = r.bottom - g.top + 12 + 'px';
      }
    };
    window.addEventListener('resize', onResize);

    /* ---- "上一手": the opponent's last move, lit again in the order it happened */
    const lastBtn = table.querySelector('.dl-last');
    let replaying = false;
    let offLast = null;
    async function replay() {
      const m = lastMove[1];
      if (!m || replaying) return;
      replaying = true;
      const line = playLine(ctx, m.play);
      const text = table.querySelector('.rb-text');
      const keep = [text.innerHTML, text.className];
      try {
        R.say(`苏联上一手：《${m.play.card.title}》 ${line.what}${line.detail}`, 'b');
        seatEl(1).classList.add('is-recall');
        await wait(500);
        for (const it of m.items) {
          if (it.pin) {
            if (!pins[1].has(it.pin)) continue;
            await board.show(it.pin);
            board.ring(it.pin, 'b');
            const n = board.el(it.pin)?.querySelector(':scope > .cp-badge[data-key="pinb"]');
            n?.classList.remove('is-again');
            void n?.offsetWidth;
            n?.classList.add('is-again');
          } else if (it.tag?.isConnected) {
            it.tag.classList.remove('is-again');
            void it.tag.offsetWidth;
            it.tag.classList.add('is-again');
            fx.flash(hud.el(it.meter), { cls: 'b', ms: 700 });
          } else continue;
          await wait(750);
        }
      } catch {
        // the variant went away mid-replay
      } finally {
        seatEl(1).classList.remove('is-recall');
        replaying = false;
        if (text.isConnected && table.querySelector('.rb-title')?.textContent === '打出一张牌') {
          text.innerHTML = keep[0];
          text.className = keep[1];
        }
      }
    }
    lastBtn.addEventListener('click', replay);
    function offerReplay(on) {
      offLast?.();
      offLast = null;
      lastBtn.hidden = !(on && lastMove[1]?.items.length);
      if (!lastBtn.hidden) offLast = ctx.keys({ l: replay });
    }

    /* ------------------------------------------------------------------ the presenter */
    const P = {
      ...base,

      async phase(info) {
        if (info.kind === 'headline') {
          setActive(null);
          setIdle('第 4 回合', '头条阶段');
          return base.phase.call(this, info);
        }
        if (info.kind !== 'round') {
          offerReplay(false);
          setActive(null);
          return base.phase.call(this, info);
        }
        // a new round begins with the opponent's move: last round's pins come off the map
        if (info.who === 1) clearPins();
        offerReplay(false);
        hand.live(false);
        setIdle(`第 ${info.round} 行动轮`, info.who === 0 ? '轮到你' : '苏联行动');
        R.hide();
        setActive(info.who);
        await wait(750);
      },

      /* ---- headline */
      // a card dragged out of the hand goes face down on the player's slot: that is the headline
      async pickHeadline() {
        setActive(0);
        const idle = { who: '头条阶段', side: 0, title: '拖出一张牌作头条', text: '松手就盖在你的牌位上 · 它会作为事件发生' };
        R.set(idle);
        const pick = await ctx.pickCard({
          click: false,
          onCarry: (no) => R.say(carryLine(ctx, no).text),
          onBack: () => R.say(idle.text),
        });
        hand.live(false);
        await toSlot(0, pick.no, pick.rect);
        slotEl(0).classList.add('is-down');
        R.set({ who: '头条阶段', side: 0, title: '头条已盖下', text: '等对手也盖下一张…' });
        return pick.no;
      },

      async showHeadline({ mine, theirs, order }) {
        hand.live(false);
        setActive(null);
        await toSlot(1, theirs, oppHandRect(), { down: true });
        if (!seatCard[0]) putCard(0, mine, true);
        await wait(700);
        R.set({ who: '头条阶段', title: '同时翻开', text: '' });
        for (const s of [1, 0]) slotEl(s).classList.remove('is-down');
        await wait(800);
        showPeek(1, theirs);
        showPeek(0, mine);
        order.forEach((o, i) => setOrder(o.by, i === 0 ? '先结算' : '后结算', i === 0));
        const [va, vb] = [ctx.card(mine).value, ctx.card(theirs).value];
        R.say(va === vb ? `点数相同（${va} 对 ${vb}）：你先结算` : `${SIDE_NAME[order[0].by]}的牌点数高（${Math.max(va, vb)} 对 ${Math.min(va, vb)}），先结算`);
        await wait(2300);
        hidePeek(0);
        hidePeek(1);
      },

      /* ---- the player's decision */
      async decide() {
        for (;;) {
          setActive(0);
          R.set({ who: '你的行动', side: 0, title: '打出一张牌', text: '点一张手牌，或把它拖出来' });
          hand.live(true);
          offerReplay(true);
          const pick = await ctx.pickCard();
          offerReplay(false);
          hand.live(false);
          await toSlot(0, pick.no, pick.rect);
          const key = await openRow(pick.no);
          closeRow();
          if (key) {
            setVerb(0, key);
            return decision(pick.no, key);
          }
          const from = slotRect(0);
          clearSlot(0);
          await cards.flyNo(pick.no, from, handRect(pick.no), { duration: 320 });
          hand.release(pick.no);
        }
      },

      /* ---- a card is played */
      async announce(play) {
        hand.live(false);
        offerReplay(false);
        const line = playLine(ctx, play);
        const key = play.use === 'ops' ? play.mode : play.use;
        const say = () => R.set({ who: play.by === 0 ? '你的行动' : '苏联行动', side: play.by, title: `《${play.card.title}》`, text: `${line.what}${line.detail}` });
        setActive(play.by);
        setOrder(play.by, null);
        if (!play.headline) {
          // a side's tags have done their work once that side moves again
          clearTags(play.by);
          lastMove[play.by] = { play, items: [] };
        } else if (!lastMove[play.by]) lastMove[play.by] = { play, items: [] };
        if (play.headline) {
          setVerb(play.by, 'event', '头条');
          say();
          await wait(600);
          return;
        }
        if (play.by === 1) {
          R.set({ who: '苏联行动', side: 1, title: `《${play.card.title}》`, text: '对手出牌…' });
          await toSlot(1, play.no, oppHandRect());
          // held up under their seat long enough to be read
          showPeek(1, play.no);
          await wait(1500);
          hidePeek(1);
          await oppRow(play);
          setVerb(1, key);
        } else if (seatCard[0] !== play.no) {
          await toSlot(0, play.no, handRect(play.no));
          setVerb(0, key);
        }
        say();
        if (play.target) {
          await board.show(play.target);
          board.big(play.target);
          board.ring(play.target, cls(play.by));
          await wait(350);
        }
      },

      /* ---- placing influence: every point plants or raises the player's pin */
      async place(session, play) {
        let act = deferred();
        const press = (what) => act.resolve(what);
        const repin = (id) => {
          const n = session.count(id);
          const p = pinOf(0, id, 'place', play.no);
          p.d[0] = n;
          drawPin(0, id);
          if (n) note(0, { pin: id });
        };
        if (session.spent.length) for (const id of new Set(session.spent.map((s) => s.id))) repin(id);
        const draw = () => {
          const t = session.targets();
          const ok = new Map([...t].filter(([, v]) => v.ok));
          board.mark({ kind: 'place', ok, lift: session.spent.map((s) => s.id) });
          board.clearBadges('cost');
          for (const [id, v] of ok) if (v.cost > 1) board.badge(id, 'cost', `${v.cost}`, 'b');
          const none = !session.spent.length;
          R.set({
            who: '你的行动', side: 0, title: MODE_NAME.place,
            text: session.left ? (ok.size ? '点带箭头的国家插 1 点 · 标 ×2 的要花 2 点' : '剩下的点数不够放在任何地方') : '点数用完了：确认，或撤销重放',
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
          // when the variant is taken away the pending pick is answered with null: stop here, or this
          // loop would mark the map once more on its way out
          if (ctx.signal.aborted) return false;
          board.cancelPick();
          if (got === 'undo') {
            const last = session.undo();
            if (last) repin(last.id);
          } else if (got === 'done') break;
          else if (got === 'cancel') {
            board.mark(null);
            board.clearBadges('cost');
            return false;
          } else if (got) {
            const e = session.add(got);
            if (e) {
              repin(got);
              board.ring(got, 'a');
              if (e.ctrlTo !== e.ctrlFrom) board.pop(got, e.ctrlTo === 0 ? '美国控制' : '打破控制', 'gold');
            }
          }
        }
        board.mark(null);
        board.clearBadges('cost');
        R.say(`放下了 ${session.points - session.left} 点`);
        return true;
      },

      /* ---- dice: the acting seat's well; for a realignment both, and a balance between them */
      async roll(spec) {
        hideLeaf();
        if (spec.id) {
          await board.show(spec.id);
          board.big(spec.id);
        }
        const where = spec.id ? ` · ${ctx.name(spec.id)}` : '';
        const title = `<div class="lf-title">${MODE_NAME[spec.kind]}${where}</div>`;
        const d0 = spec.dice[0];
        if (spec.kind === 'realign') {
          const end = (s) => `<span class="lf-end ${cls(s)}"><b>?</b><small>${SEAT[s]}</small></span>`;
          const mods = (s) => `<span class="${cls(s)}">骰子${spec.dice[s].mods.map((m) => ` +${m.n} ${m.label}`).join('') || ' 无加值'}</span>`;
          showLeaf(`${title}<div class="lf-balance"><div class="lf-beam">${end(1)}<i class="lf-diff"></i>${end(0)}</div><i class="lf-pivot"></i></div><div class="lf-mods">${mods(1)}${mods(0)}</div><div class="lf-verdict"></div>`, 'k-realign');
        } else if (spec.kind === 'coup') {
          showLeaf(
            `${title}<div class="lf-sum"><span class="lf-term die ${cls(d0.side)}"><b>?</b><small>骰子</small></span><i>+</i><span class="lf-term"><b>${d0.mods[0].n}</b><small>行动点</small></span><i>=</i><span class="lf-term total"><b>?</b><small>合计</small></span><em class="lf-cmp">对</em><span class="lf-term bar"><b>${spec.bar.n}</b><small>${spec.bar.label}</small></span></div>` +
              `<div class="lf-need">${spec.need ? `掷出 ≥${spec.need} 才能超过` : '这张牌的点数不够，掷几都不行'}</div><div class="lf-verdict"></div>`,
            'k-coup',
          );
        } else {
          showLeaf(`${title}<div class="lf-sum"><span class="lf-term die ${cls(d0.side)}"><b>?</b><small>骰子</small></span><em class="lf-cmp">对</em><span class="lf-term bar"><b>1–${spec.max}</b><small>成功线</small></span></div><div class="lf-need">掷出 1–${spec.max} 前进一步</div><div class="lf-verdict"></div>`, 'k-space');
        }
        R.set({ who: spec.by === 0 ? '你的行动' : '苏联行动', side: spec.by, title: `${MODE_NAME[spec.kind]}${where}`, text: '掷骰…' });
        table.classList.toggle('is-duel', spec.kind === 'realign');
        for (const d of spec.dice) wellEl(d.side).classList.add('is-firing');
        await wait(520);
        await Promise.all(spec.dice.map((d, i) => dice[d.side].roll(d.value, { ms: 1350 + i * 380, turns: 3 })));
        // read the dice off
        if (spec.kind === 'realign') {
          for (const d of spec.dice) leaf.querySelector(`.lf-end.${cls(d.side)} b`).textContent = d.total;
          const [a, b] = [spec.dice[0].total, spec.dice[1].total];
          leaf.querySelector('.lf-beam').style.setProperty('--tilt', a === b ? '0deg' : a > b ? '7deg' : '-7deg');
          leaf.querySelector('.lf-diff').textContent = a === b ? '平' : `差 ${Math.abs(a - b)}`;
        } else {
          leaf.querySelector('.lf-term.die b').textContent = d0.value;
          const total = leaf.querySelector('.lf-term.total b');
          if (total) total.textContent = d0.total;
          leaf.querySelector('.lf-cmp').textContent = spec.kind === 'coup' ? (spec.ok ? '＞' : '≤') : spec.ok ? '≤' : '＞';
        }
        leaf.classList.add('is-read');
        await wait(480);
        const mine = spec.kind === 'realign' ? (spec.winner === null ? 'even' : spec.winner === 0 ? 'good' : 'bad') : spec.ok === (spec.by === 0) ? 'good' : 'bad';
        leaf.querySelector('.lf-verdict').textContent = spec.text;
        leaf.classList.add('is-done', mine);
        R.say(spec.text, mine === 'bad' ? 'bad' : mine === 'good' ? 'good' : '');
        // the roll is kept with the pin that this action leaves at the country
        if (spec.id) {
          const p = pinOf(spec.by, spec.id, spec.kind, spec.no);
          p.rolls.push(
            spec.kind === 'coup'
              ? `掷 ${d0.value} + ${d0.mods[0].n} 行动点 = ${d0.total}，要超过 ${spec.bar.n}：${spec.ok ? '成功' : '失败'}`
              : `你 ${spec.dice[0].value}${sum(spec.dice[0].mods) ? `+${sum(spec.dice[0].mods)}` : ''} 对 苏联 ${spec.dice[1].value}${sum(spec.dice[1].mods) ? `+${sum(spec.dice[1].mods)}` : ''}：${spec.text}`,
          );
        }
        await wait(1350);
        for (const d of spec.dice) wellEl(d.side).classList.remove('is-firing');
        table.classList.remove('is-duel');
        hideLeaf();
      },

      /* ---- one consequence: a pin where it happened, a tag on what it moved */
      async step(e, commit, cause) {
        const d = describe(ctx, e);
        const by = cause?.by ?? 0;
        const kind = cause?.kind ?? 'event';
        if (e.t === 'inf') {
          await board.show(e.id);
          board.big(e.id);
          board.ring(e.id, d.cls);
          R.say(d.text, d.cls);
          await wait(260);
          commit();
          board.pop(e.id, d.short, d.cls);
          if (d.took) board.pop(e.id, d.took.replace(' · ', ''), 'gold late');
          const p = pinOf(by, e.id, kind, cause.no);
          p.d[e.side] += e.d;
          drawPin(by, e.id);
          note(by, { pin: e.id });
          await wait(950);
        } else if (d.meter) {
          const target = hud.el(d.meter);
          const crisis = e.t === 'crisis';
          R.say(d.text + (d.why ? `<small>${d.why}</small>` : ''), d.cls);
          if (crisis) showLeaf(`<div class="lf-title">核危机</div><div class="lf-crisis"><b class="l${e.from}">${e.from}</b><i>→</i><b class="to l${e.to}">${e.to}</b><em class="l${e.to}">${CRISIS[e.to]}</em></div><div class="lf-need">${d.why ?? ''}</div>`, `k-crisis ${e.d < 0 ? 'worse' : 'better'}`);
          await fx.tracer(slotEl(by), target, { cls: crisis ? (e.d < 0 ? 'bad' : 'gold') : cls(by), ms: 700 });
          commit();
          fx.flash(target, { cls: crisis ? d.cls : cls(by), ms: crisis ? 2000 : 1300 });
          addTag(d.meter, by, e.t === 'vp' ? `胜利点 ${sign(e.d)}` : e.t === 'space' ? `太空竞赛 第 ${e.to} 步` : e.t === 'milops' ? `军事行动 ${e.from} → ${e.to}` : d.text);
          if (crisis && e.d < 0) {
            fx.shake(hud.pane('crisis') ?? target, 6);
            fx.shake(table, 4);
          }
          await wait(crisis ? 2000 : 1150);
          if (crisis) hideLeaf();
        } else {
          R.say(d.text, 'note');
          if (e.id) {
            board.pop(e.id, '—', 'note');
            const p = pinOf(by, e.id, kind, cause.no);
            p.miss = !p.d[0] && !p.d[1];
            drawPin(by, e.id);
            note(by, { pin: e.id });
          }
          commit();
          await wait(1100);
        }
      },

      /* ---- the opponent's event after their card was used: the card crosses the table to its owner */
      async trigger(play) {
        board.big(null);
        hideLeaf();
        R.set({ who: '苏联事件', side: 1, title: `《${play.card.title}》`, text: '你用了对手的牌行动：牌推给对面，它的事件现在发生' });
        const from = slotRect(0);
        clearSlot(0);
        setVerb(0, null);
        setActive(1);
        lastMove[1] = { play: { ...play, by: 1, use: 'event', mode: 'event' }, items: [] };
        clearTags(1);
        await toSlot(1, play.no, from);
        setVerb(1, 'event');
        await wait(900);
      },

      async settle(play) {
        hideLeaf();
        closeRow();
        hidePeek(0);
        hidePeek(1);
        board.big(null);
        board.mark(null);
        for (const s of [0, 1]) wellEl(s).classList.remove('is-firing');
        const side = seatCard[1] === play.no ? 1 : seatCard[0] === play.no ? 0 : play.by;
        const from = slotRect(side);
        if (play.cancelled) {
          clearSlot(side);
          setVerb(side, null);
          // a pin planted before the player thought better of it
          for (const id of [...pins[0].keys()]) if (pins[0].get(id).no === play.no) (pins[0].delete(id), board.badge(id, 'pina', null));
          await cards.flyNo(play.no, from, handRect(play.no), { duration: 320 });
          hand.release(play.no);
          hand.live(true);
          R.hide();
          return;
        }
        const to = hud.rect(play.pile);
        if (seatCard[side] === play.no && to) cards.flyNo(play.no, from, to, { duration: 440, fade: true });
        // the card has gone to its pile; its picture stays in the seat, dimmed, until the next one
        slotEl(side).classList.add('is-past');
        await wait(480);
        R.hide();
        setActive(null);
      },

      destroy() {
        window.removeEventListener('resize', onResize);
        offTip();
        offLast?.();
        base.destroy();
      },
    };
    return P;
  },
};
