// Integration regression. Point HISTORY_CDP_PORT at a disposable Chrome profile.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const port=process.env.HISTORY_CDP_PORT,origin=process.env.HISTORY_ORIGIN??'http://127.0.0.1:5173';
assert.ok(port,'Supply the private test browser port');
const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let n=0;const pending=new Map(),errors=[];const pause=ms=>new Promise(r=>setTimeout(r,ms));
ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(JSON.stringify(d.error))):p.resolve(d.result);}else if(d.method==='Runtime.exceptionThrown')errors.push(d.params.exceptionDetails);};
const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
const until=async condition=>{for(let i=0;i<200;i++){try{if(await ev(condition))return;}catch(e){if(!/context|navigat/.test(e.message))throw e;}await pause(100);}throw Error('Timed out '+condition);};
const point=selector=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
const hover=async selector=>{await send('Input.dispatchMouseEvent',{type:'mouseMoved',...await point(selector)});await pause(320);};
const click=async selector=>{const p=await point(selector);for(const type of ['mouseMoved','mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,...p,button:'left',clickCount:1});};
const key=async key=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,windowsVirtualKeyCode:{Escape:27,Enter:13,' ':32,ArrowRight:39}[key]});await send('Input.dispatchKeyEvent',{type:'keyUp',key});};
const pane='#card-term-help';
const story=()=>ev(`document.querySelector('${pane} .th-history-prose')?.textContent`);
const isOpen=()=>ev(`document.querySelector('${pane}').matches(':popover-open')`);
const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(`/tmp/coldwar-card-history/${name}.png`,Buffer.from(r.data,'base64'));};
try{
 await mkdir('/tmp/coldwar-card-history',{recursive:true});await send('Page.enable');await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Emulation.setFocusEmulationEnabled',{enabled:true});
 const testUrl=origin+'/game.html?pace=.05&historyCheck='+Date.now();
 await send('Page.navigate',{url:testUrl});
 await until(`location.href===${JSON.stringify(testUrl)} && !!window.game?.presenter?.()`);
 await ev(`(async()=>{game.play.stop();game.presenter().dispose();document.querySelectorAll('dialog').forEach(d=>d.close());
  window.historyCards=await import('/src/cards/deck.ts');
  // Reuse Vite's loaded module URL, including an HMR timestamp, rather than mounting a second singleton.
  const libraryUrl=performance.getEntriesByType('resource').find(r=>new URL(r.name).pathname==='/src/cards/library.ts').name;
  window.historyLibrary=(await import(libraryUrl)).mountCardLibrary({trigger:false});
  const s=game.play.match.s;s.hands[0]=['106','008','077','100','004'];s.discard=['008','106'];s.played=null;
  game.hud.setState(game.play.state,false);game.map.setState(game.play.mapState);game.hud.hoverCard('008');})()`);
 await pause(600);const hand='.hd-card.is-up [data-card-history="8"]';
 // Inspecting a card is not itself a help target, including during the opponent's turn.
 const ordinaryAreas=[['artwork','.card-art',.5,.5],['blank paper','.card-paper',.5,.75],['title padding','.card-banner',.04,.5],['border','.game-card',.015,.4]];
 for(const readonly of [false,true]){
  await ev(`document.querySelector('.hud').classList.toggle('play-readonly',${readonly});game.hud.hoverCard('008')`);await pause(300);
  for(const [label,selector,rx,ry] of ordinaryAreas){
   const p=await ev(`(()=>{const r=document.querySelector('.hd-card.is-up ${selector}').getBoundingClientRect();return{x:r.x+r.width*${rx},y:r.y+r.height*${ry}}})()`);
   await send('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await pause(320);
   const hit=await ev(`(()=>{const e=document.elementFromPoint(${p.x},${p.y});return{card:!!e.closest('.hd-card'),help:!!e.closest('[data-card-history],.game-term'),cursor:getComputedStyle(e).cursor}})()`);
   assert.ok(hit.card,`${label} hits the card`);assert.equal(hit.help,false,label);assert.notEqual(hit.cursor,'help',`${label}, readonly=${readonly}`);assert.equal(await isOpen(),false,label);
  }
  await hover(hand);await until(`!!document.querySelector('${pane}:popover-open .th-history-prose')`);
  assert.equal(await ev(`getComputedStyle(document.querySelector('${hand}')).cursor`),'help');
  await hover('.hd-card.is-up .card-art');assert.equal(await isOpen(),false,'leaving title for artwork dismisses history');
  await hover('.hd-card.is-up [data-term="influence"]');assert.ok(await isOpen());
  assert.equal(await ev(`getComputedStyle(document.querySelector('.hd-card.is-up [data-term="influence"]')).cursor`),'help');
  await hover('.hd-card.is-up .card-art');assert.equal(await isOpen(),false,'leaving term for artwork dismisses explanation');
 }
 console.log('PASS: only title and highlighted terms use help cursor/open explanations, in playable and readonly hands');
 await hover(hand);await until(`!!document.querySelector('${pane}:popover-open .th-history-prose')`);
 assert.match(await story(),/蒙卡达.*巴蒂斯塔.*猪湾/s);
 assert.equal(await ev(`getComputedStyle(document.querySelector('${hand}')).cursor`),'help');
 assert.equal(await ev(`getComputedStyle(document.querySelector('${hand}')).outlineStyle`),'none');
 await until(`document.querySelector('${pane} img')?.naturalWidth>0`);
 await hover('.th-history-lead');await pause(500);
 assert.ok(await isOpen());assert.ok(await ev(`!!document.querySelector('${hand}')`),'hand stays raised while reading');
 assert.equal(await ev("document.querySelectorAll('.hd-card.is-drag,.hud.is-armed').length"),0);
 assert.equal(await ev(`document.querySelector('${pane} video').hasAttribute('src')`),false);
 await shot('hand-castro');await key('Escape');assert.equal(await isOpen(),false);
 // The same card's ordinary term and historical title share one pane without stale content.
 await ev("game.hud.hoverCard('008')");await pause(300);await hover('.hd-card.is-up [data-term="influence"]');
 assert.equal(await ev(`document.querySelector('${pane} .th-media').hidden`),false);
 await hover(hand);await until(`!!document.querySelector('${pane}:popover-open .th-history-prose')`);
 assert.equal(await ev(`document.querySelector('${pane} .th-media').hidden`),true);
 await click(hand);assert.equal(await ev("document.querySelectorAll('.hd-card.is-drag,.hud.is-armed').length"),0);await key('Escape');
 // Every canonical card reaches its own story through the real title focus handler.
 await ev("historyLibrary.open('001')");
 const count=await ev(`(async()=>{let count=0;for(const c of historyCards.CARDS){await historyLibrary.open(c.id);const title=document.querySelector('.cl-detail-stage [data-card-history]');title.focus();await new Promise(r=>setTimeout(r,10));const p=document.querySelector('${pane}');if(p.hidden||!p.classList.contains('th-history-help')||!p.querySelector('.th-history-prose')||p.querySelector('#th-title').textContent!==c.title)throw Error('Missing story '+c.id);count++;}return count})()`);
 assert.equal(count,110);console.log('PASS: all 110 titles, including scoring, China and optional cards, open distinct stories');
 await ev("historyLibrary.open('008')");await pause(200);await hover('.cl-detail-stage [data-card-history]');
 assert.ok(await ev(`document.querySelector('${pane}').closest('dialog')?.open`));
 await click('.th-history-sources summary');assert.ok(await ev("document.querySelector('.th-history-sources').open"));
 await key('ArrowRight');assert.equal(await ev("document.querySelector('.cl-detail-stage [data-card-history]').dataset.cardHistory"),'8');
 await shot('library-castro');await key('Escape');assert.equal(await isOpen(),false);assert.ok(await ev("document.querySelector('#card-library').open"));
 // Keyboard Enter/Space, closing only the guide, and returning focus to the title.
 await ev("document.querySelector('.cl-detail-stage [data-card-history]').focus()");await key('Enter');assert.ok(await isOpen());
 assert.equal(await ev("document.activeElement.className"),'th-close');await key('Escape');
 assert.equal(await ev("document.activeElement.dataset.cardHistory"),'8');await key(' ');assert.ok(await isOpen());await click('.th-close');await click('.cl-close');
 // Pile browser uses the same title renderer and doesn't close when the guide opens.
 await click('.hp-discard');await pause(350);await hover('.pb [data-card-history="106"]');await until(`!!document.querySelector('${pane}:popover-open .th-history-prose')`);
 assert.match(await story(),/1957.*1958/s);await hover('.th-history-lead');await pause(400);assert.ok(await isOpen());await key('Escape');await click('.pb-x');
 // A passive card stays expanded while the history pane is read.
 await ev(`(async()=>{const {trackPassive}=await import('/src/game/solo/passives.ts');const s=game.play.match.s;s.flags.norad=true;s.played=null;trackPassive(s,'106',1,'norad',false);game.hud.setState(game.play.state,false)})()`);
 await hover('.ps-theirs [data-passive-card="106"]');await until("!document.querySelector('.ps-detail').hidden");
 await hover('.ps-detail [data-card-history="106"]');await until(`!!document.querySelector('${pane}:popover-open .th-history-prose')`);
 await hover('.th-history-lead');await pause(400);assert.equal(await ev("document.querySelector('.ps-detail').hidden"),false);await shot('passive-norad');await key('Escape');await key('Escape');
 // Small-screen reading and actual touch: long history scrolls within a bounded pane.
 await ev("historyLibrary.open('094')");await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Emulation.setTouchEmulationEnabled',{enabled:true});await pause(350);
 const p=await point('.cl-detail-stage [data-card-history]');await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await until(`!!document.querySelector('${pane}:popover-open .th-history-prose')`);await until(`document.querySelector('${pane} img')?.naturalWidth>0`);
 const bounds=await ev(`(()=>{const p=document.querySelector('${pane}'),r=p.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,overflow:p.scrollHeight>p.clientHeight}})()`);
 assert.ok(bounds.left>=0&&bounds.right<=390&&bounds.top>=0&&bounds.bottom<=844,JSON.stringify(bounds));
 await ev(`document.querySelector('${pane}').scrollTop=10000`);await pause(100);assert.ok(await isOpen());await shot('mobile-history');
 await click('.th-close');assert.equal(await isOpen(),false);assert.ok(await ev("document.querySelector('#card-library').open"));
 await send('Emulation.setTouchEmulationEnabled',{enabled:false});
 await send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});await click('.cl-close');
 assert.deepEqual(errors,[]);
 console.log('PASS: hover, retained hand, term switching, click, keyboard, modal, discard, passive, mobile touch and scrolling; no page exceptions');
}catch(error){console.error(await ev(`JSON.stringify({width:innerWidth,height:innerHeight,dialog:document.querySelector('#card-library')?.open,help:document.querySelector('#card-term-help')?.hidden})`));await shot('failure');throw error;}finally{ws.close();}
