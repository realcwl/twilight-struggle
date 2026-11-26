import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptChat, CHAT_HISTORY, type ChatState } from './chat-state';
const empty = (): ChatState => ({ seq: 0, entries: [] });
test('authenticated side, plain text normalization and stable retry identity', () => {
  const initial = empty();
  const result = acceptChat(initial, 1, { requestId: 'request-001', text: '  你好\n朋友 👋 <b>不是 HTML</b>\u202e' }, 1000);
  assert.equal(result.entry.side, 1);assert.equal(result.entry.text, '你好 朋友 👋 <b>不是 HTML</b>');
  assert.equal(initial.entries.length, 0);
  const retry = acceptChat(result.state, 1, { requestId: 'request-001', text: '重试' }, 2000);
  assert.equal(retry.duplicate, true);assert.equal(retry.state, result.state);
  assert.equal(acceptChat(result.state, 0, { requestId: 'request-001', text: '另一个座位' }, 2000).duplicate, false);
});
test('rejects empty/oversized/invalid messages and rate limits each seat separately', () => {
  for (const request of [{ requestId: 'bad', text: 'hi' },{ requestId:'request-001',text: '  ' },{ requestId:'request-001',text:'中'.repeat(301) },{ requestId:'request-001',text: null }]) assert.throws(() => acceptChat(empty(),0,request,0));
  let state = empty();
  for(let i=0;i<5;i++)state=acceptChat(state,0,{requestId:`request-${i}`,text:'hi'},1000+i).state;
  assert.throws(() => acceptChat(state,0,{requestId:'request-6',text:'hi'},2000),/发送太快/);
  assert.doesNotThrow(() => acceptChat(state,1,{requestId:'request-6',text:'hi'},2000));
  assert.doesNotThrow(() => acceptChat(state,0,{requestId:'request-6',text:'hi'},7000));
});
test('keeps the latest 100 messages with monotonic sequence across storage reload', () => {
  let state = empty();
  for(let i=0;i<125;i++)state=acceptChat(JSON.parse(JSON.stringify(state)) as ChatState,0,{requestId:`request-${i}`,text:String(i)},i*6000).state;
  assert.equal(state.entries.length,CHAT_HISTORY);assert.equal(state.seq,125);assert.equal(state.entries[0].seq,26);
});
