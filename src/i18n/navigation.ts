import {getLanguage,setLanguage,type Language} from './index.js';
let safeToReload=()=>true;
let pending:Language|null=null;
/** Local games switch only at a complete-action boundary; online rooms replay their pending prompt. */
export function guardLanguageNavigation(guard:()=>boolean):void {safeToReload=guard;}
function navigate(locale:Language):void {
  pending=null;setLanguage(locale);
  const url=new URL(location.href);url.searchParams.set('lang',locale);location.assign(url.href);
}
export function requestLanguage(locale:Language):boolean {
  if(locale===getLanguage()){pending=null;return true;}
  if(safeToReload()){navigate(locale);return true;}
  pending=locale;return false;
}
export function flushLanguageChange():void {if(pending)navigate(pending);}
