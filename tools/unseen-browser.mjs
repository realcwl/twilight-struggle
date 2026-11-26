// Undealt pile, opponent candidates, shared filtering and live updates in an isolated local HUD.
// Start Vite and a private Chrome on UNSEEN_CDP_PORT (default 9348), then run this file.
import assert from 'node:assert/strict';
const origin = process.env.UNSEEN_ORIGIN ?? 'http://127.0.0.1:5173';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'local test server only');
const port = process.env.UNSEEN_CDP_PORT ?? '9348';
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
    const [d,{Hud},{WorldMap},{COLDWAR_TRACKS},{Match},{mountCardLibrary}]=await Promise.all([
      import('/src/cards/deck.ts'),import('/src/hud/Hud.ts'),import('/src/map/WorldMap.ts'),import('/src/game/tracks.ts'),import('/src/game/solo/model.ts'),import('/src/cards/library.ts')]);
    document.querySelector('#lobby').hidden=true;document.querySelector('#game').hidden=false;document.querySelector('#loading').hidden=true;
    const [map]=await Promise.all([WorldMap.create(document.querySelector('#map'),'/maps/coldwar',{lang:'zh'}),d.cardFontsReady()]);
    const cards={face:d.cardFace,back:d.cardBack,fit:d.fitCard,describe:d.describeCard};
    const hud=Hud.create(document.querySelector('#game'),{lang:'zh',player:0,catalog:d.CARDS.length,rules:COLDWAR_TRACKS,sides:map.pack.scenario.sides,cards,demo:false,playFlight:false});
    const match=new Match(map.pack.scenario,18);
    hud.setState(match.hudState(0),false);map.setState(match.mapState());d.connectCardMap(map);
    window.fixture={map,hud,match,library:mountCardLibrary({trigger:false}),catalog:d.CARDS};
    hud.on('catalog',()=>fixture.library.open());
  })()`);
  await delay(500);
  const click = async selector => {
    const p = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    for (const type of ['mousePressed','mouseReleased']) await cdp('Input.dispatchMouseEvent',{type,...p,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});
    await delay(100);
  };
  const key = async key => {
    for (const type of ['keyDown','keyUp']) await cdp('Input.dispatchKeyEvent',{type,key,code:key,windowsVirtualKeyCode:key==='Escape'?27:key==='Enter'?13:0,...(key==='Enter'&&type==='keyDown'?{text:'\r',unmodifiedText:'\r'}:{})});
    await delay(100);
  };
  const select = async (selector, value) => {
    await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`);await delay(80);
  };
  const ids = () => ev(`[...document.querySelectorAll('.pb-grid > .slot')].map(e=>e.dataset.card)`);
  const candidates = () => ev('fixture.catalog.filter(c=>fixture.match.opponentCandidates(0).includes(c.id)).sort((a,b)=>b.value-a.value||Number(a.id)-Number(b.id)).map(c=>c.id)');
  const sync = () => ev('fixture.hud.setState(fixture.match.hudState(0),false)');
  const check = (condition,label) => {assert.ok(condition,label);results.push(label)};
  const candidateSelector = '.hc-candidates';
  const {writeFile} = await import('node:fs/promises');
  const checkHeader = async () => {
    check(await ev(`(()=>{const a=document.querySelector('.hc-all').getBoundingClientRect(),b=document.querySelector('.hc-candidates').getBoundingClientRect();return Math.abs(a.top-b.top)<1&&a.right<b.left&&[...document.querySelectorAll('.hc-btn')].every(e=>e.scrollWidth<=e.clientWidth+1)})()`),'catalog and candidate buttons sit side by side without overflowing');
  };
  await checkHeader();
  check(await ev(`document.querySelector('.hp-deck .hud-num').textContent===String(fixture.match.s.deck.length)&&document.querySelector('.hp-deck .hud-lb').textContent==='未发牌'`),'undealt pile displays the actual draw count');
  check(await ev(`!document.querySelector('.hp-deck [data-card]')&&document.querySelector('.hp-deck').tabIndex===-1`),'undealt pile has only a card back and no interactive identity list');
  await click('.hp-deck');
  check(await ev('document.querySelector(".hud-overlay").hidden'),'clicking the draw pile never reveals its cards');
  await writeFile('/tmp/card-counter-hud.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await click('.hc-all');
  check(await ev('document.querySelector("#card-library").open'),'full catalog button still opens all cards');
  await ev('document.querySelector("#card-library").close()');
  await click(candidateSelector);
  await until("!!document.querySelector('.pb-catalog')");
  assert.deepEqual(await ids(), await candidates());results.push('separate button opens possible opponent cards');
  check(await ev(`document.querySelector('.pb h2').textContent==='对手可能有的牌'`),'candidate dialog has the requested title');
  const layout = await ev(`(()=>{const a=[...document.querySelectorAll('.pb-grid > .slot')].slice(0,5).map(e=>{const r=e.getBoundingClientRect();return{top:r.top,width:r.width}});return{a,rem:parseFloat(getComputedStyle(document.documentElement).fontSize)}})()`);
  check(layout.a.slice(0,4).every(x=>x.top===layout.a[0].top)&&layout.a[4].top>layout.a[0].top,'desktop has four cards per row');
  check(layout.a[0].width>15*layout.rem*1.5,'cards are at least 50 percent larger than old pile thumbnails');
  await click('.pb .cl-filters input');await cdp('Input.insertText',{text:'五年'});await delay(100);
  check((await ids()).length===1,'search matches card title');
  await ev(`document.querySelector('.pb input').value='';document.querySelector('.pb input').dispatchEvent(new Event('input',{bubbles:true}))`);
  await select('.pb .cl-era','early');await select('.pb .cl-side','ussr');
  const expected = await ev('fixture.catalog.filter(c=>fixture.match.opponentCandidates(0).includes(c.id)&&c.era==="early"&&c.kind==="ussr").sort((a,b)=>b.value-a.value||Number(a.id)-Number(b.id)).map(c=>c.id)');
  assert.deepEqual(await ids(),expected);results.push('era and category filters combine');
  await ev('fixture.library.open()');await delay(150);
  await select('#card-library .cl-era','early');await select('#card-library .cl-side','ussr');
  const shared = await ev('[...document.querySelectorAll("#card-library .cl-tile")].map(e=>e.dataset.card).filter(id=>fixture.match.opponentCandidates(0).includes(id))');
  assert.deepEqual(await ids(),shared);results.push('same filters and results as the full card library');
  await ev('document.querySelector("#card-library").close()');
  const before = await ids();
  await ev('fixture.match.draw(1)');await sync();
  assert.deepEqual(await ids(),before);results.push('opponent drawing does not identify the drawn card');
  check(await ev(`document.querySelector('.hp-deck .hud-num').textContent===String(fixture.match.s.deck.length)`),'draw pile count updates independently from candidate count');
  await ev(`(()=>{const m=fixture.match,id=${JSON.stringify(before[0])};for(const pile of [m.s.deck,...m.s.hands]){const i=pile.indexOf(id);if(i>=0)pile.splice(i,1)}m.discard(id)})()`);await sync();
  assert.deepEqual(await ids(),before.slice(1));results.push('public discard updates the open list without resetting filters');
  await ev('fixture.match.s.removed.push(...fixture.match.s.deck.splice(0));fixture.match.draw(1)');await sync();
  check((await ids()).includes(before[0]),'previously seen card reappears immediately after reshuffling');
  await select('.pb .cl-era','late');
  check((await ids()).length===0,'future-era filter cannot expose future cards');
  check(await ev('document.querySelector(".pb-none").textContent.includes("没有符合条件")'),'filtered empty state is clear');
  await select('.pb .cl-era','middle');await select('.pb .cl-side','all');
  await ev('fixture.match.s.turn=3;fixture.match.nextTurn()');await sync();
  check((await ids()).length>0,'new era updates current filter live');
  await select('.pb .cl-era','all');
  await delay(150);
  const desktop = await cdp('Page.captureScreenshot',{format:'png'});
  await writeFile('/tmp/unseen-cards-desktop.png',Buffer.from(desktop.data,'base64'));
  await click('.pb-x');check(await ev('document.querySelector(".hud-overlay").hidden'),'close button works');
  await ev(`document.querySelector('${candidateSelector}').focus()`);await key('Enter');
  check(await ev('!!document.querySelector(".pb-catalog")'),'keyboard can open the card counter');
  await key('Escape');check(await ev('document.querySelector(".hud-overlay").hidden'),'Escape closes list');
  check(await ev(`document.activeElement.matches('${candidateSelector}')`),'closing returns keyboard focus to the candidate button');
  const pileId = await ev('(()=>{const id=fixture.match.s.hands[1][0];fixture.match.take(id,1);fixture.match.settle(id,1,false);return id})()');await sync();
  await click('.hp-discard');
  check(await ev('!document.querySelector(".pb .cl-filters")'),'discard browser retains its existing layout');
  check((await ids())[0]===pileId,'discard order still newest first');await key('Escape');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(250);
  await checkHeader();
  await click(candidateSelector);
  const mobile = await ev(`(()=>{const p=document.querySelector('.pb').getBoundingClientRect();const a=[...document.querySelectorAll('.pb-grid>.slot')].slice(0,3).map(e=>e.getBoundingClientRect().top);const g=document.querySelector('.pb-grid');return{left:p.left,right:p.right,a,overflow:g.scrollWidth>g.clientWidth+1,scroll:g.scrollHeight>g.clientHeight}})()`);
  check(mobile.left>=0&&mobile.right<=391&&!mobile.overflow,'mobile dialog fits without horizontal overflow');
  check(mobile.a[0]===mobile.a[1]&&mobile.a[2]>mobile.a[0]&&mobile.scroll,'mobile has two columns with scrollable cards');
  await writeFile('/tmp/unseen-cards-mobile.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await ev('fixture.match.s.discard.push(...fixture.match.s.deck.splice(0),...fixture.match.s.hands[1].splice(0))');await sync();
  check((await ids()).length===0&&await ev('document.querySelector(".pb-none").textContent.includes("当前没有")'),'fully exhausted pool has no catalog fallback');
  check(errors.length===0, 'no browser exceptions');
  console.log(JSON.stringify({checks:results.length,results,desktopCardWidth:layout.a[0].width,screenshots:['/tmp/unseen-cards-desktop.png','/tmp/unseen-cards-mobile.png']},null,2));
} finally {
  client?.close();await browser.call('Target.disposeBrowserContext',{browserContextId});browser.close();
}
