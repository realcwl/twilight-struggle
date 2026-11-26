import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import sharp from 'sharp';import {startServer} from './server.mjs';
const close=s=>new Promise((ok,no)=>s.close(e=>e?no(e):ok()));
test('comments, point anchors and image attachments survive restart; resolution can be reopened',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ts-card-review-test-'));let app;
 try{app=await startServer({port:0,dataDir:dir});const data=await sharp({create:{width:8,height:8,channels:3,background:'#cc2233'}}).png().toBuffer();
 const r=await fetch(app.url+'/api/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cardId:21,side:'front',anchor:{x:.42,y:.51},text:'Move the title down.\nKeep the flag.',attachments:[{name:'reference.png',data:'data:image/png;base64,'+data.toString('base64')}]})});assert.equal(r.status,201);const c=await r.json();assert.equal(c.cardId,21);assert.equal(c.attachments.length,1);assert.equal(c.status,'open');assert.deepEqual(c.anchor,{x:.42,y:.51});assert.match(await readFile(join(dir,'pending-comments.md'),'utf8'),/NATO/);
 const img=await fetch(app.url+c.attachments[0].url);assert.equal(img.status,200);assert.equal(img.headers.get('content-type'),'image/webp');assert.ok((await img.arrayBuffer()).byteLength>20);
 await close(app.server);app=await startServer({port:0,dataDir:dir});assert.deepEqual((await(await fetch(app.url+'/api/comments')).json()).comments,[c]);
 let patch=await fetch(app.url+'/api/comments/'+c.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'resolved',resolution:'Horizontal banner retained.'})});assert.equal(patch.status,200);assert.doesNotMatch(await readFile(join(dir,'pending-comments.md'),'utf8'),/Move the title/);
 patch=await fetch(app.url+'/api/comments/'+c.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'open',text:'Use this reference.'})});assert.equal(patch.status,200);assert.match(await readFile(join(dir,'pending-comments.md'),'utf8'),/Use this reference/);
 }finally{if(app)await close(app.server);await rm(dir,{recursive:true,force:true})}
});
test('invalid images and foreign origins do not create comments',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ts-card-review-test-'));const app=await startServer({port:0,dataDir:dir});
 try{
 for(const payload of [{cardId:999,text:'unknown'},{cardId:21,text:'bad point',anchor:{x:3,y:1}},{cardId:21,text:'bad image',attachments:[{name:'fake.png',data:'data:image/png;base64,aGVsbG8='}]}]){const r=await fetch(app.url+'/api/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});assert.equal(r.status,400)}
 const foreign=await fetch(app.url+'/api/comments',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://unrelated.example'},body:JSON.stringify({cardId:21,text:'foreign'})});assert.equal(foreign.status,403);
 assert.equal((await(await fetch(app.url+'/api/comments')).json()).comments.length,0);
 assert.equal((await fetch(app.url+'/package.json')).status,404);
 assert.equal((await fetch(app.url+'/')).status,200);
 }finally{await close(app.server);await rm(dir,{recursive:true,force:true})}
});
test('all 110 cards retain official identity and operative values',async()=>{
 const cards=JSON.parse(await readFile(new URL('../../prototypes/card-designs/final/cards.json',import.meta.url)));
 const source=JSON.parse(await readFile(new URL('./source-metadata.json',import.meta.url)));
 assert.equal(cards.length,110);assert.deepEqual(cards.map(c=>c.id),Array.from({length:110},(_,i)=>i+1));
 for(const c of cards){const s=source.find(s=>s.id===c.id);for(const key of ['ops','era','side','once','persistent','optional'])assert.equal(c[key],s[key],`#${c.id} ${key}`);assert.ok(c.effects.length>0);assert.ok(c.titleZh);assert.ok(c.artPrompt);}
 assert.equal(cards.filter(c=>c.optional).length,7);assert.equal(cards.filter(c=>c.side==='scoring').length,7);
 assert.deepEqual(['early','mid','late'].map(era=>cards.filter(c=>c.era===era).length),[39,48,23]);
});

test('shared card modules and media are served safely with byte-range support',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ts-card-media-test-'));const app=await startServer({port:0,dataDir:dir});
 try{
  for(const route of ['/src/cards/render.js','/src/cards/terms.js','/src/cards/glossary.json','/src/cards/tooltips.js','/src/cards/card.css','/cards/art/021.webp'])assert.equal((await fetch(app.url+route)).status,200,route);
  for(const route of ['/src/game/main.ts','/cards/%2e%2e%2fsrc%2fcards%2fcatalog.json','/cards/%2e%2e%2f%2e%2fpackage.json'])assert.equal((await fetch(app.url+route)).status,404,route);
  const media=await readFile(new URL('../../public/cards/help/control.mp4',import.meta.url));
  const part=await fetch(app.url+'/cards/help/control.mp4',{headers:{Range:'bytes=0-31'}});
  assert.equal(part.status,206);assert.equal(part.headers.get('content-type'),'video/mp4');assert.equal(part.headers.get('content-range'),`bytes 0-31/${media.length}`);assert.deepEqual(Buffer.from(await part.arrayBuffer()),media.subarray(0,32));
  assert.equal((await fetch(app.url+'/cards/help/control.mp4',{headers:{Range:`bytes=${media.length}-`}})).status,416);
 }finally{await close(app.server);await rm(dir,{recursive:true,force:true})}
});
