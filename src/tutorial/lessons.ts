import { t as i18n } from '../i18n/index.js';
import type { CoachStep } from './coach';
export type Lesson = CoachStep & { countries?: string[]; status?: boolean };
const media = (name: string) => `${import.meta.env.BASE_URL}cards/help/${name}.mp4`;
export { media };

/** Original Chinese teaching copy. Mechanics are shared with the live rules engine. */
export const INTRO: Lesson[] = [
  { id:'welcome', chapter:i18n("01 · 认识棋盘"), title:i18n("先学会赢，再开始出牌"), icon:'★',
    body:i18n("你扮演美国，电脑扮演苏联。跟随指引完成第 1 回合，学习出牌、行动与计分。双方各有 6 个行动轮。"), button:i18n("开始认识胜利条件"), targets:['.hud-tl','.hud-tr'] },
  { id:'victory', chapter:i18n("01 · 认识棋盘"), title:i18n("胜利点是一场拔河"), icon:'★', status:true, video:media('vp'), targets:['[data-part="scoreRead"]','[data-part="scoreRule"]'],
    body:i18n("双方共用一条胜利点轨，得分时标记向己方移动。任一方先达到 20 VP，立即获胜。胜利点主要来自地区计分、事件与太空竞赛。") },
  { id:'other-wins', chapter:i18n("01 · 认识棋盘"), title:i18n("胜负如何决定"), icon:'⚑', status:true, targets:['[data-part="scoreRule"]'],
    body:i18n("任一方先达到 20 VP，立即获胜。\n欧洲计分时达到地区“控制”，立即获胜。\n若此前未分胜负，第 10 回合结束后进行最终地区计分，VP 领先的一方获胜。") },
  { id:'layout', chapter:i18n("01 · 认识棋盘"), title:i18n("看懂你面前的桌面"), icon:'◎', targets:['.hud-tl','.hud-tr','.hd-card','.op'],
    body:i18n("左上是回合与行动轮；右上是胜利点、太空、核危机和军事行动。下方是你的手牌，上方只显示对手的手牌数量。地图上的连线表示游戏中的相邻关系，不能只看地理距离。") },
  { id:'control', chapter:i18n("01 · 认识棋盘"), title:i18n("有影响力，不等于控制"), icon:'＋', countries:['frg','gdr','fra'], video:media('control'), targets:['.wm-plate[data-id="frg"]','.wm-plate[data-id="gdr"]'],
    body:i18n("国家圆圈里的数是稳定度，蓝红两格是美苏影响力。影响力差至少等于稳定度，才算控制。例如稳定度 4 的西德：美国 4、苏联 0，美国控制；若苏联加 1，美国仍有影响力，但会失去控制。") },
  { id:'battleground', chapter:i18n("01 · 认识棋盘"), title:i18n("金边和枪支，标出战场国"), icon:'⚑', countries:['ita','fra','esp'], video:media('battleground'), targets:['.wm-plate[data-id="ita"]','.wm-plate[data-id="esp"]'],
    body:i18n("战场国决定地区优势，并在计分时提供额外 VP；非战场国仍计入国家总数，取得“支配”也至少需要控制一个。战场国政变还会降低 DEFCON。国家的区域色标告诉你它在哪个计分区。") },
  { id:'cards', chapter:i18n("02 · 认识手牌"), title:i18n("一张牌，两种主要用途"), icon:'▤', video:media('operations'), targets:['.hd-card'],
    body:i18n("左上数字是行动点。可以执行牌上的事件，或把行动点用于放置影响力、政变、调整阵营；也可以满足条件后用于太空竞赛。牌框颜色表示事件属于谁，不表示谁能拿到或打出这张牌。") },
  { id:'turns', chapter:i18n("02 · 认识手牌"), title:i18n("回合里面，还有行动轮"), icon:'↻', video:media('action-round'), targets:['.hud-tl','.hd-card'],
    body:i18n("每个回合先补牌，再同时选头条；随后苏联先行动，美国后行动。早期每人 6 次，中晚期通常每人 7 次。每次要把整张牌处理完才交替。第 4 回合加入中期牌，第 8 回合加入晚期牌。") },
  { id:'piles', chapter:i18n("02 · 认识手牌"), title:i18n("三种去向，不要混淆"), icon:'▤', video:media('discard'), targets:['.hud-bl'],
    body:i18n("普通打出的牌进入弃牌堆，牌堆用尽后洗回。带星号的事件真正触发后移出游戏；若只用己方事件牌的行动点，通常仍弃牌。“未出现”列出本局你还没见过的牌，不透露哪些在对手手里；“全部卡牌”只是规则目录。") },
  { id:'opening', chapter:i18n("03 · 头条阶段"), title:i18n("从一盘已经部署好的开局开始"), icon:'⚑', countries:['frg','ita','pol','irn'], targets:['.wm-plate[data-id="frg"]','.wm-plate[data-id="ita"]','.wm-plate[data-id="pol"]'],
    body:i18n("双方各持 8 张早期牌，苏联另持中国牌。初始影响力已部署完成，接下来各选一张牌作为头条。"), button:i18n("进入头条阶段") },
];

