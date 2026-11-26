# Card help · map-2

22 original, silent 6-second videos built from this project's real map renderer, country nodes, card faces, and HUD. They cover every unique video ID in the read-only glossary. The original boxed-diagram treatment was rejected and has been replaced.

## Re-render the approved version

Run in this folder:

```sh
python3 build.py
npx hyperframes check --samples 44 --json
npx hyperframes render --fps 24 --crf 18 --workers 2 --strict --no-best-effort -o renders/real-master.mp4
python3 export.py
.venv/bin/python make-delivery-review.py
```

The deliverables are `../../public/cards/help/{id}.mp4`, `{id}.webp`, `manifest.json` (version 2), and `showcase.jpg`. `export-real.py` validates all 22 staged clips before replacing public files. Runtime format: H.264/yuv420p, 960×540, 24fps, exactly 6.000 seconds / 144 frames, silent, faststart. No 100KB quality cap is applied.

`build-real.py` is the shared generator. Every scene is editable in `compositions/`, with a registered paused GSAP timeline and deterministic camera/card motion. Static assets are fully local; no application server or external network is needed to render. `assets/real/` contains frozen genuine screenshots and transparent component/card captures. Font assets include their license; `subset-font.py` verifies each displayed glyph against the supplied Noto Serif SC source.

## Capture sources

- Parent-provided real assets: full map, France 4/2→5/2, Iran 0/2→1/0 and 0/0, production card faces.
- `capture-real.mjs`: actual `window.game.hud.setState` components and actual sandbox country states; uses a separate private Chrome on port 9338.
- `capture-time.mjs`: early-game HUD images with the seventh action pip hidden **only in the capture page**. The live runtime is untouched.
- `capture-europe.mjs`: correct Europe crop from a union of continental country bounds, excluding Canada; must run after the broad capture script to preserve this framing.
- `capture-concept.mjs`: the actual original concept card “第一道闪电”, for the glossary's legacy-only tension/prestige terms.

Capture scripts contain a local Puppeteer import; update that tool-cache path if re-capturing on another machine. Frozen assets and all render sources are portable.

## Reviewed proofs

- `proofs/real-first/`: approved control, card movement, simultaneous headline reveal direction.
- `proofs/real-fixed/`: corrected Austria, Iran and continental-Europe framing.
- `proofs/real-time-final/`: six action pips for early turns and the Castro→Cuba control→US action sequence.
- `proofs/real-all/`: all scene end states, with time-pip correction superseded by `real-time-final`.
- `proofs/delivery-*.jpg`: final review contact sheets extracted from the **delivered files**, not browser-only proofs.
- `proofs/real-*-ffprobe.json`: final codec/frame/stream metadata for each clip.
- `verification.json`: final coverage, actual byte totals, and checksums.

Full HyperFrames check passes. Reviewed warnings: deliberate silence, intentionally repeated card-back images, and short instructional captions tied to visible state changes. The clips teach one mechanism; full textual definitions remain in the glossary tooltip.
