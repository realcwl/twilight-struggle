// What is in force, and the one made-up stretch of a turn the ten displays are compared on.
//
// An effect in force is a played event whose card has not gone to its pile yet:
//
//   card    the card it came from (its `once` decides the pile it ends on)
//   by      who played it: 0 the player, 1 the opponent
//   line    what it does, in one line (the card carries the full wording)
//   scope   what it touches: countries, a region, a meter of the HUD, a hand
//   until   what ends it: { kind: 'turn' } | { kind: 'rounds', n } | { kind: 'card', card } | { kind: 'cond', text, short }
//
// Nothing here is a rules engine. The beats below are a script: each one is a list of steps that
// the stage plays one after another (see stage.js), so every display is seen taking in a card,
// holding it, reacting when it fires and letting it go.
import { byNo } from '../../hud-layouts/state.js';

export const DEFS = {
  brat: { card: '041', by: 1, line: '美国事件不能移除欧洲的苏联影响力', scope: { region: 'europe' }, until: { kind: 'turn' } },
  panmunjom: { card: '014', by: 1, line: '双方都不能在朝鲜、韩国增加影响力', scope: { countries: ['prk', 'kor'] }, until: { kind: 'turn' } },
  hallstein: { card: 'S01', by: 0, line: '苏联每控制一个欧洲国家，美国获得 1 声望', scope: { region: 'europe', meter: 'score' }, until: { kind: 'card', card: 'S02' } },
  moratorium: { card: 'S03', by: 1, line: '紧张度不能上升', scope: { meter: 'crisis' }, until: { kind: 'cond', text: '任一方发动政变', short: '政变即止' } },
  peace: { card: 'S04', by: 0, line: '每轮结束：在一个无人涉足的非洲国家增加 1 点美国影响力', scope: { region: 'africa', meter: 'rounds' }, until: { kind: 'rounds', n: 3 } },
  papers: { card: 'S05', by: 1, line: '美国的手牌对苏联公开', scope: { hand: 0 }, until: { kind: 'turn' } },
};

/** In force when the page opens, oldest first. */
export const INITIAL = ['brat', 'panmunjom', 'hallstein', 'moratorium'];

export const SIDE_NAME = { us: '美国', ussr: '苏联', neutral: '中立' };
export const SIDE_SHORT = { us: '美', ussr: '苏', neutral: '中' };
const WHY = { cancel: '取消', expire: '期满', cond: '终止' };

const hl = (s) => window.CardZh.highlight(s);
const title = (no) => `《${byNo[no].title}》`;

/**
 * A live effect: the definition plus what changes while it stands. `since` is the action round of
 * this turn it began in (null: it was already in force when the turn began); `fired` lists the
 * rounds it did something in.
 */
export const live = (id, since = null) => ({ id, ...DEFS[id], left: DEFS[id].until.kind === 'rounds' ? DEFS[id].until.n : null, since, fired: [] });

/** Everything a display needs to draw one effect. `scenario` resolves a region to its countries. */
export function describe(e, scenario) {
  const card = byNo[e.card];
  const u = e.until;
  const until =
    u.kind === 'turn' ? { kind: u.kind, short: '本回合', long: '至本回合结束' }
    : u.kind === 'rounds' ? { kind: u.kind, short: `${e.left} 轮`, long: `还剩 ${e.left} 个行动轮`, n: e.left, of: u.n }
    : u.kind === 'card' ? { kind: u.kind, short: title(u.card), long: `直到${title(u.card)}被打出`, card: u.card }
    : { kind: u.kind, short: u.short, long: `直到${u.text}` };
  const places = e.scope.countries ?? (e.scope.region ? scenario.countries.filter((c) => c.region === e.scope.region).map((c) => c.id) : []);
  const region = e.scope.region ? scenario.regions.find((r) => r.id === e.scope.region) : null;
  return {
    id: e.id,
    no: e.card,
    card,
    title: card.title,
    side: card.side,
    /** is-a the player's colour, is-b the opponent's, is-n a neutral card */
    cls: card.side === 'us' ? 'is-a' : card.side === 'ussr' ? 'is-b' : 'is-n',
    by: e.by,
    mine: e.by === 0,
    since: e.since,
    fired: e.fired,
    who: `${SIDE_NAME[card.side]}事件 · ${e.by === 0 ? '你打出' : '对手打出'}`,
    line: e.line,
    lineHTML: hl(e.line),
    until,
    untilHTML: hl(until.long),
    fate: card.once ? { pile: 'removed', text: '移出游戏' } : { pile: 'discard', text: '进入弃牌堆' },
    places,
    region: region ? { id: region.id, name: region.name.zh } : null,
    where: region ? region.name.zh : places.length ? places.map((id) => scenario.countries.find((c) => c.id === id).name.zh).join('、') : e.scope.meter === 'crisis' ? '紧张度' : e.scope.hand !== undefined ? '你的手牌' : '全局',
    /** which corner of the HUD owns what it is about: time, score, cards or threat */
    home: e.scope.meter === 'crisis' || e.scope.meter === 'milops' ? 'br' : e.scope.meter === 'score' || e.scope.meter === 'space' ? 'tr' : e.scope.meter === 'rounds' ? 'tl' : 'bl',
    countries: e.scope.countries ?? null,
    meter: e.scope.meter ?? null,
    hand: e.scope.hand ?? null,
  };
}

