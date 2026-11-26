import type { Agent, AgentCard, Observation, LegalAction } from "./types";

function value(c: AgentCard, o: Observation): number {
  if (c.scoring)
    return (
      c.scoringDelta +
      (o.actionsRemaining <= o.hand.filter((c) => c.scoring).length ? 100 : 0)
    );
  return c.eventValue - (c.owner !== null && c.owner !== o.side ? 8 : 0);
}
function score(a: LegalAction, o: Observation): number {
  const c = o.hand.find((c) => c.id === a.card)!;
  if (c.scoring) return value(c, o) + 2;
  const risk = a.eventRisk ?? 0;
  if (a.use === "event") return value(c, o) + 1 - risk;
  if (a.use === "space")
    return (
      (c.owner !== null && c.owner !== o.side ? 5 : 0) +
      (a.success ?? 0) * 4 -
      o.space[o.side] * 0.2 +
      (o.milops[o.side] < o.defcon ? -1 : 0)
    );
  if (a.mode === "coup")
    return (
      (a.expectedSwing ?? 0) * 1.4 +
      (a.targetValue ?? 0) +
      (a.milopsNeeded ?? 0) * 1.2 -
      risk
    );
  if (a.mode === "realign")
    return (a.expectedSwing ?? 0) + (a.targetValue ?? 0) * 0.4 - risk;
  return a.ops * 1.1 + (a.targetValue ?? 0) - risk;
}
/** Replace this module (or inject any Agent) without importing rules or UI code. */
export function createHeuristicAgent(): Agent {
  return {
    id: "heuristic-v1",
    chooseAction(o) {
      const a = [...o.legalActions].sort(
        (a, b) => score(b, o) - score(a, o) || a.card.localeCompare(b.card),
      )[0];
      if (!a) throw new Error("AI没有合法行动");
      return {
        card: a.card,
        use: a.use,
        ...(a.mode ? { mode: a.mode } : {}),
        ...(a.target ? { target: a.target } : {}),
      };
    },
    chooseHeadline(o) {
      const cards = o.hand.filter((c) => o.headlineCandidates.includes(c.id));
      return (
        cards.sort(
          (a, b) => value(b, o) - value(a, o) || a.id.localeCompare(b.id),
        )[0]?.id ?? ""
      );
    },
    chooseOption(c) {
      return (
        [...c.options].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]?.id ??
        ""
      );
    },
  };
}
