// Browser integration checks. Run a private Chrome with --remote-debugging-port=9344 first.
// Only the page selected on this explicitly supplied test port is touched.
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
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
const shot = async (name) => {
  await mkdir("/tmp/solo-check", { recursive: true });
  const s = await cdp("Page.captureScreenshot", { format: "png" });
  await writeFile(`/tmp/solo-check/${name}.png`, Buffer.from(s.data, "base64"));
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
  await cdp("Page.navigate", { url: `${origin}/game.html?pace=0.05` });
  await until("!!window.game?.play");
  await ev("localStorage.removeItem('coldwar.solo.v1.coldwar')");
  await reload();
  await until(
    '!!window.game?.play && !!document.querySelector(".solo-dialog[open]")',
  );
  assert.equal(await ev("window.game.play.snapshot.phase"), "setup");
  await click(".solo-dialog button");
  await until('document.querySelector(".wm-plate.pl-ok")');
  // The same real country clicks used by the polished placement interaction.
  await ev("window.game.map.flyTo('europe',{fit:true})");
  await pause(1000);
  for (const [id, n] of [
    ["frg", 4],
    ["ita", 3],
  ])
    for (let i = 0; i < n; i++) {
      await click(`.wm-plate[data-id="${id}"]`);
      await pause(100);
    }
  await key("Enter");
  await until(
    'window.game.play.snapshot.phase === "headline" && !document.querySelector(".hud.play-wait")',
  );
  await shot("opening");
  const before = await ev("window.game.play.snapshot");
  assert.equal(before.inf.frg[0], 4);
  assert.equal(before.inf.ita[0], 3);
  assert.equal(before.hands[0].length, 8);
  // Drag a real hand card out to select a headline.
  // Seed a legal, predictable opening to keep UI assertions independent of the shuffled hand.
  await ev(
    `(()=>{const s=window.game.play.snapshot;const give=(id,side)=>{for(const a of [...s.hands,s.deck,s.discard,s.removed,s.future]){const at=a.indexOf(id);if(at>=0)a.splice(at,1);}s.hands[side].push(id);};give('018',0);give('008',0);give('025',0);give('034',1);s.phase='headline';localStorage.setItem('coldwar.solo.v1.coldwar',JSON.stringify(s));})()`,
  );
  await reload();
  await until(
    '!!window.game?.play && window.game.play.snapshot.phase === "headline" && !document.querySelector(".hud.play-wait")',
  );
  await pause(500);
  await dragCard("018");
  // Some Soviet headlines ask the US to discard; acknowledge only these genuine card choices.
  for (let i = 0; i < 120; i++) {
    if (
      await ev(
        'window.game.play.snapshot.phase === "action" && window.game.play.snapshot.active === 0 && !document.querySelector(".hud.play-wait") && !document.querySelector("dialog[open]")',
      )
    )
      break;
    if (await ev('!!document.querySelector(".solo-dialog[open] button")'))
      await click(".solo-dialog[open] button");
    await pause(200);
  }
  await until(
    'window.game.play.snapshot.phase === "action" && window.game.play.snapshot.active === 0 && !document.querySelector(".hud.play-wait")',
  );
  assert.equal(await ev("window.game.play.snapshot.space[0]"), 1);
  await shot("action-ready");
  // Open the existing action selector, back out, then reopen it and use the event.
  await dragCard("025");
  await until('!!document.querySelector(".sp-choice")');
  await shot("action-choice");
  await click(".sp-back");
  await until('!document.querySelector(".sp-choice")');
  await dragCard("025");
  await until('!!document.querySelector(".sp-choice")');
  await click(".sp-half.ev");
  await until("window.game.play.snapshot.actions[0] >= 1");
  assert.equal(await ev("window.game.play.snapshot.temp.ops0"), 1);
  // Reload the last completed action; the same game continues instead of resetting to a demo.
  const checkpoint = await ev(
    "JSON.parse(localStorage.getItem('coldwar.solo.v1.coldwar'))",
  );
  await reload();
  await until("!!window.game?.play");
  assert.equal(await ev("window.game.play.snapshot.seed"), checkpoint.seed);
  assert.ok(
    (await ev("window.game.play.snapshot.actions[0]")) >= checkpoint.actions[0],
  );
  // A legal near-victory fixture, played through drag -> original event control -> victory screen.
  await ev(
    `(()=>{window.game.play.stop();const s=JSON.parse(localStorage.getItem('coldwar.solo.v1.coldwar'));for(const a of [...s.hands,s.deck,s.discard,s.removed,s.future]){const at=a.indexOf('065');if(at>=0)a.splice(at,1);}s.hands[0].push('065');s.played=null;s.phase='action';s.active=0;s.actions=[0,0];s.vp=19;s.crisis=3;s.flags={};s.temp={};localStorage.setItem('coldwar.solo.v1.coldwar',JSON.stringify(s));})()`,
  );
  await reload();
  await until(
    '!!window.game?.play && window.game.play.snapshot.vp===19 && !document.querySelector(".hud.play-wait")',
  );
  await pause(300);
  await dragCard("065");
  await until('!!document.querySelector(".sp-choice")');
  await click(".sp-half.ev");
  await until('!!document.querySelector(".solo-result[open]")');
  assert.equal(await ev("window.game.play.result.winner"), 0);
  assert.equal(await ev("window.game.play.result.reason"), "vp");
  await shot("us-victory");
  // Restart is available from the terminal screen; a second match actually deals fresh cards.
  await click(".solo-result > button:last-child");
  await until(
    'window.game.play.snapshot.phase === "setup" && !!document.querySelector(".solo-dialog[open]")',
  );
  assert.equal(await ev("window.game.play.snapshot.vp"), 0);
  assert.equal(await ev("window.game.play.snapshot.hands[0].length"), 8);
  await ev(
    `(()=>{window.game.play.stop();const s=JSON.parse(localStorage.getItem('coldwar.solo.v1.coldwar'));for(const a of [...s.hands,s.deck,s.discard,s.removed,s.future]){const at=a.indexOf('055');if(at>=0)a.splice(at,1);}s.discard.push(...s.hands[1]);s.hands[1]=['055'];s.phase='action';s.active=1;s.actions=[0,0];s.vp=-19;s.crisis=5;s.flags={};s.temp={};localStorage.setItem('coldwar.solo.v1.coldwar',JSON.stringify(s));})()`,
  );
  await reload();
  await until(
    '!!document.querySelector(".solo-result[open]") && window.game.play.result.winner===1',
  );
  assert.equal(await ev("window.game.play.result.reason"), "vp");
  await shot("ussr-victory");
  // Turn-ten cleanup runs the real final scoring and survives a page reload in its terminal state.
  await ev(
    `(()=>{window.game.play.stop();const s=JSON.parse(localStorage.getItem('coldwar.solo.v1.coldwar'));for(const h of s.hands){s.discard.push(...h);h.splice(0);}for(const id in s.inf)s.inf[id]=[0,0];s.phase='cleanup';s.result=null;s.turn=10;s.vp=0;s.milops=[5,5];s.china.owner=1;localStorage.setItem('coldwar.solo.v1.coldwar',JSON.stringify(s));})()`,
  );
  await reload();
  await until(
    '!!document.querySelector(".solo-result[open]") && window.game.play.result.reason==="final"',
  );
  assert.equal(await ev("window.game.play.snapshot.vp"), -1);
  await reload();
  await until(
    '!!window.game?.play && !!document.querySelector(".solo-result[open]")',
  );
  assert.equal(await ev("window.game.play.snapshot.vp"), -1);
  await shot("final-scoring");
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  assert.ok(
    await ev(
      'document.querySelector(".solo-result").getBoundingClientRect().width <= innerWidth',
    ),
  );
  await shot("mobile-result");
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      opening: true,
      dragHeadline: true,
      cancelAndReplay: true,
      eventApplied: true,
      reload: true,
      usVictory: true,
      ussrVictory: true,
      finalScoring: true,
      reloadFinished: true,
      restart: true,
      mobileDialog: true,
      errors,
    }),
  );
} finally {
  ws.close();
}
