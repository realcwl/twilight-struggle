import { translateDictionary } from '../i18n/index.js';
import type { Lang, RegionStanding } from './types';

export type HudStrings = {
  turn: string;
  round: string;
  yourMove: string;
  yourHint: string;
  theirMove: (side: string) => string;
  theirHint: string;
  vp: string;
  level: string;
  leads: (side: string) => string;
  winsAt: (side: string, n: number) => string;
  space: string;
  onPad: string;
  crisis: string;
  milops: string;
  required: string;
  met: string;
  short: (n: number) => string;
  deck: string;
  candidatesTitle: string;
  candidatesHint: string;
  candidatesCount: (n: number) => string;
  candidatesEmpty: string;
  discard: string;
  removed: string;
  table: string;
  playedBy: (side: string) => string;
  dropHint: string;
  opponentHand: string;
  /** Why a card that is held but not yet usable cannot be played. */
  heldCard: string;
  viewPile: (pile: string) => string;
  allCards: string;
  viewAllCards: string;
  cardCount: (n: number) => string;
  emptyPile: string;
  close: string;
  demoNext: (what: string) => string;
  /** Label of a region's three values. */
  scores: string;
  standing: Record<RegionStanding, string>;
  /** In place of a number, where holding a region ends the game. */
  wins: string;
  /** What follows the number of countries a side controls in a region. */
  holds: string;
  holdsKeys: (n: number, of: number) => string;
};

export const HUD_STRINGS: Record<Lang, HudStrings> = {
  zh: {
    turn: '回合',
    round: '行动轮',
    yourMove: '你的行动轮',
    yourHint: '从手牌拖出一张牌',
    theirMove: (side) => `${side}行动中`,
    theirHint: '等待对手出牌…',
    vp: '胜利点',
    level: '均势',
    leads: (side) => `${side}领先`,
    winsAt: (side, n) => `${side}到 ${n} 分即胜`,
    space: '太空竞赛',
    onPad: '待发射',
    crisis: '核危机',
    milops: '军事行动',
    required: '本回合需',
    met: '达标',
    short: (n) => `差 ${n}`,
    deck: '未发牌',
    candidatesTitle: '对手可能有的牌',
    candidatesHint: '已排除你的手牌和场上、弃牌堆、废牌堆中的牌。剩余卡牌可能在对手手中或牌库；洗回的牌会重新列入。',
    candidatesCount: (n) => `${n} 张候选`,
    candidatesEmpty: '当前没有候选牌。',
    discard: '弃牌堆',
    removed: '废牌堆',
    table: '本轮出牌',
    playedBy: (side) => `${side}打出`,
    dropHint: '拖到地图上\n松手打出',
    opponentHand: '对手手牌',
    heldCard: '下回合才能使用',
    viewPile: (pile) => `${pile} · 点击查看`,
    allCards: '全部卡牌',
    viewAllCards: '查看全部卡牌',
    cardCount: (n) => `${n} 张 · 最近的在前`,
    emptyPile: '这里还没有牌。',
    close: '关闭',
    demoNext: (what) => `${what} · 点击看下一个状态（演示）`,
    scores: '计分',
    standing: { none: '无', presence: '存在', domination: '支配', control: '控制' },
    wins: '获胜',
    holds: '国',
    holdsKeys: (n, of) => `控制 ${of} 个战场国中的 ${n} 个`,
  },
  en: {
    turn: 'Turn',
    round: 'Action round',
    yourMove: 'Your action round',
    yourHint: 'Drag a card out of your hand',
    theirMove: (side) => `${side} to move`,
    theirHint: 'Waiting for the opponent…',
    vp: 'Victory points',
    level: 'Level',
    leads: (side) => `${side} leads`,
    winsAt: (side, n) => `${side} wins at ${n}`,
    space: 'Space race',
    onPad: 'On the pad',
    crisis: 'Nuclear crisis',
    milops: 'Military ops',
    required: 'Needed this turn',
    met: 'Met',
    short: (n) => `${n} short`,
    deck: 'Undealt',
    candidatesTitle: 'Opponent candidates',
    candidatesHint: 'Excludes your hand and cards in play, discarded or removed. These cards may be in the opponent’s hand or draw pile; recycled cards return to this list.',
    candidatesCount: (n) => `${n} candidates`,
    candidatesEmpty: 'No candidate cards remain.',
    discard: 'Discard',
    removed: 'Removed',
    table: 'Table',
    playedBy: (side) => `by ${side}`,
    dropHint: 'Drag onto the map\nand let go to play',
    opponentHand: "Opponent's hand",
    heldCard: 'Usable from next turn',
    viewPile: (pile) => `${pile} · click to look through`,
    allCards: 'All cards',
    viewAllCards: 'Look through every card',
    cardCount: (n) => `${n} cards · newest first`,
    emptyPile: 'No cards here yet.',
    close: 'Close',
    demoNext: (what) => `${what} · click for its next state (demo)`,
    scores: 'Scores',
    standing: { none: 'None', presence: 'Presence', domination: 'Domination', control: 'Control' },
    wins: 'wins',
    holds: 'held',
    holdsKeys: (n, of) => `Controls ${n} of ${of} battlegrounds`,
  },
 es: translateDictionary({
    turn: '回合',
    round: '行动轮',
    yourMove: '你的行动轮',
    yourHint: '从手牌拖出一张牌',
    theirMove: (side) => `${side}行动中`,
    theirHint: '等待对手出牌…',
    vp: '胜利点',
    level: '均势',
    leads: (side) => `${side}领先`,
    winsAt: (side, n) => `${side}到 ${n} 分即胜`,
    space: '太空竞赛',
    onPad: '待发射',
    crisis: '核危机',
    milops: '军事行动',
    required: '本回合需',
    met: '达标',
    short: (n) => `差 ${n}`,
    deck: '未发牌',
    candidatesTitle: '对手可能有的牌',
    candidatesHint: '已排除你的手牌和场上、弃牌堆、废牌堆中的牌。剩余卡牌可能在对手手中或牌库；洗回的牌会重新列入。',
    candidatesCount: (n) => `${n} 张候选`,
    candidatesEmpty: '当前没有候选牌。',
    discard: '弃牌堆',
    removed: '废牌堆',
    table: '本轮出牌',
    playedBy: (side) => `${side}打出`,
    dropHint: '拖到地图上\n松手打出',
    opponentHand: '对手手牌',
    heldCard: '下回合才能使用',
    viewPile: (pile) => `${pile} · 点击查看`,
    allCards: '全部卡牌',
    viewAllCards: '查看全部卡牌',
    cardCount: (n) => `${n} 张 · 最近的在前`,
    emptyPile: '这里还没有牌。',
    close: '关闭',
    demoNext: (what) => `${what} · 点击看下一个状态（演示）`,
    scores: '计分',
    standing: { none: '无', presence: '存在', domination: '支配', control: '控制' },
    wins: '获胜',
    holds: '国',
    holdsKeys: (n, of) => `控制 ${of} 个战场国中的 ${n} 个`,
  }, 'es') };
