// 04 聚光灯. Cinema: one thing on screen at a time. There are no panels and no ribbon. Whatever is
// not the subject of the moment goes dark under a veil, and the subject is lit through a hole in it:
// the card and its two readings, the countries that can be chosen, one large die between letterbox
// bars, the one country that changes, the one meter that moves. A meter does not wait in its corner
// to be noticed: its pane travels to the middle of the screen, changes there, and goes home.
import './04-spotlight.css';
import { basePresenter, carryLine, choiceList, decision, describe, playLine, ICON } from '../core/base.js';
import { MODE_NAME, SIDE_NAME } from '../core/game.js';

const NS = 'http://www.w3.org/2000/svg';
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const sideCls = (s) => (s === 0 ? 'a' : s === 1 ? 'b' : '');

export default {
  id: '04',
  name: '聚光灯',
  ref: '电影镜头',
  idea: '一次只看一样东西：其余全部压暗，要你看的那一样被光打亮；刻度不在角落里等你发现，而是自己走到屏幕中央变给你看。',
  notes: {
    choose: '牌升到屏幕正中，画面一分为二：左半边大字“事件”，右半边大字“行动”，各用一两行说清对这张牌意味着什么。点“行动”后右半边变成四条：指到哪一条，它能用的国家就在暗场里一个个亮起来；不能用的划掉并写明原因。',
    target: '地图整体压暗，只有可选的国家各有一团光。屏幕底部一行大字字幕说现在要你做什么、还剩几点；指到某个国家，字幕换成它的胜算和后果。',
    dice: '上下黑边合拢，屏幕正中一颗大骰子，最后半圈放慢，落定时整屏一震，点数砸在旁边；一行算式，然后是大字的“成功 / 失败”。',
    guide: '影响力变化：镜头推到那个国家，其余全暗，一个大数字砸在它头上。核危机、军事行动、胜利点、太空竞赛：那一块刻度板从角落走到屏幕中央、放大，在你眼前变完，停一拍，再回去。',
    opponent: '对手出牌先给一张红色的标题卡（牌 + “政变 · 扎伊尔”），之后的掷骰和后果用完全相同的镜头，只是黑边带红线、字是红的。他动过的国家留一个红色数字角标，直到你出下一张牌。',
  },
  pros: ['不可能看漏：任何时刻屏幕上只有一样东西是亮的', '核危机变化是全屏事件，刻度板走到你面前', '没有常驻面板，地图在平时完全干净', '骰子的分量最重，输赢有戏剧感'],
  cons: ['最慢：每一拍都有进场和退场（空格可跳过）', '压暗时看不到全局，想对照别的国家要等这一拍过去', '镜头会自己推拉，打断你原本在看的位置（结算完会回到原来的视角）', '放置影响力这种要点很多下的操作，戏剧化的收益不大'],
  mount(ctx) {
    const { fx, board, hand, hud, cards, layer, G } = ctx;
    const wait = fx.wait;
    const el = fx.el;
    const base = basePresenter(ctx);
    const game = layer.parentElement;
    const rig = board.map.rig;
    const scene = { pane: null, country: null, cam: null };

    /* ------------------------------------------------------------------ the veil: darkness with holes that follow things */
    const veil = (() => {
      const id = 's4v' + Math.random().toString(36).slice(2, 7);
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 's4-veil');
      svg.innerHTML =
        `<defs><filter id="${id}f" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="16"/></filter>` +
        `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%"><rect width="100%" height="100%" fill="#fff"/><g filter="url(#${id}f)"></g></mask></defs>` +
        `<rect class="dark" width="100%" height="100%" mask="url(#${id})"/>`;
      layer.prepend(svg);
      const g = svg.querySelector('g');
      const dark = svg.querySelector('.dark');
      let source = null;
      let last = '';
      let raf = 0;
      const draw = () => {
        const o = game.getBoundingClientRect();
        const html = (source ? source() : [])
          .filter(Boolean)
          .map((h) =>
            'r' in h
              ? `<circle cx="${(h.x - o.left).toFixed(1)}" cy="${(h.y - o.top).toFixed(1)}" r="${h.r}" fill="#000"/>`
              : `<rect x="${(h.left - o.left - 14).toFixed(1)}" y="${(h.top - o.top - 14).toFixed(1)}" width="${(h.width + 28).toFixed(1)}" height="${(h.height + 28).toFixed(1)}" rx="26" fill="#000"/>`,
          )
          .join('');
        if (html !== last) g.innerHTML = last = html;
      };
      const loop = () => {
        draw();
        raf = requestAnimationFrame(loop);
      };
      return {
        /** Darkens the stage. `holes` is asked every frame for what stays lit: [{ x, y, r }] or rectangles. */
        show(opacity = 0.6, holes = null) {
          cancelAnimationFrame(raf);
          source = holes;
          dark.style.fillOpacity = String(opacity);
          svg.classList.add('is-on');
          if (holes) loop();
          else g.innerHTML = last = '';
        },
        hide() {
          svg.classList.remove('is-on');
          // the holes stay where they are while it fades
          cancelAnimationFrame(raf);
          source = null;
        },
        stop: () => cancelAnimationFrame(raf),
      };
    })();

    /** Pools of light on map nodes, sized to the node. */
    const pools = (ids, grow = 1) => () =>
      [...ids].map((id) => {
        const r = board.rect(id);
        return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.max(30, r.width * 0.72) * grow } : null;
      });

    /* ------------------------------------------------------------------ the subtitle: one line of large type */
    const subEl = el('div', 's4-sub');
    subEl.hidden = true;
    layer.appendChild(subEl);
    let offSubKeys = null;
    const sub = {
      /** main: the line; big: a numeral before it; small: the second line; keys: [{ label, key, keyLabel, on, primary }] */
      set({ main = '', small = '', tone = '', side = null, at = 'bottom', keys = [], big = '' }) {
        subEl.hidden = false;
        subEl.className = `s4-sub at-${at} ${sideCls(side)}`;
        subEl.innerHTML = `<div class="s4-sub-main">${big !== '' ? `<b class="s4-sub-big">${big}</b>` : ''}<span>${main}</span></div><div class="s4-sub-small ${tone}">${small}</div><div class="s4-sub-keys"></div>`;
        const box = subEl.lastChild;
        offSubKeys?.();
        const map = {};
        for (const k of keys) {
          const b = el('button', k.primary ? 'primary' : '', `${k.label}<kbd>${k.keyLabel}</kbd>`);
          b.type = 'button';
          b.addEventListener('click', () => k.on());
          box.appendChild(b);
          map[k.key] = k.on;
        }
        offSubKeys = ctx.keys(map);
      },
      say(small, tone = '') {
        const n = subEl.querySelector('.s4-sub-small');
        if (!n) return;
        n.className = `s4-sub-small ${tone}`;
        n.innerHTML = small;
      },
      clear() {
        subEl.hidden = true;
        offSubKeys?.();
        offSubKeys = null;
      },
    };

    /* ------------------------------------------------------------------ a title card */
    /** Large type in the middle of a dark screen, with a card beside it if `no` is given. Returns where that card stood. */
    async function title({ kicker = '', main = '', small = '', side = null, ms = 1300, no = null, dark = 0.74 }) {
      veil.show(dark);
      const n = el('div', `s4-title ${sideCls(side)} ${no ? 'has-card' : ''}`, `${no ? '<div class="s4-title-card"></div>' : ''}<div class="s4-title-text"><span class="s4-kick">${kicker}</span><b>${main}</b><small>${small}</small></div>`);
      layer.appendChild(n);
      const card = no ? cards.put(no, n.querySelector('.s4-title-card')) : null;
      await wait(ms);
      const rect = card?.getBoundingClientRect() ?? null;
      n.classList.add('is-out');
      setTimeout(() => n.remove(), 420);
      veil.hide();
      return rect;
    }

    /* ------------------------------------------------------------------ the two subjects a scene can hold: a country, a pane */
    async function stable(id, max = 1500) {
      let prev = null;
      const t0 = performance.now();
      while (performance.now() - t0 < max) {
        await wait(90);
        const p = board.at(id);
        if (p && prev && Math.hypot(p.x - prev.x, p.y - prev.y) < 0.6) return;
        prev = p;
      }
    }

    function releaseCountry() {
      if (!scene.country) return;
      scene.country = null;
      board.big(null);
      board.mark(null);
      veil.hide();
    }

    /** The camera goes to one country (in close if the view was the whole world) and everything else goes dark. */
    async function focusCountry(id) {
      if (scene.country === id) return;
      await sendPaneHome();
      const far = board.zoom > 0.62;
      if (far && !scene.cam) scene.cam = { ...rig.goal };
      scene.country = id;
      board.big(id);
      // its land is lit by the map itself, whether or not the pointer happens to be on it
      board.mark({ kind: 'show', ok: [id], lift: [id] });
      veil.show(0.74, pools([id], 2.1));
      await board.show(id, { zoom: far });
      if (far) await stable(id);
    }

    /** A corner pane of the HUD comes to the middle of the screen, enlarged, lit through the veil. */
    async function bringPane(name) {
      const pane = hud.pane(name);
      if (!pane) return null;
      if (scene.pane === pane) return pane;
      await sendPaneHome();
      if (scene.country) {
        scene.country = null;
        board.big(null);
        board.mark(null);
      }
      const r = pane.getBoundingClientRect();
      const g = game.getBoundingClientRect();
      const s = Math.min(2, (g.width * 0.5) / r.width, (g.height * 0.44) / r.height);
      const dx = g.left + g.width / 2 - (r.left + r.width / 2);
      const dy = g.top + g.height * 0.53 - (r.top + r.height / 2);
      scene.pane = pane;
      pane.classList.add('s4-abroad');
      pane.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${s.toFixed(3)})`;
      veil.show(0.84, () => [pane.getBoundingClientRect()]);
      await wait(760);
      return pane;
    }

    async function sendPaneHome() {
      const pane = scene.pane;
      if (!pane) return;
      scene.pane = null;
      pane.style.transform = '';
      await wait(620);
      pane.classList.remove('s4-abroad');
      veil.hide();
    }

    async function clearScene() {
      await sendPaneHome();
      releaseCountry();
    }

    function restoreCam() {
      if (!scene.cam) return;
      rig.goal = { ...scene.cam, x: rig.nearestX(scene.cam.x) };
      rig.dirty = true;
      scene.cam = null;
    }

    /** A large numeral dropped on a country's node. */
    function slam(id, text, cls) {
      const p = board.at(id);
      if (!p) return;
      const o = game.getBoundingClientRect();
      const n = el('b', `s4-slam ${cls}`, text);
      n.style.left = p.x - o.left + 'px';
      n.style.top = p.y - o.top + 'px';
      layer.appendChild(n);
      setTimeout(() => n.remove(), 1600);
    }

    /* ------------------------------------------------------------------ choosing: two halves, then four bands */
    let choice = null;
    function closeChoice() {
      choice?.remove();
      choice = null;
      board.mark(null);
      veil.hide();
    }

    /** Resolves with a choice key ('event' | 'place' | 'realign' | 'coup' | 'space') or null. */
    function openChoice(no, { headline = false } = {}) {
      closeChoice();
      const ch = choiceList(ctx, no);
      const d = deferred();
      const ev = ch.byKey.event;
      const theirs = ev.theirs && !headline;
      const evOk = ev.ok || headline;
      let lit = [];
      const lines = ev.lines.map((l) => `<li class="${l.warn ? 'warn' : ''}${l.lethal ? ' lethal' : ''}">${l.warn ? ICON.warn : ''}<span>${l.text}</span></li>`).join('');
      const band = (c) =>
        `<button type="button" class="s4-band ${c.ok ? '' : 'is-off'}" data-key="${c.key}" ${c.ok ? '' : 'disabled'}>` +
        `<i class="s4-ic">${ICON[c.key]}</i><b>${c.label}</b><kbd>${c.hot.toUpperCase()}</kbd>` +
        `<span class="s4-band-sub">${c.ok ? c.sub : c.why}` +
        (c.ok && c.risk ? `<em class="risk">${ICON.warn}${c.risk}</em>` : '') +
        (c.ok && ch.fires ? (c.safe ? '<em class="safe">不触发对手事件</em>' : '<em class="risk">之后苏联事件照样发生</em>') : '') +
        '</span></button>';
      choice = el('div', `s4-choice ${theirs ? 'is-theirs' : ''} ${headline ? 'is-headline' : ''}`);
      choice.innerHTML =
        `<button type="button" class="s4-half ev" data-key="event" ${evOk ? '' : 'disabled'}>` +
        `<span class="s4-kick">${headline ? '头条' : theirs ? '躲不开' : '其一'}</span>` +
        `<b class="s4-big">${headline ? '作为头条' : theirs ? '苏联的事件' : '事件'}</b>` +
        `<ul class="s4-lines">${lines}</ul>` +
        `<span class="s4-foot">${theirs ? '用这张牌行动，事件照样发生。只有太空竞赛能躲开。' : ev.sub}${evOk ? `<kbd>${headline ? '↵' : 'E'}</kbd>` : ''}</span></button>` +
        `<div class="s4-mid"><div class="s4-slot"></div><button type="button" class="s4-back">${headline ? '换一张' : '收回'}<kbd>Esc</kbd></button></div>` +
        (headline
          ? '<div class="s4-half note"><span class="s4-kick">头条阶段</span><b class="s4-big">同时翻开</b><ul class="s4-lines"><li><span>双方各暗出一张牌，都作为事件发生</span></li><li><span>数值高的先结算</span></li></ul><span class="s4-foot">头条不能用于行动</span></div>'
          : `<button type="button" class="s4-half ops" data-key="ops"><span class="s4-kick">其二</span><b class="s4-big">行动</b><span class="s4-pts"><b>${ch.points}</b>点</span><span class="s4-foot">放置影响力 · 调整阵营 · 政变 · 太空竞赛<kbd>Z</kbd><kbd>X</kbd><kbd>C</kbd><kbd>V</kbd></span></button>` +
            `<div class="s4-bands"><span class="s4-kick">行动 · ${ch.points} 点 · 四选一</span>${ch.list.slice(1).map(band).join('')}</div>`);
      layer.appendChild(choice);
      hand.away(true);
      veil.show(0.78, () => {
        // what the band under the pointer could touch stays lit: countries, or the space race itself
        if (lit === 'space') return [hud.rect('space')];
        return pools(lit, 1.15)();
      });
      cards.put(no, choice.querySelector('.s4-slot'));

      const choose = (key) => d.resolve(key);
      const keymap = {
        escape: () => {
          if (choice.classList.contains('is-ops')) {
            choice.classList.remove('is-ops');
            lit = [];
            board.mark(null);
          } else choose(null);
        },
      };
      const evBtn = choice.querySelector('.s4-half.ev');
      if (evOk) {
        evBtn.addEventListener('click', () => choose('event'));
        keymap[headline ? 'enter' : ev.hot] = () => choose('event');
      }
      choice.querySelector('.s4-half.ops')?.addEventListener('click', () => choice.classList.add('is-ops'));
      for (const b of choice.querySelectorAll('.s4-band')) {
        const c = ch.byKey[b.dataset.key];
        if (!c.ok) continue;
        b.addEventListener('click', () => choose(c.key));
        keymap[c.hot] = () => choose(c.key);
        b.addEventListener('pointerenter', () => {
          lit = c.key === 'space' ? 'space' : [...(c.mark?.ok?.keys() ?? [])];
          if (c.mark) board.mark(c.mark);
        });
        b.addEventListener('pointerleave', () => {
          lit = [];
          board.mark(null);
        });
      }
      choice.querySelector('.s4-back').addEventListener('click', () => choose(null));
      const off = ctx.keys(keymap);
      return d.promise.finally(off);
    }

    async function pickAndChoose(prompt, headline) {
      for (;;) {
        await clearScene();
        hand.away(false);
        sub.set({ at: 'top', ...prompt });
        const pick = await ctx.pickCard();
        sub.clear();
        const key = await openChoice(pick.no, { headline });
        const from = choice?.querySelector('.s4-slot .slot')?.getBoundingClientRect() ?? null;
        closeChoice();
        if (key) return { no: pick.no, key, from };
        hand.away(false);
        hand.release(pick.no);
      }
    }

    /* ------------------------------------------------------------------ the presenter */
    const P = {
      ...base,

      async phase(info) {
        await clearScene();
        sub.clear();
        if (info.kind === 'end') return base.phase.call(this, info);
        if (info.kind === 'headline') await title({ kicker: `第 ${G.turn} 回合`, main: '头条阶段', small: '双方各暗出一张牌 · 同时翻开 · 都作为事件发生', ms: 1700 });
        else {
          hand.live(false);
          await title({ kicker: `第 ${info.round} 行动轮`, main: info.who === 0 ? '你的行动' : '苏联行动', side: info.who, ms: 950, dark: 0.55 });
        }
      },

      /* ---- headline */
      // no second screen for the headline: a card dragged out is played
      async pickHeadline() {
        await clearScene();
        hand.away(false);
        const idle = { at: 'top', main: '头条阶段', small: '把一张牌拖出手牌，松手就打出 · 它会作为事件发生' };
        sub.set(idle);
        const pick = await ctx.pickCard({
          click: false,
          onCarry: (no) => sub.set({ at: 'top', main: '头条阶段', small: carryLine(ctx, no).text }),
          onBack: () => sub.set(idle),
        });
        sub.clear();
        base.ui.from = pick.rect;
        return pick.no;
      },

      async showHeadline(x) {
        veil.show(0.66);
        await base.showHeadline.call(this, x);
        veil.hide();
      },

      /* ---- the player's decision */
      async decide() {
        const r = await pickAndChoose({ main: '你的行动', small: '打出一张牌 · 点一张手牌，或把它拖出来', side: 0 }, false);
        base.ui.from = r.from;
        return decision(r.no, r.key);
      },

      /* ---- a card is played */
      async announce(play) {
        await clearScene();
        hand.live(false);
        const line = playLine(ctx, play);
        if (play.headline) {
          sub.set({ main: `《${play.card.title}》`, small: `${SIDE_NAME[play.by]}的头条事件`, side: play.by });
          return base.announce.call(this, play);
        }
        board.clearBadges('last');
        hand.away(true);
        if (play.by === 0) {
          await base.ui.toTable(play.no, base.ui.from);
          base.ui.from = null;
        } else {
          // a red title card: their card, and in large type what they are doing with it
          const what = play.use === 'ops' ? `${MODE_NAME[play.mode]}${play.mode !== 'place' && play.target ? ` · ${ctx.name(play.target)}` : ''}` : line.what;
          const small = play.use === 'ops' ? `《${play.card.title}》 · 行动 ${play.points} 点` : `《${play.card.title}》${line.detail ? ` · ${line.detail}` : ''}`;
          const from = await title({ kicker: '苏联打出', main: what, small, side: 1, no: play.no, ms: 1900, dark: 0.82 });
          await base.ui.toTable(play.no, from);
        }
        sub.set({ main: `《${play.card.title}》`, small: `${line.who} · ${line.what}${line.detail}`, side: play.by });
        if (play.target) {
          await focusCountry(play.target);
          board.ring(play.target, sideCls(play.by));
          await wait(650);
        }
      },

      /* ---- placing influence */
      async place(session, play) {
        await clearScene();
        let act = deferred();
        const press = (what) => act.resolve(what);
        const draw = () => {
          const t = session.targets();
          const ok = new Map([...t].filter(([, v]) => v.ok));
          const put = [...new Set(session.spent.map((s) => s.id))];
          board.mark({ kind: 'place', ok, lift: put, keep: put });
          board.clearBadges('cost');
          board.clearBadges('put');
          for (const [id, v] of ok) if (v.cost > 1) board.badge(id, 'cost', `${v.cost}`, 'b');
          for (const id of put) board.badge(id, 'put', `+${session.count(id)}`, 'a');
          veil.show(0.62, pools(new Set([...ok.keys(), ...put])));
          const none = !session.spent.length;
          sub.set({
            big: session.left,
            main: `放置影响力 · 还剩 ${session.left} 点`,
            small: session.left ? (ok.size ? '点亮着的国家，每下放 1 点 · 标着 ×2 的是对手控制的国家，要花 2 点' : '剩下的点数不够放在任何地方') : '点数用完了：确认，或撤销重放',
            side: 0,
            keys: [
              ...(none ? [] : [{ label: '撤销', key: 'backspace', keyLabel: '⌫', on: () => press('undo') }]),
              none ? { label: '收回这张牌', key: 'escape', keyLabel: 'Esc', on: () => press('cancel') } : { label: '完成', key: 'enter', keyLabel: '↵', on: () => press('done'), primary: true },
            ],
          });
          return ok;
        };
        const end = () => {
          board.mark(null);
          board.clearBadges('cost');
          board.clearBadges('put');
          veil.hide();
          sub.clear();
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
            return false;
          } else if (got) {
            const e = session.add(got);
            if (e) {
              slam(got, '+1', 'a small');
              board.ring(got, 'a');
              if (e.ctrlTo !== e.ctrlFrom) board.pop(got, e.ctrlTo === 0 ? '美国控制' : '打破控制', 'gold late');
            }
          }
        }
        end();
        return true;
      },

      /* ---- choosing a country */
      async pickTarget(req) {
        await clearScene();
        // a second choice in the same play is made from the view the player had, not from close up
        if (scene.cam) {
          restoreCam();
          await wait(650);
        }
        const act = deferred();
        const kind = req.mode;
        const warn = kind === 'coup' ? [...req.targets].filter(([, p]) => p.key).map(([id]) => id) : [];
        board.mark({ kind, ok: req.targets, locked: req.locked, warn });
        for (const [id, p] of req.targets) {
          if (kind === 'coup') board.badge(id, 'need', p.need ? `≥${p.need}` : '✕', p.need ? '' : 'off');
          if (kind === 'realign') board.badge(id, 'need', p.edge > 0 ? `+${p.edge}` : p.edge < 0 ? `−${-p.edge}` : '±0', p.edge > 0 ? 'good' : p.edge < 0 ? 'bad' : '');
        }
        for (const id of req.locked.keys()) board.badge(id, 'lock', ICON.lock);
        veil.show(0.52, pools(req.targets.keys()));
        const main = kind === 'event' ? `《${req.title}》 · 第 ${req.total - req.left + 1} / ${req.total} 个` : kind === 'realign' ? `调整阵营 · 还能掷 ${req.left} 次` : '政变 · 选一个国家';
        const hint =
          kind === 'coup' ? '亮着的国家有对手的影响力 · 脚下的数字是成功所需的点数' : kind === 'realign' ? '亮着的国家有对手的影响力 · 脚下的数字是你的骰子比对手多加几点' : req.hint;
        const keys = [];
        if (req.optional) keys.push({ label: '到此为止', key: 'enter', keyLabel: '↵', on: () => act.resolve(null), primary: true });
        if (req.cancel) keys.push({ label: '收回这张牌', key: 'escape', keyLabel: 'Esc', on: () => act.resolve(null) });
        sub.set({ main, small: hint, side: 0, keys, big: req.total > 1 ? req.left : '' });
        const off = board.onHover((id) => {
          if (id && req.locked.has(id)) return sub.say(`${ICON.lock}${ctx.name(id)}：${req.locked.get(id)}`, 'bad');
          const p = id && req.targets.get(id);
          if (!p) return sub.say(hint);
          if (kind === 'coup')
            sub.say(`<b>${ctx.name(id)}</b>${p.need ? `掷出 ≥${p.need} 成功 · ${Math.round(p.chance * 100)}%` : '这张牌的点数不够，不可能成功'}${p.key ? `<em>${ICON.warn}战场国：核危机 ${G.crisis} → ${p.crisisTo}</em>` : ''}`, p.key ? 'warn' : '');
          else if (kind === 'realign') sub.say(`<b>${ctx.name(id)}</b>你的骰子 +${p.mods[0].reduce((a, m) => a + m.n, 0)} · 苏联的骰子 +${p.mods[1].reduce((a, m) => a + m.n, 0)}`);
          else sub.say(`<b>${ctx.name(id)}</b>${hint}`);
        });
        const id = await Promise.race([board.pick(req.targets), act.promise]);
        off();
        board.cancelPick();
        board.clearBadges('need');
        board.clearBadges('lock');
        board.mark(null);
        veil.hide();
        if (id) {
          sub.set({ main: `${kind === 'event' ? `《${req.title}》` : MODE_NAME[kind]} · ${ctx.name(id)}`, small: '', side: 0 });
          await focusCountry(id);
          board.ring(id, 'a');
          await wait(450);
        } else sub.clear();
        return id;
      },

      /* ---- dice: letterbox, one large die */
      async roll(spec) {
        await clearScene();
        sub.clear();
        hand.away(true);
        const side = spec.by;
        const head = spec.kind === 'space' ? MODE_NAME.space : `${MODE_NAME[spec.kind]} · ${ctx.name(spec.id)}`;
        const need =
          spec.kind === 'coup'
            ? spec.need
              ? `掷出 ≥${spec.need} 成功 · ${Math.round(spec.chance * 100)}%`
              : '这张牌的点数不够，不可能成功'
            : spec.kind === 'space'
              ? `掷出 1–${spec.max} 成功 · ${Math.round(spec.chance * 100)}%`
              : '点数高的一方胜出 · 输家移除差额的影响力';
        const dice = spec.dice.map((d) => ({ d, die: ctx.makeDie({ side: d.side }) }));
        const seat = (x, i) =>
          `<div class="s4-seat ${sideCls(x.d.side)}" data-i="${i}"><span class="s4-seat-who">${SIDE_NAME[x.d.side]}</span><div class="s4-die"></div><b class="s4-num"></b>` +
          `<div class="s4-mods">${x.d.mods.map((m) => `<span>+${m.n} ${m.label}</span>`).join('') || '<span>无加值</span>'}</div><b class="s4-total"></b></div>`;
        const stage = el('div', `s4-dice k-${spec.kind} ${sideCls(side)}`);
        stage.innerHTML =
          '<i class="s4-bar top"></i><i class="s4-bar bottom"></i>' +
          `<div class="s4-dice-head"><span>${SIDE_NAME[side]}</span><b>${head}</b><small>${need}</small></div>` +
          `<div class="s4-seats">${dice.map(seat).join('<i class="s4-vs">对</i>')}</div><div class="s4-math"></div><div class="s4-verdict"></div>`;
        layer.appendChild(stage);
        dice.forEach((x, i) => {
          // out of sight until it is thrown in from the side
          x.die.el.style.visibility = 'hidden';
          stage.querySelector(`.s4-seat[data-i="${i}"] .s4-die`).appendChild(x.die.el);
        });
        veil.show(0.92);
        // two frames, so that the bars start from nothing
        requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.add('is-in')));
        await wait(850);
        await Promise.all(
          dice.map(async (x, i) => {
            if (i) await wait(420);
            // thrown from the roller's side of the table: it lands, bounces, rolls on and tips over.
            // The screen takes each knock; the number is struck when the die falls flat.
            await x.die.throw(x.d.value, {
              ms: 2400,
              from: x.d.side === 0 ? { x: -1, y: 0.42 } : { x: 1, y: -0.42 },
              reach: dice.length > 1 ? 3.4 : 4.3,
              onImpact: (k) => {
                if (k < 3) return fx.shake(game, [8, 4, 2][k], 240);
                const s = stage.querySelector(`.s4-seat[data-i="${i}"]`);
                s.querySelector('.s4-num').textContent = x.d.value;
                s.classList.add('is-landed');
                fx.shake(game, 5, 320);
              },
            });
          }),
        );
        await wait(520);
        const math = stage.querySelector('.s4-math');
        if (spec.kind === 'coup') {
          const d = spec.dice[0];
          math.innerHTML = `<b>${d.value}</b><i>+</i>行动点 <b>${d.total - d.value}</b><i>=</i><b class="sum">${d.total}</b><em>对</em>${spec.bar.label}<i>=</i><b class="bar">${spec.bar.n}</b>`;
        } else if (spec.kind === 'realign') {
          dice.forEach((x, i) => (stage.querySelector(`.s4-seat[data-i="${i}"] .s4-total`).textContent = x.d.total));
          math.innerHTML = `<b class="a">${spec.dice[0].total}</b><em>对</em><b class="b">${spec.dice[1].total}</b>`;
        } else math.innerHTML = `<b>${spec.dice[0].value}</b><em>要</em><b class="bar">1–${spec.max}</b>`;
        stage.classList.add('is-read');
        await wait(700);
        const tone = spec.kind === 'realign' ? (spec.winner === null ? 'even' : spec.winner === 0 ? 'good' : 'bad') : spec.ok === (spec.by === 0) ? 'good' : 'bad';
        stage.querySelector('.s4-verdict').textContent = spec.text;
        stage.classList.add('is-done', tone);
        if (tone === 'bad') fx.shake(game, 5, 300);
        await wait(1500);
        stage.classList.add('is-out');
        veil.hide();
        await wait(480);
        stage.remove();
      },

      /* ---- one consequence */
      async step(e, commit, cause) {
        const d = describe(ctx, e);
        if (e.t === 'inf') {
          await focusCountry(e.id);
          sub.set({ main: ctx.name(e.id), small: `${SIDE_NAME[e.side]}影响力 ${d.short}${d.took ? `<em class="gold">${d.took.replace(' · ', '')}</em>` : ''}`, side: e.side });
          await wait(380);
          slam(e.id, d.short, d.cls);
          await wait(240);
          commit();
          board.ring(e.id, d.cls);
          if (d.took) board.pop(e.id, d.took.replace(' · ', ''), 'gold late');
          // what the opponent changed stays marked until the player's next card
          if (cause?.by === 1) board.badge(e.id, 'last', d.short, d.cls);
          await wait(1250);
        } else if (d.meter) {
          sub.clear();
          const pane = await bringPane(d.meter);
          const label = { crisis: '核危机', milops: `${SIDE_NAME[e.side] ?? ''}军事行动`, vp: '胜利点', space: '太空竞赛' }[d.meter];
          const big =
            e.t === 'vp' ? `${SIDE_NAME[e.side]} <i>+</i>${e.d}` : e.t === 'space' ? `${SIDE_NAME[e.side]} <i>→</i> 第 ${e.to} 步` : `${e.from} <i>→</i> ${e.to}`;
          // who caused it, when it was a move and not a card's own text
          const who = cause && cause.kind !== 'event' ? SIDE_NAME[cause.by] : '';
          const cap = el('div', `s4-cap ${d.cls} t-${e.t}`, `<span>${label}</span><b>${big}</b><small>${who}${d.why ?? ''}</small>`);
          layer.appendChild(cap);
          await wait(520);
          commit();
          if (e.t === 'crisis' && e.d < 0) {
            if (pane) fx.shake(pane, 8, 460);
            const alarm = el('i', 's4-alarm');
            layer.appendChild(alarm);
            setTimeout(() => alarm.remove(), 1500);
          }
          await wait(e.t === 'crisis' ? 2000 : 1350);
          cap.classList.add('is-out');
          setTimeout(() => cap.remove(), 350);
        } else {
          if (e.id) await focusCountry(e.id);
          sub.set({ main: d.text, small: '', side: null });
          if (e.id) board.pop(e.id, '—', 'note');
          commit();
          await wait(1300);
        }
      },

      async trigger(play) {
        await clearScene();
        sub.clear();
        await title({ kicker: '苏联事件触发', main: `《${play.card.title}》`, small: '你用了对手的牌行动：它的事件现在发生', side: 1, ms: 1500 });
      },

      async settle(play) {
        await clearScene();
        sub.clear();
        restoreCam();
        await base.settle.call(this, play);
        hand.away(false);
      },

      destroy() {
        veil.stop();
        offSubKeys?.();
        if (scene.pane) {
          scene.pane.style.transform = '';
          scene.pane.classList.remove('s4-abroad');
        }
        base.destroy();
      },
    };
    return P;
  },
};
