// Browser integration checks. Run a private Chrome with --remote-debugging-port=9344 first.
// Only the page selected on this explicitly supplied test port is touched.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const port = process.env.SOLO_CDP_PORT ?? "9344";
const origin = process.env.SOLO_ORIGIN ?? "http://127.0.0.1:5173";
const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = pages.find((p) => p.type === "page");
assert.ok(page, "private Chrome page required");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let serial = 0;
const pending = new Map(),
  errors = [];
ws.addEventListener("message", (e) => {
  const data = JSON.parse(e.data);
  if (data.id) {
    const p = pending.get(data.id);
    pending.delete(data.id);
    data.error ? p.reject(data.error) : p.resolve(data.result);
  } else if (data.method === "Runtime.exceptionThrown")
    errors.push(data.params.exceptionDetails);
  else if (
    data.method === "Runtime.consoleAPICalled" &&
    data.params.type === "error"
  )
    errors.push(data.params.args);
});
const cdp = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const ev = async (expression) => {
  const r = await cdp("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (expression, timeout = 25000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await ev(expression)) return;
    } catch (error) {
      if (!/context|navigated|Cannot find/i.test(JSON.stringify(error)))
        throw error;
    }
    await pause(150);
  }
  throw new Error(
    `Timed out: ${expression}\n${await ev("document.body.innerText.slice(-1800)")}`,
  );
};
const reload = async () => {
  await ev("window.__oldTestPage=true");
  await cdp("Page.reload", { ignoreCache: true });
  await until("!window.__oldTestPage && !!window.game?.play");
};
const clickXY = async (x, y) => {
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await cdp("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button: "left",
    clickCount: 1,
  });
  await cdp("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x,
    y,
    button: "left",
    clickCount: 1,
  });
};
const click = async (selector) => {
  const r = await ev(
    `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing ${selector}');const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`,
  );
  await clickXY(r.x, r.y);
};
const key = async (key) => {
  await cdp("Input.dispatchKeyEvent", {
    type: "keyDown",
    key,
    code: key,
    text: key === "Enter" ? "\r" : undefined,
    unmodifiedText: key === "Enter" ? "\r" : undefined,
    windowsVirtualKeyCode:
      key === "Enter" ? 13 : key === "Escape" ? 27 : undefined,
  });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key, code: key });
};
const dragCard = async (id) => {
  const r = await ev(
    `(()=>{const e=[...document.querySelectorAll('.hd-card')].find(e=>e.querySelector('[data-card="${id}"]')).nextElementSibling;const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:Math.min(innerHeight-25,r.y+35)};})()`,
  );
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", ...r });
  await pause(200);
  await cdp("Input.dispatchMouseEvent", {
    type: "mousePressed",
    ...r,
    button: "left",
    clickCount: 1,
  });
  for (let i = 1; i <= 10; i++) {
    await cdp("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: r.x,
      y: r.y - i * 30,
      button: "left",
      buttons: 1,
    });
    await pause(20);
  }
  await cdp("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: r.x,
    y: r.y - 300,
    button: "left",
    clickCount: 1,
  });
};

