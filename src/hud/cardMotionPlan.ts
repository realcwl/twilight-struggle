import type { HudState } from './types';

export type CardRoute = {
  id?: string;
  from: 'deck' | 'discard' | 'hand' | 'opponent' | 'table';
  to: 'hand' | 'opponent' | 'discard' | 'removed';
};
export type CardMotionPlan = { recycle: boolean; routes: CardRoute[] };

/** Uses only the receiving seat's public HUD. Never needs the opponent's card identities. */
export function cardMotionPlan(before: HudState, after: HudState): CardMotionPlan {
  const recycle = (after.deckRecycles ?? 0) > (before.deckRecycles ?? 0);
  const routes: CardRoute[] = [];
  // a card that was held, dimmed, and can now be played was in the hand all along
  for (const id of after.hand.filter(id => !before.hand.includes(id) && !before.held?.includes(id))) {
    const from = before.played?.card === id ? 'table'
      : !recycle && before.discard.includes(id) ? 'discard'
      : id === '006' ? 'opponent' : 'deck';
    routes.push({ id, from, to: 'hand' });
  }
  for (let i = before.opponentHand; i < after.opponentHand; i++)
    routes.push({ from: before.played && after.deck === before.deck ? 'table' : 'deck', to: 'opponent' });
  for (const to of ['discard', 'removed'] as const)
    for (const id of after[to].filter(id => !before[to].includes(id)))
      routes.push({ id, from: before.hand.includes(id) ? 'hand' : 'table', to });
  return { recycle, routes };
}
