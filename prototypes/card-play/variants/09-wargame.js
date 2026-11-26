// 09 沙盘推演. Know before committing. Every use of a card comes with a forecast worked out from the
// rules; pointing at a country shows what each face of the die would do there; the die is then
// thrown along that same strip of six outcomes, and the consequences that were predicted are ticked
// off one by one as they happen. The opponent's move is forecast and ticked off in the same panel.
import './09-wargame.css';
import { basePresenter, carryLine, choiceList, decision, describe, ICON } from '../core/base.js';
import { MODE_NAME, SIDE_NAME } from '../core/game.js';

const SHORT = ['美', '苏'];
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const pct = (x) => `${Math.round(x * 100)}%`;
const sum = (mods) => mods.reduce((a, m) => a + m.n, 0);

export default {
  id: '09',
  name: '沙盘推演',
  ref: '先看推演，再下决定',
  idea: '每个选择都先给推演：这张牌五种用法各会怎样；指向一个国家，骰子六个面各自的结果排成一条；掷骰就是骰子沿这条格子跳，落在哪格就是哪格。预告过的后果逐条打勾。',
  notes: {
    choose: '牌停在底部，旁边一张“推演表”列出五种用法，每行一句按规则算出的预告：事件会发生什么（帮到对手的标红）、放置能拿下哪几国、政变最稳的目标和成功率、调整阵营最有利的国家、太空竞赛的成功率。指到哪一行，地图亮出它能用在哪。',
    target: '指向任何一个可选的国家，它旁边弹出一张推演卡。政变：1 到 6 六格，每格写着掷到它会怎样，成功的格子着色，成功率一个百分数，下面是必然发生的后果（军事行动几到几、战场国的核危机几到几）。调整阵营：双方加值和胜率。放置：这一点放下去后节点会变成几比几，够不够控制。',
    dice: '点下国家，那条六格移到屏幕上方的推演板里，一颗真骰子沿着格子一格一格跳，越跳越慢，落在哪格，那格写的就是结果。不用看算式，格子上早就写好了。调整阵营是双方各一条，各跳各的。',
    guide: '预告过的后果留在推演板上成为清单。每发生一条，从这一行飞出一颗光点到那个国家或刻度，那里变了，这一行才打勾。核危机那一行是红的，刻度上同时挂出标签。',
    opponent: '对手出牌后，先用红色的推演板给出他这一手的预告：目标、六格、会带来的后果，停住让你读完；然后骰子在同一条格子上跳，清单逐条打勾。和你自己行动时一模一样。',
  },
  pros: ['风险在动手之前就摆出来：战场国政变会降核危机，指上去就看得到', '骰子落在“结果”上而不是数字上，不用心算', '预告 → 发生 → 打勾，后果不会漏看，也不会意外', '对手的行动先预告再结算，看他掷骰时你知道每个点数意味着什么'],
  cons: ['信息量是十个方案里最大的，推演卡会盖住目标国旁边的一块地图', '熟手不需要每次都读预告，会觉得多一步', '调整阵营的两条格子只显示各自的合计，胜负要再看一眼下面的结论'],
  mount(ctx) {
    const base = basePresenter(ctx);
    const { fx, board, hand, hud, cards, layer, G } = ctx;
    const wait = fx.wait;
    const sc = (s) => (s === 0 ? 'a' : 'b');

    /* ------------------------------------------------------------------ forecasts, worked out from the rules */
    const coupCells = (p, by) => p.table.map((t) => ({ roll: t.roll, ok: t.ok, text: !t.ok ? '失败' : `<u class="${sc(1 - by)}">−${t.remove} ${SHORT[1 - by]}</u>${t.add ? `<u class="${sc(by)}">+${t.add} ${SHORT[by]}</u>` : ''}` }));
    const coupLines = (p, by) => [
      { type: 'inf', text: `${ctx.name(p.id)}的影响力：看骰子落在哪一格` },
      { type: 'milops', text: `${SIDE_NAME[by]}军事行动 ${G.milops[by]} → ${p.milopsTo}`, cls: sc(by) },
      ...(p.key ? [{ type: 'crisis', text: `战场国：核危机 ${G.crisis} → ${p.crisisTo}`, cls: 'bad' }] : []),
    ];
    const coupStrip = (p, by) => ({ side: by, label: `${SIDE_NAME[by]}掷骰`, note: `+${p.ops} 行动点，要超过 ${p.bar}`, cells: coupCells(p, by) });
    /** Chances for the player in a realignment roll, from both sides' additions. */
    function realignOdds(mods) {
      const e = [sum(mods[0]), sum(mods[1])];
      let win = 0;
      let tie = 0;
      for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) a + e[0] > b + e[1] ? win++ : a + e[0] === b + e[1] ? tie++ : 0;
      return { win: win / 36, tie: tie / 36, lose: (36 - win - tie) / 36, e };
    }
    const realignStrips = (mods) => [0, 1].map((s) => ({ side: s, label: `${SIDE_NAME[s]}掷骰`, note: mods[s].length ? mods[s].map((m) => `+${m.n} ${m.label}`).join('，') : '没有加值', cells: [1, 2, 3, 4, 5, 6].map((r) => ({ roll: r, ok: true, text: `<u>合计 ${r + sum(mods[s])}</u>` })) }));
    const spaceStrip = (by, max) => ({ side: by, label: `${SIDE_NAME[by]}掷骰`, note: `掷出 1–${max} 成功`, cells: [1, 2, 3, 4, 5, 6].map((r) => ({ roll: r, ok: r <= max, text: r <= max ? '<u>前进一步</u>' : '失败' })) });
    const typeOf = (text) => (text.includes('核危机') ? 'crisis' : text.includes('胜利点') ? 'vp' : text.includes('影响力') ? 'inf' : 'note');
    const eventLines = (no) => ctx.options(no).event.lines.map((l) => ({ type: typeOf(l.text), text: l.text, cls: l.lethal || l.warn ? 'bad' : '' }));

    const stripHtml = (s) =>
      `<div class="wg-strip ${sc(s.side)}"><div class="wg-sl"><b>${s.label}</b><span>${s.note ?? ''}</span></div><div class="wg-cells">${s.cells.map((c) => `<i class="wg-cell ${c.ok ? 'ok' : 'no'}" data-r="${c.roll}"><b>${c.roll}</b><span>${c.text}</span></i>`).join('')}</div></div>`;

    /* ------------------------------------------------------------------ the prompt: one line at the top */
    const prompt = fx.el('div', 'wg-prompt pane gilt');
    prompt.hidden = true;
    prompt.innerHTML = '<span class="wg-pw"></span><p></p><div class="wg-pips"></div><div class="wg-btns"></div>';
    layer.appendChild(prompt);
    let offPrompt = () => {};
    const say = (html, cls = '') => {
      const p = prompt.querySelector('p');
      p.innerHTML = html;
      p.className = cls;
    };
    function ask({ who = '你的行动', text = '', pips = null, buttons = [] }) {
      prompt.hidden = false;
      prompt.querySelector('.wg-pw').textContent = who;
      say(text);
      prompt.querySelector('.wg-pips').innerHTML = pips ? Array.from({ length: pips.total }, (_, i) => `<i class="${i < pips.total - pips.left ? 'used' : ''}"></i>`).join('') : '';
      const row = prompt.querySelector('.wg-btns');
      row.replaceChildren();
      const keymap = {};
      for (const b of buttons) {
        const n = fx.el('button', b.primary ? 'primary' : '', `${b.label}<kbd>${b.keyLabel}</kbd>`);
        n.type = 'button';
        n.disabled = !!b.disabled;
        n.addEventListener('click', () => b.on());
        row.appendChild(n);
        if (!b.disabled) keymap[b.key] = b.on;
      }
      offPrompt();
      offPrompt = ctx.keys(keymap);
    }
    function hush() {
      prompt.hidden = true;
      offPrompt();
      offPrompt = () => {};
    }

    /* ------------------------------------------------------------------ the forecast card, anchored to a country */
    let tip = null;
    function closeTip() {
      tip?.remove();
      tip = null;
    }
    function showTip(id, html, cls = '') {
      closeTip();
      const r = board.rect(id);
      if (!r) return;
      tip = fx.el('div', `wg-tip pane ${cls}`, html);
      layer.appendChild(tip);
      const box = layer.getBoundingClientRect();
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const w = tip.offsetWidth;
      const h = tip.offsetHeight;
      const cx = r.left + r.width / 2 - box.left;
      const above = r.top - box.top - h - 3.4 * rem > 9 * rem;
      const x = Math.min(box.width - w - 2 * rem, Math.max(2 * rem, cx - w / 2));
      const y = above ? r.top - box.top - h - 3.2 * rem : r.bottom - box.top + 2.6 * rem;
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
      tip.classList.add(above ? 'is-above' : 'is-below');
      tip.style.setProperty('--ax', `${cx - x}px`);
    }
    const linesHtml = (lines) => `<ul class="wg-lines">${lines.map((l) => `<li class="${l.cls ?? ''}"><i class="wg-box"></i><span>${l.text}</span></li>`).join('')}</ul>`;
    function coupTip(id, p) {
      const c = ctx.country(id);
      showTip(
        id,
        `<div class="wg-head"><b>政变 · ${c.name}${c.key ? ' ★' : ''}</b><em class="${p.chance >= 0.5 ? 'good' : 'bad'}">${p.need ? `成功率 ${pct(p.chance)}` : '不可能成功'}</em></div>${stripHtml(coupStrip(p, 0))}<div class="wg-sub">不管骰子怎样，都会：</div>${linesHtml(coupLines(p, 0).slice(1))}<div class="wg-go">点击这个国家：执行</div>`,
        p.key ? 'is-risk' : '',
      );
    }
    function realignTip(id, p) {
      const o = realignOdds(p.mods);
      const mods = (s) => (p.mods[s].length ? p.mods[s].map((m) => `<span>+${m.n} ${m.label}</span>`).join('') : '<span>没有加值</span>');
      showTip(
        id,
        `<div class="wg-head"><b>调整阵营 · ${ctx.name(id)}</b><em class="${o.win >= o.lose ? 'good' : 'bad'}">胜率 ${pct(o.win)}</em></div>` +
          `<div class="wg-duel"><div class="a"><b>你 +${o.e[0]}</b>${mods(0)}</div><i>对</i><div class="b"><b>苏联 +${o.e[1]}</b>${mods(1)}</div></div>` +
          `<div class="wg-bar"><i class="a" style="flex:${o.win}">胜 ${pct(o.win)}</i><i class="n" style="flex:${o.tie}">平</i><i class="b" style="flex:${o.lose}">负 ${pct(o.lose)}</i></div>` +
          `<div class="wg-sub">点数高的一方胜，输家移除差额那么多影响力。你在这里有 ${G.inf[id][0]} 点，苏联有 ${G.inf[id][1]} 点。</div><div class="wg-go">点击这个国家：掷一次</div>`,
      );
    }

    /* ------------------------------------------------------------------ the board: strips, then a checklist */
    const panel = fx.el('div', 'wg-board pane gilt');
    panel.hidden = true;
    layer.appendChild(panel);
    let openKey = null;
    /** Opens the board for one action. Called again with the same key it leaves what is there alone. */
    function openBoard(key, { side, title, tag = '', strips = [], lines = [] }) {
      hush();
      closeTip();
      if (openKey === key && !panel.hidden) return;
      openKey = key;
      panel.hidden = false;
      panel.className = `wg-board pane gilt ${sc(side)}`;
      panel.innerHTML = `<div class="wg-head"><span class="wg-who">${side === 0 ? '你的推演' : '苏联的推演'}</span><b>${title}</b><em>${tag}</em></div><div class="wg-strips">${strips.map(stripHtml).join('')}</div><div class="wg-verdict"></div><ul class="wg-lines"></ul>`;
      for (const l of lines) addLine(l);
    }
    function closeBoard() {
      panel.hidden = true;
      openKey = null;
    }
    function addLine({ type, text, cls = '' }, after = null) {
      const li = fx.el('li', cls, `<i class="wg-box"></i><span>${text}</span>`);
      li.dataset.type = type;
      const list = panel.querySelector('.wg-lines');
      if (after) after.after(li);
      else list.appendChild(li);
      return li;
    }
    const pending = (type) => panel.querySelector(`.wg-lines li[data-type="${type}"]:not(.is-done)`);
    const setLine = (li, text, cls) => {
      li.querySelector('span').innerHTML = text;
      if (cls !== undefined) li.className = cls;
    };

    /** The die goes along a strip cell by cell, slower and slower, and stops on `value`. */
    async function runDie(strip, die, value, lead = 0) {
      const cells = [...strip.querySelectorAll('.wg-cell')];
      const track = strip.querySelector('.wg-cells');
      track.appendChild(die.el);
      const at = (r) => {
        const c = cells[r - 1];
        return c.offsetLeft + c.offsetWidth / 2;
      };
      // to and fro, ending on the value
      const path = [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6];
      const stop = value === 6 ? 5 : 11 - value;
      const hops = path.slice(0, stop + 1);
      const total = 1900 + lead;
      const weights = hops.map((_, i) => Math.pow(1.22, i));
      const unit = total / weights.reduce((a, b) => a + b, 0);
      die.el.style.left = `${at(1)}px`;
      die.el.classList.add('is-in');
      let prev = at(1) - cells[0].offsetWidth * 1.4;
      for (let i = 0; i < hops.length; i++) {
        const r = hops[i];
        const ms = weights[i] * unit * 0.5;
        const last = i === hops.length - 1;
        const x = at(r);
        for (const c of cells) c.classList.toggle('is-hot', c === cells[r - 1]);
        die.roll(last ? value : 1 + ((r + i * 2) % 6), { ms: last ? ms + 420 : ms, turns: last ? 2 : 1, settle: last ? 0.45 : 0.2 });
        const move = die.el.animate(
          [
            { left: `${prev}px`, top: '0%' },
            { left: `${(prev + x) / 2}px`, top: `${last ? -14 : -26}%`, offset: 0.5 },
            { left: `${x}px`, top: '0%' },
          ],
          { duration: ms, easing: 'linear', fill: 'forwards' },
        );
        await wait(ms);
        move.commitStyles?.();
        move.cancel();
        die.el.style.left = `${x}px`;
        prev = x;
      }
      await wait(420);
      strip.classList.add('is-landed');
      cells[value - 1].classList.add('is-hit');
      fx.shake(cells[value - 1], 4, 280);
    }

    /* ------------------------------------------------------------------ choosing: the planner */
    let tray = null;
    function closeTray() {
      tray?.remove();
      tray = null;
      board.mark(null);
      hand.away(false);
    }
    function planner(no, headline) {
      closeTray();
      const ch = choiceList(ctx, no);
      const o = ch.options;
      const d = deferred();
      const best = (map, score) => [...map].sort((x, y) => score(y) - score(x))[0];
      const rows = (headline ? [ch.byKey.event] : ch.list).map((c) => {
        let fore = '';
        let chip = '';
        let cls = '';
        const ok = c.ok || (headline && c.key === 'event');
        if (c.key === 'event') {
          fore = c.lines.map((l) => `<em class="${l.lethal ? 'lethal' : l.warn ? 'warn' : ''}">${l.warn ? ICON.warn : ''}${l.text}</em>`).join('');
          chip = c.theirs && !headline ? '必然发生' : c.sub.replace('：', '<br>');
          if (c.theirs && !headline) cls = 'is-theirs';
          if (c.lines.some((l) => l.warn)) cls += ' is-warn';
        } else if (!ok) fore = `<em class="off">${c.why}</em>`;
        else if (c.key === 'place') {
          const can = [...o.place.targets]
            .filter(([id, v]) => v.cost === 1 && ctx.country(id).ctrl !== 0)
            .map(([id]) => ({ id, c: ctx.country(id) }))
            .map((x) => ({ ...x, need: x.c.stability + x.c.inf[1] - x.c.inf[0] }))
            .filter((x) => x.need > 0 && x.need <= o.points)
            .sort((x, y) => Number(y.c.key) - Number(x.c.key) || x.need - y.need)
            .slice(0, 3);
          fore = `<em>${o.place.targets.size} 个国家可以放</em>${can.length ? `<em>够拿下：${can.map((x) => `${x.c.name}${x.c.key ? '★' : ''}（${x.need} 点）`).join('、')}</em>` : '<em class="dim">这几点还不够单独拿下哪一国</em>'}`;
          chip = `${o.points} 点`;
        } else if (c.key === 'coup') {
          const [id, p] = best(o.coup.targets, ([, x]) => x.chance * 10 + (x.key ? 0 : 0.5));
          fore = `<em>最稳：${ctx.name(id)}${p.key ? '★' : ''}，掷出 ≥${p.need} 成功</em><em class="${c.risk ? 'warn' : 'dim'}">${c.risk ? `${ICON.warn}${o.coup.targets.size} 国可选 · 战场国（★）会让核危机 ${G.crisis} → ${G.crisis - 1}` : `${o.coup.targets.size} 国可选`}</em>`;
          chip = pct(p.chance);
        } else if (c.key === 'realign') {
          const [id, p] = best(o.realign.targets, ([, x]) => x.edge);
          const od = realignOdds(p.mods);
          fore = `<em>最有利：${ctx.name(id)}，你 +${od.e[0]} 对 苏联 +${od.e[1]}</em><em class="dim">可掷 ${o.points} 次 · ${o.realign.targets.size} 国可选 · 输家移除差额</em>`;
          chip = pct(od.win);
        } else {
          fore = `<em>掷出 1–${o.space.max} 前进到第 ${o.space.step} 步</em><em class="${c.safe ? 'safe' : 'dim'}">${c.safe ? '弃掉这张牌，对手的事件不会发生' : '这张牌弃掉，不发生事件'}</em>`;
          chip = pct(o.space.chance);
        }
        return `<button type="button" class="wg-row ${ok || cls.includes('is-theirs') ? '' : 'is-off'} ${cls}" data-key="${c.key}" ${ok ? '' : 'disabled'}><i class="wg-ric">${ICON[c.key]}</i><span class="wg-rname">${headline ? '作为头条' : c.theirs && c.key === 'event' ? '苏联的事件' : c.label}${ok ? `<kbd>${headline ? '↵' : c.hot.toUpperCase()}</kbd>` : ''}</span><span class="wg-rfore">${fore}</span><span class="wg-rchip">${chip}</span></button>`;
      });
      tray = fx.el('div', `wg-tray ${headline ? 'is-headline' : ''}`);
      tray.innerHTML =
        `<div class="wg-card"><div class="wg-slot"></div><button type="button" class="wg-back">${headline ? '换一张' : '收回'}<kbd>Esc</kbd></button></div>` +
        `<div class="wg-plan pane gilt"><div class="wg-ph"><b>推演表</b><span>${headline ? '头条只能作为事件；双方同时翻开，数值高的先结算' : `《${ch.card.title}》· ${ch.points} 点 · 指到一行，地图上亮出它能用在哪`}</span></div>${rows.join('')}${ch.fires && !headline ? `<div class="wg-fires">${ICON.warn}这是对手的牌：用它行动之后，上面“苏联的事件”照样发生。只有太空竞赛躲得开。</div>` : ''}</div>`;
      layer.appendChild(tray);
      hand.away(true);
      cards.put(no, tray.querySelector('.wg-slot'));
      const keymap = { escape: () => d.resolve(null) };
      for (const b of tray.querySelectorAll('.wg-row')) {
        const c = ch.byKey[b.dataset.key];
        if (b.disabled) continue;
        b.addEventListener('click', () => d.resolve(c.key));
        keymap[headline ? 'enter' : c.hot] = () => d.resolve(c.key);
        if (c.mark) {
          b.addEventListener('pointerenter', () => board.mark(c.mark));
          b.addEventListener('pointerleave', () => board.mark(null));
        }
      }
      tray.querySelector('.wg-back').addEventListener('click', () => d.resolve(null));
      const off = ctx.keys(keymap);
      return d.promise.finally(off);
    }

    async function chooseCard(headline) {
      for (;;) {
        ask({ who: headline ? '头条阶段' : '你的行动', text: headline ? '选一张牌作为头条：点手牌，或把它拖出来' : '打出一张牌：点手牌，或把它拖出来' });
        hand.live(true);
        const pick = await ctx.pickCard();
        hush();
        const key = await planner(pick.no, headline);
        const from = tray?.querySelector('.wg-slot .slot')?.getBoundingClientRect();
        closeTray();
        if (key) return { no: pick.no, key, from };
        hand.release(pick.no);
      }
    }

    /* ------------------------------------------------------------------ the presenter */
    return {
      ...base,

      // nothing to forecast between alternatives in the headline: a card dragged out is played,
      // and while it is carried the prompt says what its event will do
      async pickHeadline() {
        const idle = { who: '头条阶段', text: '把一张牌拖出手牌，松手就作为头条打出' };
        ask(idle);
        hand.live(true);
        const pick = await ctx.pickCard({
          click: false,
          onCarry: (no) => ask({ who: '头条阶段', text: carryLine(ctx, no).text }),
          onBack: () => ask(idle),
        });
        hush();
        base.ui.from = pick.rect;
        return pick.no;
      },

      async decide() {
        const r = await chooseCard(false);
        base.ui.from = r.from;
        return decision(r.no, r.key);
      },

      async announce(play) {
        const c = play.card;
        if (play.by === 0 || play.headline) {
          await base.announce.call(this, play);
          if (play.use === 'event') openBoard(`event:${play.no}`, { side: play.by, title: `${play.headline ? '头条' : '事件'} ·《${c.title}》`, tag: '牌面预告', lines: eventLines(play.no) });
          else if (play.use === 'space') {
            const o = ctx.game.RULES.spaceRoll;
            openBoard(`space:${play.no}`, { side: 0, title: MODE_NAME.space, tag: `成功率 ${pct(o / 6)}`, strips: [spaceStrip(0, o)], lines: [{ type: 'space', text: '成功：太空竞赛前进一步', cls: 'a' }] });
          }
          if (play.use !== 'ops') await wait(play.headline ? 900 : 600);
          return;
        }
        // the opponent: the card held up, then their forecast, held long enough to read
        hand.live(false);
        board.clearBadges('last');
        hush();
        const show = fx.el('div', 'cp-oppcard');
        const what = play.use === 'event' ? '事件' : play.use === 'space' ? MODE_NAME.space : `行动 ${play.points} 点 · ${MODE_NAME[play.mode]}`;
        show.innerHTML = `<div class="oc-card"></div><div class="oc-cap"><b>苏联打出</b><span>${what}${play.use === 'ops' && play.mode !== 'place' ? ` → ${ctx.name(play.target)}` : ''}</span></div>`;
        layer.appendChild(show);
        const face = cards.put(play.no, show.querySelector('.oc-card'));
        await wait(1400);
        const from = face.getBoundingClientRect();
        show.remove();
        await base.ui.toTable(play.no, from);
        if (play.use === 'event') openBoard(`event:${play.no}`, { side: 1, title: `事件 ·《${c.title}》`, tag: '牌面预告', lines: eventLines(play.no) });
        else if (play.use === 'space') {
          const o = ctx.game.RULES.spaceRoll;
          openBoard(`space:${play.no}`, { side: 1, title: MODE_NAME.space, tag: `成功率 ${pct(o / 6)}`, strips: [spaceStrip(1, o)], lines: [{ type: 'space', text: '成功：苏联在太空竞赛前进一步', cls: 'b' }] });
        } else if (play.mode === 'place') {
          const sums = new Map();
          for (const id of play.targets) sums.set(id, (sums.get(id) ?? 0) + 1);
          await board.show([...sums.keys()]);
          openBoard(`place:${play.no}`, { side: 1, title: `${MODE_NAME.place} · ${play.points} 点`, tag: '', lines: [...sums].map(([id, n]) => ({ type: 'inf', text: `${ctx.name(id)}：苏联影响力 +${n}`, cls: 'b' })) });
          for (const id of sums.keys()) board.ring(id, 'b');
        } else {
          await board.show(play.target);
          board.big(play.target);
          board.ring(play.target, 'b');
          const name = ctx.name(play.target);
          if (play.mode === 'coup') {
            const p = ctx.R.coupPreview(G, 1, play.target, play.points);
            openBoard(`coup:${play.target}`, { side: 1, title: `政变 · ${name}${p.key ? ' ★' : ''}`, tag: p.need ? `成功率 ${pct(p.chance)}` : '不可能成功', strips: [coupStrip(p, 1)], lines: coupLines(p, 1) });
          } else {
            const mods = ctx.R.realignMods(G, play.target);
            const o = realignOdds(mods);
            openBoard(`realign:${play.target}:${play.targets.length}`, { side: 1, title: `调整阵营 · ${name}`, tag: `苏联胜率 ${pct(o.lose)}`, strips: realignStrips(mods), lines: [{ type: 'inf', text: '输家移除差额那么多影响力' }] });
          }
        }
        await wait(1700);
      },

      async place(session) {
        let act = deferred();
        const press = (what) => () => act.resolve(what);
        let ghost = null;
        const unghost = () => {
          if (ghost) board.badge(ghost, 'ghost', null);
          ghost = null;
        };
        let okNow = new Map();
        const showGhost = (id) => {
          unghost();
          const v = id && okNow.get(id);
          if (!v) return;
          const c = ctx.country(id);
          const after = [c.inf[0] + 1, c.inf[1]];
          const takes = after[0] - after[1] >= c.stability && c.ctrl !== 0;
          const breaks = c.ctrl === 1 && after[1] - after[0] < c.stability;
          ghost = id;
          board.badge(id, 'ghost', `<b>${after[0]}</b>:${after[1]}${takes ? '<em>将控制</em>' : breaks ? '<em>破控制</em>' : ''}${v.cost > 1 ? '<s>花 2 点</s>' : ''}`, takes ? 'takes' : '');
        };
        const off = board.onHover(showGhost);
        const draw = () => {
          okNow = new Map([...session.targets()].filter(([, v]) => v.ok));
          board.mark({ kind: 'place', ok: okNow, lift: session.spent.map((s) => s.id) });
          board.clearBadges('cost');
          board.clearBadges('put');
          for (const [id, v] of okNow) if (v.cost > 1) board.badge(id, 'cost', `${v.cost}`, 'b');
          for (const id of new Set(session.spent.map((s) => s.id))) board.badge(id, 'put', `+${session.count(id)}`, 'a');
          const none = !session.spent.length;
          ask({
            text: session.left ? (okNow.size ? `<b>${MODE_NAME.place}</b> 指向国家看放下去之后的样子，点击放 1 点` : `<b>${MODE_NAME.place}</b> 剩下的点数放不进任何地方`) : `<b>${MODE_NAME.place}</b> 点数用完了：确认，或撤销重放`,
            pips: { total: session.points, left: session.left },
            buttons: [
              { label: '撤销', key: 'backspace', keyLabel: '⌫', on: press('undo'), disabled: none },
              none ? { label: '收回这张牌', key: 'escape', keyLabel: 'Esc', on: press('cancel') } : { label: '完成', key: 'enter', keyLabel: '↵', on: press('done'), primary: true },
            ],
          });
          // the country still under the pointer shows what the next point would do
          showGhost(board.hovered);
        };
        let result = true;
        for (;;) {
          draw();
          act = deferred();
          const got = await Promise.race([session.left && okNow.size ? board.pick(okNow) : new Promise(() => {}), act.promise]);
          board.cancelPick();
          unghost();
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
        off();
        unghost();
        board.mark(null);
        board.clearBadges('cost');
        board.clearBadges('put');
        hush();
        if (result) {
          // what was placed, as a list already ticked
          const ids = [...new Set(session.spent.map((s) => s.id))];
          openBoard('placed', { side: 0, title: `${MODE_NAME.place} · ${session.points - session.left} 点`, tag: '已放下', lines: ids.map((id) => ({ type: 'inf', text: `${ctx.name(id)}：美国影响力 +${session.count(id)}${ctx.country(id).ctrl === 0 ? ' · 美国控制' : ''}`, cls: 'a is-done' })) });
          await wait(1100);
        }
        return result;
      },

      async pickTarget(req) {
        const kind = req.mode;
        closeBoard();
        const act = deferred();
        const warn = kind === 'coup' ? [...req.targets].filter(([, p]) => p.key).map(([id]) => id) : [];
        board.mark({ kind, ok: req.targets, locked: req.locked, warn });
        for (const [id, p] of req.targets) {
          if (kind === 'coup') board.badge(id, 'need', p.need ? pct(p.chance) : '✕', p.need ? (p.chance >= 0.5 ? 'good' : 'bad') : 'off');
          if (kind === 'realign') board.badge(id, 'need', pct(realignOdds(p.mods).win), p.edge > 0 ? 'good' : p.edge < 0 ? 'bad' : '');
        }
        for (const id of req.locked.keys()) board.badge(id, 'lock', ICON.lock);
        const text =
          kind === 'coup'
            ? `<b>${MODE_NAME.coup}</b> 国家脚下是成功率。指向一个国家看推演，点击即执行`
            : kind === 'realign'
              ? `<b>${MODE_NAME.realign}</b> 还能掷 ${req.left} 次。国家脚下是你的胜率，指上去看推演`
              : `<b>《${req.title}》</b> ${req.hint}（第 ${req.total - req.left + 1} / ${req.total} 个）`;
        const buttons = [];
        if (req.optional) buttons.push({ label: '到此为止', key: 'enter', keyLabel: '↵', on: () => act.resolve(null), primary: true });
        if (req.cancel) buttons.push({ label: '收回这张牌', key: 'escape', keyLabel: 'Esc', on: () => act.resolve(null) });
        ask({ text, pips: req.total > 1 ? { total: req.total, left: req.left } : null, buttons });
        const off = board.onHover((id) => {
          closeTip();
          if (id && req.locked.has(id)) return showTip(id, `<div class="wg-head"><b>${ICON.lock}${ctx.name(id)}</b></div><div class="wg-sub">${req.locked.get(id)}</div>`, 'is-locked');
          const p = id && req.targets.get(id);
          if (!p) return;
          if (kind === 'coup') coupTip(id, p);
          else if (kind === 'realign') realignTip(id, p);
          else {
            const c = ctx.country(id);
            showTip(id, `<div class="wg-head"><b>${c.name}</b><em>苏联 ${c.inf[1]} → ${c.inf[1] - 1}</em></div><div class="wg-sub">移除 1 点苏联影响力${c.ctrl === 1 && c.inf[1] - 1 - c.inf[0] < c.stability ? '，苏联失去控制' : ''}${c.inf[0] - (c.inf[1] - 1) >= c.stability && c.ctrl !== 0 ? '，美国取得控制' : ''}</div><div class="wg-go">点击：执行</div>`);
          }
        });
        const id = await Promise.race([board.pick(req.targets), act.promise]);
        off();
        closeTip();
        board.cancelPick();
        board.clearBadges('need');
        board.clearBadges('lock');
        board.mark(null);
        hush();
        if (!id) return null;
        board.big(id);
        board.ring(id, 'a');
        const name = ctx.name(id);
        if (kind === 'coup') {
          const p = req.targets.get(id);
          openBoard(`coup:${id}`, { side: 0, title: `政变 · ${name}${p.key ? ' ★' : ''}`, tag: p.need ? `成功率 ${pct(p.chance)}` : '不可能成功', strips: [coupStrip(p, 0)], lines: coupLines(p, 0) });
        } else if (kind === 'realign') {
          const p = req.targets.get(id);
          openBoard(`realign:${id}:${req.left}`, { side: 0, title: `调整阵营 · ${name}`, tag: `胜率 ${pct(realignOdds(p.mods).win)}`, strips: realignStrips(p.mods), lines: [{ type: 'inf', text: '输家移除差额那么多影响力' }] });
        } else {
          openBoard(`event:${req.no}`, { side: 0, title: `事件 ·《${req.title}》`, tag: '', lines: [] });
          addLine({ type: 'inf', text: `${name}：移除 1 点苏联影响力` });
        }
        return id;
      },

      async roll(spec) {
        if (spec.id) {
          await board.show(spec.id);
          board.big(spec.id);
        }
        // the board is normally open already (opened when the target was chosen); make sure of it
        // a second roll in the same action gets a fresh board
        if (panel.querySelector('.wg-strip.is-landed')) closeBoard();
        if (panel.hidden) {
          const title = spec.kind === 'space' ? MODE_NAME.space : `${MODE_NAME[spec.kind]} · ${ctx.name(spec.id)}`;
          const strips = spec.kind === 'coup' ? [{ side: spec.by, label: `${SIDE_NAME[spec.by]}掷骰`, note: `要超过 ${spec.bar.n}`, cells: spec.table.map((t) => ({ roll: t.roll, ok: t.ok, text: t.ok ? `<u>净值 ${t.net}</u>` : '失败' })) }] : spec.kind === 'space' ? [spaceStrip(spec.by, spec.max)] : realignStrips(spec.dice.map((d) => d.mods));
          openBoard(`roll:${spec.kind}:${spec.id}:${spec.left}`, { side: spec.by, title, strips, lines: [] });
        }
        const strips = [...panel.querySelectorAll('.wg-strip')];
        await wait(500);
        await Promise.all(spec.dice.map((d, i) => runDie(strips[i], ctx.makeDie({ side: d.side }), d.value, i * 320)));
        const mine = spec.kind === 'realign' ? (spec.winner === null ? 'even' : spec.winner === 0 ? 'good' : 'bad') : spec.ok === (spec.by === 0) ? 'good' : 'bad';
        const v = panel.querySelector('.wg-verdict');
        v.innerHTML = spec.kind === 'realign' ? `你 <b>${spec.dice[0].total}</b> 对 苏联 <b>${spec.dice[1].total}</b>：${spec.text}` : `掷出 <b>${spec.dice[0].value}</b>：${spec.text}`;
        v.className = `wg-verdict is-on ${mine}`;
        // the line that waited on the die now says what the die decided
        const li = pending('inf');
        if (li && spec.kind === 'coup') {
          const cell = panel.querySelector('.wg-cell.is-hit span');
          if (spec.ok) setLine(li, `${ctx.name(spec.id)}：${cell.innerHTML.replace(/<\/u><u/g, '</u>，<u')}`);
          else {
            li.dataset.type = 'note';
            setLine(li, '政变失败：影响力没有变化');
          }
        } else if (li && spec.kind === 'realign') {
          if (spec.winner === null) {
            li.dataset.type = 'note';
            setLine(li, '平手：谁也没动');
          } else setLine(li, `${ctx.name(spec.id)}：${SIDE_NAME[1 - spec.winner]}移除影响力`);
        }
        if (spec.kind === 'space' && !spec.ok) {
          const s = pending('space');
          if (s) {
            s.dataset.type = 'note';
            setLine(s, '发射失败：原地不动');
          }
        }
        await wait(1000);
      },

      async step(e, commit, cause) {
        const d = describe(ctx, e);
        const by = cause?.by ?? 0;
        if (panel.hidden) openBoard(`loose:${cause?.kind}:${cause?.no}`, { side: by, title: cause?.kind === 'event' ? '事件' : MODE_NAME[cause?.kind] ?? '结算', lines: [] });
        const type = e.t === 'note' ? 'note' : e.t;
        let li = pending(type);
        if (!li) {
          const same = [...panel.querySelectorAll(`.wg-lines li[data-type="${type}"]`)].pop();
          li = addLine({ type, text: d.text }, same);
        }
        const text = d.text + (d.why && e.t !== 'milops' ? `<small>${d.why}</small>` : '');
        setLine(li, text, `${d.cls} is-now`);
        li.dataset.type = type;
        const box = li.querySelector('.wg-box');
        const relight = [];
        if (e.t === 'inf') {
          await board.show(e.id);
          board.big(e.id);
          await fx.tracer(box, board.rect(e.id), { cls: d.cls, ms: 520 });
          commit();
          board.ring(e.id, d.cls);
          board.pop(e.id, d.short, d.cls);
          if (d.took) board.pop(e.id, d.took.replace(' · ', ''), 'gold late');
          if (by === 1) board.badge(e.id, 'last', d.short, d.cls);
          li.classList.replace('is-now', 'is-done');
          await wait(850);
        } else if (d.meter) {
          const target = hud.el(d.meter);
          await fx.tracer(box, target, { cls: d.cls === 'good' ? 'gold' : d.cls, ms: 620 });
          commit();
          fx.flash(target, { label: d.text, cls: d.cls, ms: e.t === 'crisis' ? 3200 : 2200, place: hud.side(d.meter) });
          if (e.t === 'crisis' && e.d < 0) fx.shake(hud.pane('crisis') ?? target, 6);
          li.classList.replace('is-now', 'is-done');
          await wait(e.t === 'crisis' ? 1700 : 1100);
        } else {
          if (e.id) board.pop(e.id, '—', 'note');
          commit();
          li.classList.replace('is-now', 'is-done');
          await wait(1000);
        }
        void relight;
      },

      async trigger(play) {
        fx.flash(hud.el('played'), { cls: 'b', ms: 1300, label: '对手事件触发', place: 'above' });
        openBoard(`event:${play.no}:fires`, { side: 1, title: `苏联事件 ·《${play.card.title}》`, tag: '你用了对手的牌', lines: eventLines(play.no) });
        await wait(1500);
      },

      async settle(play) {
        closeTip();
        if (!play.cancelled && !panel.hidden) await wait(500);
        closeBoard();
        hush();
        await base.settle.call(this, play);
      },

      async phase(info) {
        if (info.kind !== 'round') hush();
        return base.phase.call(this, info);
      },
    };
  },
};
