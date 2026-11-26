# Game audio

The game uses licensed professional recordings, recorded foley and custom offline sound design. No Suno account or generation API is required; no third-party audio requests occur during play.

## Music (downloaded 2026-11-15)

- US: **Signal to Noise** by **Scott Buckley**. Source and licence: https://www.scottbuckley.com.au/library/signal-to-noise/ . Master: https://scottbuckley.com.au/library/wp-content/uploads/2020/04/sb_signaltonoise.mp3
- USSR: **Katabasis I** by **Scott Buckley**. Source and licence: https://www.scottbuckley.com.au/library/katabasis-i/ . Master: https://scottbuckley.com.au/library/wp-content/uploads/2026/09/Katabasis_I.mp3

Both are released under **Creative Commons Attribution 4.0**: https://creativecommons.org/licenses/by/4.0/ . Attribution appears in the in-game sound settings and `public/audio/CREDITS.txt`. Original masters are retained under `source/us.mp3` and `source/ussr.mp3`. Changes: low-frequency filtering, loudness normalization to -20 LUFS, AAC compression, playback gain automation and a six-second overlap at loop/faction changes. These remain Scott Buckley's compositions/recordings, not original game compositions.

## Sound effects

Kenney **Casino Audio 1.1** (https://kenney.nl/assets/casino-audio) and **Impact Sounds 1.0** (https://kenney.nl/assets/impact-sounds) are CC0: https://creativecommons.org/publicdomain/zero/1.0/ . Original licence files are preserved in `source/casino/License.txt` and `source/impact/License.txt`. `used-sources.json` lists the recordings used.

Foley is trimmed, pitched, filtered, layered with original low-frequency resonances, given short room tails, and peak-limited offline. Three variants each for cards, influence and die contacts prevent repeated machine-like clicks. No UI-hover sounds, spoken narration, marching songs or continuous alarm loops.

## Rebuild

Install ffmpeg and Python numpy/scipy in an isolated environment, then run `python tools/audio/build.py` from the repository. Source packs must be extracted into `source/casino` and `source/impact`, and the two music masters retained. Runtime files are only `public/audio/`; masters and ZIPs are not deployed. The manifest records file sizes/durations and pre-encoding SFX peaks (MP3 decoded peaks can differ slightly).

## Integration

`src/audio/GameAudio.ts` owns browser audio, separate streamed-music and buffered-SFX buses, a safety compressor, gesture unlocking, visibility pause, voice limits, gain ducking and persistent local settings. It consumes presentation events; it never changes match state, RNG, observations or the network protocol. US/Soviet music follows the player's seat, not the active turn. Both `src/game/main.ts` and `src/net/client.ts` pass the same optional `AudioPort` to the shared spotlight and result presenter. Snapshot/reconnection alone does not replay sounds.

Assets are lazy-loaded after a trusted gesture. Failed/late sounds are dropped, not replayed after the action. Browser autoplay restrictions and missing audio never block play. Controls live in the existing time HUD panel; credits expand only on request.

Validation: `npm run test:audio`; browser regression with a private Chrome on port 9350 via `node tools/audio/browser.mjs`.
