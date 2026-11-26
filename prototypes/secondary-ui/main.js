// Secondary screens, ten looks. The same seven screens are built once from the game's own cards,
// history texts and glossary, and dressed by data-ui on a wrapper (themes/NN.css).
// Nothing in src/ is changed; the cards are drawn by the game's renderer, without its own popovers.
import catalog from '/src/cards/catalog.json';
import glossary from '/src/cards/glossary.json';
import stories from '/src/cards/history.json';
import { cardHTML, fitCards, esc } from '/src/cards/render.js';
import '/src/cards/card.css';
import { SCHEMES, SPECIMENS } from './schemes.js';

const params = new URLSearchParams(location.search);
const byId = new Map(catalog.map((c) => [c.id, c]));
const term = (id) => glossary.find((t) => t.id === id);
const face = (id) => `<div class="sx-face">${cardHTML(byId.get(id), { interactive: false, lazy: false })}</div>`;
const sideTag = (c) => ({ us: ['a', '美国事件'], ussr: ['b', '苏联事件'], neutral: ['n', '中立事件'], scoring: ['n', '计分牌'] })[c.side];

// ------------------------------------------------------------------ the seven screens
const head = (kicker, title, sub = '') =>
  `<header class="sx-head"><span class="sx-kicker">${kicker}</span><h2 class="sx-title">${title}</h2>${sub ? `<p class="sx-sub">${sub}</p>` : ''}</header>`;
const close = '<button class="sx-close" aria-label="关闭"><svg viewBox="0 0 16 16"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg></button>';
const key = (k) => `<kbd class="sx-key">${k}</kbd>`;

function pick() {
  const theirs = catalog.find((c) => c.side === 'ussr' && c.ops === 4);
  const options = [
    [27, '你方事件', '拿走后立即发生'],
    [31, '中立事件', '拿走后立即发生'],
    [theirs.id, '对手事件', '只用 4 行动点，事件不发生'],
  ];
  return `<section class="sx sx-pick">${head('事件 · 《导弹嫉妒》', '拿取对手的一张牌', '对手手里行动点最高的牌有三张。选一张拿走，《导弹嫉妒》随后交给对手。')}
    <div class="sx-body"><div class="sx-well sx-cards">${options
      .map(([id, kind, note], i) => {
        const [cls] = sideTag(byId.get(id));
        return `<button class="sx-slot${i === 1 ? ' is-on' : ''}" data-pick>${face(id)}<span class="sx-cap"><b class="sx-tag ${cls}">${kind}</b><i>${note}</i></span></button>`;
      })
      .join('')}</div></div>
    <footer class="sx-foot"><span class="sx-hint">${key('←')}${key('→')} 换一张　${key('Enter')} 确认</span><button class="sx-btn is-primary">拿走这张</button></footer></section>`;
}

function order() {
  const c = byId.get(7);
  return `<section class="sx sx-order">${head('你打出了对手的事件牌', '先发生哪一个？', `你用《${c.titleZh}》的 ${c.ops} 行动点。它是苏联事件，事件一定会发生。`)}
    <div class="sx-body"><div class="sx-split"><div class="sx-thumb">${face(7)}</div>
    <div class="sx-options">
      <button class="sx-option is-on" data-option><span class="sx-steps"><b>1</b>事件<i></i><b>2</b>行动点</span><strong class="sx-opt-title">先让事件发生</strong><span class="sx-opt-note">苏联先从西欧移除 3 点美国影响力，你再用 3 行动点补回来。</span></button>
      <button class="sx-option" data-option><span class="sx-steps"><b>1</b>行动点<i></i><b>2</b>事件</span><strong class="sx-opt-title">先用行动点</strong><span class="sx-opt-note">你先放 3 点影响力，随后事件发生，刚放下的也可能被移走。</span></button>
    </div></div></div>
    <footer class="sx-foot"><span class="sx-hint">选定以后不能撤回</span><button class="sx-btn">收回这张牌</button><button class="sx-btn is-primary">就这样</button></footer></section>`;
}

