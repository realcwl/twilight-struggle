import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {cardHTML} from '../../src/cards/render.js';
import {historyHTML} from '../../src/cards/history.js';

const root=new URL('../../',import.meta.url);
const cards=JSON.parse(await readFile(new URL('src/cards/catalog.json',root),'utf8'));
const stories=JSON.parse(await readFile(new URL('src/cards/history.json',root),'utf8'));

test('every main and optional card has its own complete, sourced Chinese history',async()=>{
 assert.deepEqual(Object.keys(stories).map(Number),cards.map(c=>c.id));
 assert.equal(new Set(Object.values(stories).map(s=>s.lead)).size,110);
 for(const c of cards){
  const s=stories[c.id];
  assert.equal(s.title,c.titleZh);
  assert.ok(s.period&&s.kind&&s.lead);
  assert.equal(s.paragraphs.length,3,`#${c.id} narrative structure`);
  assert.ok(s.paragraphs.join('').length>=160,`#${c.id} has a complete story`);
  for(const p of s.paragraphs)assert.match(p,/\p{Script=Han}/u);
  assert.ok(s.sources.length>0);
  for(const source of s.sources){assert.ok(source.label);assert.equal(new URL(source.url).protocol,'https:');}
 }
 assert.match(stories[46].kind,/电影/);
 assert.match(stories[100].paragraphs.join(''),/虚构/);
 for(const c of cards.filter(c=>c.side==='scoring'))assert.match(stories[c.id].kind,/地区/);
});

test('archival illustrations exist, carry attribution and preserve original dimensions',async()=>{
 const credits=await readFile(new URL('public/cards/history/CREDITS.md',root),'utf8');
 for(const s of Object.values(stories))if(s.image){
  const p=s.image;
  assert.match(p.src,/^\/cards\/history\/\d{3}\.webp$/);
  assert.ok((await stat(new URL('public'+p.src,root))).size>0);
  assert.ok(p.caption&&p.credit&&p.source&&p.license&&p.width>0&&p.height>0);
  assert.ok(credits.includes(p.source)&&credits.includes(p.credit));
  if(p.license.startsWith('CC'))assert.ok(p.licenseUrl.startsWith('https://creativecommons.org/'));
 }
 assert.match(stories[80].image.caption,/奥尔德林.*阿姆斯特朗/);
 assert.match(stories[94].image.caption,/事故数月后/);
});

test('interactive titles expose history while nested previews stay noninteractive',()=>{
 for(const c of cards){
  const html=cardHTML(c);
  assert.match(html,new RegExp(`data-card-history="${c.id}"`));
  assert.match(html,/aria-haspopup="dialog" aria-expanded="false"/);
  assert.doesNotMatch(cardHTML(c,{interactive:false}),/data-card-history|tabindex|data-term=/);
  assert.doesNotMatch(cardHTML(c,{back:true}),/data-card-history/);
 }
});

test('narrative content is escaped and sources are safe new-tab links',()=>{
 const html=historyHTML({...stories[8],lead:'<script>evil()</script>',paragraphs:['<img src=x onerror=evil()>'],sources:[{label:'<test>',url:'https://example.org/?a="b"'}]});
 assert.doesNotMatch(html,/<script>|<img src=x|<test>/);
 assert.match(html,/&lt;script&gt;/);
 assert.match(html,/rel="noopener noreferrer"/);
 assert.doesNotMatch(html,/data-term|data-card-history|<video/);
});
