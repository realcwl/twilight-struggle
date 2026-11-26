// Real UI regression for the online waiting state. Uses disposable browser contexts and test rooms.
// Run a private Chrome on ONLINE_CDP_PORT (default 9348), then node tools/online-browser.mjs.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const origin = process.env.CHAT_ORIGIN ?? 'http://127.0.0.1:8787';
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname),'Local rooms only');
const port = process.env.CHAT_CDP_PORT ?? '59065';
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
    } else if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.text);
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
    await c.ev('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
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
    window.__onlineTest={answers:0,audio:[],sounds:0,sent:[]};
    window.Audio=class extends Audio { constructor(...args){super(...args);window.__onlineTest.audio.push(this);} };
    const startSound=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args){window.__onlineTest.sounds++;return startSound.apply(this,args);};
    window.WebSocket=class extends WebSocket {
      constructor(...args){super(...args);window.__onlineTest.socket=this;this.addEventListener('message',e=>{if(e.data==='pong')return;const m=JSON.parse(e.data);if(m.type==='state')window.__onlineTest.latest=m;});}
      send(data){window.__onlineTest.sent.push(data);if(typeof data==='string'&&data.startsWith('{')&&JSON.parse(data).type==='answer')window.__onlineTest.answers++;super.send(data);}
    };
  `});
  await c.send('Page.navigate',{url:origin+'/online.html?room='+credential.code+'&pace=.05'});
  await c.until("document.documentElement.dataset.ready==='true'");
  return c;
}

const shot=async(c,name)=>{await c.send('Page.bringToFront');const r=await c.send('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/coldwar-chat/'+name+'.png',Buffer.from(r.data,'base64'));};
const messages=c=>c.ev('[...document.querySelectorAll(".rc-message > span")].map(e=>e.textContent)');
const sendText=async(c,text)=>{await c.send('Page.bringToFront');await c.click('.rc-compose');await c.until('document.activeElement===document.querySelector(".rc-form input")');await c.send('Input.insertText',{text});await c.key('Enter');};
const nonOverlap=async c=>{
 const result=await c.ev(`(()=>{const chat=document.querySelector('.room-chat').getBoundingClientRect();return [...document.querySelectorAll('.hud-tl,.hud-time-footer,.hud-bl,.ps-mine,.ps-legacy,.hud-tr,.hud-brief,.hud-resolution')].filter(e=>e.offsetHeight&&!e.hidden).map(e=>{const r=e.getBoundingClientRect();return{name:e.className,overlap:Math.min(chat.right,r.right)>Math.max(chat.left,r.left)&&Math.min(chat.bottom,r.bottom)>Math.max(chat.top,r.top)}})})()`);
 assert.ok(result.every(r=>!r.overlap),JSON.stringify(result));
};
try{
 await mkdir('/tmp/coldwar-chat',{recursive:true});
 const host=await post('/api/create',{side:1}),guest=await post(`/api/room/${host.code}/join`);
 const su=await page(host),us=await page(guest);
 for(const c of [su,us])await c.until('!!document.querySelector(".room-chat:not(.is-offline)")');
 await us.ev('document.activeElement.blur()');await us.key('Enter');
 assert.equal(await us.ev('document.querySelector(".rc-form").hidden'),false,'Enter opens chat when not used by a game confirmation');await us.key('Escape');
 const revision=await su.ev('__onlineTest.latest.revision'),answers=await su.ev('__onlineTest.answers');
 await sendText(su,'你好，准备好了吗？');await us.until('document.querySelector(".rc-message > span")?.textContent==="你好，准备好了吗？"');
 await sendText(us,'准备好了，我们开始吧。');await su.until('document.querySelectorAll(".rc-message").length===2');
 assert.equal(await su.ev('__onlineTest.latest.revision'),revision);assert.equal(await su.ev('__onlineTest.answers'),answers);
 const colours=await su.ev('[...document.querySelectorAll(".rc-message b")].map(e=>getComputedStyle(e).color)');assert.notEqual(colours[0],colours[1]);
 await nonOverlap(su);await nonOverlap(us);
 // The same measured anchors keep active passive-card shelves clear.
 await su.ev(`document.querySelector('.ps-mine').hidden=false;document.querySelector('.ps-mine').style.minHeight='110px'`);await delay(150);await nonOverlap(su);
 await su.ev(`document.querySelector('.ps-mine').hidden=true;document.querySelector('.ps-mine').style.minHeight=''`);

 // Idle floating text never takes clicks away from the map.
 const passThrough=await su.ev(`(()=>{const e=document.querySelector('.rc-message > span'),r=e.getBoundingClientRect();return !document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.room-chat')})()`);assert.ok(passThrough);
 await su.until("!document.querySelector('.hud.is-dealing')");
 const country=await su.ev(`(()=>{const r=document.querySelector('.wm-plate[data-id="gdr"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 await su.move(country);await delay(350);await nonOverlap(su);
 await su.move({x:900,y:700});await delay(250);await shot(su,'desktop');
 // Existing Enter-to-confirm remains available; entering chat explicitly shields game shortcuts.
 await su.click('.rc-compose');
 await su.ev(`document.querySelector('.rc-form input').dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));document.querySelector('.rc-form input').value='中文候选'`);
 await su.key('Enter');assert.equal((await messages(su)).length,2);
 await su.ev(`document.querySelector('.rc-form input').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));document.querySelector('.rc-form input').value=''`);await delay(100);
 await su.key('Escape');assert.equal(await su.ev('__onlineTest.answers'),answers);
 await us.click('.rc-fold');await sendText(su,'你折叠后，消息也会保留。');await us.until('document.querySelector(".rc-unread").textContent==="1"');
 assert.ok(await us.ev('document.querySelector(".rc-content").hidden'));
 await us.send('Page.reload',{ignoreCache:true});await us.until('document.documentElement.dataset.ready==="true" && !!document.querySelector(".room-chat:not(.is-offline)")');
 assert.ok(await us.ev('document.querySelector(".rc-content").hidden'),'explicit fold survives reload');
 await us.click('.rc-fold');assert.equal((await messages(us)).length,3);
 // Plain text stays text, never interpreted as markup.
 await sendText(us,'<img src=x onerror=alert(1)> 只是文字');await su.until('document.querySelectorAll(".rc-message").length===4');
 assert.equal(await su.ev('document.querySelectorAll(".rc-log img").length'),0);
 // Reconnect restores history without duplicated messages or a game revision change.
 await su.ev('__onlineTest.socket.close()');await su.until('!!document.querySelector(".room-chat.is-offline")');
 await su.click('.rc-compose');await su.send('Input.insertText',{text:'断线草稿'});await su.key('Enter');
 assert.equal(await su.ev('document.querySelector(".rc-form input").value'),'断线草稿');
 await su.until('!!document.querySelector(".room-chat:not(.is-offline)")');
 assert.equal((await messages(su)).length,4);await su.key('Enter');await us.until('document.querySelectorAll(".rc-message").length===5');
 assert.equal(await su.ev('__onlineTest.latest.revision'),revision);
 // Explicit reading allows history scroll, but outside clicks only close input, not messages.
 await su.click('.rc-heading');assert.ok(await su.ev('document.querySelector(".room-chat").classList.contains("is-reading")'));
 await su.move({x:900,y:500});await su.send('Input.dispatchMouseEvent',{type:'mousePressed',x:900,y:500,button:'left',clickCount:1});await su.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:900,y:500,button:'left',clickCount:1});
 assert.equal(await su.ev('document.querySelector(".rc-content").hidden'),false);
 // No inactivity timer: messages remain after longer than the abandoned 12-second fade proposal.
 await delay(13000);assert.equal((await messages(su)).length,5);assert.equal(await su.ev('getComputedStyle(document.querySelector(".rc-content")).display'),'flex');
 // A rejected send remains visible and can be retried without duplication.
 for(let i=0;i<6;i++)await sendText(us,'连续消息 '+i);
 await us.until('!!document.querySelector(".rc-message.is-failed")');
 await delay(5100);await us.click('.rc-message.is-failed button');await us.until('!document.querySelector(".rc-message[data-pending]")');
 assert.equal((await messages(su)).filter(t=>t==='连续消息 5').length,1);
 await su.click('.rc-heading');await su.ev('document.querySelector(".rc-log").scrollTop=0');
 await sendText(us,'翻看旧消息时不会跳到底部');await su.until('!document.querySelector(".rc-latest").hidden');
 assert.equal(await su.ev('document.querySelector(".rc-log").scrollTop'),0);await su.click('.rc-latest');
 assert.ok(await su.ev('document.querySelector(".rc-log").scrollTop>0'));
 console.log('PASS send failure/retry and history scroll position');
 console.log('PASS two players, colours, game isolation, IME, click-through, explicit fold/reload, plain text, reconnect, draft preservation, persistent display');
 await us.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,mobile:true,deviceScaleFactor:1});await delay(400);await nonOverlap(us);
 const bounds=await us.ev(`(()=>{const r=document.querySelector('.room-chat').getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom}})()`);
 assert.ok(bounds.left>=0&&bounds.right<=390&&bounds.top>=0&&bounds.bottom<=844,JSON.stringify(bounds));await shot(us,'mobile');
 assert.deepEqual(errors,[]);console.log('PASS desktop/mobile bounds and HUD non-overlap, no browser exceptions');
}catch(e){for(const c of clients)console.error(await c.ev('JSON.stringify({chat:document.querySelector(".room-chat")?.outerHTML,focus:document.activeElement?.outerHTML})'));if(clients.length){await shot(clients[0],'failure');console.error(await clients[0].ev('JSON.stringify({chat:document.querySelector(".room-chat")?.outerHTML,status:document.querySelector("#room-notice")?.textContent})'));}throw e;}finally{
 for(const ctx of contexts)await browser.send('Target.disposeBrowserContext',ctx);
 for(const c of clients)c.ws.close();browser.ws.close();
}
