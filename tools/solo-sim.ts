import scenario from "../data/scenarios/coldwar/scenario.json";
import type { Scenario } from "../src/map/types";
import { SoloGame } from "../src/game/solo/engine";
import { headlessPresenter } from "../src/game/solo/headless";

const count = Number(process.argv[2] ?? 25);
const results: Record<string, number> = {};
for (let seed = 1; seed <= count; seed++) {
  const game = new SoloGame({
    scenario: scenario as unknown as Scenario,
    lang: "zh",
    seed,
    onChange() {},
    onCheckpoint() {
      game.match.validate();
    },
  });
  try {
    const result = await game.start(headlessPresenter(game));
    game.match.validate();
    const key = `${result?.winner === 0 ? "US" : result?.winner === 1 ? "USSR" : "draw"}:${result?.reason}`;
    results[key] = (results[key] ?? 0) + 1;
    console.log(
      JSON.stringify({
        seed,
        result,
        turn: game.snapshot.turn,
        vp: game.snapshot.vp,
      }),
    );
  } catch (error) {
    console.error({ seed, state: game.snapshot, error });
    process.exitCode = 1;
    break;
  }
}
console.log(JSON.stringify({ count, results }));
