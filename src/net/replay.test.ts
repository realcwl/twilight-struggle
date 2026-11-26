import assert from "node:assert/strict";
import { test } from "node:test";
import rawScenario from "../../data/scenarios/coldwar/scenario.json";
import type { Scenario } from "../map/types";
import { Match } from "../game/solo/model";
import { evaluate, newJournal, viewOf, type Evaluation } from "./replay";
import { SoloGame } from "../game/solo/engine";
import { trackPassive } from "../game/solo/passives";
import { testAnswer } from "./bot-test";
import { encode, decode } from "./protocol";
const scenario = rawScenario as unknown as Scenario;

test('both seats receive resolved region scores and Shuttle choice survives reconnect', async () => {
  for (const excluded of ['jpn', 'prk']) {
    const j=newJournal(scenario,12),s=j.checkpoint;
    Object.assign(s,{phase:'action',active:1,round:1});
    for(const id of ['001','073'])for(const pile of [...s.hands,s.deck,s.discard,s.removed,s.future,s.inPlay]){
      const at=pile.indexOf(id);if(at>=0)pile.splice(at,1);
    }
    s.hands[1].push('001');s.inPlay.push('073');for(const id of Object.keys(s.inf))s.inf[id]=[0,0];
    s.inf.jpn=[0,4];s.inf.prk=[0,3];s.flags.shuttle=true;
    let e=await evaluate(scenario,j);
    const expected=new Match(scenario,0,e.state).scoring('asia');
    for(const view of e.views)assert.deepEqual(view.map.regions.asia.scoring!.totals,expected.totals);
    assert.deepEqual(decode(encode(e.views[0].map)),e.views[1].map,'public scoring preview serializes identically for both seats');
    e.journal.answers[e.prompts[0].id]={card:'001',use:'event'};e=await evaluate(scenario,e.journal);
    assert.equal(e.prompts[0].side,0,'US chooses even when USSR plays the scoring card');
    assert.equal(e.prompts[0].method,'choose');assert.match(e.prompts[0].args[0].title,/穿梭外交/);
    assert.deepEqual((await evaluate(scenario,e.journal)).prompts,e.prompts);
    e.journal.answers[e.prompts[0].id]=excluded;e=await evaluate(scenario,e.journal);
    const frame=e.frames.find(f=>f.method==='score')!;
    assert.ok(frame);assert.equal(frame.audience,'all');assert.equal(frame.args[0].shuttleCountry,excluded);
    assert.equal(e.state.vp,excluded==='jpn'?-4:-5);
    assert.equal(e.state.flags.shuttle,undefined);
    assert.deepEqual(e.views[0].map.regions.asia.scoring!.totals,[0,6],'next preview has no already-consumed modifier');
    const restored=await evaluate(scenario,e.journal);assert.deepEqual(restored.state,e.state);assert.equal(restored.frames.length,0);
  }
});
async function advance(e: Evaluation, index = 0) {
  const p = e.prompts[index];
  const j = structuredClone(e.journal);
  j.answers[p.id] = await testAnswer(
    p,
    e.views[p.side],
    scenario,
    e.observations[p.side],
  );
  return evaluate(scenario, j);
}

