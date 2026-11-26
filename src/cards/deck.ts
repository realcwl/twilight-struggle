import {cardCopy} from '../i18n/cards.js';
import { t as i18n, text as displayText } from '../i18n/index.js';
// Canonical 110-card catalog and renderer, shared with the local review room.
import catalog from './catalog.json';
import {cardHTML,fitCards,type RawCard} from './render.js';
import {installTermHelp,setCountryHelp} from './tooltips.js';
import type {WorldMap} from '../map/WorldMap';
import './card.css';

export type CardKind = 'us' | 'ussr' | 'neutral' | 'tally';
export type CardEra = 'early' | 'middle' | 'late';
export type Card = {id:string;kind:CardKind;era:CardEra;value:number;title:string;once:boolean;optional:boolean;persistent:boolean;special:boolean};
const raw=new Map(catalog.map(c=>[String(c.id).padStart(3,'0'),c as RawCard]));
export const CARDS:readonly Card[]=catalog.map(c=>({id:String(c.id).padStart(3,'0'),kind:c.side==='scoring'?'tally':c.side as CardKind,era:c.era==='mid'?'middle':c.era as CardEra,value:c.ops,get title(){return cardCopy(c).title;},once:c.once,optional:c.optional,persistent:c.persistent,special:c.id===6}));
const byId=new Map(CARDS.map(c=>[c.id,c]));
const assetBase=import.meta.env.BASE_URL+'cards/';
const normalize=(id:string)=>String(Number(id)).padStart(3,'0');
export function card(id:string):Card {const c=byId.get(normalize(id));if(!c)throw new Error(`No card "${id}" in the deck`);return c;}
function mount(c:RawCard,back=false):HTMLElement {
 installTermHelp({mediaBase:assetBase+'help/'});
 const el=document.createElement('div');el.className=`slot ts-card-slot ${back?'is-back':'side-'+c.side}`;
 el.innerHTML=displayText(`<div class="tilt"><div class="flip"><div class="face front">${cardHTML(c,{back,assetBase})}</div></div></div>`);
 if(!back)el.dataset.card=String(c.id).padStart(3,'0');
 return el;
}
export function cardFace(id:string):HTMLElement {const c=raw.get(normalize(id));if(!c)throw new Error(`No card "${id}" in the deck`);return mount(c);}
export function cardBack():HTMLElement {return mount(catalog[0] as RawCard,true);}
export function fitCard(el:HTMLElement):void {if(el.isConnected)fitCards(el);}
export const describeCard=(id:string):string=>{const c=raw.get(normalize(id));if(!c)return '';const v=cardCopy(c);return `${v.title}. ${c.ops} ${i18n('行动点')}. ${v.prerequisite} ${v.effects.join(' ')} ${v.note}`;};
export async function cardFontsReady():Promise<void>{await Promise.all(["500 20px 'Card Chinese'","750 20px 'Card Chinese'","20px Russo"].map(f=>document.fonts.load(f)));}
export function connectCardMap(map:WorldMap):()=>void {
 return setCountryHelp({state:id=>map.countryState(id),highlight:id=>map.inspectCountry(id)});
}
