import assert from 'node:assert/strict';
import { test } from 'node:test';
import rawScenario from '../../data/scenarios/coldwar/scenario.json';
import type { Scenario } from '../map/types';
import { ABORTED, type Effect, type RollSpec, type Decision } from '../play/types';
import { SoloGame, type SoloPresenter } from './solo/engine';
import { CARD, CARDS, Match, type MatchState } from './solo/model';
import { headlessPresenter } from './solo/headless';
import { createHeuristicAgent } from './ai/heuristic';
import type { Agent, AgentAction } from './ai/types';
import { passiveEffects } from './solo/passives';
import glossary from '../cards/glossary.json';
import {
  createTutorialSnapshot, createTutorialAgent, HUMAN_HEADLINE, HUMAN_ACTIONS,
  COMPUTER_HEADLINE, COMPUTER_ACTIONS, TUTORIAL_HANDS, TUTORIAL_SEED,
  plannedHumanAction, tutorialChoice, tutorialTarget, tutorialComplete,
} from '../tutorial/scenario';

const scenario = rawScenario as unknown as Scenario;

async function runTutorial(snapshot = createTutorialSnapshot(scenario)) {
  const checkpoints: MatchState[] = [];
  const rolls: RollSpec[] = [];
  const effects: Effect[] = [];
  const choices: { title: string; value: string }[] = [];
  const decisions: Decision[] = [];
  let boundary = false;
  const g = new SoloGame({
    scenario, lang: 'zh', snapshot, agent: createTutorialAgent(),
    onChange() {},
    onCheckpoint(state) { new Match(scenario, undefined, state).validate(); checkpoints.push(state); },
  });
  const p: SoloPresenter = {
    ...headlessPresenter(g),
    async pickHeadline() {
      if (tutorialComplete(g.snapshot)) {
        boundary = true;
        g.stop();
        throw ABORTED;
      }
      assert.ok(g.observation(0).headlineCandidates.includes(HUMAN_HEADLINE));
      return HUMAN_HEADLINE;
    },
    async decide() {
      const action = plannedHumanAction(g.snapshot);
      assert.ok(action, 'every player action is scripted');
      assert.ok(g.observation(0).legalActions.some(a =>
        a.card === action.card && a.use === action.use && a.mode === action.mode && a.target === action.target),
      `legal player action ${JSON.stringify(action)}`);
      const { card, use, mode } = action;
      decisions.push({ card, use, ...(mode ? { mode } : {}) });
      // Keep target selection in the real presenter/map path.
      return { card, use, ...(mode ? { mode } : {}) };
    },
    async choose(q) {
      const value = tutorialChoice(q);
      choices.push({ title: q.title, value });
      return value;
    },
    async place(session, play) {
      const action = plannedHumanAction(g.snapshot);
      assert.equal(play.card.id, action?.card);
      assert.ok(action?.placements, 'unexpected player placement');
      for (const id of action.placements) {
        assert.ok(session.targets().get(id)?.ok, `legal influence target ${id}`);
        assert.ok(session.add(id));
      }
      assert.equal(session.left, 0);
      return true;
    },
    async pickTarget(req) { return tutorialTarget(req); },
    async roll(spec) { rolls.push(structuredClone(spec)); },
    async step(effect, commit) { effects.push(structuredClone(effect)); commit(); },
  };
  assert.equal(await g.start(p), null);
  assert.ok(boundary, 'the engine reaches turn 2 headline before the tutorial finishes');
  g.match.validate();
  return { state: g.snapshot, checkpoints, rolls, effects, choices, decisions };
}

type Run = Awaited<ReturnType<typeof runTutorial>>;
function after(run: Run, us: number, ussr = us): MatchState {
  const state = run.checkpoints.find(s => s.turn === 1 && s.actions[0] === us && s.actions[1] === ussr);
  assert.ok(state, `checkpoint after ${us}/${ussr} actions exists`);
  return state;
}
const restored = (s: MatchState) => new SoloGame({ scenario, lang: 'zh', snapshot: s, onChange() {} });

