# Single-player integration validation

Validated locally on 2026-11-14. The browser checks use an isolated Chrome profile, not the user's stored game.

- `npm test`: 149 tests passed, zero failures. Includes execution of all 109 event/scoring handlers, China-card lifecycle, rule boundaries, hidden-information isolation, card conservation and deterministic save/resume.
- `npm run cards:check`: 12 passed, zero failures.
- `npm run build`: TypeScript and Vite production build passed.
- `npm run solo:simulate -- 500`: all 500 seeds reached a terminal result; validation checks ran at each checkpoint. No nontermination or card-conservation failures in the completed sweep.
- `npm run test:solo:browser`: real pointer deployment, headline drag, action cancellation/replay, event effects, reload, both sides' victory screens, final scoring, terminal reload, restart and mobile result-dialog fit passed. No page console errors. Near-terminal browser scenarios are legal save fixtures; the 500 complete games run without animation through the same rules engine.

## Completed simulation results

| Result | Games |
|---|---:|
| US:defcon | 62 |
| US:europe | 2 |
| US:final | 75 |
| US:vp | 34 |
| US:wargames | 1 |
| USSR:defcon | 34 |
| USSR:europe | 9 |
| USSR:final | 84 |
| USSR:held-scoring | 9 |
| USSR:vp | 178 |
| USSR:wargames | 7 |
| draw:final | 5 |

The sweep found and fixed a headline-order bug: Missile Envy must not prevent an already committed opposing headline from resolving. Seed 406 is retained as a regression test.

These checks establish playable end-to-end matches and the listed regression coverage, not tournament-strength AI or exhaustive certification of every possible card interaction. Firefox and Safari were not tested.
