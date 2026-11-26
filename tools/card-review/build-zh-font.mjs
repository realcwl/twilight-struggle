import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import path from 'node:path';
import subsetFont from 'subset-font';
const root=path.resolve('prototypes/card-designs');
async function source(dir){let out='';for(const e of await readdir(dir,{withFileTypes:true})){if(['assets'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())out+=await source(p);else if(/\.(js|json|html|css)$/.test(e.name))out+=await readFile(p,'utf8');}return out;}
const text=[...new Set((await source(root))+Array.from({length:95},(_,i)=>String.fromCharCode(32+i)).join(''))].join('');
const font=await subsetFont(await readFile('assets/raw/NotoSerifSC-wght.ttf'),text,{targetFormat:'woff2',variationAxes:{wght:{min:400,max:800}}});
await writeFile(path.join(root,'assets/fonts/card-zh.woff2'),font);
await mkdir('public/cards/fonts',{recursive:true});
await writeFile('public/cards/fonts/card-zh.woff2',font);
console.log(`Chinese font: ${text.length} characters, ${font.length} bytes`);