function detail() {
  const c = byId.get(49), story = stories['49'];
  const terms = ['ops', 'action-round'].map(term);
  return `<section class="sx sx-detail">${close}
    <div class="sx-detail-card">${face(49)}</div>
    <div class="sx-detail-text">${head(`冷战中期 · 中立事件 · ${c.ops} 行动点`, `《${c.titleZh}》`)}
      <div class="sx-body">
        <h3 class="sx-sec"><span>历史背景</span><em>${story.period} · ${story.kind}</em></h3>
        <p class="sx-lead">${esc(story.lead)}</p>
        <p class="sx-prose">${esc(story.paragraphs[0])}</p>
        <h3 class="sx-sec"><span>规则要点</span></h3>
        <dl class="sx-terms">${terms.map((t) => `<dt>${t.label}</dt><dd>${esc(t.summary)}</dd>`).join('')}</dl>
      </div>
      <footer class="sx-foot"><span class="sx-hint">${key('Esc')} 关闭</span><a class="sx-link">史料与延伸阅读 ↗</a></footer>
    </div></section>`;
}

function tip() {
  const t = term('control');
  return `<div class="sx-anchor"><span>在日本增加美国影响力，直至美国<mark>控制</mark>日本。</span></div>
    <aside class="sx sx-tip"><header class="sx-head"><span class="sx-kicker">影响力</span><h2 class="sx-title">${t.label}</h2></header>
    <div class="sx-body"><p class="sx-prose">${esc(t.summary)}</p><p class="sx-example"><b>例</b>${esc(t.example)}</p></div>
    <footer class="sx-foot"><span class="sx-hint">规则 ${t.rule}</span><a class="sx-link">看演示 ↗</a></footer></aside>`;
}

function pile() {
  const ids = [13, 60, 62, 67, 34, 36, 40, 71];
  return `<section class="sx sx-pile">${close}${head('牌堆', '弃牌堆<small>14 张</small>')}
    <div class="sx-body"><div class="sx-chips"><button class="sx-chip is-on" data-chip>全部 14</button><button class="sx-chip" data-chip>美国 4</button><button class="sx-chip" data-chip>苏联 6</button><button class="sx-chip" data-chip>中立 3</button><button class="sx-chip" data-chip>计分 1</button></div>
    <div class="sx-well sx-grid">${ids.map((id, i) => `<button class="sx-slot${i === 2 ? ' is-on' : ''}" data-pick>${face(id)}</button>`).join('')}</div></div>
    <footer class="sx-foot"><span class="sx-hint">最近弃掉的排在最前　${key('Esc')} 关闭</span><button class="sx-btn">按回合排</button></footer></section>`;
}

function confirm() {
  return `<section class="sx sx-confirm">${head('第 3 回合 · 行动轮 4', '结束这个行动轮？', '你还有 1 点行动点没有用。结束以后不能撤回。')}
    <footer class="sx-foot"><button class="sx-btn">继续放置</button><button class="sx-btn is-primary">结束行动轮</button></footer></section>
    <div class="sx sx-toast"><span class="sx-kicker">初始部署</span><p>在西欧放置 <b>7</b> 点美国影响力</p><button class="sx-btn is-primary">继续</button></div>`;
}

function atoms() {
  return `<section class="sx sx-atoms"><div class="sx-body">
    <div class="sx-row"><button class="sx-btn is-primary">确认</button><button class="sx-btn">取消</button><button class="sx-btn is-ghost">稍后再说</button><button class="sx-btn" disabled>不可用</button></div>
    <div class="sx-row"><button class="sx-chip is-on" data-chip>全部</button><button class="sx-chip" data-chip>美国</button><button class="sx-chip" data-chip>苏联</button><b class="sx-tag a">美国事件</b><b class="sx-tag b">苏联事件</b><b class="sx-tag n">中立事件</b></div>
    <div class="sx-row"><span class="sx-hint">${key('Space')} 跳过　${key('Esc')} 关闭　${key('←')}${key('→')} 切换</span><a class="sx-link">规则依据 ↗</a></div>
  </div></section>`;
}

