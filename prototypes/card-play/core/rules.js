// A stand-in for the rules, just enough for the card-play prototypes to have real choices and real
// consequences: who may place where, what a coup or a realignment roll does, when a region is locked.
// The numbers are placeholders to be replaced by the game's own rules; nothing in a variant
// depends on them, only on the shapes returned here.
//
// Sides: 0 is the player, 1 the opponent. Influence is [player, opponent].
//
// Every change to the game is an effect, one small step that a variant can stage on its own:
//   { t: 'inf', id, side, d }        influence in a country goes up or down
//   { t: 'crisis', d, why }          the nuclear crisis level moves (negative is toward war)
//   { t: 'milops', side, d }         military operations
//   { t: 'vp', side, d }             victory points for a side
//   { t: 'space', side, d }          a step in the space race
//   { t: 'note', text }              nothing changes; something has to be said (a condition failed)
// apply() fills in `from`, `to` and, for influence, who controlled the country before and after.

export const RULES = {
  /** At this crisis level or lower, coups and realignment are not allowed in the region. */
  locks: [
    { at: 4, region: 'europe' },
    { at: 3, region: 'asia' },
    { at: 2, region: 'mideast' },
  ],
  crisisMax: 5,
  milopsMax: 5,
  vpMax: 20,
  spaceMax: 8,
  /** Space race: the card must be worth at least this, and the roll must be this or lower. */
  spaceValue: 2,
  spaceRoll: 3,
};

export const other = (side) => (side === 0 ? 1 : 0);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Static facts about the board, read once from the map's scenario. */
export function makeWorld(scenario) {
  const C = {};
  const adj = {};
  const home = [null, null];
  for (const c of scenario.countries) {
    C[c.id] = { id: c.id, name: c.name.zh, stability: c.stability, key: c.key, region: c.region, superpower: c.superpower };
    adj[c.id] = [];
    if (c.superpower !== undefined) home[c.superpower] = c.id;
  }
  for (const l of scenario.links) {
    adj[l.a].push(l.b);
    adj[l.b].push(l.a);
  }
  const regions = Object.fromEntries(scenario.regions.map((r) => [r.id, r.name.zh]));
  const ids = scenario.countries.filter((c) => c.superpower === undefined).map((c) => c.id);
  return { C, adj, home, regions, ids };
}

