import puppeteer from '/Users/weilunchen/.npm/_npx/702923228c2ce1e6/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import {writeFileSync} from 'node:fs';
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--remote-debugging-port=9338','--use-angle=metal']});
const dir=new URL('assets/real/',import.meta.url).pathname;
try{const p=await b.newPage();await p.setViewport({width:1920,height:1080,deviceScaleFactor:1});await p.goto('http://localhost:5173/');await p.waitForFunction(()=>!!window.sandbox?.map?.rig);
await p.addStyleTag({content:'#panel,.cl-trigger,.wm-legend,.wm-card{display:none!important}'});
await p.evaluate(()=>{sandbox.applyPreset('empty');sandbox.map.setTiltShift(false);sandbox.map.setFlavor(false);const ids=['fra','ita','frg','gdr','pol','aut','esp'];const boxes=sandbox.map.pack.countries.filter(c=>ids.includes(c.id)).map(c=>c.bbox);const box=[Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1])),Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3]))];sandbox.map.rig.flyToBox(box,{instant:true,minDistance:40,maxZoom:.5});});
await new Promise(r=>setTimeout(r,600));await p.screenshot({path:dir+'europe.png'});
const settings={presence:{fra:0,pol:1},domination:{fra:0,ita:0,esp:0,frg:1,aut:1},control:{fra:0,ita:0,frg:0,gdr:0,pol:0,esp:0,aut:1}};
for(const [name,owned] of Object.entries(settings)){await p.evaluate(owned=>{sandbox.applyPreset('empty');for(const [id,side] of Object.entries(owned)){const c=sandbox.map.pack.scenario.countries.find(c=>c.id===id);const inf=[0,0];inf[side]=c.stability;sandbox.cells[id].influence=inf;}sandbox.push();},owned);await new Promise(r=>setTimeout(r,120));await p.screenshot({path:dir+'region-'+name+'.png'});}
const positions=await p.evaluate(()=>Object.fromEntries(['fra','ita','frg','gdr','pol'].map(id=>{const r=document.querySelector('.wm-plate[data-id='+id+'] .wm-plate-body').getBoundingClientRect();return [id,[r.x+r.width/2,r.y+r.height/2]];})));writeFileSync(dir+'europe-centers.json',JSON.stringify(positions,null,2));console.log(positions);
}finally{await b.close();}
