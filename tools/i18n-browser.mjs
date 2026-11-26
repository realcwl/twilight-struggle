// Isolated browser regression for localization, layouts, real gameplay and safe language switching.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import assert from 'node:assert/strict';
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const profile=await mkdtemp('/tmp/i18n-ui-');
const browser=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-port='+port,'--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--window-size=1600,1000','about:blank'],{stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));let ws;const errors=[];
try {
 let pages;for(let i=0;i<60;i++){try{pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();break}catch{await pause(100)}}
 assert.ok(pages);ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let n=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++n;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
 const ev=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 const shot=async name=>writeFile('/tmp/i18n-ui-'+name+'.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await cdp('Emulation.setFocusEmulationEnabled',{enabled:true});await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
 const until=async exp=>{for(let i=0;i<250;i++){try{if(await ev(exp))return;}catch(e){if(!/context|navigat|Cannot find/i.test(JSON.stringify(e)))throw e;}await pause(100)}throw Error('Timed out: '+exp+'\n'+await ev('document.body.innerText.slice(-1200)'))};
 const click=async sel=>{const p=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)throw Error('Missing '+${JSON.stringify(sel)});e.scrollIntoView({block:'center',inline:'nearest'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p})};
 const key=async key=>{await cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:key==='Enter'?13:key==='Escape'?27:undefined});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code:key})};
 const drag=async id=>{const r=await ev(`(()=>{const r=document.querySelector('.hd-hit[data-card="${id}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:Math.min(innerHeight-25,r.y+35)}})()`);await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...r});await pause(200);await cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...r});for(let i=1;i<=10;i++){await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:r.x,y:r.y-i*30,button:'left',buttons:1});await pause(20)}await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:r.x,y:r.y-300,button:'left',clickCount:1})};
 const chinese=()=>ev(`(()=>{const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n,out=[];while(n=w.nextNode()){if(n.parentElement?.closest('script,style,.language-menu,.language-button')||!n.parentElement?.checkVisibility())continue;if(/\\p{Script=Han}/u.test(n.textContent))out.push(n.textContent.trim());}return [...new Set(out)].filter(Boolean)})()`);
 const results=[];
 for(const locale of ['zh','en','es']){
  await cdp('Page.navigate',{url:'http://localhost:5173/online.html?lang='+locale});await until('!!document.querySelector(".language-button")');await pause(300);
  if(locale!=='zh')assert.deepEqual(await chinese(),[],locale+' lobby');
  await click('.language-button');assert.equal(await ev('document.querySelectorAll("[role=menuitemradio]").length'),3);await key('Escape');
  await shot('lobby-'+locale);
  await ev("localStorage.removeItem('coldwar.solo.v1.coldwar')");
  await cdp('Page.navigate',{url:'http://localhost:5173/game.html?pace=.05&lang='+locale});await until('!!window.game?.play && !!document.querySelector(".solo-dialog[open]")');
  if(locale!=='zh')assert.deepEqual(await chinese(),[],locale+' setup notice');
  await click('.solo-dialog button');await until('!!document.querySelector(".wm-plate.pl-ok")');
  if(locale==='en'){
   await click('.language-button');await click('[data-language="es"]');
   assert.equal(await ev('document.documentElement.lang'),'en','unfinished placement waits for a safe checkpoint');
   await click('.language-button');await click('[data-language="en"]');
   assert.equal(await ev('document.querySelector(".language-notice").textContent'),'','choosing the current language cancels the queued change');
   assert.equal(await ev('document.querySelector(".language-button span").textContent'),'English');
   await click('.language-button');await click('[data-language="es"]');
  }
  await ev("game.map.flyTo('europe',{fit:true})");await pause(1000);
  for(const [id,n]of [['frg',4],['ita',3]])for(let i=0;i<n;i++){await click(`.wm-plate[data-id="${id}"]`);await pause(80)}
  if(locale!=='zh')assert.deepEqual(await chinese(),[],locale+' placement');
  await key('Enter');
  if(locale==='en'){
   await until('document.documentElement.lang==="es" && !!window.game?.play && game.play.snapshot.phase==="headline" && !document.querySelector(".hud.play-wait")');
   assert.equal(await ev('game.play.snapshot.inf.frg[0]'),4,'queued language change preserves the completed deployment');
   await click('.language-button');await click('[data-language="en"]');
   await until('document.documentElement.lang==="en" && !!window.game?.play');
  }
  await until('game.play.snapshot.phase==="headline" && !document.querySelector(".hud.play-wait")');await pause(400);
  assert.equal(await ev('game.play.snapshot.inf.frg[0]'),4);
  if(locale!=='zh')assert.deepEqual(await chinese(),[],locale+' headline');
  await shot('headline-'+locale);
  // Inspect all real card layouts, then open a real terminology popover.
  await ev(`(async()=>{const {mountCardLibrary}=await import('/src/cards/library.ts');await mountCardLibrary().open();await document.fonts.ready;const {fitCards}=await import('/src/cards/render.js');fitCards(document.querySelector('#card-library'));})()`);
  const bad=await ev(`Array.from(document.querySelectorAll('.cl-grid .game-card')).filter(c=>{const b=c.querySelector('.rules-copy'),t=c.querySelector('.card-banner h3'),p=t.parentElement,s=getComputedStyle(p);return b.scrollHeight>b.clientHeight+2||t.scrollWidth>t.clientWidth+2||t.scrollHeight>p.clientHeight-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom)+2}).map(c=>c.dataset.cardId)`);
  assert.deepEqual(bad,[],locale+' card overflow');assert.equal(await ev('document.querySelectorAll(".cl-grid .game-card").length'),110);
  if(locale!=='zh')assert.deepEqual(await chinese(),[],locale+' catalog');
  await click('.cl-tile[data-card="020"] .cl-inspect');await pause(300);await shot('card-'+locale);
  await click('.cl-detail-stage [data-term]');await until('!!document.querySelector(".term-help:popover-open")');
  if(locale!=='zh')assert.deepEqual(await chinese(),[],locale+' glossary');
  await shot('help-'+locale);
  if(locale==='es'){
   await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await pause(400);
   await click('.cl-detail-stage [data-term]');await until('!!document.querySelector(".term-help:popover-open")');
   assert.ok(await ev('(()=>{const r=document.querySelector(".term-help").getBoundingClientRect();return r.left>=0&&r.right<=390&&r.top>=0&&r.bottom<=844})()'),'Spanish help fits phone');
   await shot('phone-help');await cdp('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
  }
  await key('Escape');await click('.cl-close');
  // Locale changes preserve the exact saved setup and dealt hand.
  if(locale==='en'){
   const saved=await ev("JSON.parse(localStorage.getItem('coldwar.solo.v1.coldwar'))");
   await click('.language-button');await click('[data-language="es"]');await until('location.search.includes("lang=es") && document.documentElement.lang==="es" && !!window.game?.play');
   await until('!document.querySelector(".hud.play-wait")');assert.deepEqual(await ev('game.play.snapshot'),saved);
   await click('.language-button');await click('[data-language="en"]');await until('location.search.includes("lang=en") && document.documentElement.lang==="en" && !!window.game?.play');
   await until('!document.querySelector(".hud.play-wait")');
  }
  // Play a real decisive event through drag -> event control -> victory, then reopen its log.
  await ev(`(()=>{game.play.stop();const s=JSON.parse(localStorage.getItem('coldwar.solo.v1.coldwar'));for(const a of [...s.hands,s.deck,s.discard,s.removed,s.future]){const at=a.indexOf('065');if(at>=0)a.splice(at,1)}s.hands[0].push('065');s.played=null;s.phase='action';s.active=0;s.actions=[0,0];s.vp=19;s.crisis=3;s.flags={};s.temp={};localStorage.setItem('coldwar.solo.v1.coldwar',JSON.stringify(s));window.oldPage=true})()`);
  await cdp('Page.reload',{ignoreCache:true});await until('!window.oldPage && !!window.game?.play && game.play.snapshot.vp===19 && !document.querySelector(".hud.play-wait")');await pause(500);
  await drag('065');await until('!!document.querySelector(".sp-choice")');if(locale!=='zh')assert.deepEqual(await chinese(),[],locale+' event choice');await pause(600);await shot('choice-'+locale);await click('.sp-half.ev');
  await until('!!document.querySelector(".solo-result[open]")');assert.equal(await ev('game.play.result.winner'),0);if(locale!=='zh')assert.deepEqual(await chinese(),[],locale+' victory');await shot('victory-'+locale);
  results.push({locale,cards:110,setup:true,switch:locale==='en',victory:true});
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({results,errors}));
}finally{ws?.close();browser.kill('SIGTERM');await pause(700);await rm(profile,{recursive:true,force:true})}
