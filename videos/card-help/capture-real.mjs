// Capture genuine runtime components in a separate Chrome instance. No source mutations.
import puppeteer from '/Users/weilunchen/.npm/_npx/702923228c2ce1e6/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import {mkdirSync,writeFileSync} from 'node:fs';
const dir=new URL('assets/real/',import.meta.url).pathname;
mkdirSync(dir,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,userDataDir:new URL('.capture-profile/',import.meta.url).pathname,args:['--remote-debugging-port=9338','--use-angle=metal','--force-device-scale-factor=1','--no-first-run']});
const page=await browser.newPage();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
await page.setViewport({width:1600,height:900,deviceScaleFactor:2});
try{
 await page.goto('http://localhost:5173/game.html');await page.waitForFunction(()=>!!window.game?.map?.renderer);
 await page.evaluate(()=>{window.game.map.setTiltShift(false);window.game.map.setFlavor(false);});
 await pause(600);
 const base=await page.evaluate(()=>window.game.placeholder.state);
 const states={
  'time-soviet':{active:1,turn:1,round:1},'time-us':{active:0,turn:1,round:1},'time-round2':{active:1,turn:1,round:2},'time-turn2':{active:1,turn:2,round:1},'time-turn10':{active:1,turn:10,round:7},
  'score-0':{vp:0},'score-us2':{vp:2},'score-us5':{vp:5},'score-soviet2':{vp:-2},'space-0':{space:[0,0]},'space-1':{space:[1,0]},
  'crisis-3':{crisis:3,milops:[1,3],milopsRequired:3},'crisis-2':{crisis:2,milops:[1,3],milopsRequired:2},'crisis-1':{crisis:1,milops:[1,3],milopsRequired:1},
  'piles':{hand:[],played:null,deck:21,discard:['028'],removed:['008']},'piles-drawn':{hand:[],played:null,deck:20,discard:['028'],removed:['008']},'piles-discarded':{hand:[],played:null,deck:21,discard:['008','028'],removed:['008']},'piles-empty-removed':{hand:[],played:null,deck:21,discard:['028'],removed:[]}
 };
 const sizes={};
 await page.addStyleTag({content:'html,body,#game{background:transparent!important}#map,.cl-trigger{visibility:hidden!important}.hud>*{visibility:hidden!important}.hud>.capture-visible{visibility:visible!important}.hud-corner{position:absolute!important;left:20px!important;top:20px!important;right:auto!important;bottom:auto!important;animation:none!important;transition:none!important}'});
 for(const [name,state] of Object.entries(states)){
  const selector=name.startsWith('time')?'.hud-tl':name.startsWith('score')||name.startsWith('space')?'.hud-tr':name.startsWith('crisis')?'.hud-br':'.hud-bl';
  await page.evaluate((state)=>{window.game.hud.setState({...window.game.placeholder.state,...state},false);document.querySelector('.rd-pip:last-child').style.display=(state.turn??window.game.placeholder.state.turn)<=3?'none':'';},state);
  const target=await page.$(selector);await page.evaluate(sel=>{document.querySelectorAll('.hud-corner').forEach(el=>el.classList.remove('capture-visible'));document.querySelector(sel).classList.add('capture-visible');},selector);
  await pause(60);const box=await target.boundingBox();sizes[name]=box;
  await target.screenshot({path:dir+name+'.png',omitBackground:true});
  console.log('captured',name,box.width,box.height);
 }
 writeFileSync(dir+'hud-sizes.json',JSON.stringify(sizes,null,2));
 // Capture the same production card renderer, including its original typography.
 await page.setViewport({width:500,height:700,deviceScaleFactor:1});
 for(const id of [4]){
  await page.goto('http://localhost:4311/?export='+id);await page.waitForFunction(()=>!!window.__ready);
  await page.evaluate(()=>{document.documentElement.style.background='transparent';document.body.style.background='transparent';});
  await page.screenshot({path:dir+`card-${String(id).padStart(3,'0')}.png`,omitBackground:true});
 }
 // Correct regional scoring examples, rendered by the original map.
 await page.setViewport({width:1920,height:1080,deviceScaleFactor:1});
 await page.goto('http://localhost:5173/');await page.waitForFunction(()=>!!window.sandbox);
 await page.addStyleTag({content:'#panel,.cl-trigger,.wm-legend,.wm-card{display:none!important}'});
 await page.evaluate(()=>{sandbox.applyPreset('empty');sandbox.map.setTiltShift(false);sandbox.map.setFlavor(false);sandbox.map.flyTo('europe');});await pause(1200);
 const settings={presence:{fra:0,pol:1},domination:{fra:0,ita:0,esp:0,frg:1,aut:1},control:{fra:0,ita:0,frg:0,gdr:0,pol:0,esp:0,aut:1}};
 for(const [name,owned] of Object.entries(settings)){
  const actual=await page.evaluate(owned=>{sandbox.applyPreset('empty');const out=[];for(const [id,side] of Object.entries(owned)){const country=sandbox.map.pack.scenario.countries.find(c=>c.id===id);if(!country)continue;const inf=[0,0];inf[side]=country.stability;sandbox.cells[id].influence=inf;out.push({id,side,stability:country.stability,key:country.key});}sandbox.push();return out;},owned);
  await pause(300);await page.screenshot({path:dir+'region-'+name+'.png'});console.log(name,actual);
 }

 const countries={};
 for(const [name,id,inf] of [['iran-influence','irn',[1,2]],['austria','aut',[0,0]],['cuba-before','cub',[2,0]],['cuba-after','cub',[0,3]]]){
   await page.evaluate(({id,inf})=>{sandbox.applyPreset('empty');sandbox.cells[id].influence=inf;sandbox.push();sandbox.map.flyTo(id);sandbox.map.select({kind:'country',id});},{id,inf});
   await pause(1200);await page.screenshot({path:dir+name+'.png'});
   countries[name]=await page.evaluate(id=>{const r=document.querySelector('.wm-plate[data-id='+id+'] .wm-plate-body').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];},id);
 }
 writeFileSync(dir+'country-centers.json',JSON.stringify(countries,null,2));
}finally{await browser.close();}
