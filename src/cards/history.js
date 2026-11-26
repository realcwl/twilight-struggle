import { t as i18n, getLanguage } from '../i18n/index.js';
import {esc} from './render.js';
let data;
/** Load narrative content only on the first history request; the rules engine never imports it. */
export async function cardHistory(id){
 data??=import('./history.json').then(m=>m.default).catch(e=>{data=undefined;throw e});
 const stories=await data, key=String(Number(id)), story=stories[key], locale=getLanguage();
 if(!story||locale==='zh')return story;
 const summaries=locale==='es'?await import('../i18n/locales/history.es.json'):await import('../i18n/locales/history.en.json');
 const period=story.period.replace(/(\d+)年代末/g,(_,year)=>locale==='es'?'finales de la década de '+year:'late '+year+'s').replace(/(\d+)年代/g,(_,year)=>locale==='es'?'década de '+year:year+'s').replaceAll('年起',locale==='es'?' en adelante':' onward').replaceAll('年后',locale==='es'?' en adelante':' onward').replaceAll('年及其后',locale==='es'?' y después':' and later').replaceAll('年','').replace('10月',locale==='es'?' · octubre':' · October').replace('后期',locale==='es'?' (finales)':' (late)').replace('二战至冷战时期',locale==='es'?'Segunda Guerra Mundial y Guerra Fría':'World War II through the Cold War').replace('冷战时期',locale==='es'?'Guerra Fría':'Cold War');
 return {...story,title:i18n(story.title),period,kind:locale==='es'?'Contexto histórico · resumen':'Historical context · summary',lead:summaries.default[key],paragraphs:[],image:story.image?{...story.image,caption:i18n(story.title),credit:i18n(story.image.credit.replace('维基共享资源','Wikimedia Commons')),license:i18n(story.image.license)}:undefined,sources:story.sources.map(s=>({...s,label:s.label.replace('维基百科 · ',locale==='es'?'Wikipedia · ':'Wikipedia · ')}))};
}
export function historyHTML(story){
 const image=story.image;
 return i18n("{0}\n <article class=\"th-history-prose\"><p class=\"th-history-lead\">{1}</p>{2}\n <details class=\"th-history-sources\"><summary>史料与延伸阅读</summary><ul>{3}</ul></details></article>", [image?`<figure class="th-history-photo"><img src="${esc(image.src)}" width="${image.width}" height="${image.height}" alt="${esc(image.caption)}" decoding="async"><figcaption>${esc(image.caption)}<small><a href="${esc(image.source)}" target="_blank" rel="noopener noreferrer">${esc(image.credit)} ↗</a> · ${image.licenseUrl?`<a href="${esc(image.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(image.license)}</a>`:esc(image.license)}</small></figcaption></figure>`:'', esc(story.lead), story.paragraphs.map(p=>`<p>${esc(p)}</p>`).join(''), story.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗</a></li>`).join('')]);
}
