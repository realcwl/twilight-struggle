import sharp from 'sharp';
import { readFile,writeFile,rename,mkdir,copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const [id,src]=process.argv.slice(2), dir=resolve('prototypes/card-designs/final');
const cards=JSON.parse(await readFile(`${dir}/cards.json`));
const card=cards.find(c=>c.id===Number(id));
if(!card||!src)throw new Error('Card ID and source file required');
await sharp(src).resize({width:1200,withoutEnlargement:true}).webp({quality:86}).toFile(`${dir}/${card.art}`);
await mkdir(resolve('public/cards/art'),{recursive:true});
await copyFile(`${dir}/${card.art}`,resolve(`public/cards/art/${String(card.id).padStart(3,'0')}.webp`));
let manifest={};try{manifest=JSON.parse(await readFile(`${dir}/art-manifest.json`))}catch{}
manifest[id]={file:card.art,source:src,method:'built-in image_gen',prompt:card.artPrompt,createdAt:new Date().toISOString()};
await writeFile(`${dir}/art-manifest.json.tmp`,JSON.stringify(manifest,null,2)+'\n');
await rename(`${dir}/art-manifest.json.tmp`,`${dir}/art-manifest.json`);
console.log(`${id}: ${card.art}`);
