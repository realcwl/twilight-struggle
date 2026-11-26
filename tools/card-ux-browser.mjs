// Browser integration checks. Run a private Chrome with --remote-debugging-port=9344 first.
// Only the page selected on this explicitly supplied test port is touched.
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
const port = process.env.SOLO_CDP_PORT ?? "9348";
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
const shot = async (name) => {
  await mkdir("/tmp/card-ux-check", { recursive: true });
  const s = await cdp("Page.captureScreenshot", { format: "png" });
  await writeFile(`/tmp/card-ux-check/${name}.png`, Buffer.from(s.data, "base64"));
};
await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 1600,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
try {
  await cdp('Page.bringToFront');
  await ev('window.__oldUX=true');
  await cdp('Page.navigate',{url:origin+'/game.html?pace=.05'});
  await until("!window.__oldUX && typeof window.game?.presenter==='function' && !!window.game.presenter()");
  await ev(`(async()=>{
    window.game.play.stop();window.game.presenter().dispose();
    const deck=await import('/src/cards/deck.ts');window.testDeck=deck;
    const {createSpotlight}=await import('/src/play/spotlight.ts');
    window.uxPresenter=createSpotlight({container:document.querySelector('#game'),map:game.map,hud:game.hud,cards:{face:deck.cardFace,back:deck.cardBack,fit:deck.fitCard,describe:deck.describeCard},lang:'zh',game:game.play,player:0,pace:.3});
    const s=game.play.match.s;s.inf.irn=[3,0];s.inf.can=[4,0];
    s.hands[0]=['106','082','004','008','034'];game.hud.setState(game.play.state,false);game.map.setState(game.play.mapState);
    await uxPresenter.idle();game.hud.hoverCard('106');
  })()`);
  await pause(600);
  const hover=async selector=>{const p=await ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await pause(450);};
  const country='.hd-card.is-up [data-country-ref="can"]';
  await hover(country);
  await until("document.querySelector('#card-term-help')?.matches(':popover-open')");
  assert.equal(await ev("document.querySelector('.wm-stage').dataset.inspected"),'can');
  assert.match(await ev("document.querySelector('.th-reference').textContent"),/美国.*4.*苏联.*0/);
  await shot('country-reference');
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:650,y:400});await pause(500);
  assert.equal(await ev("document.querySelector('.wm-stage').dataset.inspected"),undefined);
  await ev("game.hud.hoverCard('106')");await pause(450);
  await hover('.hd-card.is-up [data-card-ref="042"]');
  await until("!!document.querySelector('#card-term-help:not([hidden]) [data-preview-card=\"042\"]')");
  assert.equal(await ev("document.querySelector('.th-media').hidden"),true);
  assert.equal(await ev("document.querySelectorAll('.th-reference [data-term],.th-reference [data-card-ref]').length"),0);
  assert.equal(await ev("getComputedStyle(document.querySelector('.th-reference .effects p')).color"),'rgb(35, 34, 30)');
  assert.ok(await ev("(()=>{const a=document.querySelector('.hd-card.is-up .game-card').getBoundingClientRect(),b=document.querySelector('#card-term-help').getBoundingClientRect();return a.right<=b.left||b.right<=a.left})()"),'guide does not cover the source card');
  await shot('referenced-card');
  // Escape closes only the guide, without playing the card.
  await key('Escape');await pause(200);
  assert.ok(await ev("document.querySelector('#card-term-help').hidden"));
  assert.equal(await ev("document.querySelectorAll('.hd-card.is-drag,.hud.is-armed').length"),0);
  // Top-layer guide remains interactive inside the existing library dialog.
  await ev("(async()=>{const {mountCardLibrary}=await import('/src/cards/library.ts');await mountCardLibrary({trigger:false}).open('106');})()");
  await hover('.cl-detail-stage [data-card-ref="042"]');
  assert.ok(await ev("document.querySelector('#card-term-help').closest('dialog')?.open"));
  await click('.th-close');
  await click('.cl-close');
  // Actual map + production presenter, deterministic public roll data.
  const runRoll=`window.rollFinished=false;window.uxPresenter.roll({kind:'coup',by:1,card:'034',id:'irn',dice:[{side:1,value:6,mods:[{label:'行动点',n:4}],total:10}],bar:{label:'稳定度 2 ×2',n:4},need:1,chance:1,ok:true,text:'政变成功 · 净值 6',situation:{before:[3,0],after:[0,3],controlBefore:0,controlAfter:1,crisisBefore:5,crisisAfter:4}}).then(()=>{window.rollFinished=true;return uxPresenter.idle()})`;
  await cdp('Runtime.evaluate',{expression:runRoll});
  await until("!!document.querySelector('.sp-dice.has-situation.is-in')");
  assert.equal(await ev("getComputedStyle(document.querySelector('.sp-after')).visibility"),'hidden');
  await until("!!document.querySelector('.sp-dice.is-done')");
  assert.match(await ev("document.querySelector('.sp-country').textContent"),/美国.*3.*0.*苏联.*0.*3/);
  const layout=await ev(`(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};return{country:rect('.sp-country'),target:rect('.wm-plate[data-id="irn"]'),dice:rect('.sp-seats'),math:rect('.sp-math'),verdict:rect('.sp-verdict')}})()`);
  assert.ok(layout.target.right<layout.dice.x,'target node remains left of the dice');
  // The situation panel can sit below the dice; separation is not limited to the horizontal axis.
  assert.ok(layout.country.right<=layout.dice.x||layout.dice.right<=layout.country.x||layout.country.bottom<=layout.dice.y||layout.dice.bottom<=layout.country.y,'situation and dice do not overlap');
  assert.ok(layout.math.bottom<layout.verdict.y,'formula and verdict do not overlap');
  await shot('iran-coup');
  await until('window.rollFinished');
  await until("!document.querySelector('.sp-block:not([hidden])')");
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await pause(300);
  await cdp('Runtime.evaluate',{expression:runRoll});
  await until("!!document.querySelector('.sp-dice.is-done')");
  await pause(350);
  await shot('iran-coup-mobile');
  assert.ok(await ev("(()=>{const selectors=['.sp-country','.sp-dice-head','.sp-math','.sp-verdict'];return selectors.every(s=>{const r=document.querySelector(s).getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})})()"),'mobile situation and roll fit the viewport');
  assert.ok(await ev("(()=>{const a=document.querySelector('.sp-country').getBoundingClientRect(),b=document.querySelector('.wm-plate[data-id=\"irn\"]').getBoundingClientRect();return a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top})()"),'mobile country data does not cover Iran node');
  await until('window.rollFinished');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({countryMapHover:true,liveInfluence:true,referenceCard:true,modalGuide:true,noAccidentalPlay:true,coupSituation:true,nonOverlap:true,restoresInput:true,errors}));
} finally { ws.close(); }
