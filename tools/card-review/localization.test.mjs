import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {cardHTML} from '../../prototypes/card-designs/final/card.js';
import {highlight,esc,GLOSSARY,TERM_GROUPS} from '../../src/cards/terms.js';

const root=new URL('../../prototypes/card-designs/',import.meta.url);
const cards=JSON.parse(await readFile(new URL('final/cards.json',root),'utf8'));

test('all 110 card faces have Chinese rules, conditions and removal notes',()=>{
  assert.equal(cards.length,110);
  for(const c of cards){
    assert.match(c.titleZh,/\p{Script=Han}/u,`#${c.id} title`);
    assert.equal(c.effectsZh.length,c.effects.length,`#${c.id} rule paragraphs`);
    for(const text of c.effectsZh){assert.match(text,/\p{Script=Han}/u);assert.doesNotMatch(text,/[A-Za-z]/);}
    assert.equal(Boolean(c.prerequisiteZh),Boolean(c.prerequisite),`#${c.id} prerequisite`);
    assert.equal(Boolean(c.noteZh),Boolean(c.note),`#${c.id} note`);
    const html=cardHTML(c);
    assert.ok(html.includes(esc(c.titleZh)));
    assert.ok(!html.includes(c.effects[0]),`#${c.id} must not render English rules`);
  }
});

test('terminology remains whole and card references are not mistaken for terms',()=>{
  const html=highlight('本回合进行调整阵营，获得2军事行动点。《东南亚计分》与<影响力>。');
  assert.match(html,/<span class="game-term term-conflict"[^>]*>调整阵营<\/span>/);
  assert.match(html,/<span class="game-term term-conflict"[^>]*>军事行动点<\/span>/);
  assert.ok(html.includes('《东南亚计分》'));
  assert.match(html,/&lt;<span class="game-term term-influence"[^>]*>影响力<\/span>&gt;/);
  assert.doesNotMatch(html,/<span[^>]*>[^<]*<span/);
});

test('five semantic groups preserve timing and distinguish country from regional control',()=>{
  assert.equal(Object.keys(TERM_GROUPS).length,5);
  assert.match(highlight('头条阶段'),/term-timing.*data-term="headline"/);
  assert.match(highlight('存在 3 分 · 支配 7 分 · 控制 9 分'),/term-scoring[^>]*data-term="region-control"[^>]*>控制/);
  assert.match(highlight('每控制一个战场国家'),/term-influence[^>]*data-term="control"[^>]*>控制/);
  assert.match(highlight('非战场国家'),/data-term="ordinary"[^>]*>非战场国家/);
  assert.doesNotMatch(highlight('头条阶段与控制',{interactive:false}),/tabindex|data-term|role=/);
  assert.equal(new Set(GLOSSARY.map(t=>t.id)).size,GLOSSARY.length);
  for(const t of GLOSSARY){assert.ok(TERM_GROUPS[t.group]);assert.match(t.summary,/\p{Script=Han}/u);assert.match(t.video,/^[a-z-]+$/);}
});

test('translated examples retain timing, condition and direction',()=>{
  assert.equal(cards[92].effectsZh[0],'本回合剩余时间内，美国所有调整阵营掷骰结果减 1。');
  assert.match(cards[105].effectsZh.join(''),/变为 2/);
  assert.match(cards[20].prerequisiteZh,/《马歇尔计划》或《华沙条约组织》/);
  const unsafe={...cards[20],titleZh:'<script>控制</script>',effectsZh:['<img onerror="bad()">影响力'],prerequisiteZh:'',noteZh:''};
  assert.doesNotMatch(cardHTML(unsafe),/<script>|<img onerror/);
});

test('the 81 concept cards also localize without changing game values or artwork',async()=>{
  const ctx=vm.createContext({});ctx.window=ctx;
  for(const name of ['zh.js','deck/cards.js'])vm.runInContext(await readFile(new URL(name,root),'utf8'),ctx);
  const before=JSON.parse(JSON.stringify(ctx.DECK));
  vm.runInContext(await readFile(new URL('deck/zh-data.js',root),'utf8'),ctx);
  assert.equal(ctx.DECK.length,81);
  for(const [i,c] of ctx.DECK.entries()){
    assert.match(c.title,/\p{Script=Han}/u);
    assert.match(c.text,/\p{Script=Han}/u);
    for(const key of ['no','side','era','value','once','art'])assert.equal(c[key],before[i][key]);
    assert.equal(c.textEn,before[i].text);
  }
});

test('explanations also mark the short forms of terms; card text does not',()=>{
  const text='区域内控制的国家总数和战场国家数都超过对方，并至少控制一个战场与一个非战场国家。';
  const marked=html=>[...html.matchAll(/<span class="game-term term-(\w+)"[^>]*>([^<]*)<\/span>/g)].map(m=>m[2]);
  assert.deepEqual(marked(highlight(text)),['控制','战场国家','控制','非战场国家']);
  const prose=highlight(text,{interactive:false,prose:true});
  assert.deepEqual(marked(prose),['控制','国家总数','战场国家','控制','战场','非战场国家']);
  assert.doesNotMatch(prose,/tabindex|data-term|role=/);
  assert.match(highlight('只领先战场数量还不够；普通国家也要有。',{interactive:false,prose:true}),/term-influence">战场<.*term-influence">普通国家</);
  // a short form never takes a control of its own, even where the terms around it do
  assert.match(highlight('控制一个战场',{prose:true}),/data-term="control"[^>]*>控制<\/span>一个<span class="game-term term-influence">战场</);
});
