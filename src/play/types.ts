// The contract between whoever owns the rules and whoever stages a card being played.
//
// The rules side (src/game/solo/engine.ts, also used by online replay) decides WHAT happens and in what order: it
// walks a turn, the headline and then the action rounds, and for each piece of it asks a Presenter
// to put it on screen. The presenter decides how a choice is asked for and how what follows is
// shown, and never works out a rule: everything it needs to know it is handed, or asks for through
// PlayQueries. Both sides' moves go through the same calls (`by` is who is acting), so whatever is
// done to make a change visible is done for the opponent's changes too.
import type { Hud } from '../hud/Hud';
import type { CardSource } from '../hud/types';
import type { WorldMap } from '../map/WorldMap';
import type { Lang, SideIndex } from '../map/types';

export type { SideIndex };

/** The three things operations points can be spent on. */
export type Mode = 'place' | 'realign' | 'coup';
/** What a card is used for. */
export type Use = 'event' | 'ops' | 'space';
/** Use and mode in one word. */
export type Verb = Mode | 'event' | 'space';

/** Thrown through every pending wait when a presenter is disposed in the middle of something. */
export const ABORTED = { aborted: true } as const;

/**
 * One change to the game, small enough to be shown by itself. `from` and `to` are the values
 * before and after; for influence, who controlled the country before and after.
 */
export type Effect =
  | { t: 'inf'; id: string; side: SideIndex; d: number; from: number; to: number; ctrlFrom: SideIndex | null; ctrlTo: SideIndex | null }
  | { t: 'crisis'; d: number; from: number; to: number; why?: string; id?: string }
  | { t: 'milops'; side: SideIndex; d: number; from: number; to: number; why?: string }
  | { t: 'vp'; side: SideIndex; d: number; from: number; to: number; why?: string }
  | { t: 'space'; side: SideIndex; d: number; from: number; to: number; why?: string }
  /** Nothing changes, but something has to be said (a coup failed, an event is not carried out). */
  | { t: 'note'; text: string; id?: string };

/** A card as the staging needs it. `owner` is whose event it is, seen from the player's seat. */
export type PlayCard = { id: string; title: string; value: number; owner: 'mine' | 'theirs' | 'neutral' | 'tally'; once: boolean };

/** A card being played, by either side. */
export type Play = {
  by: SideIndex;
  card: PlayCard;
  use: Use;
  verb: Verb;
  /** Operations points: the card's value. */
  points: number;
  /** Where the card goes when it leaves the table. */
  pile: 'discard' | 'removed';
  /** Special destinations override the normal pile, after the event has resolved. */
  destination?: 'inPlay' | { hand: SideIndex };
  /** An explicit return/transfer, logged and animated by the card's final journey. */
  transfer?: CardMove;
  /** Known up front for the opponent's coup or realignment, and for the player's once chosen. */
  target?: string;
  /** Part of the headline phase. */
  headline?: boolean;
  /** The opponent's event goes off after the player has used their card for operations. */
  fires?: boolean;
  /** In settle(): the player backed out before anything happened; the card goes back to the hand. */
  cancelled?: boolean;
};

/** What brought an effect about. `id` is the country it started in, when there is one. */
export type Cause = { verb: Verb; by: SideIndex; card: string; id?: string };

/** Public card movement. Never use this to reveal an ordinary hidden draw. */
export type CardLocation = { hand: SideIndex } | { play: SideIndex } | 'deck' | 'discard' | 'removed';
export type CardMove = { card: string; source: string; from: CardLocation; to: CardLocation; reason: string };

export type Modifier = { label: string; n: number };
export type DieRoll = { side: SideIndex; value: number; mods: Modifier[]; total: number };

/** What a coup with a given card would do in a country, worked out before the roll. */
export type CoupPreview = {
  id: string;
  ops: number;
  stability: number;
  /** What die + ops has to beat. */
  bar: number;
  /** The lowest roll that succeeds, or null if none does. */
  need: number | null;
  /** 0..1 */
  chance: number;
  /** A battleground: the coup lowers the crisis level. */
  key: boolean;
  crisisTo: number;
  milopsTo: number;
  /** What each face of the die would do. */
  table: { roll: number; ok: boolean; net: number; remove: number; add: number }[];
};
/** What each side adds to its die in a realignment there: [player, opponent], and the player's edge. */
export type RealignPreview = { id: string; mods: [Modifier[], Modifier[]]; edge: number };

