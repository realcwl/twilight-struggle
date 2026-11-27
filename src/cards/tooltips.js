import { attachHelpCaptions } from '../i18n/help-captions.js';
import { t as i18n, text as displayText } from '../i18n/index.js';
import {termsById,TERM_GROUPS,RULEBOOK,highlight} from './terms.js';
import {referencedCards,referencedCountries} from './references.js';
import {cardHTML,fitCards,sideNames} from './render.js';
import {cardHistory,historyHTML} from './history.js';
let countrySource;
export function setCountryHelp(source){countrySource=source;return()=>{if(countrySource===source){source.highlight(null);countrySource=undefined;}};}
let installed;
/** One delegated, top-layer popover for every card, including cards mounted inside dialogs. */
export function installTermHelp({mediaBase=(import.meta.env?.BASE_URL ?? '/')+'cards/help/'}={}) {
 if(installed)return installed;
 const pane=document.createElement('aside');pane.id='card-term-help';pane.className='term-help sheet is-small';pane.hidden=true;pane.setAttribute('popover','manual');pane.setAttribute('role','dialog');pane.setAttribute('aria-labelledby','th-title');
 pane.innerHTML=i18n("<header><div class=\"sheet-head\"><small id=\"th-group\" class=\"sheet-kicker\"></small><h2 id=\"th-title\" class=\"sheet-title\"></h2></div><button class=\"th-close\" aria-label=\"关闭说明\">×</button></header><div class=\"th-media\"><video muted playsinline loop preload=\"none\"></video><button class=\"th-play\" type=\"button\">暂停</button></div><div class=\"th-body\"><p class=\"th-summary\"></p><p class=\"th-example\"></p><footer><a target=\"_blank\" rel=\"noreferrer\">规则依据 ↗</a><span>游戏画面演示 · Esc 关闭</span></footer></div>");
 const reference=document.createElement('div');reference.className='th-reference';reference.hidden=true;pane.append(reference);
 document.body.append(pane);
 const video=pane.querySelector('video'), play=pane.querySelector('.th-play'), close=pane.querySelector('.th-close');
 const media=pane.querySelector('.th-media');
 const captions=attachHelpCaptions(media,video);
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');let active=null,blocked=null,opening,closing,epoch=0,videoUrl='';
 const abort=new AbortController(),opts={signal:abort.signal};
 function stop(){video.pause();video.removeAttribute('src');video.load();}
 function hide({restore=false,suppress=false}={}){clearTimeout(opening);clearTimeout(closing);epoch++;const old=active;active=null;if(old){old.removeAttribute('aria-describedby');old.setAttribute('aria-expanded','false');if(old.dataset.countryRef)countrySource?.highlight(null);if(suppress)blocked=old;}if(pane.matches(':popover-open'))pane.hidePopover();pane.hidden=true;stop();if(old)document.dispatchEvent(new CustomEvent('card-term-close',{detail:{trigger:old}}));if(restore&&old?.isConnected)old.focus({preventScroll:true});if(suppress&&old&&!old.matches(':hover'))blocked=null;}
 function position(){if(!active?.isConnected)return hide();const word=active.getBoundingClientRect(),card=active.closest('.game-card,[data-help-beside]')?.getBoundingClientRect(),a=card?{left:card.left,right:card.right,width:card.width,top:word.top,bottom:word.bottom}:word,p=pane.getBoundingClientRect(),gap=12;let x,y;
  if(innerWidth-a.right>p.width+gap*2){x=a.right+gap;y=a.top-18;}
  else if(a.left>p.width+gap*2){x=a.left-p.width-gap;y=a.top-18;}
  else {x=a.left+(a.width-p.width)/2;y=innerHeight-a.bottom>p.height+gap?a.bottom+gap:a.top-p.height-gap;}
  pane.style.left=Math.max(gap,Math.min(innerWidth-p.width-gap,x))+'px';pane.style.top=Math.max(gap,Math.min(innerHeight-p.height-gap,y))+'px';
 }
 async function start(){const run=epoch;if(!video.hasAttribute('src')){video.src=videoUrl;video.load();}try{await video.play();if(run===epoch)play.textContent=i18n("暂停");}catch{if(run===epoch)play.textContent=i18n("播放演示");}}
 function show(el,keyboard=false){clearTimeout(opening);clearTimeout(closing);
  const t=termsById.get(el.dataset.term),c=referencedCards.get(el.dataset.cardRef),country=referencedCountries.get(el.dataset.countryRef);
  const historyId=el.dataset.cardHistory;
  if((!t&&!c&&!country&&!historyId)||blocked===el)return;if(active===el){if(keyboard)close.focus();return;}hide();active=el;
  el.setAttribute('aria-describedby',pane.id);el.setAttribute('aria-expanded','true');
  pane.className=`term-help sheet is-small term-${t?.group??(c?'cards':historyId?'scoring':'influence')}${c?' th-card-help':''}${historyId?' th-history-help':''}`;
  pane.querySelector('.th-media').hidden=!t;pane.querySelector('.th-body').hidden=!t;reference.hidden=!!t;
  pane.scrollTop=0;reference.replaceChildren();
  if(historyId){
   pane.querySelector('#th-group').textContent=i18n("历史故事");pane.querySelector('#th-title').textContent=displayText(el.textContent.replace(/\*$/,''));
   reference.innerHTML=i18n("<p class=\"th-history-loading\" role=\"status\">正在翻开历史……</p>");
   const run=epoch;
   cardHistory(historyId).then(story=>{
    if(run!==epoch||active!==el)return;
    if(!story)throw new Error('Missing history '+historyId);
    pane.querySelector('#th-group').textContent=displayText(`${story.kind} · ${story.period}`);
    reference.innerHTML=displayText(historyHTML(story));
    const img=reference.querySelector('img');
    img?.addEventListener('load',position,{once:true});
    img?.addEventListener('error',()=>{img.closest('figure').remove();position()},{once:true});
    position();
   }).catch(()=>{if(run===epoch&&active===el){reference.innerHTML=i18n("<p role=\"status\">历史故事暂时无法载入，请关闭后重试。</p>");position();}});
  }else if(t){
   pane.querySelector('#th-group').textContent=displayText(TERM_GROUPS[t.group]);pane.querySelector('#th-title').textContent=displayText(t.label);
   const mark=s=>highlight(s,{interactive:false,prose:true});pane.querySelector('.th-summary').innerHTML=displayText(mark(t.summary));pane.querySelector('.th-example').innerHTML=displayText(mark(t.example));
   const ref=pane.querySelector('footer a');ref.href=RULEBOOK;ref.textContent=i18n("规则 {0} ↗", [t.rule]);ref.hidden=t.rule==='概念牌草案'||t.rule==='本游戏简化规则';
   captions.set(t.video,t.label);
   video.poster=mediaBase+t.video+'.webp?v=map-2';video.setAttribute('aria-label',i18n("{0}的游戏画面演示", [t.label]));videoUrl=mediaBase+t.video+'.mp4?v=map-2';
  }else if(c){
   pane.querySelector('#th-group').textContent=i18n("关联卡牌 · {0}", [sideNames[c.side]]);pane.querySelector('#th-title').textContent=displayText(c.titleZh);
   reference.innerHTML=displayText(`<div class="ts-card-slot" data-preview-card="${String(c.id).padStart(3,'0')}">${cardHTML(c,{interactive:false,lazy:false,assetBase:mediaBase.replace(/help\/$/,'')})}</div>`);
  }else{
   const state=countrySource?.state(country.id),owner=state?.controller;
   pane.querySelector('#th-group').textContent=i18n("地图国家");pane.querySelector('#th-title').textContent=displayText(country.name.zh);
   reference.innerHTML=i18n("<div class=\"th-country-meta\"><span>稳定度 <b>{0}</b></span><span>{1}</span></div>{2}<p class=\"th-map-hint\">{3}</p>", [country.stability, country.key?'战场国':'非战场国', state?`<div class="th-influence"><span class="a">美国 <b>${state.influence[0]}</b></span><span class="b">苏联 <b>${state.influence[1]}</b></span></div><p class="th-control">${owner===0?'美国控制':owner===1?'苏联控制':'尚未被任何一方控制'}</p>`:'', countrySource?'已在地图上高亮 · 移开后恢复':'']);
   countrySource?.highlight(country.id);
  }
  pane.hidden=false;
  // A popover outside an open modal is inert even when it is in the top layer.
  // Keep it in the trigger's dialog so its playback controls remain reachable.
  (el.closest('dialog')||document.body).append(pane);
  if(typeof pane.showPopover==='function')pane.showPopover();
  if(c)fitCards(reference);position();document.dispatchEvent(new CustomEvent('card-term-open',{detail:{trigger:el}}));play.textContent=displayText(reduce.matches?'播放演示':'暂停');if(t&&!reduce.matches)start();if(keyboard)close.focus({preventScroll:true});
 }
 function leave(){clearTimeout(closing);closing=setTimeout(()=>hide(),220);}
 const target=e=>{
  if(!(e.target instanceof Element)||e.target.closest('.pinning'))return null;
  return e.target.closest('.game-term:is([data-term],[data-country-ref],[data-card-ref]),[data-card-history]');
 };
 document.addEventListener('pointerover',e=>{const el=target(e);if(!el||el.contains(e.relatedTarget)||e.pointerType==='touch')return;clearTimeout(closing);clearTimeout(opening);if(blocked!==el)opening=setTimeout(()=>show(el),160);},opts);
 document.addEventListener('pointerout',e=>{const el=target(e);if(!el||el.contains(e.relatedTarget))return;if(blocked===el)blocked=null;clearTimeout(opening);if(!pane.contains(e.relatedTarget))leave();},opts);
 pane.addEventListener('pointerenter',()=>{clearTimeout(closing);clearTimeout(opening)},opts);pane.addEventListener('pointerleave',e=>{if(e.relatedTarget!==active)leave()},opts);
 document.addEventListener('focusin',e=>{const el=target(e);if(el)show(el);else if(!pane.contains(e.target))hide();},opts);
 document.addEventListener('focusout',()=>setTimeout(()=>{if(active&&!pane.contains(document.activeElement)&&document.activeElement!==active&&!pane.matches(':hover')&&!active.matches(':hover'))leave()},0),opts);
 // Let click open pointer-triggered help. Focusing on touch-down could cover the
 // title before touch-up and send the resulting click to the dialog backdrop.
 document.addEventListener('pointerdown',e=>{const el=target(e);if(el){e.preventDefault();e.stopPropagation();}else if(active&&!pane.contains(e.target))hide();},{capture:true,...opts});
 document.addEventListener('click',e=>{const el=target(e);if(!el)return;e.preventDefault();e.stopPropagation();blocked=null;show(el);},{capture:true,...opts});
 document.addEventListener('keydown',e=>{const el=target(e);if(e.key==='Escape'&&active){e.preventDefault();e.stopImmediatePropagation();hide({restore:pane.contains(document.activeElement),suppress:true});}else if(el&&['Enter',' '].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();blocked=null;show(el,true);}},{capture:true,...opts});
 close.addEventListener('click',()=>hide({restore:true,suppress:true}),opts);
 play.addEventListener('click',()=>{if(video.paused)start();else{video.pause();play.textContent=i18n("继续播放")}},opts);
 video.addEventListener('error',()=>{play.textContent=i18n("重试播放");},opts);
 document.addEventListener('scroll',e=>{if(active&&!pane.contains(e.target))hide();},{capture:true,...opts});
 document.addEventListener('close',()=>hide(),{capture:true,...opts});document.addEventListener('visibilitychange',()=>{if(document.hidden)hide()},opts);
 window.addEventListener('resize',()=>hide(),opts);reduce.addEventListener('change',()=>{if(reduce.matches){video.pause();play.textContent=i18n("播放演示")}},opts);
 // Opening source notes or decoding a photo can change the pane's height after hover.
 const paneSize=new ResizeObserver(()=>{if(active&&!pane.hidden)position();});paneSize.observe(pane);
 const observer=new MutationObserver(()=>{if(active&&!active.isConnected)hide();});observer.observe(document.body,{childList:true,subtree:true});
 installed={hide,destroy(){hide();abort.abort();captions.dispose();observer.disconnect();paneSize.disconnect();pane.remove();installed=undefined;}};return installed;
}
