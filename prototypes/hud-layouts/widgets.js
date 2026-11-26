// The parts a HUD is made of. A layout is plain HTML with placeholders:
//
//   <div data-w="vp" data-form="bar"></div>
//   <div data-w="pile" data-kind="discard"></div>
//
// hydrate() fills every placeholder and keeps it in step with the state. Each part comes in a few
// forms (a full track, a chip, a dial ...) so that layouts can differ in more than position.
//
//   vp       bar (add data-v for upright) | chip | big
//   time     chip | medal | line | rounds | turns
//   phase    whose move it is, in words
//   crisis   ladder (data-v) | chip | dial
//   milops   rows | chip | one (data-side)
//   space    track (data-v) | chip | one (data-side)
//   pile     data-kind = deck | discard | removed; stack | chip
//   played   the card on the table this round
//   opp      the opponent's hand: fan | chip
//   side     a side's crest and name (data-side)
//   log      the last few plays
//
// fine.js adds the drawn forms: vp rule, time dial, crisis gauge, milops armor, space orbit.
import { S, RULES, SIDES, CRISIS, byNo, eraOf, on, actions, restingPile } from './state.js';
import { icon } from './icons.js';
import { cardEl, backEl, miniBack, fitCard, fly, cardRectIn } from './cards.js';
import { FINE } from './fine.js';

const times = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join('');
const lb = (text, ic) => `<span class="lb">${ic ? icon(ic) : ''}${text}</span>`;
const pt = (cx, cy, r, deg) => `${(cx + r * Math.cos((deg * Math.PI) / 180)).toFixed(2)},${(cy + r * Math.sin((deg * Math.PI) / 180)).toFixed(2)}`;
const arc = (cx, cy, r, a0, a1) => `M${pt(cx, cy, r, a0)}A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${pt(cx, cy, r, a1)}`;
const state3 = (i, now) => (i < now ? 'done' : i === now ? 'now' : 'todo');

export const lead = (s) => (s.vp === 0 ? { side: null, n: 0, text: '均势', who: '双方均势' } : { side: s.vp > 0 ? 0 : 1, n: Math.abs(s.vp), text: `${SIDES[s.vp > 0 ? 0 : 1].short} +${Math.abs(s.vp)}`, who: `${SIDES[s.vp > 0 ? 0 : 1].name}领先` });
const leadCls = (s) => (s.vp === 0 ? 'lead-0' : s.vp > 0 ? 'lead-a' : 'lead-b');
function setLead(el, s) {
  el.classList.remove('lead-0', 'lead-a', 'lead-b');
  el.classList.add(leadCls(s));
}

const PILES = { deck: '牌库', discard: '弃牌堆', removed: '废牌堆' };
const pileEl = (kind) => document.querySelector(`[data-w="pile"][data-kind="${kind}"]`);

