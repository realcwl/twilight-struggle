import spanish from './locales/cards.es.json' with {type:'json'};
import {getLanguage} from './index.js';
/** Text-only projections: identifiers, Operations, ownership and event mechanics remain canonical. */
export function cardCopy(card,locale=getLanguage()) {
  if(locale==='zh')return {title:card.titleZh,effects:card.effectsZh,prerequisite:card.prerequisiteZh,note:card.noteZh};
  if(locale==='es')return spanish[card.id];
  return {title:card.title,effects:card.effects,prerequisite:card.prerequisite??'',note:card.note??''};
}
