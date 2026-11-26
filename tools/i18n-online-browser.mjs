// Disposable Chrome; never connects to a user's browser or a production room.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,rm} from 'node:fs/promises';
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const tutorial=process.argv.includes('--tutorial');
const profile=await mkdtemp('/tmp/i18n-browser-');
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-port='+port,'--user-data-dir='+profile,'--no-first-run','about:blank'],{stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
try{
 for(let i=0;i<100;i++){try{await fetch(`http://127.0.0.1:${port}/json/version`);break;}catch{await pause(100);}}
 for(const locale of tutorial?['en','es']:['en']){
  const env={...process.env,...(tutorial
    ?{TUTORIAL_LANG:locale,TUTORIAL_ORIGIN:'http://localhost:5173',TUTORIAL_CDP_PORT:String(port)}
    :{ONLINE_ORIGIN:'http://localhost:8787',ONLINE_CDP_PORT:String(port),ONLINE_LANG_US:'en',ONLINE_LANG_USSR:'es',ONLINE_I18N:'1'})};
  const child=spawn(process.execPath,[tutorial?'tools/tutorial-browser.mjs':'tools/online-browser.mjs'],{stdio:'inherit',env});
  const code=await new Promise(r=>child.on('exit',r));
  if(code!==0){process.exitCode=code??1;break;}
 }
}finally{chrome.kill('SIGTERM');await pause(600);await rm(profile,{recursive:true,force:true});}
