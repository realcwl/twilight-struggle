import {getLanguage,t} from '../i18n/index.js';
import {cardCopy} from '../i18n/cards.js';
import {highlight} from './terms.js';
export const eraNames={early:'冷战早期',mid:'冷战中期',late:'冷战晚期'};
export const sideNames={us:'美国事件',ussr:'苏联事件',neutral:'中立事件',scoring:'计分牌'};
export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function titleSize(title){return title.length<=7?8.3:title.length<=10?6.8:title.length<=15?5.6:4.7;}
function rulesSize(c){const n=c.effectsZh.join('').length+c.prerequisiteZh.length;return n>180?3.55:n>130?3.85:n>95?4.1:n>60?4.5:4.9;}
export function cardHTML(c,{back=false,lazy=true,artReady=true,assetBase=(import.meta.env?.BASE_URL ?? '/')+'cards/',interactive=true,locale=getLanguage()}={}){
 if(back)return `<div class="game-card back-card" aria-label="${t("统一中立背面",[],locale)}"><img src="${assetBase}back.png" alt="${t("黑色珐琅与金色罗盘背面",[],locale)}" loading="${lazy?'lazy':'eager'}"></div>`;
 const {title,effects,prerequisite,note}=cardCopy(c,locale);
 const history=interactive?`<span class="card-history-trigger" data-card-history="${Number(c.id)}" tabindex="0" role="button" aria-haspopup="dialog" aria-expanded="false" aria-label="${esc(title)} · ${t("历史故事",[],locale)}">${esc(title)}${c.once?'<sup>*</sup>':''}</span>`:`${esc(title)}${c.once?'<sup>*</sup>':''}`;
 const size=locale==='zh'?rulesSize(c):4.1; const titleScale=locale==='zh'?titleSize(title):title.length>30?4.5:5.7;
 return `<article class="game-card side-${c.side}" lang="${locale}" data-card-id="${c.id}" data-rule-size="${size}" data-title-size="${titleScale}" aria-label="${esc(title)}" style="--rule-size:${size}cqw;--title-size:${titleScale}cqw">
 <div class="card-border"></div><div class="card-art">${artReady?`<img src="${assetBase+'art/'+String(c.id).padStart(3,'0')+'.webp'}" alt="${esc(title)} · ${t("主题插图",[],locale)}" loading="${lazy?'lazy':'eager'}" decoding="async">`:`<div class="art-pending"><span>✦</span><small>${t("新插图制作中",[],locale)}</small></div>`}</div>
 <div class="ops-badge ${c.ops===0?'scoring-badge':''}">${c.ops||'✦'}</div><div class="era-label">${t(eraNames[c.era],[],locale)}<span>${t(c.id===6?'特殊牌':sideNames[c.side],[],locale)}</span></div>
 <div class="card-banner"><h3 class="${c.persistent?'persistent':''}">${history}</h3></div>
 <div class="card-paper"><div class="rules-copy" lang="${locale}">${prerequisite?`<p class="prerequisite">${highlight(prerequisite,{interactive,locale})}</p>`:''}<div class="effects">${effects.map(t=>`<p>${highlight(t,{interactive,locale})}</p>`).join('')}</div>${note?`<p class="card-note">${highlight(note,{interactive,locale})}</p>`:''}</div></div></article>`;

}
export function fitCards(container=document){
 for(const card of container.querySelectorAll('.game-card:not(.back-card)')){
   const box=card.querySelector('.rules-copy');if(!box||!box.clientHeight)continue;
   let size=Number(card.dataset.ruleSize);
   card.style.setProperty('--rule-size',`${size}cqw`);
   while(box.scrollHeight>box.clientHeight+1&&size>2.75){size-=.05;card.style.setProperty('--rule-size',`${size.toFixed(2)}cqw`);}
   const title=card.querySelector('.card-banner h3');let ts=Number(card.dataset.titleSize);
   card.style.setProperty('--title-size',`${ts}cqw`);
   const bannerStyle=getComputedStyle(title.parentElement);
   const available=title.parentElement.clientHeight-parseFloat(bannerStyle.paddingTop)-parseFloat(bannerStyle.paddingBottom);
   while((title.scrollHeight>available+1||title.scrollWidth>title.clientWidth+1)&&ts>3.25){ts-=.1;card.style.setProperty('--title-size',`${ts.toFixed(2)}cqw`);}
 }
}
