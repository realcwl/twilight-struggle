// 05 指令环. A wheel around the card. The card lifts and five petals open round it: the event on
// top, the four operations to either side. Pointing at a petal shows on the map where it could be
// done and says underneath what it would mean. Once chosen, the wheel folds into a small hub that
// counts the points as beads. When dice are needed the ring becomes a dial of six sectors, the ones
// that succeed lit before the throw, and a pointer sweeps round it while the die tumbles in the
// middle. Every consequence then leaves the hub as a bead and flies to the place it changes.
// The opponent has the same instrument, in red, hanging from the top of the screen.
import './05-ring.css';
import { basePresenter, carryLine, choiceList, decision, describe, playLine, ICON } from '../core/base.js';
import { MODE_NAME, SIDE_NAME } from '../core/game.js';

const rad = (d) => (d * Math.PI) / 180;
/** A point on a circle: 0 degrees is straight up, positive is clockwise. */
const polar = (cx, cy, r, deg) => [cx + r * Math.sin(rad(deg)), cy - r * Math.cos(rad(deg))];
const pt = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
/** A piece of a ring between two radii and two angles. */
function sector(cx, cy, r0, r1, a0, a1) {
  const big = a1 - a0 > 180 ? 1 : 0;
  return `M${pt(polar(cx, cy, r1, a0))}A${r1},${r1} 0 ${big} 1 ${pt(polar(cx, cy, r1, a1))}L${pt(polar(cx, cy, r0, a1))}A${r0},${r0} 0 ${big} 0 ${pt(polar(cx, cy, r0, a0))}Z`;
}
const arc = (cx, cy, r, a0, a1) => `M${pt(polar(cx, cy, r, a0))}A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${pt(polar(cx, cy, r, a1))}`;
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const sideCls = (s) => (s === 0 ? 'a' : s === 1 ? 'b' : '');
const sum = (mods) => mods.reduce((a, m) => a + m.n, 0);

// where each petal sits on the upper half of the wheel
const PETAL = { place: -72, realign: -36, event: 0, coup: 36, space: 72 };
const ORDER = ['place', 'realign', 'event', 'coup', 'space'];