const W = {
  /* ------------------------------------------------------------------ score */
  vp(el, d) {
    const form = d.form ?? 'bar';
    if (form === 'chip') {
      el.innerHTML = `${lb('胜利点', 'vp')}<b class="num"></b>`;
      return (s) => {
        setLead(el, s);
        el.querySelector('.num').textContent = lead(s).text;
      };
    }
    if (form === 'dial') {
      const ticks = times(9, (i) => `<path class="vd-tick" d="M${pt(60, 62, 39, 180 + i * 22.5)}L${pt(60, 62, i % 2 ? 43 : 46, 180 + i * 22.5)}"/>`);
      el.innerHTML = `<svg viewBox="0 0 120 70" class="vd"><path class="vd-arc a" d="${arc(60, 62, 48, 181, 268.5)}"/><path class="vd-arc b" d="${arc(60, 62, 48, 271.5, 359)}"/>${ticks}<text class="vd-t" x="9" y="69">${SIDES[0].short}</text><text class="vd-t" x="111" y="69">${SIDES[1].short}</text><g class="vd-needle"><path d="M60,62L58.2,58L60,20L61.8,58Z"/></g><circle cx="60" cy="62" r="5.2" class="cr-hub"/></svg><div class="vd-read">${lb('胜利点', 'vp')}<b class="num"></b></div>`;
      return (s) => {
        setLead(el, s);
        el.querySelector('.num').textContent = lead(s).text;
        el.querySelector('.vd-needle').style.transform = `rotate(${(-s.vp / RULES.vpMax) * 90}deg)`;
      };
    }
    if (form === 'big') {
      el.innerHTML = `${lb('胜利点', 'vp')}<b class="num"></b><span class="who"></span>`;
      return (s) => {
        setLead(el, s);
        el.querySelector('.num').textContent = s.vp === 0 ? '0' : '+' + lead(s).n;
        el.querySelector('.who').textContent = lead(s).who;
      };
    }
    // upright, the opponent's end is at the top and the player's at the bottom
    const first = 'v' in d ? 1 : 0;
    const end = (i) => `<span class="vp-end ${SIDES[i].key}"><b>${SIDES[i].short}</b></span>`;
    const scale = 'scale' in d ? [20, 10, 0, 10, 20].map((n, i) => `<i class="vp-n" style="--at:${i / 4}">${n}</i>`).join('') : '';
    el.innerHTML = `${end(first)}<div class="vp-track"><i class="vp-ticks"></i><i class="vp-fill"></i><i class="vp-zero"></i>${scale}<b class="vp-mark"><span></span></b></div>${end(1 - first)}`;
    return (s) => {
      const p = 0.5 + ((first === 0 ? -1 : 1) * s.vp) / (2 * RULES.vpMax);
      el.style.setProperty('--p', p.toFixed(4));
      el.style.setProperty('--lo', Math.min(p, 0.5).toFixed(4));
      el.style.setProperty('--len', Math.abs(p - 0.5).toFixed(4));
      setLead(el, s);
      el.querySelector('.vp-mark span').textContent = String(lead(s).n);
    };
  },

  /* ------------------------------------------------------------------ turn and action round */
  time(el, d) {
    const form = d.form ?? 'chip';
    if (form === 'chip') {
      el.innerHTML = `${lb('回合', 'turn')}<b class="t-turn"></b><i>/${RULES.turns}</i><span class="sep"></span>${lb('行动轮')}<b class="t-round"></b><i>/${RULES.rounds}</i>`;
      return (s) => {
        el.querySelector('.t-turn').textContent = s.turn;
        el.querySelector('.t-round').textContent = s.round;
      };
    }
    if (form === 'medal') {
      const gap = 5;
      const each = 360 / RULES.turns;
      const segs = times(RULES.turns, (i) => `<path class="seg" d="${arc(50, 50, 45, -90 + i * each + gap / 2, -90 + (i + 1) * each - gap / 2)}"/>`);
      el.innerHTML = `<svg viewBox="0 0 100 100" class="md-ring">${segs}</svg><div class="md-in">${lb('回合')}<b class="t-turn"></b><span class="t-era"></span></div>`;
      return (s) => {
        el.querySelectorAll('.seg').forEach((p, i) => p.setAttribute('class', 'seg ' + state3(i + 1, s.turn)));
        el.querySelector('.t-turn').textContent = s.turn;
        el.querySelector('.t-era').textContent = eraOf(s.turn).name;
      };
    }
    if (form === 'line') {
      el.innerHTML = times(RULES.turns, (i) => {
        const era = RULES.eras.find((e) => e.from === i + 1);
        return `<div class="tl-cell" data-era="${eraOf(i + 1).id}">${era ? `<span class="tl-era">${era.name}</span>` : ''}<b>${i + 1}</b><span class="tl-rounds">${times(RULES.rounds, () => '<i></i>')}</span></div>`;
      });
      return (s) => {
        el.querySelectorAll('.tl-cell').forEach((c, i) => {
          c.className = 'tl-cell ' + state3(i + 1, s.turn);
          c.querySelectorAll('.tl-rounds i').forEach((t, j) => (t.className = i + 1 === s.turn ? state3(j + 1, s.round) : ''));
        });
      };
    }
    if (form === 'turns') {
      el.innerHTML = `${'label' in d ? lb('回合', 'turn') : ''}<span class="pips">${times(RULES.turns, (i) => `<i class="pip${RULES.eras.some((e) => e.from === i + 1 && i) ? ' gap' : ''}"><b>${i + 1}</b></i>`)}</span>`;
      return (s) => el.querySelectorAll('.pip').forEach((p, i) => (p.className = p.className.replace(/ (done|now|todo)/g, '') + ' ' + state3(i + 1, s.turn)));
    }
    // rounds
    el.innerHTML = `${'label' in d ? lb('行动轮') : ''}<span class="pips">${times(RULES.rounds, (i) => `<i class="pip"><b>${i + 1}</b></i>`)}</span>`;
    return (s) => {
      el.classList.toggle('a', s.active === 0);
      el.classList.toggle('b', s.active === 1);
      el.querySelectorAll('.pip').forEach((p, i) => (p.className = 'pip ' + state3(i + 1, s.round)));
    };
  },

  phase(el) {
    el.innerHTML = '<i class="ph-dot"></i><b></b><span></span>';
    return (s) => {
      el.classList.toggle('a', s.active === 0);
      el.classList.toggle('b', s.active === 1);
      el.querySelector('b').textContent = s.active === 0 ? '你的行动轮' : `${SIDES[1].name}行动中`;
      el.querySelector('span').textContent = s.active === 0 ? '从手牌拖出一张牌' : '等待对手出牌…';
    };
  },

  /* ------------------------------------------------------------------ nuclear crisis */
  crisis(el, d) {
    const form = d.form ?? 'ladder';
    if (form === 'chip') {
      el.innerHTML = `${lb('核危机', 'crisis')}<b class="num"></b><span class="cr-mini">${times(RULES.crisisMax, (i) => `<i class="l${RULES.crisisMax - i}"></i>`)}</span>`;
    } else if (form === 'dial') {
      const each = 180 / RULES.crisisMax;
      const segs = times(RULES.crisisMax, (i) => `<path class="cr-seg l${RULES.crisisMax - i}" d="${arc(60, 62, 48, 180 + i * each + 1.5, 180 + (i + 1) * each - 1.5)}"/>`);
      const nums = times(RULES.crisisMax, (i) => `<text class="cr-t l${RULES.crisisMax - i}" x="${pt(60, 62, 34, 180 + (i + 0.5) * each).split(',')[0]}" y="${+pt(60, 62, 34, 180 + (i + 0.5) * each).split(',')[1] + 3.4}">${RULES.crisisMax - i}</text>`);
      el.innerHTML = `<svg viewBox="0 0 120 70" class="cr-dial">${segs}${nums}<g class="cr-needle"><path d="M60,62L58.2,58L60,22L61.8,58Z"/></g><circle cx="60" cy="62" r="5.2" class="cr-hub"/></svg><div class="cr-read">${lb('核危机', 'crisis')}<b class="num"></b><span class="cr-name"></span></div>`;
    } else {
      el.innerHTML = `${'nolabel' in d ? '' : lb('核危机', 'crisis')}<div class="cr-cells">${times(RULES.crisisMax, (i) => `<i class="cr-cell l${RULES.crisisMax - i}">${RULES.crisisMax - i}</i>`)}</div>${'name' in d ? '<span class="cr-name"></span>' : ''}`;
    }
    return (s) => {
      el.dataset.level = s.crisis;
      el.style.setProperty('--level', s.crisis);
      const num = el.querySelector('.num');
      if (num) num.textContent = s.crisis;
      const name = el.querySelector('.cr-name');
      if (name) name.textContent = CRISIS[s.crisis];
      el.querySelectorAll('.cr-cell, .cr-mini i, .cr-seg, .cr-t').forEach((c) => {
        const l = +(c.getAttribute('class').match(/\bl(\d)/) ?? [])[1];
        c.classList.toggle('on', l === s.crisis);
        c.classList.toggle('past', l > s.crisis);
      });
      const needle = el.querySelector('.cr-needle');
      if (needle) needle.style.transform = `rotate(${-90 + (RULES.crisisMax - s.crisis + 0.5) * (180 / RULES.crisisMax)}deg)`;
    };
  },

  /* ------------------------------------------------------------------ military operations */
  milops(el, d) {
    const form = d.form ?? 'rows';
    const pips = () => `<span class="mo-pips">${times(RULES.milopsMax, () => '<i></i>')}<em class="mo-need"></em></span>`;
    const fill = (root, n, need) => {
      root.querySelectorAll('.mo-pips i').forEach((p, i) => (p.className = i < n ? 'on' : ''));
      root.style.setProperty('--need', need);
      root.classList.toggle('met', n >= need);
    };
    if (form === 'chip') {
      el.innerHTML = `${lb('军事行动', 'milops')}<b class="a"></b><b class="b"></b><i class="mo-req"></i>`;
      return (s) => {
        el.querySelector('b.a').textContent = s.milops[0];
        el.querySelector('b.b').textContent = s.milops[1];
        el.querySelector('.mo-req').textContent = `需 ${s.crisis}`;
      };
    }
    if (form === 'marks') {
      // two markers to lay along a scale that the layout draws (0 at one end, the maximum at the other)
      el.innerHTML = SIDES.map((x) => `<b class="mo-mk ${x.key}">${x.short}</b>`).join('');
      return (s) => el.querySelectorAll('.mo-mk').forEach((m, i) => m.style.setProperty('--n', s.milops[i]));
    }
    if (form === 'one') {
      const side = +(d.side ?? 0);
      el.innerHTML = `${lb('军事行动', 'milops')}${pips()}<b class="num"></b><i class="of"></i>`;
      el.classList.add(SIDES[side].key);
      return (s) => {
        fill(el, s.milops[side], s.crisis);
        el.querySelector('.num').textContent = s.milops[side];
        el.querySelector('.of').textContent = `/${s.crisis}`;
      };
    }
    el.innerHTML = `<div class="mo-head">${lb('军事行动', 'milops')}<span class="mo-req"></span></div>${SIDES.map((x) => `<div class="mo-row ${x.key}"><i class="sd ${x.key}">${x.short}</i>${pips()}<b class="num"></b><span class="mo-gap"></span></div>`).join('')}`;
    return (s) => {
      el.querySelector('.mo-req').textContent = `本回合需 ${s.crisis}`;
      el.querySelectorAll('.mo-row').forEach((row, i) => {
        fill(row, s.milops[i], s.crisis);
        row.querySelector('.num').textContent = s.milops[i];
        const gap = s.crisis - s.milops[i];
        row.querySelector('.mo-gap').textContent = gap > 0 ? `差 ${gap}` : '达标';
      });
    };
  },

  /* ------------------------------------------------------------------ space race */
  space(el, d) {
    const form = d.form ?? 'track';
    if (form === 'chip') {
      el.innerHTML = `${lb('太空竞赛', 'space')}<b class="a"></b><b class="b"></b><i class="of">/${RULES.spaceMax}</i>`;
      return (s) => {
        el.querySelector('b.a').textContent = s.space[0];
        el.querySelector('b.b').textContent = s.space[1];
      };
    }
    if (form === 'one') {
      const side = +(d.side ?? 0);
      el.innerHTML = `${lb('太空竞赛', 'space')}<span class="sp-mini">${times(RULES.spaceMax, () => '<i></i>')}</span><b class="num"></b><i class="of">/${RULES.spaceMax}</i>`;
      el.classList.add(SIDES[side].key);
      return (s) => {
        el.querySelectorAll('.sp-mini i').forEach((p, i) => (p.className = i < s.space[side] ? 'on' : ''));
        el.querySelector('.num').textContent = s.space[side];
      };
    }
    // nine stops: the launch pad, then eight steps
    el.innerHTML = `${'nolabel' in d ? '' : lb('太空竞赛', 'space')}<div class="sp-track">${times(RULES.spaceMax + 1, (i) => `<i class="sp-cell">${i || ''}</i>`)}<b class="sp-mk a">${SIDES[0].short}</b><b class="sp-mk b">${SIDES[1].short}</b></div>`;
    return (s) => {
      el.querySelector('.sp-mk.a').style.setProperty('--n', s.space[0]);
      el.querySelector('.sp-mk.b').style.setProperty('--n', s.space[1]);
      el.querySelectorAll('.sp-cell').forEach((c, i) => {
        c.classList.toggle('a', i <= s.space[0] && i > 0);
        c.classList.toggle('b', i <= s.space[1] && i > 0);
      });
    };
  },

  /* ------------------------------------------------------------------ the three piles */
  pile(el, d) {
    const kind = d.kind;
    const form = d.form ?? 'stack';
    el.classList.add('k-' + kind);
    el.setAttribute('role', 'button');
    el.title = kind === 'deck' ? '牌库 · 点击抽一张（演示）' : `${PILES[kind]} · 点击查看`;
    el.addEventListener('click', () => (kind === 'deck' ? actions.draw() : openBrowser(kind)));
    if (form === 'chip') {
      el.innerHTML = `${lb(PILES[kind], kind)}<b class="num"></b><i class="pile-card ghost"></i>`;
      return (s) => (el.querySelector('.num').textContent = s[kind].length);
    }
    el.innerHTML = `<div class="pile-card"></div><div class="pile-cap">${lb(PILES[kind])}<b class="num"></b></div>`;
    const slot = el.firstChild;
    let top;
    if (kind === 'deck') slot.appendChild(backEl());
    return (s) => {
      const n = s[kind].length;
      el.querySelector('.num').textContent = n;
      el.classList.toggle('empty', n === 0);
      slot.style.setProperty('--depth', Math.min(6, Math.ceil(n / 4)));
      if (kind === 'deck') return;
      const no = s[kind][n - 1];
      if (no === top) return;
      top = no;
      slot.replaceChildren();
      if (no) {
        const c = cardEl(no);
        slot.appendChild(c);
        fitCard(c);
        if (kind === 'removed') slot.insertAdjacentHTML('beforeend', `<i class="pile-x">${icon('removed')}</i>`);
      }
    };
  },

  /* ------------------------------------------------------------------ the card on the table */
  played(el) {
    el.innerHTML = `<div class="pl-slot"><span class="pl-hint">拖到地图上<br>松手打出</span></div><div class="pl-cap">${lb('本轮出牌')}<span class="pl-by"></span></div>`;
    const slot = el.firstChild;
    let shown = null;
    return (s, what, detail) => {
      const now = s.played;
      el.classList.toggle('has', !!now);
      el.classList.toggle('a', now?.by === 0);
      el.classList.toggle('b', now?.by === 1);
      el.querySelector('.pl-by').textContent = now ? `${SIDES[now.by].name}打出` : '';
      if (shown === (now?.no ?? null)) return;
      const old = slot.querySelector('.slot');
      // the card that was here leaves for its pile
      if (old && detail?.gone) {
        const to = pileEl(restingPile(detail.gone.no));
        fly(old, old.getBoundingClientRect(), cardRectIn(to?.querySelector('.pile-card') ?? to), { fade: true });
      }
      old?.remove();
      shown = now?.no ?? null;
      if (!now) return;
      const c = cardEl(now.no);
      slot.appendChild(c);
      fitCard(c);
      if (what === 'play' || what === 'step' || what === 'turn') {
        c.classList.add('arriving');
        // the opponent's card comes from wherever their hand is drawn, or from off the top
        if (now.by === 1) {
          const opp = document.querySelector('[data-w="opp"]')?.getBoundingClientRect();
          const to = c.getBoundingClientRect();
          const w = to.width * 0.4;
          const from = opp?.width ? { left: opp.left + opp.width / 2 - w / 2, top: opp.top, width: w, height: w * 1.4 } : { left: window.innerWidth / 2 - w / 2, top: -w * 1.5, width: w, height: w * 1.4 };
          fly(c, from, to);
        }
      }
    };
  },

  /* ------------------------------------------------------------------ the opponent's hand */
  opp(el, d) {
    const form = d.form ?? 'fan';
    if (form === 'chip') {
      el.innerHTML = `${lb('对手手牌', 'hand')}<b class="num"></b>`;
      return (s) => (el.querySelector('.num').textContent = s.oppHand);
    }
    el.innerHTML = `<span class="op-cards"></span><span class="op-cap">${lb('对手手牌')}<b class="num"></b></span>`;
    let n = -1;
    return (s) => {
      el.querySelector('.num').textContent = s.oppHand;
      if (n === s.oppHand) return;
      n = s.oppHand;
      el.querySelector('.op-cards').innerHTML = times(n, (i) => `<i class="mb" style="--t:${(i - (n - 1) / 2).toFixed(2)}"></i>`);
    };
  },

  side(el, d) {
    const i = +(d.side ?? 0);
    const x = SIDES[i];
    el.classList.add(x.key);
    el.innerHTML = `<i class="crest ${x.key}"><b>${x.short}</b></i><span class="sd-text"><b class="sd-name">${x.name}</b><span class="sd-role">${x.role}</span></span>`;
    return (s) => el.classList.toggle('active', s.active === i);
  },

  log(el, d) {
    const max = +(d.max ?? 5);
    return (s) => {
      el.innerHTML =
        lb('出牌记录') +
        s.log
          .slice(-max)
          .reverse()
          .map(({ no, by }, i) => {
            const c = byNo[no];
            return `<i class="lg side-${c.side} by-${SIDES[by].key}${i === 0 ? ' latest' : ''}" title="${SIDES[by].name}：${c.title}"><b>${c.side === 'tally' ? '✦' : c.value}</b><em>${SIDES[by].short}</em></i>`;
          })
          .join('');
    };
  },
};

