import assert from 'node:assert/strict';
import type { Credential, RoomMessage, ChatPacket } from '../src/net/protocol';
import { decode } from '../src/net/protocol';
const origin=process.argv[2]??'http://localhost:8787';
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname),'Local rooms only');
const wait=async(fn:()=>boolean)=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,30));}throw Error('Timed out');};
const post=async(path:string,body={})=>{const r=await fetch(origin+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});assert.ok(r.ok);return await r.json() as Credential;};
class Seat {
 ws!:WebSocket; state?:RoomMessage; chats:ChatPacket[]=[]; errors:string[]=[];
 constructor(readonly credential:Credential,readonly chat=true){}
 send(msg:unknown){this.ws.send(JSON.stringify(msg));}
 async connect(){
  this.ws=new WebSocket(origin.replace(/^http/,'ws')+`/api/room/${this.credential.code}/socket`);
  this.ws.onopen=()=>this.send({type:'auth',token:this.credential.token,chat:this.chat});
  this.ws.onmessage=e=>{const m=decode<any>(e.data);if(m.type==='state')this.state=m;else if(m.type==='error')this.errors.push(m.message);else this.chats.push(m);};
  await wait(()=>!!this.state && (!this.chat||this.chats.some(m=>m.type==='chat-history')));
 }
}
const a=await post('/api/create',{side:0}),b=await post(`/api/room/${a.code}/join`);
const us=new Seat(a),su=new Seat(b),old=new Seat(a,false);const seats=[us,su,old];
try{
 await Promise.all(seats.map(s=>s.connect()));
 const before=JSON.stringify([us.state!.view,su.state!.view]),revision=us.state!.revision;
 us.send({type:'chat-send',requestId:'test-message-1',text:'你好，朋友 👋',side:1});
 await wait(()=>su.chats.some(m=>m.type==='chat'));
 const first=su.chats.find(m=>m.type==='chat');assert.equal(first?.type==='chat'&&first.entry.side,0);
 assert.equal(old.chats.length,0,'legacy clients must not receive chat packets');
 us.send({type:'chat-send',requestId:'test-message-1',text:'重复'});
 await wait(()=>us.chats.filter(m=>m.type==='chat').length===2);
 assert.equal(su.chats.filter(m=>m.type==='chat').length,1,'retry does not duplicate delivery');
 su.send({type:'chat-send',requestId:'test-message-2',text:'<img src=x onerror=alert(1)> 收到'});
 await wait(()=>us.chats.filter(m=>m.type==='chat').length===3);
 us.send({type:'chat-send',requestId:'test-invalid-1',text:'中'.repeat(301)});
 await wait(()=>us.chats.some(m=>m.type==='chat-error'));
 us.send({type:'sync'});await new Promise(r=>setTimeout(r,100));
 assert.equal(us.state!.revision,revision);assert.equal(JSON.stringify([us.state!.view,su.state!.view]),before);
 const reconnect=new Seat(b);seats.push(reconnect);await reconnect.connect();
 const history=reconnect.chats.find(m=>m.type==='chat-history');assert.equal(history?.type==='chat-history'&&history.entries.length,2);
 for(let i=0;i<6;i++)us.send({type:'chat-send',requestId:`test-flood-${i}`,text:'hello'});
 await wait(()=>us.chats.some(m=>m.type==='chat-error'&&m.message.includes('发送太快')));
 const bad=new WebSocket(origin.replace(/^http/,'ws')+`/api/room/${a.code}/socket`);
 await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Unauthenticated chat accepted')),5000);bad.onopen=()=>bad.send(JSON.stringify({type:'chat-send',requestId:'test-unauthorized',text:'bad'}));bad.onclose=e=>{clearTimeout(timer);assert.equal(e.code,4001);resolve();};});
 for(const s of seats)assert.deepEqual(s.errors,[]);
 console.log('PASS chat server: both seats, authenticated colours, plain text, deduplication, isolated errors/state, bounded rate, reconnect history, legacy clients and unauthorized rejection');
}finally{seats.forEach(s=>s.ws.close());}
