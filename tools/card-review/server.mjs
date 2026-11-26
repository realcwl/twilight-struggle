import http from 'node:http';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { resolve, extname, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export async function startServer({port=Number(process.env.PORT||4311),dataDir=resolve(root,'data/card-review')}={}) {
  const cards=JSON.parse(await readFile(resolve(root,'prototypes/card-designs/final/cards.json'),'utf8'));
  const byId=new Map(cards.map(c=>[c.id,c]));
  await mkdir(join(dataDir,'uploads'),{recursive:true});
  const dbPath=join(dataDir,'comments.json');
  let db;try{db=JSON.parse(await readFile(dbPath,'utf8'));if(!Array.isArray(db.comments))throw Error('Invalid comments.json')}catch(e){if(e.code!=='ENOENT')throw e;db={version:1,comments:[]};}
  let serial=Promise.resolve();
  const json=(res,status,payload)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(payload));};
  const fail=(message,status=400)=>Object.assign(new Error(message),{status});
  async function persist(){
    await writeFile(dbPath+'.tmp',JSON.stringify(db,null,2)+'\n');await rename(dbPath+'.tmp',dbPath);
    const open=db.comments.filter(c=>c.status==='open');
    const lines=['# Card review — pending comments','',`Updated: ${new Date().toISOString()}`,`Open: ${open.length}`,'','Source of truth: comments.json. Image paths are relative to this folder.',''];
    for(const c of open){const card=byId.get(c.cardId);lines.push(`## #${String(c.cardId).padStart(3,'0')} ${card.title} · ${c.id}`,'',`Side: ${c.side} · Revision: ${c.revision} · Anchor: ${c.anchor?`${Math.round(c.anchor.x*100)}% x, ${Math.round(c.anchor.y*100)}% y`:'whole card'}`,`Created: ${c.createdAt}`,'',c.text||'(image-only comment)','');for(const a of c.attachments)lines.push(`![${a.name.replace(/[\[\]\n]/g,'')}](uploads/${a.file})`);lines.push('');}
    await writeFile(join(dataDir,'pending-comments.md')+'.tmp',lines.join('\n'));await rename(join(dataDir,'pending-comments.md')+'.tmp',join(dataDir,'pending-comments.md'));
  }
  await persist();
  async function body(req){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>38*1024*1024)throw fail('附件合计过大，请减少图片。',413);chunks.push(chunk)}try{return JSON.parse(Buffer.concat(chunks).toString())}catch{throw fail('Invalid JSON')}}
  async function attachments(items){
    if(!Array.isArray(items)||items.length>6)throw fail('每条评论最多 6 张图片。');
    const result=[];
    for(const item of items){
      if(typeof item.data!=='string'||item.data.length>12*1024*1024)throw fail('每张图片最大 8 MB。');
      const m=item.data.match(/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/);if(!m)throw fail('支持 PNG、JPEG、WebP 和 GIF 图片。');
      const buffer=Buffer.from(m[2],'base64');if(buffer.length>8*1024*1024)throw fail('每张图片最大 8 MB。');
      let image;try{image=await sharp(buffer,{limitInputPixels:40000000}).rotate().resize({width:2000,height:2000,fit:'inside',withoutEnlargement:true}).webp({quality:90}).toBuffer();}catch{throw fail('无法读取这张图片。');}
      const file=randomUUID()+'.webp';await writeFile(join(dataDir,'uploads',file),image);
      result.push({file,url:'/uploads/'+file,name:String(item.name||'image').slice(0,180)});
    }return result;
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    try{
      const host=req.headers.host||'';if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))throw fail('Local access only',403);
      if(req.headers.origin&& ![`http://${host}`,`http://localhost:${server.address().port}`,`http://127.0.0.1:${server.address().port}`].includes(req.headers.origin))throw fail('Origin rejected',403);
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/api/health')return json(res,200,{ok:true,cards:cards.length});
      if(url.pathname==='/api/comments'&&req.method==='GET')return json(res,200,db);
      if(url.pathname==='/api/comments'&&req.method==='POST'){
        const input=await body(req);const card=byId.get(Number(input.cardId));if(!card)throw fail('Unknown card');
        const text=String(input.text||'').trim();if(text.length>20000)throw fail('评论过长。');
        if(!text&& !input.attachments?.length)throw fail('请输入评论或添加图片。');
        const anchor=input.anchor==null?null:{x:Number(input.anchor.x),y:Number(input.anchor.y)};
        if(anchor&& !Object.values(anchor).every(n=>Number.isFinite(n)&&n>=0&&n<=1))throw fail('Invalid anchor');
        let saved;const work=async()=>{
          saved={id:randomUUID(),cardId:card.id,revision:Number.isSafeInteger(input.revision)&&input.revision>0?input.revision:card.revision,side:input.side==='back'?'back':'front',anchor,text,attachments:await attachments(input.attachments||[]),status:'open',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
          db.comments.push(saved);await persist();
        };const done=serial.then(work);serial=done.catch(()=>{});await done;return json(res,201,saved);
      }
      const patch=url.pathname.match(/^\/api\/comments\/([a-f0-9-]+)$/);
      if(patch&&req.method==='PATCH'){
        const input=await body(req);let saved;
        const done=serial.then(async()=>{saved=db.comments.find(c=>c.id===patch[1]);if(!saved)throw fail('Comment not found',404);
          if(input.status!==undefined){if(!['open','resolved'].includes(input.status))throw fail('Invalid status');saved.status=input.status;}
          if(input.text!==undefined){const value=String(input.text).trim();if(value.length>20000||(!value&&!saved.attachments.length))throw fail('Invalid comment');saved.text=value;}
          if(input.resolution!==undefined)saved.resolution=String(input.resolution).slice(0,20000);
          saved.updatedAt=new Date().toISOString();await persist();});serial=done.catch(()=>{});await done;return json(res,200,saved);
      }
      if(url.pathname.startsWith('/api/'))throw fail('Not found',404);
      if(!['GET','HEAD'].includes(req.method))throw fail('Method not allowed',405);
      let path;
      if(/^\/uploads\/[a-f0-9-]+\.webp$/.test(url.pathname))path=join(dataDir,url.pathname.slice(1));
      else if(url.pathname==='/review/pending.md')path=join(dataDir,'pending-comments.md');
      else if(url.pathname==='/review/comments.json')path=dbPath;
      else if(url.pathname==='/'||url.pathname==='/index.html')path=resolve(root,'prototypes/card-designs/final/index.html');
      else if(url.pathname.startsWith('/cards/')){
        path=resolve(root,'public',decodeURIComponent(url.pathname).slice(1));
        if(!path.startsWith(resolve(root,'public/cards')+'/'))throw fail('Not found',404);
      } else if(/^\/src\/cards\/(?:render\.js|terms\.js|references\.js|catalog\.json|glossary\.json|tooltips\.js|card\.css|terms\.css)$/.test(url.pathname)||url.pathname==='/data/scenarios/coldwar/scenario.json'){
        path=resolve(root,url.pathname.slice(1));
      } else {
        const rel=decodeURIComponent(url.pathname).replace(/^\//,'');path=resolve(root,rel);
        const allowed=resolve(root,'prototypes/card-designs')+'/';if(!path.startsWith(allowed))throw fail('Not found',404);
      }
      const buf=await readFile(path);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.svg':'image/svg+xml','.mp4':'video/mp4','.webm':'video/webm'};
      const headers={'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-cache','Accept-Ranges':'bytes'};
      const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      if(range){const start=Number(range[1]),end=Math.min(range[2]?Number(range[2]):buf.length-1,buf.length-1);if(start>end||start>=buf.length){res.writeHead(416,{'Content-Range':`bytes */${buf.length}`});return res.end();}res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${buf.length}`,'Content-Length':end-start+1});return res.end(req.method==='HEAD'?undefined:buf.subarray(start,end+1));}
      res.writeHead(200,{...headers,'Content-Length':buf.length});res.end(req.method==='HEAD'?undefined:buf);
    }catch(e){if(!res.headersSent)json(res,e.status||(e.code==='ENOENT'?404:500),{error:e.status?e.message:(e.code==='ENOENT'?'Not found':'保存失败，请重试。')});else res.end();if(!e.status&&e.code!=='ENOENT')console.error(e);}
  });
  await new Promise((ok,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',ok)});
  return {server,url:`http://localhost:${server.address().port}`,dataDir};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const {url,dataDir}=await startServer();console.log(`Card review: ${url}\nComments: ${dataDir}`);
}
