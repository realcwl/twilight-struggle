import { t as i18n } from '../i18n/index.js';
/**
 * A deterministic lesson played by the real SoloGame rules, not a second ruleset.
 * The deployed opening follows the 2015 rulebook example (including its US +5
 * bidding allocation). Hands and later plays are adapted to teach six operations
 * in one early-war turn. It is not a transcript of the tournament example.
 *
 * Runtime: initialize SoloGame with createTutorialSnapshot + createTutorialAgent.
 * Gate player input against HUMAN_HEADLINE / plannedHumanAction(snapshot), wrap
 * PlaceSession using the ordered placements, and use plannedHumanChoice/Target
 * for the two choice prompts and map targets. Do not apply effects here.
 * On the first turn-2 pickHeadline call, offer continue/exit BEFORE accepting a
 * card. Continuing releases the coach; the agent already delegates normally.
 */
import type { Scenario } from '../map/types';
import type { Decision, TargetRequest } from '../play/types';
import type { Agent, AgentAction, AgentChoice, Observation } from '../game/ai/types';
import { createHeuristicAgent } from '../game/ai/heuristic';
import { CARD, Match, type MatchState } from '../game/solo/model';
import type { Question } from '../game/solo/engine';

export const TUTORIAL_SEED = 79;
export const TUTORIAL_US_BID = 5;
export const HUMAN_HEADLINE = '027';
export const COMPUTER_HEADLINE = '020';

export type TutorialAction = Decision & {
  readonly title: string;
  readonly body: string;
  /** One country per influence click, in this order; not one entry per ops cost. */
  readonly placements?: readonly string[];
  /** Existing term-guide key; the coach owns playback. */
  readonly video?: string;
};

export const HUMAN_ACTIONS: readonly TutorialAction[] = [
  {
    card: '035', use: 'ops', mode: 'place', placements: ['mys', 'col'],
    title: i18n("把行动点变成影响力"), video: 'influence',
    body: i18n("将台湾决议的两点行动分别放到马来西亚和哥伦比亚。已有影响力或与己方影响力相邻的国家可以进入；控制需要领先对手至少该国稳定度。用自己的事件牌进行行动，不会同时触发事件。"),
  },
  {
    card: '004', use: 'ops', mode: 'coup', target: 'irq',
    title: i18n("发动一次政变"), video: 'coup',
    body: i18n("用三点行动在伊拉克政变。骰点加行动点，减去两倍稳定度；正数先移除对手影响力，剩余值才增加自己的影响力。军事行动按使用的行动点累计；只有战场国政变才降低核危机等级。"),
  },
  {
    card: '015', use: 'ops', mode: 'place', placements: ['lbn'],
    title: i18n("手里的红牌仍然是苏联事件"), video: 'hand',
    body: i18n("用纳赛尔的一点行动在黎巴嫩增加影响力，选择先行动、后执行对手事件。卡牌在你的手里不改变事件所属阵营：随后苏联仍在埃及增加影响力。"),
  },
  {
    card: '028', use: 'space',
    title: i18n("用太空竞赛避开对手事件"), video: 'space',
    body: i18n("把苏伊士运河危机用于太空竞赛。满足本格行动点要求后掷骰；无论成功与否，都不执行这张苏联牌的事件。通常每回合只能尝试一次，行动点也不能再拿来放置影响力。"),
  },
  {
    card: '019', use: 'ops', mode: 'realign', target: 'egy',
    title: i18n("调整阵营只移除影响力"), video: 'realignment',
    body: i18n("用杜鲁门主义的一点行动在埃及调整阵营。双方掷骰，加上相邻控制和本国影响力优势等修正；高者可移除对方影响力。它不增加己方影响力，也不增加军事行动。"),
  },
  {
    card: '001', use: 'event',
    title: i18n("把地区局势换成胜利点"), video: 'scoring',
    body: i18n("打出亚洲计分。按控制的国家、战场国和超级大国相邻国计算双方得分，只有净差移动胜利点标记。有影响力不等于控制；计分牌没有行动点，本回合必须处理。"),
  },
];

export const COMPUTER_ACTIONS: readonly AgentAction[] = [
  { card: '021', use: 'ops', mode: 'coup', target: 'irn' },
  { card: '012', use: 'event' },
  { card: '034', use: 'event' },
  { card: '013', use: 'event' },
  { card: '031', use: 'ops', mode: 'coup', target: 'pan' },
  { card: '003', use: 'event' },
];

/** Eight ordinary cards each; China is the standard separate Soviet card. */
export const TUTORIAL_HANDS: readonly [readonly string[], readonly string[]] = [
  [HUMAN_HEADLINE, ...HUMAN_ACTIONS.map(a => a.card), '032'],
  [COMPUTER_HEADLINE, ...COMPUTER_ACTIONS.map(a => a.card), '010'],
];

