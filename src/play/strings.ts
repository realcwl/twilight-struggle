import { translateDictionary } from '../i18n/index.js';
// Every word the spotlight staging shows, in both of the page's languages. The names of the two
// sides, of countries and of cards are not here: they come from the game.
import type { Lang } from '../map/types';
import type { Verb } from './types';

export type PlayStrings = {
  verb: Record<Verb, string>;
  you: string;
  /** A card's title as it is quoted in a sentence. */
  cardName(title: string): string;
  /** Who, then what they did: "美国在战场国安哥拉政变". */
  join(who: string, what: string): string;

  // phases
  turnNo(n: number): string;
  headlinePhase: string;
  headlineRule: string;
  headlinePrompt: string;
  roundNo(n: number): string;
  yourMove: string;
  theirMove(side: string): string;
  playPrompt: string;
  war: string;
  warSmall: string;

  // headline
  first: string;
  second: string;
  headlineOf(side: string): string;
  headlineEvent: string;

  // the two halves and the four bands
  kickEither: string;
  kickOr: string;
  kickForced: string;
  theirEvent(side: string): string;
  theirFoot: string;
  once: string;
  reusable: string;
  back: string;
  ops: string;
  points: string;
  opsFoot: string;
  bandsKick(points: number): string;
  placeSub(points: number, countries: number): string;
  realignSub(rolls: number, countries: number): string;
  coupSub(countries: number): string;
  coupRisk: string;
  spaceSub(max: number): string;
  safe: string;
  firesAfter(side: string): string;
  noPlace: string;

  // a card is played
  theyPlay(side: string): string;
  opsLine(points: number, verb: string): string;
  cardOps(title: string, points: number): string;
  spaceDetail: string;
  sideEvent(side: string): string;

  // placing influence
  placeMain(left: number): string;
  placeHint: string;
  placeStuck: string;
  placeDone: string;
  undo: string;
  takeBack: string;
  done: string;
  controls(side: string): string;
  breaks: string;

  // choosing a country
  eventNth(title: string, i: number, n: number): string;
  realignMain(left: number): string;
  coupMain: string;
  coupHint: string;
  realignHint: string;
  stop: string;
  needRoll(need: number, percent: number): string;
  impossible: string;
  keyCrisis(from: number, to: number): string;
  realignDice(mine: number, side: string, theirs: number): string;

  // dice
  spaceNeed(max: number, percent: number): string;
  realignRule: string;
  noMods: string;
  versus: string;
  opsPoints: string;
  needs: string;

  // consequences
  influence(side: string): string;
  nobody: string;
  crisis: string;
  milops(side: string): string;
  vp: string;
  spaceTo(step: number): string;
  fires(side: string): string;
  firesSmall: string;
};

