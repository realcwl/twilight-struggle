import { text as displayText } from '../i18n/index.js';
// The mark of a battleground country: two crossed rifles.
// A battleground wears it on the top-left corner of its node, and cards and lists use the same picture
// wherever they say "battleground", so the map and the text point at each other.
// Drawn on a 32 x 32 field with nothing but flat colours and its own dark outline: no gradients and no
// ids, so the markup can be repeated any number of times, and it reads on land, on sea and on a card.
import { el } from './strings';

const INK = '#150e08';
const STEEL = '#f6ead0';
const WOOD = '#ecb844';
const WOOD_LIT = '#fde08a';
const WOOD_SHADE = '#b5822a';

/** One rifle, muzzle to the right: the whole outline, then the stock in wood with a lit top and a shaded foot. */
const RIFLE =
  `<path d="M2.6 17.8L3.4 13.6L10.2 14.1L11.8 14.8H20.5V13.4H21.9V14.8L29.6 15V16.3L21.4 16.5L20.6 17.3H17.4L16.7 21.2L14.1 20.8L14.8 17.3H12.7L11.7 19.5L9.9 19.2L10.2 17.1L7.4 16.7Z" fill="${STEEL}"/>` +
  `<path d="M2.6 17.8L3.4 13.6L10.2 14.1V17.1L7.4 16.7Z" fill="${WOOD}"/>` +
  `<path d="M3.4 13.6L10.2 14.1V15L3.2 14.6Z" fill="${WOOD_LIT}" stroke="none"/>` +
  `<path d="M2.6 17.8L2.9 16.3L10.2 16.4V17.1L7.4 16.7Z" fill="${WOOD_SHADE}" stroke="none"/>`;

/** Both rifles, crossed. The second is the mirror image of the first and lies over it. */
const CROSSED =
  `<g stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" paint-order="stroke">` +
  `<g transform="rotate(-38 16 16)">${RIFLE}</g><g transform="translate(32 0) scale(-1 1) rotate(-38 16 16)">${RIFLE}</g></g>`;

/** The mark as markup, on its full 32 x 32 field: what a node wears. */
export const BATTLE_MARK = `<svg class="wm-battle-art" viewBox="0 0 32 32" aria-hidden="true">${CROSSED}</svg>`;

/** The same picture cropped to the rifles, to sit in a line of text (see .wm-battle-glyph in map.css). */
export const BATTLE_GLYPH = `<svg class="wm-battle-glyph" viewBox="3 4.5 26 23" aria-hidden="true">${CROSSED}</svg>`;

/** The mark for a line of text, as an element. */
export function battleGlyph(): HTMLSpanElement {
  const span = el('span', 'wm-battle-inline');
  span.innerHTML = displayText(BATTLE_GLYPH);
  return span;
}
