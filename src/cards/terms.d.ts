export type Term={id:string;label:string;group:string;video:string;summary:string;example:string;rule:string};
export const GLOSSARY:readonly Term[];
export const termsById:Map<string,Term>;
export const TERM_GROUPS:Readonly<Record<string,string>>;
export const RULEBOOK:string;
export function highlight(text:string,options?:{interactive?:boolean;prose?:boolean;locale?:import("../i18n/index.js").Language}):string;
export function termLegend():string;
export function esc(value:unknown):string;
