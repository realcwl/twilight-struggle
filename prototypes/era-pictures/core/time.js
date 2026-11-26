// What a turn stands for, and the small pieces every display shares.
//
// A turn is a few years (the same first guess as prototypes/year-styles: three, four and three turns
// over 1945 to 1991), and each turn has ONE picture: something that happened in those years, painted
// realistically. The ten pictures are the same for all ten displays; what differs is the object that
// carries them. A display also "grades" a picture by its era when it wants to: black and white for
// the early turns, faded colour for the middle ones, full colour for the late ones.

export const SPANS = [
  [1945, 1950], [1951, 1956], [1957, 1961],
  [1962, 1965], [1966, 1969], [1970, 1973], [1974, 1978],
  [1979, 1982], [1983, 1986], [1987, 1991],
];

const img = (n) => new URL(`../img/t${String(n).padStart(2, '0')}.jpg`, import.meta.url).href;
/** One per turn. `at` is where the subject sits, for a crop that is not 3:2. */
export const PICS = [
  { title: '柏林空运', year: 1948, at: '44% 38%' },
  { title: '氢弹试验', year: 1952, at: '50% 38%' },
  { title: '第一颗卫星', year: 1957, at: '68% 42%' },
  { title: '导弹危机', year: 1962, at: '52% 46%' },
  { title: '登月', year: 1969, at: '42% 52%' },
  { title: '石油危机', year: 1973, at: '50% 46%' },
  { title: '西贡撤离', year: 1975, at: '50% 50%' },
  { title: '航天飞机', year: 1981, at: '54% 44%' },
  { title: '欧洲导弹', year: 1983, at: '34% 52%' },
  { title: '柏林墙倒', year: 1989, at: '50% 46%' },
].map((p, i) => ({ ...p, turn: i + 1, src: img(i + 1) }));

export const GRADE = { early: 'bw', middle: 'fade', late: 'full' };

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const times = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join('');
export const state3 = (i, now) => (i < now ? 'done' : i === now ? 'now' : 'todo');
export const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;

/** Everything a display draws from. */
export function makeView(s, rules, t, sides, player = 0) {
  const era = rules.eras.find((e) => s.turn >= e.from && s.turn <= e.to) ?? rules.eras[0];
  const rounds = s.actionLimit ?? rules.rounds;
  const [from, to] = SPANS[s.turn - 1];
  const mine = s.active === player;
  let head = mine ? t.yourMove : t.theirMove(sides[s.active].name.zh);
  let hint = mine ? t.yourHint : t.theirHint;
  // the same words the game's own corner uses outside the action rounds (src/hud/parts/time.ts)
  const other = { headline: ['头条阶段', '拖出一张牌作为头条'], cleanup: ['回合结算', '军事行动 · 保留手牌 · 发牌'] }[s.phase];
  if (other) [head, hint] = other;
  return {
    turn: s.turn,
    turns: rules.turns,
    round: s.round,
    rounds,
    /** 0 at the start of the turn's first round, 1 once the last is under way. */
    progress: rounds > 1 ? (s.round - 1) / (rounds - 1) : 1,
    phase: s.phase ?? 'action',
    active: s.active,
    mine,
    side: s.active === 0 ? 'is-a' : 'is-b',
    era,
    eraName: era.name.zh,
    eras: rules.eras,
    grade: GRADE[era.id] ?? 'full',
    from,
    to,
    year: Math.min(to, from + Math.floor(((s.round - 1) * (to - from + 1)) / rounds)),
    pic: PICS[s.turn - 1],
    head,
    hint,
  };
}

const eraOfTurn = (rules, n) => rules.eras.find((e) => n >= e.from && n <= e.to) ?? rules.eras[0];

/** What a display is handed when it is put up. */
export function makeCtx(rules) {
  const gradeOf = (n) => GRADE[eraOfTurn(rules, n).id] ?? 'full';
  return {
    rules,
    pics: PICS,
    spans: SPANS,
    esc,
    times,
    state3,
    rem,
    gradeOf,
    /** A turn's years, short: 1966–69. */
    spanOf: (n) => `${SPANS[n - 1][0]}–${String(SPANS[n - 1][1]).slice(2)}`,
    eraOf: (n) => eraOfTurn(rules, n),
    /** A turn's picture as an element. `graded` false keeps its own colours whatever the era. */
    pic: (n, cls = '', graded = true) => {
      const p = PICS[n - 1];
      return `<span class="ep-pic ${graded ? 'g-' + gradeOf(n) : ''} ${cls}" style="background-image:url('${p.src}');--at:${p.at}"></span>`;
    },
    /** The usual line of words under a display: the year, the era and turn over the rounds, whose move. */
    cap: (rounds = '<span class="ep-pips" data-t="pips"></span>') =>
      '<div class="ep-cap"><b class="ep-year" data-t="year"></b>' +
      `<div class="ep-cap-mid"><div><b class="ep-era" data-t="era"></b><span class="ep-meta" data-t="turn"></span></div><div><span class="ep-lb">行动轮</span>${rounds}</div></div>` +
      '<div class="ep-cap-ph"><b class="ep-head" data-t="head"></b><span class="ep-hint" data-t="hint"></span></div></div>',
    /** Puts another turn's picture into an element made by pic(). */
    setPic: (el, n, graded = true) => {
      const p = PICS[n - 1];
      el.style.backgroundImage = `url('${p.src}')`;
      el.style.setProperty('--at', p.at);
      el.classList.remove('g-bw', 'g-fade', 'g-full');
      if (graded) el.classList.add('g-' + gradeOf(n));
    },
  };
}

/**
 * Fills the words every display has, wherever the display put them:
 *   data-t="year | span | era | turn | round | head | hint | pips | title | n"
 * and gives the display's element the side's colours and the era's name to style by.
 */
export function fill(el, v) {
  el.dataset.era = v.era.id;
  el.dataset.phase = v.phase;
  el.classList.toggle('is-a', v.active === 0);
  el.classList.toggle('is-b', v.active !== 0);
  const put = (key, html) => {
    for (const n of el.querySelectorAll(`[data-t="${key}"]`)) if (n.innerHTML !== html) n.innerHTML = html;
  };
  put('year', String(v.year));
  put('span', `${v.from}–${v.to}`);
  put('era', esc(v.eraName));
  put('turn', `回合 <b>${v.turn}</b><i>/${v.turns}</i>`);
  put('round', `行动轮 <b>${v.round}</b><i>/${v.rounds}</i>`);
  put('n', String(v.turn));
  put('head', esc(v.head));
  put('hint', esc(v.hint));
  put('title', esc(v.pic.title));
  put('pips', times(v.rounds, (i) => `<i class="ep-pip ${state3(i + 1, v.round)}"></i>`));
}