test('fixed opening is isolated, conserving eight early-war cards each and the standard future deck', () => {
  const a = createTutorialSnapshot(scenario), b = createTutorialSnapshot(scenario);
  assert.deepEqual(a, b);
  assert.equal(a.seed, TUTORIAL_SEED);
  assert.equal(a.phase, 'headline');
  assert.deepEqual(a.hands, TUTORIAL_HANDS);
  assert.equal(new Set(a.hands.flat()).size, 16);
  assert.deepEqual(a.hands.map(h => h.length), [8, 8]);
  assert.ok(a.hands.flat().every(id => CARD.get(id)?.era === 'early'));
  assert.deepEqual(a.china, { owner: 1, available: true });
  assert.deepEqual(a.seenCards, a.hands);
  assert.deepEqual(a.knownHands, [[], []]);
  assert.deepEqual(a.inf.frg, [4, 0]);
  assert.deepEqual(a.inf.ita, [4, 0]);
  assert.deepEqual(a.inf.gdr, [0, 4]);
  assert.deepEqual(a.inf.pol, [0, 4]);
  assert.deepEqual(a.inf.irn, [2, 0]);
  assert.equal(a.future.length, CARDS.filter(c => !c.special && c.era !== 'early').length);
  new Match(scenario, undefined, a).validate();
  // No shared snapshot state, normal game defaults, or global dice overrides.
  a.inf.irn[0] = 99; a.hands[0].pop(); a.deck.reverse();
  assert.deepEqual(createTutorialSnapshot(scenario), b);
  assert.deepEqual(new Match(scenario, TUTORIAL_SEED).inf('irn'), [1, 0]);
});

test('tutorial completes a full legal opening turn at the next headline boundary', async () => {
  const result = await runTutorial();
  assert.equal(result.decisions.length, HUMAN_ACTIONS.length);
  assert.equal(result.state.turn, 2);
  assert.equal(result.state.phase, 'headline');
  assert.equal(result.state.result, null);
  assert.deepEqual(result.state.actions, [0, 0]);
  assert.deepEqual(result.state.headlines, [null, null]);
  assert.deepEqual(after(result, 6).hands, [['032'], ['010']]);
  assert.deepEqual(result.state.hands.map(h => h.length), [8, 8], 'normal turn-2 deal completed');
  assert.equal(result.checkpoints.length, 14, 'headline, 12 actions, and cleanup checkpoint');
  assert.deepEqual(result.choices.map(q => q.value), ['participate', 'after']);
  for (const side of [0, 1] as const) {
    const actual = result.state.battleLog!.filter(e => e.kind === 'card' && e.by === side).map(e => e.card);
    assert.deepEqual(actual, [side === 0 ? HUMAN_HEADLINE : COMPUTER_HEADLINE,
      ...(side === 0 ? HUMAN_ACTIONS : COMPUTER_ACTIONS).map(a => a.card)]);
  }
});

test('the same seed and inputs reproduce the whole rules trace without replacing dice', async () => {
  const first = await runTutorial(), second = await runTutorial();
  assert.deepEqual(second, first);
  assert.deepEqual(first.rolls.map(r => [r.kind, r.card, r.dice.map(d => d.value)]), [
    ['contest', '020', [6, 2]], ['coup', '021', [6]], ['coup', '004', [4]],
    ['check', '013', [3]], ['space', '028', [2]], ['coup', '031', [2]],
    ['realign', '019', [6, 2]],
  ]);
});