// Uses only a private browser's save. Checks actual play once, then controlled visual states.
const screenshot = async name => writeFile(`/tmp/passives-${name}.png`, Buffer.from((await cdp('Page.captureScreenshot', {format:'png'})).data, 'base64'));
const hover = async selector => {
  const point = await ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await cdp('Input.dispatchMouseEvent', {type:'mouseMoved', ...point});
};
const visible = selector => ev(`!!document.querySelector(${JSON.stringify(selector)})`);
const inside = selector => ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1})()`);
await cdp('Page.enable');
await cdp('Runtime.enable');
await cdp('Emulation.setFocusEmulationEnabled', {enabled:true});
await cdp('Emulation.setDeviceMetricsOverride', {width:1600,height:1000,deviceScaleFactor:1,mobile:false});
try {
  await cdp('Page.navigate', {url:origin+'/game.html?pace=.05'});
  await until('!!window.game?.play');
  await ev(`(()=>{game.play.stop();const s=game.play.snapshot;
    for(const list of [...s.hands,s.deck,s.discard,s.removed,s.future,s.inPlay]){const i=list.indexOf('106');if(i>=0)list.splice(i,1);}
    s.hands[0].push('106');s.phase='action';s.active=0;s.actions=[0,0];s.played=null;s.flags={};s.temp={};s.passiveSources=[];s.result=null;s.turn=1;s.round=1;s.vp=0;s.crisis=5;
    localStorage.setItem('coldwar.solo.v1.coldwar',JSON.stringify(s));})()`);
  await reload();
  await until(`!document.querySelector('.hud.play-wait') && document.querySelector('.hd-card [data-card="106"]')`);
  assert.equal(await ev("document.querySelectorAll('.ps-shelf:not([hidden])').length"),0);
  await pause(400);
  await dragCard('106');
  await until('!!document.querySelector(".sp-choice")');
  await click('.sp-half.ev');
  await until(`!!document.querySelector('.ps-mine [data-passive-card="106"]')`);
  assert.equal(await ev('game.play.snapshot.flags.norad'),true);
  assert.equal(await ev("game.play.state.passives.find(e=>e.card==='106').by"),0);
  assert.ok(await ev("game.play.snapshot.removed.includes('106')"));
  await screenshot('actual-play');
  await reload();
  await until(`!!document.querySelector('.ps-mine [data-passive-card="106"]')`);
  await ev(`(async()=>{game.play.stop();game.presenter().dispose();game.map.flyTo('home');
    window.baseState=game.play.snapshot;
    window.setPassives=async function(entries,animate=false){
      const {trackPassive}=await import('/src/game/solo/passives.ts');
      const m=game.play.match;m.s=structuredClone(baseState);m.s.passiveSources=[];m.s.flags={};m.s.temp={};m.s.played=null;
      for(const [card,by,key,temporary=false] of entries){m.s[temporary?'temp':'flags'][key]=true;trackPassive(m.s,card,by,key,temporary);}
      game.hud.setState(game.play.state,animate);
    };await setPassives([]);})()`);
  assert.equal(await ev("document.querySelectorAll('.ps-shelf:not([hidden])').length"),0);
  await ev("setPassives([['106',1,'norad']])");
  assert.equal(await visible('.ps-mine:not([hidden])'),false);
  assert.equal(await visible('.ps-theirs [data-passive-card="106"]'),true);
  await ev("setPassives([['106',1,'norad'],['025',0,'ops0',true]])");
  assert.equal(await ev("document.querySelectorAll('.ps-shelf:not([hidden])').length"),2);
  await hover('.ps-theirs .ps-item');
  await until("!document.querySelector('.ps-detail').hidden");
  assert.match(await ev("document.querySelector('.ps-by').textContent"),/对手打出.*苏联/);
  await hover('.ps-facts [data-term="control"]');
  await until("!!document.querySelector('.term-help:not([hidden])')");
  await hover('.term-help .th-body');
  await pause(450);
  assert.equal(await ev("document.querySelector('.ps-detail').hidden"),false,'term explanation keeps its parent open');
  await key('Escape');
  assert.equal(await visible('.term-help:not([hidden])'),false);
  await hover('.ps-detail-card');
  await key('Escape');
  assert.equal(await ev("document.querySelector('.ps-detail').hidden"),true);
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:1100,y:500});
  await hover('.ps-mine .ps-item');
  await until("!document.querySelector('.ps-detail').hidden");
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:1100,y:500});
  await pause(300);
  assert.equal(await ev("document.querySelector('.ps-detail').hidden"),true);
  await click('.ps-mine .ps-item');
  assert.equal(await ev("document.querySelector('.ps-detail').hidden"),false);
  await click('.ps-close');
  assert.equal(await ev("document.querySelector('.ps-detail').hidden"),true);
  await ev("setPassives([],true)");
  await pause(750);
  assert.equal(await ev("document.querySelectorAll('.ps-shelf:not([hidden]),.ps-ending').length"),0);
  await ev("setPassives([['106',0,'norad'],['025',0,'ops0',true],['027',0,'japan'],['059',1,'flower'],['017',1,'deGaulle']])");
  await pause(900);
  await screenshot('integrated');
  const overlap = await ev(`(()=>{const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;return [...document.querySelectorAll('.ps-shelf:not([hidden])')].flatMap(s=>[...document.querySelectorAll('.hud-corner,.op')].filter(p=>overlap(s.getBoundingClientRect(),p.getBoundingClientRect())).map(p=>p.className))})()`);
  assert.deepEqual(overlap,[],'shelves do not cover existing desktop panels');
  // The same public sources are interpreted relative to either online seat.
  await ev(`(async()=>{const {Hud}=await import('/src/hud/Hud.ts');const opts=game.hud.opts;game.hud.dispose();game.hud=Hud.create(document.getElementById('game'),{...opts,player:1});game.hud.setState(game.play.state,false)})()`);
  assert.equal(await visible('.ps-mine [data-passive-card="059"]'),true);
  assert.equal(await visible('.ps-theirs [data-passive-card="106"]'),true);
  for(const [width,height,mobile] of [[1366,768,false],[390,844,true]]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
    await pause(500);
    for(const side of ['mine','theirs']) {
      assert.ok(await inside(`.ps-${side}`),`${side} shelf fits ${width}px`);
      await click(`.ps-${side} .ps-item`);
      assert.ok(await inside('.ps-detail'),`detail fits ${width}px`);
      await screenshot(`${width}-${side}`);
      await click('.ps-close');
    }
  }
  await ev("setPassives([['106',0,'norad'],['025',0,'ops0',true],['027',0,'japan'],['021',0,'nato'],['023',0,'marshall'],['035',0,'formosan'],['065',0,'campDavid'],['086',0,'northSea'],['059',1,'flower'],['017',1,'deGaulle'],['016',1,'warsaw'],['031',1,'ops0',true],['044',1,'trap1'],['051',1,'ops1',true],['082',1,'hostage'],['087',1,'reformer']])");
  for(const side of ['mine','theirs']) {
    assert.ok(await inside(`.ps-${side}`));
    assert.ok(await ev(`(()=>{const row=document.querySelector('.ps-${side} .ps-row');return row.scrollWidth>row.clientWidth})()`));
  }
  assert.ok(await ev(`(()=>{const s=document.querySelector('.ps-mine').getBoundingClientRect(),p=document.querySelector('.hud-tr').getBoundingClientRect();return s.right<=p.left||s.left>=p.right||s.bottom<=p.top||s.top>=p.bottom})()`),'many effects stay clear of the status panel on a phone');
  await screenshot('390-full-shelves');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({realNORADPlay:true,reload:true,actualPlayerAttribution:true,bothPerspectives:true,emptyHidden:true,hoverAndNestedHelp:true,clickAndEscape:true,removal:true,responsive:[1600,1366,390],errors}));
} finally { ws.close(); }
