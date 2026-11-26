// What a set is handed when one of its four moments comes. main.ts stages everything around the hit
// (the numbers, the dice, the rhythm); the set only has to make the hit itself.
import type { Box, Pt } from './kit';

export type Side = 0 | 1;
/** A side's colour, with a lighter and a deeper shade of it. */
export type Pal = { main: string; light: string; deep: string };

/** One country's token on the map, as it stands on screen right now. */
export type Tok = {
  id: string;
  name: string;
  root: HTMLElement;
  body: HTMLElement;
  plinth: HTMLElement | null;
  box(): Box;
  cell(side: Side): Box;
  /** Where the plinth is, or will be. */
  base(): Box;
  at(): Pt;
};

/** 1 · A side has just reached control: its plinth goes under the token. */
export type ControlCtx = {
  tok: Tok;
  side: Side;
  pal: Pal;
  /** Makes it so: the plinth and the control ring are there from this instant. Call it on the frame of the hit. */
  commit(): void;
  /** Other tokens on screen, nearest first, with their distance in px. */
  near: { tok: Tok; dist: number }[];
};

/** 2 · A coup has cleared the other side out of a country. */
export type WipeCtx = {
  tok: Tok;
  loser: Side;
  /** the loser's colours, and the attacker's */
  pal: Pal;
  by: Pal;
  /** the loser's number, as it was, and where */
  cell: Box;
  digit: string;
  hadControl: boolean;
  base: Box;
  /** The number is 0 and the control gone from this instant. Call it on the frame of the hit. */
  commit(): void;
};

/** 3a · One bonus point arrives at a die's total (a controlled neighbour, more influence...). */
export type BonusCtx = {
  /** which one this is of all of them, from 0, and how many there are */
  i: number;
  n: number;
  /** which of this side's it is, from 0 */
  k: number;
  side: Side;
  pal: Pal;
  from: Pt;
  to: Pt;
  die: HTMLElement;
  other: HTMLElement;
  label: string;
  src: Tok | null;
  /** The total goes up by one. Call it when the point lands. */
  land(): void;
};

/** 3b · The roll is won. */
export type WinCtx = {
  winner: Side;
  pal: Pal;
  losePal: Pal;
  /** the two dice (.sp-die elements of the game, in a row of ours) */
  win: HTMLElement;
  lose: HTMLElement;
  margin: number;
  winAt(): Pt;
  loseAt(): Pt;
  /** The losing die is gone from this instant. */
  hideLoser(): void;
};

export type Variant = {
  id: string;
  name: string;
  /** The one thing that makes this set what it is. */
  sign: string;
  /** How it feels, in three words. */
  feel: string;
  blurb: string;
  risk: string;
  control(c: ControlCtx): Promise<void>;
  wipe(c: WipeCtx): Promise<void>;
  bonus(c: BonusCtx): Promise<void>;
  win(c: WinCtx): Promise<void>;
  /** A small hit of the same family, for a number that just changed. power 1 ordinary, 2 emphatic. */
  tap(p: Pt, pal: Pal, i: number, power: number): void;
};
