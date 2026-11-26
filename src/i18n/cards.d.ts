import type {Language} from './index.js';
export function cardCopy(card:{id:number;title:string;titleZh:string;effects:string[];effectsZh:string[];prerequisiteZh:string;noteZh:string;[key:string]:unknown},locale?:Language):{title:string;effects:string[];prerequisite:string;note:string};
