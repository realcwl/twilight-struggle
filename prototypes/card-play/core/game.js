// The game as the prototypes see it: one state object, questions that can be asked of it, and a
// director that walks through a turn (headline, then action rounds, the opponent moving first) by
// asking the active variant to do each piece of staging. The director decides WHAT happens and in
// what order; a variant decides how it is asked for and how it is shown. See base.js for the list
// of things a variant is asked to do.
import { START, INFLUENCE, OPPONENT } from './situation.js';
import { RULES, makeWorld, makeRules, makeEvents, other } from './rules.js';

/** Thrown through every await when a run is abandoned (variant switched, reset). */
export const ABORT = { abort: true };

export const SIDE_NAME = ['美国', '苏联'];
export const MODE_NAME = { place: '放置影响力', realign: '调整阵营', coup: '政变', space: '太空竞赛', event: '事件' };

export function createGame({ scenario, deck, refresh }) {
  const W = makeWorld(scenario);
  const R = makeRules(W);
  const EV = makeEvents(W, R);
  const byNo = Object.fromEntries(deck.map((c) => [c.no, c]));
  const G = {};
  let forced = [];

  function reset() {
    for (const k of Object.keys(G)) delete G[k];
    Object.assign(G, structuredClone(START), {
      me: 0,
      round: 0,
      phase: 'headline',
      active: 0,
      inf: Object.fromEntries(W.ids.map((id) => [id, [...(INFLUENCE[id] ?? [0, 0])]])),
      spaceTried: [false, false],
      played: null,
      over: null,
    });
    refresh();
  }

  /* ------------------------------------------------------------------ questions */
  /** A card as the prototypes need it. `owner` is whose event it is, from the player's seat. */
  function card(no) {
    const c = byNo[no];
    const owner = c.side === 'us' ? 'mine' : c.side === 'ussr' ? 'theirs' : c.side;
    return { no, title: c.title, value: c.value, side: c.side, owner, once: !!c.once, text: c.text, pile: c.once ? 'removed' : 'discard' };
  }
  const eventBy = (no, playedBy) => (byNo[no].side === 'us' ? 0 : byNo[no].side === 'ussr' ? 1 : playedBy);
  const country = (id) => ({ ...W.C[id], inf: G.inf[id] ?? [0, 0], ctrl: R.ctrl(G, id) });

  /**
   * Everything the player could do with a card right now, and why not where they cannot.
   *   event    { ok, lines: [{ text, warn, lethal }] }   ok is false for the opponent's card
   *   fires    true when the opponent's event happens anyway if the card is used for operations
   *   place    { ok, targets: Map(id -> { cost }) }
   *   coup     { ok, targets: Map(id -> preview), locked: Map(id -> reason), why }
   *   realign  { ok, targets: Map(id -> { mods, edge }), locked, why }
   *   space    { ok, why, max, chance, step }
   */
  function options(no, side = 0) {
    const c = card(no);
    const lines = EV[no]?.lines(G, eventBy(no, side)) ?? [{ text: '（这张牌的事件没有做进原型）' }];
    const place = R.placeTargets(G, side);
    const coup = R.coupTargets(G, side, c.value);
    const realign = R.realignTargets(G, side);
    const none = (t) => (t.locked.size ? '能动手的国家都在被封锁的地区' : '没有对手影响力可动');
    return {
      card: c,
      points: c.value,
      event: { ok: c.owner !== 'theirs', lines, lethal: lines.some((l) => l.lethal) },
      fires: c.owner === 'theirs',
      place: { ok: place.size > 0, targets: place },
      coup: { ok: coup.ok.size > 0, targets: coup.ok, locked: coup.locked, why: coup.ok.size ? '' : none(coup) },
      realign: { ok: realign.ok.size > 0, targets: realign.ok, locked: realign.locked, why: realign.ok.size ? '' : none(realign) },
      space: R.spaceOption(G, side, c),
    };
  }

  /* ------------------------------------------------------------------ the director */
  let run = null;

  function die() {
    return forced.length ? forced.shift() : 1 + Math.floor(Math.random() * 6);
  }

  /** Starts a turn from 'headline', 'opponent' (round 1, their move) or 'action' (round 1, your move). */
  function start(P, from = 'headline', dice = []) {
    stop();
    forced = [...dice];
    reset();
    const me = { alive: true };
    run = me;
    const check = () => {
      if (!me.alive) throw ABORT;
    };

    async function stage(effects, cause) {
      for (const e of effects) {
        check();
        const done = R.apply(G, e);
        let shown = false;
        const commit = () => {
          if (shown) return;
          shown = true;
          refresh(done);
        };
        await P.step(done, commit, cause);
        check();
        commit();
        if (G.crisis <= 1) {
          G.over = 'war';
          await P.phase({ kind: 'end', why: 'war' });
          throw ABORT;
        }
      }
    }

    function take(no, by) {
      if (by === 0) G.hand.splice(G.hand.indexOf(no), 1);
      else G.oppHand = Math.max(0, G.oppHand - 1);
      G.played = { no, by };
      refresh();
    }
    function leave(play) {
      G.played = null;
      G[play.pile].push(play.no);
      refresh();
    }

    async function runEvent(play) {
      const { no } = play;
      const ev = EV[no];
      const by = eventBy(no, play.by);
      const cause = { kind: 'event', by, no };
      if (!ev) return stage([{ t: 'note', text: '这张牌的事件没有做进原型' }], cause);
      if (!ev.pick) return stage(ev.run(G, by, []), cause);
      const spec = ev.pick(G, by);
      const pool = new Set(spec.targets);
      for (let i = 0; i < spec.count && pool.size; i++) {
        check();
        const id =
          play.by === 0
            ? await P.pickTarget({ mode: 'event', by: 0, no, targets: new Map([...pool].map((x) => [x, {}])), locked: new Map(), left: spec.count - i, total: spec.count, title: spec.title, hint: spec.hint, optional: false, cancel: false })
            : [...pool][0];
        check();
        pool.delete(id);
        await stage(ev.run(G, by, [id]), { ...cause, id });
      }
    }

    async function runCoup(play, id) {
      const roll = die();
      const res = R.coupEffects(G, play.by, id, play.points, roll);
      const p = res.preview;
      await P.roll({
        kind: 'coup', by: play.by, id, no: play.no,
        dice: [{ side: play.by, value: roll, mods: [{ label: '行动点', n: play.points }], total: roll + play.points }],
        bar: { label: `稳定度 ${p.stability} ×2`, n: p.bar },
        need: p.need, chance: p.chance, table: p.table,
        ok: res.row.ok,
        text: res.row.ok ? `政变成功 · 净值 ${res.row.net}` : '政变失败',
      });
      check();
      await stage(res.effects, { kind: 'coup', by: play.by, no: play.no, id });
    }

    async function runRealign(play, id, left) {
      const rolls = [die(), die()];
      const res = R.realignEffects(G, id, rolls);
      await P.roll({
        kind: 'realign', by: play.by, id, no: play.no, left,
        dice: [0, 1].map((s) => ({ side: s, value: rolls[s], mods: res.mods[s], total: res.totals[s] })),
        ok: res.loser === other(play.by),
        winner: res.loser === null ? null : other(res.loser),
        text: res.loser === null ? '平手' : `${SIDE_NAME[other(res.loser)]}胜出 · 差 ${Math.abs(res.diff)}`,
      });
      check();
      await stage(res.effects, { kind: 'realign', by: play.by, no: play.no, id });
    }

    async function runSpace(play) {
      const roll = die();
      const res = R.spaceEffects(G, play.by, roll);
      G.spaceTried[play.by] = true;
      const table = [1, 2, 3, 4, 5, 6].map((r) => ({ roll: r, ok: r <= RULES.spaceRoll }));
      await P.roll({
        kind: 'space', by: play.by, no: play.no,
        dice: [{ side: play.by, value: roll, mods: [], total: roll }],
        max: RULES.spaceRoll, chance: RULES.spaceRoll / 6, table,
        ok: res.ok,
        text: res.ok ? '发射成功 · 前进一步' : '发射失败',
      });
      check();
      await stage(res.effects, { kind: 'space', by: play.by, no: play.no });
    }

    /** The opponent's event goes off after the player has used their card for operations. */
    async function fire(play) {
      if (!play.fires) return;
      await P.trigger(play);
      check();
      await runEvent({ ...play, by: 1 });
    }

    function placeSession(play) {
      const base = { inf: structuredClone(G.inf) };
      const spent = [];
      const s = {
        side: play.by,
        points: play.points,
        spent,
        get left() {
          return play.points - spent.reduce((a, x) => a + x.cost, 0);
        },
        count: (id) => spent.filter((x) => x.id === id).length,
        /** Map(id -> { cost, ok }): ok is false when what is left cannot pay for it. */
        targets() {
          const t = R.placeTargets(G, play.by, base);
          for (const v of t.values()) v.ok = v.cost <= s.left;
          return t;
        },
        add(id) {
          const t = s.targets().get(id);
          if (!t || !t.ok) return null;
          const effect = R.apply(G, { t: 'inf', id, side: play.by, d: 1 });
          spent.push({ id, cost: t.cost, effect });
          refresh(effect);
          return effect;
        },
        undo() {
          const last = spent.pop();
          if (!last) return null;
          R.apply(G, { t: 'inf', id: last.id, side: play.by, d: -1 });
          refresh();
          return last;
        },
      };
      return s;
    }

    /** One play by the player, from the decision on. False if they backed out before anything happened. */
    async function playerPlay(d) {
      const c = card(d.no);
      const o = options(d.no);
      const play = { by: 0, no: d.no, card: c, use: d.use, mode: d.use === 'ops' ? d.mode : d.use, points: c.value, pile: c.pile, fires: d.use === 'ops' && o.fires };
      const index = G.hand.indexOf(d.no);
      const back = async () => {
        G.played = null;
        G.hand.splice(index, 0, d.no);
        refresh();
        await P.settle({ ...play, cancelled: true });
        return false;
      };
      take(d.no, 0);
      await P.announce(play);
      check();

      if (play.use === 'event') await runEvent(play);
      else if (play.use === 'space') {
        play.pile = 'discard';
        await runSpace(play);
      } else if (play.mode === 'place') {
        const s = placeSession(play);
        if (d.target) s.add(d.target);
        const ok = await P.place(s, play);
        check();
        if (!ok || !s.spent.length) {
          while (s.undo());
          return back();
        }
        await fire(play);
      } else if (play.mode === 'coup') {
        const t = R.coupTargets(G, 0, c.value);
        const id = d.target && t.ok.has(d.target) ? d.target : await P.pickTarget({ mode: 'coup', by: 0, no: d.no, targets: t.ok, locked: t.locked, left: 1, total: 1, optional: false, cancel: true });
        check();
        if (!id) return back();
        play.target = id;
        await runCoup(play, id);
        await fire(play);
      } else if (play.mode === 'realign') {
        let rolled = 0;
        for (let i = 0; i < c.value; i++) {
          const t = R.realignTargets(G, 0);
          if (!t.ok.size) break;
          const id =
            i === 0 && d.target && t.ok.has(d.target)
              ? d.target
              : await P.pickTarget({ mode: 'realign', by: 0, no: d.no, targets: t.ok, locked: t.locked, left: c.value - i, total: c.value, optional: i > 0, cancel: i === 0, last: play.target });
          check();
          if (!id) break;
          play.target = id;
          rolled++;
          await runRealign(play, id, c.value - i - 1);
        }
        if (!rolled) return back();
        await fire(play);
      }
      check();
      await P.settle(play);
      leave(play);
      return true;
    }

    async function playerTurn() {
      for (;;) {
        check();
        const d = await P.decide();
        check();
        if (await playerPlay(d)) return;
      }
    }

    async function opponentTurn(move) {
      const c = card(move.no);
      const play = { by: 1, no: move.no, card: c, use: move.use, mode: move.use === 'ops' ? move.mode : move.use, points: c.value, pile: move.use === 'space' ? 'discard' : c.pile, target: move.target ?? move.targets?.[0], targets: move.targets };
      take(move.no, 1);
      await P.announce(play);
      check();
      if (play.use === 'event') await runEvent(play);
      else if (play.use === 'space') await runSpace(play);
      else if (play.mode === 'place') {
        // one effect per country, in the order the script names them
        const sums = new Map();
        for (const id of move.targets) sums.set(id, (sums.get(id) ?? 0) + 1);
        await stage([...sums].map(([id, d]) => ({ t: 'inf', id, side: 1, d })), { kind: 'place', by: 1, no: move.no });
      } else if (play.mode === 'coup') await runCoup(play, move.target);
      else if (play.mode === 'realign') {
        for (let i = 0; i < move.targets.length; i++) {
          if (!R.realignTargets(G, 1).ok.has(move.targets[i])) break;
          await runRealign(play, move.targets[i], move.targets.length - i - 1);
        }
      }
      check();
      await P.settle(play);
      leave(play);
    }

    async function headline() {
      G.phase = 'headline';
      refresh();
      await P.phase({ kind: 'headline' });
      check();
      const mine = await P.pickHeadline();
      check();
      const theirs = OPPONENT.headline;
      G.hand.splice(G.hand.indexOf(mine), 1);
      G.oppHand -= 1;
      refresh();
      // the higher card goes first; the player's on a tie
      const order = [{ no: mine, by: 0 }, { no: theirs, by: 1 }].sort((x, y) => byNo[y.no].value - byNo[x.no].value || x.by - y.by);
      await P.showHeadline({ mine, theirs, order });
      for (const o of order) {
        check();
        const c = card(o.no);
        const play = { by: o.by, no: o.no, card: c, use: 'event', mode: 'event', points: c.value, pile: c.pile, headline: true };
        G.played = { no: o.no, by: o.by };
        refresh();
        await P.announce(play);
        check();
        await runEvent(play);
        check();
        await P.settle(play);
        leave(play);
      }
    }

    (async () => {
      if (from === 'headline') await headline();
      G.phase = 'action';
      for (let r = 1; r <= OPPONENT.rounds.length; r++) {
        check();
        G.round = r;
        if (!(from === 'action' && r === 1)) {
          G.active = 1;
          refresh();
          await P.phase({ kind: 'round', round: r, who: 1 });
          check();
          await opponentTurn(OPPONENT.rounds[r - 1]);
        }
        check();
        if (!G.hand.length) break;
        G.active = 0;
        refresh();
        await P.phase({ kind: 'round', round: r, who: 0 });
        await playerTurn();
      }
      check();
      G.over = 'turn';
      await P.phase({ kind: 'end', why: 'turn' });
    })().catch((err) => {
      if (err !== ABORT) console.error(err);
    });

    return me;
  }

  function stop() {
    if (run) run.alive = false;
    run = null;
  }

  return { G, W, R, RULES, card, country, options, start, stop, reset, alive: () => !!run?.alive };
}
