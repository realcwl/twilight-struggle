// Test/simulation adapter: the same public decisions and rules as the browser, without animation.
import type { SideIndex } from "../../hud/types";
import type { Agent } from "../ai/types";
import { createHeuristicAgent } from "../ai/heuristic";
import type { SoloGame, SoloPresenter } from "./engine";

export function headlessPresenter(
  game: SoloGame,
  agent: Agent = createHeuristicAgent(),
  maxSteps = 20000,
): SoloPresenter {
  let steps = 0;
  const guard = () => {
    if (++steps > maxSteps)
      throw new Error(
        `对局未终止：${JSON.stringify({ turn: game.match.s.turn, phase: game.match.s.phase, round: game.match.s.round, log: game.match.s.log.slice(-8) })}`,
      );
  };
  const value = (id: string, side: SideIndex) => {
    const c = game.country(id);
    return (
      (c.key ? 4 : 0) +
      (c.controller === side
        ? -3
        : Math.max(
            0,
            5 - (c.influence[1 - side] + c.stability - c.influence[side]),
          )) +
      (id === "tha" ? 2 : 0)
    );
  };
  return {
    async phase() {
      guard();
    },
    async pickHeadline() {
      guard();
      return agent.chooseHeadline(game.observation(0));
    },
    async showHeadline() {
      guard();
    },
    async decide() {
      guard();
      return agent.chooseAction(game.observation(0));
    },
    async announce() {
      guard();
    },
    async place(session) {
      guard();
      while (session.left) {
        const open = [...session.targets()].filter(([, x]) => x.ok);
        if (!open.length) break;
        const id = open.sort(
          (a, b) =>
            value(b[0], session.side) - value(a[0], session.side) ||
            a[0].localeCompare(b[0]),
        )[0][0];
        session.add(id);
      }
      return true;
    },
    async pickTarget(req) {
      guard();
      return (
        [...req.targets].sort((a, b) => {
          const p = a[1],
            q = b[1];
          return "chance" in p && "chance" in q
            ? q.chance - p.chance
            : value(b[0], req.by) - value(a[0], req.by);
        })[0]?.[0] ?? null
      );
    },
    async roll() {
      guard();
    },
    async step(_e, commit) {
      guard();
      commit();
    },
    async trigger() {
      guard();
    },
    async settle() {
      guard();
    },
    skip() {},
    dispose() {},
    async choose(q) {
      guard();
      return agent.chooseOption({
        observation: game.observation(0),
        title: q.title,
        options: q.options,
      });
    },
    async reveal() {
      guard();
    },
    async result() {
      guard();
    },
  };
}
