// Data contracts for the HUD: the play screen's meters, hand and piles, drawn over the map.
//
// Like the map module, the HUD computes no rules. It draws the HudState it is given and reports
// what the player did; whoever owns the rules decides what that means and hands back a new state.
import type { BattleEntry } from '../game/history';
import type { Lang, Localized, Side, SideIndex } from '../map/types';

export type { Lang, Localized, Side, SideIndex };

/** The pictures a step of the space race can carry. Drawn in glyphs.ts. */
export type SpaceGlyph = 'rocket' | 'satellite' | 'animal' | 'capsule' | 'earth-orbit' | 'spacewalk' | 'docking' | 'lunar-orbit' | 'landing' | 'shuttle' | 'station';
export type SpaceAbilityId = 'two-attempts' | 'headline' | 'discard-held' | 'eight-rounds';
export type SpaceAbility = { id: SpaceAbilityId; name: Localized; summary: Localized; detail: Localized };
export type SpaceStep = {
  name: Localized;
  glyph: SpaceGlyph;
  minOps: number;
  /** Success is a D6 result from 1 through this number. */
  rollMax: number;
  /** Immediate reward: first arrival, second arrival. */
  vp: readonly [number, number];
  ability?: SpaceAbility;
};

/** How a side stands in a region when the region is scored, lowest first. */
export type RegionStanding = 'none' | 'presence' | 'domination' | 'control';
/** What each standing is worth in one region. `'win'`: holding it ends the game. */
export type RegionScoring = { presence: number; domination: number; control: number | 'win' };
/** Each side's standing in every region, by region id. A rule's result, so it arrives with the state. */
export type RegionStandings = Record<string, [RegionStanding, RegionStanding]>;
/** Independent scoring by controlled country, without presence/domination/control tiers. */
export type CountryScoring = { points: Record<string, number>; cardId?: number; once: boolean };
export type CountryScores = Record<string, [number, number]>;

/** The words of the rules the HUD sets apart, as the cards do in their text. */
export type HudTerm = Exclude<RegionStanding, 'none'>;
/**
 * How the HUD gets such a word marked up; it returns HTML. `interactive` asks for a word the player
 * can point at for its explanation, which only makes sense where the pointer can reach it.
 */
export type TermSource = (word: HudTerm, text: string, interactive: boolean) => string;

/** Historical atmosphere only; kept separate from the live game state. */
export type EraQuote = {
  text: Localized;
  author: Localized;
  date: string;
  source: string;
  sourceTitle: string;
};

/** Sizes and names of the tracks. Scenario content: a layout never hard-codes a length. */
export type HudRules = {
  /** What each region is worth when it is scored, by region id. A region left out shows no values. */
  scoring?: Record<string, RegionScoring>;
  countryScoring?: Record<string, CountryScoring>;
  turns: number;
  /** Optional visual chronology. Dates and paintings do not affect game rules. */
  timeline?: {
    years: [number, number]; name: Localized; image: string; position?: string; rounds?: number;
    /** The player's faction, not the side currently taking an action: [US, USSR]. */
    quotes?: readonly [EraQuote, EraQuote];
  }[];
  /** Consecutive runs of turns. The turn wheel leaves a gap where one ends. */
  eras: { id: string; name: Localized; from: number; to: number }[];
  /** Action rounds in a turn. */
  rounds: number;
  /** The score runs from -vpMax to +vpMax; reaching either end wins. */
  vpMax: number;
  /** Names of the crisis levels, worst first: index 0 is level 1, the end of the world. */
  crisis: Localized[];
  /** Visible consequences at each crisis level, also worst first. Optional for other scenarios. */
  crisisEffects?: { label: Localized; detail: Localized; restricted?: boolean }[];
  milopsMax: number;
  /** The steps of the space race, in order. A side that has not launched is at 0. */
  space: SpaceStep[];
};

