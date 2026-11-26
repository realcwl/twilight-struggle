import {copyFile,mkdir,readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('src/cards/catalog.json',root)));
export async function syncCardAssets(){
 for(const dir of ['art','fonts/licenses'])await mkdir(new URL('public/cards/'+dir+'/',root),{recursive:true});
 for(const c of catalog)await copyFile(new URL('prototypes/card-designs/final/'+c.art,root),new URL('public/cards/art/'+String(c.id).padStart(3,'0')+'.webp',root));
 await copyFile(new URL('prototypes/card-designs/nato/back.png',root),new URL('public/cards/back.png',root));
 for(const font of ['card-zh','oswald','russo-one'])await copyFile(new URL('prototypes/card-designs/assets/fonts/'+font+'.woff2',root),new URL('public/cards/fonts/'+font+'.woff2',root));
 for(const file of await readdir(new URL('prototypes/card-designs/assets/fonts/licenses/',root)))await copyFile(new URL('prototypes/card-designs/assets/fonts/licenses/'+file,root),new URL('public/cards/fonts/licenses/'+file,root));
 return catalog.length;
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(`Synced ${await syncCardAssets()} card assets into public/cards/`);