export function createTutorialSnapshot(scenario: Scenario): MatchState {
  const match = new Match(scenario, TUTORIAL_SEED);
  const s = match.s;
  // Retain the normal seeded shuffle, removing exactly the fixed dealt cards.
  // No card is created, destroyed or borrowed from a later era.
  const drawOrder = [...s.hands.flat(), ...s.deck];
  const dealt = new Set(TUTORIAL_HANDS.flat());
  if (dealt.size !== 16 || [...dealt].some(id => CARD.get(id)?.era !== 'early'))
    throw new Error(i18n("教程手牌必须是16张互不重复的早期牌"));
  s.hands = [[...TUTORIAL_HANDS[0]], [...TUTORIAL_HANDS[1]]];
  s.deck = drawOrder.filter(id => !dealt.has(id));
  s.seenCards = [[...s.hands[0]], [...s.hands[1]]];
  s.knownHands = [[], []];
  for (const [id, amount] of Object.entries({ frg: 4, ita: 4, fra: 3, irn: 2 }))
    s.inf[id][0] = amount;
  for (const [id, amount] of Object.entries({ pol: 4, gdr: 4, yug: 1 }))
    s.inf[id][1] = amount;
  s.phase = 'headline';
  s.log = [];
  s.battleLog = [];
  match.log(i18n("教学局 · 固定开局，初始部署已完成（美国额外5点影响力）"));
  match.validate();
  return match.snapshot();
}

/** Stateless: restoring any action checkpoint selects exactly the same lesson. */
export function plannedHumanAction(
  state: Pick<MatchState, 'turn' | 'phase' | 'actions'>,
): TutorialAction | undefined {
  return state.turn === 1 && state.phase === 'action'
    ? HUMAN_ACTIONS[state.actions[0]] : undefined;
}

/** Called only while the first-turn coach is active; unexpected prompts fail closed. */
export function plannedHumanChoice(question: Pick<Question, 'title' | 'options'>): string {
  const wanted = question.title === '参加奥运会？' ? 'participate'
    : question.title === '对手事件的执行顺序' ? 'after' : undefined;
  if (!wanted || !question.options.some(o => o.id === wanted))
    throw new Error(i18n("教程出现未编排的玩家选项：{0}", [question.title]));
  return wanted;
}

/** The UI should omit Decision.target until pickTarget so the player clicks the map. */
export function plannedHumanTarget(request: TargetRequest): string {
  const step = HUMAN_ACTIONS.find(a => a.card === request.card && a.mode === request.mode);
  if (request.by !== 0 || !step?.target || !request.targets.has(step.target))
    throw new Error(i18n("教程目标不合法：{0}/{1}", [request.card, request.mode]));
  return step.target;
}

/** Short runtime aliases shared with the coach integration. */
export const tutorialChoice = plannedHumanChoice;
export const tutorialTarget = plannedHumanTarget;

function scriptedAction(observation: Observation): AgentAction {
  const action = COMPUTER_ACTIONS[observation.round - 1];
  if (!action || observation.phase !== 'action' || !observation.legalActions.some(a =>
    a.card === action.card && a.use === action.use && a.mode === action.mode && a.target === action.target))
    throw new Error(i18n("教程电脑行动不合法：T{0}/AR{1}", [observation.turn, observation.round]));
  return { ...action };
}

/** Every script decision uses the ordinary seat-relative Agent interface. */
export function createTutorialAgent(fallback: Agent = createHeuristicAgent()): Agent {
  const scripted = (o: Observation) => {
    if (o.turn !== 1) return false;
    if (o.side !== 1) throw new Error(i18n("教程电脑必须使用苏联视角"));
    return true;
  };
  return {
    id: 'tutorial-v1',
    chooseAction(o) {
      return scripted(o) ? scriptedAction(o) : fallback.chooseAction(o);
    },
    chooseHeadline(o) {
      if (!scripted(o)) return fallback.chooseHeadline(o);
      if (!o.headlineCandidates.includes(COMPUTER_HEADLINE))
        throw new Error(i18n("教程电脑头条不在合法选项中"));
      return COMPUTER_HEADLINE;
    },
    chooseOption(q: AgentChoice) {
      if (!scripted(q.observation)) return fallback.chooseOption(q);
      // The fixed Soviet cards need no subsidiary choices: their targets are
      // supplied in their action, and none fires an eligible opposing event.
      // In particular NATO has not been unlocked by Marshall / Warsaw Pact.
      throw new Error(i18n("教程出现未编排的电脑选项：{0}", [q.title]));
    },
  };
}

export function tutorialComplete(state: Pick<MatchState, 'turn' | 'phase' | 'headlineDone'>): boolean {
  return state.turn === 2 && state.phase === 'headline' && !state.headlineDone;
}
