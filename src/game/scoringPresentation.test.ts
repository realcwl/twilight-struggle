import assert from 'node:assert/strict';
import { test } from 'node:test';
import rawScenario from '../../data/scenarios/coldwar/scenario.json';
import type { Scenario } from '../map/types';
import type { ScoringReport } from '../play/types';
import { Match } from './solo/model';
import { SoloGame } from './solo/engine';
import { headlessPresenter } from './solo/headless';
import { countryScores, countryScoringFromCards, regionStandings } from './regions';
import { eventAllowed } from './solo/events';
const scenario = rawScenario as unknown as Scenario;
const empty = () => { const m = new Match(scenario,12); for(const id of m.ids)m.s.inf[id]=[0,0]; return m; };
function hold(m: Match,side: 0|1,...ids: string[]) { for(const id of ids)m.s.inf[id][side]=m.countries.get(id)!.stability; }
function give(m: Match,id: string,side: 0|1) {
  for(const pile of [...m.s.hands,m.s.deck,m.s.discard,m.s.removed,m.s.future,m.s.inPlay]) {
    const at=pile.indexOf(id);if(at>=0)pile.splice(at,1);
  }
  m.s.hands[side].push(id);
}

test('scoring report explains domination, presence, ordinary countries and the exact net VP without mutation',()=>{
  const m=empty();hold(m,0,'irn','isr','lbn');hold(m,1,'syr');
  const before=JSON.stringify(m.snapshot()),r=m.scoring('mideast');
  assert.deepEqual(r.standing,['domination','presence']);
  assert.deepEqual(r.totals,[7,3]);assert.equal(r.sides[0].base,5);
  assert.equal(r.sides[0].held,3);assert.equal(r.sides[0].keys,2);assert.equal(r.sides[0].adjacent,0);
  assert.equal(r.sides[0].countries.find(c=>c.id==='lbn')!.key,false);
  assert.equal(JSON.stringify(m.snapshot()),before);
  const [effect]=m.score('mideast');assert.equal(effect.t,'vp');
  if(effect.t==='vp')assert.equal(effect.d,4);
});

test('scoring report covers none, adjacency, country-based Southeast Asia and European automatic victory',()=>{
  const m=empty();assert.deepEqual(m.scoring('asia').totals,[0,0]);
  hold(m,0,'afg');const asia=m.scoring('asia');
  assert.equal(asia.sides[0].adjacent,1);assert.equal(asia.totals[0],4);
  hold(m,0,'tha','mys');hold(m,1,'vnm');const sea=m.scoring('southeast-asia');
  assert.equal(sea.rule,null);assert.deepEqual(sea.totals,[3,1]);
  assert.equal(sea.sides[0].countries.find(c=>c.id==='tha')!.points,2);
  hold(m,0,'fra','frg','gdr','pol','ita','gbr');const europe=m.scoring('europe');
  assert.equal(europe.winner,0);assert.equal(europe.sides[0].base,'win');
  assert.equal(m.s.result,null,'preview does not end the match');
});

test('Shuttle Diplomacy deducts counts visibly, remains intact during preview, and is ignored in final scoring',()=>{
  const m=empty();hold(m,0,'twn');hold(m,1,'prk');m.s.flags.formosan=true;m.s.flags.shuttle=true;
  const before=JSON.stringify(m.snapshot()),r=m.scoring('asia');
  assert.equal(r.formosan,true);assert.equal(r.sides[0].keys,1);assert.equal(r.totals[0],4);
  assert.equal(r.sides[1].countries.length,1);assert.equal(r.sides[1].deducted,1);
  assert.equal(r.sides[1].held,0);assert.equal(r.sides[1].keys,0);assert.equal(r.totals[1],0);
  assert.equal(JSON.stringify(m.snapshot()),before);
  const final=m.scoring('asia',true);assert.equal(final.sides[1].deducted,0);assert.equal(final.totals[1],4);
});