/** Fills every [data-w] under root. Returns a function that stops the updates. */
export function hydrate(root) {
  const updates = [];
  for (const el of root.querySelectorAll('[data-w]')) {
    // a fine form (fine.js) where there is one for this part, the plain part otherwise
    const make = FINE[el.dataset.w]?.[el.dataset.form] ?? W[el.dataset.w];
    if (!make) continue;
    el.classList.add('w', 'w-' + el.dataset.w);
    if (el.dataset.form) el.classList.add('f-' + el.dataset.form);
    const up = make(el, el.dataset);
    if (up) updates.push(up);
  }
  for (const up of updates) up(S, 'mount');
  return on((s, what, detail) => {
    for (const up of updates) up(s, what, detail);
  });
}

/* ------------------------------------------------------------------ looking through a pile */

export function openBrowser(kind) {
  const host = document.getElementById('overlay');
  if (!host) return;
  const list = [...S[kind]].reverse();
  host.innerHTML =
    `<div class="pb" role="dialog" aria-label="${PILES[kind]}"><header><h2>${PILES[kind]}</h2><span>${list.length} 张 · 最近的在前</span><button type="button" class="pb-x" aria-label="关闭">×</button></header>` +
    `<div class="pb-grid">${list.length ? '' : '<p class="pb-none">这里还没有牌。</p>'}</div></div>`;
  host.hidden = false;
  const grid = host.querySelector('.pb-grid');
  for (const no of list) {
    const c = cardEl(no);
    grid.appendChild(c);
    fitCard(c);
  }
  const close = () => {
    host.hidden = true;
    host.replaceChildren();
    window.removeEventListener('keydown', key, true);
  };
  const key = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };
  window.addEventListener('keydown', key, true);
  host.onclick = (e) => {
    if (e.target === host || (e.target instanceof Element && e.target.closest('.pb-x'))) close();
  };
}
