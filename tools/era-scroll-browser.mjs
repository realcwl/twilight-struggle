// Visual/state regression for the integrated 07 scroll. Use a disposable Chrome profile only.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const port=process.env.ERA_CDP_PORT??'9351', origin=process.env.ERA_ORIGIN??'http://127.0.0.1:5173';
const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let n=0;const pending=new Map(),errors=[];const pause=ms=>new Promise(r=>setTimeout(r,ms));
ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(JSON.stringify(d.error))):p.resolve(d.result);}else if(d.method==='Runtime.exceptionThrown')errors.push(d.params.exceptionDetails);};
const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
const until=async condition=>{for(let i=0;i<300;i++){try{if(await ev(condition))return;}catch(e){if(!/context|navigat|undefined/.test(e.message))throw e;}await pause(100);}throw Error('Timed out '+condition);};
const click=async selector=>{const r=await ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);for(const type of ['mouseMoved','mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,...r,button:'left',clickCount:1});};
const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(`/tmp/coldwar-era-check/${name}.png`,Buffer.from(r.data,'base64'));};
const show=async (patch,animate=false)=>ev(`game.hud.setState({...window.__eraState,...${JSON.stringify(patch)}},${animate})`);
const read=()=>ev(`(()=>{const p=document.querySelector('.ts');return{year:p.querySelector('.ts-year').textContent,era:p.querySelector('.ts-era').textContent,turn:p.querySelector('.ts-turn').textContent,phase:p.querySelector('.ph b').textContent,hint:p.querySelector('.ph span').textContent,pips:p.querySelectorAll('.rd-pip').length,current:p.querySelector('.rd-pip.now b')?.textContent??null,x:parseFloat(p.style.getPropertyValue('--x')),scene:[...p.querySelectorAll('.ts-scene')].findIndex(e=>e.classList.contains('now'))+1};})()`);
try{
 await mkdir('/tmp/coldwar-era-check',{recursive:true});await send('Page.enable');await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:origin+'/prototypes/era-pictures/?v=7&t=2&r=5&clean=1'});
 await until('!!document.querySelector(".ep-07 .p7-s.now")');await pause(1200);await shot('prototype-07');
 await send('Page.navigate',{url:origin+'/game.html?pace=.05'});await until('!!window.game?.hud && document.documentElement.dataset.ready==="true"');
 await until('!!document.querySelector(".solo-dialog[open]")');
 // Pause only this disposable test match; rendering uses the real HUD and scenario rules.
 await ev(`window.__eraState=structuredClone(game.hud.state);game.play.stop();game.presenter().dispose();document.querySelectorAll('dialog').forEach(d=>{d.close();d.remove()});`);
 for(const image of await ev(`Array.from(document.querySelectorAll('.ts-pic')).map(p=>getComputedStyle(p).backgroundImage.slice(5,-2))`))assert.equal((await fetch(image)).status,200);
 await show({turn:2,round:5,phase:'action',active:0,actionLimit:6});await pause(300);await shot('integrated-1955');
 assert.deepEqual(await read(),{year:'1955',era:'早期',turn:'2',phase:'你的行动轮',hint:'从手牌拖出一张牌',pips:6,current:'5',x:1.75,scene:2});
 await show({turn:5,round:3,phase:'action',active:1,actionLimit:7},true);await pause(1150);await shot('integrated-middle');
 assert.equal((await read()).year,'1967');assert.equal((await read()).scene,5);assert.equal((await read()).phase,'苏联行动中');
 await show({turn:10,round:7,phase:'action',active:0,actionLimit:7},true);await pause(1150);await shot('integrated-late');assert.equal((await read()).year,'1991');
 await show({turn:1,round:0,phase:'setup',active:0,actionLimit:6},false);assert.equal((await read()).year,'1945');assert.equal((await read()).current,null);
 await show({turn:4,round:0,phase:'headline',active:1,actionLimit:7});assert.equal((await read()).year,'1962');assert.equal((await read()).phase,'头条阶段');assert.equal((await read()).current,null);
 await show({turn:4,round:7,phase:'cleanup',active:1,actionLimit:7});assert.equal((await read()).year,'1965');assert.equal((await read()).current,null);
 await show({turn:2,round:8,phase:'action',active:0,actionLimit:8});assert.equal((await read()).pips,8);assert.equal((await read()).current,'8');assert.equal((await read()).year,'1956');
 await show({turn:2,round:3,phase:'end',active:1,actionLimit:6});assert.equal((await read()).year,'1953');assert.equal((await read()).phase,'对局结束');
 console.log('PASS: ten paintings, years, early/middle/late, both sides, all phases and extra rounds');
 // Restoring a save does not fly through previous years; reduced motion also suppresses scrolling.
 assert.equal(await ev('getComputedStyle(document.querySelector(".ts-roll")).transitionDuration'),'0s');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await show({turn:7,round:4,phase:'action',active:0,actionLimit:7},true);assert.equal(await ev('getComputedStyle(document.querySelector(".ts-roll")).transitionDuration'),'0s');
 await send('Emulation.setEmulatedMedia',{features:[]});
 await show({turn:2,round:5,phase:'action',active:0,actionLimit:6});
 for(const width of [1280,800,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:900,deviceScaleFactor:1,mobile:width===390});await pause(350);
  const r=await ev(`(()=>{const a=document.querySelector('.hud-tl').getBoundingClientRect(),b=document.querySelector('.hud-tr').getBoundingClientRect(),c=document.querySelector('.op').getBoundingClientRect();return{a:{left:a.left,right:a.right,top:a.top,bottom:a.bottom},overStatus:a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top,overHand:a.left<c.right&&a.right>c.left&&a.top<c.bottom&&a.bottom>c.top,overflow:document.querySelector('.ts-caption').scrollWidth>document.querySelector('.ts-caption').clientWidth+1}})()`);
  assert.ok(r.a.left>=0&&r.a.right<=width,JSON.stringify(r));assert.ok(!r.overStatus,JSON.stringify(r));assert.ok(!r.overHand,JSON.stringify(r));assert.ok(!r.overflow,JSON.stringify(r));
  console.log('layout',width,JSON.stringify(r));await shot('integrated-'+width);
 }
 await send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
 await click('[data-part="dial"]');await until('!!document.querySelector(".solo-menu[open]")');await click('.solo-menu button');
 await click('.sound-toggle');await until('document.querySelector(".sound-panel").matches(":popover-open")');await click('.sound-close');
 await ev('game.hud.setLanguage("en")');await show({turn:4,round:0,phase:'headline',active:0,actionLimit:7});
 assert.equal((await read()).phase,'Headline phase');await shot('integrated-english');
 // Exercise the actual renderer in each seat; active-side changes must not swap its quotation.
 const quotes=await ev(`(async()=>{
  const {Hud}=await import('/src/hud/Hud.ts');
  const out=[];
  for(const player of [0,1]){
   const container=document.createElement('div');document.body.append(container);
   const hud=Hud.create(container,{...game.hud.opts,player,lang:'zh'});
   for(let turn=1;turn<=10;turn++){
    const state={...__eraState,turn,round:1,phase:'action',active:player,actionLimit:turn<=3?6:7};
    hud.setState(state,false);
    const q=hud.root.querySelector('.ts-quote'),p=game.hud.opts.rules.timeline[turn-1],expected=p.quotes[player];
    const text=q.textContent,year=Number(expected.date.slice(0,4));
    hud.setState({...state,active:1-player},true);
    out.push({player,turn,text,match:q.querySelector('q').textContent===expected.text.zh,stable:q.textContent===text,
      fits:q.scrollWidth<=q.clientWidth+1,source:q.cite,dated:year>=p.years[0]&&year<=p.years[1],
      pipNumber:getComputedStyle(hud.root.querySelector('.rd-pip.now b')).display});
   }
   hud.dispose();container.remove();
  }
  return out;
 })()`);
 assert.equal(quotes.length,20);assert.equal(new Set(quotes.map(q=>q.text)).size,20);
 for(const q of quotes)assert.ok(q.match&&q.stable&&q.fits&&q.dated&&q.source.startsWith('https://')&&q.pipNumber==='none',JSON.stringify(q));
 console.log('PASS: all 20 dated quotes, player-faction selection, no swaps on opponent actions, no clipped Chinese text');
 await ev('game.hud.setLanguage("zh")');await show({turn:3,round:6,phase:'action',active:0,actionLimit:6});await shot('quote-kennedy');
 assert.deepEqual(errors,[]);console.log('PASS: responsive panel, menu, sound control, save restore, reduced motion and English');
}finally{ws.close();}
