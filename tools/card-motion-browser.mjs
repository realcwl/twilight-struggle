// Local visual regression: card journeys, resolving card readability, map hover and phone layout.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import assert from 'node:assert/strict';
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const profile=await mkdtemp('/tmp/card-flow-ui-');
const browser=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-port='+port,'--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--window-size=1600,1000','about:blank'],{stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));let ws;const errors=[];
try {
 let pages;for(let i=0;i<60;i++){try{pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();break}catch{await pause(100)}}
 assert.ok(pages);ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let n=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++n;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
 const ev=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 const shot=async name=>writeFile('/tmp/card-flow-ui-'+name+'.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await cdp('Emulation.setFocusEmulationEnabled',{enabled:true});await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
 await cdp('Page.navigate',{url:'http://localhost:5173/game.html?pace=.05'});
 let ready=false;for(let i=0;i<160;i++){try{ready=await ev('!!window.game?.hud')}catch{}if(ready)break;await pause(150)}assert.ok(ready,'game loaded');

 const until=async exp=>{for(let i=0;i<240;i++){if(await ev(exp))return;await pause(80)}throw Error('Timed out: '+exp)};
 const click=async sel=>{const p=await ev(`(()=>{const r=document.querySelector('${sel}').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p})};
 await ev(`(async()=>{
 game.play.stop();game.presenter().dispose();document.querySelectorAll('.solo-dialog').forEach(e=>e.remove());
 const {SoloGame}=await import('/src/game/solo/engine.ts');const {createSpotlight}=await import('/src/play/spotlight.ts');
 window.fxgame=new SoloGame({scenario:game.map.pack.scenario,lang:'zh',seed:12,onChange(s,m){game.hud.setState(s);game.map.setState(m)}});
 window.fixture=()=>{game.hud.resetCardMotion();game.hud.setState(fxgame.state,false);game.map.setState(fxgame.mapState)};
 window.fp=createSpotlight({container:document.getElementById('game'),map:game.map,hud:game.hud,cards:game.hud.opts.cards,lang:'zh',game:fxgame,pace:.3});
 fixture();window.done=false;game.hud.dealOpening().then(()=>done=true);
 })()`);
 await until("document.querySelectorAll('.hud-card-flight').length>=3");
 console.log('deal active', await ev("({flights:document.querySelectorAll('.hud-card-flight').length,hidden:document.querySelectorAll('[data-arriving]').length})"));await shot('deal');
 await until('done');assert.equal(await ev("document.querySelectorAll('.hud-card-flight,[data-arriving]').length"),0);
 await ev(`window.play={by:1,card:fxgame.card('025'),use:'event',verb:'event',points:3,pile:'removed'};window.done=false;fp.announce(play).then(()=>done=true)`);
 await until('done');await shot('resolution');
 console.log('card bounds', await ev("(()=>{const r=document.querySelector('.hr-card').getBoundingClientRect();return{w:r.width,h:r.height,y:r.y,b:r.bottom,piles:document.querySelector('.hud-bl').getBoundingClientRect().top}})()"));
 assert.ok(await ev("document.querySelector('.hr-card').getBoundingClientRect().width>260"),'readable resolving card');
 const readPoint=await ev("(()=>{const r=document.querySelector('.hr-card').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...readPoint});
 await ev('window.done=false;void fp.settle(play).then(()=>done=true)');await pause(3400);assert.equal(await ev('done'),false,'hover holds the card for reading');await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:800,y:400});await until("!!document.querySelector('.hud-card-flight')");await shot('removed');await until('done');
 assert.equal(await ev("document.querySelectorAll('.hr-entry').length"),0);
 await ev('window.discardPlay={...play,pile:"discard"};game.hud.showResolving(discardPlay)');await ev('window.done=false;void game.hud.settleResolving(discardPlay).then(()=>done=true)');await until("!!document.querySelector('.hud-card-flight')");await shot('discard');await until('done');
 await ev('fp.showHeadline({mine:"008",theirs:"025",order:[{by:1},{by:0}]})');await ev('fp.announce({...play,headline:true})');await shot('headline');assert.ok(await ev("document.querySelector('.hr-card').getBoundingClientRect().width>260"));
 await ev(`window.rollSpec={kind:'coup',by:0,card:'025',id:'nga',dice:[{side:0,value:6,mods:[{label:'行动点',n:3}],total:9}],bar:{label:'稳定度 1 × 2',n:2},need:1,chance:1,ok:true,text:'政变成功 · 净值 7',situation:{before:[0,1],after:[6,0],controlBefore:1,controlAfter:0,crisisBefore:4,crisisAfter:3}};window.rollDone=false;void fp.roll(rollSpec).then(()=>rollDone=true)`);
 await until("!!document.querySelector('.sp-dice.is-done')");
 const boxes=await ev("['.hr-card','.sp-country','.sp-math','.sp-verdict'].map(sel=>{const r=document.querySelector(sel).getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom}})");
 assert.ok(boxes[1].x>800 && boxes[0].right<boxes[1].x,'country result moves to the right of the card');
 assert.ok(boxes[2].bottom<boxes[3].y&&boxes[3].bottom<boxes[1].y,'dice result, formula and country panel have separate rows');
 await shot('coup-right');await until('rollDone');
 await ev('game.hud.resetCardMotion()');

 await ev(`fixture();window.hs=fxgame.state;game.hud.setState({...hs,deck:0,hand:hs.hand.slice(0,2),opponentHand:1,discard:['025','034','011']},false);window.done=false;game.hud.setState({...hs,hand:hs.hand.slice(0,4),opponentHand:3,deck:5,discard:[],deckRecycles:1});void game.hud.waitForCards().then(()=>done=true)`);
 await until("document.querySelector('.hud-card-notice').textContent.includes('洗回')");await pause(200);await shot('shuffle');await until('done');
 assert.equal(await ev("document.querySelectorAll('.hud-card-flight,[data-arriving]').length"),0);
 await ev("fp.dispose();game.hud.resetCardMotion();game.map.offer(null);game.map.select(null);game.map.flyTo('saharan');");await pause(1600);
 console.log('saharan',await ev("game.map.pack.countries.find(c=>c.id==='saharan')"));
 const hover=async id=>{const p=await ev(`(()=>{const r=document.querySelector('.wm-plate[data-id="${id}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await pause(500)};
 await hover('saharan');assert.equal(await ev("document.querySelector('.wm-plate[data-id=saharan]').classList.contains('primary')"),true);await shot('saharan');
 await ev("game.map.flyTo('nga')");await pause(1300);await hover('nga');assert.equal(await ev("document.querySelector('.wm-plate[data-id=nga]').classList.contains('primary')"),true);await shot('border');
 await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:5,y:500});await pause(500);assert.equal(await ev("document.querySelector('.wm-plate[data-id=nga]').classList.contains('primary')"),false);await shot('border-off');
 await ev(`window.logCard={id:100,turn:1,round:1,phase:'action',by:0,kind:'card',card:'025',verb:'event',title:'遏制',status:'resolved',lines:[]};window.logSystem={id:101,turn:1,round:1,phase:'cleanup',by:null,kind:'system',title:'回合结束',status:'resolved',lines:[]};game.hud.setState({...fxgame.state,played:null,battleLog:[logCard,logSystem]},false)`);
 assert.equal(await ev("document.querySelector('.bl-open .slot').dataset.card"),'025');await shot('journal-cover');
 await ev(`game.hud.setState({...fxgame.state,played:{card:'008',by:1},battleLog:undefined},false);game.hud.setState({...fxgame.state,played:null,battleLog:undefined},false)`);
 assert.equal(await ev("document.querySelector('.bl-open .slot').dataset.card"),'008','network frames keep the latest public action on the cover');
 await ev(`game.hud.setState({...fxgame.state,played:null,battleLog:[]},false)`);assert.equal(await ev("document.querySelector('.bl').classList.contains('has')"),false,'new game restores the empty journal');
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await ev('fixture();window.done=false;game.hud.showResolving(play).then(()=>done=true)');await until('done');await shot('mobile');
 assert.ok(await ev("(()=>{const r=document.querySelector('.hr-card').getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})()"),'mobile card within screen');
 await click('.hr-card');await pause(400);await shot('mobile-expanded');assert.ok(await ev("document.querySelector('.hr-card').getBoundingClientRect().width>285"));
 assert.equal(errors.length,0,JSON.stringify(errors));console.log('PASS deal, readable resolution, hover pause, discard/removal, headline, recycle, hover enter/leave, mobile expand, coup panel separation, latest-action log cover');
}finally{ws?.close();browser.kill('SIGTERM');await pause(700);await rm(profile,{recursive:true,force:true})}