export function makeRules(W) {
  const { C, adj, home } = W;
  const inf = (G, id) => G.inf[id] ?? (G.inf[id] = [0, 0]);

  /** Who controls a country: a side whose influence leads by at least the stability. */
  function ctrl(G, id) {
    const c = C[id];
    if (c.superpower !== undefined) return c.superpower;
    const [a, b] = inf(G, id);
    return a - b >= c.stability ? 0 : b - a >= c.stability ? 1 : null;
  }

  /** Why coups and realignment are barred in a country's region, or null. */
  function lockOf(G, id) {
    const lock = RULES.locks.find((l) => l.region === C[id].region && G.crisis <= l.at);
    return lock ? `核危机 ${G.crisis} 级：${W.regions[lock.region]}禁止政变与调整阵营` : null;
  }

  /* ------------------------------------------------------------------ placing influence */
  /** Where a side may place: wherever it already stands, and next door to that. Map of id -> { cost }. */
  function placeTargets(G, side, base = G) {
    const out = new Map();
    for (const id of W.ids) {
      const near = inf(base, id)[side] > 0 || adj[id].some((n) => n === home[side] || (C[n].superpower === undefined && inf(base, n)[side] > 0));
      if (near) out.set(id, { cost: ctrl(G, id) === other(side) ? 2 : 1 });
    }
    return out;
  }

  /* ------------------------------------------------------------------ coup */
  function coupPreview(G, side, id, ops) {
    const c = C[id];
    const theirs = inf(G, id)[other(side)];
    const bar = c.stability * 2;
    const table = [1, 2, 3, 4, 5, 6].map((roll) => {
      const net = Math.max(0, roll + ops - bar);
      const remove = Math.min(net, theirs);
      return { roll, ok: net > 0, net, remove, add: net - remove };
    });
    const wins = table.filter((t) => t.ok).length;
    const crisisTo = c.key ? Math.max(1, G.crisis - 1) : G.crisis;
    return {
      id, ops, stability: c.stability, bar, table,
      need: wins ? 7 - wins : null, // the lowest roll that succeeds
      chance: wins / 6,
      key: c.key, crisisTo, lethal: c.key && crisisTo <= 1,
      milopsTo: Math.min(RULES.milopsMax, G.milops[side] + ops),
    };
  }

  /** Countries a side may coup with a card of `ops` points, and the ones that are barred, with the reason. */
  function coupTargets(G, side, ops) {
    const ok = new Map();
    const locked = new Map();
    for (const id of W.ids) {
      if (inf(G, id)[other(side)] <= 0) continue;
      const why = lockOf(G, id);
      const p = coupPreview(G, side, id, ops);
      if (why) locked.set(id, why);
      else if (p.lethal) locked.set(id, '核危机已到 2 级：再在战场国政变就是核战');
      else ok.set(id, p);
    }
    return { ok, locked };
  }

  function coupEffects(G, side, id, ops, roll) {
    const p = coupPreview(G, side, id, ops);
    const row = p.table[roll - 1];
    const fx = [];
    if (row.remove) fx.push({ t: 'inf', id, side: other(side), d: -row.remove });
    if (row.add) fx.push({ t: 'inf', id, side, d: row.add });
    if (!row.ok) fx.push({ t: 'note', id, text: `政变失败：${C[id].name}纹丝不动` });
    fx.push({ t: 'milops', side, d: ops, why: '政变计入军事行动' });
    if (p.key) fx.push({ t: 'crisis', d: -1, id, why: `在战场国${C[id].name}政变` });
    return { preview: p, row, effects: fx };
  }

  /* ------------------------------------------------------------------ realignment */
  /** What each side adds to its die in a country: [{ label, n }] for the player and for the opponent. */
  function realignMods(G, id) {
    return [0, 1].map((side) => {
      const mods = [];
      const friends = adj[id].filter((n) => C[n].superpower === undefined && ctrl(G, n) === side).length;
      if (friends) mods.push({ label: `相邻受控国 ×${friends}`, n: friends });
      if (adj[id].includes(home[side])) mods.push({ label: '毗邻本土', n: 1 });
      if (inf(G, id)[side] > inf(G, id)[other(side)]) mods.push({ label: '影响力占优', n: 1 });
      return mods;
    });
  }

  function realignTargets(G, side) {
    const ok = new Map();
    const locked = new Map();
    for (const id of W.ids) {
      if (inf(G, id)[other(side)] <= 0) continue;
      const why = lockOf(G, id);
      if (why) locked.set(id, why);
      else {
        const mods = realignMods(G, id);
        const sum = (m) => m.reduce((a, x) => a + x.n, 0);
        ok.set(id, { id, mods, edge: sum(mods[side]) - sum(mods[other(side)]) });
      }
    }
    return { ok, locked };
  }

  /** rolls is [player's die, opponent's die]. The lower total loses the difference in influence. */
  function realignEffects(G, id, rolls) {
    const mods = realignMods(G, id);
    const totals = [0, 1].map((s) => rolls[s] + mods[s].reduce((a, x) => a + x.n, 0));
    const diff = totals[0] - totals[1];
    const loser = diff > 0 ? 1 : diff < 0 ? 0 : null;
    const lose = loser === null ? 0 : Math.min(Math.abs(diff), inf(G, id)[loser]);
    const fx = [];
    if (lose) fx.push({ t: 'inf', id, side: loser, d: -lose });
    else fx.push({ t: 'note', id, text: loser === null ? '平手：谁也没动' : `${C[id].name}已经没有可移除的影响力` });
    return { mods, totals, diff, loser, lose, effects: fx };
  }

  /* ------------------------------------------------------------------ space race */
  function spaceOption(G, side, card) {
    if (card.side === 'tally') return { ok: false, why: '结算牌不能用于太空竞赛' };
    if (G.spaceTried[side]) return { ok: false, why: '本回合已经尝试过一次' };
    if (card.value < RULES.spaceValue) return { ok: false, why: `需要至少 ${RULES.spaceValue} 点的牌` };
    if (G.space[side] >= RULES.spaceMax) return { ok: false, why: '已经走完全程' };
    return { ok: true, max: RULES.spaceRoll, chance: RULES.spaceRoll / 6, step: G.space[side] + 1 };
  }
  function spaceEffects(G, side, roll) {
    const ok = roll <= RULES.spaceRoll;
    return { ok, effects: ok ? [{ t: 'space', side, d: 1 }] : [{ t: 'note', text: '发射失败：原地不动' }] };
  }

  /* ------------------------------------------------------------------ applying */
  /** Carries out one effect and returns it with what it changed filled in. */
  function apply(G, e) {
    const out = { ...e };
    if (e.t === 'inf') {
      const v = inf(G, e.id);
      out.ctrlFrom = ctrl(G, e.id);
      out.from = v[e.side];
      v[e.side] = Math.max(0, v[e.side] + e.d);
      out.to = v[e.side];
      out.d = out.to - out.from;
      out.ctrlTo = ctrl(G, e.id);
    } else if (e.t === 'crisis') {
      out.from = G.crisis;
      G.crisis = clamp(G.crisis + e.d, 1, RULES.crisisMax);
      out.to = G.crisis;
    } else if (e.t === 'milops') {
      out.from = G.milops[e.side];
      G.milops[e.side] = clamp(G.milops[e.side] + e.d, 0, RULES.milopsMax);
      out.to = G.milops[e.side];
    } else if (e.t === 'vp') {
      out.from = G.vp;
      G.vp = clamp(G.vp + (e.side === 0 ? e.d : -e.d), -RULES.vpMax, RULES.vpMax);
      out.to = G.vp;
    } else if (e.t === 'space') {
      out.from = G.space[e.side];
      G.space[e.side] = clamp(G.space[e.side] + e.d, 0, RULES.spaceMax);
      out.to = G.space[e.side];
    }
    return out;
  }

  return { ctrl, lockOf, placeTargets, coupPreview, coupTargets, coupEffects, realignMods, realignTargets, realignEffects, spaceOption, spaceEffects, apply };
}

