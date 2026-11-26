// Durable continuations: replay only the current checkpoint's validated decisions.
// Yield at input boundaries, never leave an awaiting UI promise alive in a Worker.
import type { Scenario } from "../map/types";
import type { SideIndex } from "../hud/types";
import { ABORTED, type Decision, type CardOptions } from "../play/types";
import { SoloGame, type SoloPresenter } from "../game/solo/engine";
import { Match, CARD, other, type MatchState } from "../game/solo/model";
import type { Observation } from "../game/ai/types";
import type { Frame, Prompt, View } from "./protocol";
export type Journal = {
  version: 1;
  checkpoint: MatchState;
  answers: Record<string, unknown>;
  emitted: number;
  epoch: number;
};
export type Evaluation = {
  state: MatchState;
  observations: [Observation, Observation];
  journal: Journal;
  prompts: Prompt[];
  views: [View, View];
  options: [Record<string, CardOptions>, Record<string, CardOptions>];
  frames: Frame[];
};
export function newJournal(scenario: Scenario, seed: number): Journal {
  return {
    version: 1,
    checkpoint: new Match(scenario, seed).snapshot(),
    answers: {},
    emitted: 0,
    epoch: 0,
  };
}
export function viewOf(g: SoloGame, side: SideIndex, history = true): View {
  const hud = g.match.hudState(side);
  return {
    hud: {
      ...hud,
      battleLog: history ? hud.battleLog : undefined,
      hand: g.match.hand(side),
      opponentHand: g.match.s.hands[other(side)].length,
    },
    map: g.mapState,
    result: g.result,
    log: g.match.s.log.slice(-150),
  };
}
export async function evaluate(
  scenario: Scenario,
  initial: Journal,
): Promise<Evaluation> {
  let journal = structuredClone(initial);
  const output: Frame[] = [];
  for (let boundary = 0; boundary < 30; boundary++) {
    const prompts: Prompt[] = [],
      trace: Frame[] = [];
    let ordinal = 0,
      reached: MatchState | undefined;
    const selectedHeadlines: [string | null, string | null] = [null, null];
    let headlinesRevealed = false;
    const g = new SoloGame({
      scenario,
      lang: "zh",
      snapshot: journal.checkpoint,
      onChange() {},
      onCheckpoint(s) {
        reached = s;
        g.stop();
      },
      remoteInputs: seat,
    });
    const seatView = (side: SideIndex, history: boolean): View => {
      const view = viewOf(g, side, history);
      if (!headlinesRevealed && g.match.s.phase === 'headline' && selectedHeadlines.some(Boolean)) {
        view.headline = { mine: selectedHeadlines[side], theirs: !!selectedHeadlines[other(side)] };
        view.hud.hand = view.hud.hand.filter(id => id !== selectedHeadlines[side]);
        view.hud.opponentHand -= selectedHeadlines[other(side)] ? 1 : 0;
      }
      return view;
    };
    const views = (history = true): [View, View] => [seatView(0, history), seatView(1, history)];
    const frame = (
      method: string,
      args: any[],
      audience: SideIndex | "all" = "all",
    ) => {
      trace.push({
        method,
        args: structuredClone(args),
        audience,
        views: views(false),
      });
    };
    const ask = async (
      side: SideIndex,
      method: Prompt["method"],
      args: any[],
      valid: (v: any) => boolean,
    ): Promise<any> => {
      const id = `${journal.epoch}:${ordinal++}`;
      if (Object.hasOwn(journal.answers, id)) {
        const value = journal.answers[id];
        if (!valid(value)) throw new Error("不合法的选择");
        return value;
      }
      prompts.push({ id, side, method, args: structuredClone(args) });
      throw ABORTED;
    };
    const outputs: SoloPresenter = {
      async phase(x) {
        frame("phase", [x]);
      },
      async showHeadline(x) {
        headlinesRevealed = true;
        frame("showHeadline", [x]);
      },
      async announce(x) {
        frame("announce", [x]);
      },
      async roll(x) {
        frame("roll", [x]);
      },
      async score(x) {
        frame("score", [x]);
      },
      async cardMove(x, commit) {
        commit();
        frame("cardMove", [x]);
      },
      async step(e, commit, cause) {
        commit();
        frame("step", [e, cause]);
      },
      async trigger(x) {
        frame("trigger", [x]);
      },
      async settle(x) {
        frame("settle", [x]);
      },
      async reveal(ids, title) {
        frame("reveal", [ids, title], 0);
      },
      async result() {},
      skip() {},
      dispose() {},
      async pickHeadline() {
        throw new Error("seat required");
      },
      async decide() {
        throw new Error("seat required");
      },
      async choose() {
        throw new Error("seat required");
      },
      async pickTarget() {
        throw new Error("seat required");
      },
      async place() {
        throw new Error("seat required");
      },
    };
    function seat(side: SideIndex): SoloPresenter {
      return {
        ...outputs,
        async pickHeadline() {
          const id = await ask(
            side,
            "pickHeadline",
            [],
            (v) =>
              typeof v === "string" &&
              g.observation(side).headlineCandidates.includes(v),
          );
          selectedHeadlines[side] = id;
          return id;
        },
        async decide() {
          return ask(side, "decide", [], (v: Decision) => {
            if (!v || !g.match.hand(side).includes(v.card)) return false;
            const options = g.options(v.card, side);
            if (options.blocked) return false;
            if (v.use === "event") return options.event.ok;
            if (v.use === "space") return options.space.ok;
            if (
              v.use !== "ops" ||
              !["place", "coup", "realign"].includes(v.mode ?? "")
            )
              return false;
            const m = options[v.mode!];
            return m.ok && (!v.target || m.targets.has(v.target));
          });
        },
        async choose(q) {
          return ask(
            side,
            "choose",
            [q],
            (v) => typeof v === "string" && q.options.some((x) => x.id === v),
          );
        },
        async pickTarget(q) {
          return ask(side, "pickTarget", [q], (v) =>
            v === null
              ? q.optional || q.cancel
              : typeof v === "string" && q.targets.has(v),
          );
        },
        async reveal(ids, title) {
          // Acknowledgment is persisted, including private reveals; reconnection never hides a pending reveal.
          await ask(side, "reveal", [ids, title], (v) => v === true);
        },
        async place(session, play) {
          const setup = g.match.s.phase === "setup";
          const data = {
            side,
            points: session.points,
            targets: session.targets(),
            setup,
          };
          const answer = await ask(
            side,
            "place",
            [data, play],
            (v) =>
              v &&
              typeof v.accept === "boolean" &&
              Array.isArray(v.ids) &&
              v.ids.length <= 20 &&
              v.ids.every((x: unknown) => typeof x === "string"),
          );
          if (!answer.accept) {
            if (setup) throw new Error("初始部署必须完成");
            return false;
          }
          if (session.confirm) {
            // Validate the entire allocation privately before publishing the card.
            for (const id of answer.ids)
              if (!session.add(id)) throw new Error("影响力放置不合法");
            if (session.left && [...session.targets().values()].some(x => x.ok))
              throw new Error("请用完可用行动点");
            while (session.undo());
            await session.confirm();
            if (g.result) return true;
          }
          for (const id of answer.ids) {
            const effect = session.add(id);
            if (!effect) throw new Error("影响力放置不合法");
            frame(
              "step",
              [effect, { verb: "place", by: side, card: play.card.id, id }],
              other(side),
            );
          }
          if (session.left && [...session.targets().values()].some((x) => x.ok))
            throw new Error("请用完可用行动点");
          return true;
        },
      };
    }
    await g.start(outputs);
    output.push(...trace.slice(journal.emitted));
    if (reached) {
      journal = {
        version: 1,
        checkpoint: reached,
        answers: {},
        emitted: 0,
        epoch: journal.epoch + 1,
      };
      if (!g.result) continue;
    } else journal.emitted = trace.length;
    const options = ([0, 1] as SideIndex[]).map((side) =>
      Object.fromEntries(
        g.match.hand(side).map((id) => [id, g.options(id, side)]),
      ),
    ) as Evaluation["options"];
    return {
      state: g.snapshot,
      observations: [g.observation(0), g.observation(1)],
      journal,
      prompts,
      views: views(),
      options,
      frames: output,
    };
  }
  throw new Error("对局连续推进超过上限");
}

