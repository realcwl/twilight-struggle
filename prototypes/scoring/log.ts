// What a scoring leaves in the game log: the same numbers as the animation, laid out to be read slowly.
// One design for all ten ways. It is drawn on the game's ivory sheet (src/ui/sheet.css), the way the
// log's own detail pane is, so that it can go into src/hud/parts/battleLog.ts as it stands.
import '../../src/ui/sheet.css';
import { lead, type CountryView, type ScoreView, type SideView } from './view';

let dialog: HTMLDialogElement | null = null;

export function openLog(v: ScoreView, o: { names: [string, string]; turn: number; rifles: string }): void {
  dialog?.remove();
  const d = (dialog = document.createElement('dialog'));
  d.className = 'sheet sl';
  d.setAttribute('aria-label', `${v.name}计分明细`);
  const cls = (s: number): string => (s === 0 ? 'is-a' : 'is-b');
  const chip = (c: CountryView): string =>
    `<span class="sl-country${c.excluded ? ' out' : ''}">${c.key ? `<i class="sl-key">${o.rifles}</i>` : ''}${c.name}${c.adjacent ? '<i class="sl-adj" title="邻接对手的超级大国">邻</i>' : ''}${v.rule === null && c.pts ? `<b>+${c.pts}</b>` : ''}${c.excluded ? '<small>本次不计</small>' : ''}</span>`;
  const cell = (s: SideView, html: string, extra = ''): string => `<td class="${cls(s.side)} ${extra}">${html}</td>`;
  const row = (label: string, hint: string, fn: (s: SideView) => string, extra = ''): string => `<tr class="${extra}"><th>${label}${hint ? `<small>${hint}</small>` : ''}</th>${v.sides.map((s) => cell(s, fn(s))).join('')}</tr>`;
  const num = (n: number | string, unit = ''): string => `<b class="sl-num">${n}</b>${unit ? `<span>${unit}</span>` : ''}`;
  const dash = '<span class="sl-none">—</span>';
  const result = v.lead === null ? '双方抵消 · 胜利点不变' : `${o.names[v.lead]} +${v.net} VP`;
  const hi = Math.max(v.sides[0].total, v.sides[1].total);
  const lo = Math.min(v.sides[0].total, v.sides[1].total);
  const rows = v.rule
    ? [
        row('控制的国家', '', (s) => `${num(s.countries.length, '国')}<div class="sl-countries">${s.countries.map(chip).join('') || '<span class="sl-none">没有</span>'}</div>`),
        row('其中战场国', `本区共 ${v.keyIds.length} 个`, (s) => num(s.keys, `/ ${v.keyIds.length}`)),
        row('档位', '只取最高一档', (s) => `<div class="sl-tier"><strong>${s.tier}</strong>${s.standing === 'none' ? '' : `<b class="sl-num">${s.base}</b>`}</div><p>${s.why}</p>`, 'sl-tier-row'),
        row('战场国', '每个 +1', (s) => (s.standing !== 'none' && s.keys ? num(`+${s.keys}`) : dash)),
        row('邻接对手的超级大国', '每个 +1', (s) => (s.adjacent ? `${num(`+${s.adjacent}`)}<span>${s.countries.filter((c) => c.adjacent && !c.excluded).map((c) => c.name).join('、')}</span>` : dash)),
        row('合计', '', (s) => num(s.total, 'VP'), 'sl-total'),
      ]
    : [
        row('控制的国家', '逐国计分，没有档位', (s) => `${num(s.countries.length, '国')}<div class="sl-countries">${s.countries.map(chip).join('') || '<span class="sl-none">没有</span>'}</div>`),
        row('合计', '', (s) => num(s.total, 'VP'), 'sl-total'),
      ];
  d.innerHTML = `
    <header class="sl-head">
      <div class="sheet-head"><small class="sheet-kicker">战斗日志 · 第 ${o.turn} 回合 · 计分明细</small><h2 class="sheet-title">${v.name}计分</h2></div>
      <div class="sl-result ${v.lead === null ? '' : cls(v.lead)}"><small>结果</small><b>${result}</b><span>${lead(v.vpBefore, o.names)} → ${lead(v.vpAfter, o.names)}</span></div>
      <button type="button" class="sheet-x" aria-label="关闭">×</button>
    </header>
    <div class="sl-list-row" title="日志左侧列表里的这一条">
      <span class="sl-mark">VP</span><span class="sl-list-text"><small>列表里的一行</small><b>${v.name}计分</b><span>${o.names[0]} ${v.sides[0].tier} ${v.sides[0].total} : ${v.sides[1].total} ${v.sides[1].tier} ${o.names[1]} · ${result}</span></span>
    </div>
    <table class="sl-table">
      <thead><tr><th></th>${v.sides.map((s) => `<th class="${cls(s.side)}"><i>${s.short}</i>${s.name}</th>`).join('')}</tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
    <footer class="sl-foot">
      <p class="sl-net"><strong>${v.lead === null ? `两边相抵：${hi} − ${lo} = 0，胜利点不变` : `两边相抵：${hi} − ${lo} = <b class="${cls(v.lead)}">${o.names[v.lead]} +${v.net} VP</b>`}</strong><span>胜利点：${lead(v.vpBefore, o.names)} → ${lead(v.vpAfter, o.names)}</span></p>
      ${v.rule ? `<p class="sl-rule">本区档位：存在 ${v.rule.presence} · 支配 ${v.rule.domination} · 控制 ${v.rule.control === 'win' ? '直接获胜' : v.rule.control}。支配：国家和战场国都比对手多，且至少有一个非战场国。控制：国家比对手多，且控制全部战场国。</p>` : '<p class="sl-rule">这个区域按国家逐个计分，不看档位，也没有战场国和邻接加分。</p>'}
      ${v.notes.map((n) => `<p class="sl-note">${n}</p>`).join('')}
    </footer>`;
  document.body.append(d);
  const close = (): void => {
    d.close();
    d.remove();
    if (dialog === d) dialog = null;
  };
  d.querySelector<HTMLButtonElement>('.sheet-x')!.onclick = close;
  d.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  d.addEventListener('click', (e) => {
    if (e.target === d) close();
  });
  d.addEventListener('keydown', (e) => e.stopPropagation());
  d.showModal();
}
