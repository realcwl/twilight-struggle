// Real DOM gestures through the deterministic tutorial, isolated from the user's saves/rooms.
// Start Vite and a private headless Chrome on TUTORIAL_CDP_PORT (default 9348).
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const origin=process.env.TUTORIAL_ORIGIN??'http://127.0.0.1:5173';
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const port=process.env.TUTORIAL_CDP_PORT??9348;
const locale=process.env.TUTORIAL_LANG??'zh';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const errors=[],seen=[],checks=[];
async function connect(url){const ws=new WebSocket(url);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let n=0;const pending=new Map();ws.addEventListener('message',e=>{const d=JSON.parse(e.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(d.error):p.resolve(d.result);}else if(d.method==='Runtime.exceptionThrown')errors.push(d.params.exceptionDetails);else if(d.method==='Runtime.consoleAPICalled'&&d.params.type==='error')errors.push(d.params.args);});return{call:(method,params={})=>new Promise((resolve,reject)=>{const id=++n;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));}),close:()=>ws.close()};}
const version=await(await fetch(`http://127.0.0.1:${port}/json/version`)).json();
const browser=await connect(version.webSocketDebuggerUrl);
const {browserContextId}=await browser.call('Target.createBrowserContext');
let client;
try{
 const {targetId}=await browser.call('Target.createTarget',{url:'about:blank',browserContextId});
 const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();client=await connect(pages.find(t=>t.id===targetId).webSocketDebuggerUrl);
 const cdp=(m,p)=>client.call(m,p);
 const ev=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const until=async(expr,ms=30000)=>{for(let i=0;i<ms/100;i++){if(await ev(expr))return;await delay(100);}throw Error('Timeout '+expr);};
 const mouse=(type,p,buttons=0)=>cdp('Input.dispatchMouseEvent',{type,...p,button:buttons||type!=='mouseMoved'?'left':'none',buttons,clickCount:1});
 const point=selector=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('missing '+${JSON.stringify(selector)});const r=e.getBoundingClientRect();for(const fy of [.5,.15,.8])for(const fx of [.5,.3,.7,.1,.9]){const x=Math.max(1,Math.min(innerWidth-2,r.x+r.width*fx)),y=Math.max(1,Math.min(innerHeight-2,r.y+r.height*fy));const t=document.elementFromPoint(x,y);if(t&&(t===e||e.contains(t)))return{x,y};}return{x:r.x+r.width/2,y:Math.min(innerHeight-20,r.y+30)}})()`);
 const click=async s=>{const p=await point(s);await mouse('mouseMoved',p);await mouse('mousePressed',p,1);await mouse('mouseReleased',p);await delay(180);};
 const key=async key=>{for(const type of ['keyDown','keyUp'])await cdp('Input.dispatchKeyEvent',{type,key,code:key==='Escape'?'Escape':key,windowsVirtualKeyCode:key==='Escape'?27:0});await delay(100);};
 const drag=async id=>{const s=`.hd-hit[data-card="${id}"]`;let p=await point(s);await mouse('mouseMoved',p);await delay(350);p=await point(s);await mouse('mousePressed',p,1);for(let i=1;i<=12;i++){await mouse('mouseMoved',{x:p.x+(800-p.x)*i/12,y:p.y+(470-p.y)*i/12},1);await delay(22);}await delay(150);await mouse('mouseReleased',{x:800,y:470});await delay(350);};
 const shot=async name=>{const r=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(`/tmp/tutorial-${name}.png`,Buffer.from(r.data,'base64'));};
 await cdp('Runtime.enable');await cdp('Page.enable');
 await cdp('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
 await cdp('Page.navigate',{url:origin+'/online.html?lang='+locale});await until("!!document.querySelector('#tutorial-start')");
 assert.equal(await ev("document.querySelector('#tutorial-start').getAttribute('href')"),'./game.html?tutorial=1');
 await ev("localStorage.setItem('coldwar.solo.v1.coldwar','tutorial-isolation-sentinel');localStorage.setItem('coldwar.room.v1','room-isolation-sentinel')");
 await delay(1200);await click('#tutorial-start');await until("document.querySelector('.tutorial-coach')?.dataset.step==='welcome'");
 // Speed only existing presentation delays; scripted game still uses its real seeded RNG.
 await cdp('Page.navigate',{url:origin+'/game.html?tutorial=1&pace=.05'});await until("document.querySelector('.tutorial-coach')?.dataset.step==='welcome'");
 checks.push('homepage tutorial entry starts independent guided match');
 if(locale!=='zh'){
  const before=await ev('JSON.stringify(game.play.snapshot)');
  const other=locale==='en'?'es':'en';
  await click('.language-button');await click(`[data-language="${other}"]`);
  await until(`document.documentElement.lang==='${other}'&&document.querySelector('.tutorial-coach')?.dataset.step==='welcome'`);
  assert.equal(await ev('JSON.stringify(game.play.snapshot)'),before);
  await click('.language-button');await click(`[data-language="${locale}"]`);
  await until(`document.documentElement.lang==='${locale}'&&document.querySelector('.tutorial-coach')?.dataset.step==='welcome'`);
  assert.equal(await ev('JSON.stringify(game.play.snapshot)'),before);
  checks.push('tutorial language switch preserves its independent checkpoint');
 }
 let previous='',same=0,reloaded=false,badTested=false,actionChecks=0;const testedVideos=new Set();
 const began=Date.now();
 while(Date.now()-began<360000){
  const state=await ev(`(()=>{const c=document.querySelector('.tutorial-coach:not([hidden])');return c?{id:c.dataset.step,mode:c.dataset.mode,body:c.innerText,choices:[...c.querySelectorAll('[data-choice]')].map(e=>e.dataset.choice),step:game.play.snapshot.actions,turn:game.play.snapshot.turn}:null})()`);
  if(!state){await delay(250);continue;}
  if(locale!=='zh')assert.doesNotMatch(state.body,/\p{Script=Han}/u,'untranslated tutorial '+state.id);
  assert.notEqual(state.id,'recovery','tutorial must not enter recovery: '+JSON.stringify(errors));
  if(state.id!==previous){console.log(state.id);seen.push(state.id);previous=state.id;same=0;}else if(++same>24)throw Error('stuck '+JSON.stringify(state));
  await delay(300);
  if(state.id==='victory'){
   await until("document.querySelector('.tc-media video').readyState>=2");assert.equal(await ev('document.querySelector(".tc-media video").error'),null);checks.push('existing local explainer video decodes');await shot('victory');
  }
  const video=await ev('document.querySelector(".tutorial-coach:not([hidden]) video")?.getAttribute("src")');
  if(video&&!testedVideos.has(video)){await until('document.querySelector(".tc-media video").readyState>=2');testedVideos.add(video);if(locale!=='zh')assert.ok(await ev('!!document.querySelector(".tc-media .has-local-captions .help-video-caption")?.textContent'),'localized video explanation');}
  if(state.id==='control'){assert.ok(await ev('document.querySelectorAll(".tc-rings rect").length>=2'),'real map country tokens are highlighted');await shot('control');}
  if(state.id==='persistent-japan'){assert.ok(await ev(`!!document.querySelector('.ps-shelf:not([hidden]) [data-passive-card="027"]')`),'Japan passive visible at the explanatory step');}
  if(state.id==='china'){assert.ok(await ev('!!document.querySelector(".tc-card .slot")'),'China lesson shows its actual card');await shot('china');}
  if(state.id==='complete')break;
  if(state.mode==='explain'){
   // Refresh during guided play once: checkpoints and read lessons survive.
   if(state.id==='lesson-004'&&!reloaded){const before=await ev('JSON.stringify(game.play.snapshot)');await ev('window.beforeTutorialReload=true');await cdp('Page.reload');await until("!window.beforeTutorialReload&&!!window.game?.play&&document.querySelector('.tutorial-coach:not([hidden])')?.dataset.step==='lesson-004'");assert.equal(await ev('JSON.stringify(game.play.snapshot)'),before);reloaded=true;checks.push('reload resumes the same action checkpoint');continue;}
   await click('.tc-choice[data-choice="next"]');continue;
  }
  if(state.mode==='choose'){await click(`.tc-choice[data-choice="${state.choices[0]}"]`);continue;}
  await delay(850); // allow camera/hand positioning to settle before exact hit test
  if(!badTested&&state.id==='play-035'){
   const before=await ev('JSON.stringify(game.play.snapshot)');await drag('004');await key('x');await key('Escape');assert.equal(await ev('JSON.stringify(game.play.snapshot)'),before);assert.equal(await ev('document.querySelector(".tutorial-coach").dataset.step'),state.id);checks.push('wrong card and unrelated shortcuts cannot advance script');badTested=true;
  }
  let selector;
  if(state.id==='use-035'){
   const before=await ev('JSON.stringify(game.play.snapshot)');await click('.sp-half.ev');await key('e');assert.equal(await ev('JSON.stringify(game.play.snapshot)'),before);assert.equal(await ev('document.querySelector(".tutorial-coach").dataset.step'),state.id);checks.push('wrong event choice and shortcut are blocked');
  }
  if(state.id==='place-035-0'){
   const before=await ev('JSON.stringify(game.play.snapshot)');await click('.wm-plate[data-id="tha"] .wm-plate-body');await key('Enter');assert.equal(await ev('JSON.stringify(game.play.snapshot)'),before);assert.equal(await ev('document.querySelector(".tutorial-coach").dataset.step'),state.id);checks.push('wrong country and early confirmation are blocked');
  }
  if(state.id.startsWith('play-')){await drag(state.id.slice(5));actionChecks++;continue;}
  if(state.id.startsWith('use-'))selector='.sp-half.ops';
  else if(state.id.startsWith('mode-')){const id=state.id.slice(5),mode=({'035':'place','004':'coup','015':'place','028':'space','019':'realign'})[id];selector=`.sp-band[data-key="${mode}"]`;}
  else if(state.id.startsWith('place-')){const parts=state.id.split('-'),country=parts[1]==='035'?(parts[2]==='0'?'mys':'col'):'lbn';selector=`.wm-plate[data-id="${country}"] .wm-plate-body`;}
  else if(state.id.startsWith('confirm-'))selector='.sp-sub-keys .primary';
  else if(state.id.startsWith('target-'))selector=`.wm-plate[data-id="${state.id.slice(7)==='004'?'irq':'egy'}"] .wm-plate-body`;
  else throw Error('unhandled action '+state.id);
  const accessible=await ev(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}),p=document.querySelector('.tc-panel');if(!el)return false;const a=el.getBoundingClientRect(),b=p.getBoundingClientRect();return a.width>0&&a.height>0&&a.bottom>0&&a.top<innerHeight&&!(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)})()`);
  assert.ok(accessible,'active target visible and clear of coach '+state.id);
  if(state.id==='target-004')await shot('coup-target');
  await click(selector);actionChecks++;
 }
 assert.ok(seen.includes('complete'),'complete all guided steps');
 assert.ok(actionChecks>=20,'used actual card drag, choice and country gestures');
 assert.equal(await ev('game.play.snapshot.turn'),2);assert.equal(await ev('game.tutorial.guided'),true);
 await shot('complete');
 const atEnd=await ev('game.play.snapshot');const completedSave=await ev("localStorage.getItem('coldwar.tutorial.v1.coldwar')");
 assert.equal(atEnd.crisis,5); // Verified scripted first-turn cleanup result.
 assert.equal(await ev("localStorage.getItem('coldwar.solo.v1.coldwar')"),'tutorial-isolation-sentinel');
 assert.equal(await ev("localStorage.getItem('coldwar.room.v1')"),'room-isolation-sentinel');checks.push('ordinary solo/room storage is untouched');
 await click('.tc-choice[data-choice="continue"]');await until("!document.querySelector('.tutorial-coach')&&!game.tutorial.guided");
 checks.push('continuation removes tutorial UI and input gate');
 await until("document.querySelectorAll('.hd-hit:not(.is-disabled)').length>0");
 const next=await ev('game.play.observation(0).headlineCandidates[0]');await drag(next);
 await until('!!game.play.snapshot.headlineDone',30000);
 checks.push('continued game accepts a freely chosen headline and normal AI response');
 assert.equal(await ev("JSON.parse(localStorage.getItem('coldwar.tutorial.v1.coldwar')).mode"),'free');
 // Re-enter the completed checkpoint and take the other completion branch.
 await ev(`localStorage.setItem('coldwar.tutorial.v1.coldwar',${JSON.stringify(completedSave)})`);
 await cdp('Page.navigate',{url:origin+'/game.html?tutorial=1&pace=.05'});await until("document.querySelector('.tutorial-coach')?.dataset.step==='complete'");await delay(350);
 await click('.tc-choice[data-choice="exit"]');await until("!!document.querySelector('#tutorial-start')");
 assert.ok(await ev("!document.querySelector('.tutorial-coach')"));checks.push('completed tutorial can exit cleanly to lobby');
 // Restart discards only the tutorial checkpoint, and narrow-screen/reduced-motion navigation stays usable.
 await delay(1000);await click('#tutorial-start');await until("document.querySelector('.tutorial-coach')?.dataset.step==='complete'");await delay(300);
 await click('.tc-control:not(.tc-exit)');await until("document.querySelector('.tutorial-coach')?.dataset.step==='welcome'");
 assert.equal(await ev('document.querySelectorAll(".tutorial-coach").length'),1);
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await delay(300);
 await click('.tc-choice[data-choice="next"]');await until("document.querySelector('.tutorial-coach')?.dataset.step==='victory'");await delay(350);
 assert.ok(await ev('(()=>{const r=document.querySelector(".tc-panel").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()'),'coach fits narrow viewport');
 assert.ok(await ev('document.querySelector(".tc-media video").paused'),'reduced motion video waits for request');
 await click('.tc-playback');await until('!document.querySelector(".tc-media video").paused');await click('.tc-playback');
 await shot('phone');checks.push('restart and narrow-screen video controls work; reduced motion respected');
 await click('.tc-exit');await until("!!document.querySelector('#tutorial-start')");
 // The ordinary game still uses its own presenter and save, with no guide imports mounted.
 const tutorialSave=await ev("localStorage.getItem('coldwar.tutorial.v1.coldwar')");
 await cdp('Page.navigate',{url:origin+'/game.html?pace=.05'});await until('!!window.game?.play');
 assert.ok(await ev('!document.querySelector(".tutorial-coach")&&!game.tutorial&&!document.querySelector(".tutorial-mode")'));
 assert.equal(await ev("localStorage.getItem('coldwar.tutorial.v1.coldwar')"),tutorialSave);
 checks.push('ordinary solo loads independently without tutorial UI or locks');
 assert.deepEqual(errors,[],'no browser errors');
 console.log(JSON.stringify({locale,checks,steps:seen.length,gestures:actionChecks,turn2:{vp:atEnd.vp,crisis:atEnd.crisis,space:atEnd.space},videos:testedVideos.size,errors},null,2));
}catch(error){if(client){try{const r=await client.call('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/tutorial-failure.png',Buffer.from(r.data,'base64'));console.error('BROWSER',JSON.stringify(errors));}catch{}}throw error;}
finally{client?.close();await browser.call('Target.disposeBrowserContext',{browserContextId});browser.close();}
