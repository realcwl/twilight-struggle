import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {GLOSSARY} from '../../src/cards/terms.js';
const root=new URL('../../',import.meta.url);
test('every glossary video has a short local clip, matching poster and manifest entry',async()=>{
 const manifest=JSON.parse(await readFile(new URL('public/cards/help/manifest.json',root)));
 const ids=[...new Set(GLOSSARY.map(t=>t.video))].sort();
 assert.deepEqual(manifest.videos.map(v=>v.id).sort(),ids);
 for(const v of manifest.videos){
  assert.ok(v.duration>=4&&v.duration<=8,v.id+' duration');
  const mp4=await readFile(new URL('public'+v.file,root));
  assert.equal(mp4.length,v.bytes,v.id+' bytes');assert.ok(mp4.length>1000);
  assert.ok(mp4.indexOf('moov')>0&&mp4.indexOf('moov')<mp4.indexOf('mdat'),v.id+' fast start');
  assert.equal((await stat(new URL('public'+v.poster,root))).size,v.posterBytes,v.id+' poster');
 }
});
test('all main-project card artwork exists independently of prototype pages',async()=>{
 const cards=JSON.parse(await readFile(new URL('src/cards/catalog.json',root)));
 for(const c of cards)assert.ok((await stat(new URL('public/cards/art/'+String(c.id).padStart(3,'0')+'.webp',root))).size>1000);
 for(const f of ['back.png','fonts/card-zh.woff2','fonts/oswald.woff2','fonts/russo-one.woff2'])assert.ok((await stat(new URL('public/cards/'+f,root))).size>1000);
});