test('Olympics asks the opponent, broadcasts contest dice to both seats, and resumes without replaying awards', async () => {
  for (const host of [0, 1] as const) {
    const j = newJournal(scenario, 12), s = j.checkpoint;
    Object.assign(s, { phase: 'action', active: host, round: 1 });
    for (const pile of [...s.hands, s.deck, s.discard, s.removed, s.future, s.inPlay]) {
      const i = pile.indexOf('020'); if (i >= 0) pile.splice(i, 1);
    }
    s.hands[host].push('020');
    let e = await evaluate(scenario, j);
    assert.equal(e.prompts[0].side, host);
    e.journal.answers[e.prompts[0].id] = { card: '020', use: 'event' };
    e = await evaluate(scenario, e.journal);
    assert.equal(e.prompts[0].side, 1 - host);
    assert.equal(e.prompts[0].method, 'choose');
    assert.match(e.prompts[0].args[0].title, /奥运会/);
    assert.ok(!e.frames.some(f => f.method === 'roll'));
    assert.deepEqual((await evaluate(scenario, e.journal)).prompts, e.prompts);
    e.journal.answers[e.prompts[0].id] = 'participate';
    e = await evaluate(scenario, e.journal);
    const rolls = e.frames.filter(f => f.method === 'roll');
    assert.ok(rolls.length > 0);
    assert.ok(rolls.every(f => f.audience === 'all' && f.args[0].kind === 'contest'));
    assert.ok(rolls.every(f => f.views.every(v => v.hud.vp === 0)));
    assert.equal(Math.abs(e.views[0].hud.vp), 2);
    assert.equal(e.views[0].hud.vp, e.views[1].hud.vp);
    const restored = await evaluate(scenario, e.journal);
    assert.deepEqual(restored.state, e.state);
    assert.equal(restored.frames.length, 0);
    new Match(scenario, undefined, e.journal.checkpoint).validate();
  }
});

test('war checks and trap escapes broadcast public dice before effects and survive deterministic replay', async () => {
  for (const side of [0, 1] as const) for (const trapped of [false, true]) {
    const j = newJournal(scenario, 12), s = j.checkpoint, card = trapped ? '025' : '024';
    Object.assign(s, { phase: 'action', active: side, round: 1 });
    for (const pile of [...s.hands, s.deck, s.discard, s.removed, s.future, s.inPlay]) {
      const i = pile.indexOf(card); if (i >= 0) pile.splice(i, 1);
    }
    s.hands[side].push(card);
    if (trapped) s.flags[`trap${side}`] = true;
    else s.inf.pak = side === 0 ? [1, 3] : [3, 1];
    const before = [...s.inf.pak];
    let e = await evaluate(scenario, j);
    if (!trapped) {
      e.journal.answers[e.prompts[0].id] = { card, use: 'event' };
      e = await evaluate(scenario, e.journal);
      assert.equal(e.prompts[0].method, 'pickTarget');
    } else assert.equal(e.prompts[0].method, 'choose');
    assert.equal(e.prompts[0].side, side);
    assert.deepEqual((await evaluate(scenario, e.journal)).prompts, e.prompts);
    e.journal.answers[e.prompts[0].id] = trapped ? card : 'pak';
    e = await evaluate(scenario, e.journal);
    const rolls = e.frames.filter(f => f.method === 'roll');
    assert.equal(rolls.length, 1);
    const frame = decode<typeof rolls[0]>(encode(rolls[0]));
    assert.equal(frame.audience, 'all'); assert.equal(frame.args[0].kind, 'check');
    assert.deepEqual(frame.args[0].range, trapped ? [1, 4] : [4, 6]);
    assert.equal(frame.args[0].by, side);
    if (!trapped) {
      assert.ok(frame.views.every(v => v.hud.vp === 0 && v.hud.milops[side] === 0));
      assert.ok(frame.views.every(v => JSON.stringify(v.map.countries.pak.influence) === JSON.stringify(before)));
      assert.deepEqual(e.views[0].map.countries.pak.influence, frame.args[0].situation.after);
    }
    const restored = await evaluate(scenario, e.journal);
    assert.deepEqual(restored.state, e.state); assert.equal(restored.frames.length, 0);
    assert.deepEqual(e.views[0].map, e.views[1].map);
    new Match(scenario, undefined, e.journal.checkpoint).validate();
  }
});