test('headline activates a real persistent event; placement teaches adjacency and control', async () => {
  const r = await runTutorial(), headline = after(r, 0), placed = after(r, 1);
  assert.deepEqual(headline.inf.jpn, [4, 0]);
  assert.equal(headline.flags.japan, true);
  assert.ok(headline.removed.includes('027'));
  assert.ok(passiveEffects(headline).some(p => p.card === '027' && p.by === 0));
  assert.ok(passiveEffects(r.state).some(p => p.card === '027'), 'passive survives into normal play');
  const g = restored(placed);
  assert.deepEqual(placed.inf.col, [1, 0]);
  assert.equal(g.match.control('col'), 0);
  assert.deepEqual(placed.inf.mys, [1, 0]);
  assert.equal(g.match.control('mys'), null, 'one influence is not enough for stability 2');
  assert.equal(placed.flags.formosan, undefined, 'own event does not fire for ops');
  assert.ok(placed.discard.includes('035'));
});

test('coups change influence, milops and DEFCON; the normal legal map enforces regional limits', async () => {
  const r = await runTutorial(), firstCoup = after(r, 0, 1), secondCoup = after(r, 2);
  assert.deepEqual(firstCoup.inf.irn, [0, 4]);
  assert.equal(firstCoup.crisis, 4);
  assert.deepEqual(secondCoup.inf.irq, [0, 0], 'net 1 only removes the existing Soviet point');
  assert.equal(secondCoup.crisis, 3);
  assert.deepEqual(secondCoup.milops, [3, 4]);
  const g = restored(secondCoup);
  assert.match(g.coupTargets(0, 3).locked.get('gdr')!, /DEFCON/);
  assert.match(g.coupTargets(0, 3).locked.get('prk')!, /DEFCON/);
  assert.match(g.realignTargets(0).locked.get('gdr')!, /DEFCON/);
  assert.match(g.realignTargets(0).locked.get('prk')!, /DEFCON/);
  assert.ok(g.coupTargets(0, 3).ok.has('irn'));
  assert.ok(g.options('015').place.ok, 'DEFCON does not forbid ordinary influence placement');
});

test('opponent events fire for ops but not for space, with correct piles and once-per-turn limit', async () => {
  const r = await runTutorial(), opponentEvent = after(r, 3), space = after(r, 4);
  assert.deepEqual(opponentEvent.inf.lbn, [1, 0]);
  assert.deepEqual(opponentEvent.inf.egy, [0, 2]);
  assert.ok(opponentEvent.removed.includes('015'), 'once event actually occurred');
  assert.deepEqual(space.space, [1, 0]);
  assert.deepEqual(space.attempts, [1, 0]);
  assert.equal(space.vp - after(r, 3, 4).vp, 2);
  assert.ok(space.discard.includes('028'));
  assert.ok(!space.removed.includes('028'), 'once card is not removed when its event is bypassed');
  for (const id of ['fra', 'gbr', 'isr']) assert.deepEqual(space.inf[id], after(r, 3, 4).inf[id]);
  const g = restored(space);
  assert.equal(g.options('019').space.ok, false);
  assert.match(g.options('019').space.why, /次数/);
});

test('realignment removes influence only; scoring and military cleanup are real engine effects', async () => {
  const r = await runTutorial(), before = after(r, 4, 5), realigned = after(r, 5), end = after(r, 6);
  assert.deepEqual(before.inf.egy, [0, 2]);
  assert.deepEqual(realigned.inf.egy, [0, 0]);
  assert.deepEqual(realigned.milops, before.milops);
  assert.equal(realigned.crisis, before.crisis);
  assert.ok(end.discard.includes('001') && end.discard.includes('003'));
  assert.ok(!end.hands.flat().some(id => CARD.get(id)?.kind === 'tally'));
  assert.deepEqual(end.milops, [3, 5]);
  assert.equal(end.crisis, 4);
  assert.equal(r.state.vp, end.vp - 1, 'milops shortfall is settled at the OLD DEFCON before relaxation');
  assert.equal(r.state.crisis, 5);
  assert.deepEqual(r.state.milops, [0, 0]);
  assert.deepEqual(r.state.attempts, [0, 0]);
  assert.ok(r.effects.some(e => e.t === 'vp' && e.d === -1 && e.why?.includes('军事行动不足')));
  assert.equal(r.state.vp, -3);
});

