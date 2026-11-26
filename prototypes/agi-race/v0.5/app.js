/* 规则草稿页的渲染（v0.5）：从 data.js 读内容，画进度条、地图、年终记分的对比模拟器、卡牌，
   外加垄断演示、收购计算器和批注。 */
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

  var SIDE = { US: { n: '美国', c: 'us' }, CN: { n: '中国', c: 'cn' }, N: { n: '中立', c: 'nu' } };
  var ERA = {}, ERA_ORDER = { E: 0, M: 1, L: 2 };
  D.eras.forEach(function (e) { ERA[e.id] = e; });
  var BAR = {};
  D.bars.forEach(function (b) { BAR[b.id] = b; });
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

  $('#ver').textContent = D.version + ' · ' + D.date;
  $('#fact-cards').textContent = D.cards.length;
  $('#card-total').textContent = D.cards.length;
  $$('.barlen').forEach(function (e) { e.textContent = D.BAR_LEN; });

  /* ───────── 份额：两个数，画成两串点 ───────── */
  function sharePips(us, cn, big) {
    function run(n, k) { var h = ''; for (var i = 0; i < n; i++) h += '<i class="c ' + k + '"></i>'; return h; }
    return '<span class="sh' + (big ? ' big' : '') + '"><span class="cells l">' + run(us, 'us') + '</span>' +
      '<span class="vs">' + us + ' : ' + cn + '</span><span class="cells">' + run(cn, 'cn') + '</span></span>';
  }
  function holder(m) { return m.us - m.cn >= m.w ? 'us' : (m.cn - m.us >= m.w ? 'cn' : ''); }

  /* ───────── 骰子的数学：6 会爆 ───────── */
  function tail(n, depth) {
    if (n <= 1) return 1;
    if (depth > 6) return 0;
    var p = 0;
    for (var f = 1; f <= 6; f++) p += (f === 6 ? tail(n - 6, depth + 1) : (f >= n ? 1 : 0)) / 6;
    return p;
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
    $('#turn-grid').innerHTML = '<table class="turns">' +
      row('年份', function (t) { return String(t.y); }, 'yr') +
      span3('时代', function (e) { return e.name + '<span>' + e.theme + '</span>'; }, 'era') +
      '<tr><th class="row">地图</th><td colspan="9">24 个市场、6 个大区，从 2022 年起全部开放，每年年终都推条</td></tr>' +
      span3('这副牌主要打哪儿', { E: '芯片链 · 欧洲 · 东南亚', M: '+ 中东 · 英联邦', L: '+ 全球南方，然后是全局' }) +
      row('手牌 / 行动轮', function (t) { return t.hand + ' / ' + t.ar; }) +
      '<tr><th class="row">资本压力</th><td colspan="9">每年收购的总额要达到年终时的融资难度；差得多的一方被对手按差额推回进度条</td></tr>' +
      span3('融资难度', { E: '宽松，哪儿都能买', M: '收紧，核心大区常被锁', L: '很紧，只剩外围能买' }) +
      span3('先手', { E: '美国', M: '进度落后的一方', L: '中国' }) +
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

  /* ───────── R3 进度条与增益 ───────── */
  function barCells(n, fill, cls) {
    var h = '<span class="pbar">';
    for (var i = 1; i <= n; i++) {
      var mark = (i === 3 || i === 6 || i === 9) ? ' mark' : (i === n ? ' goal' : '');
      h += '<i class="' + (i <= fill ? 'on ' + cls : '') + mark + '">' + ((i === 3 || i === 6 || i === 9) ? i : (i === n ? '满' : '')) + '</i>';
    }
    return h + '</span>';
  }
  function renderBars() {
    $('#bars').innerHTML = '<div class="bars3">' + D.bars.map(function (b) {
      return '<article class="barcard" data-note="条-' + b.name + '" data-title="' + b.name + '进度条">' +
        '<header><h4>' + b.name + '<span>' + b.what + '</span></h4><p>从 <b>' + b.where + '</b> 来</p></header>' +
        '<div class="barwrap">' + barCells(D.BAR_LEN, 0, '') + '</div>' +
        '<ol class="buffs">' + b.buffs.map(function (f) {
          return '<li><span class="at">' + f.at + ' 格</span><b>' + f.name + '</b>' + f.text + '</li>';
        }).join('') + '</ol></article>';
    }).join('') + '</div>';
  }

  /* ───────── R4 垄断演示 ───────── */
  function shareDemo() {
    var host = $('#share-demo');
    var st = { w: 3, us: 1, cn: 1, spentUS: 0, spentCN: 0, log: '点下面的按钮试试。' };
    function act(me, op) {
      var cost = holder(st) === op ? 2 : 1;
      st[me]++;
      st[me === 'us' ? 'spentUS' : 'spentCN'] += cost;
      st.log = (me === 'us' ? '美国' : '中国') + ' +1 点份额，花 ' + cost + ' 点。';
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

  /* ───────── R5 收购计算器 ───────── */
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
      var thr = st.w * 2, base = st.v + st.mod - thr, mean = 0;
      var tds = [1, 2, 3, 4, 5, 6].map(function (r) {
        var sx = Math.max(0, r + base);
        if (r === 6) {
          var extra = 0;
          for (var f = 1; f <= 6; f++) extra += Math.max(0, 6 + f + base) / 6;   // 只算到第二颗
          mean += extra / 6;
          return '<td class="hit">' + Math.max(0, 7 + base) + ' 点起，爆</td>';
        }
        mean += sx / 6;
        return '<td class="' + (sx > 0 ? 'hit' : 'zero') + '">' + (sx > 0 ? split(sx) : '—') + '</td>';
      }).join('');
      var win = tail(1 - base, 0);
      host.innerHTML =
        '<h5>算一算 · 收购</h5>' +
        '<div class="row">' +
        '<label>重量级 ' + sel(st, 'w', [1, 2, 3, 4]) + '</label>' +
        '<label>牌值 ' + sel(st, 'v', [1, 2, 3, 4, 5]) + '</label>' +
        '<label>修正 ' + sel(st, 'mod', [-2, -1, 0, 1, 2], function (n) { return (n > 0 ? '+' : '') + n; }) + '</label>' +
        '<label>对手有 ' + sel(st, 'opp', [1, 2, 3, 4, 5, 6]) + ' 点</label></div>' +
        '<table class="dice"><tr><th>骰子</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th></tr>' +
        '<tr><th>结果</th>' + tds + '</tr></table>' +
        '<div class="log">门槛 ' + thr + '（重量级 × 2）。有收获的机会 ' + pct(win) + '，平均成功 ' + mean.toFixed(1) + ' 点。</div>';
    }
    host.addEventListener('change', function (ev) {
      var k = ev.target.getAttribute('data-k');
      if (k) { st[k] = +ev.target.value; draw(); }
    });
    draw();
  }

  /* ───────── R4 地图 ───────── */
  function renderMap() {
    var h = '<div class="map map-bars">';
    D.bars.forEach(function (b) {
      var inner = D.regions.filter(function (r) { return r.bar === b.id; }).map(function (r) {
        var ms = D.markets.filter(function (m) { return m.r === r.id; });
        return '<div class="region"><h5>' + r.name + '<span>' + r.sub + ' · ' + ERA[r.era].name + '的牌指向这里</span></h5>' +
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
      h += '<div class="col"><h4>喂' + b.name + '条 <span>' + b.what + '</span></h4>' + inner + '</div>';
    });
    $('#map').innerHTML = h + '</div>';
  }

  /* ───────── R6 年终记分：四种算法 ───────── */
  function regionStat(rid, hold, skipPlainOf) {
    var st = { us: { n: 0, k: 0 }, cn: { n: 0, k: 0 }, keys: 0 };
    D.markets.forEach(function (m) {
      if (m.r !== rid) return;
      if (m.key) st.keys++;
      var h = hold[m.name];
      if (!h || (skipPlainOf === h && !m.key)) return;
      st[h].n++; if (m.key) st[h].k++;
    });
    return st;
  }
  var SCORE = {
    A: function (s) {
      function tier(me, op) {
        if (!me.n) return 0;
        if (me.k === s.keys && me.n > op.n) return 3;
        if (me.n > op.n && me.k > op.k && me.k >= 1 && me.n - me.k >= 1) return 2;
        return 1;
      }
      return { us: tier(s.us, s.cn), cn: tier(s.cn, s.us) };
    },
    B: function (s) {
      return { us: s.us.k + (s.us.n > s.cn.n ? 1 : 0), cn: s.cn.k + (s.cn.n > s.us.n ? 1 : 0) };
    },
    C: function (s) {
      var d = (s.us.n + s.us.k) - (s.cn.n + s.cn.k);
      return { us: d > 0 ? Math.min(3, d) : 0, cn: d < 0 ? Math.min(3, -d) : 0 };
    },
    D: function (s) {
      var a = s.us.n + s.us.k, b = s.cn.n + s.cn.k;
      if (!a && !b) return { us: 0, cn: 0 };
      if (a === b) return { us: 1, cn: 1 };
      return a > b ? { us: 2, cn: s.cn.n ? 1 : 0 } : { us: s.us.n ? 1 : 0, cn: 2 };
    }
  };
  var TIER = ['—', '存在', '支配', '控制'];

  function scoreSim() {
    var host = $('#sim');
    var PRESETS = {
      start: { label: '2022 开局', us: ['英国'], cn: [] },
      y2024: { label: '2024 年终的一种局面', us: ['台湾', '日本', '英国', '法国', '菲律宾', '加拿大'], cn: ['韩国', '印尼', '越南', '马来西亚', '肯尼亚'] },
      y2027: { label: '2027 胶着', us: ['台湾', '日本', '荷兰', '英国', '加拿大', '澳大利亚', '以色列', '阿联酋', '菲律宾'], cn: ['韩国', '沙特', '卡塔尔', '印尼', '越南', '马来西亚', '德国', '新加坡'] },
      y2029: { label: '2029 中国后程发力', us: ['台湾', '日本', '英国', '法国', '加拿大', '以色列', '墨西哥'], cn: ['韩国', '荷兰', '沙特', '阿联酋', '印尼', '越南', '马来西亚', '新加坡', '尼日利亚', '巴西', '肯尼亚'] }
    };
    var st = { hold: {} };
    function load(k) {
      var p = PRESETS[k]; st.hold = {};
      p.us.forEach(function (n) { st.hold[n] = 'us'; });
      p.cn.forEach(function (n) { st.hold[n] = 'cn'; });
    }
    function open() { return true; }   // 全图从第一年就开放

    function draw() {
      var h = '<div class="sim-top"><span class="muted">局面：</span>' + Object.keys(PRESETS).map(function (k) {
        return '<button data-preset="' + k + '" class="ghost">' + PRESETS[k].label + '</button>';
      }).join('') + '<button data-preset="clear" class="ghost">清空</button></div>';

      // 棋盘：一列一条进度条
      h += '<div class="sim-board">';
      D.bars.forEach(function (b) {
        h += '<div class="sim-col"><h5>' + b.name + '</h5>';
        D.regions.filter(function (r) { return r.bar === b.id; }).forEach(function (r) {
          var isOpen = open(r), s = regionStat(r.id, st.hold);
          h += '<div class="sim-reg' + (isOpen ? '' : ' closed') + '"><div class="sim-rh"><b>' + r.name + '</b><span>' + ERA[r.era].name + '的牌指向这里</span></div><div class="sim-mk">' +
            D.markets.filter(function (m) { return m.r === r.id; }).map(function (m) {
              var k = st.hold[m.name] || '';
              return '<button data-m="' + m.name + '" class="smk ' + k + '"' + (isOpen ? '' : ' disabled') + '>' + (m.key ? '★ ' : '') + m.name + '</button>';
            }).join('') + '</div>';
          if (isOpen) {
            h += '<div class="sim-res">' + D.schemes.map(function (sc) {
              var g = SCORE[sc.id](s);
              var extra = sc.id === 'A' ? '<em>' + TIER[g.us] + ' / ' + TIER[g.cn] + '</em>' : '';
              return '<span><i>' + sc.id + '</i><b class="us-t">+' + g.us + '</b><b class="cn-t">+' + g.cn + '</b>' + extra + '</span>';
            }).join('') + '</div>';
          }
          h += '</div>';
        });
        h += '</div>';
      });
      h += '</div>';

      // 汇总
      h += '<table class="grid sim-sum"><thead><tr><th style="width:11em">算法</th>' + D.bars.map(function (b) {
        return '<th colspan="2">' + b.name + '</th>';
      }).join('') + '<th>今年推得最少的那条</th></tr>' +
        '<tr class="sub"><th></th>' + D.bars.map(function () { return '<th class="us-t">美</th><th class="cn-t">中</th>'; }).join('') + '<th></th></tr></thead><tbody>';
      D.schemes.forEach(function (sc) {
        var tot = { us: {}, cn: {} };
        D.bars.forEach(function (b) { tot.us[b.id] = 0; tot.cn[b.id] = 0; });
        D.regions.forEach(function (r) {
          if (!open(r)) return;
          var g = SCORE[sc.id](regionStat(r.id, st.hold));
          tot.us[r.bar] += g.us; tot.cn[r.bar] += g.cn;
        });
        function weak(side) {                 // 三条都要满，所以只看今年推得最少的那条
          var worst = D.bars[0];
          D.bars.forEach(function (b) { if (tot[side][b.id] < tot[side][worst.id]) worst = b; });
          return worst.name + ' +' + tot[side][worst.id];
        }
        h += '<tr><td><b>' + sc.id + '　' + sc.name + '</b></td>' + D.bars.map(function (b) {
          return '<td class="num us-t">+' + tot.us[b.id] + '</td><td class="num cn-t">+' + tot.cn[b.id] + '</td>';
        }).join('') + '<td><span class="us-t">美国：' + weak('us') + '</span>　<span class="cn-t">中国：' + weak('cn') + '</span></td></tr>';
      });
      h += '</tbody></table>' +
        '<p class="fine">点一个市场切换：没人垄断 → 美国垄断 → 中国垄断。每个大区下面一行是它今年按四种算法各推几格（蓝是美国，红是中国）。最右一栏是每一方今年推得最少的那条：三条都要堆满，所以它决定你离 AGI 还有多远。一条 ' + D.BAR_LEN + ' 格，九年里平均每年要推 1.3 格。</p>';
      host.innerHTML = h;
    }

    host.addEventListener('click', function (ev) {
      var b = ev.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-m')) {
        var n = b.getAttribute('data-m'), cur = st.hold[n] || '';
        st.hold[n] = cur === '' ? 'us' : (cur === 'us' ? 'cn' : '');
        if (!st.hold[n]) delete st.hold[n];
      } else if (b.hasAttribute('data-preset')) {
        var k = b.getAttribute('data-preset');
        if (k === 'clear') st.hold = {}; else load(k);
      } else return;
      draw();
    });
    load('y2024');
    draw();
  }

  function renderSchemes() {
    var h = '<table class="grid schemes"><thead><tr><th style="width:9.5em"></th><th style="width:30%">怎么算</th><th>打起来什么感觉</th><th>要留意的</th><th style="width:5.5em">一条一年最多</th></tr></thead><tbody>';
    D.schemes.forEach(function (s) {
      h += '<tr' + (s.id === 'B' ? ' class="pick"' : '') + '><td><b>' + s.id + '　' + s.name + '</b><br><span class="fine">' + s.tag + '</span></td>' +
        '<td>' + s.rule + '</td><td>' + s.feel + '</td><td>' + s.risk + '</td><td>' + s.max + ' 格</td></tr>';
    });
    $('#schemes').innerHTML = h + '</tbody></table>';
  }

  /* ───────── R8a 每个时代的牌指向哪些大区：直接从牌面上数 ───────── */
  function renderFocus() {
    var R = D.regions.map(function (r) {
      return { r: r, names: [r.name].concat(D.markets.filter(function (m) { return m.r === r.id; }).map(function (m) { return m.name; })) };
    });
    function hit(c, x) { return x.names.some(function (n) { return c.text.indexOf(n) >= 0; }); }
    var h = '<table class="grid focus"><thead><tr><th style="width:9em">牌堆</th>' + R.map(function (x) {
      return '<th>' + x.r.name + '<small>' + BAR[x.r.bar].name + '</small></th>';
    }).join('') + '<th>不点名地方的牌</th></tr></thead><tbody>';
    D.eras.forEach(function (e) {
      var cs = D.cards.filter(function (c) { return c.era === e.id; });
      h += '<tr><td><b>' + e.name + '</b>　' + cs.length + ' 张</td>' + R.map(function (x) {
        var n = cs.filter(function (c) { return hit(c, x); }).length, share = n / cs.length;
        return '<td style="background:rgba(27,27,26,' + Math.min(0.75, share * 2).toFixed(3) + ');' + (share > 0.2 ? 'color:#fff' : '') + '">' + (n || '') + '</td>';
      }).join('') + '<td class="plain">' + cs.filter(function (c) { return !R.some(function (x) { return hit(c, x); }); }).length + '</td></tr>';
    });
    $('#focus').innerHTML = h + '</tbody></table>';
  }

  /* ───────── R7 融资难度阶梯：每一级禁哪些大区的收购 ───────── */
  function renderFinance() {
    var RN = {};
    D.regions.forEach(function (r) { RN[r.id] = r; });
    var h = '<div class="fin">' + D.finance.map(function (f) {
      return '<div class="fl' + (f.lv === 5 ? ' dead' : (f.lv === 4 ? ' warn' : '')) + '"><b>' + f.lv + '</b><span>' + f.name + '</span></div>';
    }).join('') + '</div>';
    h += '<table class="grid fin-t"><thead><tr><th style="width:7em">大区</th>' + D.finance.map(function (f) { return '<th>' + f.lv + '</th>'; }).join('') + '</tr></thead><tbody>';
    D.regions.forEach(function (r) {
      h += '<tr><td><b>' + r.name + '</b></td>' + D.finance.map(function (f) {
        var banned = f.ban.indexOf(r.id) >= 0;
        return '<td class="' + (banned ? 'ban' : 'okc') + '">' + (banned ? '禁' : '可') + '</td>';
      }).join('') + '</tr>';
    });
    $('#finance').innerHTML = h + '</tbody></table>';
  }

  /* ───────── R11 牌库统计 ───────── */
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
    $('#deck-stats').innerHTML = h + line('全部', D.cards, 'sum') + '</tbody></table>';
  }

  /* ───────── R11 卡牌 ───────── */
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
  function pwr(p) { return p ? '力度 <span class="pw">' + '●●●'.slice(0, p) + '○○○'.slice(0, 3 - p) + '</span>' : ''; }

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
      grp('flag', [['all', '全部'], ['dice', '🎲 要掷骰'], ['perm', '常驻和环境'], ['tight', '收紧 ▲'], ['ease', '宽松 ▼'], ['once', '一次性'], ['real', '真事'], ['fic', '推演']]) +
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
    var KEY = 'agi-race-notes-v3', OLD = 'agi-race-notes-v2';
    var data = {};
    try {
      data = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
      var old = JSON.parse(localStorage.getItem(OLD) || '{}') || {};   // 这一版推倒重来，编号都变了：旧批注带着版本号留下
      Object.keys(old).forEach(function (k) { if (old[k]) data[(k.indexOf('v0.') === 0 ? '' : 'v0.4 的 ') + k] = old[k]; });
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
      var inline = host.classList.contains('card') || host.classList.contains('barcard');
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

  renderTurns();
  renderTilt();
  renderBars();
  shareDemo();
  acqCalc();
  renderMap();
  scoreSim();
  renderSchemes();
  renderFocus();
  renderFinance();
  renderStats();
  renderFilters();
  bindFilters();
  Notes.init();
  renderCards();
  spy();
})();