test('Summit broadcasts a single contest, then only the winner chooses DEFCON without replaying dice', async () => {
  const j = newJournal(scenario, 12), s = j.checkpoint;
  Object.assign(s, { phase: 'action', active: 0, round: 1 });
  for (const pile of [...s.hands, s.deck, s.discard, s.removed, s.future, s.inPlay]) {
    const i = pile.indexOf('045'); if (i >= 0) pile.splice(i, 1);
  }
  s.hands[0].push('045');
  let e = await evaluate(scenario, j);
  e.journal.answers[e.prompts[0].id] = { card: '045', use: 'event' };
  e = await evaluate(scenario, e.journal);
  const rolls = e.frames.filter(f => f.method === 'roll');
  assert.equal(rolls.length, 1); assert.equal(rolls[0].audience, 'all');
  const r = rolls[0].args[0]; assert.equal(r.kind, 'contest');
  if (r.winner !== null) {
    assert.equal(e.prompts[0].side, r.winner); assert.match(e.prompts[0].args[0].title, /峰会/);
    e.journal.answers[e.prompts[0].id] = 'stay';
    e = await evaluate(scenario, e.journal);
    assert.equal(e.frames.filter(f => f.method === 'roll').length, 0);
    assert.equal(e.views[0].hud.vp, r.winner === 0 ? 2 : -2);
  } else assert.equal(e.views[0].hud.vp, 0);
  const restored = await evaluate(scenario, e.journal);
  assert.deepEqual(restored.state, e.state); assert.equal(restored.frames.length, 0);
});
test("both seats deploy; headlines are simultaneous and private; replay is deterministic", async () => {
  let e = await evaluate(scenario, newJournal(scenario, 42));
  assert.equal(e.prompts[0].side, 1);
  assert.equal(e.prompts[0].method, "place");
  e = await advance(e);
  assert.equal(e.prompts[0].side, 0);
  e = await advance(e);
  while (e.prompts[0]?.method !== "pickHeadline") e = await advance(e);
  assert.equal(e.prompts.length, 2);
  assert.ok(e.prompts.every((p) => p.method === "pickHeadline"));
  const original = structuredClone(e),
    p = e.prompts[0];
  e = await advance(e);
  assert.equal(e.prompts.length, 1);
  assert.equal(e.prompts[0].side, 1 - p.side);
  assert.deepEqual(
    e.views[1 - p.side].hud.hand,
    original.views[1 - p.side].hud.hand,
  );
  assert.equal(
    e.frames.some((f) => f.method === "showHeadline"),
    false,
  );
  assert.deepEqual(e.views[0].hud.battleLog, e.views[1].hud.battleLog);
  assert.deepEqual(e.views[1 - p.side].hud.opponentCandidates, original.views[1 - p.side].hud.opponentCandidates, 'candidate list does not disclose a privately selected headline');
  for (const frame of e.frames) for (const [side, view] of frame.views.entries()) {
    assert.deepEqual(view.hud.opponentCandidates, original.views[side].hud.opponentCandidates, 'animation frames also conceal a sealed headline');
  }
  assert.equal(e.views[0].hud.battleLog?.some(entry => entry.kind === 'card'), false, 'a privately selected headline is not public history');
  const selected = e.journal.answers[p.id] as string;
  assert.deepEqual(e.views[p.side].headline, { mine: selected, theirs: false });
  assert.deepEqual(e.views[1 - p.side].headline, { mine: null, theirs: true });
  assert.equal(e.views[p.side].hud.hand.includes(selected), false, 'submitted headline is on the table, not in the visible hand');
  assert.equal(e.views[1 - p.side].hud.opponentHand, original.views[1 - p.side].hud.opponentHand - 1);
  assert.ok(e.state.hands[p.side].includes(selected), 'sealed selection leaves engine ownership unchanged until reveal');
  const restored = await evaluate(
    scenario,
    JSON.parse(JSON.stringify(e.journal)),
  );
  assert.deepEqual(restored.state, e.state);
  assert.deepEqual(restored.prompts, e.prompts);
  assert.deepEqual(restored.views, e.views, 'sealed table state survives replay and reconnect');
  assert.equal(restored.frames.length, 0);
  e = await advance(e);
  assert.ok(e.frames.some((f) => f.method === "showHeadline"));
  assert.ok(e.frames.find(f => f.method === 'showHeadline')!.views.every(v => v.headline === undefined));
  assert.ok(e.views[0].hud.battleLog?.some(entry => entry.lines.some(l => l.text.includes('双方揭示头条'))));
  assert.ok(e.frames.every(f => f.views.every(v => v.hud.battleLog === undefined)), 'full history is not duplicated in every animation frame');
  assert.notDeepEqual(e.views[0].hud.hand, e.views[1].hud.hand);
  new Match(scenario, undefined, e.journal.checkpoint).validate();
});
test('either seat can seal the first headline without exposing its identity to the opponent', async () => {
  for (const side of [0, 1] as const) {
    const j = newJournal(scenario, 42);
    j.checkpoint.phase = 'headline';
    let e = await evaluate(scenario, j);
    const p = e.prompts.find(p => p.side === side)!;
    e = await advance(e, e.prompts.indexOf(p));
    const id = e.journal.answers[p.id] as string;
    assert.deepEqual(e.views[side].headline, { mine: id, theirs: false });
    assert.deepEqual(e.views[1 - side].headline, { mine: null, theirs: true });
    assert.equal(e.views[side].hud.hand.includes(id), false);
    assert.equal(e.prompts.length, 1);
    assert.equal(e.prompts[0].side, 1 - side);
  }
});
test("illegal deployment never mutates the saved checkpoint", async () => {
  const e = await evaluate(scenario, newJournal(scenario, 41)),
    before = structuredClone(e.journal),
    j = structuredClone(before);
  j.answers[e.prompts[0].id] = { accept: true, ids: ["usa"] };
  await assert.rejects(evaluate(scenario, j), /不合法/);
  assert.deepEqual(e.journal, before);
  const short = structuredClone(before);
  short.answers[e.prompts[0].id] = { accept: true, ids: [] };
  await assert.rejects(evaluate(scenario, short), /用完/);
});
test("wire format preserves target maps without full state", async () => {
  const e = await evaluate(scenario, newJournal(scenario, 1));
  const wire = decode<any>(
    encode({ view: e.views[1], prompt: e.prompts[0], options: e.options[1] }),
  );
  assert.ok(wire.prompt.args[0].targets instanceof Map);
  assert.equal(wire.view.rng, undefined);
  assert.equal(wire.view.hands, undefined);
  assert.equal(typeof wire.view.hud.deck, "number");
});
test("both online seats receive public passive sources without rewriting who played the card", () => {
  const g = new SoloGame({ scenario, lang: "zh", seed: 1, onChange() {} });
  // A Soviet player can activate the US NORAD event by playing its card for operations.
  g.match.s.flags.norad = true;
  trackPassive(g.match.s, "106", 1, "norad", false);
  g.match.s.temp.ops0 = 1;
  trackPassive(g.match.s, "025", 0, "ops0", true);
  for (const side of [0, 1] as const) {
    const view = decode<any>(encode(viewOf(g, side)));
    assert.deepEqual(view.hud.passives.map((e: any) => [e.card, e.by]), [["106", 1], ["025", 0]]);
    assert.deepEqual(view.hud.hand, g.match.hand(side));
    assert.equal(view.hands, undefined);
    assert.equal(view.rng, undefined);
  }
});
for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  test(`two human-input seats finish a valid match, seed ${seed}`, async () => {
    let e = await evaluate(scenario, newJournal(scenario, seed)),
      steps = 0,
      maxTurn = 0;
    while (!e.views[0].result && steps++ < 1200) {
      assert.ok(e.prompts.length, `no prompt at ${e.state.phase}`);
      e = await advance(e, steps % e.prompts.length);
      maxTurn = Math.max(maxTurn, e.state.turn);
      new Match(scenario, undefined, e.journal.checkpoint).validate();
      if (steps % 13 === 0) {
        const restored = await evaluate(scenario, e.journal);
        assert.deepEqual(restored.state, e.state);
        e = restored;
      }
    }
    assert.ok(e.views[0].result, `stalled at ${steps}`);
    assert.deepEqual(e.views[0].result, e.views[1].result);
    console.log(
      JSON.stringify({ seed, steps, maxTurn, result: e.views[0].result }),
    );
  });

