// The words of the rules the HUD sets apart, marked up exactly as the cards mark them, so that they
// look the same and open the same explanation. The explanation pane itself is installed by the
// first card that is drawn (src/cards/deck.ts), and the play screen always has cards on it.
import { esc, highlight, termsById } from '../cards/terms.js';
import type { HudTerm, TermSource } from '../hud/types';

/** The glossary's entry for each word. A region's "control" is its own entry, apart from a country's. */
const ENTRY: Record<HudTerm, string> = { presence: 'presence', domination: 'domination', control: 'region-control' };

export const termSource: TermSource = (word, text, interactive) => {
  const entry = termsById.get(ENTRY[word]);
  if (!entry) return esc(text);
  // highlight() is the one place that knows a term's markup. It is asked for the entry's own label,
  // which it always recognises, and the word to show is then put in the label's place.
  return highlight(entry.label, { interactive }).replace(/>[^<>]*<\/span>$/, `>${esc(text)}</span>`);
};