test('every saved action checkpoint resumes the same deterministic outcome with a fresh agent', async () => {
  const run = await runTutorial();
  for (const checkpoint of run.checkpoints.filter(s => s.turn === 1)) {
    const resumed = await runTutorial(JSON.parse(JSON.stringify(checkpoint)) as MatchState);
    assert.deepEqual(resumed.state, run.state,
      `resume ${checkpoint.phase} after ${checkpoint.actions.join('/')}`);
  }
});

test('unknown first-turn prompts fail closed and all second-turn agent calls delegate', async () => {
  const g = restored(createTutorialSnapshot(scenario)), agent = createTutorialAgent();
  assert.throws(() => tutorialChoice({ title: 'unexpected', options: [{ id: 'x', label: 'x' }] }), /未编排/);
  assert.throws(() => tutorialChoice({ title: '参加奥运会？', options: [{ id: 'boycott', label: 'x' }] }), /未编排/);
  assert.throws(() => agent.chooseOption({ observation: g.observation(1), title: 'unexpected', options: [] }), /未编排/);
  assert.throws(() => agent.chooseHeadline(g.observation(0)), /苏联视角/);
  const wrong = structuredClone(g.observation(1)); wrong.headlineCandidates = [];
  assert.throws(() => agent.chooseHeadline(wrong), /合法选项/);
  const badAction = structuredClone(g.observation(1)); badAction.phase = 'action'; badAction.round = 1; badAction.legalActions = [];
  assert.throws(() => agent.chooseAction(badAction), /行动不合法/);

  const calls: string[] = [], fallbackAction: AgentAction = { card: '032', use: 'ops', mode: 'place' };
  const fallback: Agent = {
    id: 'test-normal-agent',
    chooseAction() { calls.push('action'); return fallbackAction; },
    async chooseHeadline() { calls.push('headline'); return '039'; },
    async chooseOption() { calls.push('option'); return 'free-choice'; },
  };
  const continuing = createTutorialAgent(fallback), observation = g.observation(1);
  observation.turn = 2;
  assert.deepEqual(await continuing.chooseAction(observation), fallbackAction);
  assert.equal(await continuing.chooseHeadline(observation), '039');
  assert.equal(await continuing.chooseOption({ observation, title: 'free play', options: [] }), 'free-choice');
  assert.deepEqual(calls, ['action', 'headline', 'option']);
  assert.ok(HUMAN_ACTIONS.every(a => !a.video || glossary.some(t => t.video === a.video)));
});

test('a completed tutorial continues through ordinary AI to a genuine game result', async (t) => {
  const { state } = await runTutorial();
  assert.equal(plannedHumanAction(state), undefined);
  const continueGame = async (agent: Agent) => {
    const g = new SoloGame({
      scenario, lang: 'zh', snapshot: state, agent, onChange() {},
      onCheckpoint(snapshot) { new Match(scenario, undefined, snapshot).validate(); },
    });
    const result = await g.start(headlessPresenter(g));
    assert.ok(result);
    assert.ok(result.winner === 0 || result.winner === 1, 'continued game produces a winner');
    assert.notEqual(result.reason, 'resign');
    assert.equal(g.snapshot.phase, 'end');
    g.match.validate();
    return g.snapshot;
  };
  // The wrapper has exactly the same free-play outcome as injecting the normal
  // agent directly. Nothing needs resetting or converting at the handoff.
  const wrapped = await continueGame(createTutorialAgent());
  const normal = await continueGame(createHeuristicAgent());
  assert.deepEqual(wrapped, normal);
  t.diagnostic(`Normal continuation: turn ${normal.turn}, VP ${normal.vp}, winner ${normal.result!.winner}, reason ${normal.result!.reason}`);
});
