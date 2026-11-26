import assert from 'node:assert/strict';
import { test } from 'node:test';
import rawScenario from '../../data/scenarios/coldwar/scenario.json';
import type { Scenario } from '../map/types';
import type { CardMove } from '../play/types';
import { Match } from '../game/solo/model';
import { battleText } from '../game/history';
import { evaluate, newJournal, type Journal, type Evaluation } from './replay';
import { testAnswer } from './bot-test';
import { encode, decode } from './protocol';
const scenario = rawScenario as unknown as Scenario;
function fixture(card: string, side: 0 | 1, otherHand?: string[]) {
  const j = newJournal(scenario, 17), s = j.checkpoint;
  Object.assign(s, { phase: 'action', active: side, round: 1, turn: 5, actions: [0, 0] });
  const give = (id: string, who: 0 | 1) => {
    for (const pile of [...s.hands, s.deck, s.discard, s.future, s.removed, s.inPlay]) { const at = pile.indexOf(id); if (at >= 0) pile.splice(at, 1); }
    s.hands[who].push(id);
  };
  if (otherHand) {
    const other = side === 0 ? 1 : 0;
    s.deck.push(...s.hands[other]); s.hands[other] = [];
    for (const id of otherHand) give(id, other);
  }
  give(card, side);
  return j;
}
async function action(j: Journal, card: string, choose?: (e: Evaluation) => unknown) {
  let e = await evaluate(scenario, j);
  e.journal.answers[e.prompts[0].id] = { card, use: 'event' };
  e = await evaluate(scenario, e.journal);
  const frames = [...e.frames];
  for (let i=0; e.state.battleLog?.find(x=>x.card===card)?.status !== 'resolved' && !e.state.result; i++) {
    assert.ok(i<30, 'event terminates');
    const p=e.prompts[0]; assert.ok(p);
    e.journal.answers[p.id] = choose?.(e) ?? await testAnswer(p,e.views[p.side],scenario,e.observations[p.side]);
    e=await evaluate(scenario,e.journal); frames.push(...e.frames);
  }
  new Match(scenario,0,e.journal.checkpoint).validate();
  return {e,frames};
}
test('Missile Envy explains the taken card, its nested China transfer, then the handoff in order',async()=>{
  const {e,frames}=await action(fixture('049',0,['071']),'049');
  const moves=frames.filter(f=>f.method==='cardMove');
  assert.deepEqual(moves.map(f=>f.args[0].card),['071','006']);
  assert.ok(moves.every(f=>f.audience==='all'));
  assert.deepEqual(e.state.china,{owner:0,available:false});
  assert.ok(e.state.hands[1].includes('049')); assert.equal(e.state.temp.envy1,true);
  const taken=frames.indexOf(moves[0]), child=frames.findIndex(f=>f.method==='announce'&&f.args[0].card.id==='071');
  const china=frames.indexOf(moves[1]), returned=frames.findIndex(f=>f.method==='settle'&&f.args[0].card.id==='049');
  assert.ok(taken<child&&child<china&&china<returned);
  assert.deepEqual(moves[0].args[0].from,{hand:1}); assert.deepEqual(moves[0].args[0].to,{play:0});
  assert.deepEqual(frames[returned].args[0].transfer.to,{hand:1});
  for(const v of e.views){
    const parent=v.hud.battleLog!.find(x=>x.card==='049')!, nested=v.hud.battleLog!.find(x=>x.card==='071')!;
    assert.deepEqual(parent.lines.filter(l=>l.kind==='move').map(l=>l.move.card),['071','049']);
    assert.deepEqual(nested.lines.filter(l=>l.kind==='move').map(l=>l.move.card),['006']);
    assert.match(battleText([nested]),/苏联手牌 → 美国手牌.*下回合可用/);
  }
  assert.equal(encode(decode(encode(moves[1]))),encode(moves[1]));
  const reconnected=await evaluate(scenario,JSON.parse(JSON.stringify(e.journal)));
  assert.deepEqual(reconnected.state,e.state);assert.equal(reconnected.frames.length,0);
});
test('each direct China transfer reports the actual owner and availability',async()=>{
  for(const [card,side,owner,available] of [['058',1,0,true],['071',0,1,false],['076',0,1,true]] as const){
    const j=fixture(card,side);j.checkpoint.china={owner,available:true};
    const {e,frames}=await action(j,card);
    const m=frames.find(f=>f.method==='cardMove')!.args[0] as CardMove;
    assert.equal(m.card,'006');assert.deepEqual(m.from,{hand:owner});assert.deepEqual(m.to,{hand:side});
    assert.match(m.reason,available?/立即可用/:/下回合可用/);
    assert.deepEqual(e.state.china,{owner:side,available});
  }
});
test('Grain Sales returning a card records both movements without inventing a played event',async()=>{
  const {e,frames}=await action(fixture('067',0,['008']),'067',e=>e.prompts[0].args[0]?.title?.includes('粮食交易')?'return':undefined);
  assert.deepEqual(frames.filter(f=>f.method==='cardMove').map(f=>[f.args[0].card,f.args[0].from,f.args[0].to]),[
    ['008',{hand:1},{play:0}],['008',{play:0},{hand:1}],
  ]);
  assert.ok(e.state.hands[1].includes('008'));
  assert.equal(frames.some(f=>f.method==='announce'&&f.args[0].card.id==='008'),false);
});
test('recovery and forced discard share movement history; ordinary replacement draws stay hidden',async()=>{
  const j=fixture('043',0);const s=j.checkpoint;
  for(const p of [...s.hands,s.deck,s.future]){const i=p.indexOf('025');if(i>=0)p.splice(i,1);}s.discard.push('025');
  const recovered=await action(j,'043',e=>e.prompts[0].args[0]?.title?.includes('回收')?'025':undefined);
  assert.ok(recovered.e.state.hands[0].includes('025'));
  assert.ok(recovered.frames.some(f=>f.method==='cardMove'&&f.args[0].from==='discard'&&f.args[0].card==='025'));
  const ames=await action(fixture('098',1,['025','003']),'098');
  const moved=ames.frames.find(f=>f.method==='cardMove')!.args[0] as CardMove;
  assert.deepEqual(moved.from,{hand:0});assert.equal(moved.to,'discard');
  assert.ok(ames.e.state.discard.includes(moved.card));
  assert.ok(ames.e.views.every(v=>battleText(v.hud.battleLog!).includes('苏联指定美国弃掉此牌')));
  const m=new Match(scenario,23);m.draw(0,1);
  assert.equal(m.s.battleLog!.flatMap(e=>e.lines).some(l=>l.kind==='move'),false);
});