export default {
  id: '05',
  name: '指令环',
  ref: '轮盘菜单 / 仪表',
  idea: '牌升起来，五片花瓣绕着它展开；选定后轮盘收成一个小转盘，点数是盘上的珠子；掷骰时它变成六格刻度盘，先看到哪几格算成功，再看指针停在哪。',
  notes: {
    choose: '牌升到屏幕下方正中，五片花瓣呈半圆展开：正上方是事件，左边放置、调整，右边政变、太空竞赛。指到哪一片，地图上亮出它能用的国家，花瓣下面的铭牌写出它的后果（事件的每一条、战场国的警告、“不触发对手事件”）。不能用的花瓣是暗的，写着原因。',
    target: '轮盘收成底部正中一个小转盘：中间是你选的行动，环上一圈珠子是还剩的点数，左右两段弧是“撤销”和“完成”。可选的国家带一圈虚线环；政变时每个国家脚下写着六格里成功几格（如 5/6），和之后的刻度盘是同一个数。',
    dice: '转盘升成一个六格刻度盘：1 到 6 各一格，能成功的格子在掷之前就亮着，格里写着掷到它会怎样。骰子在盘心翻滚，指针绕盘扫过、慢下来、停在掷出的那一格。调整阵营是蓝红两根指针同盘比大小。',
    guide: '每个后果是一颗珠子：从转盘上弹出来，飞到它要改的国家或刻度，那里随即反应。刻度旁边留一张小标签（“核危机 4→3”），过几秒才消失。',
    opponent: '对手的轮盘是红色的，倒挂在屏幕顶部他的手牌下面：他的牌在盘心，他选的那片花瓣亮起，然后同样的刻度盘、同样的珠子飞出。他动过的国家留红色角标，直到你出下一张牌。',
  },
  pros: ['五个选项的位置永远不变，几局之后靠肌肉记忆就能选', '掷骰前就看见成功的格子有几格，胜算是看出来的不是算出来的', '点数是珠子，用掉一颗少一颗，不用读数字', '双方用同一件“仪器”，对手的行动读法和自己的一样'],
  cons: ['花瓣里放不下太多字，细节要看下面的铭牌，视线要上下移一次', '轮盘和刻度盘都占屏幕下半中间，那里的国家（南部非洲、南美南端）会被挡住', '珠子飞行很快，后果多的时候像连发，分量不如把刻度拿到眼前', '调整阵营两根指针同盘，第一次看需要适应'],
  mount(ctx) {
    const { fx, board, hand, hud, cards, layer, G } = ctx;
    const wait = fx.wait;
    const el = fx.el;
    const base = basePresenter(ctx);
    const game = layer.parentElement;

    /* ------------------------------------------------------------------ the caption: one pill of text */
    const sayEl = el('div', 'r5-say');
    sayEl.hidden = true;
    layer.appendChild(sayEl);
    const say = {
      /** where: 'top' (under the opponent's hand), 'hub' (over the player's hub), 'opp' (under the opponent's hub) */
      set(html, where = 'hub', cls = '') {
        sayEl.hidden = false;
        sayEl.className = `r5-say at-${where} ${cls}`;
        sayEl.innerHTML = html;
      },
      clear() {
        sayEl.hidden = true;
      },
    };

    /* ------------------------------------------------------------------ the wheel */
    /** The five petals round a card. `flip` hangs it upside down (the opponent's, from the top). */
    function buildWheel({ no, list, by = 0, flip = false }) {
      const cx = 280;
      const cy = flip ? 118 : 276;
      const h = flip ? 404 : 540;
      const at = (key) => (flip ? 180 - PETAL[key] : PETAL[key]);
      const w = el('div', `r5-wheel ${sideCls(by)} ${flip ? 'is-flip' : ''}`);
      const petals = ORDER.map((key) => {
        const c = list[key];
        const a = at(key);
        return `<path class="r5-petal ${c.cls ?? ''}" data-key="${key}" d="${sector(cx, cy, 148, 272, a - 16.6, a + 16.6)}"/>`;
      }).join('');
      const rim = flip ? [arc(cx, cy, 282, 91, 269), arc(cx, cy, 138, 91, 269)] : [arc(cx, cy, 282, -89, 89), arc(cx, cy, 138, -89, 89)];
      const leaves = ORDER.map((key) => {
        const c = list[key];
        const [x, y] = polar(cx, cy, 211, at(key));
        return (
          `<div class="r5-leaf ${c.cls ?? ''}" data-key="${key}" style="left:${(x / 10).toFixed(2)}em;top:${(y / 10).toFixed(2)}em">` +
          `<i class="r5-ic">${ICON[key]}</i><b>${c.label}</b><span>${c.short ?? ''}</span>${c.hot ? `<kbd>${c.hot.toUpperCase()}</kbd>` : ''}</div>`
        );
      }).join('');
      w.innerHTML =
        `<svg class="r5-wheel-svg" viewBox="0 0 560 ${h}"><path class="r5-rim" d="${rim[0]}"/><path class="r5-rim in" d="${rim[1]}"/>${petals}</svg>` +
        `${leaves}<div class="r5-card" style="left:${cx / 10}em;top:${cy / 10}em"></div>`;
      cards.put(no, w.querySelector('.r5-card'));
      return w;
    }

    let wheel = null;
    let offOutside = null;
    function closeWheel() {
      wheel?.remove();
      wheel = null;
      offOutside?.();
      offOutside = null;
      board.mark(null);
      hand.away(false);
    }

    /** Opens the player's wheel on a card. Resolves with a choice key or null. */
    function openWheel(no, { headline = false } = {}) {
      closeWheel();
      const ch = choiceList(ctx, no);
      const d = deferred();
      const o = ch.options;
      const theirs = ch.fires && !headline;
      const list = {};
      for (const c of ch.list) {
        const ok = headline ? c.key === 'event' : c.ok;
        list[c.key] = {
          ...c,
          ok,
          why: headline && c.key !== 'event' ? '头条只能作为事件' : c.why,
          label: c.key === 'event' ? (headline ? '作为头条' : theirs ? '苏联的事件' : '事件') : c.label,
          hot: ok ? (headline ? '↵' : c.hot) : '',
          short:
            c.key === 'event'
              ? theirs
                ? '照样发生'
                : c.lines.length > 1
                  ? `${c.lines.length} 项后果`
                  : '1 项后果'
              : !ok
                ? '不可用'
                : c.key === 'place'
                  ? `${ch.points} 点`
                  : c.key === 'realign'
                    ? `掷 ${ch.points} 次`
                    : c.key === 'coup'
                      ? `${o.coup.targets.size} 国`
                      : '弃牌掷骰',
          cls: `${ok ? '' : 'is-off'} ${c.key === 'event' && theirs ? 'is-theirs' : ''} ${c.key === 'coup' && ok && c.risk ? 'is-risk' : ''} ${c.key === 'space' && ok && ch.fires ? 'is-safe' : ''}`,
        };
      }
      wheel = el('div', `r5-stage ${theirs ? 'is-theirs' : ''}`);
      wheel.appendChild(buildWheel({ no, list }));
      const plate = el('div', 'r5-plate pane gilt');
      wheel.appendChild(plate);
      layer.appendChild(wheel);
      hand.away(true);

      const lines = (ls) => `<ul>${ls.map((l) => `<li class="${l.warn ? 'warn' : ''}${l.lethal ? ' lethal' : ''}">${l.warn ? ICON.warn : ''}<span>${l.text}</span></li>`).join('')}</ul>`;
      const after = theirs ? `<p class="bad">${ICON.warn}之后苏联的事件照样发生</p>` : '';
      const detail = (key) => {
        const c = list[key];
        if (!key)
          return (
            `<b>《${ch.card.title}》<small>${headline ? '选作头条' : `${ch.points} 点`}</small></b>` +
            `<p>${headline ? '头条阶段：这张牌会作为事件发生。数值高的一方先结算。' : '指到一片花瓣上，看它能用在哪、会带来什么。'}</p>` +
            `<p class="foot">${headline ? '↵ 确定' : 'E Z X C V 直接选'} · Esc 或点地图${headline ? '换一张' : '收回'}</p>`
          );
        if (!c.ok && !(key === 'event' && theirs)) return `<b>${c.label}<small>不可用</small></b><p class="bad">${c.why}</p>`;
        if (key === 'event')
          return (
            `<b>${c.label}${c.hot ? `<kbd>${c.hot.toUpperCase()}</kbd>` : ''}</b>${lines(c.lines)}` +
            (theirs ? '<p class="bad">这是对手的事件：你不能主动发动它，但用这张牌行动时它照样发生。只有太空竞赛能躲开。</p>' : `<p class="foot">${c.sub}</p>`)
          );
        const head = `<b>${c.label}<kbd>${c.hot.toUpperCase()}</kbd></b>`;
        if (key === 'place') return `${head}<p>${ch.points} 点，可放在 ${o.place.targets.size} 个国家：你已有影响力的国家和它们的邻国。对手控制的国家每点花 2。</p>${after}`;
        if (key === 'realign')
          return `${head}<p>掷 ${ch.points} 次，${o.realign.targets.size} 国可选。每次双方各掷一骰加上各自的加值，输的一方移除差额的影响力。</p>${o.realign.locked.size ? `<p class="foot">${ICON.lock}${o.realign.locked.size} 国因核危机被封锁</p>` : ''}${after}`;
        if (key === 'coup')
          return `${head}<p>${o.coup.targets.size} 国可选。骰子 + ${ch.points} 要超过稳定度的两倍。</p>${c.risk ? `<p class="bad">${ICON.warn}${c.risk}（现在 ${G.crisis} 级）</p>` : ''}${o.coup.locked.size ? `<p class="foot">${ICON.lock}${o.coup.locked.size} 国被封锁</p>` : ''}${after}`;
        return `${head}<p>弃掉这张牌，掷出 1–${o.space.max} 就前进一步。</p>${ch.fires ? '<p class="good">不触发对手事件</p>' : ''}`;
      };
      const light = (key) => {
        for (const n of wheel.querySelectorAll('[data-key]')) n.classList.toggle('is-lit', n.dataset.key === key);
        plate.innerHTML = detail(key);
        board.mark(key && list[key].ok && list[key].mark ? list[key].mark : null);
      };
      light(null);

      const choose = (key) => d.resolve(key);
      const keymap = { escape: () => choose(null) };
      for (const p of wheel.querySelectorAll('.r5-petal')) {
        const c = list[p.dataset.key];
        p.addEventListener('pointerenter', () => light(c.key));
        p.addEventListener('pointerleave', () => light(null));
        if (!c.ok) continue;
        p.addEventListener('click', () => choose(c.key));
        keymap[headline ? 'enter' : c.hot] = () => choose(c.key);
      }
      // a click on the map puts the card back
      offOutside = board.onClick(() => choose(null));
      const off = ctx.keys(keymap);
      return d.promise.finally(off);
    }

    /* ------------------------------------------------------------------ the hub: what the wheel folds into */
    const hubs = [null, null];
    function hideHub(by) {
      if (by === undefined) return [0, 1].forEach(hideHub);
      hubs[by]?.el.remove();
      hubs[by]?.off?.();
      hubs[by] = null;
    }

    /**
     * A small disc for one side: the verb in the middle, beads round it, two arcs for buttons.
     *   beads: { total, left }          arcs: [{ at: 'l' | 'r', label, key, keyLabel, on, primary }]
     */
    function showHub(by, { verb, no = null, beads = null, arcs = [] }) {
      const top = by === 1;
      let h = hubs[by];
      if (!h) {
        const n = el('div', `r5-hub ${sideCls(by)} ${top ? 'is-top' : ''}`);
        layer.appendChild(n);
        h = hubs[by] = { el: n, off: null };
      }
      h.off?.();
      const cx = 170;
      const cy = top ? 104 : 156;
      const flip = (a) => (top ? 180 - a : a);
      const total = beads?.total ?? 0;
      const spread = Math.min(26, 150 / Math.max(1, total));
      const dots = Array.from({ length: total }, (_, i) => {
        const [x, y] = polar(cx, cy, 91, flip((i - (total - 1) / 2) * spread));
        return `<circle class="r5-bead ${i < beads.left ? '' : 'used'}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8.5"/>`;
      }).join('');
      const seg = { l: [-128, -58], r: [58, 128] };
      const arcsSvg = arcs.map((a, i) => `<path class="r5-arc ${a.primary ? 'primary' : ''}" data-i="${i}" d="${sector(cx, cy, 104, 138, seg[a.at][0], seg[a.at][1])}"/>`).join('');
      const arcsText = arcs
        .map((a) => {
          const [x, y] = polar(cx, cy, 121, a.at === 'l' ? -93 : 93);
          return `<span class="r5-arc-t ${a.primary ? 'primary' : ''}" style="left:${(x / 10).toFixed(2)}em;top:${(y / 10).toFixed(2)}em"><b>${a.label}</b><kbd>${a.keyLabel}</kbd></span>`;
        })
        .join('');
      h.el.innerHTML =
        `<svg viewBox="0 0 340 260"><circle class="r5-hub-ring" cx="${cx}" cy="${cy}" r="91"/><circle class="r5-hub-disc" cx="${cx}" cy="${cy}" r="74"/>${dots}${arcsSvg}</svg>` +
        `<div class="r5-hub-mid" style="left:${cx / 10}em;top:${cy / 10}em"><i class="r5-ic">${ICON[verb] ?? ICON.event}</i><b>${MODE_NAME[verb] ?? ''}</b></div>${arcsText}` +
        (no ? `<div class="r5-hub-card" style="left:${(cx - 86) / 10}em;top:${(cy + (top ? -26 : 26)) / 10}em"></div>` : '');
      if (no) cards.put(no, h.el.querySelector('.r5-hub-card'));
      const map = {};
      h.el.querySelectorAll('.r5-arc').forEach((p) => {
        const a = arcs[+p.dataset.i];
        p.addEventListener('click', () => a.on());
        map[a.key] = a.on;
      });
      h.off = ctx.keys(map);
      return h.el;
    }

    /** Where on the hub's rim a bead leaves from. */
    function hubPoint(by) {
      const n = hubs[by]?.el.querySelector('.r5-hub-ring');
      if (!n) return by === 1 ? hud.rect('opp') : hud.rect('played');
      const r = n.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: by === 1 ? r.bottom : r.top };
    }

    /** One bead leaves the hub for a place. Resolves when it arrives. */
    async function bead(by, to, cls) {
      const from = hubPoint(by);
      const p = 'x' in from ? from : { x: from.left + from.width / 2, y: from.top + from.height / 2 };
      const o = game.getBoundingClientRect();
      const b = el('i', `r5-loose ${cls}`);
      b.style.left = p.x - o.left + 'px';
      b.style.top = p.y - o.top + 'px';
      layer.appendChild(b);
      await wait(260);
      b.remove();
      await fx.tracer(p, to, { cls: cls === 'good' ? 'gold' : cls === 'note' ? 'gold' : cls, ms: 600, bend: 0.18 });
    }

    /** A small tag that stays beside a meter for a while after it has changed. */
    function tag(name, text, cls) {
      const target = hud.el(name);
      const pane = hud.pane(name);
      if (!target || !pane) return;
      for (const old of layer.querySelectorAll(`.r5-tag[data-m="${name}"]`)) old.remove();
      const r = target.getBoundingClientRect();
      const pr = pane.getBoundingClientRect();
      const o = game.getBoundingClientRect();
      const left = pane.matches('.tl');
      const n = el('div', `r5-tag ${cls} ${left ? 'on-right' : 'on-left'}`, `<i></i>${text}`);
      n.dataset.m = name;
      n.style.top = r.top + r.height / 2 - o.top + 'px';
      if (left) n.style.left = pr.right - o.left + 'px';
      else n.style.right = o.right - pr.left + 'px';
      layer.appendChild(n);
      setTimeout(() => n.classList.add('is-out'), 9000);
      setTimeout(() => n.remove(), 9600);
    }

    /* ------------------------------------------------------------------ the dial */
    let dial = null;
    function closeDial() {
      const n = dial;
      dial = null;
      n?.classList.add('is-out');
      setTimeout(() => n?.remove(), 380);
    }

    /** Sweeps a needle round to a face of the dial, lighting the sector it passes. */
    function sweep(box, needle, value, ms, turns) {
      const end = turns * 360 + (value - 1) * 60;
      const t0 = performance.now();
      return new Promise((res) => {
        const tick = (now) => {
          const t = Math.min(1, (now - t0) / ms);
          const e = 1 - Math.pow(1 - t, 3.4);
          const a = end * e;
          needle.style.transform = `rotate(${a.toFixed(2)}deg)`;
          const under = ((Math.round(a / 60) % 6) + 6) % 6;
          const key = needle.dataset.who;
          for (const s of box.querySelectorAll('.r5-sec')) s.classList.toggle(`u-${key}`, +s.dataset.n === under + 1);
          if (t < 1 && !ctx.signal.aborted && box.isConnected) requestAnimationFrame(tick);
          else res();
        };
        requestAnimationFrame(tick);
      });
    }

    async function runDial(spec) {
      closeDial();
      const by = spec.by;
      // Each side's dial has its own end of the screen, the player's at the bottom and the opponent's
      // at the top. If the country in question would be under it, it takes the other end.
      let top = by === 1;
      const at = spec.id ? board.at(spec.id) : null;
      if (at) {
        const g = game.getBoundingClientRect();
        const u = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
        const x = (at.x - g.left) / u;
        const yTop = (at.y - g.top) / u;
        const yBottom = (g.bottom - at.y) / u;
        // the dial and the two plates beside it
        if (!top && yBottom < 44 && x > 36 && x < 126) top = true;
        else if (top && yTop < 39 && x > 42 && x < 120) top = false;
      }
      const two = spec.dice.length > 1;
      const other = SIDE_NAME[by === 0 ? 1 : 0][0];
      const mine = SIDE_NAME[by][0];
      const what = (n) => {
        const row = spec.table?.[n - 1];
        if (!row) return '';
        if (spec.kind === 'space') return row.ok ? '前进' : '失败';
        if (!row.ok) return '失败';
        return `${row.remove ? `${other}−${row.remove}` : ''}${row.remove && row.add ? ' ' : ''}${row.add ? `${mine}+${row.add}` : ''}`;
      };
      const state = (n) => (two ? 'plain' : spec.table[n - 1].ok ? 'ok' : 'no');
      const secs = [1, 2, 3, 4, 5, 6].map((n) => `<path class="r5-sec ${state(n)}" data-n="${n}" d="${sector(200, 200, 98, 186, (n - 1) * 60 - 28.6, (n - 1) * 60 + 28.6)}"/>`).join('');
      const nums = [1, 2, 3, 4, 5, 6]
        .map((n) => {
          const [x, y] = polar(200, 200, 144, (n - 1) * 60);
          return `<div class="r5-face ${state(n)}" data-n="${n}" style="left:${(x / 10).toFixed(2)}em;top:${(y / 10).toFixed(2)}em"><b>${n}</b><span>${what(n)}</span></div>`;
        })
        .join('');
      const needle = (who, outer) =>
        `<g class="r5-needle ${who}" data-who="${who}"><path d="${outer ? 'M200,2 L212,-20 L188,-20 Z' : 'M200,104 L210,122 L190,122 Z'}"/>${outer ? '<path class="line" d="M200,14 V98"/>' : ''}</g>`;
      const title = spec.kind === 'space' ? MODE_NAME.space : `${MODE_NAME[spec.kind]} · ${ctx.name(spec.id)}`;
      const need =
        spec.kind === 'coup'
          ? spec.need
            ? `<b>${7 - spec.need}</b> 格成功 <small>掷出 ≥${spec.need}</small>`
            : '这张牌的点数不够'
          : spec.kind === 'space'
            ? `<b>${spec.max}</b> 格成功 <small>掷出 1–${spec.max}</small>`
            : '点数高的一方胜出';
      const modsOf = (d) => (d.mods.length ? d.mods.map((m) => `<span>+${m.n} ${m.label}</span>`).join('') : '<span>无加值</span>');
      const box = (dial = el('div', `r5-dial ${sideCls(by)} ${top ? 'is-top' : ''} k-${spec.kind}`));
      box.innerHTML =
        `<svg viewBox="0 0 400 400" overflow="visible"><circle class="r5-dial-rim" cx="200" cy="200" r="192"/>${secs}<circle class="r5-dial-well" cx="200" cy="200" r="90"/>` +
        (two ? needle('a', true) + needle('b', false) : needle(sideCls(by), true)) +
        `</svg>${nums}<div class="r5-dial-hub"></div>` +
        `<div class="r5-dial-l"><span class="who">${SIDE_NAME[by]}</span><b>${title}</b><p>${need}</p>` +
        (two ? spec.dice.map((d) => `<div class="mods ${sideCls(d.side)}"><i>${SIDE_NAME[d.side]}</i>${modsOf(d)}</div>`).join('') : '') +
        '</div><div class="r5-dial-r"><div class="math"></div><div class="verdict"></div></div>';
      layer.appendChild(box);
      const dice = spec.dice.map((d) => ({ d, die: ctx.makeDie({ side: d.side }) }));
      const well = box.querySelector('.r5-dial-hub');
      dice.forEach((x) => well.appendChild(x.die.el));
      await wait(750);
      // the die tumbles in the middle while the pointer goes round; each lands on the same number
      await Promise.all(
        dice.map(async (x, i) => {
          if (i) await wait(380);
          const ms = 2300;
          const n = box.querySelector(`.r5-needle.${two ? sideCls(x.d.side) : sideCls(by)}`);
          await Promise.all([x.die.roll(x.d.value, { ms, turns: 3, settle: 0.4 }), sweep(box, n, x.d.value, ms, 3 + i)]);
          box.querySelector(`.r5-sec[data-n="${x.d.value}"]`).classList.add('hit', `hit-${sideCls(x.d.side)}`);
          box.querySelector(`.r5-face[data-n="${x.d.value}"]`).classList.add('hit');
        }),
      );
      box.classList.add('is-landed');
      await wait(420);
      const math = box.querySelector('.math');
      if (spec.kind === 'coup') {
        const d = spec.dice[0];
        math.innerHTML = `<div><i>骰</i><b>${d.value}</b><i>+ 行动点</i><b>${d.total - d.value}</b><i>=</i><b class="sum">${d.total}</b></div><div><i>要超过 ${spec.bar.label} =</i><b class="bar">${spec.bar.n}</b></div>`;
      } else if (spec.kind === 'realign') {
        math.innerHTML = spec.dice.map((d) => `<div class="${sideCls(d.side)}"><i>${SIDE_NAME[d.side]}</i><b>${d.value}</b><i>+ ${sum(d.mods)} =</i><b class="sum">${d.total}</b></div>`).join('');
      } else math.innerHTML = `<div><i>掷出</i><b>${spec.dice[0].value}</b><i>要 1–${spec.max}</i></div>`;
      box.classList.add('is-read');
      await wait(520);
      const tone = spec.kind === 'realign' ? (spec.winner === null ? 'even' : spec.winner === 0 ? 'good' : 'bad') : spec.ok === (spec.by === 0) ? 'good' : 'bad';
      box.querySelector('.verdict').textContent = spec.text;
      box.classList.add('is-done', tone);
      if (tone === 'bad') fx.shake(box, 5, 300);
      await wait(1400);
      closeDial();
    }

    /* ------------------------------------------------------------------ the presenter */
    async function pickAndChoose(prompt, headline) {
      for (;;) {
        hideHub(0);
        say.set(prompt, 'top');
        hand.away(false);
        const pick = await ctx.pickCard();
        say.clear();
        const key = await openWheel(pick.no, { headline });
        const from = wheel?.querySelector('.r5-card .slot')?.getBoundingClientRect() ?? null;
        closeWheel();
        if (key) return { no: pick.no, key, from };
        hand.release(pick.no);
      }
    }

    const P = {
      ...base,

      async phase(info) {
        if (info.kind !== 'round') {
          hideHub();
          say.clear();
        }
        return base.phase.call(this, info);
      },

      // no wheel for the headline, there is nothing to choose: a card dragged out is played
      async pickHeadline() {
        hideHub(0);
        const idle = '<b>头条阶段</b>把一张牌拖出手牌，松手就打出 · 它会作为事件发生';
        say.set(idle, 'top');
        hand.away(false);
        const pick = await ctx.pickCard({
          click: false,
          onCarry: (no) => say.set(`<b>头条阶段</b>${carryLine(ctx, no).text}`, 'top'),
          onBack: () => say.set(idle, 'top'),
        });
        say.clear();
        base.ui.from = pick.rect;
        return pick.no;
      },

      async decide() {
        const r = await pickAndChoose('<b>你的行动</b>打出一张牌 · 点一张手牌，或把它拖出来', false);
        base.ui.from = r.from;
        return decision(r.no, r.key);
      },

      /* ---- a card is played */
      async announce(play) {
        hand.live(false);
        const line = playLine(ctx, play);
        const verb = play.use === 'ops' ? play.mode : play.use;
        if (play.headline) {
          await base.announce.call(this, play);
          showHub(play.by, { verb: 'event' });
          say.set(`<b>${SIDE_NAME[play.by]}的头条</b>《${play.card.title}》`, play.by ? 'opp' : 'hub', sideCls(play.by));
          return;
        }
        board.clearBadges('last');
        if (play.by === 0) {
          hideHub(1);
          hand.away(true);
          await base.ui.toTable(play.no, base.ui.from);
          base.ui.from = null;
          showHub(0, { verb, beads: play.use === 'ops' ? { total: play.points, left: play.points } : null });
          say.set(`<b>《${play.card.title}》</b>${line.what}${line.detail}`, 'hub', 'a');
        } else {
          // their wheel hangs from the top: the card in the middle, the petal they chose lit
          hideHub(0);
          const list = {};
          for (const key of ORDER) list[key] = { label: key === 'event' ? '事件' : MODE_NAME[key], short: '', cls: key === verb ? 'is-lit' : 'is-dim' };
          list[verb].short = play.use === 'ops' ? `${play.points} 点` : '';
          const stage = el('div', 'r5-stage is-opp');
          stage.appendChild(buildWheel({ no: play.no, list, by: 1, flip: true }));
          stage.insertAdjacentHTML('beforeend', `<div class="r5-oppcap"><b>苏联打出《${play.card.title}》</b><span>${line.what}${line.detail}</span></div>`);
          layer.appendChild(stage);
          await wait(1800);
          const from = stage.querySelector('.r5-card .slot').getBoundingClientRect();
          stage.remove();
          showHub(1, { verb, beads: play.use === 'ops' ? { total: play.points, left: play.points } : null });
          await base.ui.toTable(play.no, from);
          say.set(`<b>苏联 · 《${play.card.title}》</b>${line.what}${line.detail}`, 'opp', 'b');
        }
        if (play.target) {
          await board.show(play.target);
          board.big(play.target);
          // the hub points at where it is aimed
          await fx.tracer(hubPoint(play.by), board.at(play.target), { cls: sideCls(play.by), ms: 520, bend: 0.14 });
          board.ring(play.target, sideCls(play.by));
          await wait(380);
        }
      },

      /* ---- placing influence */
      async place(session, play) {
        let act = deferred();
        const press = (what) => act.resolve(what);
        const hint = '点带虚线环的国家，每下放 1 点 · 标着 ×2 的要花 2 点';
        const draw = () => {
          const t = session.targets();
          const ok = new Map([...t].filter(([, v]) => v.ok));
          const put = [...new Set(session.spent.map((s) => s.id))];
          board.mark({ kind: 'place', ok, lift: put, keep: put });
          board.clearBadges('cost');
          board.clearBadges('put');
          for (const [id, v] of ok) if (v.cost > 1) board.badge(id, 'cost', `${v.cost}`, 'b');
          for (const id of put) board.badge(id, 'put', `+${session.count(id)}`, 'a');
          const none = !session.spent.length;
          showHub(0, {
            verb: 'place',
            beads: { total: session.points, left: session.left },
            arcs: [
              none ? { at: 'l', label: '收回', key: 'escape', keyLabel: 'Esc', on: () => press('cancel') } : { at: 'l', label: '撤销', key: 'backspace', keyLabel: '⌫', on: () => press('undo') },
              ...(none ? [] : [{ at: 'r', label: '完成', key: 'enter', keyLabel: '↵', on: () => press('done'), primary: true }]),
            ],
          });
          say.set(`<b>放置影响力 · 剩 ${session.left} 点</b>${session.left ? (ok.size ? hint : '剩下的点数不够放在任何地方') : '点数用完了：完成，或撤销重放'}`, 'hub', 'a');
          return ok;
        };
        const end = () => {
          board.mark(null);
          board.clearBadges('cost');
          board.clearBadges('put');
          say.clear();
        };
        for (;;) {
          const ok = draw();
          act = deferred();
          const got = await Promise.race([session.left && ok.size ? board.pick(ok) : new Promise(() => {}), act.promise]);
          board.cancelPick();
          if (got === 'undo') session.undo();
          else if (got === 'done') break;
          else if (got === 'cancel') {
            end();
            hideHub(0);
            return false;
          } else if (got) {
            // the bead goes from the ring to the country
            const from = hubPoint(0);
            const e = session.add(got);
            if (e) {
              fx.tracer(from, board.at(got), { cls: 'a', ms: 300, bend: 0.12 });
              board.pop(got, '+1', 'a');
              board.ring(got, 'a');
              if (e.ctrlTo !== e.ctrlFrom) board.pop(got, e.ctrlTo === 0 ? '美国控制' : '打破控制', 'gold late');
            }
          }
        }
        end();
        showHub(0, { verb: 'place', beads: { total: session.points, left: session.left } });
        return true;
      },

      /* ---- choosing a country */
      async pickTarget(req) {
        const act = deferred();
        const kind = req.mode;
        const warn = kind === 'coup' ? [...req.targets].filter(([, p]) => p.key).map(([id]) => id) : [];
        board.mark({ kind, ok: req.targets, locked: req.locked, warn });
        for (const [id, p] of req.targets) {
          if (kind === 'coup') board.badge(id, 'need', p.need ? `${7 - p.need}/6` : '0/6', p.need ? '' : 'off');
          if (kind === 'realign') board.badge(id, 'need', p.edge > 0 ? `+${p.edge}` : p.edge < 0 ? `−${-p.edge}` : '±0', p.edge > 0 ? 'good' : p.edge < 0 ? 'bad' : '');
        }
        for (const id of req.locked.keys()) board.badge(id, 'lock', ICON.lock);
        const points = ctx.card(req.no).value;
        const title = kind === 'event' ? `《${req.title}》 ${req.total - req.left + 1} / ${req.total}` : kind === 'realign' ? `调整阵营 · 还能掷 ${req.left} 次` : '政变';
        const hint = kind === 'coup' ? '选一个带虚线环的国家 · 脚下是六格里成功的格数' : kind === 'realign' ? '选一个国家 · 脚下是你的骰子比对手多加几点' : req.hint;
        const arcs = [];
        if (req.cancel) arcs.push({ at: 'l', label: '收回', key: 'escape', keyLabel: 'Esc', on: () => act.resolve(null) });
        if (req.optional) arcs.push({ at: 'r', label: '停手', key: 'enter', keyLabel: '↵', on: () => act.resolve(null), primary: true });
        showHub(0, { verb: kind, beads: kind === 'coup' ? { total: points, left: points } : { total: req.total, left: req.left }, arcs });
        const tell = (html, cls = 'a') => say.set(`<b>${title}</b>${html}`, 'hub', cls);
        tell(hint);
        const off = board.onHover((id) => {
          if (id && req.locked.has(id)) return tell(`${ICON.lock}${ctx.name(id)}：${req.locked.get(id)}`, 'bad');
          const p = id && req.targets.get(id);
          if (!p) return tell(hint);
          if (kind === 'coup')
            tell(`${ctx.name(id)}：${p.need ? `六格里 ${7 - p.need} 格成功（掷出 ≥${p.need}）` : '点数不够，不可能成功'}${p.key ? `<em>${ICON.warn}战场国：核危机 ${G.crisis} → ${p.crisisTo}</em>` : ''}`, p.key ? 'warn' : 'a');
          else if (kind === 'realign') tell(`${ctx.name(id)}：你的骰子 +${sum(p.mods[0])}，苏联的骰子 +${sum(p.mods[1])}`);
          else tell(`${ctx.name(id)} · ${hint}`);
        });
        const id = await Promise.race([board.pick(req.targets), act.promise]);
        off();
        board.cancelPick();
        board.clearBadges('need');
        board.clearBadges('lock');
        board.mark(null);
        if (id) {
          showHub(0, { verb: kind, beads: kind === 'coup' ? { total: points, left: points } : { total: req.total, left: req.left - (kind === 'event' ? 0 : 1) } });
          say.set(`<b>${kind === 'event' ? `《${req.title}》` : MODE_NAME[kind]}</b>${ctx.name(id)}`, 'hub', 'a');
          await board.show(id);
          board.big(id);
          await fx.tracer(hubPoint(0), board.at(id), { cls: 'a', ms: 420, bend: 0.14 });
          board.ring(id, 'a');
        } else {
          say.clear();
          hideHub(0);
        }
        return id;
      },

      /* ---- dice: the ring becomes a dial */
      async roll(spec) {
        if (spec.id) {
          await board.show(spec.id);
          board.big(spec.id);
        }
        say.clear();
        const keep = hubs[spec.by];
        if (keep) keep.el.classList.add('is-under');
        await runDial(spec);
        keep?.el.classList.remove('is-under');
        say.set(`<b>${spec.kind === 'space' ? MODE_NAME.space : `${MODE_NAME[spec.kind]} · ${ctx.name(spec.id)}`}</b>${spec.text}`, spec.by ? 'opp' : 'hub', sideCls(spec.by));
      },

      /* ---- one consequence: a bead leaves the hub */
      async step(e, commit, cause) {
        const d = describe(ctx, e);
        const by = cause?.by ?? 0;
        const where = by ? 'opp' : 'hub';
        if (!hubs[by]) showHub(by, { verb: cause?.kind === 'event' ? 'event' : (cause?.kind ?? 'event') });
        if (e.t === 'inf') {
          await board.show(e.id);
          board.big(e.id);
          say.set(`<b>${ctx.name(e.id)}</b>${SIDE_NAME[e.side]}影响力 ${d.short}${d.took}`, where, d.cls);
          await bead(by, board.at(e.id), d.cls);
          commit();
          board.pop(e.id, d.short, d.cls);
          board.ring(e.id, d.cls);
          if (d.took) board.pop(e.id, d.took.replace(' · ', ''), 'gold late');
          // what the opponent changed stays marked until the player's next card
          if (by === 1) board.badge(e.id, 'last', d.short, d.cls);
          await wait(950);
        } else if (d.meter) {
          const target = hud.el(d.meter);
          // who caused it, when it was a move and not a card's own text
          const who = cause && cause.kind !== 'event' && d.why ? `${SIDE_NAME[cause.by]} · ` : '';
          say.set(`<b>${d.text}</b>${who}${d.why ?? ''}`, where, d.cls);
          await bead(by, target, d.cls);
          commit();
          fx.flash(target, { label: d.text, cls: d.cls, ms: 2000, place: hud.side(d.meter) });
          if (e.t === 'crisis' && e.d < 0) fx.shake(hud.pane('crisis') ?? target, 6);
          const short = e.t === 'crisis' ? `核危机 ${e.from}→${e.to}` : e.t === 'milops' ? `军事行动 ${d.short}` : e.t === 'vp' ? `${SIDE_NAME[e.side]} +${e.d} 分` : `${SIDE_NAME[e.side]}前进一步`;
          // the small tag takes over once the bright frame has gone
          setTimeout(() => !ctx.signal.aborted && tag(d.meter, short, d.cls), 2100);
          await wait(e.t === 'crisis' ? 1800 : 1200);
        } else {
          say.set(`<b>${d.text}</b>`, where, 'note');
          if (e.id) board.pop(e.id, '—', 'note');
          commit();
          await wait(1150);
        }
      },

      async trigger(play) {
        showHub(1, { verb: 'event' });
        say.set(`<b>苏联事件触发 · 《${play.card.title}》</b>你用了对手的牌行动：它的事件现在发生`, 'opp', 'b');
        fx.flash(hud.el('played'), { cls: 'b', ms: 1200, label: '事件触发', place: 'above' });
        await wait(1400);
      },

      async settle(play) {
        closeDial();
        say.clear();
        hideHub();
        await base.settle.call(this, play);
        hand.away(false);
      },

      destroy() {
        hideHub();
        offOutside?.();
        base.destroy();
      },
    };
    return P;
  },
};
