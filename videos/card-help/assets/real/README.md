# Genuine project captures

These images are screenshots of the existing project's map/HUD/card renderers, not repainted stand-ins.

Map and initial cards: provided under `/tmp/card-help-real-assets` by the main task. Additional HUD, Cuba, Iran-influence, Austria and corrected continental-Europe views were captured from `http://localhost:5173` / `game.html` in an isolated Chrome on port 9338. Production card 004 uses the same card export renderer at localhost:4311. The concept card comes from the project's original concept-deck page.

The source map is `public/maps/coldwar` (plural `maps`), and the source UI is `src/map`, `src/hud`, `src/cards`. Those directories were inspected read-only. Capture-time UI hiding and state changes affected only private browser pages. All images are frozen here for offline, deterministic rendering.

Important: region-state images use the corrected continental camera from `capture-europe.mjs`; the region's normal fit includes Canada and is unsuitable for the close instructional shot. Camera overlay reveals in `build-real.py` animate opacity only, preserving the authored x/y/scale.
