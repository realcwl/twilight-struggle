// 02 落点即选择. The drag is the decision, and the target comes first: a card carried out of the
// hand lights up everything it could land on. A country means operations there (a small fan of
// verbs opens at the country when more than one is possible), the table slot means the event, the
// space-race meter means the space race. Dice are thrown onto the map beside the country they
// decide, and what they did is written on a plate that hangs from that country. The opponent's
// card comes down from their hand and lands the same way.
import './02-drop.css';
import { basePresenter, carryLine, choiceList, decision, describe, playLine, ICON, KEYS } from '../core/base.js';
import { MODE_NAME, SIDE_NAME, ABORT } from '../core/game.js';

const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
const mid = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
const near = (r, x, y, pad) => !!r && x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad;
const sum = (mods) => mods.reduce((a, m) => a + m.n, 0);

export default {
  id: '02',
  name: '落点即选择',
  ref: '炉石的拖拽出牌 · 目标优先',
  idea: '把牌拖到哪，就是怎么用：拖到国家是在那里行动，拖到出牌位是事件，拖到太空竞赛是弃牌掷骰。骰子直接掷在那个国家旁边。',
  notes: {
    choose: '牌一离手，地图上能落的国家全部亮起，左下的出牌位写着“事件”，右上的太空竞赛写着“弃牌掷骰”。牌悬在哪个国家上，那个国家就站起来，头上露出在那里能做的事。只有一种能做就直接做；有几种就在国家头上开一把小扇面让你点。不想拖也行：点一下牌，它跟着指针走，再点落点。',
    target: '目标就是落点，不再有“先选方式再选国家”这一步。扇面上每一项都写着代价：放置每点花几点、政变要掷几、调整你比对手多加几；做不了的灰掉并写明原因（地区被核危机封锁、不相邻……）。',
    dice: '骰子从你的出牌位（对手的从他手牌处）抛到目标国家旁边，在地图上弹一下停住；国家脚下挂一块小牌，先写要掷几，落定后把算式和结果填上。太空竞赛的骰子落在太空竞赛刻度下面。',
    guide: '影响力的变化就发生在国家头上。核危机、军事行动、胜利点的变化，由一颗彗星从那个国家飞到对应刻度，刻度亮框并留下一个“4 → 3”的小签，一直留到下一张牌打出。',
    opponent: '对手的牌先在他手牌下面亮出来给你读，然后缩小飞下来，“落”在目标国家（或出牌位、太空竞赛）上，国家头上写出“苏联 · 政变”，接着骰子同样掷在那个国家旁边。他动过的国家和刻度都留着红色小签。',
  },
  pros: ['一个动作同时回答“用哪张、怎么用、打哪里”，熟了以后最快', '所有信息都贴在事情发生的地方，视线不用离开地图', '骰子掷在国家旁边，结果和国家天然连在一起'],
  cons: ['第一次玩要学三种落点，没有一屏摆开的菜单', '节点密的地方（欧洲）拖放需要先放大地图', '事件效果只在牌靠近出牌位时才显示，不像菜单那样一直在'],
  mount(ctx) {
    const base = basePresenter(ctx);
    const { fx, board, hand, hud, cards, layer, G } = ctx;
    const R = base.ui.ribbon;
    const wait = fx.wait;
    const followers = new Set();
    let pointer = { x: innerWidth / 2, y: innerHeight / 2 };
    const onMove = (e) => (pointer = { x: e.clientX, y: e.clientY });
    window.addEventListener('pointermove', onMove, true);

    /* ------------------------------------------------------------------ small pieces */
    const put = (cls, html = '') => {
      const n = fx.el('div', cls, html);
      layer.appendChild(n);
      return n;
    };
    /** Keeps an element at a moving screen point (a map node) until the returned function is called. */
    function follow(n, point) {
      let on = true;
      const stop = () => {
        on = false;
        followers.delete(stop);
      };
      const tick = () => {
        if (!on || !n.isConnected) return stop();
        const p = point();
        n.style.visibility = p ? '' : 'hidden';
        if (p) {
          n.style.left = p.x + 'px';
          n.style.top = p.y + 'px';
        }
        requestAnimationFrame(tick);
      };
      followers.add(stop);
      tick();
      return stop;
    }
    /** Brings a country near the middle of the view if it is not there already. */
    async function centreOn(id) {
      const p = board.at(id);
      const w = innerWidth;
      const h = innerHeight;
      if (p && p.x > w * 0.24 && p.x < w * 0.76 && p.y > h * 0.3 && p.y < h * 0.62) return;
      await board.show(id, { force: true });
    }

    /* ---- a tag that hangs under a country: what is being done there, and the dice's verdict */
    let tag = null;
    function closeTag() {
      tag?.stop();
      tag?.el.remove();
      tag = null;
    }
    function openTag(id, side, html) {
      closeTag();
      const n = put(`d2-tag ${side === 0 ? 'a' : 'b'}`, html);
      tag = { el: n, id, stop: follow(n, () => board.at(id)) };
      return n;
    }

    /* ---- a small slip left on a meter, saying how it just changed */
    const slips = new Map();
    function slip(name, text, cls) {
      slips.get(name)?.remove();
      const r = hud.rect(name);
      const pane = hud.pane(name)?.getBoundingClientRect() ?? r;
      if (!r) return;
      const n = put(`d2-slip ${cls}`, text);
      n.style.left = pane.left + 'px';
      n.style.top = r.top + r.height / 2 + 'px';
      slips.set(name, n);
    }
    function clearSlips() {
      for (const n of slips.values()) n.remove();
      slips.clear();
    }

    /* ---- the two places off the map a card can land */
    /** The note about an event stands on top of the bottom-left pane, over the open sea. */
    function placeNote(note) {
      const pane = (hud.pane('played') ?? hud.el('played')).getBoundingClientRect();
      note.style.left = pane.left + 'px';
      note.style.bottom = innerHeight - pane.top + 1.4 * rem() + 'px';
    }
    let zones = null;
    function closeZones() {
      zones?.slot.remove();
      zones?.space?.remove();
      zones?.note.remove();
      zones = null;
    }
    const lineList = (lines) => lines.map((l) => `<li class="${l.warn ? 'warn' : ''}${l.lethal ? ' lethal' : ''}">${l.warn ? ICON.warn : ''}<span>${l.text}</span></li>`).join('');
    function openZones(ch, { headline }) {
      closeZones();
      const ev = ch.byKey.event;
      const sp = ch.byKey.space;
      const evOk = headline || ev.ok;
      const slot = put(`d2-zone d2-zone-slot ${evOk ? '' : 'is-no'}`, `<b>${headline ? '头条' : '事件'}</b><span>${evOk ? '落在这里' : '对手的事件'}</span>`);
      const sr = hud.rect('played');
      Object.assign(slot.style, { left: sr.left + 'px', top: sr.top + 'px', width: sr.width + 'px', height: sr.height + 'px' });
      const note = put(`d2-note ${ev.theirs ? 'b' : ''}`,
        `<div class="nt-head">${ICON.event}<b>${headline ? '作为头条事件' : ev.theirs ? '苏联的事件' : '作为事件'}</b></div><ul>${lineList(ev.lines)}</ul>` +
        `<p>${!evOk ? '你不能主动发动对手的事件。用这张牌行动时它照样发生；只有太空竞赛能躲开。' : ev.theirs ? '这是对手的事件：打成头条，受益的是苏联。' : ev.sub}</p>`);
      placeNote(note);
      let space = null;
      if (!headline) {
        const r = hud.rect('space');
        space = put(`d2-zone d2-zone-space ${sp.ok ? '' : 'is-no'}`, `<b>${ICON.space}太空竞赛</b><span>${sp.ok ? `弃掉这张牌 · ${sp.sub.split(' · ')[1]}${ch.fires ? ' · 不触发苏联事件' : ''}` : sp.why}</span>`);
        Object.assign(space.style, { left: r.left - 8 + 'px', top: r.top - 8 + 'px', width: r.width + 16 + 'px', height: r.height + 16 + 'px' });
      }
      zones = { slot, space, note, evOk, spOk: sp.ok, spWhy: sp.why };
    }
    /** Which zone a screen point is on: 'slot' | 'space' | null. Lights the zone as a side effect. */
    function zoneAt(x, y) {
      if (!zones) return null;
      const u = rem();
      const z = near(zones.slot.getBoundingClientRect(), x, y, 3.2 * u) ? 'slot' : zones.space && near(zones.space.getBoundingClientRect(), x, y, 1.4 * u) ? 'space' : null;
      zones.slot.classList.toggle('is-hot', z === 'slot');
      zones.space?.classList.toggle('is-hot', z === 'space');
      zones.note.classList.toggle('is-on', z === 'slot');
      return z;
    }

    /* ---- what can be done at one country with this card */
    function verbsAt(ch, id) {
      const o = ch.options;
      const pts = ch.points;
      const pl = o.place.targets.get(id);
      const cp = o.coup.targets.get(id);
      const ra = o.realign.targets.get(id);
      const noFoe = '这里没有对手的影响力';
      return [
        pl
          ? pl.cost <= pts
            ? { key: 'place', ok: true, sub: pl.cost > 1 ? `对手控制 · 每点花 ${pl.cost}` : `${pts} 点 · 每点放 1` }
            : { key: 'place', ok: false, why: '对手控制，每点要花 2：这张牌不够' }
          : { key: 'place', ok: false, why: '和你的影响力不相邻' },
        cp
          ? { key: 'coup', ok: true, sub: cp.need ? `掷出 ≥${cp.need} 成功 · ${Math.round(cp.chance * 100)}%` : '点数太低，不可能成功', risk: cp.key ? `战场国：核危机 ${G.crisis} → ${cp.crisisTo}` : '' }
          : { key: 'coup', ok: false, why: o.coup.locked.get(id) ?? noFoe },
        ra
          ? { key: 'realign', ok: true, sub: `掷 ${pts} 次 · 你 +${sum(ra.mods[0])} 对 苏 +${sum(ra.mods[1])}` }
          : { key: 'realign', ok: false, why: o.realign.locked.get(id) ?? noFoe },
      ];
    }

    /* ---- the fan of verbs at a country */
    let wheel = null;
    function closeWheel() {
      wheel?.stop();
      wheel?.off?.();
      wheel?.el.remove();
      wheel = null;
    }
    /** peek: a glance while the card hovers; open: the real choice. Resolves with a verb key or null. */
    function showWheel(ch, id, { open }) {
      if (wheel && wheel.id === id && wheel.open === open) return wheel.promise;
      closeWheel();
      const verbs = verbsAt(ch, id);
      const below = (board.at(id)?.y ?? 400) < 24 * rem();
      const n = put(`d2-wheel ${open ? 'is-open' : 'is-peek'} ${below ? 'is-below' : ''}`,
        verbs
          .map(
            (v, i) =>
              `<button type="button" class="wh-verb p${i} ${v.ok ? '' : 'is-off'}" data-key="${v.key}" ${v.ok && open ? '' : 'disabled'}>` +
              `<i class="wh-ic">${ICON[v.key]}</i><b>${MODE_NAME[v.key]}${open && v.ok ? `<kbd>${KEYS[v.key].toUpperCase()}</kbd>` : ''}</b>` +
              `<span>${v.ok ? v.sub : v.why}</span>${v.ok && v.risk ? `<em>${ICON.warn}${v.risk}</em>` : ''}</button>`,
          )
          .join('') + (open ? `<div class="wh-foot">${ch.fires ? '<em>行动之后，苏联事件照样发生</em>' : ''}<button type="button" class="wh-back">收回这张牌<kbd>Esc</kbd></button></div>` : ''),
      );
      let resolve;
      const promise = new Promise((r) => (resolve = r));
      wheel = { el: n, id, open, promise, stop: follow(n, () => board.at(id)) };
      if (open) {
        const keymap = { escape: () => resolve(null) };
        for (const b of n.querySelectorAll('.wh-verb:not(:disabled)')) {
          b.addEventListener('click', () => resolve(b.dataset.key));
          keymap[KEYS[b.dataset.key]] = () => resolve(b.dataset.key);
        }
        n.querySelector('.wh-back').addEventListener('click', () => resolve(null));
        wheel.off = ctx.keys(keymap);
      }
      return promise;
    }

    /* ---- the card while it is being carried: small, hanging from a pin at the pointer */
    let ghost = null;
    function closeGhost() {
      ghost?.remove();
      ghost = null;
    }
    function openGhost(no) {
      closeGhost();
      ghost = put('d2-ghost is-big', '<i class="gh-pin"></i><div class="gh-card"></div>');
      cards.put(no, ghost.querySelector('.gh-card'));
      return ghost;
    }
    const moveGhost = (x, y, small) => {
      if (!ghost) return;
      ghost.style.left = x + 'px';
      ghost.style.top = y + 'px';
      ghost.classList.toggle('is-big', !small);
    };

    function say(x, y, text) {
      const n = put('d2-say', text);
      n.style.left = x + 'px';
      n.style.top = y + 'px';
      setTimeout(() => n.remove(), 1700);
    }

    /* ------------------------------------------------------------------ choosing: carry a card to where it is used */
    /** Resolves with { no, key, target } once a card has landed somewhere that means something. */
    function carry({ headline = false } = {}) {
      return new Promise((resolve, reject) => {
        let cur = null; // { no, ch, drop:Set, sticky, offs:[] }
        const idle = () =>
          R.set({ who: headline ? '头条阶段' : '你的行动', side: 0, title: headline ? '把一张牌拖到出牌位' : '把一张牌拖到它要去的地方', text: headline ? '它会作为头条事件发生 · 也可以先点牌，再点出牌位' : '国家 = 在那里行动 · 出牌位 = 事件 · 太空竞赛 = 弃牌掷骰' });

        function begin(no, sticky) {
          const ch = choiceList(ctx, no);
          const drop = new Set();
          const locked = new Map();
          const warn = [];
          if (!headline)
            for (const id of ctx.W.ids) {
              const v = verbsAt(ch, id);
              if (v.some((x) => x.ok)) drop.add(id);
              else if (ch.options.coup.locked.has(id)) locked.set(id, ch.options.coup.locked.get(id));
              if (v[1].ok && v[1].risk) warn.push(id);
            }
          cur = { no, ch, drop, sticky, offs: [] };
          board.mark({ kind: 'drop', ok: drop, locked, warn, land: false });
          openZones(ch, { headline });
          openGhost(no);
          layer.classList.add('is-carrying');
          R.set({
            who: `行动 ${ch.points} 点`, side: 0, title: `《${ch.card.title}》`,
            text: headline ? '落在左下的出牌位：作为头条' : '落在发光的国家：在那里行动 · 出牌位：事件 · 右上：太空竞赛',
            buttons: sticky ? [{ label: '收回', key: 'escape', keyLabel: 'Esc', on: () => cancel() }] : [],
          });
          if (sticky) {
            hand.hold(no);
            hand.live(false);
            const tick = (e) => hover(e.clientX, e.clientY, true);
            window.addEventListener('pointermove', tick, true);
            cur.offs.push(() => window.removeEventListener('pointermove', tick, true));
            cur.offs.push(board.onClick((id, e) => land(e.clientX, e.clientY, true)));
            const z = (e) => land(e.clientX, e.clientY, true);
            zones.slot.addEventListener('click', z);
            zones.space?.addEventListener('click', z);
            hover(pointer.x, pointer.y, true);
          }
        }

        function hover(x, y, armed) {
          if (!cur) return;
          moveGhost(x, y, armed);
          const z = armed ? zoneAt(x, y) : zoneAt(-1e4, -1e4);
          const id = armed && !z ? board.countryAt(x, y) : null;
          if (id && cur.drop.has(id)) {
            board.big(id);
            showWheel(cur.ch, id, { open: false });
          } else {
            board.big(null);
            closeWheel();
          }
          ghost?.classList.toggle('is-over', !!z || (!!id && cur.drop.has(id)));
        }

        function end() {
          for (const off of cur?.offs ?? []) off();
          cur = null;
          closeZones();
          closeGhost();
          closeWheel();
          board.big(null);
          board.mark(null);
          layer.classList.remove('is-carrying');
        }
        function cancel() {
          const no = cur?.no;
          end();
          if (no) hand.release(no);
          hand.live(true);
          idle();
        }
        function finish(key, target) {
          const no = cur.no;
          base.ui.from = ghost.querySelector('.slot')?.getBoundingClientRect() ?? null;
          end();
          hand.hooks = {};
          R.hide();
          resolve({ no, key, target });
        }

        /** The card is let go at a point. True when it stays out of the hand. */
        function land(x, y, armed) {
          if (!cur) return false;
          if (!armed) return cur.sticky ? false : (end(), idle(), false);
          const z = zoneAt(x, y);
          if (z === 'slot') {
            if (zones.evOk) return finish('event'), true;
            say(x, y, '对手的事件：你不能主动发动它');
          } else if (z === 'space') {
            if (zones.spOk) return finish('space'), true;
            say(x, y, `太空竞赛：${zones.spWhy}`);
          } else {
            const id = board.countryAt(x, y);
            if (id && cur.drop.has(id)) {
              const ok = verbsAt(cur.ch, id).filter((v) => v.ok);
              if (ok.length === 1) return finish(ok[0].key, id), true;
              // several things could be done here: the fan opens for real
              const state = cur;
              const no = cur.no;
              for (const off of state.offs.splice(0)) off();
              hand.hooks = {};
              hand.live(false);
              closeGhost();
              openGhost(no);
              ghost.classList.add('is-parked');
              closeZones();
              board.mark({ kind: 'drop', ok: [id], land: true, lift: [id] });
              board.big(id);
              R.set({ who: `行动 ${state.ch.points} 点`, side: 0, title: ctx.name(id), text: '在这里做什么？' });
              centreOn(id)
                .then(() => {
                  const p = board.at(id);
                  if (p) moveGhost(p.x + 15 * rem(), p.y + 3 * rem(), true);
                  return showWheel(state.ch, id, { open: true });
                })
                .then((key) => {
                  if (!cur) return;
                  if (key) return finish(key, id);
                  end();
                  hand.release(no);
                  hand.live(true);
                  arm();
                  idle();
                })
                .catch(() => {});
              return true;
            }
            if (id) {
              const v = verbsAt(cur.ch, id);
              say(x, y, `${ctx.name(id)}：${v.find((q) => q.why && q.why !== '这里没有对手的影响力')?.why ?? '这张牌在这里什么也做不了'}`);
            } else if (!cur.sticky) say(x, y, headline ? '头条只能落在出牌位' : '这里不是落点');
          }
          if (cur?.sticky) return false;
          end();
          idle();
          return false;
        }

        function arm() {
          hand.live(true);
          hand.hooks = {
            onDragStart: (no) => begin(no, false),
            onDrag: (no, p) => hover(p.x, p.y, p.armed),
            onDrop: (no, p) => land(p.x, p.y, p.armed),
            onPick: (no) => begin(no, true),
          };
        }
        ctx.signal.addEventListener('abort', () => reject(ABORT), { once: true });
        arm();
        idle();
      });
    }

    /* ------------------------------------------------------------------ dice in the world */
    /** Throws a die from one screen point so that it comes to rest at another; resolves when it has landed. */
    async function throwDie(d, from, landAt, ms) {
      const die = ctx.makeDie({ side: d.side });
      const box = put(`d2-die ${d.side === 0 ? 'a' : 'b'}`);
      box.appendChild(die.el);
      const stop = follow(box, landAt);
      const to = landAt() ?? { x: innerWidth / 2, y: innerHeight / 2 };
      const dx = from.x - to.x;
      const dy = from.y - to.y;
      const lift = Math.min(160, 60 + Math.hypot(dx, dy) * 0.18);
      const a = box.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(0.7)`, opacity: 0, offset: 0 },
          { transform: `translate(${dx * 0.9}px, ${dy * 0.9 - lift * 0.4}px) scale(1.2)`, opacity: 1, offset: 0.08 },
          { transform: `translate(${dx * 0.42}px, ${dy * 0.42 - lift}px) scale(1.7)`, offset: 0.45, easing: 'cubic-bezier(0.5, 0, 0.9, 0.6)' },
          { transform: 'translate(0, 0) scale(1)', offset: 0.74, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)' },
          { transform: `translate(${-dx * 0.02 + 10}px, -${lift * 0.22}px) scale(1.12)`, offset: 0.86, easing: 'cubic-bezier(0.5, 0, 0.9, 0.6)' },
          { transform: 'translate(0, 0) scale(1)', offset: 1 },
        ],
        { duration: ms, fill: 'backwards' },
      );
      setTimeout(() => fx.burst(landAt() ?? to, d.side === 0 ? 'a' : 'b'), ms * 0.74);
      await Promise.all([die.roll(d.value, { ms: ms + 180, turns: 4, settle: 0.28 }), a.finished.catch(() => {})]);
      return { box, stop };
    }

    let thrown = [];
    function clearDice() {
      for (const t of thrown) {
        t.stop();
        t.box.classList.add('is-out');
        setTimeout(() => t.box.remove(), 350);
      }
      thrown = [];
    }

    /* ------------------------------------------------------------------ the presenter */
    return {
      ...base,

      // the headline has one destination, so there is nothing to aim at: dragged out is played
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
        base.ui.from = pick.rect;
        R.hide();
        return pick.no;
      },

      async decide() {
        const d = await carry();
        return decision(d.no, d.key, d.target);
      },

      async announce(play) {
        hand.live(false);
        clearSlips();
        clearDice();
        closeTag();
        board.clearBadges('last');
        const line = playLine(ctx, play);
        const verb = play.use === 'ops' ? MODE_NAME[play.mode] : line.what;
        if (play.headline) {
          await base.announce.call(this, play);
          R.set({ who: play.by === 0 ? '你的头条' : '苏联头条', side: play.by, title: `《${play.card.title}》`, text: '作为事件发生' });
          return;
        }
        const strip = () => R.set({ who: play.by === 0 ? '你的行动' : '苏联行动', side: play.by, title: `《${play.card.title}》`, text: `${line.what}${line.detail}` });
        if (play.by === 0) {
          strip();
          await base.ui.toTable(play.no, base.ui.from ?? hand.rectOf(play.no));
          base.ui.from = null;
        } else {
          R.hide();
          // the opponent's card: held up under their hand to be read, then it comes down and lands
          const show = put('d2-opp', `<div class="op-card"></div><div class="op-cap"><b>苏联打出</b><span>${line.what}${line.detail}</span></div>`);
          const c = cards.put(play.no, show.querySelector('.op-card'));
          await wait(1350);
          const from = c.getBoundingClientRect();
          show.remove();
          strip();
          if (play.target) await centreOn(play.target);
          const at = play.target ? board.at(play.target) : play.use === 'space' ? mid(hud.rect('space')) : mid(hud.rect('played'));
          openGhost(play.no);
          ghost.classList.add('is-theirs');
          // the small card hangs from a pin at its top left corner: start it exactly over the big one
          const u = rem();
          const s0 = from.width / (6.4 * u);
          const start = { x: from.left + from.width / 2 - s0 * 4.4 * u, y: from.top + from.height / 2 - s0 * 5.68 * u };
          moveGhost(start.x, start.y, true);
          await ghost.animate([{ transform: `translate(0, 0) scale(${s0})` }, { transform: `translate(${at.x - start.x}px, ${at.y - start.y}px) scale(1)` }], { duration: 680, easing: 'cubic-bezier(0.3, 0.1, 0.2, 1)', fill: 'forwards' }).finished;
          if (play.target) {
            board.big(play.target);
            board.ring(play.target, 'b');
          } else fx.burst(at, 'b');
          await wait(420);
          const rect = ghost.querySelector('.slot').getBoundingClientRect();
          closeGhost();
          await base.ui.toTable(play.no, rect);
          if (play.use === 'event') {
            // what their event does, read out beside the table slot before it happens
            const note = put('d2-note b is-on', `<div class="nt-head">${ICON.event}<b>苏联的事件</b></div><ul>${lineList(choiceList(ctx, play.no).byKey.event.lines)}</ul>`);
            placeNote(note);
            await wait(1700);
            note.remove();
          }
        }
        if (play.target) {
          await centreOn(play.target);
          board.big(play.target);
          board.ring(play.target, play.by === 0 ? 'a' : 'b');
          openTag(play.target, play.by, `<b class="tg-verb">${ICON[play.mode] ?? ''}${SIDE_NAME[play.by]} · ${verb}</b>`);
          await wait(380);
        } else if (play.use === 'space') {
          fx.flash(hud.el('space'), { cls: play.by === 0 ? 'a' : 'b', label: `${SIDE_NAME[play.by]} · 太空竞赛`, ms: 1200, place: 'below' });
          await wait(500);
        }
      },

      /* ---- placing: every click drops one point where it is made */
      async place(session, play) {
        let resolve;
        let act = new Promise((r) => (resolve = r));
        const press = (what) => resolve(what);
        const purse = put('d2-purse');
        const stopPurse = follow(purse, () => ({ x: pointer.x, y: pointer.y }));
        for (const s of session.spent) {
          board.pop(s.id, '+1', 'a');
          board.ring(s.id, 'a');
        }
        const draw = () => {
          const t = session.targets();
          const ok = new Map([...t].filter(([, v]) => v.ok));
          const spentIds = [...new Set(session.spent.map((s) => s.id))];
          board.mark({ kind: 'place', ok, lift: spentIds, land: false });
          board.clearBadges('cost');
          board.clearBadges('put');
          for (const [id, v] of ok) if (v.cost > 1) board.badge(id, 'cost', `${v.cost}`, 'b');
          for (const id of spentIds) board.badge(id, 'put', `+${session.count(id)}`, 'a');
          purse.innerHTML = Array.from({ length: session.points }, (_, i) => `<i class="${i < session.left ? '' : 'used'}"></i>`).join('');
          purse.classList.toggle('is-empty', !session.left);
          const none = !session.spent.length;
          const last = session.spent[session.spent.length - 1]?.id ?? play.target;
          if (last) {
            const n = openTag(last, 0, `<b class="tg-verb">${ICON.place}放置影响力</b><span class="tg-left">${session.left ? `还有 <b>${session.left}</b> 点 · 点发光的国家` : '点数用完了'}</span><span class="tg-btns"></span>`);
            const btns = n.querySelector('.tg-btns');
            const mk = (label, kbd, what, cls = '') => {
              const b = fx.el('button', cls, `${label}<kbd>${kbd}</kbd>`);
              b.type = 'button';
              b.addEventListener('click', () => press(what));
              btns.appendChild(b);
            };
            if (!none) mk('撤销', '⌫', 'undo');
            if (none) mk('收回这张牌', 'Esc', 'cancel');
            else mk('完成', '↵', 'done', 'primary');
          }
          R.set({ who: '你的行动', side: 0, title: `《${play.card.title}》 · ${MODE_NAME.place}`, text: session.left ? '每点一下落 1 点 · 标着 ×2 的国家要花 2 点' : '确认，或撤销重放', pips: { total: session.points, left: session.left } });
          return ok;
        };
        const off = ctx.keys({ backspace: () => press('undo'), enter: () => press('done'), escape: () => press(session.spent.length ? 'undo' : 'cancel') });
        let result = true;
        for (;;) {
          const ok = draw();
          act = new Promise((r) => (resolve = r));
          const got = await Promise.race([session.left && ok.size ? board.pick(ok) : new Promise(() => {}), act]);
          board.cancelPick();
          if (got === 'undo') session.undo();
          else if (got === 'done') {
            if (session.spent.length) break;
          } else if (got === 'cancel') {
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
        off();
        stopPurse();
        purse.remove();
        closeTag();
        board.mark(null);
        board.clearBadges('cost');
        board.clearBadges('put');
        R.hide();
        return result;
      },

      /* ---- a further country: another realignment roll, or an event that asks for one */
      async pickTarget(req) {
        let resolve;
        const act = new Promise((r) => (resolve = r));
        const kind = req.mode;
        const warn = kind === 'coup' ? [...req.targets].filter(([, p]) => p.key).map(([id]) => id) : [];
        board.mark({ kind, ok: req.targets, locked: req.locked, warn, land: false });
        for (const [id, p] of req.targets) {
          if (kind === 'coup') board.badge(id, 'need', p.need ? `≥${p.need}` : '✕', p.need ? '' : 'off');
          if (kind === 'realign') board.badge(id, 'need', p.edge > 0 ? `+${p.edge}` : p.edge < 0 ? `−${-p.edge}` : '±0', p.edge > 0 ? 'good' : p.edge < 0 ? 'bad' : '');
        }
        for (const id of req.locked.keys()) board.badge(id, 'lock', ICON.lock);
        const text = kind === 'coup' ? '点一个有对手影响力的国家' : kind === 'realign' ? `还能掷 ${req.left} 次 · 点一个国家再掷（可以还是同一个）` : `${req.hint}（${req.total - req.left + 1} / ${req.total}）`;
        const buttons = [];
        if (req.optional) buttons.push({ label: '到此为止', key: 'enter', keyLabel: '↵', on: () => resolve(null), primary: true });
        if (req.cancel) buttons.push({ label: '收回这张牌', key: 'escape', keyLabel: 'Esc', on: () => resolve(null) });
        R.set({ who: '你的行动', side: 0, title: kind === 'event' ? `《${req.title}》` : MODE_NAME[kind], text, pips: req.total > 1 ? { total: req.total, left: req.left } : null, buttons });
        const off = board.onHover((id) => {
          if (id && req.locked.has(id)) return R.say(`${ICON.lock}${ctx.name(id)}：${req.locked.get(id)}`, 'bad');
          const p = id && req.targets.get(id);
          if (!p) return R.say(text);
          if (kind === 'coup') R.say(`${ctx.name(id)}：${p.need ? `掷出 ≥${p.need} 成功（${Math.round(p.chance * 100)}%）` : '不可能成功'}${p.key ? ` · ${ICON.warn}战场国：核危机 ${G.crisis} → ${p.crisisTo}` : ''}`, p.key ? 'warn' : '');
          else if (kind === 'realign') R.say(`${ctx.name(id)}：你 +${sum(p.mods[0])}，苏联 +${sum(p.mods[1])}`);
        });
        const id = await Promise.race([board.pick(req.targets), act]);
        off();
        board.cancelPick();
        board.clearBadges('need');
        board.clearBadges('lock');
        board.mark(null);
        if (id) {
          board.big(id);
          board.ring(id, 'a');
          if (kind !== 'event') openTag(id, 0, `<b class="tg-verb">${ICON[kind]}美国 · ${MODE_NAME[kind]}</b>`);
        } else R.hide();
        return id;
      },

      /* ---- dice, thrown onto the map beside the country they decide */
      async roll(spec) {
        clearDice();
        const u = rem();
        const two = spec.dice.length > 1;
        const side = spec.by;
        let anchor; // a function giving the point the dice gather round
        if (spec.id) {
          await centreOn(spec.id);
          board.big(spec.id);
          anchor = () => board.at(spec.id);
        } else {
          // the space race is decided just under the pane that holds its meter
          const r = hud.rect('space');
          const pane = hud.pane('space')?.getBoundingClientRect() ?? r;
          anchor = () => ({ x: r.left + r.width * 0.5, y: pane.bottom + 9.5 * u });
        }
        // the plate under the country (or under the space meter): first what is needed
        const need =
          spec.kind === 'coup'
            ? `要超过 <b>${spec.bar.n}</b><small>${spec.bar.label}</small>${spec.need ? ` · 掷出 <b>≥${spec.need}</b>` : ' · 不可能成功'}`
            : spec.kind === 'space'
              ? `掷出 <b>1–${spec.max}</b> 前进一步`
              : '点数高的一方胜出 · 输家移除差额';
        const seat = (d) => `<span class="pl-seat ${d.side === 0 ? 'a' : 'b'}"><i>${SIDE_NAME[d.side]}</i><b class="pl-die">?</b>${d.mods.map((m) => `<em title="${m.label}">+${m.n}<small>${m.label}</small></em>`).join('')}<u>=</u><b class="pl-total">?</b></span>`;
        const html =
          `<b class="tg-verb">${ICON[spec.kind] ?? ''}${SIDE_NAME[side]} · ${MODE_NAME[spec.kind]}</b>` +
          `<div class="pl-need">${need}</div><div class="pl-rows">${spec.dice.map(seat).join(two ? '<i class="pl-vs">对</i>' : '')}</div><div class="pl-verdict"></div>`;
        let plate;
        if (spec.id) plate = openTag(spec.id, side, html);
        else {
          closeTag();
          plate = put(`d2-tag ${side === 0 ? 'a' : 'b'} is-free`, html);
          tag = { el: plate, id: null, stop: follow(plate, () => ({ x: anchor().x, y: anchor().y - 2.2 * u })) };
        }
        plate.classList.add('is-plate', `k-${spec.kind}`);
        R.say('掷骰…');
        await wait(700);
        // where each die comes from: the thrower's side of the table
        const mine = mid(hud.rect('played'));
        const theirs = mid(hud.rect('opp'));
        const jobs = spec.dice.map((d, i) => {
          const off = !spec.id ? 0 : two ? (d.side === 0 ? -7.8 : 7.8) : 7.8;
          const landAt = () => {
            const p = anchor();
            return p ? { x: p.x + off * u, y: p.y - (spec.id ? 0.6 : 4.6) * u } : null;
          };
          return throwDie(d, d.side === 0 ? mine : theirs, landAt, 1150 + i * 320);
        });
        thrown = await Promise.all(jobs);
        plate.querySelectorAll('.pl-die').forEach((n, i) => (n.textContent = spec.dice[i].value));
        plate.classList.add('is-read');
        await wait(420);
        plate.querySelectorAll('.pl-total').forEach((n, i) => (n.textContent = spec.dice[i].total));
        plate.classList.add('is-summed');
        await wait(420);
        const mood = spec.kind === 'realign' ? (spec.winner === null ? 'even' : spec.winner === 0 ? 'good' : 'bad') : spec.ok === (spec.by === 0) ? 'good' : 'bad';
        plate.querySelector('.pl-verdict').textContent = spec.text;
        plate.classList.add('is-done', mood);
        if (spec.id) board.ring(spec.id, mood === 'bad' ? 'bad' : side === 0 ? 'a' : 'b');
        R.say(spec.text, mood === 'bad' ? 'bad' : '');
        await wait(1250);
        // the dice leave; the plate shrinks to its verdict and stays while the consequences play
        clearDice();
        plate.classList.add('is-small');
      },

      /* ---- one consequence */
      async step(e, commit, cause) {
        const d = describe(ctx, e);
        const source = () => (cause?.id && board.at(cause.id)) || hud.rect('played');
        if (e.t === 'inf') {
          await centreOn(e.id);
          board.big(e.id);
          board.ring(e.id, d.cls);
          R.say(d.text, d.cls);
          await wait(240);
          commit();
          board.pop(e.id, d.short, d.cls);
          if (d.took) board.pop(e.id, d.took.replace(' · ', ''), 'gold late');
          if (cause?.by === 1) board.badge(e.id, 'last', d.short, d.cls);
          await wait(950);
        } else if (d.meter) {
          const target = hud.el(d.meter);
          const crisis = e.t === 'crisis';
          R.say(d.text + (d.why ? `<small>${d.why}</small>` : ''), d.cls);
          if (crisis && cause?.id) {
            // the country it started from says so first
            board.ring(cause.id, 'bad');
            board.pop(cause.id, e.d < 0 ? '核危机 ↓' : '核危机 ↑', e.d < 0 ? 'b' : 'gold');
            await wait(520);
          }
          await fx.tracer(source(), target, { cls: d.cls === 'good' ? 'gold' : d.cls, ms: crisis ? 900 : 640, bend: 0.3 });
          commit();
          fx.flash(target, { label: d.text, cls: d.cls, ms: crisis ? 3000 : 2200, place: hud.side(d.meter) });
          if (crisis && e.d < 0) fx.shake(hud.pane('crisis') ?? target, 6);
          slip(d.meter, crisis ? `${e.from} → ${e.to}` : d.short, `${d.cls}${cause?.by === 1 ? ' theirs' : ''}`);
          await wait(crisis ? 1900 : 1150);
        } else {
          R.say(d.text, 'note');
          if (e.id) board.pop(e.id, '—', 'note');
          commit();
          await wait(1100);
        }
      },

      async trigger(play) {
        closeTag();
        const note = put('d2-note b is-on', `<div class="nt-head">${ICON.event}<b>苏联事件触发</b></div><ul>${lineList(choiceList(ctx, play.no).byKey.event.lines)}</ul><p>你用了对手的牌行动：它的事件现在发生。</p>`);
        placeNote(note);
        R.set({ who: '苏联事件', side: 1, title: `《${play.card.title}》`, text: '你用了对手的牌行动：它的事件现在发生' });
        fx.flash(hud.el('played'), { cls: 'b', ms: 1400 });
        await wait(1900);
        note.remove();
      },

      async settle(play) {
        clearDice();
        closeTag();
        closeWheel();
        closeGhost();
        closeZones();
        await base.settle.call(this, play);
      },

      destroy() {
        window.removeEventListener('pointermove', onMove, true);
        for (const stop of [...followers]) stop();
        base.destroy();
      },
    };
  },
};
