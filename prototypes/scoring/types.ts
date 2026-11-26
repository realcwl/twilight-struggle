import type { Sfx } from '../impact/sfx';
import type { Box, Pt } from './kit';
import type { CountryView, ScoreView, SideView } from './view';

export type Side = 0 | 1;
export type Pal = { main: string; light: string; deep: string };

/** A country's token on the map, as the stage sees it. */
export type Tok = {
  id: string;
  name: string;
  root: HTMLElement;
  body: HTMLElement;
  box(): Box;
  at(): Pt;
};

/** Where on the screen the area is framed, in fractions of the window. */
export type Frame = { left: number; top: number; width: number; height: number };

export type Ctx = {
  view: ScoreView;
  pal: [Pal, Pal];
  /** The middle of the screen, left to right. */
  cx: number;
  /** The column between the HUD's two top corners, from under the opponent's cards down to over the hand. */
  free: Box;
  /** From this height down the whole width is free of the HUD's top corners. */
  under: number;
  /** The box around the area's tokens as they stand on screen. */
  area(): Box;
  tok(id: string): Tok | null;
  /** A country's flag, as the map draws it. */
  flag(id: string): string;
  /** The crossed rifles a battleground wears. */
  rifles: string;
  /** A token answers: it swells for an instant and a ring of the side's colour leaves it. */
  pulse(id: string, side: Side, power?: number): void;
  /** The same for several, one after another, west to east. Resolves when the last one has started. */
  wave(list: readonly CountryView[], side: Side, gap?: number, power?: number): Promise<void>;
  /** Both sides' countries answer at once. */
  waves(gap?: number): Promise<void>;
  /** Points leave a country: a chip rises off its token and flies to a point. Resolves on arrival. */
  pip(c: CountryView, side: Side, to: Pt | (() => Pt), o?: { ms?: number; delay?: number; text?: string }): Promise<void>;
  /** Both sides' scoring countries send their points; `land` is called as each arrives. */
  pips(to: (s: Side) => Pt, land: (s: Side, c: CountryView, i: number) => void, o?: { gap?: number; ms?: number }): Promise<void>;
  /**
   * The two totals are set against each other: the smaller leaves its numeral and is taken out of the
   * larger, which counts down to what is left. Resolves with where the result now stands.
   */
  net(nums: [Element, Element]): Promise<Pt>;
  /** Where the score is shown in the HUD. */
  score(): Pt;
  /**
   * The ending every way shares, and the moment the whole thing is for: the net result is slammed down
   * at `from` (flash, shake, the winner's colour at the edges, the countries that earned it answering),
   * held for a breath, thrown to the score in the HUD, and counted in point by point. How hard it lands
   * follows how much was gained. With nothing to gain the two cancel with a dull knock and nothing flies.
   */
  land(from: Pt, o?: { delay?: number }): Promise<void>;
  /** The HUD's score takes the result now (for a way that brings it there itself). Resolves when counted. */
  arrive(): Promise<void>;
  /** How much this result is worth feeling: 1 at six points. */
  weight(): number;
  /**
   * Waits for the player to say "go on": a click on the button, or the space bar or Enter. From here on
   * nothing is hurried, whatever was skipped before. (On a page driven by a script it goes on by itself.)
   */
  proceed(button: HTMLElement): Promise<void>;
  /** The two sides' names. */
  names: [string, string];
  /** Every sound of the impact prototype; silent while the rest is being run through. */
  sound: Sfx;
};

export type Variant = {
  id: string;
  name: string;
  /** Where the information lives, in a few words. */
  sign: string;
  /** What it is like to watch. */
  feel: string;
  blurb: string;
  risk: string;
  /** Where the area should stand while this way plays. */
  frame: Frame;
  run(ctx: Ctx): Promise<void>;
};

export type { CountryView, ScoreView, SideView };
