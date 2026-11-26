import { t as i18n, text as displayText } from '../i18n/index.js';
import type { SideIndex } from '../hud/types';
import type { ChatEntry, ChatPacket } from './protocol';
import { CHAT_HISTORY, CHAT_LIMIT } from './chat-state';
import './chat.css';

type Pending = { requestId: string; text: string; at: number; failed: boolean; reason: string; timer?: ReturnType<typeof setTimeout> };

/** Room-only UI; no access to the match state or presenter. */
export function mountRoomChat({ container, hud, code, side, send }: {
  container: HTMLElement; hud: HTMLElement; code: string; side: SideIndex;
  send: (message: { type: 'chat-send'; requestId: string; text: string }) => boolean;
}) {
  const root = document.createElement('section');
  root.className = 'room-chat';root.setAttribute('aria-label', i18n("房间聊天"));
  root.innerHTML = i18n("<header><button class=\"rc-heading\" type=\"button\" aria-label=\"阅读聊天记录\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 4h16v12H9l-5 4V4Z\"/><path d=\"M8 8h8M8 12h5\"/></svg><span>房间聊天</span><i class=\"rc-unread\" hidden></i></button><button type=\"button\" class=\"rc-fold\" aria-label=\"折叠聊天\" aria-expanded=\"true\">−</button></header><div class=\"rc-content\" id=\"room-chat-content\"><div class=\"rc-log\" role=\"log\" aria-label=\"双方的聊天消息\" aria-live=\"polite\" aria-relevant=\"additions text\" tabindex=\"0\"></div><button class=\"rc-latest\" hidden type=\"button\">查看新消息 ↓</button><button class=\"rc-compose\" type=\"button\">与对方聊天 <kbd>Enter</kbd></button><form class=\"rc-form\" hidden><input aria-label=\"聊天消息\" maxlength=\"{0}\" autocomplete=\"off\" placeholder=\"说点什么…\"><button type=\"submit\" aria-label=\"发送消息\">发送</button></form><p class=\"rc-status\" role=\"status\" hidden></p></div>", [CHAT_LIMIT]);
  container.append(root);
  const find = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const log = find<HTMLDivElement>('.rc-log'), content = find<HTMLDivElement>('.rc-content');
  const form = find<HTMLFormElement>('.rc-form'), input = find<HTMLInputElement>('input');
  const compose = find<HTMLButtonElement>('.rc-compose'), fold = find<HTMLButtonElement>('.rc-fold');
  const latest = find<HTMLButtonElement>('.rc-latest'), badge = find<HTMLElement>('.rc-unread'), status = find<HTMLElement>('.rc-status');
  const pref = `coldwar.chat.collapsed.${code}`;
  let collapsed = false;
  try { collapsed = localStorage.getItem(pref) === '1'; } catch { /* storage may be disabled */ }
  let connected = false, entries: ChatEntry[] = [], unread = 0, hydrated = false;
  let composing = false, compositionEnd = -Infinity, disposed = false, raf = 0;
  const pending = new Map<string, Pending>();
  const abort = new AbortController(), opts = { signal: abort.signal };
  const bottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 24;
  const say = (text: string) => { status.textContent = displayText(text);status.hidden = !text;schedule(); };
  const scrollBottom = () => { log.scrollTop = log.scrollHeight; latest.hidden = true; };

  function layout() {
    raf = 0;
    if (disposed) return;
    const width = container.clientWidth, height = container.clientHeight;
    const left = width < 700 ? 12 : 16;
    let w = Math.min(310, width - left * 2);
    const rect = (s: string) => {
      const e = hud.querySelector<HTMLElement>(s);
      return e && e.offsetHeight && !e.hidden ? e.getBoundingClientRect() : null;
    };
    const tl = rect('.hud-tl'), footer = rect('.hud-time-footer'), piles = rect('.hud-bl'), mine = rect('.ps-mine'), right = rect('.hud-tr');
    let top = Math.max(tl?.bottom ?? 130, footer?.bottom ?? 0) + 14;
    const end = Math.min(piles?.top ?? height - 160, mine?.top ?? height) - 12;
    // On phones the status panel occupies the right half below the timeline.
    if (right && right.bottom > top && right.top < end && right.left < left + w + 12) {
      const beside = right.left - left - 12;
      if (beside >= 150) w = Math.min(w, beside);
      else top = Math.max(top, right.bottom + 12);
    }
    let gaps = [{ top, bottom: end }];
    for (const selector of ['.ps-legacy', '.hud-brief', '.hud-resolution']) {
      const r = rect(selector);
      if (!r || r.left >= left + w || r.right <= left) continue;
      gaps = gaps.flatMap(g => r.bottom + 12 <= g.top || r.top - 12 >= g.bottom ? [g] : [
        { top: g.top, bottom: Math.min(g.bottom, r.top - 12) },
        { top: Math.max(g.top, r.bottom + 12), bottom: g.bottom },
      ].filter(g => g.bottom > g.top));
    }
    // Stay near the piles, in the largest free vertical interval. A brief above need not move chat.
    const gap = gaps.sort((a, b) => (b.bottom - b.top) - (a.bottom - a.top) || b.bottom - a.bottom)[0] ?? { top, bottom: end };
    const available = Math.max(72, gap.bottom - gap.top);
    root.style.width = `${w}px`;
    const textHeight = [...log.children].reduce((sum, e) => sum + e.getBoundingClientRect().height + 6, 0);
    const footerHeight = form.hidden ? compose.offsetHeight : form.offsetHeight;
    const desired = 28 + 6 + Math.max(28, textHeight) + footerHeight + 6 + (status.hidden ? 0 : status.offsetHeight + 3);
    const follow = bottom();
    const h = collapsed ? 30 : Math.min(width < 700 ? 200 : 254, available, desired);
    root.style.left = `${left}px`;root.style.top = `${Math.max(8, Math.min(gap.bottom - h, height - h - 12))}px`;
    root.style.width = `${w}px`;root.style.height = `${h}px`;
    if (follow) scrollBottom();
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(layout); };
  function folding(value: boolean, remember = true) {
    collapsed = value;root.classList.toggle('is-collapsed', value);content.hidden = value;
    fold.textContent = displayText(value ? '+' : '−');fold.setAttribute('aria-label', value ? i18n("展开聊天") : i18n("折叠聊天"));fold.setAttribute('aria-expanded', String(!value));
    fold.setAttribute('aria-controls', content.id);
    if (remember) try { localStorage.setItem(pref, value ? '1' : '0'); } catch { /* optional preference */ }
    if (value) stopEditing();
    else { unread = 0; badge.hidden = true; requestAnimationFrame(scrollBottom); }
    schedule();
  }
  function stopEditing() {
    if (document.activeElement === input) input.blur();
    form.hidden = true;compose.hidden = false;root.classList.remove('is-reading');
    schedule();
  }
  function edit() {
    folding(false);root.classList.add('is-reading');form.hidden = false;compose.hidden = true;
    input.focus({ preventScroll: true });say(connected ? '' : i18n("连接恢复中，文字会保留"));
  }
  function updateBadge() { badge.hidden = !unread;badge.textContent = displayText(String(unread)); }
  function render(forceBottom = false) {
    const follow = forceBottom || bottom(), y = log.scrollTop;
    log.replaceChildren();
    if (!entries.length && !pending.size) {
      const empty = document.createElement('p');empty.className = 'rc-empty';empty.textContent = i18n("和对方打个招呼吧。");log.append(empty);
    }
    const addLine = (text: string, by: SideIndex, at: number, item?: Pending) => {
      const line = document.createElement('p');line.className = `rc-message ${by === 0 ? 'rc-us' : 'rc-ussr'}`;
      const who = document.createElement('b');who.textContent = i18n("{0}{1}", [by === 0 ? '美国' : '苏联', by === side ? ' · 你' : '']);
      const time = document.createElement('time');time.dateTime = new Date(at).toISOString();time.textContent = displayText(new Date(at).toLocaleTimeString(document.documentElement.lang, { hour: '2-digit', minute: '2-digit' }));
      const words = document.createElement('span');words.textContent = text;
      line.append(who,time,document.createTextNode('　'),words);
      if (item) {
        line.dataset.pending = item.requestId;line.classList.toggle('is-failed', item.failed);
        const state = document.createElement(item.failed ? 'button' : 'small');state.textContent = displayText(item.failed ? '未发送 · 重试' : '发送中…');
        if (state instanceof HTMLButtonElement) { state.type = 'button';state.title = displayText(item.reason);state.onclick = () => transmit(item); }
        line.append(state);
      }
      log.append(line);
    };
    for (const e of entries) addLine(e.text, e.side, e.at);
    for (const p of pending.values()) addLine(p.text, side, p.at, p);
    if (follow) scrollBottom();else { log.scrollTop = y;latest.hidden = false; }
    schedule();
  }
  function failed(item: Pending, reason: string) {
    if (!pending.has(item.requestId)) return;
    clearTimeout(item.timer);item.failed = true;item.reason = reason;render();say(reason);
  }
  function transmit(item: Pending) {
    if (!connected) { failed(item, i18n("连接恢复后可重试"));return; }
    item.failed = false;item.reason = '';clearTimeout(item.timer);say('');
    if (!send({ type: 'chat-send', requestId: item.requestId, text: item.text })) { failed(item, i18n("连接已断开，消息尚未发送"));return; }
    item.timer = setTimeout(() => failed(item, i18n("尚未确认送达，可重试")), 10000);render(true);
  }
  function submit() {
    if (composing || performance.now() - compositionEnd < 80) return;
    const text = input.value.trim();if (!text) return;
    if (!connected) { say(i18n("连接恢复中，文字会保留"));return; }
    if (pending.size >= 5) { say(i18n("请先等待消息送达，或重试未发送的消息"));return; }
    const item: Pending = { requestId: crypto.randomUUID(), text, at: Date.now(), failed: false, reason: '' };
    pending.set(item.requestId, item);input.value = '';transmit(item);stopEditing();
  }
  function receive(packet: ChatPacket) {
    if (packet.type === 'chat-error') {
      const p = pending.get(packet.requestId);if (p) failed(p, packet.message);return;
    }
    const fresh = packet.type === 'chat-history' ? packet.entries : [packet.entry];
    const known = new Set(entries.map(e => e.seq));
    if (collapsed && hydrated) unread += fresh.filter(e => !known.has(e.seq) && e.side !== side).length;
    const merged = new Map(entries.map(e => [e.seq, e]));
    for (const e of fresh) {
      merged.set(e.seq, e);
      if (e.side === side) { const p = pending.get(e.requestId);clearTimeout(p?.timer);pending.delete(e.requestId); }
    }
    entries = [...merged.values()].sort((a, b) => a.seq - b.seq).slice(-CHAT_HISTORY);
    render(!hydrated);hydrated = true;updateBadge();
    if (!pending.size && connected) say('');
  }
  function setConnected(value: boolean) {
    connected = value;root.classList.toggle('is-offline', !value);
    if (!value) { for (const p of pending.values()) failed(p, i18n("连接已断开，可在恢复后重试"));say(i18n("连接恢复中，文字会保留")); }
    else say('');
  }
  compose.onclick = edit;fold.onclick = () => folding(!collapsed);
  find<HTMLButtonElement>('.rc-heading').onclick = () => {
    if (collapsed) folding(false);
    root.classList.add('is-reading');log.focus({ preventScroll: true });
  };
  latest.onclick = scrollBottom;
  form.onsubmit = e => { e.preventDefault();submit(); };
  input.addEventListener('compositionstart', () => { composing = true; }, opts);
  input.addEventListener('compositionend', () => { composing = false;compositionEnd = performance.now(); }, opts);
  log.addEventListener('scroll', () => { if (bottom()) latest.hidden = true; }, opts);
  // Only the explicit controls intercept the map; the idle message text is click-through.
  for (const kind of ['pointerdown', 'click', 'dblclick', 'wheel']) root.addEventListener(kind, e => e.stopPropagation(), opts);
  window.addEventListener('pointerdown', e => { if (!root.contains(e.target as Node)) stopEditing(); }, opts);
  window.addEventListener('keydown', e => {
    if (root.contains(e.target as Node)) {
      if (e.key === 'Tab') return;
      e.stopImmediatePropagation();
      if (e.isComposing || composing || e.keyCode === 229 || performance.now() - compositionEnd < 80) return;
      if (e.key === 'Escape') { e.preventDefault();stopEditing(); }
      else if (e.key === 'Enter' && e.target === input) { e.preventDefault();submit(); }
      return;
    }
    if (e.key !== 'Enter' || e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if ((e.target instanceof Element && e.target.closest('input,textarea,select,button,a,[contenteditable="true"],[role="button"]')) || document.querySelector('dialog[open],.term-help:popover-open,.hd-card.is-drag')) return;
    // Keep the game's existing Enter-to-confirm shortcut when a choice is on screen.
    if ([...document.querySelectorAll<HTMLElement>('[data-shortcut="enter"]')].some(e => e.offsetHeight)) return;
    e.preventDefault();e.stopImmediatePropagation();edit();
  }, { capture: true, ...opts });
  window.addEventListener('resize', schedule, opts);
  window.visualViewport?.addEventListener('resize', schedule, opts);
  const observer = new ResizeObserver(schedule);
  for (const e of [hud, ...hud.querySelectorAll('.hud-tl,.hud-tr,.hud-bl,.hud-brief,.hud-resolution,[data-part="passives"]')]) observer.observe(e);
  const mutations = new MutationObserver(schedule);
  mutations.observe(hud, { attributes: true, attributeFilter: ['style', 'class'] });
  const shelves = hud.querySelector('[data-part="passives"]');
  if (shelves) mutations.observe(shelves, { attributes: true, attributeFilter: ['class', 'hidden'], childList: true, subtree: true });
  for (const e of hud.querySelectorAll('.hud-brief,.hud-resolution')) mutations.observe(e, { attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
  folding(collapsed, false);render();layout();
  return { receive, setConnected, destroy() {
    disposed = true;abort.abort();observer.disconnect();mutations.disconnect();cancelAnimationFrame(raf);
    for (const p of pending.values()) clearTimeout(p.timer);root.remove();
  } };
}
