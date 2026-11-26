// Test driver. Uses only a seat's public choices and its own hand.
import type { Prompt, View } from "./protocol";
import type { Scenario } from "../map/types";
import type { Observation } from "../game/ai/types";
import { createHeuristicAgent } from "../game/ai/heuristic";
import { previewPlacement } from "./placement";
export async function testAnswer(
  p: Prompt,
  view: View,
  scenario: Scenario,
  observation?: Observation,
): Promise<unknown> {
  const agent = createHeuristicAgent();
  const value = (id: string) => {
    const c = scenario.countries.find((c) => c.id === id)!,
      s = view.map.countries[id];
    return (
      (c.key ? 4 : 0) +
      (s.controller === p.side
        ? -3
        : Math.max(
            0,
            5 - (s.influence[1 - p.side] + c.stability - s.influence[p.side]),
          )) +
      (id === "tha" ? 2 : 0)
    );
  };
  if (p.method === "reveal") return true;
  if (p.method === "pickHeadline") {
    if (observation) return agent.chooseHeadline(observation);
    throw new Error("observation required");
  }
  if (p.method === "decide") {
    if (observation) return agent.chooseAction(observation);
    throw new Error("observation required");
  }
  if (p.method === "choose")
    return [...p.args[0].options].sort(
      (a, b) => (b.score ?? 0) - (a.score ?? 0),
    )[0].id;
  if (p.method === "pickTarget")
    return (
      [...p.args[0].targets].sort((a, b) =>
        "chance" in a[1] && "chance" in b[1]
          ? b[1].chance - a[1].chance
          : value(b[0]) - value(a[0]),
      )[0]?.[0] ?? null
    );
  const { session, view: preview } = previewPlacement(
    p.args[0],
    view,
    scenario,
    () => {},
  );
  view = preview;
  while (session.left) {
    const open = [...session.targets()]
      .filter(([, x]) => x.ok)
      .sort((a, b) => value(b[0]) - value(a[0]) || a[0].localeCompare(b[0]));
    if (!open.length) break;
    session.add(open[0][0]);
  }
  return { accept: true, ids: session.spent.map((s) => s.id) };
}