const BUILD = { pick, order, detail, tip, pile, confirm, atoms };

// ------------------------------------------------------------------ the page
const bar = document.getElementById('bar');
const board = document.getElementById('board');
let current = SCHEMES.some((s) => s.id === params.get('v')) ? params.get('v') : '01';
let compare = SPECIMENS.some((s) => s.id === params.get('compare')) ? params.get('compare') : null;

function cell(spec, scheme, label) {
  return `<figure class="pg-cell pg-${spec.id}" data-ui="${scheme}"><figcaption><b>${label}</b><span>${spec.note}</span></figcaption><div class="pg-stage">${BUILD[spec.id]()}</div></figure>`;
}

function draw() {
  const s = SCHEMES.find((x) => x.id === current);
  bar.innerHTML = `<div class="pg-tabs">${SCHEMES.map((x) => `<button class="pg-tab${!compare && x.id === current ? ' is-on' : ''}" data-v="${x.id}"><b>${x.id}</b>${x.name}</button>`).join('')}</div>
    <div class="pg-tools"><span class="pg-lbl">十种并排看：</span>${SPECIMENS.slice(0, 6).map((x) => `<button class="pg-tab small${compare === x.id ? ' is-on' : ''}" data-compare="${x.id}">${x.name}</button>`).join('')}</div>`;
  document.body.dataset.mode = compare ? 'compare' : 'scheme';
  if (compare) {
    const spec = SPECIMENS.find((x) => x.id === compare);
    board.innerHTML = `<div class="pg-intro"><h1>${spec.name}<small>同一个界面，十种方案</small></h1><p>${spec.note}。点任意一格进入那个方案。</p></div>
      <div class="pg-compare">${SCHEMES.map((x) => `<div class="pg-mini" data-v="${x.id}">${cell(spec, x.id, `${x.id} ${x.name}`)}</div>`).join('')}</div>`;
  } else {
    board.innerHTML = `<div class="pg-intro"><h1><i>${s.id}</i>${s.name}</h1><p>${s.what}</p><p class="pg-cost">代价：${s.cost}</p></div>
      <div class="pg-grid">${SPECIMENS.map((x) => cell(x, s.id, x.name)).join('')}</div>`;
  }
  fitCards(board);
  const q = new URLSearchParams();
  q.set('v', current);
  if (compare) q.set('compare', compare);
  window.history.replaceState(null, '', `?${q}`);
  window.scrollTo(0, 0);
}

function go(v) {
  current = v;
  compare = null;
  draw();
}

document.addEventListener('click', (e) => {
  const t = e.target instanceof Element ? e.target : null;
  if (!t) return;
  const tab = t.closest('[data-compare]');
  if (tab) {
    compare = compare === tab.dataset.compare ? null : tab.dataset.compare;
    return draw();
  }
  const v = t.closest('[data-v]');
  if (v) return go(v.dataset.v);
  // inside a screen: choosing a card, an option or a filter moves the selection, as it would in play
  for (const kind of ['pick', 'option', 'chip']) {
    const hit = t.closest(`[data-${kind}]`);
    if (!hit) continue;
    hit.parentElement.querySelectorAll(`[data-${kind}]`).forEach((n) => n.classList.toggle('is-on', n === hit));
  }
});

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const i = SCHEMES.findIndex((s) => s.id === current);
  if (e.key === 'ArrowRight') go(SCHEMES[(i + 1) % SCHEMES.length].id);
  else if (e.key === 'ArrowLeft') go(SCHEMES[(i + SCHEMES.length - 1) % SCHEMES.length].id);
  else if (/^[0-9]$/.test(e.key)) go(e.key === '0' ? '10' : `0${e.key}`);
  else if (e.key === 'g' || e.key === 'G') {
    compare = compare ? null : 'pick';
    draw();
  }
});

draw();
document.fonts.ready.then(() => {
  fitCards(board);
  document.documentElement.classList.add('ready');
});
window.proto = { go, get current() { return current; }, SCHEMES, SPECIMENS };
