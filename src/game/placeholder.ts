// A stand-in for the rules engine, so the play screen has something to show and something to do.
// Nothing here is a rule: there is one made-up moment of a game, and "moves" that only shift cards
// between piles and nudge the meters, so that every part of the screen can be seen changing.
// Replace this file with the real thing; the screen only ever sees HudState and MapState.
import type { Card } from '../cards/deck';
import type { HudRules, HudState, Meter, SideIndex } from '../hud/types';
import type { MapState, Scenario } from '../map/types';
import { deriveCountry, regionStatus } from '../sandbox/placeholderRule';

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** A filler situation for the map: the sandbox's "demo" preset. Not a game setup. */
export function fillerSituation(scenario: Scenario, labels: { none: string; ahead: string; behind: string; even: string }): MapState {
  const rand = seeded(1947);
  // rough lean of each region towards side 0, just so the picture has structure
  const lean: Record<string, number> = { camerica: 0.95, samerica: 0.7, europe: 0.6, mideast: 0.5, africa: 0.4, asia: 0.42 };
  const state: MapState = { countries: {}, regions: {} };
  for (const c of scenario.countries) {
    const influence: [number, number] = [0, 0];
    if (c.superpower === undefined && c.region !== null && rand() >= 0.3) {
      const first = rand() < (lean[c.region] ?? 0.5) ? 0 : 1;
      const strong = Math.round(rand() * (c.stability + 2));
      const weak = rand() < 0.45 ? Math.round(rand() * 2) : 0;
      influence[first] = strong;
      influence[1 - first] = weak;
    }
    state.countries[c.id] = c.superpower !== undefined ? { influence: [0, 0], controller: c.superpower } : deriveCountry(influence, c.stability, 'auto');
  }
  for (const r of scenario.regions) {
    const held: [number, number] = [0, 0];
    for (const c of scenario.countries) {
      const ctrl = state.countries[c.id].controller;
      if (c.region === r.id && ctrl !== null) held[ctrl]++;
    }
    state.regions[r.id] = { status: regionStatus(held, labels) };
  }
  return state;
}

type Table = { card: string; by: SideIndex };
/** What the stand-in keeps track of: everything in HudState, plus the cards the screen only counts. */
type Inner = Omit<HudState, 'deck' | 'opponentHand' | 'milopsRequired'> & { deck: string[]; opponentCards: string[] };

const HAND_SIZE = 8;
const HAND_MAX = 10;

export class PlaceholderGame {
  private s!: Inner;
  private rand!: () => number;
  private timer = 0;
  private readonly once: Map<string, boolean>;

  constructor(
    private readonly rules: HudRules,
    private readonly cards: readonly Card[],
    /** Called with the new state after every change. */
    private readonly onChange: (state: HudState) => void,
  ) {
    this.once = new Map(cards.map((c) => [c.id, c.once]));
    this.deal();
  }

  /** The state as the screen is given it. */
  get state(): HudState {
    const { deck, opponentCards, ...shown } = this.s;
    // the one rule relation the screen draws: a turn's requirement is the crisis level
    return { ...shown, hand: [...shown.hand], discard: [...shown.discard], removed: [...shown.removed], deck: deck.length, opponentHand: opponentCards.length, milopsRequired: shown.crisis };
  }

  /** The player puts a card on the table. The opponent answers a moment later. */
  play(card: string): void {
    const i = this.s.hand.indexOf(card);
    if (i < 0 || this.s.active !== 0) return;
    this.clearTable();
    this.s.hand.splice(i, 1);
    this.s.played = { card, by: 0 };
    this.s.active = 1;
    this.nudge(0);
    this.changed();
    this.timer = window.setTimeout(() => this.step(), 1500);
  }

  /** The next thing that would happen: the opponent's move, or the end of the turn. */
  step(): void {
    clearTimeout(this.timer);
    // if it was the player's move, the player passes: nothing leaves the hand
    this.s.active = 1;
    if (this.s.round >= this.rules.rounds || !this.s.opponentCards.length) this.endTurn();
    else this.s.round += 1;
    this.opponentPlays();
    this.changed();
  }

  /** One card from the draw pile into the hand. */
  draw(): void {
    if (this.s.hand.length >= HAND_MAX) return;
    this.reshuffleIfEmpty();
    const card = this.s.deck.shift();
    if (!card) return;
    this.s.hand.push(card);
    this.changed();
  }