export const PLAY_STRINGS: Record<Lang, PlayStrings> = {
  zh: {
    verb: { place: '放置影响力', realign: '调整阵营', coup: '政变', space: '太空竞赛', event: '事件' },
    you: '你',
    cardName: (title) => `《${title}》`,
    join: (who, what) => `${who}${what}`,

    turnNo: (n) => `第 ${n} 回合`,
    headlinePhase: '头条阶段',
    headlineRule: '双方各暗出一张牌 · 同时翻开 · 都作为事件发生',
    headlinePrompt: '把一张牌拖出手牌，松手就打出 · 它会作为事件发生',
    roundNo: (n) => `第 ${n} 行动轮`,
    yourMove: '你的行动',
    theirMove: (side) => `${side}行动`,
    playPrompt: '打出一张牌 · 把它从手牌里拖出来',
    war: '核战爆发',
    warSmall: '核危机降到了 1 级 · 按 R 重来',

    first: '先结算',
    second: '后结算',
    headlineOf: (side) => `${side}的头条事件`,
    headlineEvent: '头条事件',

    kickEither: '其一',
    kickOr: '其二',
    kickForced: '躲不开',
    theirEvent: (side) => `${side}的事件`,
    theirFoot: '用这张牌行动，事件照样发生。只有太空竞赛能躲开。',
    once: '一次性：之后移出游戏',
    reusable: '之后进弃牌堆',
    back: '收回',
    ops: '行动',
    points: '点',
    opsFoot: '放置影响力 · 调整阵营 · 政变 · 太空竞赛',
    bandsKick: (points) => `行动 · ${points} 点 · 四选一`,
    placeSub: (points, countries) => `${points} 点 · ${countries} 国可放`,
    realignSub: (rolls, countries) => `掷 ${rolls} 次 · ${countries} 国可选`,
    coupSub: (countries) => `${countries} 国可选`,
    coupRisk: '战场国会让核危机降一级',
    spaceSub: (max) => `弃掉这张牌 · 掷出 1–${max} 前进`,
    safe: '不触发对手事件',
    firesAfter: (side) => `之后${side}事件照样发生`,
    noPlace: '没有可以放置的国家',

    theyPlay: (side) => `${side}打出`,
    opsLine: (points, verb) => `行动 ${points} 点 · ${verb}`,
    cardOps: (title, points) => `《${title}》 · 行动 ${points} 点`,
    spaceDetail: '弃一张牌，掷骰前进',
    sideEvent: (side) => `${side} · 事件`,

    placeMain: (left) => `放置影响力 · 还剩 ${left} 点`,
    placeHint: '点亮着的国家，每下放 1 点 · 标着 ×2 的是对手控制的国家，要花 2 点',
    placeStuck: '剩下的点数不够放在任何地方',
    placeDone: '点数用完了：确认，或撤销重放',
    undo: '撤销',
    takeBack: '收回这张牌',
    done: '完成',
    controls: (side) => `${side}控制`,
    breaks: '打破控制',

    eventNth: (title, i, n) => `《${title}》 · 第 ${i} / ${n} 个`,
    realignMain: (left) => `调整阵营 · 还能掷 ${left} 次`,
    coupMain: '政变 · 选一个国家',
    coupHint: '亮着的国家有对手的影响力 · 脚下的数字是成功所需的点数',
    realignHint: '亮着的国家有对手的影响力 · 脚下的数字是你的骰子比对手多加几点',
    stop: '到此为止',
    needRoll: (need, percent) => `掷出 ≥${need} 成功 · ${percent}%`,
    impossible: '这张牌的点数不够，不可能成功',
    keyCrisis: (from, to) => `战场国：核危机 ${from} → ${to}`,
    realignDice: (mine, side, theirs) => `你的骰子 +${mine} · ${side}的骰子 +${theirs}`,

    spaceNeed: (max, percent) => `掷出 1–${max} 成功 · ${percent}%`,
    realignRule: '点数高的一方胜出 · 输家移除差额的影响力',
    noMods: '无加值',
    versus: '对',
    opsPoints: '行动点',
    needs: '要',

    influence: (side) => `${side}影响力`,
    nobody: '无人控制',
    crisis: '核危机',
    milops: (side) => `${side}军事行动`,
    vp: '胜利点',
    spaceTo: (step) => `第 ${step} 步`,
    fires: (side) => `${side}事件触发`,
    firesSmall: '你用了对手的牌行动：它的事件现在发生',
  },
  en: {
    verb: { place: 'Place influence', realign: 'Realign', coup: 'Coup', space: 'Space race', event: 'Event' },
    you: 'You',
    cardName: (title) => `“${title}”`,
    join: (who, what) => [who, what].filter(Boolean).join(' · '),

    turnNo: (n) => `Turn ${n}`,
    headlinePhase: 'Headline',
    headlineRule: 'Each side plays one card face down · both are turned over together · both happen as events',
    headlinePrompt: 'Drag a card onto the map to play its event',
    roundNo: (n) => `Action round ${n}`,
    yourMove: 'Your move',
    theirMove: (side) => `${side} to move`,
    playPrompt: 'Play a card · drag it out of your hand',
    war: 'Nuclear war',
    warSmall: 'The crisis level reached 1 · press R to start again',

    first: 'Resolves first',
    second: 'Resolves second',
    headlineOf: (side) => `${side} headline event`,
    headlineEvent: 'headline event',

    kickEither: 'Either',
    kickOr: 'Or',
    kickForced: 'No way round',
    theirEvent: (side) => `${side} event`,
    theirFoot: 'Use this card for operations and its event happens all the same. Only the space race avoids it.',
    once: 'One use: removed from the game afterwards',
    reusable: 'Goes to the discard pile afterwards',
    back: 'Take it back',
    ops: 'Operations',
    points: 'points',
    opsFoot: 'Place influence · Realign · Coup · Space race',
    bandsKick: (points) => `Operations · ${points} points · one of four`,
    placeSub: (points, countries) => `${points} points · ${countries} countries open`,
    realignSub: (rolls, countries) => `${rolls} rolls · ${countries} countries`,
    coupSub: (countries) => `${countries} countries`,
    coupRisk: 'A battleground lowers the crisis level by one',
    spaceSub: (max) => `Discard this card · roll 1–${max} to advance`,
    safe: 'Does not set off the opponent’s event',
    firesAfter: (side) => `The ${side} event still happens afterwards`,
    noPlace: 'Nowhere to place',

    theyPlay: (side) => `${side} plays`,
    opsLine: (points, verb) => `${points} operations points · ${verb}`,
    cardOps: (title, points) => `“${title}” · ${points} operations points`,
    spaceDetail: 'discard a card, roll to advance',
    sideEvent: (side) => `${side} · event`,

    placeMain: (left) => `Place influence · ${left} left`,
    placeHint: 'Click a lit country to place 1 · those marked ×2 are controlled by the opponent and cost 2',
    placeStuck: 'What is left cannot pay for any country',
    placeDone: 'All points spent: confirm, or undo and place again',
    undo: 'Undo',
    takeBack: 'Take the card back',
    done: 'Done',
    controls: (side) => `${side} controls`,
    breaks: 'Control broken',

    eventNth: (title, i, n) => `“${title}” · ${i} of ${n}`,
    realignMain: (left) => `Realign · ${left} rolls left`,
    coupMain: 'Coup · choose a country',
    coupHint: 'Lit countries hold enemy influence · the number under each is the roll it takes',
    realignHint: 'Lit countries hold enemy influence · the number under each is your edge on the dice',
    stop: 'Stop here',
    needRoll: (need, percent) => `Roll ${need} or more · ${percent}%`,
    impossible: 'This card is too weak to succeed here',
    keyCrisis: (from, to) => `Battleground: crisis ${from} → ${to}`,
    realignDice: (mine, side, theirs) => `Your die +${mine} · ${side} die +${theirs}`,

    spaceNeed: (max, percent) => `Roll 1–${max} to succeed · ${percent}%`,
    realignRule: 'The higher total wins · the loser removes the difference in influence',
    noMods: 'no modifiers',
    versus: 'vs',
    opsPoints: 'operations',
    needs: 'needs',

    influence: (side) => `${side} influence`,
    nobody: 'no one controls',
    crisis: 'Crisis level',
    milops: (side) => `${side} military operations`,
    vp: 'Victory points',
    spaceTo: (step) => `step ${step}`,
    fires: (side) => `${side} event goes off`,
    firesSmall: 'You used the opponent’s card for operations: its event happens now',
  },
 es: translateDictionary({
    verb: { place: '放置影响力', realign: '调整阵营', coup: '政变', space: '太空竞赛', event: '事件' },
    you: '你',
    cardName: (title) => `《${title}》`,
    join: (who, what) => `${who}${what}`,

    turnNo: (n) => `第 ${n} 回合`,
    headlinePhase: '头条阶段',
    headlineRule: '双方各暗出一张牌 · 同时翻开 · 都作为事件发生',
    headlinePrompt: '把一张牌拖出手牌，松手就打出 · 它会作为事件发生',
    roundNo: (n) => `第 ${n} 行动轮`,
    yourMove: '你的行动',
    theirMove: (side) => `${side}行动`,
    playPrompt: '打出一张牌 · 把它从手牌里拖出来',
    war: '核战爆发',
    warSmall: '核危机降到了 1 级 · 按 R 重来',

    first: '先结算',
    second: '后结算',
    headlineOf: (side) => `${side}的头条事件`,
    headlineEvent: '头条事件',

    kickEither: '其一',
    kickOr: '其二',
    kickForced: '躲不开',
    theirEvent: (side) => `${side}的事件`,
    theirFoot: '用这张牌行动，事件照样发生。只有太空竞赛能躲开。',
    once: '一次性：之后移出游戏',
    reusable: '之后进弃牌堆',
    back: '收回',
    ops: '行动',
    points: '点',
    opsFoot: '放置影响力 · 调整阵营 · 政变 · 太空竞赛',
    bandsKick: (points) => `行动 · ${points} 点 · 四选一`,
    placeSub: (points, countries) => `${points} 点 · ${countries} 国可放`,
    realignSub: (rolls, countries) => `掷 ${rolls} 次 · ${countries} 国可选`,
    coupSub: (countries) => `${countries} 国可选`,
    coupRisk: '战场国会让核危机降一级',
    spaceSub: (max) => `弃掉这张牌 · 掷出 1–${max} 前进`,
    safe: '不触发对手事件',
    firesAfter: (side) => `之后${side}事件照样发生`,
    noPlace: '没有可以放置的国家',

    theyPlay: (side) => `${side}打出`,
    opsLine: (points, verb) => `行动 ${points} 点 · ${verb}`,
    cardOps: (title, points) => `《${title}》 · 行动 ${points} 点`,
    spaceDetail: '弃一张牌，掷骰前进',
    sideEvent: (side) => `${side} · 事件`,

    placeMain: (left) => `放置影响力 · 还剩 ${left} 点`,
    placeHint: '点亮着的国家，每下放 1 点 · 标着 ×2 的是对手控制的国家，要花 2 点',
    placeStuck: '剩下的点数不够放在任何地方',
    placeDone: '点数用完了：确认，或撤销重放',
    undo: '撤销',
    takeBack: '收回这张牌',
    done: '完成',
    controls: (side) => `${side}控制`,
    breaks: '打破控制',

    eventNth: (title, i, n) => `《${title}》 · 第 ${i} / ${n} 个`,
    realignMain: (left) => `调整阵营 · 还能掷 ${left} 次`,
    coupMain: '政变 · 选一个国家',
    coupHint: '亮着的国家有对手的影响力 · 脚下的数字是成功所需的点数',
    realignHint: '亮着的国家有对手的影响力 · 脚下的数字是你的骰子比对手多加几点',
    stop: '到此为止',
    needRoll: (need, percent) => `掷出 ≥${need} 成功 · ${percent}%`,
    impossible: '这张牌的点数不够，不可能成功',
    keyCrisis: (from, to) => `战场国：核危机 ${from} → ${to}`,
    realignDice: (mine, side, theirs) => `你的骰子 +${mine} · ${side}的骰子 +${theirs}`,

    spaceNeed: (max, percent) => `掷出 1–${max} 成功 · ${percent}%`,
    realignRule: '点数高的一方胜出 · 输家移除差额的影响力',
    noMods: '无加值',
    versus: '对',
    opsPoints: '行动点',
    needs: '要',

    influence: (side) => `${side}影响力`,
    nobody: '无人控制',
    crisis: '核危机',
    milops: (side) => `${side}军事行动`,
    vp: '胜利点',
    spaceTo: (step) => `第 ${step} 步`,
    fires: (side) => `${side}事件触发`,
    firesSmall: '你用了对手的牌行动：它的事件现在发生',
  }, 'es') };
