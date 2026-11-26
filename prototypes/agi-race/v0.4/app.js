/* 规则草稿页的渲染：从 data.js 读内容，画回合表、地图、基建与突破、连锁、卡牌，
   外加三个小计算器（份额条、收购、检定）和批注。 */
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
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function pct(x) { return Math.round(x * 100) + '%'; }

  var SIDE = { US: { n: '美国', c: 'us' }, CN: { n: '中国', c: 'cn' }, N: { n: '中立', c: 'nu' } };
  var ERA = {};
  D.eras.forEach(function (e) { ERA[e.id] = e; });
  var FLAG = {
    dice:   { t: '🎲 掷骰', c: 'rolltag' },
    launch: { t: '发布', c: 'rolltag' },
    perm:   { t: '常驻', c: 'perm' },
    env:    { t: '环境', c: 'perm' },
    zap:    { t: '⚡ 耗电', c: 'zap' },
    bat:    { t: '🔋 供电', c: 'bat' },
    once:   { t: '一次性', c: '' }
  };
  var FLAG_ORDER = ['launch', 'dice', 'perm', 'env', 'zap', 'bat', 'once'];
  var TRACK = {};
  D.infra.forEach(function (t) { TRACK[t.id] = t; });
  var EV = {};
  D.events.forEach(function (e) { EV[e.k] = e; });

  /* 牌、突破、大势放进同一张表，连锁那一节要一起查 */
  var PIECES = [];
  D.cards.forEach(function (c) {
    PIECES.push({ id: c.id, name: c.name, text: c.text, kind: 'card', side: c.side, out: c.out, on: c.on, opp: c.opp });
  });
  D.boons.forEach(function (b) {
    PIECES.push({ id: b.id, name: b.name, text: b.text, kind: 'boon', side: 'B', track: b.track, out: b.out, on: b.on, opp: b.opp });
  });
  D.trends.forEach(function (t) {
    PIECES.push({ id: t.id, name: t.name, text: t.text, kind: 'trend', side: 'N', out: t.out, on: t.on, opp: [] });
  });
  var BY_ID = {};
  PIECES.forEach(function (p) { BY_ID[p.id] = p; });

  $('#ver').textContent = D.version + ' · ' + D.date;
  $('#fact-cards').textContent = D.cards.length;
  $('#fact-boons').textContent = D.boons.length;
  $('#fact-trends').textContent = D.trends.length;
  $('#card-total').textContent = D.cards.length;
  $('#trend-total').textContent = D.trends.length;
  $('#dice-cards-n').textContent = D.cards.filter(function (c) {
    return c.flags.indexOf('dice') >= 0 || c.flags.indexOf('launch') >= 0;
  }).length + ' 张牌';

  /* ───────── 份额：两个数，画成两串点 ───────── */
  function sharePips(us, cn, big) {
    function run(n, k) { var h = ''; for (var i = 0; i < n; i++) h += '<i class="c ' + k + '"></i>'; return h; }
    return '<span class="sh' + (big ? ' big' : '') + '"><span class="cells l">' + run(us, 'us') + '</span>' +
      '<span class="vs">' + us + ' : ' + cn + '</span><span class="cells">' + run(cn, 'cn') + '</span></span>';
  }
  function holder(m) { return m.us - m.cn >= m.w ? 'us' : (m.cn - m.us >= m.w ? 'cn' : ''); }

  /* ───────── 骰子的数学：爆、砸、重掷 ─────────
     o.five 5 也爆 · o.one3 1 不算砸按 3 算 · 返回一次检定「凑够 n 点」的机会 */
  function boom(f, o) { return f === 6 || (o.five && f === 5); }
  function tail(n, o, depth) {            // 爆出来的那颗接着掷，不会砸
    if (n <= 1) return 1;
    if (depth > 6) return 0;
    var p = 0;
    for (var f = 1; f <= 6; f++) {
      if (boom(f, o)) p += tail(n - f, o, depth + 1) / 6;
      else if (f >= n) p += 1 / 6;
    }
    return p;
  }
  function first(n, o) {                  // 第一颗：1 是砸
    var p = 0;
    for (var f = 1; f <= 6; f++) {
      if (f === 1) { if (o.one3 && 3 >= n) p += 1 / 6; continue; }
      if (boom(f, o)) p += tail(n - f, o, 1) / 6;
      else if (f >= n) p += 1 / 6;
    }
    return p;
  }
  function odds(n, o) {
    var p = first(n, o);
    if (o.two === 'hi') p = 1 - (1 - p) * (1 - p);
    if (o.two === 'lo') p = p * p;
    if (o.reroll) p = p + (1 - p) * p;
    return p;
  }

  /* ───────── R3 回合表 ───────── */
  function renderTurns() {
    var T = D.turns;
    function row(label, fn, cls) {
      return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><th class="row">' + label + '</th>' +
        T.map(function (t, i) {
          var edge = (i === 3 || i === 6) ? 'edge' : '';
          var r = fn(t, i);
          if (typeof r === 'string') r = { h: r };
          return '<td class="' + [edge, r.c || ''].join(' ').trim() + '">' + r.h + '</td>';
        }).join('') + '</tr>';
    }
    function span3(label, fn, cls) {
      return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><th class="row">' + label + '</th>' +
        D.eras.map(function (e, i) {
          var r = fn(e, i);
          if (typeof r === 'string') r = { h: r };
          return '<td colspan="3" class="' + [(i ? 'edge' : ''), r.c || ''].join(' ').trim() + '">' + r.h + '</td>';
        }).join('') + '</tr>';
    }
    var by = function (m) { return function (e) { return m[e.id]; }; };
    $('#turn-grid').innerHTML = '<table class="turns">' +
      row('年份', function (t) { return String(t.y); }, 'yr') +
      span3('时代', function (e) { return e.name + '<span>' + e.theme + '</span>'; }, 'era') +
      span3('主场', by({ E: '东亚 · 欧洲', M: '+ 海湾 · 印太', L: '+ 拉美 · 非洲，然后是全局' })) +
      span3('开放的市场', by({ E: '9 个', M: '20 个', L: '29 个' })) +
      span3('你这一局的打法', by({ E: '挑：开局突破，头两次升级', M: '成型：常驻上场，GPU 转起来', L: '兑现：翻倍、连掷、赌 AGI' })) +
      row('手牌 / 行动轮', function (t) { return t.hand + ' / ' + t.ar; }) +
      span3('牌堆里的记分牌', by({ E: '东亚、欧洲', M: '+ 海湾、印太', L: '+ 拉美、非洲；2030 年终六区全算' })) +
      span3('资本压力', by({ E: '3', M: '4', L: '5' })) +
      span3('电力', by({ E: '宽裕', M: '开始抢', L: '贴着红线' })) +
      span3('先手', by({ E: '美国', M: '落后的一方', L: '中国' })) +
      span3('倾向', function (e) {
        return { h: e.lean, c: e.id === 'E' ? 'lean-us' : (e.id === 'L' ? 'lean-cn' : '') };
      }) +
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

  /* ───────── R5a 垄断演示 ───────── */
  function shareDemo() {
    var host = $('#share-demo');
    var st = { w: 3, us: 1, cn: 1, spentUS: 0, spentCN: 0, log: '点下面的按钮试试。' };
    function act(me, op) {
      var cost = holder(st) === op ? 2 : 1;
      st[me]++;
      st[me === 'us' ? 'spentUS' : 'spentCN'] += cost;
      st.log = (me === 'us' ? '美国' : '中国') + ' +1 点份额，花 ' + cost + ' 预算。';
      draw();
    }
    function reset(msg) { st.us = 1; st.cn = 1; st.spentUS = st.spentCN = 0; st.log = msg; draw(); }
    function draw() {
      var h = holder(st), diff = Math.abs(st.us - st.cn);
      var status = h === 'us' ? '<span class="us-t">美国垄断</span>' : (h === 'cn' ? '<span class="cn-t">中国垄断</span>' : '没有人垄断');
      host.innerHTML =
        '<h5>试一试 · 垄断</h5>' +
        '<div class="row"><label>重量级 <select data-k="w">' + [1, 2, 3, 4].map(function (n) {
          return '<option' + (n === st.w ? ' selected' : '') + '>' + n + '</option>';
        }).join('') + '</select></label><span class="muted">要比对手多出 ' + st.w + ' 点才算垄断</span></div>' +
        '<div class="row">' + sharePips(st.us, st.cn, true) + '</div>' +
        '<div class="row"><span class="status">' + status + '</span><span class="muted">现在差 ' + diff + ' 点</span></div>' +
        '<div class="row">' +
        '<button data-a="us">美国拓展 1 点（' + (h === 'cn' ? 2 : 1) + ' 预算）</button>' +
        '<button data-a="cn">中国拓展 1 点（' + (h === 'us' ? 2 : 1) + ' 预算）</button>' +
        '<button data-a="reset" class="ghost">重来</button></div>' +
        '<div class="log">' + st.log + ' 累计：美 ' + st.spentUS + '，中 ' + st.spentCN + '。</div>';
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

  /* ───────── R5b 收购计算器 ───────── */
  function sel(st, k, list, fmt) {
    return '<select data-k="' + k + '">' + list.map(function (n) {
      return '<option value="' + n + '"' + (n === st[k] ? ' selected' : '') + '>' + (fmt ? fmt(n) : n) + '</option>';
    }).join('') + '</select>';
  }
  function acqCalc() {
    var host = $('#acq-calc');
    var st = { w: 2, v: 3, mod: 0, opp: 2 };
    function split(sx) {
      var out = Math.min(sx, st.opp), mine = sx - out;
      return '清 ' + out + (mine ? '，自己 +' + mine : '');
    }
    function draw() {
      var thr = st.w * 2, base = st.v + st.mod - thr, mean = 0, hit = 0;
      var tds = [1, 2, 3, 4, 5, 6].map(function (r) {
        if (r === 1) return '<td class="zero">砸</td>';
        var sx = Math.max(0, r + base);
        if (r === 6) {
          var extra = 0;
          for (var f = 1; f <= 6; f++) extra += Math.max(0, 6 + f + base) / 6;   // 只算到第二颗
          mean += extra / 6; if (6 + 1 + base > 0) hit++;
          return '<td class="hit">' + Math.max(0, 7 + base) + ' 点起，爆</td>';
        }
        mean += sx / 6; if (sx > 0) hit++;
        return '<td class="' + (sx > 0 ? 'hit' : 'zero') + '">' + (sx > 0 ? split(sx) : '—') + '</td>';
      }).join('');
      host.innerHTML =
        '<h5>算一算 · 收购</h5>' +
        '<div class="row">' +
        '<label>重量级 ' + sel(st, 'w', [1, 2, 3, 4]) + '</label>' +
        '<label>牌值 ' + sel(st, 'v', [1, 2, 3, 4, 5]) + '</label>' +
        '<label>修正 ' + sel(st, 'mod', [-2, -1, 0, 1, 2], function (n) { return (n > 0 ? '+' : '') + n; }) + '</label>' +
        '<label>对手有 ' + sel(st, 'opp', [1, 2, 3, 4, 5, 6]) + ' 点</label></div>' +
        '<table class="dice"><tr><th>骰子</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th></tr>' +
        '<tr><th>结果</th>' + tds + '</tr></table>' +
        '<div class="log">门槛 ' + thr + '（重量级 × 2）。有收获的机会 ' + pct(hit / 6) + '，平均成功 ' + mean.toFixed(1) +
        ' 点。有 1 个 GPU 的话，可以把不满意的那一颗重掷一次。</div>';
    }
    host.addEventListener('change', function (ev) {
      var k = ev.target.getAttribute('data-k');
      if (k) { st[k] = +ev.target.value; draw(); }
    });
    draw();
  }

  /* ───────── R5c 基建成功率表，R8b AGI 工程 ───────── */
  function shade(p) { return ' style="background:rgba(27,27,26,' + (p * 0.16).toFixed(3) + ')"'; }
  function renderInfraOdds() {
    var levels = [['1 级', 5], ['2 级', 7], ['3 级', 9]];
    var h = '<table class="grid oddst"><thead><tr><th>投的牌</th>' + levels.map(function (l) {
      return '<th>' + l[0] + '<small>门槛 ' + l[1] + '</small></th>';
    }).join('') + '</tr></thead><tbody>';
    [1, 2, 3, 4].forEach(function (v) {
      h += '<tr><td>' + v + ' 值</td>' + levels.map(function (l) {
        var p = odds(l[1] - v, {});
        return '<td' + shade(p) + '>' + pct(p) + '</td>';
      }).join('') + '</tr>';
    });
    h += '<tr class="sep"><td>4 值，底子和加注共 +2，带重掷</td>' + levels.map(function (l) {
      return '<td>' + pct(odds(l[1] - 6, { reroll: true })) + '</td>';
    }).join('') + '</tr>';
    $('#infra-odds').innerHTML = h + '</tbody></table><p class="fine" style="margin-top:6px">一次基建掷骰升级的机会。什么都不带的时候是上面四行；最后一行是准备充分的样子。</p>';

    var sums = [10, 11, 12, 13, 14, 15, 16];
    var a = '<table class="grid oddst"><thead><tr><th>骰子之外已经凑到</th>' + sums.map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr></thead><tbody>' +
      '<tr><td>掷一次</td>' + sums.map(function (x) { var p = odds(18 - x, {}); return '<td' + shade(p) + '>' + pct(p) + '</td>'; }).join('') + '</tr>' +
      '<tr><td>留 1 个 GPU 重掷</td>' + sums.map(function (x) { var p = odds(18 - x, { reroll: true }); return '<td' + shade(p) + '>' + pct(p) + '</td>'; }).join('') + '</tr>' +
      '</tbody></table><p class="fine" style="margin-top:6px">例：三条线一共 6 级，投一张 4 值牌，就是 10。再交 3 个 GPU、弃 2 张手牌，就是 15。</p>';
    $('#agi-odds').innerHTML = a;
  }

  /* ───────── R6 检定计算器 ───────── */
  function checkCalc() {
    var host = $('#check-calc');
    var st = { thr: 7, v: 3, mod: 0, reroll: 0, five: 0, one3: 0, two: '' };
    function chk(k, label) {
      return '<label><input type="checkbox" data-c="' + k + '"' + (st[k] ? ' checked' : '') + '> ' + label + '</label>';
    }
    function draw() {
      var n = st.thr - st.v - st.mod;
      var o = { five: !!st.five, one3: !!st.one3, two: st.two, reroll: !!st.reroll };
      var p = odds(n, o), plain = odds(n, {});
      var faces = [1, 2, 3, 4, 5, 6].map(function (f) {
        var cls, txt;
        if (f === 1 && !o.one3) { cls = 'zero'; txt = '砸'; }
        else if (boom(f, o)) { cls = 'hit'; txt = (f >= n ? '过' : '爆 ' + pct(tail(n - f, o, 1))); }
        else { var val = (f === 1 ? 3 : f); cls = val >= n ? 'hit' : 'zero'; txt = val >= n ? '过' : '不过'; }
        return '<td class="' + cls + '">' + txt + '</td>';
      }).join('');
      host.innerHTML =
        '<h5>算一算 · 任何一次检定</h5>' +
        '<div class="row">' +
        '<label>门槛 ' + sel(st, 'thr', [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]) + '</label>' +
        '<label>牌值 ' + sel(st, 'v', [1, 2, 3, 4, 5]) + '</label>' +
        '<label>底子、加注、修正 ' + sel(st, 'mod', [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], function (x) { return (x > 0 ? '+' : '') + x; }) + '</label></div>' +
        '<div class="row checks">' + chk('reroll', '有 1 个 GPU') + chk('one3', '1 不算砸（数1）') + chk('five', '5 也爆（数2、狂热）') + '</div>' +
        '<div class="row checks"><label>掷两颗 <select data-k2="two">' +
        [['', '不'], ['hi', '取高的'], ['lo', '取低的']].map(function (x) {
          return '<option value="' + x[0] + '"' + (st.two === x[0] ? ' selected' : '') + '>' + x[1] + '</option>';
        }).join('') + '</select></label></div>' +
        '<div class="bigp"><b>' + pct(p) + '</b><span>成功的机会' + (Math.abs(p - plain) > 0.004 ? '，什么都不带的时候是 ' + pct(plain) : '') + '</span></div>' +
        '<table class="dice"><tr><th>第一颗</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th></tr><tr><th>结果</th>' + faces + '</tr></table>' +
        '<div class="log">骰子要掷出 ' + (n <= 1 ? '什么都行，只要不砸' : n + ' 以上') + '。基建的门槛是 5 / 7 / 9；AGI 工程是 18，三条线的等级之和算进修正里；收购「至少清掉 1 点」的门槛是重量级 × 2 + 1。</div>';
    }
    host.addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.getAttribute('data-k')) st[t.getAttribute('data-k')] = +t.value;
      else if (t.getAttribute('data-k2')) st.two = t.value;
      else if (t.getAttribute('data-c')) st[t.getAttribute('data-c')] = t.checked ? 1 : 0;
      draw();
    });
    draw();
  }

  /* ───────── R7c 电力阶梯 ───────── */
  function renderPower() {
    var lv = [
      { n: 5, t: '宽裕' }, { n: 4, t: '正常' }, { n: 3, t: '偏紧' },
      { n: 2, t: '紧张' }, { n: 1, t: '限电', c: 'warn' }, { n: 0, t: '大停电', c: 'dead' }
    ];
    $('#power-ladder').innerHTML = lv.map(function (l) {
      return '<div class="' + (l.c || '') + '"><b>' + l.n + '</b>' + l.t + '</div>';
    }).join('');
  }

  /* ───────── R8 基建与突破 ───────── */
  function renderInfra() {
    var h = '<div class="tracks">';
    D.infra.forEach(function (t) {
      var list = D.boons.filter(function (b) { return b.track === t.id; });
      h += '<article class="track t-' + t.id + '"><header><h4>' + t.name + '<span>' + t.what + '</span></h4>' +
        '<p class="tames"><b>' + t.theme + '</b>：' + t.tames + '</p></header>' +
        '<dl class="tk">' +
        '<dt>每级固定给</dt><dd>' + t.each + '</dd>' +
        '<dt>掷它之前可以加注</dt><dd>' + t.feed + '</dd>' +
        (t.start ? '<dt>开局</dt><dd><em>' + t.start + '</em></dd>' : '') +
        '</dl>' +
        '<div class="boons"><h5>突破 ' + list.length + ' 张，升级时翻 3 留 1</h5>' +
        list.map(function (b) {
          return '<div class="boon" data-note="' + b.id + '" data-title="' + esc(b.name) + '"><span class="bid">' + b.id + '</span>' +
            '<b>' + esc(b.name) + '</b><span class="bt">' + esc(b.text) + '</span></div>';
        }).join('') + '</div></article>';
    });
    $('#infra').innerHTML = h + '</div>';
  }

  /* ───────── R9 连锁 ───────── */
  function chip(p, small) {
    var cls = p.kind === 'boon' ? 'boon-c' : (p.kind === 'trend' ? 'trend-c' : SIDE[p.side].c);
    var who = p.kind === 'boon' ? TRACK[p.track].name + '突破' : (p.kind === 'trend' ? '大势' : SIDE[p.side].n);
    return '<div class="pc ' + cls + '"><div class="pc-h"><span class="pid">' + p.id + '</span><b>' + esc(p.name) + '</b><i>' + who + '</i></div>' +
      (small ? '' : '<p>' + esc(p.text) + '</p>') + '</div>';
  }
  function makes(p, k) {
    if (p.out.indexOf(k) >= 0) return true;
    return (k === 'six' || k === 'fail') && p.out.indexOf('roll') >= 0;
  }
  function renderChain() {
    var cur = 'zap';
    var list = $('#ev-list'), panel = $('#ev-panel');
    function count(k) {
      var o = PIECES.filter(function (p) { return p.out.indexOf(k) >= 0; }).length;
      var l = PIECES.filter(function (p) { return p.on.indexOf(k) >= 0 || p.opp.indexOf(k) >= 0; }).length;
      return [o, l];
    }
    function draw() {
      list.innerHTML = D.events.map(function (e) {
        var n = count(e.k);
        return '<button data-ev="' + e.k + '"' + (e.k === cur ? ' class="on"' : '') + '>' + e.n +
          '<small>' + n[0] + ' → ' + n[1] + '</small></button>';
      }).join('');
      var e = EV[cur];
      var outs = PIECES.filter(function (p) { return p.out.indexOf(cur) >= 0; });
      var ons = PIECES.filter(function (p) { return p.on.indexOf(cur) >= 0; });
      var opps = PIECES.filter(function (p) { return p.opp.indexOf(cur) >= 0; });
      var derived = (cur === 'six' || cur === 'fail') ? '所有要掷骰的牌和行动' : '';
      panel.innerHTML =
        '<div class="ev-col"><h5>谁会让「' + e.n + '」发生 · ' + outs.length + '</h5>' +
        ((e.gen || derived) ? '<p class="gen">不用牌也会发生：' + [e.gen, derived].filter(Boolean).join('；') + '</p>' : '') +
        (outs.map(function (p) { return chip(p); }).join('') || '<p class="fine">只靠上面那些。</p>') + '</div>' +
        '<div class="ev-col wait"><h5>谁在等「' + e.n + '」 · ' + (ons.length + opps.length) + '</h5>' +
        (ons.map(function (p) { return chip(p); }).join('')) +
        (opps.length ? '<p class="gen">等对面这么做的：</p>' + opps.map(function (p) { return chip(p); }).join('') : '') +
        (ons.length + opps.length ? '' : '<p class="fine">暂时没有。这是一个可以再加牌的空位。</p>') + '</div>';
    }
    list.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-ev]');
      if (b) { cur = b.getAttribute('data-ev'); draw(); }
    });
    draw();
  }

  function chainRand() {
    var host = $('#chain-rand');
    function roll() {
      for (var tries = 0; tries < 200; tries++) {
        var side = pick(['US', 'CN']);
        var pool = PIECES.filter(function (p) {
          return p.kind === 'boon' || (p.kind === 'card' && (p.side === side || p.side === 'N'));
        });
        var L = pick(pool.filter(function (p) { return p.on.length; }));
        var e1 = pick(L.on);
        var Ps = pool.filter(function (p) { return p !== L && makes(p, e1); });
        if (!Ps.length) continue;
        var P = pick(Ps);
        var Qs = pool.filter(function (p) {
          return p !== L && p !== P && p.on.some(function (k) { return L.out.indexOf(k) >= 0; });
        });
        var Q = Qs.length ? pick(Qs) : null;
        var e2 = Q ? pick(Q.on.filter(function (k) { return L.out.indexOf(k) >= 0; })) : null;
        return { side: side, P: P, L: L, Q: Q, e1: e1, e2: e2 };
      }
      return null;
    }
    function draw() {
      var r = roll();
      if (!r) return;
      var arrow = function (k) { return '<div class="arr"><span>' + EV[k].n + '</span>→</div>'; };
      host.innerHTML = '<h5>给' + SIDE[r.side].n + '的一组</h5><div class="chain-row">' +
        chip(r.P) + arrow(r.e1) + chip(r.L) + (r.Q ? arrow(r.e2) + chip(r.Q) : '') + '</div>' +
        '<div class="row" style="margin-top:10px"><button data-a="again">再抽一组</button>' +
        '<span class="muted">' + (r.Q ? '三张连上了。' : '这次只连上两张。') + '</span></div>';
    }
    host.addEventListener('click', function (ev) {
      if (ev.target.getAttribute('data-a') === 'again') draw();
    });
    draw();
  }

  function renderStories() {
    $('#stories').innerHTML = '<div class="stories">' + D.stories.map(function (s, i) {
      return '<article class="story" data-note="C' + (i + 1) + '" data-title="' + esc(s.name) + '">' +
        '<h4><i>C' + (i + 1) + '</i>' + esc(s.name) + '<span>' + s.side + '</span></h4>' +
        '<div class="story-ids">' + s.ids.map(function (id) { return chip(BY_ID[id], true); }).join('') + '</div>' +
        '<p>' + esc(s.how) + '</p><p class="so">' + esc(s.so) + '</p></article>';
    }).join('') + '</div>';
  }

  /* ───────── R10 地图 ───────── */
  function renderMap() {
    var h = '<div class="map">';
    D.eras.forEach(function (e) {
      var n = 0;
      var inner = D.regions.filter(function (r) { return r.era === e.id; }).map(function (r) {
        var ms = D.markets.filter(function (m) { return m.r === r.id; });
        n += ms.length;
        return '<div class="region"><h5>' + r.name + '<span>' + r.sub + ' · ' + ms.length + ' 个市场</span></h5>' +
          ms.map(function (m) {
            var k = holder(m);
            var mono = k === 'us' ? '<span class="mono-badge us-b">美</span>' : (k === 'cn' ? '<span class="mono-badge cn-b">中</span>' : '');
            return '<div class="mk"><span class="nm">' + (m.key ? '<b>★ ' + m.name + '</b>' : m.name) + '</span>' +
              '<span class="tg">' + m.tag + '</span>' +
              '<span class="sh2"><i class="c us' + (m.us ? '' : ' off') + '"></i><b' + (m.us ? '' : ' class="off"') + '>' + m.us + '</b>' +
              '<em>:</em><b' + (m.cn ? '' : ' class="off"') + '>' + m.cn + '</b><i class="c cn' + (m.cn ? '' : ' off') + '"></i></span>' +
              '<span class="mb">' + mono + '</span>' +
              '<span class="wt" title="重量级">' + m.w + '</span></div>';
          }).join('') + '</div>';
      }).join('');
      h += '<div class="col"><h4>' + e.name + '开放 <span>' + e.years + ' · ' + n + ' 个市场</span></h4>' + inner + '</div>';
    });
    $('#map').innerHTML = h + '</div>';
  }

  /* ───────── R11 记分牌与分值 ───────── */
  function renderScoring() {
    $('#scoring-cards').innerHTML = '<div class="scards">' + D.scoring.map(function (x) {
      return '<div class="scard"><b>' + x.name + '</b><span>' + ERA[x.era].name + '进牌堆</span></div>';
    }).join('') + '</div>';

    var s = '<table class="grid"><thead><tr><th>大区</th><th>记分牌进牌堆</th><th>存在</th><th>支配</th><th>控制</th><th>关键市场</th></tr></thead><tbody>';
    D.regions.forEach(function (r) {
      var k = D.markets.filter(function (m) { return m.r === r.id && m.key; }).length;
      s += '<tr><td><b>' + r.name + '</b></td><td>' + ERA[r.era].name + '</td><td>' + r.score[0] + '</td><td>' + r.score[1] + '</td><td>' + r.score[2] + '</td><td>' + k + ' 个</td></tr>';
    });
    $('#score-table').innerHTML = s + '</tbody></table><p class="fine" style="margin-top:6px">分值 <span class="tbd">待调</span></p>';
  }

  /* ───────── R12 牌库统计、大势 ───────── */
  function renderStats() {
    var cols = [
      ['美国', function (c) { return c.side === 'US'; }],
      ['中国', function (c) { return c.side === 'CN'; }],
      ['中立', function (c) { return c.side === 'N'; }],
      ['🎲 要掷骰', function (c) { return c.flags.indexOf('dice') >= 0 || c.flags.indexOf('launch') >= 0; }],
      ['常驻', function (c) { return c.flags.indexOf('perm') >= 0; }],
      ['环境', function (c) { return c.flags.indexOf('env') >= 0; }],
      ['⚡ 耗电', function (c) { return c.flags.indexOf('zap') >= 0; }],
      ['🔋 供电', function (c) { return c.flags.indexOf('bat') >= 0; }],
      ['一次性', function (c) { return c.flags.indexOf('once') >= 0; }],
      ['推演', function (c) { return c.year === '推演'; }]
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
    $('#deck-stats').innerHTML = h + line('全部', D.cards, 'sum') + '</tbody></table>' +
      '<p class="fine">另有 ' + D.scoring.length + ' 张记分牌，不在这张表里：早期、中期、后期各 2 张，见 R11。</p>';
  }

  function renderTrends() {
    $('#trends').innerHTML = '<div class="trend-grid">' + D.trends.map(function (t) {
      return '<div class="trend" data-note="' + t.id + '" data-title="' + esc(t.name) + '"><span class="bid">' + t.id + '</span>' +
        '<b>' + esc(t.name) + '</b><span class="bt">' + esc(t.text) + '</span></div>';
    }).join('') + '</div>';
  }

  /* ───────── R12c 卡牌 ───────── */
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
    return h;
  }
  function pips(p) { return p ? '力度 <span class="pw">' + '●●●'.slice(0, p) + '○○○'.slice(0, 3 - p) + '</span>' : ''; }

  function match(c) {
    if (F.era !== 'all' && c.era !== F.era) return false;
    if (F.side !== 'all' && c.side !== F.side) return false;
    if (F.flag === 'real') { if (!c.real) return false; }
    else if (F.flag === 'fic') { if (c.year !== '推演') return false; }
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
      grp('flag', [['all', '全部'], ['dice', '🎲 要掷骰'], ['perm', '常驻和环境'], ['zap', '⚡ 耗电'], ['bat', '🔋 供电'], ['once', '一次性'], ['real', '真事'], ['fic', '推演']]) +
      '<input type="search" placeholder="搜牌名、效果…" value="' + esc(F.q) + '" aria-label="搜索卡牌">' +
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
      h += '<div class="era-head"><b>' + e.name + '</b><span>' + e.years + ' · ' + e.theme + ' · ' + part.length + ' 张</span></div><div class="card-grid">';
      part.forEach(function (c) {
        h += '<article class="card ' + SIDE[c.side].c + '" data-note="' + c.id + '" data-title="' + esc(c.name) + '">' +
          '<header><span class="val" title="牌值">' + c.v + '</span><h4>' + esc(c.name) + '</h4><span class="cid">' + c.id + '</span></header>' +
          '<div class="meta">' + tagsHtml(c) + '</div>' +
          '<p class="fx">' + fxHtml(c.text) + '</p>' +
          '<p class="why">' + esc(c.note) + '</p>' +
          '<footer><span>' + pips(c.p) + '</span></footer></article>';
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
    var KEY = 'agi-race-notes-v2', OLD = 'agi-race-notes-v1';
    var data = {};
    try {
      data = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
      var old = JSON.parse(localStorage.getItem(OLD) || '{}') || {};   // 上一版的编号变了，旧批注带着版本号留下来
      Object.keys(old).forEach(function (k) { if (old[k]) data['v0.1 的 ' + k] = old[k]; });
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
      var inline = host.classList.contains('card') || host.classList.contains('boon') || host.classList.contains('trend');
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
      PIECES.forEach(function (p) { titles[p.id] = p.name; });
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
    var links = $$('#toc a');
    var secs = links.map(function (a) { return $(a.getAttribute('href')); });
    function on() {
      var y = window.scrollY + 120, cur = 0;
      secs.forEach(function (s, i) { if (s && s.offsetTop <= y) cur = i; });
      links.forEach(function (a, i) { a.classList.toggle('here', i === cur); });
    }
    window.addEventListener('scroll', on, { passive: true });
    on();
  }

  renderTurns();
  renderTilt();
  shareDemo();
  acqCalc();
  renderInfraOdds();
  checkCalc();
  renderPower();
  renderInfra();
  renderChain();
  chainRand();
  renderStories();
  renderMap();
  renderScoring();
  renderStats();
  renderTrends();
  renderFilters();
  bindFilters();
  Notes.init();
  renderCards();
  spy();
})();