/** Dice to be shown. The numbers are already decided; the presenter acts them out. */
export type RollSpec = {
  by: SideIndex;
  card: string;
  /** The country, for a coup, realignment or targeted event check. */
  id?: string;
  /** One die for a coup, space attempt or event check; two for realignment or an event contest. */
  dice: DieRoll[];
  /** An event check or contest's short rule, supplied by the event that owns it. */
  rule?: string;
  /** Inclusive successful range of the modified total for a single-die event check. */
  range?: readonly [number, number];
  /** Coup: what the total has to beat, with the words for it ("稳定度 2 ×2"). */
  bar?: { label: string; n: number };
  need?: number | null;
  chance?: number;
  /** Space race: the highest roll that succeeds. */
  max?: number;
  /** Did the side that rolled get what it wanted. */
  ok: boolean;
  /** Realignment or event contest: who won, or null for a tie. */
  winner?: SideIndex | null;
  /** Realignment: rolls still to come after this one. */
  left?: number;
  /** The verdict in words. */
  text: string;
  /** Public country outcome supplied by the rules owner, before the influence effects commit. */
  situation?: {
    before: [number, number]; after: [number, number];
    controlBefore: SideIndex | null; controlAfter: SideIndex | null;
    crisisBefore: number; crisisAfter: number;
  };
} & (
  | { kind: 'coup' | 'realign' | 'space' }
  | { kind: 'contest'; rule: string; winner: SideIndex | null }
  | { kind: 'check'; rule: string; range: readonly [number, number] }
);

/** The player is asked for a country. */
export type TargetRequest = {
  mode: 'coup' | 'realign' | 'event';
  by: SideIndex;
  card: string;
  /** What can be chosen, with what is known about each (a CoupPreview, a RealignPreview, or nothing). */
  targets: Map<string, CoupPreview | RealignPreview | Record<string, never>>;
  /** Countries that would qualify but are barred, with the reason. */
  locked: Map<string, string>;
  /** How many choices are still to make, this one included, out of how many. */
  left: number;
  total: number;
  /** The player may stop here (later rolls of a realignment). */
  optional: boolean;
  /** The player may take the card back (nothing has happened yet). */
  cancel: boolean;
  /** For an event: its name and what is being asked. */
  title?: string;
  hint?: string;
};

/** The player spends operations points placing influence, one point at a time. */
export type PlaceSession = {
  side: SideIndex;
  points: number;
  /** False for mandatory setup/tutorial placement. Otherwise Escape discards the entire preview. */
  canCancel?: boolean;
  /** Points not yet spent. */
  readonly left: number;
  /** What has been placed so far, in order. */
  readonly spent: readonly { id: string; cost: number }[];
  /** How many points have gone into a country. */
  count(id: string): number;
  /** Where a point may go now. `ok` is false when what is left cannot pay the cost. */
  targets(): Map<string, { cost: number; ok: boolean }>;
  /** Places one point; the board shows it at once. Null if it is not allowed. */
  add(id: string): Effect | null;
  /** Takes back the last point. False when there is none. */
  undo(): boolean;
  /** Publish the card only after the allocation is accepted, before replaying its committed effects. */
  confirm?(): Promise<void>;
  /** Records only the final allocation, after all preview/undo input is accepted. */
  commit?(): void;
};

export type Line = { text: string; warn?: boolean; lethal?: boolean };

/** Everything the player could do with a card right now, and why not where they cannot. */
export type CardOptions = {
  card: PlayCard;
  /** Why this hand card must wait. Enforced by the rules owner, not just the UI. */
  blocked?: string;
  /** Headline eligibility is separate from action-round uses. */
  headline?: { ok: boolean; why?: string };
  points: number;
  /** The opponent's card: its event happens anyway if the card is used for operations. */
  fires: boolean;
  event: { ok: boolean; lines: Line[]; lethal: boolean };
  place: { ok: boolean; targets: Map<string, { cost: number }> };
  coup: { ok: boolean; targets: Map<string, CoupPreview>; locked: Map<string, string>; why: string; notice?: string };
  realign: { ok: boolean; targets: Map<string, RealignPreview>; locked: Map<string, string>; why: string };
  space: { ok: boolean; why: string; max: number; chance: number; step: number };
};

/** The player's whole decision for an action round. */
export type Decision = { card: string; use: Use; mode?: Mode; target?: string };

/**
 * headline: the headline phase begins. round: a side's move in an action round begins.
 * turn: a new turn has begun (said in passing; the headline follows). end: the game is over.
 */
export type PhaseInfo = { kind: 'headline' } | { kind: 'round'; round: number; who: SideIndex } | { kind: 'turn'; turn: number } | { kind: 'end'; why: 'war' };