export const whyWord = (why) => WHY[why];

/** The hand the page opens with; S04 is the lasting event the player can drag out. */
export const HAND = ['012', 'S04', '020', '036', '047', '031', '028', '016'];

/**
 * The script. `pick` chooses the countries it needs from the map state the page starts with, so it
 * keeps working whatever the filler situation is.
 */
export function makeBeats({ scenario, mapState }) {
  const free = scenario.countries.filter((c) => c.region === 'africa' && mapState.countries[c.id].influence[0] === 0 && mapState.countries[c.id].influence[1] === 0).map((c) => c.id);
  const africa = [free[0] ?? 'bwa', free[1] ?? 'cmr', free[2] ?? 'tun'];
  const coupAt = (scenario.countries.find((c) => c.region === 'samerica' && !c.key && mapState.countries[c.id].influence[0] > 0) ?? scenario.countries.find((c) => c.id === 'per')).id;
  const name = (id) => scenario.countries.find((c) => c.id === id).name.zh;

  const fire = (i) => ({
    op: 'fire', fx: 'peace', at: { country: africa[i] }, text: `在${name(africa[i])}增加 <b>1</b> 点美国影响力`,
    patch: (S) => { S.addInfluence(africa[i], 0, 1); S.find('peace').left -= 1; },
    pop: { country: africa[i], html: '+1', cls: 'a' },
  });

  return [
    { key: 'enter-mine', title: '你打出《和平队》', hint: '也可以直接把它从手牌里拖出来', ops: [{ op: 'play', card: 'S04', by: 0 }, { op: 'enter', fx: 'peace' }] },
    { key: 'enter-theirs', title: '对手打出《五角大楼文件》', ops: [{ op: 'play', card: 'S05', by: 1 }, { op: 'enter', fx: 'papers' }] },
    {
      key: 'fire', title: '行动轮结束 ·《和平队》触发',
      ops: [{ op: 'say', at: 'rounds', text: '行动轮 3 结束' }, fire(0), { op: 'set', patch: (S) => { S.hud.round = 4; } }],
    },
    {
      key: 'cancel', title: '对手打出《东方政策》· 取消《哈尔斯坦主义》',
      ops: [
        { op: 'play', card: 'S02', by: 1 },
        { op: 'end', fx: 'hallstein', why: 'cancel', by: 'S02' },
        { op: 'set', at: 'crisis', text: '紧张度下降 1', patch: (S) => { S.hud.crisis = Math.min(5, S.hud.crisis + 1); } },
        { op: 'resolve' },
      ],
    },
    {
      key: 'cond', title: '对手发动政变 ·《暂停核试验》终止',
      ops: [
        { op: 'set', at: { country: coupAt }, text: `苏联在${name(coupAt)}政变`, pop: { country: coupAt, html: '政变', cls: 'b' }, patch: (S) => { S.setInfluence(coupAt, [0, 2]); S.hud.milops = [S.hud.milops[0], Math.min(5, S.hud.milops[1] + 2)]; } },
        { op: 'end', fx: 'moratorium', why: 'cond' },
        { op: 'set', at: 'crisis', text: '紧张度上升 1', patch: (S) => { S.hud.crisis = Math.max(1, S.hud.crisis - 1); } },
      ],
    },
    {
      key: 'countdown', title: '又过两个行动轮 ·《和平队》期满',
      ops: [
        { op: 'say', at: 'rounds', text: '行动轮 4 结束' }, fire(1), { op: 'set', patch: (S) => { S.hud.round = 5; } },
        { op: 'say', at: 'rounds', text: '行动轮 5 结束' }, fire(2), { op: 'end', fx: 'peace', why: 'expire' }, { op: 'set', patch: (S) => { S.hud.round = 6; } },
      ],
    },
    {
      key: 'turn-end', title: '回合结束 · 到期的事件离场',
      ops: [
        { op: 'set', patch: (S) => { S.hud.round = 7; } },
        { op: 'say', at: 'dial', text: '第 4 回合结束' },
        { op: 'end', fx: 'brat', why: 'expire' },
        { op: 'end', fx: 'panmunjom', why: 'expire' },
        { op: 'end', fx: 'papers', why: 'expire' },
        { op: 'set', patch: (S) => { S.hud.turn = 5; S.hud.round = 1; S.hud.milops = [0, 0]; } },
      ],
    },
  ];
}
