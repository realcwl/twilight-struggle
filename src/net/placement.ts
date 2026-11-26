import type { Scenario, SideIndex } from "../map/types";
import type { Effect, PlaceSession } from "../play/types";
import type { View } from "./protocol";
/** Optimistic preview only. The server replays and validates every submitted placement. */
export function previewPlacement(
  data: {
    side: SideIndex;
    points: number;
    targets: Map<string, { cost: number; ok: boolean }>;
    setup: boolean;
  },
  initial: View,
  scenario: Scenario,
  changed: (view: View) => void,
): { session: PlaceSession; view: View } {
  const view = structuredClone(initial),
    spent: { id: string; cost: number }[] = [];
  const country = new Map(scenario.countries.map((c) => [c.id, c]));
  const control = (id: string) => {
    const c = view.map.countries[id],
      stability = country.get(id)!.stability;
    return c.influence[0] - c.influence[1] >= stability
      ? 0
      : c.influence[1] - c.influence[0] >= stability
        ? 1
        : null;
  };
  const left = () => data.points - spent.reduce((sum, s) => sum + s.cost, 0);
  const targets = () =>
    new Map(
      [...data.targets].map(([id]) => {
        const cost = data.setup ? 1 : control(id) === 1 - data.side ? 2 : 1;
        return [id, { cost, ok: cost <= left() }];
      }),
    );
  const session: PlaceSession = {
    side: data.side,
    points: data.points,
    canCancel: !data.setup,
    spent,
    get left() {
      return left();
    },
    count: (id) => spent.filter((s) => s.id === id).length,
    targets,
    add(id) {
      const t = targets().get(id);
      if (!t?.ok) return null;
      const c = view.map.countries[id],
        from = c.influence[data.side],
        ctrlFrom = c.controller;
      c.influence[data.side]++;
      c.controller = control(id);
      spent.push({ id, cost: t.cost });
      changed(view);
      return {
        t: "inf",
        id,
        side: data.side,
        d: 1,
        from,
        to: from + 1,
        ctrlFrom,
        ctrlTo: c.controller,
      } satisfies Effect;
    },
    undo() {
      const s = spent.pop();
      if (!s) return false;
      const c = view.map.countries[s.id];
      c.influence[data.side]--;
      c.controller = control(s.id);
      changed(view);
      return true;
    },
  };
  return { session, view };
}