/** Terminating mid-event settles cards held by an event's stack into the discard pile. */
export function resign(
  scenario: Scenario,
  e: Evaluation,
  side: SideIndex,
): Evaluation {
  const m = new Match(scenario, undefined, e.journal.checkpoint);
  m.s = structuredClone(e.state);
  const present = new Set([
    ...m.s.hands.flat(),
    ...m.s.deck,
    ...m.s.discard,
    ...m.s.removed,
    ...m.s.future,
    ...m.s.inPlay,
    ...m.s.headlines.filter(Boolean),
  ]);
  if (m.s.played) present.add(m.s.played.card);
  for (const id of CARD.keys())
    if (id !== "006" && !present.has(id)) m.s.discard.push(id);
  m.end(other(side), "resign", `${side === 0 ? "美国" : "苏联"}认输`);
  m.validate();
  return {
    ...e,
    state: m.snapshot(),
    journal: {
      version: 1,
      checkpoint: m.snapshot(),
      answers: {},
      emitted: 0,
      epoch: e.journal.epoch + 1,
    },
    prompts: [],
    frames: [],
    views: e.views.map((v, seat) => ({
      ...v,
      headline: undefined,
      result: m.s.result,
      hud: { ...v.hud, phase: "end", battleLog: m.hudState(seat as SideIndex).battleLog },
      log: m.s.log.slice(-150),
    })) as Evaluation["views"],
  };
}
