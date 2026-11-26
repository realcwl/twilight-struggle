import { t as i18n, text as displayText } from '../i18n/index.js';
import {mountCardFilters} from './filters';
import {compareCardOps} from './order';
import {CARDS,cardFace,cardBack,fitCard,cardFontsReady} from './deck';
import {termLegend} from './terms.js';
import {esc} from './render.js';
import '../ui/sheet.css';
import './library.css';

export type CardLibrary={open:(id?:string)=>Promise<void>};
let mounted:CardLibrary|null=null;
/**
 * A complete catalog on the main map; shares the HUD's CardSource rather than an embedded review app.
 * `trigger:false` leaves out the floating button, for a page that opens the catalog from a control of its own.
 */
export function mountCardLibrary({trigger:floating=true}:{trigger?:boolean}={}):CardLibrary {
 if(mounted)return mounted;
 const trigger=document.createElement('button');trigger.className='cl-trigger';trigger.type='button';trigger.innerHTML=i18n("▤ <span>牌库</span><b>110</b>");trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls','card-library');
 const dialog=document.createElement('dialog');dialog.id='card-library';dialog.className='card-library sheet';dialog.setAttribute('aria-labelledby','cl-title');
 dialog.innerHTML=i18n("<header class=\"cl-header\"><div class=\"sheet-head\"><small class=\"sheet-kicker\">冷战热斗</small><h2 id=\"cl-title\" class=\"sheet-title\">卡牌全览</h2></div><button class=\"cl-close sheet-x\" type=\"button\" aria-label=\"关闭牌库\">×</button></header><section class=\"cl-list\"><div class=\"cl-legend\">{0}<small>悬停高亮词，查看图文解释</small></div><div class=\"cl-filters\"></div><div class=\"cl-grid\"></div><p class=\"cl-empty\" hidden>没有符合条件的卡牌。</p></section><section class=\"cl-detail\" hidden><nav><button class=\"cl-return sheet-btn\">← 全部卡牌</button><div><button class=\"cl-prev sheet-btn\" aria-label=\"上一张\">←</button><button class=\"cl-flip sheet-btn\">查看背面</button><button class=\"cl-next sheet-btn\" aria-label=\"下一张\">→</button></div></nav><div class=\"cl-detail-stage\"></div><p class=\"cl-caption\"></p></section>", [termLegend()]);
 if(floating)document.body.append(trigger);document.body.append(dialog);
 const $=<T extends Element>(s:string)=>dialog.querySelector<T>(s)!;
 const filters=mountCardFilters($<HTMLElement>('.cl-filters'),render);
 const ordered=[...CARDS].sort((a,b)=>compareCardOps(a.id,b.id));
 let shown=[...ordered],selected:string|null=null,back=false,rendered=false;
 const fit=()=>dialog.querySelectorAll<HTMLElement>('.ts-card-slot').forEach(fitCard);
 function render(){shown=ordered.filter(c=>filters.matches(c.id));
  const grid=$<HTMLElement>('.cl-grid');grid.replaceChildren();for(const c of shown){const item=document.createElement('article');item.className='cl-tile';item.dataset.card=c.id;item.append(cardFace(c.id));item.insertAdjacentHTML('beforeend',i18n("<button type=\"button\" class=\"cl-inspect\" aria-label=\"查看{0}\"><small>{1}{2}</small>{3}<span>↗</span></button>", [esc(c.title), c.id, c.optional?' · 可选':'', esc(c.title)]));grid.append(item)}
  filters.setCount(shown.length,CARDS.length); $<HTMLElement>('.cl-empty').hidden=shown.length>0;rendered=true;requestAnimationFrame(fit);
 }
 function showDetail(id:string){selected=id;back=false;$<HTMLElement>('.cl-list').hidden=true;$<HTMLElement>('.cl-detail').hidden=false;paintDetail();}
 function paintDetail(){if(!selected)return;const c=CARDS.find(c=>c.id===selected)!;$('.cl-detail-stage').replaceChildren(back?cardBack():cardFace(selected));$('.cl-flip').textContent=displayText(back?'查看正面':'查看背面');$('.cl-caption').textContent=displayText(back?'全牌组共用的中立背面':`${c.id} · ${c.title}${c.optional?' · 官方可选牌':''} · 悬停术语查看解释`);
  const i=shown.findIndex(c=>c.id===selected);$<HTMLButtonElement>('.cl-prev').disabled=i<=0;$<HTMLButtonElement>('.cl-next').disabled=i<0||i>=shown.length-1;requestAnimationFrame(fit);
 }
 function step(n:number){const i=shown.findIndex(c=>c.id===selected);if(shown[i+n])showDetail(shown[i+n].id);}
 async function open(id?:string){if(!dialog.open)dialog.showModal();if(!rendered)render();await cardFontsReady();if(id)showDetail(id);fit();}
 trigger.onclick=()=>void open();$<HTMLButtonElement>('.cl-close').onclick=()=>dialog.close();
 dialog.addEventListener('click',e=>{const target=e.target as Element;if(target===dialog){dialog.close();return;}if(target.closest('[data-term],[data-card-ref],[data-country-ref],[data-card-history],.term-help'))return;const item=target.closest<HTMLElement>('.cl-tile');if(item?.dataset.card)showDetail(item.dataset.card);});
 $<HTMLButtonElement>('.cl-return').onclick=()=>{selected=null;$<HTMLElement>('.cl-list').hidden=false;$<HTMLElement>('.cl-detail').hidden=true;requestAnimationFrame(fit)};
 $<HTMLButtonElement>('.cl-flip').onclick=()=>{back=!back;paintDetail()};$<HTMLButtonElement>('.cl-prev').onclick=()=>step(-1);$<HTMLButtonElement>('.cl-next').onclick=()=>step(1);
 dialog.addEventListener('keydown',e=>{if(!selected||(e.target as Element).closest('input,select,[data-term],[data-card-ref],[data-country-ref],[data-card-history],.term-help'))return;if(e.key==='ArrowLeft'){e.preventDefault();step(-1)}if(e.key==='ArrowRight'){e.preventDefault();step(1)}});
 dialog.addEventListener('close',()=>{if(floating)trigger.focus({preventScroll:true})});window.addEventListener('resize',()=>{if(dialog.open)requestAnimationFrame(fit)});
 const id=new URLSearchParams(location.search).get('card');if(id&&CARDS.some(c=>Number(c.id)===Number(id)))void open(String(Number(id)).padStart(3,'0'));
 return mounted={open};
}