export const FINISH_LESSONS: Lesson[] = [
  { id:'china', chapter:i18n("07 · 准备独立对局"), title:i18n("中国牌：可以借力，但要交给对手"), icon:'✦', card:'006', targets:['.op'],
    body:i18n("本局中国牌在苏联手中。它是额外的特殊牌，不占补牌手牌数，不能作头条，也不能送入太空。它提供 4 行动点，全部用于亚洲时可加 1。使用后交给对手，本回合不能再用，下回合才翻为可用；最终计分时持有者再得 1 VP。") },
  { id:'space-abilities', chapter:i18n("07 · 准备独立对局"), title:i18n("太空奖励，也有持续能力"), icon:'✦', status:true, video:media('space'), targets:['[data-part="space"]'],
    body:i18n("通常每回合只能尝试一次太空竞赛，失败也算一次。每格有行动点门槛和成功骰点；先到与后到的 VP 不同。第 2、4、6、8 格依次提供双次尝试、后选头条、弃一张保留牌、第八行动轮。对手追上对应格子时，独享能力消失。悬停格子可随时复习。") },
  { id:'passives', chapter:i18n("07 · 准备独立对局"), title:i18n("持续事件留在局面里"), icon:'◈', targets:['.ps-shelf:not([hidden])','.hud-bl'],
    body:i18n("有些事件不会立刻结束：会持续到回合末、被另一事件取消，或长期生效。双方生效区分开显示，卡牌离开手牌不代表能力消失。事件能改变一般规则；具体前置条件和取消关系，读牌上的文字，悬停其他牌名可查看关联牌。") },
  { id:'defcon-recap', chapter:i18n("07 · 准备独立对局"), title:i18n("核危机限制，与军事行动要求是两件事"), icon:'☢', status:true, video:media('defcon'), targets:['[data-part="crisis"]','[data-part="milops"]'],
    body:i18n("DEFCON 越低，允许政变或调整阵营的地区越少：4 禁欧洲，3 再禁亚洲，2 再禁中东。2 级仍可在其他地区进行非战场国政变。回合末，军事行动每低于 DEFCON 1 点，失去 1 VP。") },
  { id:'exceptions', chapter:i18n("07 · 准备独立对局"), title:i18n("对方的牌，不一定只能冒险打"), icon:'↗', video:media('operations'), targets:['.hd-card'],
    body:i18n("对方阵营事件牌用于行动点，事件通常仍触发，你选择先后顺序；用于太空则不触发。《联合国干预》等特殊牌也能提供其他处理方式。前置条件未满足或事件被禁止时，以卡牌规则为准。被迫弃牌和主动打出也不同：单纯弃牌不执行事件。") },
  { id:'final-scoring', chapter:i18n("07 · 准备独立对局"), title:i18n("你已经走完一整个回合"), icon:'★', status:true, video:media('final-scoring'), targets:['.hud-tl','[data-part="scoreRead"]'],
    body:i18n("计分牌按打出时的地区局势结算。第 10 回合结束后，所有地区进行最终计分，VP 领先的一方获胜。东南亚不单独计分。") },
];
