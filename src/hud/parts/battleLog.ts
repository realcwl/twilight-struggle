import { t as i18n, text as displayText } from '../../i18n/index.js';
import { type PartFactory, type Part, esc, label, sideClass } from '../dom';
import '../../ui/sheet.css';
import { BATTLE_PHASES, BATTLE_VERBS, battleText, battleLogFor, type BattleEntry } from '../../game/history';
import { highlight } from '../../cards/terms.js';
import { installTermHelp } from '../../cards/tooltips.js';
import { scoringLogHTML } from './scoringLog';
import '../battleLog.css';

const book = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 8h28v32H13a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4M14 8v25M10 33h28M20 15h12M20 21h12M20 27h7"/><circle cx="28" cy="21" r="17" opacity=".15"/></svg>';

/** A compact journal replaces the empty table slot; it remains the card-flight anchor. */
export const battleLog: PartFactory = (host, ctx) => {
  const title = i18n("战斗日志");
  host.className = 'pl bl';
  host.innerHTML = i18n("<button type=\"button\" class=\"pl-slot bl-open\" aria-label=\"{0}\" aria-haspopup=\"dialog\"><span class=\"bl-cover\">{1}<b>{2}</b><span class=\"bl-count\"></span><small class=\"bl-latest\"></small></span></button><div class=\"pl-cap\">{3}<span class=\"bl-dot\" hidden></span></div>", [title, book, displayText('对局记录'), label(title)]);
  const button = host.querySelector<HTMLButtonElement>('button')!, slot = button;
  const dialog = document.createElement('dialog');
  dialog.className = 'bl-dialog sheet';
  dialog.setAttribute('aria-label', title);
  dialog.innerHTML = i18n("<header class=\"bl-heading\"><span class=\"bl-heading-icon\">{0}</span><div class=\"sheet-head\"><small class=\"sheet-kicker\">{1}</small><h2 class=\"sheet-title\">{2}</h2></div><span class=\"bl-total sheet-count\"></span><button type=\"button\" class=\"bl-export sheet-btn\">{3}</button><button type=\"button\" class=\"bl-close sheet-x\" aria-label=\"关闭战斗日志\">×</button></header><div class=\"bl-tools\"><select class=\"bl-turn sheet-field\" aria-label=\"筛选回合\"><option value=\"all\">全部回合</option></select><div class=\"bl-sides\" role=\"group\" aria-label=\"筛选出牌方\"><button type=\"button\" data-side=\"all\" aria-pressed=\"true\">全部</button><button type=\"button\" data-side=\"{4}\" aria-pressed=\"false\">我方</button><button type=\"button\" data-side=\"{5}\" aria-pressed=\"false\">对手</button></div><input class=\"bl-search sheet-field\" type=\"search\" placeholder=\"搜索牌名、国家或结果\" aria-label=\"搜索战斗日志\"><button type=\"button\" class=\"bl-newest sheet-btn\">最新 ↓</button></div><div class=\"bl-body\"><nav class=\"bl-list\" aria-label=\"按回合的对局记录\"></nav><article class=\"bl-detail\" aria-live=\"polite\"></article></div><footer class=\"bl-foot\">{6}</footer>", [book, displayText('每一步，都有迹可循'), title, displayText('导出日志'), ctx.player, 1 - ctx.player, displayText('记录公开行动与自己看到的牌 · 保存后可继续复盘')]);
  ctx.root.append(dialog);
  const preview = document.createElement('dialog');
  preview.className = 'bl-reveal-preview';
  preview.innerHTML = i18n("<button type=\"button\" class=\"bl-preview-close\" aria-label=\"{0}\">×</button><div class=\"bl-preview-face\"></div>", [displayText('关闭牌面')]);
  dialog.append(preview);
  let previewOpener: HTMLElement | null = null;
  const closePreview = () => {
    installTermHelp().hide();
    if (preview.open) preview.close();
  };
  preview.querySelector<HTMLButtonElement>('button')!.onclick = closePreview;
  preview.addEventListener('cancel', e => {
    e.stopPropagation();
    if (document.querySelector('.term-help:not([hidden])')) e.preventDefault();
  });
  preview.addEventListener('close', () => {
    preview.querySelector('.bl-preview-face')!.replaceChildren();
    if (dialog.open) (previewOpener?.isConnected ? previewOpener : dialog.querySelector<HTMLButtonElement>('.bl-close'))?.focus({ preventScroll: true });
  });
  preview.addEventListener('click', e => {
    if (e.target !== preview) return;
    const r = preview.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closePreview();
  });
  const list = dialog.querySelector<HTMLElement>('.bl-list')!;
  const detail = dialog.querySelector<HTMLElement>('.bl-detail')!;
  const turn = dialog.querySelector<HTMLSelectElement>('.bl-turn')!;
  const search = dialog.querySelector<HTMLInputElement>('.bl-search')!;
  let entries: readonly BattleEntry[] = [], selected: number | null = null, side = 'all', shown: string | null = null;
  let source: readonly BattleEntry[] | undefined;
  const phase = (e: BattleEntry) => `${BATTLE_PHASES[e.phase]}${e.phase === 'action' && e.round ? ` ${e.round}` : ''}`;
  const owner = (e: BattleEntry) => e.by === null ? i18n("公共记录") : i18n("{0} · {1}", [ctx.sideName(e.by), e.by === ctx.player ? '我方' : '对手']);
  const match = (e: BattleEntry) => (turn.value === 'all' || String(e.turn) === turn.value) && (side === 'all' || String(e.by) === side) && (!search.value.trim() || `${e.title} ${e.verb ? BATTLE_VERBS[e.verb] : ''} ${owner(e)} ${e.lines.map(l => l.text).join(' ')}`.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()));
  const visible = () => entries.filter(match);
  function renderDetail(): void {
    const entry = entries.find(e => e.id === selected);
    if (!entry) {
      detail.innerHTML = i18n("<div class=\"bl-empty\">{0}<h3>暂无匹配的记录</h3><p>选择其他回合或清除搜索条件。</p></div>", [book]);
      return;
    }
    const top = detail.scrollTop;
    // A scoring is one table: the lines that say the same in words (the other side's, and one per note) are not also listed.
    const tabled = new Set<number>();
    entry.lines.forEach((l, i) => {
      if (l.scoring) for (let k = 1; k <= 1 + l.scoring.notes.length; k++) tabled.add(i + k);
    });
    detail.innerHTML = i18n("<div class=\"bl-record{0}\">\n      {1}\n      <div class=\"bl-commentary\"><header class=\"bl-record-head {2}\"><span class=\"bl-record-who\">{3}</span><h3>{4}</h3><p>第 {5} 回合 · {6}{7}</p><span class=\"bl-state {8}\">{9}</span></header>\n      <ol class=\"bl-lines\">{10}</ol></div></div>", [entry.card ? ' has-card' : '', entry.card ? '<div class="bl-card"></div>' : '', entry.by === null ? '' : sideClass(entry.by), esc(owner(entry)), esc(entry.title), entry.turn, phase(entry), entry.verb ? ` · ${BATTLE_VERBS[entry.verb]}` : '', entry.status, entry.kind === 'legacy' ? '旧存档摘要 · 当时未记录的骰点和变化无法补回' : entry.status === 'resolving' ? '结算中' : '已结算', entry.lines.map((l, i) => tabled.has(i) ? '' : l.scoring ? `<li class="bl-line-scoring">${scoringLogHTML(l.scoring, { lang: ctx.lang, sideName: ctx.sideName })}</li>` : l.kind === 'reveal'
        ? `<li class="bl-line-reveal"><div class="bl-reveal"><div class="bl-reveal-heading"><b>${displayText('当时看到的')}${esc(l.reveal.label)}</b><span>${l.reveal.cards.length} ${displayText('张')}</span></div><p>${l.reveal.cards.length ? (displayText('当时的手牌快照 · 点击牌面放大')) : (displayText('当时没有符合条件的牌'))}</p><div class="bl-reveal-cards" data-reveal="${i}"></div></div></li>`
        : `<li class="bl-line-${l.kind}"><span class="bl-line-icon">${l.kind === 'roll' ? '⚄' : l.kind === 'score' ? 'VP' : l.kind === 'passive' ? '✦' : l.kind === 'move' ? '→' : '·'}</span><span>${highlight(l.text, { interactive: true })}</span></li>`).join('') || '<li><span>等待结算结果…</span></li>']);
    if (entry.card) {
      const face = ctx.cards.face(entry.card);
      detail.querySelector('.bl-card')!.append(face);
      ctx.cards.fit(face);
    }
    entry.lines.forEach((line, i) => {
      if (line.kind !== 'reveal') return;
      const gallery = detail.querySelector(`[data-reveal="${i}"]`)!;
      for (const id of line.reveal.cards) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'bl-reveal-card'; b.dataset.card = id;
        b.setAttribute('aria-label', i18n("{0}{1}", [displayText('查看'), ctx.cards.describe(id)]));
        const face = ctx.cards.face(id); face.inert = true; b.append(face); gallery.append(b); ctx.cards.fit(face);
        b.onclick = () => {
          installTermHelp().hide(); previewOpener = b;
          const enlarged = ctx.cards.face(id);
          preview.querySelector('.bl-preview-face')!.replaceChildren(enlarged);
          preview.setAttribute('aria-label', ctx.cards.describe(id));
          preview.showModal(); ctx.cards.fit(enlarged);
        };
      }
    });
    detail.scrollTop = top;
  }
  function render(): void {
    const rows = visible(), scroll = list.scrollTop;
    if (!rows.some(e => e.id === selected)) selected = rows.at(-1)?.id ?? null;
    let at = -1;
    list.innerHTML = displayText(rows.slice().reverse().map(e => {
      const group = at === e.turn ? '' : `<h3 class="bl-turn-head">第 ${e.turn} 回合 <span>${rows.filter(x => x.turn === e.turn).length} 条</span></h3>`;
      at = e.turn;
      const result = [...e.lines].reverse().find(l => l.kind !== 'note')?.text ?? e.lines.at(-1)?.text ?? '等待结算…';
      return `${group}<button type="button" class="bl-entry ${e.by === null ? '' : sideClass(e.by)}${e.id === selected ? ' selected' : ''}" data-entry="${e.id}" aria-pressed="${e.id === selected}"><span class="bl-entry-mark">${e.by === null ? '·' : esc(ctx.sideShort(e.by))}</span><span class="bl-entry-text"><small>${phase(e)}${e.verb ? ` · ${BATTLE_VERBS[e.verb]}` : ''}${e.status === 'resolving' ? ' · 结算中' : ''}</small><b>${esc(e.title)}</b><span>${esc(result)}</span></span><i>›</i></button>`;
    }).join('') || '<p class="bl-no-results">暂无记录</p>');
    list.scrollTop = scroll;
    renderDetail();
  }
  function refresh(): void {
    const value = turn.value;
    turn.innerHTML = displayText('<option value="all">全部回合</option>' + [...new Set(entries.map(e => e.turn))].reverse().map(t => `<option value="${t}">第 ${t} 回合</option>`).join(''));
    turn.value = [...turn.options].some(o => o.value === value) ? value : 'all';
    dialog.querySelector('.bl-total')!.textContent = i18n("{0} 次出牌 · {1} 条记录", [entries.filter(e => e.kind === 'card').length, entries.length]);
    render();
  }
  function close(): void {
    closePreview();
    installTermHelp().hide();
    if (dialog.open) dialog.close();
    button.focus({ preventScroll: true });
  }
  button.onclick = () => {
    if (dialog.open) return;
    selected = [...entries].reverse().find(e => e.kind === 'card' && e.card)?.id ?? entries.at(-1)?.id ?? null;
    dialog.showModal();
    refresh();
    button.setAttribute('aria-expanded', 'true');
  };
  dialog.querySelector<HTMLButtonElement>('.bl-close')!.onclick = close;
  dialog.addEventListener('close', () => button.setAttribute('aria-expanded', 'false'));
  dialog.addEventListener('cancel', e => { if (document.querySelector('.term-help:not([hidden])')) e.preventDefault(); });
  dialog.addEventListener('keydown', e => e.stopPropagation());
  dialog.addEventListener('click', e => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
  });
  list.onclick = e => {
    const target = (e.target as Element).closest<HTMLElement>('[data-entry]');
    if (!target) return;
    selected = Number(target.dataset.entry);
    detail.scrollTop = 0;
    render();
  };
  turn.onchange = search.oninput = () => { selected = null; list.scrollTop = 0; render(); };
  dialog.querySelector('.bl-sides')!.addEventListener('click', e => {
    const target = (e.target as Element).closest<HTMLElement>('[data-side]');
    if (!target) return;
    side = target.dataset.side!;
    dialog.querySelectorAll<HTMLElement>('[data-side]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.side === side)));
    selected = null; list.scrollTop = 0; render();
  });
  dialog.querySelector<HTMLButtonElement>('.bl-newest')!.onclick = () => { selected = visible().at(-1)?.id ?? null; list.scrollTop = detail.scrollTop = 0; render(); };
  dialog.querySelector<HTMLButtonElement>('.bl-export')!.onclick = () => {
    const blob = new Blob([i18n("冷战 · 战斗日志\n\n{0}\n", [battleText(entries)])], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = i18n("冷战-战斗日志-第{0}回合.txt", [entries.at(-1)?.turn ?? 1]); a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const sync: Part = (s, prev, animate) => {
    if (s.battleLog !== undefined && s.battleLog !== source) {
      source = s.battleLog;
      entries = battleLogFor(s.battleLog, ctx.player);
      button.querySelector('.bl-count')!.textContent = i18n("{0} 次出牌", [entries.filter(e => e.kind === 'card').length]);
      button.querySelector('.bl-latest')!.textContent = displayText(entries.at(-1)?.title ?? '等待第一步行动');
      if (dialog.open) refresh();
    }
    const latest = [...entries].reverse().find(e => e.kind === 'card' && e.card);
    // Intermediate network frames omit history. Keep the last public face until the full log
    // arrives; phase changes and an empty table must not turn the cover back into a blank book.
    const cover = s.played?.card ?? (s.battleLog !== undefined ? latest?.card ?? null : shown);
    host.classList.toggle('has', !!cover);
    button.title = displayText(cover ? `${title} · ${ctx.cards.describe(cover)}` : title);
    if (shown === cover) return;
    const old = slot.querySelector<HTMLElement>('.slot');
    // This is the journal's cover, not a second physical copy travelling to a pile.
    old?.remove(); shown = cover;
    if (!cover) return;
    const face = ctx.cards.face(cover); face.inert = true; slot.append(face); ctx.cards.fit(face);
    if (!animate || !prev) return;
    face.classList.add('pl-arriving');
  };
  sync.dispose = () => { closePreview(); if (dialog.open) installTermHelp().hide(); dialog.remove(); };
  return sync;
};