test("resigning in the middle of a private event produces a valid durable result", async () => {
  const { resign } = await import("./replay");
  let e = await evaluate(scenario, newJournal(scenario, 3));
  for (let i = 0; i < 35; i++) {
    const ended = resign(scenario, e, 0);
    new Match(scenario, undefined, ended.journal.checkpoint).validate();
    const restored = await evaluate(scenario, ended.journal);
    assert.equal(restored.views[1].result?.winner, 1);
    assert.equal(restored.prompts.length, 0);
    if (e.views[0].result) break;
    e = await advance(e);
  }
});

test('both network seats enforce scoring deadlines and reject stale non-scoring plays without consuming a card', async () => {
  for (const side of [0,1] as const) {
    const j = newJournal(scenario, 12), s = j.checkpoint;
    Object.assign(s, {phase:'action',active:side,round:5});
    s.actions[side] = 4;
    for (const h of s.hands) s.discard.push(...h.splice(0));
    for (const card of ['001','002','025']) {
      for (const pile of [s.deck,s.discard,s.removed,s.future,s.inPlay]) {
        const i=pile.indexOf(card); if(i>=0)pile.splice(i,1);
      }
      s.hands[side].push(card);
    }
    let e = await evaluate(scenario,j);
    assert.equal(e.prompts[0].side,side);
    assert.ok(e.options[side]['025'].blocked);
    assert.deepEqual(new Set(e.observations[side].legalActions.map(a=>a.card)),new Set(['001','002']));
    const bad=structuredClone(e.journal);
    bad.answers[e.prompts[0].id]={card:'025',use:'ops',mode:'place'};
    await assert.rejects(evaluate(scenario,bad),/不合法/);
    assert.deepEqual(e.journal.checkpoint,s);
    e.journal.answers[e.prompts[0].id]={card:'001',use:'event'};
    e=await evaluate(scenario,e.journal);
    assert.ok(!e.state.hands[side].includes('001'));
    assert.ok(e.state.hands[side].includes('025'));
    assert.ok(e.frames.some(f=>f.method==='announce'&&f.args[0].card.id==='001'));
    const restored=await evaluate(scenario,e.journal);
    assert.deepEqual(restored.state,e.state);
    assert.equal(restored.frames.length,0);
  }
});