export type PassiveEffect = {
  id: string;
  card: string;
  /** Actual player of the card, independent of which side benefits. Null only for unattributable old saves. */
  by: SideIndex | null;
  title: Localized;
  summary: Localized;
  duration: Localized;
  scope: Localized;
  location: Localized;
  kind: 'turn' | 'condition' | 'permanent';
};

export type HudState = {
  turn: number;
  round: number;
  /** Optional match metadata; visual prototypes can continue supplying the original state. */
  phase?: 'setup' | 'headline' | 'action' | 'cleanup' | 'end';
  actionLimit?: number;
  /** Whose move it is. */
  active: SideIndex;
  /** Side 0's points minus side 1's. */
  vp: number;
  /** 1 is the worst, rules.crisis.length the calmest. */
  crisis: number;
  /** Military operations so far this turn. */
  milops: [number, number];
  /** What each side owes this turn. A rule, so it arrives with the state. */
  milopsRequired: number;
  /** Steps taken in the space race. */
  space: [number, number];
  /** The player's cards, left to right. */
  hand: string[];
  /** Cards this seat holds but cannot play yet (a China card received this turn): shown at the end of the hand, dimmed. */
  held?: string[];
  opponentHand: number;
  /** Cards left to draw. */
  deck: number;
  /** Introduced cards minus own hand and current public locations; no hidden location labels. */
  opponentCandidates?: string[];
  /** Monotonic public count of discard piles recycled into the deck. */
  deckRecycles?: number;
  /** Oldest first: the last one is on top. */
  discard: string[];
  removed: string[];
  /** The card on the table, face up, until the next one is played. */
  played: { card: string; by: SideIndex } | null;
  passives?: PassiveEffect[];
  /** This seat's history: public actions plus its own reveal snapshots. Omitted in animation frames. */
  battleLog?: BattleEntry[];
};

/** How the HUD gets a card drawn. It never looks inside one. */
export type CardSource = {
  /** A face-up card as wide as the --card-w of where it is put. */
  face(id: string): HTMLElement;
  back(): HTMLElement;
  /** Called once the element is in the page, to size its text. */
  fit(el: HTMLElement): void;
  describe(id: string): string;
};

export type Meter = 'vp' | 'crisis' | 'milops' | 'space';
export type Pile = 'deck' | 'discard' | 'removed';

export type HudEvents = {
  /** The player dragged a card out of the hand and let go. */
  play: (card: string) => void;
  /** The draw pile was clicked. */
  deck: () => void;
  /** The player asked to look through every card there is. What opens is the page's to decide. */
  catalog: () => void;
  /** Only with `demo`: a meter was clicked, on the given side's half. */
  poke: (meter: Meter, side: SideIndex) => void;
  /** Only with `demo`: the turn wheel was clicked. */
  step: () => void;
};

export type HudOptions = {
  lang?: Lang;
  rules: HudRules;
  /** The two sides as the scenario names and colours them. */
  sides: [Side, Side];
  /** Which side sits at this screen. Its hand is the one shown, its end of the score is on the left. */
  player?: SideIndex;
  cards: CardSource;
  /**
   * How many cards the game has in all. Given, the cards corner offers a way to look through them:
   * a bar over the piles that reports the `catalog` event.
   */
  catalog?: number;
  /** Marks the words of the rules the way the cards do. Without it they are only set in gold. */
  term?: TermSource;
  /**
   * Makes the meters clickable so every state of their drawing can be looked at before there is a
   * rules engine to drive them. Off in a real game.
   */
  demo?: boolean;
  /**
   * false: a card dragged out of the hand does not fly to the table by itself. For a page that
   * stages the play of a card in its own way; the `play` event is reported all the same.
   */
  playFlight?: boolean;
};

export const eraOf = (rules: HudRules, turn: number): HudRules['eras'][number] => rules.eras.find((e) => turn >= e.from && turn <= e.to) ?? rules.eras[0];