/* ------------------------------------------------------------------ the events of the cards in play */
// Each entry: lines(G, by) says in plain words what will happen (shown before the choice is made);
// run(G, by, picks) returns the effects. `pick` asks the player to choose countries first.
// `by` is who the event belongs to in effect: the side that benefits when the card names one.
export function makeEvents(W, R) {
  const { C } = W;
  const n = (id) => C[id].name;
  const add = (id, side, d) => ({ t: 'inf', id, side, d });
  const oil = ['sau', 'irq', 'irn', 'gulf'];
  const held = (G, ids, side) => ids.filter((id) => R.ctrl(G, id) === side).length;
  const open = (G) => W.ids.filter((id) => R.ctrl(G, id) === null);
  const sideName = ['美国', '苏联'];

  return {
    '031': {
      lines: () => [{ text: `${n('frg')} +2 美国影响力` }, { text: '胜利点 +1' }],
      run: () => [add('frg', 0, 2), { t: 'vp', side: 0, d: 1 }],
    },
    '033': {
      lines: (G) => [{ text: `${n('vnm')} +3 美国影响力` }, { text: `核危机 ${G.crisis} → ${Math.max(1, G.crisis - 1)}`, warn: true }],
      run: () => [add('vnm', 0, 3), { t: 'crisis', d: -1, why: '《东京湾决议》：紧张度上升' }],
    },
    '042': { lines: () => [{ text: '胜利点 +3' }], run: () => [{ t: 'vp', side: 0, d: 3 }] },
    '037': {
      lines: () => [{ text: `${n('ind')}、${n('pak')}、${n('phl')}各 +1 美国影响力` }],
      run: () => ['ind', 'pak', 'phl'].map((id) => add(id, 0, 1)),
    },
    '012': {
      lines: () => [{ text: '从欧洲三个国家各移除 1 点苏联影响力' }],
      pick: (G) => ({ count: 3, title: '自由欧洲电台', hint: '选一个有苏联影响力的欧洲国家', targets: W.ids.filter((id) => C[id].region === 'europe' && G.inf[id]?.[1] > 0) }),
      run: (G, by, picks) => picks.map((id) => add(id, 1, -1)),
    },
    '049': {
      lines: (G) => {
        const a = held(G, oil, 0);
        const b = held(G, oil, 1);
        return [
          { text: `产油国：美国控制 ${a} 国，苏联控制 ${b} 国` },
          a === b ? { text: '持平：无人得分' } : { text: `${sideName[a > b ? 0 : 1]}得 2 胜利点`, warn: b > a },
        ];
      },
      run: (G) => {
        const a = held(G, oil, 0);
        const b = held(G, oil, 1);
        return a === b ? [{ t: 'note', text: '产油国持平：无人得分' }] : [{ t: 'vp', side: a > b ? 0 : 1, d: 2 }];
      },
    },
    '011': {
      lines: (G) => [{ text: `核危机 ${G.crisis} → ${Math.min(5, G.crisis + 1)}` }, { text: `${n('fra')}、${n('ita')}各 +1 苏联影响力`, warn: true }],
      run: () => [{ t: 'crisis', d: 1, why: '《斯德哥尔摩呼吁》：紧张度下降' }, add('fra', 1, 1), add('ita', 1, 1)],
    },
    '028': {
      lines: (G) => [
        R.ctrl(G, 'cub') === 1 ? { text: '苏联控制古巴：苏联得 2 胜利点', warn: true } : { text: '苏联未控制古巴：不得分' },
        { text: `核危机 ${G.crisis} → ${Math.max(1, G.crisis - 2)}`, warn: true, lethal: G.crisis - 2 <= 1 },
      ],
      run: (G) => [
        R.ctrl(G, 'cub') === 1 ? { t: 'vp', side: 1, d: 2 } : { t: 'note', text: '苏联未控制古巴：不得分' },
        { t: 'crisis', d: -2, why: '《阿纳德尔行动》：紧张度上升 2' },
      ],
    },
    '034': { lines: () => [{ text: '苏联得 2 胜利点', warn: true }], run: () => [{ t: 'vp', side: 1, d: 2 }] },
    '024': {
      lines: () => [{ text: '苏联得 1 胜利点', warn: true }, { text: '两个无人控制的国家各 +1 苏联影响力', warn: true }],
      run: (G) => {
        // the opponent picks open battlegrounds first
        const pool = open(G).sort((x, y) => Number(C[y].key) - Number(C[x].key) || (G.inf[y]?.[1] ?? 0) - (G.inf[x]?.[1] ?? 0));
        return [{ t: 'vp', side: 1, d: 1 }, ...pool.slice(0, 2).map((id) => add(id, 1, 1))];
      },
    },
  };
}
