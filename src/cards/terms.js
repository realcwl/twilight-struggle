import glossary from './glossary.json' with {type:'json'};
import en from '../i18n/locales/glossary.en.json' with {type:'json'};
import es from '../i18n/locales/glossary.es.json' with {type:'json'};
import {getLanguage,t,text as localize} from '../i18n/index.js';
import {countryNames,cardTitles} from './references.js';
const copies={en,es};
export const GLOSSARY=Object.freeze(glossary.map(entry=>Object.freeze({...entry,
 get label(){return copies[getLanguage()]?.[entry.id]?.label??entry.label},
 get summary(){return copies[getLanguage()]?.[entry.id]?.summary??entry.summary},
 get example(){return copies[getLanguage()]?.[entry.id]?.example??entry.example},
})));
export const TERM_GROUPS=Object.freeze(Object.fromEntries(Object.entries({influence:'影响与控制',conflict:'冲突与危机',scoring:'计分与胜负',timing:'阶段与时机',cards:'行动与卡牌'}).map(([id,label])=>[id,label])));
export const termsById=new Map(GLOSSARY.map(entry=>[entry.id,entry]));
export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const RULEBOOK='https://s3-us-west-2.amazonaws.com/gmtwebsiteassets/nnts/TS_Rules-2015.pdf';
const escapeRE=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const aliases={
 zh:{'战场国':'battleground','非战场国':'ordinary','军事行动':'milops','核危机等级':'defcon','核危机':'defcon','头条':'headline','抽牌堆':'deck'},
 en:{'VP':'vp','Operation':'ops','Operations points':'ops','Military Ops':'milops','battlegrounds':'battleground','battleground countries':'battleground','non-battleground countries':'ordinary','Coups':'coup','Coup rolls':'coup','Realignments':'realignment','scoring cards':'scoring-card','headline':'headline','discarded':'discard','remove from play':'removed','removed from play':'removed','Control':'control'},
 es:{'PV':'vp','Operación':'ops','puntos de Operaciones':'ops','países conflictivos':'battleground','países no conflictivos':'ordinary','golpes':'coup','Realineamientos':'realignment','cartas de puntuación':'scoring-card','Titulares':'headline','descarta':'discard','retira del juego':'removed','retirada del juego':'removed'},
};
const cache=new Map();
function lexicon(locale,prose){
 const cacheKey=locale+String(prose);
 if(cache.has(cacheKey))return cache.get(cacheKey);
 const words=new Map();
 const add=(label,kind,id)=>words.set(esc(label).toLocaleLowerCase(),{kind,id});
 for(const entry of glossary)add(copies[locale]?.[entry.id]?.label??entry.label,'term',entry.id);
 for(const [label,id] of Object.entries(aliases[locale]??{}))add(label,'term',id);
 for(const [label,id] of countryNames)add(label,'country',id);
 for(const [label,id] of cardTitles)add(locale==='zh'&&/\p{Script=Han}/u.test(label)?`《${label}》`:label,'card',id);
 if(locale==='zh'&&prose)for(const label of ['非战场','普通国家','战场','国家总数','军事行动','头条','抽牌堆'])if(!words.has(label))words.set(label,{kind:'prose',id:['军事行动'].includes(label)?'conflict':['头条'].includes(label)?'timing':['抽牌堆'].includes(label)?'cards':'influence'});
 const source=[...words.keys()].sort((a,b)=>b.length-a.length).map(label=>{
 const boundary=/^[\p{L}\p{N}]/u.test(label)&&!/^\p{Script=Han}/u.test(label);
 return (boundary?'(?<![\\p{L}\\p{N}])':'')+escapeRE(label)+(boundary?'(?![\\p{L}\\p{N}])':'');
 }).join('|');
 const value={words,re:new RegExp('《[^》]*》|'+source,'giu')};cache.set(cacheKey,value);return value;
}
/** A shared, language-aware glossary. Longest matches win; Latin terms never match inside words. */
export function highlight(value,{interactive=true,prose=false,locale=getLanguage()}={}){
 const source=esc(localize(String(value),locale)),{words,re}=lexicon(locale,prose);
 return source.replace(re,label=>{
  const quoted=label.startsWith('《');const hit=words.get(label.toLocaleLowerCase())??(quoted?words.get(label.slice(1,-1).toLocaleLowerCase()):undefined);if(!hit)return label;
  if(hit.kind==='prose')return `<span class="game-term term-${hit.id}">${label}</span>`;
  if(hit.kind!=='term'){
   const attrs=interactive?` data-${hit.kind}-ref="${hit.id}" tabindex="0" role="button" aria-label="${label} · ${esc(t(hit.kind==='card'?'查看卡牌':'查看地图局势',[],locale))}"`:'';
   return `<span class="game-term game-ref term-${hit.kind==='card'?'cards':'influence'}"${attrs}>${label}</span>`;
  }
  let term=termsById.get(hit.id);
  const regional=source.includes(esc(t('存在',[],locale)))&&source.includes(esc(t('支配',[],locale)));
  if(hit.id==='control'&&regional)term=termsById.get('region-control');
  const attrs=interactive?` data-term="${term.id}" tabindex="0" role="button" aria-label="${label} · ${esc(t('查看解释',[],locale))}"`:'';
  return `<span class="game-term term-${term.group}"${attrs}>${label}</span>`;
 });
}
export function termLegend(){return Object.entries(TERM_GROUPS).map(([key,label])=>`<span class="term-key term-${key}">${esc(t(label))}</span>`).join('');}
