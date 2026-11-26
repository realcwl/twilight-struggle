// Drag/drop regression using the real local HUD and map in a disposable browser context.
// Start Vite and a private Chrome on HAND_CDP_PORT (default 9348), then run this file.
import assert from 'node:assert/strict';
const origin = process.env.HAND_ORIGIN ?? 'http://127.0.0.1:5173';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'local test server only');
const port = process.env.HAND_CDP_PORT ?? '9348';
const delay = ms => new Promise(r => setTimeout(r, ms));
const errors = [], results = [];
async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let serial = 0;
  const pending = new Map();
  ws.addEventListener('message', e => {
    const d = JSON.parse(e.data);
    if (d.id) {
      const p = pending.get(d.id); pending.delete(d.id);
      d.error ? p.reject(d.error) : p.resolve(d.result);
    } else if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails);
  });
  return {
    call(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++serial; pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    close: () => ws.close(),
  };
}
const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
const browser = await connect(version.webSocketDebuggerUrl);
const { browserContextId } = await browser.call('Target.createBrowserContext');
let client;
try {
  const { targetId } = await browser.call('Target.createTarget', { url: 'about:blank', browserContextId });
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  client = await connect(targets.find(t => t.id === targetId).webSocketDebuggerUrl);
  const cdp = (m, p) => client.call(m, p);
  const ev = async expression => {
    const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const until = async expression => {
    for (let i = 0; i < 200; i++) { if (await ev(expression)) return; await delay(100); }
    throw Error(`Timed out: ${expression}`);
  };
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: origin + '/online.html' });
  await until("!!document.querySelector('#join-room')");
  await ev(`(async()=>{
    const [d,{Hud},{WorldMap},{COLDWAR_TRACKS}]=await Promise.all([
      import('/src/cards/deck.ts'),import('/src/hud/Hud.ts'),import('/src/map/WorldMap.ts'),import('/src/game/tracks.ts')]);
    document.querySelector('#lobby').hidden=true;document.querySelector('#game').hidden=false;document.querySelector('#loading').hidden=true;
    const [map]=await Promise.all([WorldMap.create(document.querySelector('#map'),'/maps/coldwar',{lang:'zh'}),d.cardFontsReady()]);
    const cards={face:d.cardFace,back:d.cardBack,fit:d.fitCard,describe:d.describeCard};
    const hud=Hud.create(document.querySelector('#game'),{lang:'zh',player:1,rules:COLDWAR_TRACKS,sides:map.pack.scenario.sides,cards,demo:false,playFlight:false});
    const state={turn:1,round:2,phase:'action',active:1,vp:0,crisis:5,milops:[0,0],milopsRequired:5,space:[0,0],hand:['005','034','008','025','004'],opponentHand:5,deck:25,discard:[],removed:[],played:null};
    hud.setState(state,false);hud.root.classList.add('play-on','play-card-turn');d.connectCardMap(map);
    window.fixture={map,hud,state,cards,plays:[],events:[]};hud.on('play',id=>fixture.plays.push(id));
    for(const type of ['pointerup','pointercancel','lostpointercapture','blur','visibilitychange'])window.addEventListener(type,e=>fixture.events.push(e.type),true);
  })()`);
  await delay(500);
  const shift = async (on, code = 'ShiftLeft') => cdp('Input.dispatchKeyEvent', { type: on ? 'keyDown' : 'keyUp', key: 'Shift', code, windowsVirtualKeyCode: 16, modifiers: on ? 8 : 0 });
  const mouse = (type, p, modifiers = 0) => cdp('Input.dispatchMouseEvent', { type, ...p, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: type === 'mouseMoved' ? 0 : 1, modifiers });
  const inspect = () => ev(`({plays:fixture.plays.length,stuck:document.querySelectorAll('.hd-card.is-drag,.hd-card.is-armed,.hud.is-armed').length,captured:[...document.querySelectorAll('.hd-hit')].some(e=>e.hasPointerCapture(1))})`);
  const settled = async (plays, label) => {
    assert.deepEqual(await inspect(), { plays, stuck: 0, captured: false }, label);
    results.push(label);
  };
  // Start on the raised artwork, away from terms that intentionally open help instead of dragging.
  const point = async () => {
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1000, y: 400, buttons: 0 });
    const p = await ev(`(()=>{const b=document.querySelector('.hd-hit[data-card="005"]').getBoundingClientRect();return{x:b.x+b.width/2,y:Math.min(innerHeight-25,b.y+35)}})()`);
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p, buttons: 0 });await delay(300);
    return ev(`(()=>{const b=document.querySelector('.hd-card[data-card="005"] .card-art').getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}})()`);
  };
  const begin = async (modifier = 0) => {
    const p = await point(); await mouse('mousePressed', p, modifier);
    const end = { x: p.x, y: p.y - 280 };
    for (let i = 1; i <= 5; i++) { await mouse('mouseMoved', { x: p.x, y: p.y - 56 * i }, modifier); await delay(15); }
    assert.equal((await inspect()).stuck, 2, 'drag is armed');
    return end;
  };
  let plays = 0;
  const drop = async (p, modifier, label) => {
    await mouse('mouseReleased', p, modifier); await settled(++plays, label); await delay(550);
  };
  // Normal drags keep their existing threshold and work with either Shift key.
  for (const mode of ['normal', 'shift-left', 'shift-right', 'shift-during', 'shift-released']) {
    for (let repeat = 0; repeat < 2; repeat++) {
      const held = ['shift-left', 'shift-right', 'shift-released'].includes(mode);
      const code = mode === 'shift-right' ? 'ShiftRight' : 'ShiftLeft';
      if (held) await shift(true, code);
      const p = await begin(held ? 8 : 0);
      if (mode === 'shift-during') await shift(true);
      if (mode === 'shift-released') await shift(false);
      await drop(p, mode === 'normal' || mode === 'shift-released' ? 0 : 8, `${mode} ${repeat + 1}`);
      await shift(false, code);
    }
  }
  // The observed failure: blur, release in another tab, return. No injected cleanup.
  for (const withShift of [false, true]) {
    if (withShift) await shift(true);
    await begin(withShift ? 8 : 0);
    const { targetId: otherId } = await browser.call('Target.createTarget', { url: 'about:blank', browserContextId });
    await browser.call('Target.activateTarget', { targetId: otherId }); await delay(150);
    await settled(plays, `tab blur cancels (${withShift ? 'Shift' : 'normal'})`);
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const other = await connect(pages.find(t => t.id === otherId).webSocketDebuggerUrl);
    await other.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 400, y: 300, button: 'left', buttons: 0, clickCount: 1 });
    other.close();await browser.call('Target.activateTarget', { targetId });await browser.call('Target.closeTarget', { targetId: otherId });
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1000, y: 300, buttons: 0 });await shift(false);
    await settled(plays, 'return does not play an interrupted card');
    await drop(await begin(), 0, 'normal drag after tab interruption');
  }
  // Lost capture without a window blur: the browser's native lost event must also cancel.
  let p = await begin();
  await ev(`document.querySelector('.hd-hit[data-card="005"]').releasePointerCapture(1)`);
  await mouse('mouseMoved', { x: p.x + 2, y: p.y });
  await mouse('mouseReleased', p);await settled(plays, 'lost capture cancels');
  await drop(await begin(), 0, 'normal drag after capture loss');
  // One pointer owns the drag; unrelated releases/cancels must not end it.
  p = await begin();
  await ev(`window.dispatchEvent(new PointerEvent('pointerup',{pointerId:99,button:0}));window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:99}))`);
  assert.equal((await inspect()).stuck, 2);
  await drop(p, 0, 'unrelated pointer ignored');
  for (const [name, interrupt] of [
    ['pointer cancel', `window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1}))`],
    ['missing release', `window.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,buttons:0}))`],
    ['page hidden', `Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden`],
    ['pagehide', `window.dispatchEvent(new Event('pagehide'))`],
    ['escape', `window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`],
    ['card removed', `fixture.hud.setState({...fixture.state,hand:fixture.state.hand.filter(id=>id!=='005')},false)`],
    ['card becomes unavailable', `fixture.hud.setHandAvailability(new Map(fixture.state.hand.map(id=>[id,id==='005'?'blocked':''])))`],
  ]) {
    p = await begin(); await ev(interrupt);await mouse('mouseReleased', p);
    await settled(plays, name);
    await ev('fixture.hud.setHandAvailability(null);fixture.hud.setState(fixture.state,false)');await delay(300);
    await drop(await begin(), 0, `normal drag after ${name}`);
  }
  p = await begin();await mouse('mouseMoved', {x:-20,y:p.y});await mouse('mouseReleased', {x:-20,y:p.y});
  await settled(plays, 'release outside viewport cancels');
  // A tap or a short drag still does not play; rapid cancellation has no stale listeners.
  for(let i=0;i<3;i++){
    p=await point();await mouse('mousePressed',p);await mouse('mouseMoved',{x:p.x+3,y:p.y});await mouse('mouseReleased',{x:p.x+3,y:p.y});
    await settled(plays,'short gesture does not play');
  }
  // A presenter reset is the path used by multiplayer disconnect/reconnect.
  await ev(`(async()=>{
    const {createSpotlight}=await import('/src/play/spotlight.ts');
    window.makeTestPresenter=()=>createSpotlight({container:document.querySelector('#game'),map:fixture.map,hud:fixture.hud,cards:fixture.cards,lang:'zh',player:1,pace:.05,game:{sideName:s=>s?'苏联':'美国'}});
    window.testPresenter=makeTestPresenter();fixture.hud.root.classList.remove('play-readonly');
  })()`);
  p=await begin();await ev('testPresenter.dispose();fixture.hud.root.classList.add("play-readonly")');
  await mouse('mouseReleased',p);await settled(plays,'presenter disposal cancels old drag');
  await ev('window.testPresenter=makeTestPresenter();fixture.hud.root.classList.remove("play-readonly")');
  await drop(await begin(),0,'drag after presenter replacement');
  p=await begin();await ev('testPresenter.idle()');await mouse('mouseReleased',p);await settled(plays,'waiting cancels drag');
  await ev('testPresenter.dispose();fixture.hud.root.classList.remove("play-readonly")');
  // Disposal is idempotent, and late events cannot play into an obsolete hand.
  p=await begin();await ev('fixture.hud.dispose();fixture.hud.dispose()');await mouse('mouseReleased',p);
  await settled(plays,'HUD disposal cancels drag');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:results.length,results,errors},null,2));
} finally {
  client?.close();
  await browser.call('Target.disposeBrowserContext',{browserContextId});browser.close();
}
