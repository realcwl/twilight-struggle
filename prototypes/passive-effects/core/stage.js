// Plays the script's steps on the screen. The steps are the same for every display; what differs is
// where an effect in force is drawn, and a display may take over three moments:
//
//   enter(info, from)        a played card stays: it travels from the table to its place
//   fire(info, op)           the effect does something while it stands
//   leave(info, end)         it ends: cancelled, run out, or its condition met; the card goes to its pile
//
// A display that leaves one out gets the plain version below, which only needs el(id): the element
// that stands for the effect.
import { describe, live, whyWord } from './effects.js';
import { byNo } from '../../hud-layouts/state.js';
import { esc, rem } from './fx.js';

const PART = {
  tl: '.hud-tl', tr: '.hud-tr', bl: '.hud-bl', br: '.hud-br',
  table: '.pl-slot', deck: '.hp-deck .hp-card', discard: '.hp-discard .hp-card', removed: '.hp-removed .hp-card',
  crisis: '[data-part="crisis"]', milops: '[data-part="milops"]', score: '[data-part="scoreRead"]', rule: '[data-part="scoreRule"]',
  space: '[data-part="space"]', dial: '[data-part="dial"]', phase: '[data-part="phase"]', rounds: '[data-part="rounds"]',
  hand: '.hud-hand', opp: '.op-cards', piles: '.hud-piles',
};

