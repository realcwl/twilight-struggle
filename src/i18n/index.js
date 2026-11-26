import en from './locales/en.json' with {type:'json'};
import es from './locales/es.json' with {type:'json'};

/** Locale is a presentation preference. Never store it in match state or room credentials. */
export const LANGUAGES = Object.freeze([
  {id:'zh', tag:'zh-CN', label:'中文'},
  {id:'en', tag:'en', label:'English'},
  {id:'es', tag:'es', label:'Español'},
]);
const catalogs = {zh:{},en,es};
const storageKey = 'coldwar.language.v1';
export function normalizeLanguage(value) { return LANGUAGES.find(x=>x.id===String(value??'').trim().toLowerCase().split('-')[0])?.id ?? 'zh'; }
function initialLanguage() {
  if(typeof location==='undefined')return 'zh';
  const fromURL=new URLSearchParams(location.search).get('lang');
  if(fromURL)return normalizeLanguage(fromURL);
  try{return normalizeLanguage(localStorage.getItem(storageKey));}catch{return 'zh';}
}
let language = initialLanguage();
export const getLanguage = () => language;
export function setLanguage(value) {
  language=normalizeLanguage(value);
  if(typeof document!=='undefined')document.documentElement.lang=LANGUAGES.find(x=>x.id===language).tag;
  try{localStorage.setItem(storageKey,language);}catch{}
  return language;
}
const escapeRE=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const aliases=new Map(Object.entries(en).map(([key,value])=>[value,key]));
const templates=Object.keys(en).filter(key=>/\{\d+\}/.test(key)&&/[\p{Script=Han}《：]| VP/u.test(key)).sort((a,b)=>b.replace(/\{\d+\}/g,'').length-a.replace(/\{\d+\}/g,'').length).map(key=>{
  const slots=[];const source=escapeRE(key).replace(/\\\{(\d+)\\\}/g,(_,n)=>{slots.push(Number(n));return '([\\s\\S]*?)'});
  return{key,slots,literals:key.split(/\{\d+\}/).filter(x=>x.trim()),re:new RegExp('^'+source+'$')};
});
/** Source-language message keys keep existing saves readable; parameters are positional and checked in tests. */
export function t(source, values=[], locale=language) {
  if(source===null||source===undefined)return '';
  source=String(source);
  if(/<\/?[a-z][^>]*>/i.test(source))return markup(source,values,locale);
  const key=Object.hasOwn(en,source)?source:aliases.get(source)??source;
  const out=locale==='zh'?key:catalogs[locale]?.[key]??en[key]??source;
  return out.replace(/\{(\d+)\}/g,(all,i)=>values[i]===undefined?all:text(String(values[i]),locale));
}
/** Compatibility boundary for persisted/remote messages. IDs and user-authored chat never pass here. */
export function text(value, locale=language, depth=0) {
  if(typeof value!=='string'||locale==='zh'||depth>8)return value;
  if(Object.hasOwn(en,value)||aliases.has(value))return t(value,[],locale);
  if(/<\/?[a-z][^>]*>/i.test(value))return markup(value,[],locale);
  if(!/\p{Script=Han}/u.test(value))return value;
  const trimmed=value.trim();
  if(trimmed!==value)return value.replace(trimmed,text(trimmed,locale,depth+1));
  for (const rule of templates) {
    if (!rule.literals.every(part=>value.includes(part))) continue;
    const match=rule.re.exec(value); if(!match)continue;
    const args=[];
    rule.slots.forEach((n,i)=>args[n]=text(match[i+1],locale,depth+1));
    // An overly broad suffix match is not a translation of the containing sentence.
    if(args.some(arg=>/\p{Script=Han}/u.test(arg)))continue;
    return (catalogs[locale]?.[rule.key]??en[rule.key]).replace(/\{(\d+)\}/g,(all,i)=>args[i]??all);
  }
  // Legacy journals compose independent clauses. Preserve their boundaries and order.
  if (/\n| · |；/.test(value)) return value.split(/(\n| · |；)/).map(part =>
    /^(\n| · |；)$/.test(part) ? (part === '；' ? '; ' : part) : text(part,locale,depth+1)).join('');
  const sentences=value.match(/[^。！？]+[。！？]?(?:\s*)/g);
  if(sentences?.length>1)return sentences.map(part=>text(part,locale,depth+1)).join('');
  const separators=/(：| → |、)/;
  if(separators.test(value))return value.split(separators).map(part=>
    part==='：'?': ':part==='、'?', ':part===' → '?part:text(part,locale,depth+1)).join('');
  const arithmetic=/^([+−-]?\d+) ([\s\S]+)$/.exec(value);
  if(arithmetic){const translated=text(arithmetic[2],locale,depth+1);if(!/\p{Script=Han}/u.test(translated))return arithmetic[1]+' '+translated;}
  const modifiers=value.split(/(?= [ +−-]\d+ )/);
  if(modifiers.length>1)return modifiers.map(part=>text(part,locale,depth+1)).join('');
  // Authored card titles and numeric track changes in saves predate message keys.
  const quote=/^《([^》]+)》$/.exec(value);
  if(quote)return '“'+text(quote[1],locale,depth+1)+'”';
  const track=/^(.+?) ([+−-]?\d+(?:\.\d+)?(?:\s*(?:→|–|\/|=|×|[+−-])\s*[+−-]?\d+(?:\.\d+)?)*)$/.exec(value);
  if(track)return text(track[1],locale,depth+1)+' '+track[2];
  const quoted=value.replace(/《([^》]+)》/g,(_,title)=>'“'+text(title,locale,depth+1)+'”');
  return quoted;
}
/** Translate only authored text/accessible labels; tags, classes, IDs and escaped values stay intact. */
export function markup(source, values=[], locale=language) {
  const out=source.split(/(<[^>]*>)/g).map(part=>part.startsWith('<')
    ?part.replace(/(\b(?:title|aria-label|placeholder|alt)=)(["'])(.*?)\2/g,(_,a,q,v)=>a+q+t(v,[],locale).replace(/"/g,'&quot;').replace(/'/g,'&#39;')+q)
    :part.replace(/^(\s*)([\s\S]*?)(\s*)$/,(_,a,v,b)=>a+(Object.hasOwn(en,v)||aliases.has(v)?t(v,[],locale):text(v,locale))+b)).join('');
  return out.replace(/\{(\d+)\}/g,(all,i)=>values[i]===undefined?all:text(String(values[i]),locale));
}
export function localized(value, locale=language) { return value?.[locale] ?? (locale==='zh'?value?.zh:t(value?.zh??value?.en??'',[],locale)); }
/** Add new language fields to authored bilingual map/track data without altering IDs or rules. */
export function withLocales(value) {
  if(Array.isArray(value))return value.map(withLocales);
  if(!value||typeof value!=='object')return value;
  const out=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,withLocales(v)]));
  if(typeof out.zh==='string'&&typeof out.en==='string')for(const {id} of LANGUAGES)out[id]??=t(out.zh,[],id);
  return out;
}

/** Localize existing typed dictionaries, including their formatting functions. */
export function translateDictionary(value, locale) {
  if(typeof value==='function')return (...args)=>text(value(...args),locale);
  if(typeof value==='string')return text(value,locale);
  if(Array.isArray(value))return value.map(v=>translateDictionary(v,locale));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,translateDictionary(v,locale)]));
  return value;
}
