import assert from 'node:assert/strict';
import { test } from 'node:test';
import rawScenario from '../../data/scenarios/coldwar/scenario.json';
import type { Scenario } from '../map/types';
import { evaluate,newJournal } from './replay';
import { encode,decode } from './protocol';
const scenario=rawScenario as unknown as Scenario;
function fixture(side:0|1,ids:string[]){
  const j=newJournal(scenario,12),s=j.checkpoint;
  Object.assign(s,{phase:'action',active:side,round:1});
  s.deck.push(...s.hands[side]);s.hands[side]=[];
  for(const id of ids){
    for(const pile of [...s.hands,s.deck,s.discard,s.removed,s.future,s.inPlay]){const i=pile.indexOf(id);if(i>=0)pile.splice(i,1);}
    s.hands[side].push(id);
  }
  return j;
}
test('UN Intervention requires explicit partner selection for either seat even with exactly one eligible card',async()=>{
  for(const side of [0,1] as const){
    const partner=side===0?'008':'025',own=side===0?'025':'008';
    let e=await evaluate(scenario,fixture(side,['032',partner,own]));
    e.journal.answers[e.prompts[0].id]={card:'032',use:'event'};e=await evaluate(scenario,e.journal);
    const p=e.prompts[0];assert.equal(p.side,side);assert.equal(p.method,'choose');
    assert.match(p.args[0].title,/联合国干预/);assert.deepEqual(p.args[0].options.map((o:{id:string})=>o.id),[partner]);
    assert.ok(e.state.hands[side].includes(partner),'card is not consumed before selection');
    assert.ok(!e.frames.some(f=>f.method==='announce'&&f.args[0].card.id===partner));
    assert.deepEqual((await evaluate(scenario,e.journal)).prompts,e.prompts,'reconnect still asks');
    const invalid=structuredClone(e.journal);invalid.answers[p.id]=own;
    await assert.rejects(evaluate(scenario,invalid),/不合法/);
    e.journal.answers[p.id]=partner;e=await evaluate(scenario,e.journal);
    assert.equal(e.state.hands[side].includes(partner),false);
    assert.ok(e.prompts[0].method==='choose'||e.prompts[0].method==='place');
  }
});
test('score explanation is public for both seats, precedes VP commit, and is not replayed on reconnect',async()=>{
  for(const side of [0,1] as const){
    const j=fixture(side,['003','025']);
    for(const id of Object.keys(j.checkpoint.inf))j.checkpoint.inf[id]=[0,0];
    j.checkpoint.inf.irn=[2,0];j.checkpoint.inf.syr=[0,2];
    let e=await evaluate(scenario,j);e.journal.answers[e.prompts[0].id]={card:'003',use:'event'};
    e=await evaluate(scenario,e.journal);
    const at=e.frames.findIndex(f=>f.method==='score');assert.ok(at>=0);
    const frame=decode<typeof e.frames[number]>(encode(e.frames[at]));
    assert.equal(frame.audience,'all');assert.deepEqual(frame.args[0].totals,[4,3]);
    assert.ok(frame.views.every(v=>v.hud.vp===0));
    assert.ok(e.frames.findIndex(f=>f.method==='step'&&f.args[0].t==='vp')>at);
    assert.equal(e.state.vp,1);
    const again=await evaluate(scenario,e.journal);assert.deepEqual(again.state,e.state);assert.equal(again.frames.length,0);
  }
});
