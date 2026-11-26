// The moment every variant plays from: turn 4, about to headline. Made up for this prototype, so
// that each kind of move has something worth doing: a battleground to coup, a region that is locked,
// an opponent's card that hurts to play. None of it is a setup from anywhere.

/** Influence on the board, [player, opponent]. Countries left out start empty. */
export const INFLUENCE = {
  // Europe: two blocs facing each other
  can: [2, 0], gbr: [5, 0], dnk: [2, 0], ben: [3, 0], frg: [4, 1], fra: [3, 1], ita: [2, 1],
  grc: [1, 1], tur: [2, 0], aut: [1, 1], fin: [0, 1], gdr: [0, 3], pol: [0, 4], cze: [0, 3], hun: [0, 3], rou: [0, 3],
  bgr: [0, 3], yug: [0, 1],
  // Middle East
  isr: [3, 0], irn: [2, 1], irq: [0, 3], syr: [0, 2], egy: [1, 2], lby: [0, 1], sau: [2, 0],
  // Asia
  jpn: [4, 0], kor: [2, 1], prk: [0, 3], twn: [3, 0], phl: [2, 0], tha: [2, 1], vnm: [0, 3], ind: [1, 2], pak: [2, 0],
  afg: [0, 2], mmr: [0, 1], lao: [0, 1], idn: [0, 1], aus: [4, 0],
  // Africa: open ground
  zaf: [2, 0], cod: [1, 1], ago: [0, 2], nga: [1, 0], dza: [0, 2], eth: [0, 2], som: [1, 0], sdn: [0, 1],
  // the Americas
  mex: [2, 0], pan: [2, 0], cub: [0, 4], nic: [0, 1], cri: [2, 0],
  ven: [2, 0], bra: [2, 1], arg: [1, 1], chl: [1, 2], per: [0, 1],
};

export const START = {
  turn: 4,
  crisis: 4,
  milops: [0, 0],
  vp: -3,
  space: [4, 3],
  /** The player's hand: own events, a neutral one, and two of the opponent's. */
  hand: ['031', '033', '042', '037', '012', '049', '011', '028'],
  oppHand: 8,
  discard: ['001', '002', '016', '020', '019', '021', '018', '040', '047', '054'],
  removed: ['003', '006', '010', '005', '008', '009', '013', '025', '022', '029'],
};

/**
 * What the opponent does, in order. Scripted, so that every kind of move is seen from the other
 * side of the table too. Only the dice are left to chance.
 */
export const OPPONENT = {
  headline: '034',
  rounds: [
    { no: '041', use: 'ops', mode: 'place', targets: ['tha', 'tha', 'ita'] },
    { no: '043', use: 'ops', mode: 'coup', target: 'cod' },
    { no: '045', use: 'ops', mode: 'realign', targets: ['arg', 'arg'] },
    { no: '046', use: 'space' },
    { no: '024', use: 'event' },
    { no: '039', use: 'ops', mode: 'coup', target: 'som' },
    { no: '019', use: 'ops', mode: 'place', targets: ['egy', 'bra'] },
  ],
};
