import assert from 'node:assert/strict';
import { test } from 'node:test';
import rawScenario from '../../data/scenarios/coldwar/scenario.json';
import type { Scenario } from '../map/types';
import { SoloGame } from './solo/engine';
import { headlessPresenter } from './solo/headless';

test('the event waits for the movement presentation, commits once, then continues',async()=>{
  const g=new SoloGame({scenario:rawScenario as unknown as Scenario,lang:'zh',seed:12,onChange(){},onCheckpoint(){g.stop();}}),s=g.match.s;
  Object.assign(s,{phase:'action',active:0,round:1});
  for(const p of [...s.hands,s.deck,s.future]){const at=p.indexOf('071');if(at>=0)p.splice(at,1);}s.hands[0].push('071');
  let finish!:()=>void,entered!:()=>void;
  const gate=new Promise<void>(r=>{finish=r}),ready=new Promise<void>(r=>{entered=r});
  const work=g.start({...headlessPresenter(g),async decide(){return{card:'071',use:'event'}},async cardMove(m,commit){
    assert.equal(m.card,'006');assert.equal(s.china.owner,1);
    commit();commit();assert.equal(s.china.owner,0);
    entered();await gate;
  }});
  await ready;
  assert.equal(s.active,0);assert.equal(s.battleLog!.find(e=>e.card==='071')!.status,'resolving');
  finish();await work;
  assert.equal(s.battleLog!.find(e=>e.card==='071')!.status,'resolved');
  assert.equal(s.battleLog!.flatMap(e=>e.lines).filter(l=>l.kind==='move').length,1);
  g.match.validate();
});
