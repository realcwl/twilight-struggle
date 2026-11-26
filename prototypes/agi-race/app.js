/* 规则页的渲染（v0.6.2）：从 data.js 读内容，画地图和开局、分数条、记分牌、三条科技线、
   融资难度、回合表、卡牌，外加垄断演示、收购计算器和批注。 */
(function () {
  'use strict';
  var D = window.AGI;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }
  function pct(x) { return Math.round(x * 100) + '%'; }
  function flat(a) { return [].concat.apply([], a); }
  function sum(a, f) { return a.reduce(function (x, y) { return x + f(y); }, 0); }

  var SIDE = { US: { n: '美国', c: 'us' }, CN: { n: '中国', c: 'cn' }, N: { n: '中立', c: 'nu' } };
  var ERA = {};
  D.eras.forEach(function (e) { ERA[e.id] = e; });
  var FLAG = {
    dice:   { t: '🎲 掷骰', c: 'rolltag' },
    launch: { t: '发布', c: 'rolltag' },
    perm:   { t: '常驻', c: 'perm' },
    env:    { t: '环境', c: 'perm' },
    tight:  { t: '收紧 ▲', c: 'zap' },
    ease:   { t: '宽松 ▼', c: 'bat' },
    once:   { t: '一次性', c: '' }
  };
  var FLAG_ORDER = ['launch', 'dice', 'perm', 'env', 'tight', 'ease', 'once'];
  var WHY = { rule: '规则换了', gone: '原来点的英联邦没有了', name: '换了说法' };
  var MARKETS = flat(D.regions.map(function (r) { return r.mk; }));

  $('#ver').textContent = D.version + ' · ' + D.date;
  $('#fact-cards').textContent = D.cards.length + ' + ' + D.regions.length;
  $('#card-total').textContent = D.cards.length;

  /* ───────── 份额：两个数，画成两串点 ───────── */
  function sharePips(us, cn, big) {
    function run(n, k) { var h = ''; for (var i = 0; i < n; i++) h += '<i class="c ' + k + '"></i>'; return h; }
    return '<span class="sh' + (big ? ' big' : '') + '"><span class="cells l">' + run(us, 'us') + '</span>' +
      '<span class="vs">' + us + ' : ' + cn + '</span><span class="cells">' + run(cn, 'cn') + '</span></span>';
  }
  function leanText(r) { return r.lean === 'us' ? '美国占先' : (r.lean === 'cn' ? '中国占先' : '均势'); }
  function banText(r) { return r.ban ? r.ban + ' 级起不能收购' : '一直能收购'; }

  /* ───────── R3 地图：示意图上四列两行，左边美洲，中间欧洲和非洲，右边亚洲。写成 行起 / 列起 / 行止 / 列止 ───────── */
  var SLOT = { am: '2 / 1 / 3 / 2', eu: '1 / 2 / 2 / 3', af: '2 / 2 / 3 / 3', me: '2 / 3 / 3 / 4', ea: '1 / 4 / 2 / 5', se: '2 / 4 / 3 / 5' };

  function renderMap() {
    function row(m) {
      return '<div class="mk3"><span class="nm">' + (m.key ? '<b>★ ' + m.name + '</b>' : m.name) + '</span>' +
        '<span class="tg">' + m.tag + '</span>' +
        '<span class="sh2"><b class="us-t' + (m.us ? '' : ' off') + '">' + m.us + '</b><em>:</em><b class="cn-t' + (m.cn ? '' : ' off') + '">' + m.cn + '</b></span>' +
        '<span class="wt" title="重量级">' + m.w + '</span></div>';
    }
    var boxes = D.regions.map(function (r) {
      var us = sum(r.mk, function (m) { return m.us; }), cn = sum(r.mk, function (m) { return m.cn; });
      return '<div class="rg' + (r.lean ? ' lean-' + r.lean : '') + '" style="grid-area:' + SLOT[r.slot] + '" data-note="大区-' + r.name + '" data-title="' + r.name + '">' +
        '<h4>' + r.name + '<i class="era-b ' + (r.era === 'E' ? 'e' : 'm') + '">' + ERA[r.era].name + '</i></h4>' +
        '<p class="rg-meta">' + r.sub + '<br>开局' + leanText(r) + '：美 ' + us + ' 点，中 ' + cn + ' 点 · ' + banText(r) + '</p>' +
        r.mk.map(row).join('') + '</div>';
    }).join('');
    $('#map').innerHTML = '<div class="world final">' +
      '<div class="home us" style="grid-area:1 / 1 / 2 / 2">美国本土<span>连着' + D.homes.US.join('、') + '</span></div>' +
      '<div class="home cn" style="grid-area:1 / 3 / 2 / 4">中国本土<span>连着' + D.homes.CN.join('、') + '</span></div>' +
      boxes + '</div>';
    $('#gates').textContent = D.gates.map(function (g) { return g[0] + '—' + g[1]; }).join('，');
    $('#home-us').textContent = D.homes.US.join('、');
    $('#home-cn').textContent = D.homes.CN.join('、');
  }
  function renderRegionTable() {
    var tu = 0, tc = 0;
    var h = '<table class="grid rt"><thead><tr><th>大区</th><th>记分牌</th><th>美国</th><th>中国</th><th>开局</th><th>融资难度</th></tr></thead><tbody>';
    D.regions.forEach(function (r) {
      var us = sum(r.mk, function (m) { return m.us; }), cn = sum(r.mk, function (m) { return m.cn; });
      tu += us; tc += cn;
      h += '<tr><td><b>' + r.name + '</b></td><td><i class="era-b ' + (r.era === 'E' ? 'e' : 'm') + '">' + ERA[r.era].name + '</i></td>' +
        '<td class="n us-t">' + us + '</td><td class="n cn-t">' + cn + '</td><td>' + leanText(r) + '</td><td>' + banText(r) + '</td></tr>';
    });
    $('#region-table').innerHTML = h + '<tr class="sumrow"><td><b>合计</b></td><td></td><td class="n us-t"><b>' + tu + '</b></td><td class="n cn-t"><b>' + tc + '</b></td><td colspan="2">然后各自再放 2 点</td></tr></tbody></table>';
  }

  /* ───────── R3a 垄断演示：拿下要够数，拿下之后有 1 点余量 ───────── */
  function shareDemo() {
    var host = $('#share-demo');
    var st = { w: 3, us: 1, cn: 1, hold: '', spentUS: 0, spentCN: 0, log: '点下面的按钮试试。' };
    function lead(k) { return k === 'us' ? st.us - st.cn : st.cn - st.us; }
    function reflag() {
      if (st.hold && lead(st.hold) >= st.w - 1) return;            // 还在余量里
      st.hold = lead('us') >= st.w ? 'us' : (lead('cn') >= st.w ? 'cn' : '');
    }
    function act(me, op) {
      var cost = st.hold === op ? 2 : 1, was = st.hold;
      st[me]++;
      st[me === 'us' ? 'spentUS' : 'spentCN'] += cost;
      reflag();
      st.log = (me === 'us' ? '美国' : '中国') + ' +1 点份额，花 ' + cost + ' 点。' +
        (was && st.hold === was && lead(was) < st.w ? '垄断还在：只少了 1 点，在余量里。' : (was && st.hold !== was ? '垄断丢了。' : ''));
      draw();
    }
    function reset(msg) { st.us = 1; st.cn = 1; st.hold = ''; st.spentUS = st.spentCN = 0; st.log = msg; draw(); }
    function draw() {
      var h = st.hold, diff = Math.abs(st.us - st.cn);
      var status = h === 'us' ? '<span class="us-t">美国垄断</span>' : (h === 'cn' ? '<span class="cn-t">中国垄断</span>' : '没有人垄断');
      if (h && lead(h) < st.w) status += '<span class="muted">（在余量里，再少 1 点就丢）</span>';
      host.innerHTML =
        '<h5>试一试 · 垄断和余量</h5>' +
        '<div class="row"><label>重量级 <select data-k="w">' + [1, 2, 3, 4].map(function (n) {
          return '<option' + (n === st.w ? ' selected' : '') + '>' + n + '</option>';
        }).join('') + '</select></label><span class="muted">多出 ' + st.w + ' 点拿下；拿下之后多出 ' + Math.max(0, st.w - 1) + ' 点还算</span></div>' +
        '<div class="row">' + sharePips(st.us, st.cn, true) + '</div>' +
        '<div class="row"><span class="status">' + status + '</span><span class="muted">现在差 ' + diff + ' 点</span></div>' +
        '<div class="row">' +
        '<button data-a="us">美国拓展 1 点（花 ' + (h === 'cn' ? 2 : 1) + ' 点）</button>' +
        '<button data-a="cn">中国拓展 1 点（花 ' + (h === 'us' ? 2 : 1) + ' 点）</button>' +
        '<button data-a="reset" class="ghost">重来</button></div>' +
        '<div class="log">' + st.log + ' 累计花掉的行动点：美 ' + st.spentUS + '，中 ' + st.spentCN + '。</div>';
    }
    host.addEventListener('click', function (ev) {
      var a = ev.target.getAttribute && ev.target.getAttribute('data-a');
      if (a === 'us') act('us', 'cn');
      else if (a === 'cn') act('cn', 'us');
      else if (a === 'reset') reset('重新开始。');
    });
    host.addEventListener('change', function (ev) {
      if (ev.target.getAttribute('data-k') === 'w') { st.w = +ev.target.value; reset('换成重量级 ' + st.w + ' 的市场。'); }
    });
    draw();
  }

  /* ───────── R4 分数条和记分牌 ───────── */
  function renderVP() {
    var W = D.VP_WIN, ticks = '';
    for (var v = -W; v <= W; v += 5) {
      ticks += '<i class="' + (v === 0 ? 'zero' : (v < 0 ? 'cn' : 'us')) + (Math.abs(v) === W ? ' end' : '') + '" style="left:' + ((v + W) / (2 * W) * 100) + '%"><b>' + (v === 0 ? '0' : Math.abs(v)) + '</b></i>';
    }
    $('#vpbar').innerHTML = '<div class="vp"><span class="vp-end cn-t">中国领先 ' + W + ' 分<br>立刻赢</span>' +
      '<div class="vp-track"><div class="vp-line"></div>' + ticks + '<u style="left:50%" title="开局在这里"></u></div>' +
      '<span class="vp-end us-t">美国领先 ' + W + ' 分<br>立刻赢</span></div>';
  }
  function renderScoreCards() {
    var h = '<table class="grid sc"><thead><tr><th style="width:9.5em">记分牌</th><th style="width:4.6em">进牌库</th><th>这个大区的市场</th></tr></thead><tbody>';
    D.regions.forEach(function (r) {
      h += '<tr><td><b>' + r.name + '记分</b></td><td><i class="era-b ' + (r.era === 'E' ? 'e' : 'm') + '">' + ERA[r.era].name + '</i></td><td>' +
        r.mk.map(function (m) { return m.key ? '<b>★ ' + m.name + '</b>' : m.name; }).join('、') + '</td></tr>';
    });
    $('#score-cards').innerHTML = h + '</tbody></table>';
  }

  /* ───────── R5 三条科技线 ───────── */
  function renderLines() {
    $('#lines').innerHTML = '<div class="bars3">' + D.lines.map(function (l) {
      var strip = '<div class="tug">' +
        [3, 2, 1].map(function (n) { return '<i class="cn">' + n + '</i>'; }).join('') + '<i class="zero">0</i>' +
        [1, 2, 3].map(function (n) { return '<i class="us">' + n + '</i>'; }).join('') + '</div>' +
        '<div class="tug-lab"><span class="cn-t">← 中国这边</span><span>开局</span><span class="us-t">美国这边 →</span></div>';
      return '<article class="barcard" data-note="线-' + l.name + '" data-title="' + l.name + '线">' +
        '<header><h4>' + l.name + '<span>' + l.what + '</span></h4><p>' + l.theme + '</p></header>' +
        '<div class="barwrap">' + strip + '</div>' +
        '<ol class="buffs">' + l.steps.map(function (s, i) {
          return '<li><span class="at">第 ' + (i + 1) + ' 格</span><b>' + s.name + '</b>' + s.text + '</li>';
        }).join('') + '</ol></article>';
    }).join('') + '</div>';
  }

  /* ───────── R6 收购计算器 ───────── */
  function sel(st, k, list, fmt) {
    return '<select data-k="' + k + '">' + list.map(function (n) {
      return '<option value="' + n + '"' + (n === st[k] ? ' selected' : '') + '>' + (fmt ? fmt(n) : n) + '</option>';
    }).join('') + '</select>';
  }
  function acqCalc() {
    var host = $('#acq-calc');
    var st = { w: 3, v: 3, mod: 0, opp: 3, mono: 1 };
    function split(sx) {
      var out = Math.min(sx, st.opp), mine = Math.min(sx - out, st.w);   // 多出来的最多加到刚好垄断
      return '清 ' + out + (mine ? '，自己 +' + mine : '');
    }
    function draw() {
      var thr = st.w * 2 + (st.mono ? 1 : 0), base = st.v + st.mod - thr, mean = 0, hit = 0, brk = 0;
      var tds = [1, 2, 3, 4, 5, 6].map(function (r) {
        var sx = Math.max(0, r + base);
        mean += sx / 6;
        if (sx > 0) hit++;
        if (sx >= 2) brk++;
        return '<td class="' + (sx > 0 ? 'hit' : 'zero') + '">' + (sx > 0 ? split(sx) : '—') + '</td>';
      }).join('');
      host.innerHTML =
        '<h5>算一算 · 收购</h5>' +
        '<div class="row">' +
        '<label>重量级 ' + sel(st, 'w', [1, 2, 3, 4]) + '</label>' +
        '<label>牌值 ' + sel(st, 'v', [1, 2, 3, 4, 5]) + '</label>' +
        '<label>修正 ' + sel(st, 'mod', [-2, -1, 0, 1, 2], function (n) { return (n > 0 ? '+' : '') + n; }) + '</label>' +
        '<label>对手有 ' + sel(st, 'opp', [1, 2, 3, 4, 5, 6]) + ' 点</label>' +
        '<label>对手 ' + sel(st, 'mono', [1, 0], function (n) { return n ? '垄断着这里' : '没有垄断'; }) + '</label></div>' +
        '<table class="dice"><tr><th>骰子</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th></tr>' +
        '<tr><th>结果</th>' + tds + '</tr></table>' +
        '<div class="log">门槛 ' + thr + '（重量级 × 2' + (st.mono ? '，对手垄断着再 +1' : '') + '）。有收获的机会 ' + pct(hit / 6) + '，平均成功 ' + mean.toFixed(1) + ' 点。' +
        (st.mono ? '要打破一个刚好垄断的市场得清掉 2 点：机会 ' + pct(brk / 6) + '。' : '') +
        '对手清光之后多出来的，最多加到刚好垄断。</div>';
    }
    host.addEventListener('change', function (ev) {
      var k = ev.target.getAttribute('data-k');
      if (k) { st[k] = +ev.target.value; draw(); }
    });
    draw();
  }

  /* ───────── R7 融资难度阶梯：每一级禁哪些大区的收购 ───────── */
  function renderFinance() {
    var h = '<div class="fin">' + D.finance.map(function (f) {
      return '<div class="fl' + (f.lv === 5 ? ' dead' : (f.lv === 4 ? ' warn' : '')) + '"><b>' + f.lv + '</b><span>' + f.name + '</span></div>';
    }).join('') + '</div>';
    h += '<table class="grid fin-t"><thead><tr><th style="width:8em">大区</th>' + D.finance.map(function (f) { return '<th>' + f.lv + '</th>'; }).join('') + '</tr></thead><tbody>';
    D.regions.slice().sort(function (a, b) { return (a.ban || 9) - (b.ban || 9); }).forEach(function (r) {
      h += '<tr><td><b>' + r.name + '</b></td>' + D.finance.map(function (f) {
        var b = r.ban && f.lv >= r.ban;
        return '<td class="' + (b ? 'ban' : 'okc') + '">' + (b ? '禁' : '可') + '</td>';
      }).join('') + '</tr>';
    });
    $('#finance').innerHTML = h + '</tbody></table>';
  }

  /* ───────── R8 回合表 ───────── */
  function renderTurns() {
    var T = D.turns;
    function row(label, fn, cls) {
      return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><th class="row">' + label + '</th>' +
        T.map(function (t, i) {
          return '<td class="' + ((i === 3 || i === 6) ? 'edge' : '') + '">' + fn(t, i) + '</td>';
        }).join('') + '</tr>';
    }
    function span3(label, m, cls, cfn) {
      return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><th class="row">' + label + '</th>' +
        D.eras.map(function (e, i) {
          return '<td colspan="3" class="' + [(i ? 'edge' : ''), cfn ? cfn(e) : ''].join(' ').trim() + '">' + (typeof m === 'function' ? m(e) : m[e.id]) + '</td>';
        }).join('') + '</tr>';
    }
    var sc = function (era) { return D.regions.filter(function (r) { return r.era === era; }).map(function (r) { return r.name; }).join(' · '); };
    var n = function (era) { return D.cards.filter(function (c) { return c.era === era; }).length; };
    $('#turn-grid').innerHTML = '<table class="turns">' +
      row('年份', function (t) { return String(t.y); }, 'yr') +
      span3('时代', function (e) { return e.name + '<span>' + e.theme + '</span>'; }, 'era') +
      span3('洗进牌库的事件牌', function (e) { return n(e.id) + ' 张'; }) +
      span3('洗进牌库的记分牌', { E: sc('E'), M: sc('M'), L: '没有新的；2030 年终每个大区再记一次' }) +
      row('手牌 / 行动轮', function (t) { return t.hand + ' / ' + t.ar; }) +
      '<tr><th class="row">投入科技线</th><td colspan="9">每年每方 1 次，占一个行动轮</td></tr>' +
      '<tr><th class="row">资本压力</th><td colspan="9">每年的资本开支（收购 + 投入）要达到年终时的融资难度；差几点，对手得几分</td></tr>' +
      span3('先手', { E: '美国', M: '分数落后的一方', L: '中国' }) +
      span3('倾向', function (e) { return e.lean; }, '', function (e) { return e.id === 'E' ? 'lean-us' : (e.id === 'L' ? 'lean-cn' : ''); }) +
      '</table>';
  }

  function renderTilt() {
    var max = 0, rows = D.eras.map(function (e) {
      var r = { e: e, US: { n: 0, p: 0 }, CN: { n: 0, p: 0 }, N: { n: 0, p: 0 } };
      D.cards.forEach(function (c) { if (c.era === e.id) { r[c.side].n++; r[c.side].p += c.p; } });
      max = Math.max(max, r.US.p, r.CN.p);
      return r;
    });
    $('#tilt').innerHTML = rows.map(function (r) {
      function bar(k) {
        return '<div class="bar ' + SIDE[k].c + '"><i style="width:' + Math.round(r[k].p / max * 62) + '%"></i>' +
          '<span>' + SIDE[k].n + ' ' + r[k].n + ' 张 · 力度 ' + r[k].p + '</span></div>';
      }
      return '<div class="trow"><b>' + r.e.name + '</b><div class="bars">' + bar('US') + bar('CN') + '</div></div>';
    }).join('');
  }

  /* ───────── R9 定稿时对牌做了什么 ───────── */
  function renderImpact() {
    var changed = D.cards.filter(function (c) { return c.rev; });
    var by = function (k) { return changed.filter(function (c) { return c.rev === k; }); };
    var named = {};
    D.cards.forEach(function (c) { MARKETS.forEach(function (m) { if (c.text.indexOf(m.name) >= 0) named[m.name] = 1; }); });
    var unnamed = MARKETS.filter(function (m) { return !named[m.name]; });
    $('#unnamed-n').textContent = unnamed.length;
    function table(list) {
      return '<table class="grid"><thead><tr><th style="width:9em">牌</th><th>原来</th><th>现在</th></tr></thead><tbody>' +
        list.map(function (c) {
          return '<tr><td><b>' + c.id + '</b> ' + esc(c.name) + '</td><td class="fine">' + esc(c.was) + '</td><td>' + esc(c.text) + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    var h = '<div class="impact">';
    h += '<article data-note="R9a" data-title="记分牌"><h3><i>R9a</i>六张记分牌</h3>' +
      '<p>' + D.regions.map(function (r) { return '<b>' + r.name + '记分</b>（' + ERA[r.era].name + '）'; }).join('、') + '。没有牌值，没有归属，规矩见 <a href="#r4b">R4b</a>。它们不算在下面的 ' + D.cards.length + ' 张里。</p></article>';
    h += '<article data-note="R9b" data-title="定稿时改过的牌"><h3><i>R9b</i>定稿时改过字的 ' + changed.length + ' 张</h3>' +
      '<p>编号、牌名、牌值都没有动，剩下的 ' + (D.cards.length - changed.length) + ' 张一个字没改。牌表里这 ' + changed.length + ' 张带着「定稿改过」的标记，可以用筛选看。</p>' +
      '<h4>规则换了，' + by('rule').length + ' 张</h4><p class="fine">原来提到进度条、年终推条的牌。「年度风口」现在要和记分牌配着用：风口吹在哪儿，那张记分牌就值两倍。</p>' + table(by('rule')) +
      '<h4>原来点「英联邦」的，' + by('gone').length + ' 张</h4><p class="fine">英联邦拆掉了：印度在中东与南亚，新加坡在东南亚，澳大利亚在东亚与大洋洲，加拿大在美洲。这四张改成点中东与南亚和东南亚。</p>' + table(by('gone')) +
      '<details class="more"><summary>只换了说法的 ' + by('name').length + ' 张：「芯片链」改成直接点名台湾、韩国、日本、荷兰，「中东」改成「中东与南亚」，「全球南方」改成「美洲、非洲」，「预算」改成「行动点」</summary>' + table(by('name')) + '</details>' +
      '<p class="fine" style="margin-top:8px"><b>牌面上不再说「芯片链」。</b>凡是原来点它的牌，都直接写台湾、韩国、日本、荷兰这四个市场，地图上不用做标记。「聚变并网示范」（L22）顺手收了一下：原来是这四个市场加中东四个市场各 1 点，现在是这四个加中东与南亚的 3 个关键市场，一共 7 个。</p></article>';
    h += '<article data-note="R9c" data-title="没有牌点名的市场"><h3><i>R9c</i>' + unnamed.length + ' 个市场没有牌点过名</h3>' +
      '<p>' + unnamed.map(function (m) { return m.name; }).join('、') + '。</p>' +
      '<p class="fine">它们靠两样东西活着：按大区给份额的牌（比如「应用出海」「数字丝绸之路」「开源模型出海」），和行动点。定稿没有给它们单独配牌，原因见 <a href="#r10">R10a</a> 的最后一条。</p></article>';
    $('#card-impact').innerHTML = h + '</div>';
  }

  /* ───────── R9 牌库统计 ───────── */
  function renderStats() {
    var cols = [
      ['美国', function (c) { return c.side === 'US'; }],
      ['中国', function (c) { return c.side === 'CN'; }],
      ['中立', function (c) { return c.side === 'N'; }],
      ['🎲 要掷骰', function (c) { return c.flags.indexOf('dice') >= 0 || c.flags.indexOf('launch') >= 0; }],
      ['常驻', function (c) { return c.flags.indexOf('perm') >= 0; }],
      ['环境', function (c) { return c.flags.indexOf('env') >= 0; }],
      ['收紧 ▲', function (c) { return c.flags.indexOf('tight') >= 0; }],
      ['宽松 ▼', function (c) { return c.flags.indexOf('ease') >= 0; }],
      ['一次性', function (c) { return c.flags.indexOf('once') >= 0; }],
      ['定稿改过', function (c) { return !!c.rev; }]
    ];
    var h = '<table class="stats"><thead><tr><th>时代</th>' + cols.slice(0, 3).map(function (x) { return '<th>' + x[0] + '</th>'; }).join('') +
      '<th>合计</th><th>平均牌值</th>' + cols.slice(3).map(function (x) { return '<th>' + x[0] + '</th>'; }).join('') + '</tr></thead><tbody>';
    function line(label, list, cls) {
      var v = list.reduce(function (a, c) { return a + c.v; }, 0);
      var n = function (f) { return '<td>' + list.filter(f).length + '</td>'; };
      return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + label + '</td>' +
        cols.slice(0, 3).map(function (x) { return n(x[1]); }).join('') +
        '<td>' + list.length + '</td><td>' + (v / list.length).toFixed(2) + '</td>' +
        cols.slice(3).map(function (x) { return n(x[1]); }).join('') + '</tr>';
    }
    D.eras.forEach(function (e) {
      h += line(e.name + ' ' + e.years, D.cards.filter(function (c) { return c.era === e.id; }));
    });
    $('#deck-stats').innerHTML = h + line('全部', D.cards, 'sum') + '</tbody></table>';
  }

  /* ───────── R9 卡牌 ───────── */
  var F = { era: 'all', side: 'all', flag: 'all', q: '', view: 'grid' };
  var KW = /(获得|夺取|清退)/g;
  var LEAD = /^(发布[。，]|常驻：|环境：)/;
  var MID = /(。)(常驻：)/g;

  function fxHtml(t) {
    return esc(t)
      .replace(KW, '<b class="kw">$1</b>')
      .replace(LEAD, function (m) { return '<b class="lab">' + m.replace(/[。，：]/, '') + '</b>' + (m.indexOf('，') >= 0 ? '，' : ' '); })
      .replace(MID, '$1 <b class="lab">常驻</b> ');
  }
  function tagsHtml(c) {
    var s = SIDE[c.side];
    var h = '<span class="tag ' + s.c + '">' + s.n + '</span>';
    h += c.real ? '<span class="tag">' + esc(c.year) + '</span>'
      : '<span class="tag fic">' + (c.year === '推演' ? '推演' : '泛指') + '</span>';
    FLAG_ORDER.forEach(function (f) {
      if (c.flags.indexOf(f) >= 0) h += '<span class="tag ' + FLAG[f].c + '">' + FLAG[f].t + '</span>';
    });
    if (c.rev) h += '<span class="tag v06" title="' + WHY[c.rev] + '">定稿改过</span>';
    return h;
  }
  function pwr(p) { return p ? '力度 <span class="pw">' + '●●●'.slice(0, p) + '○○○'.slice(0, 3 - p) + '</span>' : ''; }

  function match(c) {
    if (F.era !== 'all' && c.era !== F.era) return false;
    if (F.side !== 'all' && c.side !== F.side) return false;
    if (F.flag === 'real') { if (!c.real) return false; }
    else if (F.flag === 'fic') { if (c.year !== '推演') return false; }
    else if (F.flag === 'rev') { if (!c.rev) return false; }
    else if (F.flag === 'dice') { if (c.flags.indexOf('dice') < 0 && c.flags.indexOf('launch') < 0) return false; }
    else if (F.flag === 'perm') { if (c.flags.indexOf('perm') < 0 && c.flags.indexOf('env') < 0) return false; }
    else if (FLAG[F.flag] && c.flags.indexOf(F.flag) < 0) return false;
    if (F.q) {
      var hay = (c.id + ' ' + c.name + ' ' + c.text + ' ' + c.note + ' ' + c.year).toLowerCase();
      if (hay.indexOf(F.q.toLowerCase()) < 0) return false;
    }
    return true;
  }

  function renderFilters() {
    function grp(k, opts) {
      return '<span class="grp">' + opts.map(function (o) {
        return '<button data-f="' + k + '" data-v="' + o[0] + '"' + (F[k] === o[0] ? ' class="on"' : '') + '>' + o[1] + '</button>';
      }).join('') + '</span>';
    }
    $('#filters').innerHTML =
      grp('era', [['all', '全部时代'], ['E', '早期'], ['M', '中期'], ['L', '后期']]) +
      grp('side', [['all', '全部归属'], ['US', '美国'], ['CN', '中国'], ['N', '中立']]) +
      grp('flag', [['all', '全部'], ['rev', '定稿改过'], ['dice', '🎲 要掷骰'], ['perm', '常驻和环境'], ['tight', '收紧 ▲'], ['ease', '宽松 ▼'], ['once', '一次性'], ['real', '真事'], ['fic', '推演']]) +
      '<input type="search" placeholder="搜牌名、效果、市场…" value="' + esc(F.q) + '" aria-label="搜索卡牌">' +
      grp('view', [['grid', '卡片'], ['table', '表格']]) +
      '<span class="count" id="count"></span>';
  }

  function renderCards() {
    var host = $('#cards');
    var list = D.cards.filter(match);
    $('#count').textContent = '显示 ' + list.length + ' / ' + D.cards.length;
    $$('#filters button').forEach(function (b) {
      b.classList.toggle('on', F[b.getAttribute('data-f')] === b.getAttribute('data-v'));
    });
    if (!list.length) { host.innerHTML = '<p class="fine" style="padding:24px 0">没有符合条件的牌。</p>'; return; }

    if (F.view === 'table') {
      host.innerHTML = '<table class="clist"><thead><tr><th>编号</th><th>牌名</th><th>值</th><th>标记</th><th>效果</th><th>那件事 / 为什么这么写</th></tr></thead><tbody>' +
        list.map(function (c) {
          return '<tr class="' + SIDE[c.side].c + '"><td class="id">' + c.id + '</td><td class="nm">' + esc(c.name) + '</td><td class="v">' + c.v + '</td>' +
            '<td class="tg">' + tagsHtml(c) + '</td><td>' + fxHtml(c.text) + '</td><td class="fine">' + esc(c.note) + '</td></tr>';
        }).join('') + '</tbody></table>';
      return;
    }

    var h = '';
    D.eras.forEach(function (e) {
      var part = list.filter(function (c) { return c.era === e.id; });
      if (!part.length) return;
      h += '<div class="era-head"><b>' + e.name + '</b><span>' + e.years + ' · ' + part.length + ' 张</span></div><div class="card-grid">';
      part.forEach(function (c) {
        h += '<article class="card ' + SIDE[c.side].c + '" data-note="' + c.id + '" data-title="' + esc(c.name) + '">' +
          '<header><span class="val" title="牌值">' + c.v + '</span><h4>' + esc(c.name) + '</h4><span class="cid">' + c.id + '</span></header>' +
          '<div class="meta">' + tagsHtml(c) + '</div>' +
          '<p class="fx">' + fxHtml(c.text) + '</p>' +
          '<p class="why">' + esc(c.note) + '</p>' +
          '<footer><span>' + pwr(c.p) + '</span></footer></article>';
      });
      h += '</div>';
    });
    host.innerHTML = h;
    Notes.attach(host);
  }

  function bindFilters() {
    var box = $('#filters');
    box.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-f]');
      if (!b) return;
      F[b.getAttribute('data-f')] = b.getAttribute('data-v');
      renderCards();
    });
    box.addEventListener('input', function (ev) {
      if (ev.target.type === 'search') { F.q = ev.target.value.trim(); renderCards(); }
    });
  }

  /* ───────── 批注：写在页面上，存在这台电脑的浏览器里，一键复制成文字 ───────── */
  var Notes = (function () {
    var KEY = 'agi-race-notes-v5', OLD = 'agi-race-notes-v4';
    var data = {};
    try {
      data = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
      var old = JSON.parse(localStorage.getItem(OLD) || '{}') || {};   // 定稿的编号又排过一次：上一稿的批注带着版本号留下
      Object.keys(old).forEach(function (k) { if (old[k]) data[(k.indexOf('v0.') === 0 ? '' : 'v0.6 的 ') + k] = old[k]; });
      if (Object.keys(old).length) { localStorage.setItem(KEY, JSON.stringify(data)); localStorage.removeItem(OLD); }
    } catch (e) { data = data || {}; }
    var titles = {};

    function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* 存不了也照常用 */ } }
    function count() { return Object.keys(data).filter(function (k) { return data[k]; }).length; }
    function bar() {
      var n = count();
      $('#notebar').innerHTML = '<span class="muted">批注 ' + n + ' 条</span>' +
        '<button data-n="copy"' + (n ? '' : ' disabled') + '>复制全部批注</button>' +
        '<button data-n="clear" class="ghost"' + (n ? '' : ' disabled') + '>清空</button>';
    }
    function text() {
      var ids = Object.keys(data).filter(function (k) { return data[k]; }).sort();
      return '【批注 · AGI 争霸规则 ' + D.version + '】\n' + ids.map(function (id) {
        return id + (titles[id] ? ' ' + titles[id] : '') + '：' + data[id].replace(/\s*\n\s*/g, ' / ');
      }).join('\n');
    }
    function toast(msg) {
      var t = el('div', 'toast', msg);
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 1800);
    }
    function dump(t) {
      var d = el('div', 'dump', '<div><p><b>复制不了，手动全选复制：</b></p><textarea readonly></textarea><p style="margin:10px 0 0;text-align:right"><button>关闭</button></p></div>');
      $('textarea', d).value = t;
      d.addEventListener('click', function (ev) { if (ev.target === d || ev.target.tagName === 'BUTTON') d.remove(); });
      document.body.appendChild(d);
      $('textarea', d).select();
    }
    function copy() {
      var t = text();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(function () { toast('已复制 ' + count() + ' 条批注，贴到对话里就行'); }, function () { dump(t); });
      } else dump(t);
    }
    function toggle(host, btn) {
      var id = host.getAttribute('data-note');
      var box = $('.note-box[data-for="' + id + '"]');
      if (box) { box.remove(); return; }
      box = el('div', 'note-box', '<textarea placeholder="' + id + ' 想怎么改？"></textarea>');
      box.setAttribute('data-for', id);
      var ta = $('textarea', box);
      ta.value = data[id] || '';
      ta.addEventListener('input', function () {
        if (ta.value.trim()) data[id] = ta.value.trim(); else delete data[id];
        save(); bar();
        btn.classList.toggle('has', !!data[id]);
        btn.textContent = data[id] ? '有批注' : '批注';
      });
      var inline = host.classList.contains('card') || host.classList.contains('barcard') || host.classList.contains('rg');
      if (inline) host.appendChild(box);
      else if (host.tagName === 'H3') host.insertAdjacentElement('afterend', box);
      else { var h = host.querySelector('h2, h3, h4'); (h || host).insertAdjacentElement(h ? 'afterend' : 'afterbegin', box); }
      ta.focus();
    }
    function attach(root) {
      $$('[data-note]', root).forEach(function (host) {
        if (host.querySelector(':scope > .note-btn, :scope > footer > .note-btn')) return;
        var id = host.getAttribute('data-note');
        titles[id] = host.getAttribute('data-title') || '';
        var btn = el('button', 'note-btn' + (data[id] ? ' has' : ''), data[id] ? '有批注' : '批注');
        btn.type = 'button';
        btn.setAttribute('aria-label', '给 ' + id + ' 写批注');
        btn.addEventListener('click', function () { toggle(host, btn); });
        var foot = host.classList.contains('card') ? host.querySelector('footer') : null;
        (foot || host).appendChild(btn);
      });
    }
    function init() {
      D.cards.forEach(function (c) { titles[c.id] = c.name; });
      bar();
      $('#notebar').addEventListener('click', function (ev) {
        var a = ev.target.getAttribute('data-n');
        if (a === 'copy') copy();
        else if (a === 'clear' && window.confirm('清空全部 ' + count() + ' 条批注？')) {
          data = {}; save(); bar();
          $$('.note-box').forEach(function (b) { b.remove(); });
          $$('.note-btn').forEach(function (b) { b.classList.remove('has'); b.textContent = '批注'; });
        }
      });
      attach(document);
    }
    return { init: init, attach: attach };
  })();

  /* ───────── 目录跟着滚动高亮 ───────── */
  function spy() {
    var links = $$('#toc a').filter(function (a) { return a.getAttribute('href').charAt(0) === '#'; });
    var secs = links.map(function (a) { return $(a.getAttribute('href')); });
    function on() {
      var y = window.scrollY + 120, cur = 0;
      secs.forEach(function (s, i) { if (s && s.offsetTop <= y) cur = i; });
      links.forEach(function (a, i) { a.classList.toggle('here', i === cur); });
    }
    window.addEventListener('scroll', on, { passive: true });
    on();
  }

  renderMap();
  renderRegionTable();
  shareDemo();
  renderVP();
  renderScoreCards();
  renderLines();
  acqCalc();
  renderFinance();
  renderTurns();
  renderTilt();
  renderImpact();
  renderStats();
  renderFilters();
  bindFilters();
  Notes.init();
  renderCards();
  spy();
})();