test('region preview uses the exact scoring resolution, including the reported 6-v-7 domination trap',()=>{
  const m=empty();hold(m,0,'jpn','kor','aus','twn','phl','idn');hold(m,1,'pak','ind','prk','afg','mmr','lao','vnm');
  assert.deepEqual(m.scoring('asia').standing,['presence','domination']);
  m.s.flags.shuttle=true;
  const before=JSON.stringify(m.snapshot()),report=m.scoring('asia'),map=m.mapState(),preview=map.regions.asia.scoring!;
  assert.deepEqual(preview.standing,['presence','presence']);
  assert.deepEqual(preview.sides.map(s=>[s.held,s.keys]),[[6,2],[6,2]]);
  assert.deepEqual(preview.totals,[5,5]);
  assert.deepEqual(regionStandings(scenario,map).asia,report.standing);
  assert.deepEqual(preview.totals,report.totals);
  assert.equal(JSON.stringify(m.snapshot()),before,'inspecting the map never consumes the one-shot event');
  const effects=m.score('asia');assert.deepEqual(effects.map(e=>'d' in e?e.d:null),[0]);
  assert.equal(m.has('shuttle'),false);
  assert.deepEqual(m.mapState().regions.asia.scoring!.standing,['presence','domination'],'next scoring updates after the modifier is consumed');
});

test('every region summary agrees with card scoring after modifiers, restore and control changes',()=>{
  const m=empty();hold(m,0,'twn','jpn','kor','aus','isr','lbn','fra','frg','ita','gbr','tha','mys');
  hold(m,1,'prk','ind','pak','vnm','irn','irq','syr','pol','gdr');
  for(const shuttle of [false,true])for(const formosan of [false,true]){
    m.s.flags.shuttle=shuttle;m.s.flags.formosan=formosan;
    const restored=new Match(scenario,0,JSON.parse(JSON.stringify(m.snapshot())));
    const before=JSON.stringify(restored.snapshot()),map=restored.mapState();
    for(const area of [...scenario.regions.map(r=>r.id),'southeast-asia']){
      const report=restored.scoring(area),preview=map.regions[area].scoring!;
      assert.deepEqual(preview.standing,report.standing);assert.deepEqual(preview.totals,report.totals);
      assert.equal(preview.winner,report.winner);assert.equal(preview.allKeys,report.allKeys);
      assert.deepEqual(preview.sides,report.sides.map(({countries:_countries,...counts})=>counts));
      const settled=new Match(scenario,0,restored.snapshot()),effects=settled.score(area);
      assert.equal(effects[0].t,'vp');assert.equal('d' in effects[0]&&effects[0].d,preview.totals[0]-preview.totals[1]);
    }
    assert.deepEqual(countryScores(countryScoringFromCards(),map)['southeast-asia'],restored.scoring('southeast-asia').totals);
    assert.equal(JSON.stringify(restored.snapshot()),before);
  }
  m.s.inf.twn=[3,1];assert.equal(m.mapState().regions.asia.scoring!.formosan,false);
});

test('Shuttle excludes Japan adjacency as well as its country and battleground; other uses are unaffected',()=>{
  const m=empty();hold(m,1,'jpn','prk','vnm');hold(m,0,'twn');m.s.flags.shuttle=true;m.s.flags.formosan=true;
  const optimal=m.scoring('asia');assert.equal(optimal.shuttleCountry,'jpn');assert.equal(optimal.shuttleChoicePending,true);
  assert.equal(optimal.sides[1].adjacent,0);
  const chosen=m.scoring('asia',false,{shuttleCountry:'prk'});
  assert.equal(chosen.shuttleChoicePending,false);assert.equal(chosen.sides[1].adjacent,1);
  assert.equal(chosen.totals[1],optimal.totals[1]+1);
  assert.throws(()=>m.scoring('asia',false,{shuttleCountry:'vnm'}),/目标不合法/);
  const final=m.scoring('asia',true);assert.equal(final.sides[1].deducted,0);assert.equal(final.formosan,true);
  assert.equal(m.scoring('southeast-asia').sides[1].deducted,0);
  const summit=m.scoring('asia',false,{eventModifiers:false});
  assert.equal(summit.sides[1].deducted,0);assert.equal(summit.formosan,false);assert.equal(summit.sides[0].keys,0);
  assert.equal(eventAllowed(m,'048',0),false,'Kitchen Debates uses actual battlegrounds');
  const only=empty();hold(only,1,'jpn');only.s.flags.shuttle=true;
  assert.deepEqual(only.scoring('asia').totals,[0,0]);assert.equal(only.scoring('asia').sides[1].adjacent,0);
});

