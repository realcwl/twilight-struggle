// One made-up moment of a game, shared by every layout, so the ten HUDs are compared on the same
// numbers and the same hand. Nothing here is a rules engine: the "moves" below only shuffle cards
// between piles and nudge the meters, so that every element on screen can be seen changing.
const DECK = window.DECK;

export const byNo = Object.fromEntries(DECK.map((c) => [c.no, c]));

/** Sizes of the tracks. Data, so a layout never hard-codes a length. */
export const RULES = {
  turns: 10,
  eras: [
    { id: 'early', name: '早期', from: 1, to: 3 },
    { id: 'middle', name: '中期', from: 4, to: 7 },
    { id: 'late', name: '后期', from: 8, to: 10 },
  ],
  rounds: 7,
  vpMax: 20,
  crisisMax: 5,
  milopsMax: 5,
  spaceMax: 8,
  handSize: 8,
  handMax: 10,
};

/** Side 0 is the player in every prototype. */
export const SIDES = [
  { key: 'a', name: '美国', short: '美', role: '你' },
  { key: 'b', name: '苏联', short: '苏', role: '对手' },
];

export const CRISIS = ['', '核战', '一触即发', '高度戒备', '局势紧张', '和平'];

export const eraOf = (turn) => RULES.eras.find((e) => turn >= e.from && turn <= e.to) ?? RULES.eras[0];

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rand = seeded(1962);

function initial() {
  const hand = ['012', '041', '049', '042', '030', '028', '037', '011'];
  const discard = ['001', '002', '016', '020', '019', '021', '018', '040', '047', '046', '054'];
  const removed = ['003', '006', '010', '005', '008', '009', '013', '025', '022', '029'];
  const played = { no: '034', by: 1 };
  const used = new Set([...hand, ...discard, ...removed, played.no]);
  const rest = DECK.filter((c) => c.era !== 'late' && !used.has(c.no)).map((c) => c.no);
  // a fixed shuffle, so screenshots repeat
  const r = seeded(7);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return {
    turn: 4,
    round: 3,
    /** Whose move it is: 0 the player, 1 the opponent. */
    active: 0,
    /** Player's points minus the opponent's, -20..20. */
    vp: -3,
    /** 5 is calm, 1 is the end of the world. */
    crisis: 3,
    milops: [1, 3],
    space: [4, 3],
    hand,
    oppHand: 7,
    oppCards: rest.splice(0, 7),
    deck: rest,
    discard,
    removed,
    /** The card on the table this round, face up, until the next one is played. */
    played,
    /** Recent plays, oldest first. */
    log: [
      { no: '054', by: 0 },
      { no: '029', by: 1 },
      { no: '046', by: 0 },
      { no: '034', by: 1 },
    ],
  };
}

export const S = initial();

const listeners = new Set();
/** fn(state, what): what is 'play' | 'draw' | 'step' | 'reset' | 'turn' | 'poke'. */
export function on(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(what, detail) {
  for (const fn of [...listeners]) fn(S, what, detail);
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Where a card goes once it leaves the table. */
export const restingPile = (no) => (byNo[no].once ? 'removed' : 'discard');

function clearTable() {
  if (!S.played) return null;
  const gone = S.played;
  S[restingPile(gone.no)].push(gone.no);
  S.played = null;
  return gone;
}

function nudge(by) {
  const sign = by === 0 ? 1 : -1;
  const roll = rand();
  if (roll < 0.45) S.vp = clamp(S.vp + sign * (1 + Math.floor(rand() * 2)), -RULES.vpMax, RULES.vpMax);
  if (roll > 0.35 && roll < 0.7) S.milops[by] = clamp(S.milops[by] + 1 + Math.floor(rand() * 2), 0, RULES.milopsMax);
  if (roll > 0.82) S.space[by] = clamp(S.space[by] + 1, 0, RULES.spaceMax);
  const c = rand();
  if (c < 0.22) S.crisis = clamp(S.crisis - 1, 2, RULES.crisisMax);
  else if (c > 0.9) S.crisis = clamp(S.crisis + 1, 2, RULES.crisisMax);
}

function reshuffleIfEmpty() {
  if (S.deck.length) return;
  S.deck = S.discard.splice(0);
}

function endTurn() {
  const gone = clearTable();
  S.turn = S.turn >= RULES.turns ? 1 : S.turn + 1;
  S.round = 1;
  S.crisis = clamp(S.crisis + 1, 1, RULES.crisisMax);
  S.milops = [0, 0];
  while (S.hand.length < RULES.handSize) {
    reshuffleIfEmpty();
    if (!S.deck.length) break;
    S.hand.push(S.deck.shift());
  }
  while (S.oppCards.length < RULES.handSize) {
    reshuffleIfEmpty();
    if (!S.deck.length) break;
    S.oppCards.push(S.deck.shift());
  }
  S.oppHand = S.oppCards.length;
  emit('turn', { gone });
  opponentPlays();
}

function opponentPlays() {
  const gone = clearTable();
  const no = S.oppCards.shift();
  if (no) {
    S.played = { no, by: 1 };
    S.log.push(S.played);
    S.oppHand = S.oppCards.length;
    nudge(1);
  }
  S.active = 0;
  emit('step', { gone, by: 1 });
}

let timer = 0;

export const actions = {
  /** The player puts a card on the table. The opponent answers a moment later. */
  play(no) {
    const i = S.hand.indexOf(no);
    if (i < 0) return;
    const gone = clearTable();
    S.hand.splice(i, 1);
    S.played = { no, by: 0 };
    S.log.push(S.played);
    S.active = 1;
    nudge(0);
    emit('play', { gone, no });
    clearTimeout(timer);
    timer = setTimeout(actions.step, 1500);
  },
  /** The next thing that would happen: the opponent's move, or the end of the turn. */
  step() {
    clearTimeout(timer);
    if (S.active === 0) {
      // the player passes: nothing leaves the hand
      S.active = 1;
    }
    if (S.round >= RULES.rounds || !S.oppCards.length) return endTurn();
    S.round += 1;
    opponentPlays();
  },
  draw() {
    if (S.hand.length >= RULES.handMax) return;
    reshuffleIfEmpty();
    if (!S.deck.length) return;
    const no = S.deck.shift();
    S.hand.push(no);
    emit('draw', { no });
  },
  /** Steps one meter to its next value, to look at every state of its drawing. Not a rule. */
  poke(what, side = 0) {
    const wrap = (v, max, min = 0) => (v >= max ? min : v + 1);
    if (what === 'crisis') S.crisis = S.crisis <= 1 ? RULES.crisisMax : S.crisis - 1;
    else if (what === 'milops') S.milops[side] = wrap(S.milops[side], RULES.milopsMax);
    else if (what === 'space') S.space[side] = wrap(S.space[side], RULES.spaceMax);
    else if (what === 'vp') S.vp = clamp(S.vp + (side === 0 ? 1 : -1), -RULES.vpMax, RULES.vpMax);
    else return;
    emit('poke', { what, side });
  },
  /** Writes fields directly, for a prototype's own controls (jump to a turn, a round ...). */
  set(patch) {
    clearTimeout(timer);
    Object.assign(S, patch);
    emit('poke', { what: 'set' });
  },
  reset() {
    clearTimeout(timer);
    rand = seeded(1962);
    Object.assign(S, initial());
    emit('reset');
  },
};
