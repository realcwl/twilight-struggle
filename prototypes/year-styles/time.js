// What a turn stands for in years, and the small pieces every variant shares.
//
// The three eras are the deck's own (prototypes/card-designs/deck/cards.js): 1945 to 1961, 1962 to
// 1978, 1979 to 1991. Ten turns are laid over them, three, four and three, so a turn is four to six
// years. The year shown moves on inside a turn as the action rounds go by. All of this is a first
// guess to look at, not a rule.
import { RULES, SIDES, byNo, eraOf } from '../hud-layouts/state.js';

export const SPANS = [
  [1945, 1950], [1951, 1956], [1957, 1961],
  [1962, 1965], [1966, 1969], [1970, 1973], [1974, 1978],
  [1979, 1982], [1983, 1986], [1987, 1991],
];
export const ERA_YEARS = { early: [1945, 1961], middle: [1962, 1978], late: [1979, 1991] };
/** One card of the deck per turn, for its picture: something that happened in those years. */
export const EMBLEMS = ['008', '014', '024', '028', '042', '049', '052', '064', '070', '079'];
export const emblemOf = (turn) => byNo[EMBLEMS[turn - 1]];
export const yearOf = (turn, round) => {
  const [from, to] = SPANS[turn - 1];
  return Math.min(to, from + Math.floor(((round - 1) * (to - from + 1)) / RULES.rounds));
};

/** Everything a variant draws from. Built from the HUD's state, or from a made-up moment. */
export function view(s) {
  const [from, to] = SPANS[s.turn - 1];
  const era = eraOf(s.turn);
  return {
    turn: s.turn,
    turns: RULES.turns,
    round: s.round,
    rounds: RULES.rounds,
    active: s.active ?? 0,
    year: yearOf(s.turn, s.round),
    from,
    to,
    era,
    eras: RULES.eras,
    eraYears: ERA_YEARS[era.id],
    emblem: emblemOf(s.turn),
    played: s.played ? { card: byNo[s.played.no], by: s.played.by } : null,
  };
}

const HAN = '〇一二三四五六七八九十';
export const han = (n) => (n <= 10 ? HAN[n] : String(n));
export const hanYear = (y) => [...String(y)].map((d) => HAN[+d]).join('');
export const pad2 = (n) => String(n).padStart(2, '0');
export const phase = (t) => (t.active === 0 ? '你的行动轮' : `${SIDES[1].name}行动中`);
export const sideName = (i) => SIDES[i].name;
export const times = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join('');
/** A card's illustration on its own. The wrapper carries the side's inks. */
export const scene = (card, cls = '') => `<span class="yr-scene side-${card.side} ${cls}">${window.DeckArt.scene(card.art)}</span>`;
let uid = 0;
export const nextId = () => 'yr' + uid++;
