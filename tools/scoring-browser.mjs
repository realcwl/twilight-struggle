// Local regression: explicit UN selection, the scoring slip and what it leaves in the log, dynamic Taiwan badge.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import assert from 'node:assert/strict';
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const profile=await mkdtemp('/tmp/scoring-ui-');
const browser=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-port='+port,'--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--window-size=1600,1000','about:blank'],{stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));let ws;const errors=[];
try {
 let pages;for(let i=0;i<60;i++){try{pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();break}catch{await pause(100)}}
 assert.ok(pages);ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let n=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++n;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
 const ev=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 const shot=async name=>writeFile('/tmp/scoring-ui-'+name+'.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await cdp('Emulation.setFocusEmulationEnabled',{enabled:true});await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
 await cdp('Page.navigate',{url:'http://localhost:5173/game.html?pace=.05'});
 let ready=false;for(let i=0;i<160;i++){try{ready=await ev('!!window.game?.hud')}catch{}if(ready)break;await pause(150)}assert.ok(ready,'game loaded');

 const until=async exp=>{for(let i=0;i<240;i++){if(await ev(exp))return;await pause(80)}throw Error('Timed out: '+exp)};
 const click=async sel=>{const p=await ev(`(()=>{const r=document.querySelector('${sel}').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p})};
 await ev(`(async()=>{
 game.play.stop();game.presenter().dispose();document.querySelectorAll('.solo-dialog').forEach(e=>e.remove());
 const {SoloGame}=await import('/src/game/solo/engine.ts');const {createSpotlight}=await import('/src/play/spotlight.ts');
 const {completePresenter}=await import('/src/game/solo/presenter.ts');
 window.fxgame=new SoloGame({scenario:game.map.pack.scenario,lang:'zh',seed:12,onChange(s,m){game.hud.setState(s);game.map.setState(m)}});
 window.fixture=()=>{game.hud.resetCardMotion();game.hud.setState(fxgame.state,false);game.map.setState(fxgame.mapState)};
 window.makePresenter=()=>completePresenter(createSpotlight({container:document.getElementById('game'),map:game.map,hud:game.hud,cards:game.hud.opts.cards,lang:'zh',game:fxgame,pace:.5}),game.hud.opts.cards,()=>{});
 window.fp=makePresenter();fixture();
 window.choice=null;void fp.choose({title:'选择配合联合国干预的对手事件牌',options:[{id:'008',label:'卡斯特罗',card:'008'}]}).then(id=>choice=id);
 })()`);
 await until("!!document.querySelector('.solo-dialog[open] .solo-card-option')");await pause(900);
 assert.equal(await ev('choice'),null,'single eligible card still waits for explicit input');
 await shot('un-select');await click('[data-choice="008"]');await until("choice==='008'");
 await ev(`for(const id of fxgame.match.ids)fxgame.match.s.inf[id]=[0,0];fxgame.match.s.inf.twn=[3,0];fixture();game.map.flyTo('twn');`);await pause(1100);
 const badge=()=>ev(`(()=>{const n=document.querySelector('.wm-plate[data-id=twn]');return{key:n.classList.contains('key'),guns:n.querySelectorAll('.wm-battle').length,bg:getComputedStyle(n.querySelector('.wm-stab')).backgroundColor}})()`);
 const initial=await badge();assert.equal(initial.key,false);assert.equal(initial.guns,0);
 await ev('fxgame.match.s.flags.formosan=true;fixture()');await pause(300);const active=await badge();assert.equal(active.key,true);assert.equal(active.guns,1);assert.notEqual(active.bg,initial.bg);await shot('taiwan-active');
 await ev('fxgame.match.s.inf.twn=[3,1];fixture()');assert.deepEqual(await badge(),initial);
 await ev('fxgame.match.s.inf.twn=[3,0];fixture()');assert.equal((await badge()).guns,1);
 await ev('delete fxgame.match.s.flags.formosan;fixture()');assert.deepEqual(await badge(),initial);await shot('taiwan-restored');
 // The region card reads the same resolved summary as a scoring card, not raw map counts.
 await ev(`window.brief=game.hud.briefFor(game.map);window.regionFixture=()=>{fixture();brief.setState(fxgame.mapState)};
 for(const id of fxgame.match.ids)fxgame.match.s.inf[id]=[0,0];
 for(const id of ['jpn','kor','aus','twn','phl','idn'])fxgame.match.s.inf[id]=[fxgame.match.countries.get(id).stability,0];
 for(const id of ['pak','ind','prk','afg','mmr','lao','vnm'])fxgame.match.s.inf[id]=[0,fxgame.match.countries.get(id).stability];
 fxgame.match.s.flags.shuttle=true;regionFixture();game.map.select({kind:'region',id:'asia'});game.map.flyTo('asia',{fit:true});`);
 await pause(900);
 assert.deepEqual(await ev(`[...document.querySelectorAll('.bf-stand')].map(n=>n.textContent)`),['存在','存在']);
 assert.deepEqual(await ev(`[...document.querySelectorAll('.bf-held')].map(n=>[...n.querySelectorAll('b')].map(x=>Number(x.textContent)))`),[[6,2],[6,2]]);
 assert.match(await ev(`document.querySelector('.bf-score-totals').textContent`),/美国5VP苏联5VP净得 0 VP/);
 assert.match(await ev(`document.querySelector('.bf-scoring-note').textContent`),/穿梭外交/);
 assert.equal(await ev(`fxgame.match.has('shuttle')`),true,'preview does not consume the event');
 await shot('region-shuttle');
 await click('.bf-area-nav [data-area="southeast-asia"]');
 assert.equal(await ev(`document.querySelector('.hud-brief').dataset.area`),'southeast-asia');
 assert.equal(await ev(`document.querySelectorAll('.bf-scoring-note').length`),0);
 assert.match(await ev(`document.querySelector('.bf-score-totals').textContent`),/美国2VP苏联3VP苏联 净得 1/);
 await click('.bf-area-nav [data-area="asia"]');
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await pause(350);await shot('region-mobile');
 assert.ok(await ev(`(()=>{const e=document.querySelector('.hud-brief'),r=e.getBoundingClientRect();return r.left>=0&&r.right<=390&&e.scrollWidth<=e.clientWidth+1})()`),'resolved region preview fits mobile');
 await cdp('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
 await ev(`fxgame.match.score('asia');regionFixture()`);
 assert.deepEqual(await ev(`[...document.querySelectorAll('.bf-stand')].map(n=>n.textContent)`),['存在','支配']);
 assert.equal(await ev(`document.querySelectorAll('.bf-scoring-note').length`),0,'consumed modifiers disappear from the next preview');
 await ev('game.map.select(null)');
 await ev(`for(const id of fxgame.match.ids)fxgame.match.s.inf[id]=[0,0];for(const id of ['irn','isr','lbn'])fxgame.match.s.inf[id]=[fxgame.match.countries.get(id).stability,0];fxgame.match.s.inf.syr=[0,2];fixture();window.play={by:0,card:fxgame.card('003'),use:'event',verb:'event',points:0,pile:'discard'};window.done=false;void fp.announce(play).then(()=>{window.report=fxgame.match.scoring('mideast');return fp.score(report)}).then(()=>done=true);`);
 // ---- The slip (src/play/scoring.ts). It prints a line at a time, lands the result in the HUD's score
 // without touching the rules' score, and then waits for the player.
 const key=async(k,code,vk)=>{await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:k,code,windowsVirtualKeyCode:vk,...(k===' '?{text:' '}:{})});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:k,code,windowsVirtualKeyCode:vk})};
 const hover=async sel=>{const p=await ev(`(()=>{const r=document.querySelector('${sel}').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...p})};
 const waiting="document.querySelector('.sp-scoring')?.dataset.state==='waiting'";
 const slip=()=>ev("document.querySelector('.sp-scoring').innerText.replace(/\\s+/g,' ')");
 const leftovers=()=>ev("document.querySelectorAll('.sp-scoring,.play .sc-at,.play .sc-flash,.play .sc-wash,.play .sc-hudglow').length");
 await until(waiting);await pause(400);
 assert.equal(await ev('done'),false,'the slip waits for the player');
 let text=await slip();
 for(const want of [/中东计分/,/存在 3 · 支配 5 · 控制 7/,/美国 支配 5/,/控制 3 国 · 战场国 2\/6/,/伊朗 \+1/,/以色列 \+1/,/小计 7/,/苏联 存在 3/,/两边相抵 7 − 3/,/美国 净得 \+4/,/胜利点 平分 → 美国领先 4/,/继续/])assert.match(text,want);
 assert.equal(await ev('fxgame.match.s.vp'),0,'showing a scoring never mutates points');
 assert.match(await ev("document.querySelector('.hs-vp').textContent"),/\+4/,'the score is shown with the result counted in');
 await shot('slip');
 const overlap=await ev(`(()=>{const a=document.querySelector('.hr-card').getBoundingClientRect(),b=document.querySelector('.sp-scoring').getBoundingClientRect();return{cardRight:a.right,sheetLeft:b.left,sheetBottom:b.bottom,view:innerHeight}})()`);console.log('desktop layout',overlap);assert.ok(overlap.cardRight<overlap.sheetLeft&&overlap.sheetBottom<=overlap.view);
 const visible=await ev(`report.sides.flatMap(s=>s.countries).map(c=>{const r=document.querySelector('.wm-plate[data-id=\"'+c.id+'\"] .wm-plate-body').getBoundingClientRect();return{x:r.x,right:r.right,y:r.y,bottom:r.bottom}})`);assert.ok(visible.every(r=>r.x>overlap.cardRight&&r.right<overlap.sheetLeft&&r.y>0&&r.bottom<1000),'scored countries stay between the card and the slip');
 await pause(1600);assert.equal(await ev('done'),false,'no timer takes the slip away');
 // A rules word explains itself, beside the slip and not on it; a country shows itself and the map goes to it.
 await hover('.sp-scoring .sc-line.side .game-term[data-term]');await until("document.querySelector('#card-term-help')?.hidden===false");await pause(300);
 const help=await ev(`(()=>{const p=document.querySelector('#card-term-help').getBoundingClientRect();return{title:document.querySelector('#th-title').textContent,right:p.right,slipLeft:document.querySelector('.sp-scoring').getBoundingClientRect().left}})()`);
 assert.equal(help.title,'支配');assert.ok(help.right<=help.slipLeft,'the explanation stands beside the slip');await shot('slip-term');
 await hover('.sp-scoring .sc-line.item .game-term[data-country-ref]');await until("!!document.querySelector('.wm-stage').dataset.inspected");
 assert.equal(await ev("document.querySelector('.wm-stage').dataset.inspected"),await ev("document.querySelector('.sp-scoring .sc-line.item .game-term[data-country-ref]').dataset.countryRef"));
 await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:760,y:560});await until("document.querySelector('#card-term-help').hidden&&!document.querySelector('.wm-stage').dataset.inspected");
 // 明细: the reason in a sentence, and every country of that side
 assert.equal(await ev("document.querySelector('.sc-block.a .sc-more').hidden"),true);
 await click('.sc-block.a .sc-toggle');await pause(300);
 text=await ev("document.querySelector('.sc-block.a .sc-more').innerText.replace(/\\s+/g,' ')");for(const want of [/国家更多（3 对 1），战场国也更多（2 对 0）。/,/伊朗/,/以色列/,/黎巴嫩/])assert.match(text,want);
 assert.equal(await ev('done'),false);await shot('slip-more');
 // The space bar is "go on". The step that then applies those points has nothing left to show.
 await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:760,y:560});await key(' ','Space',32);await until('done');
 assert.equal(await leftovers(),0);
 const applied=await ev(`(async()=>{const m=fxgame.match,effect=m.apply(m.score('mideast')[0]);let caps=0;const ob=new MutationObserver(r=>{for(const x of r)for(const n of x.addedNodes)if(n.classList?.contains('sp-cap'))caps++});ob.observe(document.body,{childList:true,subtree:true});const t=performance.now();await fp.step(effect,()=>fixture(),{verb:'event',by:0,card:'003'});ob.disconnect();return{ms:performance.now()-t,caps,vp:m.s.vp,hud:document.querySelector('.hs-vp').textContent}})()`);
 console.log('the step after the slip',applied);assert.equal(applied.caps,0,'the score is not shown a second time');assert.ok(applied.ms<200);assert.equal(applied.vp,4);assert.match(applied.hud,/\+4/);
 // The battle log keeps the whole calculation, as a table.
 await ev("document.querySelector('.bl-open').click()");await until("!!document.querySelector('.bl-dialog[open] .bl-entry')");
 await ev("[...document.querySelectorAll('.bl-entry')].find(e=>/中东|VP/.test(e.textContent)).click()");await until("!!document.querySelector('.bl-detail .bl-sc')");
 text=await ev("[...document.querySelectorAll('.bl-detail .bl-sc')].find(t=>/中东计分/.test(t.textContent)).innerText.replace(/\\s+/g,' ')");
 for(const want of [/中东计分/,/美国 \+4 VP/,/控制的国家/,/国家更多（3 对 1），战场国也更多（2 对 0）/,/两边相抵：7 − 3 = 美国 \+4 VP/,/本区档位：存在 3 · 支配 5 · 控制 7/])assert.match(text,want);
 assert.equal(await ev("[...document.querySelectorAll('.bl-detail .bl-lines>li')].filter(li=>/控制国家：/.test(li.textContent)).length"),0,'the table replaces the lines that say the same in words');
 await shot('log');await ev("document.querySelector('.bl-close').click()");
 // Country by country: no standings.
 await ev(`fxgame.match.s.vp=0;fixture();game.hud.resetCardMotion();fp.dispose();fp=makePresenter();window.done=false;void fp.score(fxgame.match.scoring("southeast-asia")).then(()=>done=true)`);
 await until(waiting);assert.match(await slip(),/逐国计分，没有档位/);await shot('southeast-asia');await key('Enter','Enter',13);await until('done');
 // Europe held outright is a win, not a sum: said, landed, waited for; the score is left alone.
 await ev(`for(const id of ['fra','frg','gdr','pol','ita','gbr'])fxgame.match.s.inf[id]=[fxgame.match.countries.get(id).stability,0];fixture();window.done=false;void fp.score(fxgame.match.scoring('europe')).then(()=>done=true)`);
 await until(waiting);text=await slip();assert.match(text,/美国 控制欧洲 直接获胜/);assert.doesNotMatch(text,/两边相抵/);assert.equal(await ev("document.querySelectorAll('.sp-scoring .sc-vp').length"),0);await shot('europe-victory');
 assert.match(await ev("document.querySelector('.hs-vp').textContent"),/^胜利点0/,'a win by control shows no points');
 await click('.sp-scoring .sc-continue');await until('done');
 // The slip uses the same exclusion as the rules, including the Japan adjacency bonus.
 await ev(`for(const id of fxgame.match.ids)fxgame.match.s.inf[id]=[0,0];
 for(const id of ['jpn','prk'])fxgame.match.s.inf[id]=[0,fxgame.match.countries.get(id).stability];
 fxgame.match.s.flags.shuttle=true;fixture();window.done=false;
 void fp.score(fxgame.match.scoring('asia',false,{shuttleCountry:'jpn'})).then(()=>done=true)`);
 await until(waiting);text=await slip();assert.match(text,/邻接加分 −1/);assert.match(text,/苏联 净得 \+4/);assert.doesNotMatch(text,/日本 \+/,'the excluded country adds nothing');
 await click('.sc-block.b .sc-toggle');await pause(300);assert.match(await ev("document.querySelector('.sc-block.b .sc-more').innerText.replace(/\\s+/g,' ')"),/日本 本次不计/);
 await shot('shuttle-exclusion');await key(' ','Space',32);await until('done');
 // A click on the map while it prints cuts the sum short; the result still lands and still waits.
 await ev(`fixture();window.done=false;window.t0=performance.now();void fp.score(report).then(()=>done=true)`);
 await pause(700);await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:760,y:620});await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:760,y:620,button:'left',buttons:1,clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:760,y:620,button:'left',clickCount:1});
 await until(waiting);console.log('cut short, waiting after ms',await ev('Math.round(performance.now()-t0)'));assert.equal(await ev('done'),false);await key(' ','Space',32);await until('done');
 // The same slip fits on phones, docked at the bottom.
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await ev(`fp.dispose();fp=makePresenter();fixture();window.done=false;void fp.score(report).then(()=>done=true)`);
 await until(waiting);await pause(300);await shot('mobile');
 const mobile=await ev(`(()=>{const n=document.querySelector('.sp-scoring'),r=n.getBoundingClientRect(),b=n.querySelector('.sc-continue').getBoundingClientRect();return{left:r.left,right:r.right,bottom:r.bottom,overflow:n.scrollWidth>n.clientWidth+1,button:b.top>=0&&b.bottom<=innerHeight}})()`);console.log('mobile layout',mobile);assert.ok(mobile.left>=0&&mobile.right<=390&&mobile.bottom<=844&&!mobile.overflow&&mobile.button);
 await click('.sp-scoring .sc-continue');await until('done');
 await cdp('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
 // A stage run faster than anyone reads (the suites' pace) goes on by itself: nobody is there to press.
 await ev(`(async()=>{fp.dispose();const {createSpotlight}=await import('/src/play/spotlight.ts');const {completePresenter}=await import('/src/game/solo/presenter.ts');fp=completePresenter(createSpotlight({container:document.getElementById('game'),map:game.map,hud:game.hud,cards:game.hud.opts.cards,lang:'zh',game:fxgame,pace:.05}),game.hud.opts.cards,()=>{});fixture();window.done=false;void fp.score(report).then(()=>done=true)})()`);
 await until('done');assert.equal(await leftovers(),0,'an unattended stage completes without interaction');
 // Reduced motion: the same words, the same wait, nothing flying or flashing.
 await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await ev(`fp.dispose();fp=makePresenter();fixture();window.moved=0;window.ob=new MutationObserver(r=>{for(const x of r)for(const n of x.addedNodes)if(n.classList&&['sc-pip','sc-flash','sc-wash','sc-rays','sc-trail','sc-spark'].some(c=>n.classList.contains(c)))moved++});ob.observe(document.body,{childList:true,subtree:true});window.done=false;void fp.score(report).then(()=>done=true)`);
 await until(waiting);assert.equal(await ev('moved'),0);assert.match(await slip(),/美国 净得 \+4/);await key(' ','Space',32);await until('done');await ev('ob.disconnect()');
 await cdp('Emulation.setEmulatedMedia',{features:[]});
 // Taken away in the middle: it stops, and nothing is left on the stage or on the map.
 await ev(`fixture();window.aborted=false;void fp.score(report).catch(e=>{if(e.aborted)aborted=true;else throw e})`);await until("!!document.querySelector('.sp-scoring .sc-line')");await ev('fp.dispose()');await until('aborted');
 assert.equal(await leftovers(),0);
 assert.equal(errors.length,0,JSON.stringify(errors));console.log('PASS resolved region previews, Shuttle exclusion and consumption, explicit card choice, dynamic Taiwan badge, the scoring slip (prints, lands, waits, explains, goes on), the quiet step after it, the log table, win by control, cut short, responsive layout, unattended, reduced motion, disposal');
}finally{ws?.close();browser.kill('SIGTERM');await pause(700);await rm(profile,{recursive:true,force:true})}
