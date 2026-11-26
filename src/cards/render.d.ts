export type RawCard = {id:number;title:string;titleZh:string;ops:number;era:'early'|'mid'|'late';side:'us'|'ussr'|'neutral'|'scoring';once:boolean;persistent:boolean;optional:boolean;effects:string[];effectsZh:string[];prerequisiteZh:string;noteZh:string;art:string;revision:number;source:string;[key:string]:unknown};
export const eraNames:Record<RawCard['era'],string>;
export const sideNames:Record<RawCard['side'],string>;
export function esc(s:unknown):string;
export function cardHTML(c:RawCard,options?:{back?:boolean;lazy?:boolean;artReady?:boolean;assetBase?:string;interactive?:boolean;locale?:import("../i18n/index.js").Language}):string;
export function fitCards(container?:ParentNode):void;
