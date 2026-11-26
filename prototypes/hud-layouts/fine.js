// The fine forms of the meters: the same numbers as widgets.js, drawn as the thing they stand for.
//
//   <div data-w="crisis" data-form="gauge"></div>    a needle creeping toward the radiation sign
//   <div data-w="milops" data-form="armor"></div>    two columns of tanks against one requirement line
//   <div data-w="space"  data-form="orbit"></div>    two rockets passing eight real firsts
//   <div data-w="vp"     data-form="rule"></div>     an engraved rule with one rider
//   <div data-w="time"   data-form="dial"></div>     ten turns round a rim, split where an era ends
//
// Clicking a fine meter steps it to its next value. That is only for looking at every state of the
// drawing; no rule is behind it.
import { RULES, SIDES, CRISIS, eraOf, actions } from './state.js';
import { tank, rocket, spaceStep, SPACE_STEPS, trefoil } from './glyphs.js';
import './fine.css';

const times = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join('');
const lb = (text, ic) => `<span class="lb">${ic ?? ''}${text}</span>`;
const xy = (cx, cy, r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
const pt = (cx, cy, r, deg) => xy(cx, cy, r, deg).map((v) => v.toFixed(2)).join(',');
const arc = (cx, cy, r, a0, a1) => `M${pt(cx, cy, r, a0)}A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${pt(cx, cy, r, a1)}`;
const state3 = (i, now) => (i < now ? 'done' : i === now ? 'now' : 'todo');
const demo = (el, what) => {
  el.classList.add('pokeable');
  el.title = `${what} · 点击看下一个状态（演示）`;
};

export const FINE = {
  /* ------------------------------------------------------------------ score */
  vp: {
    // Forty steps on one rail, the player's end on the left. The rider slides toward whoever leads.
    rule(el) {
      const max = RULES.vpMax;
      const ticks = times(2 * max + 1, (i) => `<i class="vr-t${i % 10 === 0 ? ' x' : i % 5 === 0 ? ' v' : ''}" style="--i:${i}"></i>`);
      const nums = [max, max / 2, 0, max / 2, max].map((n, i) => `<i class="vr-n" style="--i:${(i * max) / 2}">${n}</i>`).join('');
      const end = (i) => `<span class="vr-end ${SIDES[i].key}" title="${SIDES[i].name}到 ${max} 分即胜"><b>${SIDES[i].short}</b></span>`;
      el.innerHTML = `${end(0)}<div class="vr-rail"><i class="vr-groove"></i>${ticks}<i class="vr-fill"></i><i class="vr-zero"></i><b class="vr-rider"></b>${nums}</div>${end(1)}`;
      el.style.setProperty('--steps', 2 * max);
      demo(el, '胜利点');
      el.addEventListener('click', (e) => {
        const r = el.querySelector('.vr-rail').getBoundingClientRect();
        actions.poke('vp', e.clientX < r.left + r.width / 2 ? 0 : 1);
      });
      return (s) => {
        el.style.setProperty('--at', max - s.vp);
        el.classList.remove('lead-0', 'lead-a', 'lead-b');
        el.classList.add(s.vp === 0 ? 'lead-0' : s.vp > 0 ? 'lead-a' : 'lead-b');
      };
    },
  },

  /* ------------------------------------------------------------------ turn */
  time: {
    dial(el) {
      // a wider gap wherever an era ends, so the rim reads as three groups
      const gaps = Array.from({ length: RULES.turns }, (_, i) => (RULES.eras.some((e) => e.to === i + 1) ? 12 : 3.5));
      const each = (360 - gaps.reduce((a, b) => a + b, 0)) / RULES.turns;
      let at = -90 + gaps[RULES.turns - 1] / 2;
      const segs = gaps
        .map((g) => {
          const d = arc(50, 50, 44, at, at + each);
          at += each + g;
          return `<path class="seg" d="${d}"/>`;
        })
        .join('');
      el.innerHTML = `<svg viewBox="0 0 100 100" class="td-rim"><circle class="td-hair" cx="50" cy="50" r="48.6"/>${segs}</svg><div class="td-face">${lb('回合')}<b class="t-turn"></b><span class="t-era"></span></div>`;
      demo(el, '回合');
      el.addEventListener('click', () => actions.step());
      return (s) => {
        el.querySelectorAll('.seg').forEach((p, i) => p.setAttribute('class', 'seg ' + state3(i + 1, s.turn)));
        el.querySelector('.t-turn').textContent = s.turn;
        el.querySelector('.t-era').textContent = `${eraOf(s.turn).name} · ${s.turn}/${RULES.turns}`;
      };
    },
  },

  /* ------------------------------------------------------------------ nuclear crisis */
  crisis: {
    // A panel meter. The arc lights up from the calm end as things get worse, so there is more light
    // and more red on it the nearer the needle is to the sign at the far end.
    gauge(el) {
      const n = RULES.crisisMax;
      const each = 180 / n;
      const cx = 88;
      const cy = 86;
      const level = (i) => n - i;
      const zones = times(n, (i) => `<path class="cg-zone l${level(i)}" d="${arc(cx, cy, 56, 180 + i * each + 1.1, 180 + (i + 1) * each - 1.1)}"/>`);
      const ticks = times(n * 4 + 1, (i) => {
        const a = 180 + (i * each) / 4;
        return `<path class="cg-tick${i % 4 ? '' : ' x'}" d="M${pt(cx, cy, 64, a)}L${pt(cx, cy, i % 4 ? 66.3 : 68.6, a)}"/>`;
      });
      // the scale is lettered outside the arc, so the needle never covers the number it points at
      const marks = times(n, (i) => {
        const [x, y] = xy(cx, cy, 76.5, 180 + (i + 0.5) * each);
        if (level(i) > 1) return `<text class="cg-n l${level(i)}" x="${x.toFixed(2)}" y="${(y + 3.8).toFixed(2)}">${level(i)}</text>`;
        return `<g class="cg-sign l1" transform="translate(${(x + 1).toFixed(2)},${y.toFixed(2)})"><circle r="1.75"/><path d="${trefoil(0, 0, 3.1, 8.1)}"/></g>`;
      });
      el.innerHTML =
        `<div class="cg-dial"><svg viewBox="3 1 170 93" class="cg"><path class="cg-hair" d="${arc(cx, cy, 64, 180, 360)}"/><path class="cg-hair in" d="${arc(cx, cy, 47.6, 180, 360)}"/>${ticks}${zones}${marks}` +
        `<g class="cg-needle"><g class="cg-shake"><path class="cg-arm" d="M${cx},${cy + 7.5}L${cx - 1.55},${cy}L${cx - 0.3},${cy - 61.5}H${cx + 0.3}L${cx + 1.55},${cy}Z"/></g></g>` +
        `<circle class="cg-hub" cx="${cx}" cy="${cy}" r="5.4"/><circle class="cg-pin" cx="${cx}" cy="${cy}" r="1.8"/></svg></div>` +
        `<div class="cg-read">${lb('核危机')}<b class="num"></b><em class="cr-name"></em></div>`;
      demo(el, '核危机');
      el.addEventListener('click', () => actions.poke('crisis'));
      return (s) => {
        el.dataset.level = s.crisis;
        el.querySelector('.num').textContent = s.crisis;
        el.querySelector('.cr-name').textContent = CRISIS[s.crisis];
        el.querySelectorAll('.cg-zone, .cg-n, .cg-sign').forEach((c) => {
          const l = +(c.getAttribute('class').match(/\bl(\d)/) ?? [])[1];
          c.classList.toggle('on', l === s.crisis);
          c.classList.toggle('lit', l > s.crisis);
        });
        el.querySelector('.cg-needle').style.transform = `rotate(${-90 + (n - s.crisis + 0.5) * each}deg)`;
      };
    },
  },

  /* ------------------------------------------------------------------ military operations */
  milops: {
    // One tank for each point of military operations this turn. The gold line is this turn's
    // requirement, which is the crisis level: a hollow tank left of it is a point still owed.
    armor(el) {
      const row = (x) =>
        `<div class="ar-row ${x.key}"><i class="sd ${x.key}">${x.short}</i><span class="ar-slots">${times(RULES.milopsMax, () => `<i class="ar-slot">${tank(x.key)}</i>`)}<em class="ar-need"></em></span>` +
        `<span class="ar-count"><b class="num"></b><i class="of"></i></span><span class="ar-tag"></span></div>`;
      el.innerHTML = `<div class="ar-head">${lb('军事行动')}<span class="ar-req">本回合需 <b></b></span></div>${SIDES.map(row).join('')}`;
      el.querySelectorAll('.ar-row').forEach((r, i) => {
        demo(r, `${SIDES[i].name}军事行动`);
        r.addEventListener('click', () => actions.poke('milops', i));
      });
      return (s) => {
        const need = s.crisis;
        el.style.setProperty('--need', need);
        el.querySelector('.ar-req b').textContent = need;
        el.querySelectorAll('.ar-row').forEach((r, i) => {
          const have = s.milops[i];
          r.querySelectorAll('.ar-slot').forEach((t, j) => (t.className = 'ar-slot ' + (j < have ? 'on' : j < need ? 'owe' : 'off')));
          r.classList.toggle('met', have >= need);
          r.querySelector('.num').textContent = have;
          r.querySelector('.of').textContent = `/${need}`;
          r.querySelector('.ar-tag').textContent = have >= need ? '达标' : `差 ${need - have}`;
        });
      };
    },
  },

  /* ------------------------------------------------------------------ space race */
  space: {
    // The player's rocket flies along the top of the row of firsts, the opponent's along the bottom.
    orbit(el) {
      const now = SIDES.map((x) => `<i class="${x.key}">${x.short}<b></b></i>`).join('');
      const stops = times(RULES.spaceMax, (i) => `<i class="so-stop" title="${i + 1} · ${SPACE_STEPS[i] ?? ''}"><span>${spaceStep(i)}</span></i>`);
      const lane = (x) => `<i class="sd so-pad ${x.key}">${x.short}</i><i class="so-trail ${x.key}"></i><b class="so-mk ${x.key}">${rocket()}</b>`;
      el.innerHTML = `<div class="so-head">${lb('太空竞赛')}<span class="so-now">${now}</span></div><div class="so-track"><i class="so-path"></i><span class="so-stops">${stops}</span>${SIDES.map(lane).join('')}</div>`;
      el.style.setProperty('--stops', RULES.spaceMax);
      demo(el, '太空竞赛');
      el.addEventListener('click', (e) => {
        const r = el.querySelector('.so-track').getBoundingClientRect();
        actions.poke('space', e.clientY < r.top + r.height / 2 ? 0 : 1);
      });
      return (s) => {
        SIDES.forEach((x, i) => {
          el.style.setProperty('--n-' + x.key, s.space[i]);
          el.querySelector(`.so-now .${x.key} b`).textContent = s.space[i] ? SPACE_STEPS[s.space[i] - 1] : '待发射';
        });
        el.querySelectorAll('.so-stop').forEach((c, i) => {
          c.classList.toggle('a', i < s.space[0]);
          c.classList.toggle('b', i < s.space[1]);
          c.classList.toggle('lit', i < Math.max(...s.space));
        });
      };
    },
  },
};
