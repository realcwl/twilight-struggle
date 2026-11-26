// Browser integration checks. Run a private Chrome with --remote-debugging-port=9344 first.
// Only the page selected on this explicitly supplied test port is touched.
import assert from "node:assert/strict";
import { writeFile, mkdir, readdir, readFile } from "node:fs/promises";
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

const screenshot = async name => writeFile(`/tmp/battle-log-${name}.png`,Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
await cdp('Page.enable'); await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
await cdp('Emulation.setFocusEmulationEnabled',{enabled:true});
try {
  await cdp('Page.navigate',{url:origin+'/game.html?pace=.05'});
  await until('!!window.game?.play');
  await ev(`(async()=>{
    game.play.stop(); game.presenter().dispose();
    document.querySelectorAll('.solo-dialog,.solo-result').forEach(e=>e.remove());
    const {SoloGame}=await import('/src/game/solo/engine.ts');
    const {headlessPresenter}=await import('/src/game/solo/headless.ts');
    const sample=new SoloGame({scenario:game.map.pack.scenario,lang:'zh',seed:8,onChange(){}});
    await sample.start(headlessPresenter(sample));
    game.play.match.s=sample.snapshot;game.hud.setState(game.play.state,false);game.map.setState(game.play.mapState);game.map.flyTo('home');
    window.battleFixture=sample.snapshot.battleLog;
  })()`);
  await pause(700);
  await screenshot('entry');
  assert.match(await ev("document.querySelector('.bl-open').getAttribute('aria-label')"),/战斗日志/);
  assert.equal(await ev("document.querySelector('.pl-hint')"),null);
  await click('.bl-open');
  assert.ok(await ev("document.querySelector('.bl-dialog').open"));
  const id=await ev("battleFixture.findLast(e=>e.verb==='coup').id");
  await ev(`document.querySelector('[data-entry="${id}"]').scrollIntoView({block:'center'})`);
  await click(`[data-entry="${id}"]`);
  assert.match(await ev("document.querySelector('.bl-detail').innerText"),/骰点/);
  assert.equal(await ev("getComputedStyle(document.querySelector('.bl-card .effects p')).color"),'rgb(35, 34, 30)', 'card rules retain dark ink on paper');
  await screenshot('desktop');
  const initialScroll=await ev("document.querySelector('.bl-list').scrollTop");
  await ev("game.play.match.recordBattle({kind:'note',text:'浏览时追加记录'});game.hud.setState(game.play.state,false)");
  assert.equal(await ev("Number(document.querySelector('.bl-entry.selected').dataset.entry)"),id);
  assert.equal(await ev("document.querySelector('.bl-list').scrollTop"),initialScroll);
  await click('.bl-sides [data-side="0"]');
  assert.ok(await ev("[...document.querySelectorAll('.bl-entry')].every(n=>battleFixture.find(e=>e.id===Number(n.dataset.entry))?.by===0)"));
  await ev("document.querySelector('.bl-turn').value='2';document.querySelector('.bl-turn').dispatchEvent(new Event('change'))");
  assert.ok(await ev("[...document.querySelectorAll('.bl-entry')].every(n=>battleFixture.find(e=>e.id===Number(n.dataset.entry))?.turn===2)"));
  await click('.bl-sides [data-side="all"]');
  await ev("document.querySelector('.bl-turn').value='all';document.querySelector('.bl-turn').dispatchEvent(new Event('change'));const box=document.querySelector('.bl-search');box.value='伊朗';box.dispatchEvent(new Event('input'))");
  assert.ok(await ev("document.querySelectorAll('.bl-entry').length>0"));
  assert.ok(await ev("[...document.querySelectorAll('.bl-entry')].every(n=>{const e=battleFixture.find(e=>e.id===Number(n.dataset.entry));return e.title.includes('伊朗')||e.lines.some(l=>l.text.includes('伊朗'))})"));
  await screenshot('search');
  await ev("document.querySelector('.bl-search').value='no-such-record';document.querySelector('.bl-search').dispatchEvent(new Event('input'))");
  assert.equal(await ev("document.querySelectorAll('.bl-entry').length"),0);
  await ev("document.querySelector('.bl-search').value='';document.querySelector('.bl-search').dispatchEvent(new Event('input'))");
  const downloadPath=`/tmp/battle-downloads-${Date.now()}`;
  await mkdir(downloadPath,{recursive:true});
  await cdp('Browser.setDownloadBehavior',{behavior:'allow',downloadPath});
  const before=new Set(await readdir(downloadPath));
  await click('.bl-export');
  let downloaded;
  for(let i=0;i<30;i++){downloaded=(await readdir(downloadPath)).find(f=>!before.has(f)&&f.endsWith('.txt'));if(downloaded)break;await pause(100);}
  assert.ok(downloaded); const exported=await readFile(downloadPath+'/'+downloaded,'utf8');
  assert.match(exported,/第 1 回合/);assert.match(exported,/第 10 回合/);assert.match(exported,/骰点/);
  await click('.bl-close');assert.equal(await ev("document.querySelector('.bl-dialog').open"),false);
  await key('Enter');assert.equal(await ev("document.querySelector('.bl-dialog').open"),true);
  await key('Escape');assert.equal(await ev("document.querySelector('.bl-dialog').open"),false);
  await click('.bl-open');
  await ev(`document.querySelector('[data-entry="${id}"]').scrollIntoView({block:'center'})`);
  await click(`[data-entry="${id}"]`);
  const term=await ev("(()=>{const el=document.querySelector('.bl-lines [data-term]');el.scrollIntoView({block:'center'});return el.dataset.term})()");
  await click(`.bl-lines [data-term="${term}"]`);
  await until("!!document.querySelector('.term-help:not([hidden])')");
  assert.ok(await ev("!!document.querySelector('.bl-dialog .term-help')"));
  await key('Escape');
  assert.equal(await ev("document.querySelector('.bl-dialog').open"),true);
  await key('Escape');
  assert.equal(await ev("document.querySelector('.bl-dialog').open"),false);
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await pause(250);await click('.bl-open');
  await ev(`document.querySelector('[data-entry="${id}"]').scrollIntoView({block:'center'})`);await click(`[data-entry="${id}"]`);
  await screenshot('mobile');
  assert.ok(await ev("(()=>{const d=document.querySelector('.bl-dialog'),r=d.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&d.scrollWidth<=d.clientWidth+1})()"));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({entries:await ev('battleFixture.length'),openClose:true,keyboard:true,sideAndTurnFilters:true,search:true,export:true,nestedTermHelp:true,reviewPositionPreserved:true,mobile:true,errors}));
} finally {ws.close();}