test('Summit rolls use actual regional standings without spending scoring-only events',async()=>{
  let g:SoloGame;g=new SoloGame({scenario,lang:'zh',seed:12,onChange(){},onCheckpoint(){g.stop()}});
  const m=g.match;Object.assign(m.s,{phase:'action',active:0,round:1});give(m,'045',0);
  for(const id of m.ids)m.s.inf[id]=[0,0];
  hold(m,1,'prk','vnm');hold(m,0,'twn');m.s.flags.formosan=true;m.s.flags.shuttle=true;
  assert.equal(m.scoring('asia').standing[1],'presence');
  let bonus:number|undefined;
  await g.start({...headlessPresenter(g),async decide(){return{card:'045',use:'event'}},async roll(r){bonus=r.dice[1].total-r.dice[1].value;}});
  assert.equal(bonus,1,'Soviet domination still grants its Summit modifier');
  assert.equal(m.has('shuttle'),true);assert.equal(m.has('formosan'),true);
});

test('Taiwan scoring badge follows control, resolution cancellation and save restoration without changing coup rules',()=>{
  const g=new SoloGame({scenario,lang:'zh',seed:12,onChange(){}}),m=g.match;
  m.s.inf.twn=[3,0];assert.equal(m.mapState().countries.twn.scoringKey,false);
  m.s.flags.formosan=true;
  assert.equal(m.mapState().countries.twn.scoringKey,true);
  assert.equal(m.countries.get('twn')!.key,false,'static scenario untouched');
  assert.equal(g.coupPreview(1,'twn',3).key,false,'scoring-only bonus does not add a DEFCON penalty');
  assert.equal(new Match(scenario,0,m.snapshot()).mapState().countries.twn.scoringKey,true);
  const r=m.scoring('asia');assert.deepEqual(regionStandings(scenario,m.mapState()).asia,r.standing);
  m.s.inf.twn=[3,1];assert.equal(m.mapState().countries.twn.scoringKey,false);
  m.s.inf.twn=[3,0];assert.equal(m.mapState().countries.twn.scoringKey,true);
  m.s.china.owner=0;m.settle('006',0,false);
  assert.equal(m.has('formosan'),false);assert.equal(m.mapState().countries.twn.scoringKey,false);
});

test('all seven scoring cards present a public breakdown before changing VP, including European victory',async()=>{
  for(const id of ['001','002','003','037','038','079','081']){
    let g: SoloGame;
    g=new SoloGame({scenario,lang:'zh',seed:12,onChange(){},onCheckpoint(){g.stop();}});
    const m=g.match;Object.assign(m.s,{phase:'action',active:0,round:1});give(m,id,0);
    for(const x of m.ids)m.s.inf[x]=[0,0];
    hold(m,0,'irn','tha','fra','frg','gdr','pol','ita','gbr');
    let shown: ScoringReport|undefined;const order:string[]=[];
    await g.start({...headlessPresenter(g),async decide(){return{card:id,use:'event'};},async score(r){
      order.push('score');shown=structuredClone(r);assert.equal(m.s.vp,r.vpBefore);assert.equal(m.s.result,null);
    },async step(e,commit){order.push(e.t);commit();}});
    assert.ok(shown,id);assert.equal(order[0],'score');
    if(id==='002')assert.equal(g.result?.reason,'europe');
    else assert.equal(m.s.vp,shown.vpBefore+shown.totals[0]-shown.totals[1]);
    m.validate();
  }
});