/** Seat-relative sealed headlines. The opponent's identity remains private until reveal. */
export type WaitingHeadline = { mine: string | null; theirs: boolean };

/** Public scoring snapshot from the rules owner, before points or one-shot modifiers change. */
export type ScoringReport = {
  region: string;
  name: { zh: string; en: string; es: string };
  final: boolean;
  members: string[];
  rule: { presence: number; domination: number; control: number | 'win' } | null;
  allKeys: number;
  vpBefore: number;
  totals: [number, number];
  winner: SideIndex | null;
  standing: ['none' | 'presence' | 'domination' | 'control', 'none' | 'presence' | 'domination' | 'control'];
  sides: {
    countries: { id: string; key: boolean; adjacent: boolean; points: number }[];
    held: number;
    keys: number;
    adjacent: number;
    base: number | 'win';
    /** Shuttle diplomacy changes the scoring count, never ownership on the map. */
    deducted: number;
  }[];
  formosan: boolean;
  /** The country excluded only from this scoring, never from the map. */
  shuttleCountry?: string;
  /** Until the US chooses, preview the exclusion most beneficial to the US. */
  shuttleChoicePending?: boolean;
  notes: { zh: string; en: string; es: string }[];
};

/** Compact public projection of the same report used to resolve a scoring card. */
export type ScoringSummary = Omit<ScoringReport, 'name' | 'members' | 'vpBefore' | 'sides'> & {
  sides: Omit<ScoringReport['sides'][number], 'countries'>[];
};

/** What the rules side asks of whoever stages the game. Every call is awaited. */
export interface Presenter {
  /** No local decision is pending: release the stage for inspection without enabling card play. */
  idle?(): Promise<void>;
  /** A new phase or a new move begins. */
  phase(info: PhaseInfo): Promise<void>;
  /** The player drags a card out of the hand: that is the headline, with nothing to confirm. */
  pickHeadline(): Promise<string>;
  /** Restore / reconcile already submitted cards without replaying the reveal. */
  waitHeadline?(h: WaitingHeadline | null): void;
  /** Both headline cards are turned over; `order` is the order they resolve in. */
  showHeadline(h: { mine: string; theirs: string; order: { card: string; by: SideIndex }[] }): Promise<void>;
  /** The player's decision for this action round: which card, and what for. */
  decide(): Promise<Decision>;
  /** A card has been played: say by whom and for what. */
  announce(play: Play): Promise<void>;
  /** The player places influence. False: backed out with nothing placed. */
  place(session: PlaceSession, play: Play): Promise<boolean>;
  /** The player chooses a country. Null: stopped, or took the card back. */
  pickTarget(req: TargetRequest): Promise<string | null>;
  roll(spec: RollSpec): Promise<void>;
  /**
   * Show the public calculation before the score is applied, and stay until the player has read it.
   * The score may be shown counted in; the step that applies it then has nothing left to show.
   * Headless presenters may omit it.
   */
  score?(report: ScoringReport): Promise<void>;
  /** Show one public ownership/location change, then commit before continuing the event. */
  cardMove?(move: CardMove, commit: () => void): Promise<void>;
  /** One consequence. Call commit() at the moment the map and the meters should show it. */
  step(effect: Effect, commit: () => void, cause: Cause): Promise<void>;
  /** The opponent's event goes off after the player used their card for operations. */
  trigger(play: Play): Promise<void>;
  /** The card leaves the table. */
  settle(play: Play): Promise<void>;
  /** Space was pressed: cut the current pause short. */
  skip(): void;
  dispose(): void;
}

/** What a presenter may ask about the game as it stands. */
export type PlayQueries = {
  readonly crisis: number;
  country(id: string): { id: string; name: string; stability: number; key: boolean; region: string | null; influence: [number, number]; controller: SideIndex | null };
  card(id: string): PlayCard;
  options(card: string): CardOptions;
  /** A side's name in the page's language. */
  sideName(side: SideIndex): string;
};

/** What a presenter is given to work with. */
export type PlayHost = {
  /** Optional browser sound sink; the rules/AI never depend on sound playback. */
  audio?: import('../audio/cues').AudioPort;
  /** The play screen's root: the map and the HUD are inside it. */
  container: HTMLElement;
  map: WorldMap;
  hud: Hud;
  cards: CardSource;
  lang: Lang;
  game: PlayQueries;
  /** How fast pauses run: 1 is as designed, 0.5 twice as fast. */
  pace?: number;
  player?: SideIndex;
};
