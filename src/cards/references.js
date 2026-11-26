import {cardCopy} from '../i18n/cards.js';
import {t,withLocales} from '../i18n/index.js';
import catalog from './catalog.json' with {type:'json'};
import scenario from '../../data/scenarios/coldwar/scenario.json' with {type:'json'};

export const referencedCards = new Map(catalog.map(c => [String(c.id).padStart(3,'0'), c]));
export const cardTitles = new Map(catalog.flatMap(c => ['zh','en','es'].map(locale=>[cardCopy(c,locale).title, String(c.id).padStart(3,'0')])));
// US/USSR in rules text describe the players, rather than an influence target.
export const countryNames = new Map(scenario.countries.filter(c => c.superpower === undefined).flatMap(c => ['zh','en','es'].map(locale=>[locale==='en'?c.name.en:t(c.name.zh,[],locale), c.id])));
for (const [name,id] of Object.entries({西班牙:'esp',葡萄牙:'esp','西班牙/葡萄牙':'esp',老挝:'lao',柬埔寨:'lao','老挝/柬埔寨':'lao',北朝鲜:'prk',南朝鲜:'kor',多米尼加:'dom',沙特:'sau'})) countryNames.set(name,id);
export const referencedCountries = new Map(scenario.countries.map(c => [c.id,withLocales(c)]));
