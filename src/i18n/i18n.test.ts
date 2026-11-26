import assert from 'node:assert/strict';
import {test} from 'node:test';
import en from './locales/en.json';
import es from './locales/es.json';
import cardsEs from './locales/cards.es.json';
import glossary from '../cards/glossary.json';
import captions from './locales/help-captions.json';
import glossaryEn from './locales/glossary.en.json';
import glossaryEs from './locales/glossary.es.json';
import catalog from '../cards/catalog.json';
import rawScenario from '../../data/scenarios/coldwar/scenario.json';
import {LANGUAGES,normalizeLanguage,setLanguage,t,text,markup,withLocales} from './index.js';
import {cardCopy} from './cards.js';
import {cardHistory} from '../cards/history.js';
import {highlight} from '../cards/terms.js';
import {SoloGame} from '../game/solo/engine';
import {headlessPresenter} from '../game/solo/headless';
import type {Scenario} from '../map/types';

const noHan=(s:string,context='')=>assert.doesNotMatch(s,/\p{Script=Han}/u,context+': '+s);
test('registered languages and catalogs preserve every interpolation parameter',()=>{
 assert.deepEqual(LANGUAGES.map(l=>l.id),['zh','en','es']);
 assert.equal(normalizeLanguage(' EN-us '),'en');assert.equal(normalizeLanguage('es-MX'),'es');assert.equal(normalizeLanguage('en-US'),'en');assert.equal(normalizeLanguage('zh-CN'),'zh');assert.equal(normalizeLanguage('unsupported'),'zh');
 assert.deepEqual(Object.keys(en).sort(),Object.keys(es).sort());
 const slots=(s:string)=>[...new Set(s.match(/\{\d+\}/g))].sort();
 for(const locale of [en,es])for(const [key,translated]of Object.entries(locale)){
   assert.ok(translated.trim(),key);assert.deepEqual(slots(translated),slots(key),key);if(key!=='中文')noHan(translated,key);
 }
});
test('all 110 cards and glossary entries have complete language copies, without rule mutations',()=>{
 const original=JSON.stringify(catalog);assert.equal(Object.keys(cardsEs).length,110);
 for(const c of catalog)for(const lang of ['zh','en','es'] as const){
  const copy=cardCopy(c,lang);assert.ok(copy.title&&copy.effects.length,c.titleZh);assert.equal(copy.effects.length,c.effects.length,c.titleZh);
  if(lang==='es')assert.deepEqual(copy.effects.join(' ').match(/\d+/g),c.effects.join(' ').match(/\d+/g),c.titleZh+' rule quantities');
  if(lang!=='zh')for(const v of [copy.title,...copy.effects,copy.note,copy.prerequisite])noHan(v,c.titleZh);
 }
 assert.equal(JSON.stringify(catalog),original);
 for(const dict of [glossaryEn,glossaryEs])for(const entry of glossary){const translated=dict[entry.id as keyof typeof dict];assert.ok(translated,entry.id);for(const v of Object.values(translated)){assert.ok(v);noHan(v);}}
});
test('every help video has timed English and Spanish explanations',()=>{
 const videos=new Set(glossary.map(entry=>entry.video));
 assert.equal(videos.size,22);
 for(const video of videos){
  const cues=captions[video as keyof typeof captions];assert.ok(cues?.length>=2,video);
  assert.equal(cues[0].at,0,video);
  for(let i=0;i<cues.length;i++){
   const cue=cues[i];assert.ok(cue.at>=0&&cue.at<6,video);
   if(i)assert.ok(cue.at>cues[i-1].at,video);
   for(const lang of ['en','es'] as const){assert.ok(cue[lang].length>0,video);noHan(cue[lang],video);}
  }
 }
});
test('all history summaries and date labels are localized',async()=>{
 for(const lang of ['en','es'] as const){
  setLanguage(lang);
  for(const c of catalog){
   const story=await cardHistory(String(c.id));assert.ok(story?.lead,c.titleZh);
   for(const value of [story.title,story.period,story.kind,story.lead,...(story.image?[story.image.credit,story.image.license]:[])])noHan(value,c.titleZh);
  }
 }
 setLanguage('zh');
});
test('live and legacy journal clauses translate without swallowing their numbers or names',()=>{
 for(const lang of ['en','es'] as const)for(const s of [
  '初始部署：在西欧放置7点美国影响力',
  '放置3点美国影响力',
  '《中国牌》：苏联结算区 → 美国手牌 · 中国牌交给对手 · 下回合可用',
  '美国 0 VP · 苏联领先 7 VP → 苏联领先 7 VP · 军事行动不足：美国 −0，苏联 −0',
  '伊朗 · 苏联骰点 5 +4 行动点 = 9；门槛 稳定度 2 ×2 = 4 · 政变成功 · 净值 5',
  '亚洲 · 苏联：存在 · 控制国家：巴基斯坦、泰国、朝鲜 · 6 VP',
  '剩余 2 次行动，须先打出 2 张计分牌',
 ]){const translated=text(s,lang);noHan(translated,s);assert.deepEqual(translated.match(/[−-]?\d+/g),s.match(/[−-]?\d+/g),s);}
 for(const lang of ['en','es'] as const)for(const c of catalog)noHan(text(c.effectsZh.join(' '),lang),c.titleZh);
});
test('markup preserves IDs and escapes translated attributes; terms retain stable semantic IDs',()=>{
 const html=markup('<button data-card="008" class="控制" title="查看卡牌">控制</button>',[],'es');
 assert.match(html,/data-card="008" class="控制"/);assert.match(html,/>Control</);
 assert.doesNotMatch(highlight('<img src=x onerror="attack">Control',{locale:'en'}),/<img/);
 assert.match(highlight('Control and Influence',{locale:'en'}),/data-term="control"/);
 assert.match(highlight('Control e Influencia',{locale:'es'}),/data-term="influence"/);
 assert.doesNotMatch(highlight('controlling influential',{locale:'en'}),/data-term=/);
 assert.match(highlight('Irán',{locale:'es'}),/data-country-ref="irn"/);
 assert.equal(t('第 {0} 回合',[4],'en'),en['第 {0} 回合'].replace('{0}','4'));
});
test('full deterministic games finish identically in all languages, with translated prompts and logs',async()=>{
 const scenario=withLocales(rawScenario) as unknown as Scenario;
 const fingerprints=new Map<number,string>();
 for(const locale of ['zh','en','es'] as const){setLanguage(locale);
  for(const seed of [1,5,6,8,11]){
   const game=new SoloGame({scenario,lang:locale,seed,onChange(){},onCheckpoint(){game.match.validate();}});
   const base=headlessPresenter(game);
   const scan=(v:unknown):void=>{
    if(typeof v==='string'&&/\p{Script=Han}/u.test(v))noHan(text(v,locale),`${locale} seed ${seed}`);
    else if(Array.isArray(v))v.forEach(scan);
    else if(v&&typeof v==='object')for(const [key,value]of Object.entries(v))if(!['zh','en','es'].includes(key))scan(value);
   };
   const presenter=new Proxy(base,{get(target,key){const fn=Reflect.get(target,key);if(typeof fn!=='function')return fn;return(...args:unknown[])=>{if(locale!=='zh')scan(args);return fn.apply(target,args);};}});
   const result=await game.start(presenter);game.match.validate();assert.ok(result);
   const s=game.snapshot;
   const fingerprint=JSON.stringify(Object.fromEntries(Object.entries(s).filter(([key])=>!['log','battleLog'].includes(key))));
   if(locale==='zh')fingerprints.set(seed,fingerprint);else {assert.equal(fingerprint,fingerprints.get(seed),`${locale} seed ${seed}`);scan(s.log);scan(s.battleLog);}
  }
 }
 setLanguage('zh');
});