test('network coup options omit nuclear targets and the server rejects forged target choices',async()=>{
  for (const side of [0,1] as const) {
    const j=newJournal(scenario,12),s=j.checkpoint;
    Object.assign(s,{phase:'action',active:side,round:1,crisis:2});
    const card='025';
    for(const pile of [...s.hands,s.deck,s.discard,s.removed,s.future,s.inPlay]){
      const i=pile.indexOf(card);if(i>=0)pile.splice(i,1);
    }
    s.hands[side].push(card);
    for(const id of Object.keys(s.inf))s.inf[id]=[0,0];
    s.inf.ago[1-side]=2;s.inf.zwe[1-side]=2;
    let e=await evaluate(scenario,j);
    assert.ok(!e.options[side][card].coup.targets.has('ago'));
    assert.ok(e.options[side][card].coup.targets.has('zwe'));
    const forged=structuredClone(e.journal);
    forged.answers[e.prompts[0].id]={card,use:'ops',mode:'coup',target:'ago'};
    await assert.rejects(evaluate(scenario,forged),/不合法/);
    e.journal.answers[e.prompts[0].id]={card,use:'ops',mode:'coup'};
    e=await evaluate(scenario,e.journal);
    // An opponent-owned card may first ask which event order to use.
    while(e.prompts[0].method==='choose'){
      const p=e.prompts[0],options=p.args[0].options;
      assert.ok(options.some((x:{id:string})=>x.id==='after'));
      e.journal.answers[p.id]='after';e=await evaluate(scenario,e.journal);
    }
    assert.equal(e.prompts[0].method,'pickTarget');
    assert.ok(!e.prompts[0].args[0].targets.has('ago'));
    const badTarget=structuredClone(e.journal);badTarget.answers[e.prompts[0].id]='ago';
    await assert.rejects(evaluate(scenario,badTarget),/不合法/);
    e.journal.answers[e.prompts[0].id]='zwe';e=await evaluate(scenario,e.journal);
    assert.equal(e.state.crisis,2);assert.equal(e.state.result,null);
    assert.ok(e.frames.some(f=>f.method==='roll'&&f.args[0].kind==='coup'));
  }
});
