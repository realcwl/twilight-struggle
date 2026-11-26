import type { ChatEntry } from './protocol';
import type { SideIndex } from '../hud/types';

export const CHAT_LIMIT = 300;
export const CHAT_HISTORY = 100;
export type ChatState = { seq: number; entries: ChatEntry[] };

/** Independent of the match journal, RNG, prompts and game revision. Side is authenticated by the room. */
export function acceptChat(state: ChatState, side: SideIndex, request: { requestId?: unknown; text?: unknown }, now: number) {
  if (typeof request.requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(request.requestId)) throw new Error('消息编号无效');
  const existing = state.entries.find(e => e.side === side && e.requestId === request.requestId);
  if (existing) return { state, entry: existing, duplicate: true };
  if (typeof request.text !== 'string') throw new Error('请输入聊天内容');
  // Plain text only; remove invisible control characters, preserve emoji and normal punctuation.
  const text = request.text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim();
  if (!text) throw new Error('请输入聊天内容');
  if (text.length > CHAT_LIMIT) throw new Error(`每条消息最多 ${CHAT_LIMIT} 字`);
  if (state.entries.filter(e => e.side === side && now - e.at < 5000).length >= 5) throw new Error('发送太快，请稍等几秒再试');
  const entry: ChatEntry = { seq: state.seq + 1, requestId: request.requestId, side, text, at: now };
  return { state: { seq: entry.seq, entries: [...state.entries, entry].slice(-CHAT_HISTORY) }, entry, duplicate: false };
}