export function makeStage({ hudRoot, mapEl, scenario, fx, detail, S, render, variant }) {
  const part = (name) => hudRoot.querySelector(PART[name] ?? name);
  const plate = (id) => mapEl.querySelector(`.wm-plate[data-id="${id}"]`);
  const node = (id) => plate(id)?.querySelector('.wm-plate-body') ?? null;
  const target = (at) => (!at ? null : typeof at === 'string' ? part(at) : node(at.country));
  const infos = () => S.effects.map((e) => describe(e, scenario));
  const infoOf = (id) => {
    const e = S.find(id);
    return e ? describe(e, scenario) : null;
  };
  const pileOf = (no) => (byNo[no].once ? 'removed' : 'discard');

  /** A figure or a word rising off a country's node. */
  function pop(id, html, cls = '') {
    const p = plate(id);
    if (!p) return;
    const n = fx.el('i', `pe-pop ${cls}`, html);
    const ring = fx.el('i', `pe-ring ${cls}`);
    p.append(ring, n);
    setTimeout(() => { n.remove(); ring.remove(); }, 1700);
  }

  /** Where a card lands on, or leaves from, the element that stands for an effect. */
  function cardRect(V, el, info) {
    if (!el) return null;
    if (V.cardRect) return V.cardRect(el, info);
    return fx.cardRectAt(el, V.landing ? V.landing * rem() : undefined);
  }

  async function plainEnter(V, info, from) {
    V.sync(infos(), { entering: info.id });
    const el = V.el(info.id);
    if (!el) return;
    await fx.flyCard(info.no, from, cardRect(V, el, info), { fade: V.landFade ?? 0.3, arc: V.arc ?? 0, duration: 620 });
    el.classList.remove('pe-pending');
    fx.pulse(el, 'pe-new', 2400);
    await fx.callout(V.anchor?.(el, info) ?? el, `<b>持续生效</b>${esc(info.until.long)}`, { side: V.calloutSide ?? 'auto', cls: info.cls });
  }

  async function plainFire(V, info, op) {
    const el = V.el(info.id);
    fx.pulse(el, 'pe-fire', 1600);
    if (el) fx.callout(V.anchor?.(el, info) ?? el, `<b>《${esc(info.title)}》触发</b>${op.text ?? ''}`, { side: V.calloutSide ?? 'auto', cls: info.cls, life: 2100 });
    await fx.wait(650);
  }

  async function plainLeave(V, info, end) {
    const el = V.el(info.id);
    if (!el) return null;
    const st = fx.stamp(V.stampHost?.(el) ?? el, end.word, end.why);
    el.classList.add('pe-ending');
    fx.callout(V.anchor?.(el, info) ?? el, `<b>${end.say}</b>${esc(info.fate.text)}`, { side: V.calloutSide ?? 'auto', cls: `ending ${info.cls}`, life: 2000 });
    await fx.wait(1150);
    const from = cardRect(V, el, info);
    st.remove();
    return from;
  }

  const SHOW = {
    async play(op) {
      const mine = op.by === 0;
      const src = mine ? hudRoot.querySelector(`.hd-card .slot[data-no="${op.card}"]`)?.getBoundingClientRect() : null;
      apply(op);
      render.hud();
      if (src?.width) fx.flyCard(op.card, src, fx.cardRectAt(part('table')), { duration: 430 });
      await fx.wait(420);
      await fx.callout(part('table'), `<b>${mine ? '你' : '对手'}</b>打出事件《${esc(byNo[op.card].title)}》`, { side: 'right', cls: mine ? 'is-a' : 'is-b', life: 1300 });
    },
    async enter(op) {
      const V = variant();
      const from = fx.cardRectAt(part('table'));
      apply(op);
      render.hud();
      const info = infoOf(op.fx);
      if (V.enter) await V.enter(info, from);
      else await plainEnter(V, info, from);
      V.sync(infos(), {});
    },
    async resolve(op) {
      apply(op);
      render.hud();
      await fx.wait(650);
    },
    async fire(op) {
      const V = variant();
      const info = infoOf(op.fx);
      if (V.fire) await V.fire(info, op);
      else await plainFire(V, info, op);
      if (op.pop) pop(op.pop.country, op.pop.html, op.pop.cls);
      apply(op);
      render.all();
      await fx.wait(1250);
    },
    async end(op) {
      const V = variant();
      const info = infoOf(op.fx);
      const end = {
        why: op.why,
        word: whyWord(op.why),
        say: op.why === 'cancel' ? `被《${esc(byNo[op.by].title)}》取消` : op.why === 'cond' ? '条件达成，事件终止' : '期满',
        pile: part(info.fate.pile),
      };
      const from = V.leave ? await V.leave(info, end) : await plainLeave(V, info, end);
      S.effects.splice(S.effects.findIndex((e) => e.id === op.fx), 1);
      V.sync(infos(), { leaving: info.id });
      await fx.flyCard(info.no, from, fx.cardRectAt(end.pile), { duration: 640, arc: 20 });
      S.hud[info.fate.pile].push(info.no);
      render.hud();
      fx.pulse(end.pile?.closest('.hp'), 'pe-took', 900);
      await fx.wait(380);
    },
    async set(op) {
      if (op.text) fx.callout(target(op.at), op.text, { cls: 'plain', life: 1500 });
      if (op.pop) pop(op.pop.country, op.pop.html, op.pop.cls);
      apply(op);
      render.all();
      await fx.wait(op.text ? 1100 : 500);
    },
    async say(op) {
      await fx.callout(target(op.at), op.text, { cls: 'plain', life: 1000 });
    },
  };

  /** Carries a step out at once, with nothing shown. */
  function apply(op) {
    if (op.op === 'play') {
      if (op.by === 0) S.hud.hand = S.hud.hand.filter((no) => no !== op.card);
      else S.hud.opponentHand -= 1;
      S.hud.played = { card: op.card, by: op.by };
    } else if (op.op === 'enter') {
      S.effects.push(live(op.fx, S.hud.round));
      S.hud.played = null;
    } else if (op.op === 'resolve') {
      const no = S.hud.played?.card;
      if (no) S.hud[pileOf(no)].push(no);
      S.hud.played = null;
    } else if (op.op === 'end') {
      const i = S.effects.findIndex((e) => e.id === op.fx);
      if (i >= 0) {
        const [e] = S.effects.splice(i, 1);
        S.hud[pileOf(e.card)].push(e.card);
      }
    } else {
      if (op.op === 'fire') S.find(op.fx)?.fired.push(S.hud.round);
      op.patch?.(S);
    }
  }

  return {
    part, plate, node, infos, infoOf, pop,
    /** Plays one beat, step by step. */
    async play(beat) {
      detail.enable(false);
      try {
        for (const op of beat.ops) await SHOW[op.op](op);
      } finally {
        detail.enable(true);
      }
    },
    /** Carries a beat out without showing it. */
    skip(beat) {
      for (const op of beat.ops) apply(op);
    },
  };
}
