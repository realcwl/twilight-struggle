// Local regression: private revealed-hand history, real card previews, export and responsive layout.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import assert from 'node:assert/strict';
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const profile=await mkdtemp('/tmp/reveal-ui-');
const browser=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-port='+port,'--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--window-size=1600,1000','about:blank'],{stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));let ws;const errors=[];
try {
 let pages;for(let i=0;i<60;i++){try{pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();break}catch{await pause(100)}}
 assert.ok(pages);ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let n=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++n;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
 const ev=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 const shot=async name=>writeFile('/tmp/reveal-ui-'+name+'.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await cdp('Emulation.setFocusEmulationEnabled',{enabled:true});await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
 await cdp('Page.navigate',{url:'http://localhost:5173/game.html?pace=.05'});
 let ready=false;for(let i=0;i<160;i++){try{ready=await ev('!!window.game?.hud')}catch{}if(ready)break;await pause(150)}assert.ok(ready,'game loaded');

 const until=async exp=>{for(let i=0;i<240;i++){if(await ev(exp))return;await pause(80)}throw Error('Timed out: '+exp)};
 const click=async sel=>{const p=await ev(`(()=>{const r=document.querySelector('${sel}').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p})};

 await ev(`(async()=>{
 game.play.stop();game.presenter().dispose();document.querySelectorAll('.solo-dialog').forEach(e=>e.remove());
 const {Match,CARD}=await import('/src/game/solo/model.ts');
 window.hm=new Match(game.map.pack.scenario,17);
 hm.s.battleLog=[];hm.s.turn=5;hm.s.phase='action';hm.s.round=2;
 hm.battleContext=hm.beginBattle({kind:'card',by:1,card:'062',title:CARD.get('062').title});
 hm.recordReveal(1,['098'],'美国手牌');
 hm.battleContext=hm.beginBattle({kind:'card',by:0,card:'026',title:CARD.get('026').title});
 window.seen=['008','025','003','001','104','007','018','006'];
 hm.recordReveal(0,seen,'苏联手牌');
 hm.recordBattle({kind:'note',text:'美国使用 1 行动点'});
 hm.recordBattle({kind:'effect',text:'法国 · 美国影响力 1 → 2（+1）'});
 game.hud.resetCardMotion();game.hud.setState(hm.hudState(0),false);
 })()`);
 await click('.bl-open');await pause(600);
 assert.equal(await ev("document.querySelectorAll('.bl-reveal-card').length"),8);
 assert.deepEqual(await ev("[...document.querySelectorAll('.bl-reveal-card')].map(x=>x.dataset.card)"),['008','025','003','001','104','007','018','006']);
 const ink=await ev(`getComputedStyle(document.querySelector('.bl-reveal-card .term-influence')).color`);
 assert.equal(ink,'rgb(8, 99, 95)','card keyword ink remains readable on ivory');
 await shot('desktop');
 await ev(`seen.splice(0,seen.length,'098');game.hud.setState(hm.hudState(0),false)`);
 assert.deepEqual(await ev("[...document.querySelectorAll('.bl-reveal-card')].map(x=>x.dataset.card)"),['008','025','003','001','104','007','018','006']);
 await click('.bl-reveal-card[data-card="008"]');await until("document.querySelector('.bl-reveal-preview').open");await pause(400);
 assert.ok(await ev("document.querySelector('.bl-preview-face .slot').getBoundingClientRect().width>=400"));
 await shot('preview');
 await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await until("!document.querySelector('.bl-reveal-preview').open");assert.equal(await ev("document.querySelector('.bl-dialog').open"),true);
 assert.equal(await ev('document.activeElement.dataset.card'),'008');
 await ev(`document.querySelector('.bl-search').value='卡斯特罗';document.querySelector('.bl-search').dispatchEvent(new Event('input'))`);
 assert.equal(await ev("document.querySelectorAll('.bl-entry').length"),1);
 await ev(`document.querySelector('.bl-search').value='当时看到的美国手牌';document.querySelector('.bl-search').dispatchEvent(new Event('input'))`);
 assert.equal(await ev("document.querySelectorAll('.bl-entry').length"),0,'other player’s private reveals are not searchable');
 await ev(`document.querySelector('.bl-search').value='';document.querySelector('.bl-search').dispatchEvent(new Event('input'))`);
 await cdp('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:profile});await click('.bl-export');
 let file;for(let i=0;i<60;i++){file=(await readdir(profile)).find(f=>f.endsWith('.txt'));if(file)break;await pause(100)}assert.ok(file);
 const exported=await readFile(profile+'/'+file,'utf8');assert.match(exported,/当时看到的苏联手牌.*《卡斯特罗》/);assert.doesNotMatch(exported,/当时看到的美国手牌/);
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await ev(`document.querySelector('.bl-reveal-heading').scrollIntoView({block:'start'})`);await pause(500);await shot('mobile');
 const mobile=await ev(`(()=>{const n=document.querySelector('.bl-detail');return{w:n.clientWidth,sw:n.scrollWidth,r:document.querySelector('.bl-dialog').getBoundingClientRect().right}})()`);
 assert.ok(mobile.sw<=mobile.w&&mobile.r<=390,JSON.stringify(mobile));
 await click('.bl-reveal-card[data-card="008"]');await until("document.querySelector('.bl-reveal-preview').open");await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:5,y:5});await pause(200);
 const bounds=await ev(`(()=>{const r=document.querySelector('.bl-reveal-preview').getBoundingClientRect(),b=document.querySelector('.bl-preview-close').getBoundingClientRect();return{left:r.left,right:r.right,bottom:r.bottom,closeTop:b.top}})()`);
 assert.ok(bounds.left>=0&&bounds.right<=390&&bounds.bottom<=844&&bounds.closeTop>=0,JSON.stringify(bounds));await shot('mobile-preview');
 await click('.bl-preview-close');await until("!document.querySelector('.bl-reveal-preview').open");
 // Empty selective reveal, persisted and shown explicitly rather than omitted.
 await ev(`hm.battleContext=hm.beginBattle({kind:'card',by:0,card:'104',title:'剑桥五杰'});hm.recordReveal(0,[],'对手计分牌');game.hud.setState(hm.hudState(0),false)`);
 await click('.bl-newest');await ev(`document.querySelector('.bl-reveal').scrollIntoView({block:'center'})`);
 assert.match(await ev("document.querySelector('.bl-reveal').textContent"),/当时没有符合条件的牌/);
 assert.equal(await ev("document.querySelectorAll('.bl-reveal-card').length"),0);
 await click('.bl-close');assert.equal(await ev("document.querySelector('.bl-dialog').open"),false);
 assert.equal(errors.length,0,JSON.stringify(errors));
 console.log('PASS snapshot gallery, card zoom, Escape/focus return, private search/export, empty reveal, desktop and phone layouts');
}finally{ws?.close();browser.kill('SIGTERM');await pause(700);await rm(profile,{recursive:true,force:true})}
