// Real UI regression for the online waiting state. Uses disposable browser contexts and test rooms.
// Run a private Chrome on ONLINE_CDP_PORT (default 9348), then node tools/online-browser.mjs.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const origin = process.env.ONLINE_ORIGIN ?? 'http://127.0.0.1:8788';
const port = process.env.ONLINE_CDP_PORT ?? '9348';
const delay = ms => new Promise(r => setTimeout(r, ms));
const errors = [], clients = [], contexts = [];
async function connection(url) {
  const ws = new WebSocket(url);
  await new Promise(r => ws.addEventListener('open', r, {once:true}));
  let id = 0;
  const pending = new Map();
  ws.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.id) {
      const p = pending.get(d.id); pending.delete(d.id);
      d.error ? p.reject(d.error) : p.resolve(d.result);
    } else if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text);
    else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error')
      errors.push(d.params.args.map(x => x.description ?? x.value).join(' '));
  };
  return {ws, send:(method, params={})=>new Promise((resolve,reject)=>{
    pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
  })};
}
const root = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
const browser = await connection(root.webSocketDebuggerUrl);
async function post(path, body={}) {
  const r = await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.ok(r.ok, `HTTP ${r.status} for room operation`);
  return r.json();
}
async function page(credential) {
  const context = await browser.send('Target.createBrowserContext'); contexts.push(context);
  const target = await browser.send('Target.createTarget',{url:'about:blank',browserContextId:context.browserContextId});
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const c = await connection(targets.find(t=>t.id===target.targetId).webSocketDebuggerUrl); clients.push(c);
  c.ev = async expression => {
    const r=await c.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  c.until = async expression => {
    await c.send('Page.bringToFront');
    for(let i=0;i<300;i++) {
      if(await c.ev(expression))return;
      await delay(100);
    }
    const state=await c.ev(`({status:document.querySelector('#room-status')?.textContent,prompt:window.__onlineTest?.latest?.prompt?.method,frames:window.__onlineTest?.latest?.frames?.map(f=>f.method),hud:document.querySelector('.hud')?.className,block:!!document.querySelector('.sp-block:not([hidden])'),subtitle:document.querySelector('.sp-sub')?.textContent,notices:document.querySelector('#room-notice')?.textContent})`);
    throw new Error('UI timed out: '+expression+' '+JSON.stringify({state,errors}));
  };
  c.move = point => c.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
  c.click = async selector => {
    const p=await c.ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    assert.ok(p.x>0&&p.x<1600&&p.y>0&&p.y<1000,'click is inside viewport');
    await c.move(p);
    await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});
    await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});
  };
  c.key = async key => {
    await c.send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:key==='Enter'?13:27});
    await c.send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key});
  };
  c.drag = async (p,dx,dy) => {
    await c.move(p);await delay(120);
    await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});
    for(let i=1;i<=8;i++){
      await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x+dx*i/8,y:p.y+dy*i/8,button:'left',buttons:1});
      await delay(30);
    }
    await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x+dx,y:p.y+dy,button:'left',clickCount:1});
  };
  c.cardPoint = id => c.ev(`(()=>{const e=[...document.querySelectorAll('.hd-card')].find(e=>e.querySelector('[data-card="${id}"]')).nextElementSibling,r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:Math.min(innerHeight-25,r.y+35)}})()`);
  await c.send('Page.enable');await c.send('Runtime.enable');
  await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await c.send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,mobile:false,deviceScaleFactor:1});
  // Credentials stay in memory and in this disposable browser context. No room secrets in output.
  await c.send('Page.addScriptToEvaluateOnNewDocument',{source:`
    localStorage.setItem('coldwar.online.v1.'+${JSON.stringify(credential.code)},${JSON.stringify(JSON.stringify(credential))});
    window.__onlineTest={answers:0,audio:[],sounds:0};
    window.Audio=class extends Audio { constructor(...args){super(...args);window.__onlineTest.audio.push(this);} };
    const startSound=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args){window.__onlineTest.sounds++;return startSound.apply(this,args);};
    window.WebSocket=class extends WebSocket {
      constructor(...args){super(...args);window.__onlineTest.socket=this;this.addEventListener('message',e=>{if(e.data==='pong')return;const m=JSON.parse(e.data);if(m.type==='state')window.__onlineTest.latest=m;});}
      send(data){if(typeof data==='string'&&data.startsWith('{')&&JSON.parse(data).type==='answer')window.__onlineTest.answers++;super.send(data);}
    };
  `});
  await c.send('Page.navigate',{url:origin+'/online.html?room='+credential.code+'&lang='+(process.env[credential.side===0?'ONLINE_LANG_US':'ONLINE_LANG_USSR']??'zh')+'&pace='+(process.env.ONLINE_PACE ?? '.05')});
  await c.until("document.documentElement.dataset.ready==='true'");
  return c;
}
async function inspectWhileWaiting(c) {
  await c.until("!document.querySelector('.hud.is-dealing')");
  await c.until("!!window.__onlineTest.latest && !window.__onlineTest.latest.prompt && !document.querySelector('.sp-block:not([hidden])') && !!document.querySelector('.hud.play-readonly')");
  const id=await c.ev("document.querySelectorAll('.hd-card')[2].querySelector('[data-card]').dataset.card");
  const p=await c.cardPoint(id);await c.move(p);await delay(250);
  assert.ok(await c.ev("!!document.querySelector('.hd-card.is-up')"),'waiting player can inspect a hand card');
  const before=await c.ev('window.__onlineTest.answers');
  await c.drag(p,0,-250);
  assert.equal(await c.ev('window.__onlineTest.answers'),before,'waiting player cannot submit a card');
  assert.equal(await c.ev("document.querySelectorAll('.hd-card.is-drag,.hud.is-armed').length"),0);
  await c.click('#room-menu');
  await c.until("!!document.querySelector('.solo-menu[open]')");
  await c.click('.solo-menu button');
  await c.move({x:800,y:450});await delay(200);
  const start=await c.ev("(()=>{const r=document.querySelector('.wm-plate[data-id=\"gdr\"]').getBoundingClientRect();return {x:r.x,y:r.y}})()");
  const ocean=await c.ev("(()=>{for(let y=250;y<650;y+=80)for(let x=400;x<1200;x+=100)if(document.elementFromPoint(x,y)?.tagName==='CANVAS')return{x,y};return null})()");
  assert.ok(ocean,'map has an exposed drag surface');
  await c.drag(ocean,100,30);await delay(450);
  const end=await c.ev("(()=>{const r=document.querySelector('.wm-plate[data-id=\"gdr\"]').getBoundingClientRect();return {x:r.x,y:r.y}})()");
  assert.ok(Math.hypot(end.x-start.x,end.y-start.y)>5,'waiting player can pan the map');
  await c.drag({x:ocean.x+100,y:ocean.y+30},-100,-30);await delay(350);
}
async function checkScore(c, filename) {
  if (!process.env.AUDIO_CHECK) return;
  await c.send('Page.bringToFront');
  await c.click('.sound-toggle');
  await c.until('document.querySelector(".sound-panel").matches(":popover-open")');
  await c.until(`__onlineTest.audio.some(a=>a.src.includes('${filename}')&&!a.paused&&a.currentTime>0)`);
  const before=await c.ev('__onlineTest.sounds');
  await c.click('[data-sound="influence"]');
  await c.until(`__onlineTest.sounds>${before}`);
  await c.click('.sound-close');
}
async function deploy(c, allocations) {
  await c.until("['place','reveal'].includes(window.__onlineTest.latest?.prompt?.method)");
  if(await c.ev("window.__onlineTest.latest.prompt.method==='reveal'")){
    await c.until("!!document.querySelector('.solo-dialog[open] button')");
    await c.click('.solo-dialog[open] button');
  }
  await c.until("window.__onlineTest.latest?.prompt?.method==='place' && !!document.querySelector('.wm-plate.pl-ok')");
  for(const [id,n] of allocations) for(let i=0;i<n;i++){
    await c.click(`.wm-plate[data-id="${id}"]`);await delay(100);
  }
  assert.equal(await c.ev("document.querySelector('.sp-sub-big').textContent"),'0');
  await c.key('Enter');
}
async function headline(c) {
  await c.until("window.__onlineTest.latest?.prompt?.method==='pickHeadline' && !document.querySelector('.hud.play-wait,.hud.play-readonly')");
  const id=await c.ev(`(()=>{const m=window.__onlineTest.latest;return Object.values(m.options).filter(o=>m.view.hud.hand.includes(o.card.id)&&!['006','032'].includes(o.card.id)).sort((a,b)=>b.points-a.points)[0].card.id})()`);
  const before=await c.ev('window.__onlineTest.answers');
  await c.move({x:1000,y:450}); await delay(250);
  await c.move(await c.cardPoint(id)); await delay(300);
  const art=await c.ev(`(()=>{const r=document.querySelector('.hd-card[data-card="${id}"] .card-art').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await c.drag(art,0,-250);
  await c.until(`window.__onlineTest.answers>${before}`);
  return id;
}
// Run with COMMIT_CHECK=1 node --import tsx tools/online-browser.mjs.
async function checkCommitment(seats) {
  const { testAnswer } = await import('../src/net/bot-test.ts');
  const { readFile } = await import('node:fs/promises');
  const scenario = JSON.parse(await readFile(new URL('../data/scenarios/coldwar/scenario.json', import.meta.url), 'utf8'));
  const read = async c => JSON.parse(JSON.stringify(await c.ev('window.__onlineTest.latest')), (_k,v) => v && Array.isArray(v.$map) ? new Map(v.$map) : v);
  const submit = async (c, value) => {
    const m = await read(c);
    await c.ev(`window.__onlineTest.socket.send(JSON.stringify({type:'answer',promptId:${JSON.stringify(m.prompt.id)},value:${JSON.stringify(value)},requestId:crypto.randomUUID()}))`);
    await c.until(`window.__onlineTest.latest.revision>${m.revision}`);
  };
  let actor, card;
  // Resolve any interactive headline effect through the ordinary room protocol.
  for (let i=0;i<30;i++) {
    const states = await Promise.all(seats.map(read));
    const side = states.findIndex(m=>m.prompt);
    assert.ok(side>=0,'a decision is available');
    const m=states[side];
    if (m.prompt.method==='decide') {
      actor=seats[side];
      card=Object.values(m.options).find(o=>m.view.hud.hand.includes(o.card.id)&&o.card.id!=='006'&&!o.blocked&&o.coup.ok&&o.place.ok&&!o.fires)?.card.id
        ?? Object.values(m.options).find(o=>m.view.hud.hand.includes(o.card.id)&&o.card.id!=='006'&&!o.blocked&&o.coup.ok&&o.place.ok)?.card.id;
      assert.ok(card,'hand has a card that can preview both coup and influence');
      break;
    }
    await submit(seats[side], await testAnswer(m.prompt,m.view,scenario));
  }
  assert.ok(actor,'headlines reach an action');
  const peer=seats.find(c=>c!==actor);
  await actor.until("window.__onlineTest.latest?.prompt?.method==='decide'&&!document.querySelector('.hud.play-wait,.hud.play-readonly')&&!document.querySelector('.sp-block:not([hidden])')");
  await inspectWhileWaiting(peer);
  const baseline=(await read(peer)).view;
  const chooseMode = async mode => {
    await actor.move({x:1100,y:450});await delay(200);
    await actor.move(await actor.cardPoint(card));await delay(300);
    const art=await actor.ev(`(()=>{const r=document.querySelector('.hd-card[data-card="${card}"] .card-art').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await actor.drag(art,0,-250);
    await actor.until("!!document.querySelector('.sp-choice')");
    await actor.click('.sp-half.ops');
    await actor.click(`.sp-band[data-key="${mode}"]`);
    await actor.until("['choose','place','pickTarget'].includes(window.__onlineTest.latest?.prompt?.method)");
    for(let i=0;i<3&&(await read(actor)).prompt.method==='choose';i++) {
      const q=(await read(actor)).prompt.args[0];
      await submit(actor,q.options.some(o=>o.id==='after')?'after':q.options.some(o=>o.id==='any')?'any':q.options[0].id);
    }
    await actor.until("!!document.querySelector('.wm-plate.pl-ok')");
    const revision=(await read(actor)).revision;
    await peer.until(`window.__onlineTest.latest.revision>=${revision}`);
    assert.deepEqual((await read(peer)).view,baseline,'the entire opponent view stays unchanged during a preview');
    assert.equal((await read(peer)).frames.length,0,'no review is sent before confirmation');
    assert.equal(await peer.ev("!!document.querySelector('.sp-title.has-card')"),false,'no opponent card review is displayed during preview');
  };
  await chooseMode('coup');
  const target=await actor.ev(`(()=>{for(const e of document.querySelectorAll('.wm-plate.pl-ok')){const r=e.getBoundingClientRect();if(r.x>150&&r.right<innerWidth-150&&r.y>200&&r.bottom<innerHeight-260)return e.dataset.id;}return null;})()`);
  assert.ok(target,'a target is visible for a real pointer confirmation');
  const bounds=await actor.ev(`(()=>{const r=document.querySelector('.wm-plate[data-id="${target}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await actor.move(bounds);await delay(250);
  assert.match(await actor.ev("document.querySelector('.sp-sub').textContent"),/成功|骰|概率/,'hover presents the coup preview');
  await writeFile('/tmp/coup-private-preview.png',Buffer.from((await actor.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await actor.key('Escape');
  await actor.until("window.__onlineTest.latest?.prompt?.method==='decide'&&!document.querySelector('.hud.play-wait,.hud.play-readonly')");
  assert.ok(await actor.ev(`!!document.querySelector('.hd-card[data-card="${card}"]')`),'cancelled card is still in hand');
  const mapNumbers=()=>actor.ev("[...document.querySelectorAll('.wm-plate')].map(e=>[e.dataset.id,...[...e.querySelectorAll('.wm-inf')].map(x=>x.textContent)])");
  const originalNumbers=await mapNumbers();
  const placePoint = async () => {
    const id=await actor.ev(`(()=>{for(const e of document.querySelectorAll('.wm-plate.pl-ok')){const r=e.getBoundingClientRect();if(r.x>150&&r.right<innerWidth-150&&r.y>250&&r.bottom<innerHeight-280)return e.dataset.id;}return null;})()`);
    assert.ok(id,'an influence target is visible');
    const left=await actor.ev("Number(document.querySelector('.sp-sub-big').textContent)");
    await actor.click(`.wm-plate[data-id="${id}"]`);
    await actor.until(`Number(document.querySelector('.sp-sub-big').textContent)<${left}`);
  };
  const finishAllocation = async () => {
    for(let n=0;n<6&&await actor.ev("Number(document.querySelector('.sp-sub-big').textContent)>0");n++)await placePoint();
    assert.equal(await actor.ev("document.querySelector('.sp-sub-big').textContent"),'0');
  };
  const cancelAllocation = async () => {
    await actor.key('Escape');
    await actor.until("window.__onlineTest.latest?.prompt?.method==='decide'&&!document.querySelector('.hud.play-wait,.hud.play-readonly')");
    const revision=(await read(actor)).revision;
    await peer.until(`window.__onlineTest.latest.revision>=${revision}`);
    assert.deepEqual((await read(peer)).view,baseline,'cancelling a populated allocation leaves no public changes');
    assert.deepEqual(await mapNumbers(),originalNumbers,'Escape restores every displayed influence number on the actor map');
  };
  await chooseMode('place');
  await placePoint();
  if(await actor.ev("Number(document.querySelector('.sp-sub-big').textContent)>0")){
    const sent=await actor.ev('window.__onlineTest.answers');
    await actor.key('Enter');await delay(150);
    assert.equal(await actor.ev('window.__onlineTest.answers'),sent,'Enter cannot submit an incomplete allocation');
    assert.equal(await actor.ev("!!document.querySelector('.sp-sub-keys .primary')"),false);
  }
  assert.deepEqual((await read(peer)).view,baseline,'individual preview points remain private');
  await cancelAllocation();
  await chooseMode('place');
  await finishAllocation();
  assert.deepEqual((await read(peer)).view,baseline,'even a full allocation remains private until explicit confirmation');
  await cancelAllocation();
  const finalMode=process.env.COMMIT_CHECK==='place'?'place':'coup';
  await chooseMode(finalMode);
  if(finalMode==='place')await finishAllocation();
  const revision=(await read(peer)).revision;
  if(finalMode==='place')await actor.key('Enter');
  else await actor.click(`.wm-plate[data-id="${target}"]`);
  await peer.until(`window.__onlineTest.latest.revision>${revision}&&window.__onlineTest.latest.frames.some(f=>f.method==='announce')`);
  const committed=await read(peer), announce=committed.frames.find(f=>f.method==='announce');
  assert.equal(announce.args[0].verb,finalMode);
  if(finalMode==='coup')assert.equal(announce.args[0].target,target);
  assert.equal(announce.args[0].card.id,card);
  assert.equal(committed.view.hud.opponentHand,baseline.hud.opponentHand-1);
  await peer.until("!!document.querySelector('.sp-title.has-card')");
  assert.match(await peer.ev("document.querySelector('.sp-title-text b').textContent"),finalMode==='place'?/影响力/:/政变/);
  await writeFile(`/tmp/${finalMode}-confirmed-review.png`,Buffer.from((await peer.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  console.log(`PASS: real two-seat UI keeps coup and partial/full placement previews private, allows Escape and switching modes, and reviews only a confirmed ${finalMode}`);
}
try {
  const host=await post('/api/create',{side:1});
  const su=await page(host);
  await inspectWhileWaiting(su);
  await checkScore(su,'ussr-katabasis');
  console.log('PASS: before friend joins, map/cards/menu remain usable and out-of-turn play is blocked');
  const guest=await post(`/api/room/${host.code}/join`);
  const us=await page(guest);
  await inspectWhileWaiting(us);
  await checkScore(us,'us-signal-to-noise');
  if(process.env.AUDIO_CHECK)console.log('PASS: each online seat streams its own faction score; real audio previews play');
  await deploy(su,[['gdr',3],['pol',3]]);
  await inspectWhileWaiting(su);
  console.log('PASS: Soviet deployment completes; waiting UI releases the map and cards');
  await deploy(us,[['frg',4],['ita',3]]);
  const usHeadline = await headline(us);
  await inspectWhileWaiting(us);
  assert.equal(await us.ev(`!!document.querySelector('.hd-card[data-card="${usHeadline}"]')`),false,'selected card leaves hand');
  assert.ok(await us.ev("!!document.querySelector('.sp-headline.is-waiting .sp-hl-seat.a:not(.is-empty)')"),'own card remains at reveal position');
  assert.ok(await us.ev("!!document.querySelector('.sp-hl-seat.b.is-empty')"),'unsubmitted opponent seat has no card');
  await su.until("!!document.querySelector('.sp-headline.is-waiting .sp-hl-seat.a:not(.is-empty)')");
  assert.equal(await su.ev("document.querySelector('.sp-hl-seat.a .sp-hl-front').children.length"),0,'opponent sees only a card back');
  await us.send('Page.bringToFront');
  await us.ev("Promise.all([...document.querySelectorAll('.sp-hl-card')].flatMap(e=>e.getAnimations()).map(a=>a.finished.catch(()=>{})))");
  await delay(100);
  await writeFile('/tmp/headline-waiting.png',Buffer.from((await us.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await us.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,mobile:true,deviceScaleFactor:1});
  await delay(150);
  assert.ok(await us.ev("(()=>{const r=document.querySelector('.sp-headline').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()"),'sealed headline fits mobile viewport');
  await writeFile('/tmp/headline-mobile.png',Buffer.from((await us.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await us.send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,mobile:false,deviceScaleFactor:1});
  console.log('PASS: submitted headline waits without locking inspection or allowing a second play');
  const soundCount=await us.ev('__onlineTest.sounds');
  await us.ev('window.__onlineTest.socket.close()');
  await delay(1500);
  if(process.env.AUDIO_CHECK)assert.equal(await us.ev('__onlineTest.sounds'),soundCount,'reconnect must not replay historical sounds');
  await inspectWhileWaiting(us);
  assert.equal(await us.ev(`!!document.querySelector('.hd-card[data-card="${usHeadline}"]')`),false);
  assert.ok(await us.ev("!!document.querySelector('.sp-headline.is-waiting .sp-hl-seat.a:not(.is-empty)')"));
  await us.send('Page.reload',{ignoreCache:true});
  await us.until("document.documentElement.dataset.ready==='true'");
  await inspectWhileWaiting(us);
  assert.equal(await us.ev(`!!document.querySelector('.hd-card[data-card="${usHeadline}"]')`),false);
  assert.equal(await us.ev("document.querySelector('.sp-hl-seat.a .sp-hl-front').dataset.card"),usHeadline);
  console.log('PASS: reconnect and reload preserve the pending headline and interactive waiting state');
  if(process.env.ONLINE_I18N){
    const before=await us.ev('({revision:__onlineTest.latest.revision,hand:__onlineTest.latest.view.hud.hand,prompt:__onlineTest.latest.prompt?.id})');
    await us.click('.language-button');await us.click('[data-language="es"]');
    await us.until('document.documentElement.lang==="es" && document.documentElement.dataset.ready==="true" && !!window.__onlineTest.latest');
    await inspectWhileWaiting(us);
    assert.deepEqual(await us.ev('({revision:__onlineTest.latest.revision,hand:__onlineTest.latest.view.hud.hand,prompt:__onlineTest.latest.prompt?.id})'),before,'language switch preserves pending room state');
    assert.equal(await us.ev('document.querySelector(".sp-hl-seat.a .sp-hl-front").dataset.card'),usHeadline);
    for(const c of [us,su]){
      const untranslated=await c.ev(`(()=>{let n,out=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);while(n=w.nextNode())if(n.parentElement?.checkVisibility()&&!n.parentElement.closest('script,style,.language-menu,.language-button')&&/\\p{Script=Han}/u.test(n.textContent))out.push(n.textContent.trim());return [...new Set(out)].filter(Boolean)})()`);
      assert.deepEqual(untranslated,[],'localized online waiting state');
    }
    console.log('PASS: mixed-language seats and language switching preserve the sealed headline and authoritative room state');
  }

  const before=await su.ev('window.__onlineTest.latest.revision');
  await us.ev('window.__sealedStage=document.querySelector(".sp-headline")');
  const suHeadline = await headline(su);
  await su.until(`window.__onlineTest.latest.revision>${before}`);
  await us.until(`window.__onlineTest.latest.revision>${before}`);
  await us.until("!!document.querySelector('.sp-headline.is-open')");
  assert.ok(await us.ev('document.querySelector(".sp-headline")===window.__sealedStage'),'reveal uses the same waiting stage');
  assert.equal(await us.ev("document.querySelector('.sp-hl-seat.b .sp-hl-front').dataset.card"),suHeadline);
  assert.equal(await us.ev("document.querySelectorAll('.sp-headline').length"),1);
  assert.equal(await su.ev(`!!document.querySelector('.hd-card[data-card="${suHeadline}"]')`),false);
  await writeFile('/tmp/headline-reveal.png',Buffer.from((await us.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  if(process.env.COMMIT_CHECK)await checkCommitment([us,su]);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({twoBrowserSeats:true,waitingInspection:true,outOfTurnPlayBlocked:true,deployment:true,headlines:true,reconnect:true,reload:true,errors}));
} finally {
  for(const ctx of contexts)await browser.send('Target.disposeBrowserContext',ctx);
  for(const c of clients)c.ws.close();
  browser.ws.close();
}
