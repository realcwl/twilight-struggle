// 03 行动令. Everything about a play is written down on one sheet of paper at the left edge:
// ① the card, ② what it is used for, ③ where, ④ the dice with the arithmetic spelled out,
// ⑤ what came of it. The sheet is filled in line by line as the play goes, and every line that
// changes something on the board is tied to that thing by a thread drawn from the line to it.
// The opponent's move is written on the same sheet with a red head, typed out as it happens, and
// that sheet stays folded at the top of the column until the player's next card.
import './03-order.css';
import { basePresenter, carryLine, choiceList, decision, describe, playLine, ICON } from '../core/base.js';
import { MODE_NAME, SIDE_NAME } from '../core/game.js';
import { centre } from '../core/fx.js';

const NUM = ['①', '②', '③', '④', '⑤'];
const SEC = ['牌', '用途', '目标', '掷骰', '结果'];
const KIND = { us: '美国事件', ussr: '苏联事件', neutral: '中立事件', tally: '结算牌' };
const NS = 'http://www.w3.org/2000/svg';
const sum = (mods) => mods.reduce((a, m) => a + m.n, 0);

export default {
  id: '03',
  name: '行动令',
  ref: '作战命令单 · 逐行填写',
  idea: '左边一张“行动令”：牌、用途、目标、掷骰、结果，一行一行填下来；每一行结果都有一根线牵到地图或刻度上。',
  notes: {
    choose: '拿起一张牌，行动令第 ① 行贴上它，第 ② 行列出五种用途，各带一句后果；不能选的划掉并写明原因。指到哪一行，地图就亮出它能用在哪。选定的一行盖上红章。',
    target: '第 ③ 行写着要你在地图上点什么。指到一个国家，这一行先用铅笔写出它的数字（政变要掷几、调整谁占优）；点下去才落成墨迹。放置影响力是一张逐行累加的清单，带余点。',
    dice: '第 ④ 行里有一个骰盅，骰子在纸上翻滚；旁边把算式逐项写出来：骰 5 + 行动点 3 − 稳定度 1×2 = 6，最后盖一个“成功 / 失败”的章。',
    guide: '第 ⑤ 行逐条写后果。每写一条，就有一根线从这行字牵到地图上的国家或角上的刻度，那里随即变化，这一行打上勾。核危机那一条用红字，整张纸震一下。',
    opponent: '对手行动时换一张红头的“苏联行动令”，同样五行，一个字一个字打出来，线同样牵到地图上。打完后折成一小张留在左上，直到你打出下一张牌，随时可以展开重读。',
  },
  pros: ['发生过的每一步都留在纸上，可以回头读，不怕错过', '算式逐项写明，最适合学规则的人', '对手做了什么有一张完整的单子，不只是动画一闪'],
  cons: ['视线要在左边的纸和地图之间来回，靠牵线弥补', '文字量最大，熟手会觉得啰嗦', '纸占住左侧一条，国家信息卡要挪到它右边'],
  mount(ctx) {
    const base = basePresenter(ctx);
    const { fx, board, hand, hud, cards, layer, G } = ctx;
    const wait = fx.wait;
    const fxLayer = document.querySelector('#fly .cp-fx.v-03') ?? layer;
    const dock = fx.el('div', 'o3-dock');
    layer.appendChild(dock);
    let sheet = null; // the sheet being written
    let kept = null; // the opponent's last sheet, folded
    let offKeys = null;

    /* ------------------------------------------------------------------ the sheet */
    function newSheet(side, heading, meta) {
      const el = fx.el('article', `o3-sheet ${side === 0 ? 'a' : 'b'}`);
      el.innerHTML =
        `<header><b>${heading}</b><span>${meta}</span></header>` +
        SEC.map((s, i) => `<section class="o3-sec is-todo" data-n="${i + 1}"><h4><i>${NUM[i]}</i>${s}</h4><div class="o3-body"></div></section>`).join('') +
        '<footer class="o3-foot"></footer>';
      dock.appendChild(el);
      const sec = (n) => el.querySelector(`.o3-sec[data-n="${n}"]`);
      const api = {
        el, side,
        sec,
        body: (n) => sec(n).querySelector('.o3-body'),
        /** Section n is the one being written now. */
        now(n) {
          for (const s of el.querySelectorAll('.o3-sec')) s.classList.toggle('is-now', +s.dataset.n === n);
          sec(n).classList.remove('is-todo', 'is-skip');
        },
        done(n) {
          sec(n).classList.remove('is-now', 'is-todo');
          sec(n).classList.add('is-done');
        },
        /** Sections that this play does not have. */
        skip(...ns) {
          for (const n of ns) sec(n).classList.add('is-skip');
        },
        line(n, html, cls = '') {
          sec(n).classList.remove('is-todo', 'is-skip');
          const p = fx.el('p', `o3-line ${cls}`, html);
          api.body(n).appendChild(p);
          return p;
        },
        stamp(target, text, cls = '') {
          const s = fx.el('span', `o3-stamp ${cls}`, text);
          target.appendChild(s);
          return s;
        },
        foot(buttons = []) {
          offKeys?.();
          offKeys = null;
          const f = el.querySelector('.o3-foot');
          f.replaceChildren();
          const map = {};
          for (const b of buttons) {
            const n = fx.el('button', b.primary ? 'primary' : '', `${b.label}<kbd>${b.keyLabel}</kbd>`);
            n.type = 'button';
            n.disabled = !!b.disabled;
            n.addEventListener('click', () => b.on());
            f.appendChild(n);
            if (!b.disabled) map[b.key] = b.on;
          }
          if (buttons.length) offKeys = ctx.keys(map);
        },
      };
      return api;
    }
    function dropSheet(s) {
      if (!s) return;
      s.el.classList.add('is-gone');
      const n = s.el;
      setTimeout(() => n.remove(), 420);
    }
    /** The card at the head of a sheet: a small face that grows when pointed at, and what it is. */
    function writeCard(s, no) {
      const c = ctx.card(no);
      s.now(1);
      s.body(1).innerHTML =
        `<div class="o3-card"><div class="o3-thumb"></div><div class="o3-cardtext"><b>《${c.title}》</b><span>${KIND[c.side]}${c.once ? ' · 一次性' : ''}</span>` +
        `<span class="o3-val">${c.value ? `行动点 <b>${c.value}</b><i>${'●'.repeat(c.value)}</i>` : '无行动点'}</span></div></div>`;
      cards.put(no, s.body(1).querySelector('.o3-thumb'));
      return s.body(1).querySelector('.o3-thumb');
    }
    /** Types a line out, a couple of characters at a time. */
    async function type(el, html) {
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const text = tmp.textContent;
      el.classList.add('is-typing');
      for (let i = 0; i < text.length; i += 3) {
        el.textContent = text.slice(0, i + 3);
        await wait(34);
      }
      el.innerHTML = html;
      el.classList.remove('is-typing');
    }

    /* ---- a thread from a line on the sheet to the thing it is about */
    function thread(fromEl, to, cls = '') {
      const a = fromEl.getBoundingClientRect();
      const p1 = centre(to);
      if (!p1 || !a.width) return { cut() {} };
      const p0 = { x: a.right + 6, y: a.top + a.height / 2 };
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', `o3-thread ${cls}`);
      const dx = Math.max(60, (p1.x - p0.x) * 0.45);
      const d = `M${p0.x},${p0.y} C${p0.x + dx},${p0.y} ${p1.x - dx * 0.6},${p1.y - Math.sign(p1.y - p0.y || 1) * 30} ${p1.x},${p1.y}`;
      svg.innerHTML = `<path d="${d}"/><circle cx="${p0.x}" cy="${p0.y}" r="4"/><circle class="end" cx="${p1.x}" cy="${p1.y}" r="6"/>`;
      fxLayer.appendChild(svg);
      const path = svg.querySelector('path');
      const len = path.getTotalLength();
      path.style.strokeDasharray = `${len}`;
      path.style.strokeDashoffset = `${len}`;
      requestAnimationFrame(() => svg.classList.add('is-drawn'));
      requestAnimationFrame(() => (path.style.strokeDashoffset = '0'));
      return {
        cut(after = 0) {
          setTimeout(() => {
            svg.classList.add('is-cut');
            setTimeout(() => svg.remove(), 500);
          }, after);
        },
      };
    }

    /* ------------------------------------------------------------------ ② what the card is used for */
    function chooseUse(s, no, { headline = false } = {}) {
      const ch = choiceList(ctx, no);
      s.now(2);
      const body = s.body(2);
      const ev = ch.byKey.event;
      const evLines = ev.lines.map((l) => `<em class="${l.warn ? 'warn' : ''}${l.lethal ? ' lethal' : ''}">${l.warn ? ICON.warn : ''}${l.text}</em>`).join('');
      const opt = (c) => {
        const ok = c.key === 'event' ? headline || c.ok : c.ok;
        const sub = c.key === 'event' ? evLines : ok ? c.sub : c.why;
        const extra = ok && c.risk ? `<em class="warn">${ICON.warn}${c.risk}</em>` : ok && c.safe ? '<em class="safe">不触发苏联事件</em>' : '';
        return (
          `<button type="button" class="o3-opt ${ok ? '' : 'is-off'} ${c.key === 'event' && c.theirs ? 'is-theirs' : ''}" data-key="${c.key}" ${ok ? '' : 'disabled'}>` +
          `<kbd>${headline ? '↵' : c.hot.toUpperCase()}</kbd><i class="o3-ic">${ICON[c.key]}</i><b>${headline ? '头条事件' : c.key === 'event' && c.theirs ? '苏联的事件' : c.label}</b><span>${sub}${extra}</span></button>`
        );
      };
      const list = headline ? [ch.byKey.event] : ch.list;
      body.innerHTML =
        list.map(opt).join('') +
        (ev.theirs && !headline ? '<p class="o3-note bad">苏联的事件，你不能主动发动。用这张牌行动后它照样发生，只有太空竞赛能躲开。</p>' : '') +
        (headline ? `<p class="o3-note">${ev.theirs ? '这是苏联的事件：打成头条，受益的是对手。' : '双方的头条同时翻开，数值高的先结算。'}</p>` : '');
      return new Promise((resolve) => {
        const keymap = { escape: () => finish(null) };
        const finish = (key) => {
          off();
          s.foot();
          board.mark(null);
          resolve(key);
        };
        for (const b of body.querySelectorAll('.o3-opt:not(:disabled)')) {
          const c = ch.byKey[b.dataset.key];
          b.addEventListener('click', () => finish(c.key));
          keymap[headline ? 'enter' : c.hot] = () => finish(c.key);
          if (c.mark) {
            b.addEventListener('pointerenter', () => board.mark(c.mark));
            b.addEventListener('pointerleave', () => board.mark(null));
          }
        }
        const off = ctx.keys(keymap);
        s.foot([{ label: headline ? '换一张' : '收回这张牌', key: 'escape', keyLabel: 'Esc', on: () => finish(null) }]);
      });
    }
    /** Section ② once the choice is made: one line, stamped. */
    function writeUse(s, play, { stamped = true } = {}) {
      const line = playLine(ctx, play);
      const what = play.use === 'ops' ? `行动 ${play.points} 点 · ${MODE_NAME[play.mode]}` : line.what;
      s.body(2).innerHTML = '';
      const p = s.line(2, `<i class="o3-ic">${ICON[play.mode] ?? ICON.event}</i><b>${what}</b>`, 'use');
      if (stamped) s.stamp(p, play.by === 0 ? '执行' : '已发', play.by === 0 ? 'blue' : '');
      s.done(1);
      s.done(2);
      return p;
    }

    /** Takes one card from the hand onto a fresh sheet and asks what it is for. */
    async function draft({ headline }) {
      for (;;) {
        dropSheet(sheet);
        const s = (sheet = newSheet(0, headline ? '头条令' : '行动令', headline ? '美国 · 头条阶段' : `美国 · 第 ${G.round} 行动轮`));
        s.now(1);
        s.body(1).innerHTML = '<p class="o3-ask">从手牌里拿一张牌：点它，或把它拖出来。</p>';
        hand.live(true);
        const pick = await ctx.pickCard();
        hand.live(false);
        const thumb = writeCard(s, pick.no);
        const key = await chooseUse(s, pick.no, { headline });
        if (key) {
          base.ui.from = thumb.querySelector('.slot')?.getBoundingClientRect() ?? null;
          return { no: pick.no, key };
        }
        hand.release(pick.no);
      }
    }

    /* ------------------------------------------------------------------ the presenter */
    return {
      ...base,

      async phase(info) {
        if (info.kind === 'end') {
          sheet?.foot();
          dropSheet(sheet);
          sheet = null;
        }
        return base.phase.call(this, info);
      },

      // the headline order has one line to fill in: the card. Dragged out of the hand, it is sent.
      async pickHeadline() {
        dropSheet(sheet);
        const s = (sheet = newSheet(0, '头条令', '美国 · 头条阶段'));
        const idle = '<p class="o3-ask">从手牌里拖出一张牌：松手就作为头条发出。</p>';
        s.now(1);
        s.body(1).innerHTML = idle;
        hand.live(true);
        const pick = await ctx.pickCard({
          click: false,
          onCarry: (no) => (s.body(1).innerHTML = `<p class="o3-ask">${carryLine(ctx, no).text}</p>`),
          onBack: () => (s.body(1).innerHTML = idle),
        });
        hand.live(false);
        base.ui.from = pick.rect;
        dropSheet(sheet);
        sheet = null;
        return pick.no;
      },

      async decide() {
        const d = await draft({ headline: false });
        return decision(d.no, d.key);
      },

      /* ---- a card is played: the sheet gets its first two lines */
      async announce(play) {
        hand.live(false);
        hud.hidePlayed(true);
        board.clearBadges('last');
        const mine = play.by === 0;
        let thumb;
        if (play.headline) {
          // both headline cards lie face up in the middle (base.showHeadline); each gets its own short sheet
          const seat = base.ui.headline?.querySelector(`.hl-seat.${mine ? 'a' : 'b'}`);
          const from = seat?.querySelector('.hl-front .slot')?.getBoundingClientRect();
          if (mine) dropSheet(sheet);
          else {
            dropSheet(kept);
            kept = null;
            dropSheet(sheet);
          }
          const s = (sheet = newSheet(play.by, '头条令', `${SIDE_NAME[play.by]} · 头条阶段`));
          thumb = writeCard(s, play.no);
          const to = thumb.querySelector('.slot').getBoundingClientRect();
          thumb.style.visibility = 'hidden';
          seat?.classList.add('is-gone');
          if (from) await cards.flyNo(play.no, from, to, { duration: 480 });
          thumb.style.visibility = '';
          if (base.ui.headline && !base.ui.headline.querySelector('.hl-seat:not(.is-gone)')) {
            base.ui.headline.remove();
            base.ui.headline = null;
          }
          writeUse(s, play);
          s.skip(3, 4);
        } else if (mine) {
          dropSheet(kept);
          kept = null;
          thumb = sheet.body(1).querySelector('.o3-thumb');
          writeUse(sheet, play);
          if (play.use === 'event') sheet.skip(3, 4);
          if (play.use === 'space') sheet.skip(3);
        } else {
          // the opponent's order: a red sheet, typed out line by line
          dropSheet(sheet);
          dropSheet(kept);
          kept = null;
          const s = (sheet = newSheet(1, '苏联行动令', `苏联 · 第 ${G.round} 行动轮`));
          thumb = writeCard(s, play.no);
          const to = thumb.querySelector('.slot').getBoundingClientRect();
          thumb.style.visibility = 'hidden';
          const title = s.body(1).querySelector('.o3-cardtext b');
          const name = title.textContent;
          title.textContent = '';
          const opp = hud.rect('opp');
          const w = to.width * 0.8;
          await cards.flyNo(play.no, { left: opp.left + opp.width / 2 - w / 2, top: opp.top, width: w, height: w * 1.4 }, to, { duration: 560 });
          thumb.style.visibility = '';
          await type(title, name);
          await wait(350);
          const p = writeUse(s, play, { stamped: false });
          const b = p.querySelector('b');
          await type(b, b.innerHTML);
          s.stamp(p, '已发');
          await wait(450);
          if (play.use === 'event') s.skip(3, 4);
          if (play.use === 'space') s.skip(3);
          if (play.use === 'ops') {
            s.now(3);
            const tally = new Map();
            for (const id of play.targets ?? [play.target]) tally.set(id, (tally.get(id) ?? 0) + 1);
            for (const [id, n] of tally) {
              const c = ctx.country(id);
              const l = s.line(3, '', 'target');
              await board.show(id);
              const th = thread(l, board.rect(id) ?? board.at(id), 'b');
              board.big(id);
              board.ring(id, 'b');
              await type(l, `<b>${c.name}</b>${c.key ? '<i class="star">★</i>' : ''}<span>${play.mode === 'place' ? `+${n}` : `稳定度 ${c.stability}${c.key ? ' · 战场国' : ''}`}</span>`);
              await wait(520);
              th.cut(200);
            }
            s.done(3);
          }
        }
        // the card goes from the sheet to the table
        const from = thumb?.querySelector('.slot')?.getBoundingClientRect() ?? base.ui.from;
        const to = hud.rect('played');
        if (from && to) await cards.flyNo(play.no, from, to, { duration: 430 });
        hud.hidePlayed(false);
        base.ui.from = null;
        if (mine && play.target) board.big(play.target);
      },

      /* ---- ③ placing: a tally that grows line by line */
      async place(session, play) {
        const s = sheet;
        s.now(3);
        let resolve;
        let act = new Promise((r) => (resolve = r));
        const press = (what) => resolve(what);
        const draw = () => {
          const t = session.targets();
          const ok = new Map([...t].filter(([, v]) => v.ok));
          const ids = [...new Set(session.spent.map((x) => x.id))];
          board.mark({ kind: 'place', ok, lift: ids });
          board.clearBadges('cost');
          board.clearBadges('put');
          for (const [id, v] of ok) if (v.cost > 1) board.badge(id, 'cost', `${v.cost}`, 'b');
          for (const id of ids) board.badge(id, 'put', `+${session.count(id)}`, 'a');
          const rows = ids
            .map((id) => {
              const cost = session.spent.filter((x) => x.id === id).reduce((a, x) => a + x.cost, 0);
              return `<p class="o3-line target"><b>${ctx.name(id)}</b><span>+${session.count(id)}${cost > session.count(id) ? ` · 花了 ${cost} 点` : ''}</span></p>`;
            })
            .join('');
          const pips = Array.from({ length: session.points }, (_, i) => `<i class="${i < session.points - session.left ? 'used' : ''}"></i>`).join('');
          s.body(3).innerHTML =
            rows +
            `<p class="o3-ask">${session.left ? (ok.size ? '在地图上点发光的国家，一下放 1 点。标着 ×2 的国家由对手控制，每点要花 2。' : '剩下的点数不够放在任何地方。') : '点数用完了：确认，或撤销重放。'}</p>` +
            `<p class="o3-left">余 <span class="o3-pips">${pips}</span><b>${session.left}</b> 点</p>`;
          const none = !session.spent.length;
          s.foot([
            { label: '撤销', key: 'backspace', keyLabel: '⌫', on: () => press('undo'), disabled: none },
            none ? { label: '收回这张牌', key: 'escape', keyLabel: 'Esc', on: () => press('cancel') } : { label: '完成', key: 'enter', keyLabel: '↵', on: () => press('done'), primary: true },
          ]);
          return ok;
        };
        let result = true;
        for (;;) {
          const ok = draw();
          act = new Promise((r) => (resolve = r));
          const got = await Promise.race([session.left && ok.size ? board.pick(ok) : new Promise(() => {}), act]);
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
        board.mark(null);
        board.clearBadges('cost');
        board.clearBadges('put');
        s.foot();
        if (result) {
          s.body(3).querySelector('.o3-ask')?.remove();
          s.done(3);
          s.skip(4);
          // placing is its own result: say so on the last line
          s.now(5);
          s.line(5, `<span>影响力已放下，共 ${session.spent.length} 点</span><i class="tick">✓</i>`, 'res a is-done');
        }
        return result;
      },

      /* ---- ③ a country, written in pencil while pointed at and in ink when clicked */
      async pickTarget(req) {
        const s = sheet;
        const kind = req.mode;
        s.now(3);
        let resolve;
        const act = new Promise((r) => (resolve = r));
        const warn = kind === 'coup' ? [...req.targets].filter(([, p]) => p.key).map(([id]) => id) : [];
        board.mark({ kind, ok: req.targets, locked: req.locked, warn });
        for (const [id, p] of req.targets) {
          if (kind === 'coup') board.badge(id, 'need', p.need ? `≥${p.need}` : '✕', p.need ? '' : 'off');
          if (kind === 'realign') board.badge(id, 'need', p.edge > 0 ? `+${p.edge}` : p.edge < 0 ? `−${-p.edge}` : '±0', p.edge > 0 ? 'good' : p.edge < 0 ? 'bad' : '');
        }
        for (const id of req.locked.keys()) board.badge(id, 'lock', ICON.lock);
        const ask =
          kind === 'coup'
            ? '在地图上点一个有对手影响力的国家。国家脚下的数字是成功所需的点数。'
            : kind === 'realign'
              ? `还能掷 ${req.left} 次。点一个国家；脚下的数字是你的骰子比对手多加几点。`
              : `${req.hint}（第 ${req.total - req.left + 1} 个，共 ${req.total} 个）`;
        const prompt = s.line(3, ask, 'o3-ask');
        const pencil = s.line(3, '', 'target pencil');
        const write = (id) => {
          if (id && req.locked.has(id)) return (pencil.innerHTML = `<b>${ctx.name(id)}</b><span class="bad">${ICON.lock}${req.locked.get(id)}</span>`);
          const p = id && req.targets.get(id);
          if (!p) return (pencil.innerHTML = '');
          const c = ctx.country(id);
          const head = `<b>${c.name}</b>${c.key ? '<i class="star">★</i>' : ''}`;
          if (kind === 'coup') pencil.innerHTML = `${head}<span>${p.need ? `掷出 ≥${p.need} 成功 · ${Math.round(p.chance * 100)}%` : '点数太低，不可能成功'}</span>${p.key ? `<span class="bad">${ICON.warn}战场国：核危机 ${G.crisis} → ${p.crisisTo}</span>` : ''}`;
          else if (kind === 'realign') pencil.innerHTML = `${head}<span>你 +${sum(p.mods[0])} 对 苏联 +${sum(p.mods[1])}</span>`;
          else pencil.innerHTML = `${head}<span>苏联影响力 ${c.inf[1]}</span>`;
        };
        const off = board.onHover(write);
        const buttons = [];
        if (req.optional) buttons.push({ label: '到此为止', key: 'enter', keyLabel: '↵', on: () => resolve(null), primary: true });
        if (req.cancel) buttons.push({ label: '收回这张牌', key: 'escape', keyLabel: 'Esc', on: () => resolve(null) });
        s.foot(buttons);
        const id = await Promise.race([board.pick(req.targets), act]);
        off();
        board.cancelPick();
        board.clearBadges('need');
        board.clearBadges('lock');
        board.mark(null);
        s.foot();
        prompt.remove();
        if (id) {
          write(id);
          pencil.classList.remove('pencil');
          const th = thread(pencil, board.rect(id) ?? board.at(id), 'a');
          th.cut(900);
          board.big(id);
          board.ring(id, 'a');
          if (kind !== 'event') s.done(3);
        } else pencil.remove();
        return id;
      },

      /* ---- ④ the dice, in a well on the sheet, with the sum written out */
      async roll(spec) {
        const s = sheet;
        if (spec.id) {
          await board.show(spec.id);
          board.big(spec.id);
        }
        if (spec.kind === 'realign' && s.body(4).childElementCount) {
          // a further realignment roll: the earlier one moves down to the results as one line
          const old = s.body(4).querySelector('.o3-roll');
          old?.remove();
        }
        s.now(4);
        const dice = spec.dice.map((d) => ({ d, die: ctx.makeDie({ side: d.side }) }));
        const term = (label, n, sign = '+') => `<i>${sign}</i><span class="t"><b>${n}</b><small>${label}</small></span>`;
        const row = (x, i) => {
          const d = x.d;
          const bar = spec.kind === 'coup' ? term(spec.bar.label, spec.bar.n, '−') : '';
          const total = spec.kind === 'coup' ? '<b class="net">?</b>' : '<b class="net">?</b>';
          return (
            `<div class="o3-row ${d.side === 0 ? 'a' : 'b'}"><span class="who">${SIDE_NAME[d.side]}</span><div class="o3-well" data-i="${i}"></div>` +
            `<p class="o3-eq"><span class="t die"><b>?</b><small>骰</small></span>${d.mods.map((m) => term(m.label, m.n)).join('')}${bar}<i>=</i>${total}</p></div>`
          );
        };
        const need =
          spec.kind === 'coup'
            ? `净值大于 0 才成功${spec.need ? `：要掷出 <b>≥${spec.need}</b>` : '：这张牌点数太低，不可能'}`
            : spec.kind === 'space'
              ? `掷出 <b>1–${spec.max}</b> 前进一步`
              : `点数高的一方胜出，输家移除差额的影响力${spec.left ? ` · 之后还能掷 ${spec.left} 次` : ''}`;
        const box = fx.el('div', `o3-roll k-${spec.kind}`, `${spec.id ? `<p class="o3-where">${MODE_NAME[spec.kind]} · <b>${ctx.name(spec.id)}</b></p>` : ''}${dice.map(row).join('')}<p class="o3-need">${need}</p>`);
        s.body(4).appendChild(box);
        dice.forEach((x, i) => box.querySelector(`.o3-well[data-i="${i}"]`).appendChild(x.die.el));
        await wait(650);
        box.classList.add('is-rolling');
        await Promise.all(dice.map((x, i) => x.die.roll(x.d.value, { ms: 1300 + i * 380 })));
        box.classList.remove('is-rolling');
        // the sum is written in: the die first, then the answer
        const rows = [...box.querySelectorAll('.o3-row')];
        rows.forEach((r, i) => (r.querySelector('.die b').textContent = dice[i].d.value));
        box.classList.add('is-read');
        await wait(480);
        rows.forEach((r, i) => {
          const d = dice[i].d;
          r.querySelector('.net').textContent = spec.kind === 'coup' ? d.total - spec.bar.n : d.total;
        });
        box.classList.add('is-summed');
        await wait(520);
        const mood = spec.kind === 'realign' ? (spec.winner === null ? 'even' : spec.winner === 0 ? 'good' : 'bad') : spec.ok === (spec.by === 0) ? 'good' : 'bad';
        const word = spec.kind === 'realign' ? (spec.winner === null ? '平手' : `${SIDE_NAME[spec.winner]}胜`) : spec.ok ? '成功' : '失败';
        // the verdict is written under the box and stamped
        const verdict = s.line(4, spec.text, `verdict ${mood}`);
        s.stamp(verdict, word, `big ${mood}`);
        box.classList.add('is-done');
        fx.shake(s.el, 3, 260);
        await wait(1100);
        s.done(4);
      },

      /* ---- ⑤ one consequence: a line, a thread from it to the thing, the thing changes, a tick */
      async step(e, commit, cause) {
        const s = sheet;
        const d = describe(ctx, e);
        s.now(5);
        // the dice box has said its piece: it shrinks to its sum and leaves the room to the results
        s.body(4).querySelector('.o3-roll')?.classList.add('is-compact');
        const crisis = e.t === 'crisis';
        const l = s.line(5, '<span></span><i class="tick"></i>', `res ${d.cls}${crisis ? ' crisis' : ''}`);
        const text = l.querySelector('span');
        const scroll = () => (s.el.scrollTop = s.el.scrollHeight);
        scroll();
        if (e.t === 'inf') {
          await board.show(e.id);
          board.big(e.id);
          await type(text, d.text);
          scroll();
          const th = thread(l, board.rect(e.id) ?? board.at(e.id), d.cls);
          await wait(380);
          board.ring(e.id, d.cls);
          commit();
          board.pop(e.id, d.short, d.cls);
          if (d.took) board.pop(e.id, d.took.replace(' · ', ''), 'gold late');
          if (cause?.by === 1) board.badge(e.id, 'last', d.short, d.cls);
          l.classList.add('is-done');
          l.querySelector('.tick').textContent = '✓';
          await wait(900);
          th.cut();
        } else if (d.meter) {
          const target = hud.el(d.meter);
          await type(text, d.text + (d.why ? `<small>${d.why}</small>` : ''));
          scroll();
          if (crisis) {
            fx.shake(s.el, 5, 420);
            await wait(250);
          }
          const th = thread(l, target, d.cls);
          await wait(crisis ? 620 : 420);
          commit();
          fx.flash(target, { label: d.text, cls: d.cls, ms: crisis ? 3000 : 2200, place: hud.side(d.meter) });
          if (crisis && e.d < 0) fx.shake(hud.pane('crisis') ?? target, 6);
          l.classList.add('is-done');
          l.querySelector('.tick').textContent = '✓';
          if (crisis) s.stamp(l, e.d < 0 ? '升级' : '缓和', e.d < 0 ? 'small bad' : 'small good');
          await wait(crisis ? 2000 : 1200);
          th.cut();
        } else {
          await type(text, d.text);
          if (e.id) board.pop(e.id, '—', 'note');
          commit();
          l.classList.add('is-done', 'note');
          l.querySelector('.tick').textContent = '—';
          await wait(1000);
        }
      },

      async trigger(play) {
        // the opponent's event goes off: it is entered on the player's own sheet, in red
        const s = sheet;
        s.now(5);
        const l = s.line(5, '', 'fires');
        await type(l, `${ICON.event}<b>苏联事件触发：《${play.card.title}》</b><span>你用了对手的牌行动，它的事件现在发生。</span>`);
        fx.flash(hud.el('played'), { cls: 'b', ms: 1300 });
        await wait(1200);
      },

      async settle(play) {
        board.big(null);
        board.mark(null);
        base.ui.closeRoll();
        const s = sheet;
        if (play.cancelled) {
          s?.foot();
          dropSheet(s);
          sheet = null;
          hand.release(play.no);
          hand.live(true);
          return;
        }
        if (s) {
          s.foot();
          for (const n of [1, 2, 3, 4, 5]) if (!s.sec(n).classList.contains('is-skip') && !s.sec(n).classList.contains('is-todo')) s.done(n);
          const pile = play.pile === 'removed' ? '移出游戏' : '进弃牌堆';
          s.el.querySelector('header span').textContent += ` · 牌${pile}`;
        }
        const from = hud.rect('played');
        const to = hud.rect(play.pile);
        if (from && to) cards.flyNo(play.no, from, to, { duration: 420, fade: true });
        await wait(500);
        if (!s) return;
        if (play.by === 1) {
          // their sheet is folded and kept where the player can reread it
          const line = playLine(ctx, play);
          s.el.classList.add('is-folded');
          s.el.scrollTop = 0;
          s.el.querySelector('header b').textContent = play.headline ? '苏联头条' : '苏联上一步';
          s.el.querySelector('header span').textContent = `《${play.card.title}》${play.use === 'ops' ? MODE_NAME[play.mode] : line.what}${line.detail}`;
          kept = s;
          sheet = null;
        } else {
          s.el.classList.add('is-filed');
          await wait(700);
          dropSheet(s);
          sheet = null;
        }
      },

      destroy() {
        offKeys?.();
        base.destroy();
      },
    };
  },
};