  /** Steps one meter to its next value, to look at every state of its drawing. */
  poke(meter: Meter, side: SideIndex): void {
    const wrap = (v: number, max: number): number => (v >= max ? 0 : v + 1);
    const s = this.s;
    if (meter === 'crisis') s.crisis = s.crisis <= 1 ? this.rules.crisis.length : s.crisis - 1;
    else if (meter === 'milops') s.milops[side] = wrap(s.milops[side], this.rules.milopsMax);
    else if (meter === 'space') s.space[side] = wrap(s.space[side], this.rules.space.length);
    else s.vp = clamp(s.vp + (side === 0 ? 1 : -1), -this.rules.vpMax, this.rules.vpMax);
    this.changed();
  }

  /** Back to the opening moment. */
  reset(): void {
    clearTimeout(this.timer);
    this.deal();
    this.changed();
  }

  // ------------------------------------------------------------------ the made-up game

  private deal(): void {
    this.rand = seeded(1962);
    const hand = ['012', '041', '049', '042', '030', '028', '037', '011'];
    const discard = ['001', '002', '016', '020', '019', '021', '018', '040', '047', '046', '054'];
    const removed = ['003', '006', '010', '005', '008', '009', '013', '025', '022', '029'];
    const played: Table = { card: '034', by: 1 };
    const known = new Set(this.cards.map((c) => c.id));
    const keep = (ids: string[]): string[] => ids.filter((id) => known.has(id));
    const used = new Set([...hand, ...discard, ...removed, played.card]);
    const rest = this.cards.filter((c) => c.era !== 'late' && !used.has(c.id)).map((c) => c.id);
    // a fixed shuffle, so the opening looks the same every time
    const r = seeded(7);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    this.s = {
      turn: 4,
      round: 3,
      active: 0,
      vp: -3,
      crisis: Math.min(3, this.rules.crisis.length),
      milops: [1, 3],
      space: [4, 3],
      hand: keep(hand),
      opponentCards: rest.splice(0, 7),
      deck: rest,
      discard: keep(discard),
      removed: keep(removed),
      played: known.has(played.card) ? played : null,
    };
  }

  private changed(): void {
    this.onChange(this.state);
  }

  /** The card on the table goes to the pile it belongs on. */
  private clearTable(): void {
    const gone = this.s.played;
    if (!gone) return;
    (this.once.get(gone.card) ? this.s.removed : this.s.discard).push(gone.card);
    this.s.played = null;
  }

  private nudge(by: SideIndex): void {
    const s = this.s;
    const sign = by === 0 ? 1 : -1;
    const roll = this.rand();
    if (roll < 0.45) s.vp = clamp(s.vp + sign * (1 + Math.floor(this.rand() * 2)), -this.rules.vpMax, this.rules.vpMax);
    if (roll > 0.35 && roll < 0.7) s.milops[by] = clamp(s.milops[by] + 1 + Math.floor(this.rand() * 2), 0, this.rules.milopsMax);
    if (roll > 0.82) s.space[by] = clamp(s.space[by] + 1, 0, this.rules.space.length);
    // the crisis drifts, but only a click on the meter takes it all the way to the end
    const c = this.rand();
    const floor = Math.min(2, this.rules.crisis.length);
    if (c < 0.22) s.crisis = clamp(s.crisis - 1, floor, this.rules.crisis.length);
    else if (c > 0.9) s.crisis = clamp(s.crisis + 1, floor, this.rules.crisis.length);
  }

  private reshuffleIfEmpty(): void {
    if (!this.s.deck.length) this.s.deck = this.s.discard.splice(0);
  }

  private endTurn(): void {
    const s = this.s;
    this.clearTable();
    s.turn = s.turn >= this.rules.turns ? 1 : s.turn + 1;
    s.round = 1;
    s.crisis = clamp(s.crisis + 1, 1, this.rules.crisis.length);
    s.milops = [0, 0];
    for (const pile of [s.hand, s.opponentCards])
      while (pile.length < HAND_SIZE) {
        this.reshuffleIfEmpty();
        const card = s.deck.shift();
        if (!card) break;
        pile.push(card);
      }
  }

  private opponentPlays(): void {
    this.clearTable();
    const card = this.s.opponentCards.shift();
    if (card) {
      this.s.played = { card, by: 1 };
      this.nudge(1);
    }
    this.s.active = 0;
  }
}
