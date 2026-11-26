// Local regression: a card an effect moves is said by its flight alone (lifted out of the real place it
// leaves, set down on the real place that receives it), paces itself, and keeps its words in the battle log.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import assert from 'node:assert/strict';
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const profile=await mkdtemp('/tmp/card-transfer-ui-');
const browser=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-port='+port,'--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--window-size=1600,1000','about:blank'],{stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));let ws;const errors=[];
try {
 let pages;for(let i=0;i<60;i++){try{pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();break}catch{await pause(100)}}
 assert.ok(pages);ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let n=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++n;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
 const ev=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 const shot=async name=>writeFile('/tmp/card-transfer-ui-'+name+'.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await cdp('Emulation.setFocusEmulationEnabled',{enabled:true});await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
 await cdp('Page.navigate',{url:'http://localhost:5173/game.html?pace=.05'});
 let ready=false;for(let i=0;i<160;i++){try{ready=await ev('!!window.game?.hud')}catch{}if(ready)break;await pause(150)}assert.ok(ready,'game loaded');

 const until=async exp=>{for(let i=0;i<240;i++){if(await ev(exp))return;await pause(80)}throw Error('Timed out: '+exp)};
 const click=async sel=>{const p=await ev(`(()=>{const r=document.querySelector('${sel}').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p})};

 await ev(`(async()=>{
 game.play.stop();game.presenter().dispose();document.querySelectorAll('.solo-dialog').forEach(e=>e.remove());
 const {SoloGame}=await import('/src/game/solo/engine.ts');const {createSpotlight}=await import('/src/play/spotlight.ts');
 window.cg=new SoloGame({scenario:game.map.pack.scenario,lang:'zh',seed:12,onChange(s,m){game.hud.setState(s);game.map.setState(m)}});
 game.hud.resetCardMotion();game.hud.setState(cg.state,false);
 window.makeP=(pace=1)=>createSpotlight({container:document.getElementById('game'),map:game.map,hud:game.hud,cards:game.hud.opts.cards,lang:'zh',game:cg,pace});
 window.cp=makeP();window.commitCount=0;window.done=false;
 window.transfer={card:'006',source:'071',from:{hand:1},to:{hand:0},reason:'中国牌转移 · 下回合可用'};
 window.flightsSeen=0;window.flightWatch=new MutationObserver(rs=>{for(const r of rs)for(const n of r.addedNodes)if(n instanceof Element&&n.matches('.hud-card-flight'))flightsSeen++});flightWatch.observe(document.getElementById('game'),{childList:true,subtree:true});
 window.started=performance.now();
 void cp.cardMove(transfer,()=>{commitCount++;cg.match.s.china={owner:0,available:false};game.hud.setState(cg.state)}).then(()=>{window.duration=performance.now()-started;done=true});
 })()`);
 await until("!!document.querySelector('.hud-card-flight[data-move]')");
 const flight=await ev(`(()=>{const n=document.querySelector('.hud-card-flight[data-move]');return{pointer:getComputedStyle(n).pointerEvents,card:n.dataset.move,veil:!!document.querySelector('.sp-veil.is-on'),panel:!!document.querySelector('.sp-card-move,[data-cm]'),caption:!!document.querySelector('.cm-cue'),handUp:document.querySelector('.hud').classList.contains('is-receiving')}})()`);
 assert.ok(flight.pointer==='none'&&!flight.veil&&!flight.panel&&!flight.caption&&flight.handUp,JSON.stringify(flight));
 assert.equal(flight.card,'006');
 // A card coming into this hand is committed at take-off, so that the hand makes room for it.
 assert.equal(await ev('commitCount'),1);
 await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:800,y:800});
 await shot('desktop');await until('done');
 assert.equal(await ev('commitCount'),1);
 assert.ok(await ev('duration>=500&&duration<1400'),'one short journey, no reading delay');
 await until("document.querySelectorAll('.hud-card-flight').length===0");
 assert.equal(await ev('flightsSeen'),1,'explicit transfer does not also produce a guessed deck flight');
 assert.equal(await ev("document.querySelectorAll('.cm-cue,.cm-flight').length"),0,'no caption: the motion says it, the log keeps the words');
 // Subsequent movements finish automatically, in order, without an extra acknowledgement.
 await ev(`window.order=[];window.done=false;window.started=performance.now();void(async()=>{await cp.cardMove({...transfer,card:'071',source:'049',from:{hand:1},to:{play:0},reason:'拿取对手最高行动点牌 · 随后执行事件'},()=>order.push('taken'));await cp.cardMove(transfer,()=>order.push('china'));window.duration=performance.now()-started;done=true})()`);
 await until('done');assert.deepEqual(await ev('order'),['taken','china']);await ev('flightWatch.disconnect()');
 assert.ok(await ev('duration<2400'),'two movements do not add reading screens');
 // A card set down on the table stands where its resolving card will be shown, until that card is shown.
 assert.equal(await ev("document.querySelectorAll('.hud-card-flight[data-move=\"071\"]').length"),1);
 await ev('game.hud.resetCardMotion()');assert.equal(await ev("document.querySelectorAll('.hud-card-flight').length"),0);
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await ev(`window.done=false;void cp.cardMove(transfer,()=>{}).then(()=>done=true)`);await until("!!document.querySelector('.hud-card-flight[data-move]')");
 // Lifted and held, the card is wholly on a phone's screen.
 const phone=await ev(`(()=>{const n=document.querySelector('.hud-card-flight[data-move]'),all=n.getAnimations({subtree:true});all.forEach(a=>{a.pause();a.currentTime=220});const r=n.getBoundingClientRect();all.forEach(a=>a.play());return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width}})()`);
 await shot('phone');await until('done');
 assert.ok(phone.left>=0&&phone.right<=390&&phone.top>=0&&phone.bottom<=844&&phone.width>=110,JSON.stringify(phone));
 await cdp('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
 await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await ev(`window.done=false;window.started=performance.now();void cp.cardMove(transfer,()=>{}).then(()=>{window.duration=performance.now()-started;done=true})`);
 await until('done');assert.ok(await ev('duration<200'),'reduced motion commits immediately, without a forced read');
 await cdp('Emulation.setEmulatedMedia',{features:[]});
 await ev(`window.done=false;window.started=performance.now();void cp.cardMove(transfer,()=>{}).then(()=>{window.duration=performance.now()-started;done=true})`);
 await until("!!document.querySelector('.hud-card-flight[data-move]')");await ev('cp.skip()');await until('done');assert.ok(await ev('duration<500'),'skip completes the flight');
 // A move that commits on landing (anything but a card coming into this hand) is not applied when cut off.
 await ev(`window.aborted=false;window.cancelledCommit=false;void cp.cardMove({...transfer,card:'071',source:'049',from:{hand:1},to:'discard',reason:'弃牌'},()=>{cancelledCommit=true}).catch(e=>{if(e.aborted)aborted=true;else throw e})`);
 await until("!!document.querySelector('.hud-card-flight[data-move]')");await ev('cp.dispose()');await until('aborted');
 assert.equal(await ev('cancelledCommit'),false,'disposing a flight never applies its pending move');
 assert.equal(await ev("document.querySelectorAll('.hud-card-flight').length"),0);
 // Run the real nested event through the existing game presenter, not just standalone animation calls.
 await cdp('Emulation.setEmulatedMedia',{features:[]});
 await ev(`(async()=>{
 const {SoloGame}=await import('/src/game/solo/engine.ts');const {createSpotlight}=await import('/src/play/spotlight.ts');
 const {completePresenter}=await import('/src/game/solo/presenter.ts');
 window.cg=new SoloGame({scenario:game.map.pack.scenario,lang:'zh',seed:12,onChange(s,m){game.hud.setState(s);game.map.setState(m)},onCheckpoint(){cg.stop()}});
 const s=cg.match.s;Object.assign(s,{phase:'action',active:0,turn:5,round:1});s.deck.push(...s.hands[1]);s.hands[1]=[];
 for(const [id,side] of [['049',0],['071',1]]){for(const p of [...s.hands,s.deck,s.future,s.removed,s.discard]){const at=p.indexOf(id);if(at>=0)p.splice(at,1)}s.hands[side].push(id)}
 game.hud.resetCardMotion();game.hud.setState(cg.state,false);
 window.cp=completePresenter(createSpotlight({container:document.getElementById('game'),map:game.map,hud:game.hud,cards:game.hud.opts.cards,lang:'zh',game:cg,pace:.1}),game.hud.opts.cards,()=>{});
 cp.decide=async()=>({card:'049',use:'event'});
 window.seenMoves=[];window.observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node instanceof Element&&node.matches('.hud-card-flight[data-move]'))seenMoves.push(node.dataset.move)});
 observer.observe(document.getElementById('game'),{childList:true,subtree:true});
 window.matchDone=false;void cg.start(cp).then(()=>matchDone=true);
 })()`);
 await until('matchDone');await ev('observer.disconnect()');assert.deepEqual(await ev('seenMoves'),['071','006'],'the resolving Envy card uses its existing settle flight only');
 assert.deepEqual(await ev('cg.match.s.china'),{owner:0,available:false});
 assert.equal(await ev("cg.match.s.hands[1].includes('049')"),true);
 const history=await ev("cg.match.s.battleLog.filter(e=>e.card).map(e=>({card:e.card,moves:e.lines.filter(l=>l.kind==='move').map(l=>l.move.card)}))");
 assert.deepEqual(history,[{card:'049',moves:['071','049']},{card:'071',moves:['006']}]);
 await ev('cp.dispose()');
 await click('.bl-open');await pause(300);
 assert.match(await ev("document.querySelector('.bl-detail').textContent"),/苏联手牌 → 美国手牌.*下回合可用/);
 await shot('history');await click('.bl-close');
 assert.equal(errors.length,0,JSON.stringify(errors));console.log('PASS card moves said by one flight each: no caption, no panel, one commit, hand comes up, a card set down on the table stands in for its resolving card, sequential events, no duplicate settle, phone, reduced motion, skip/disposal and exact movement history');
}finally{ws?.close();browser.kill('SIGTERM');await pause(700);await rm(profile,{recursive:true,force:true})}
