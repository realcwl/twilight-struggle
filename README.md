# Map sandbox

好友对战已接入 Cloudflare Workers + Durable Objects。入口：<https://coldwar-duel.coldwar-table-0931.workers.dev>。创建房间后将 8 位房间密码发给朋友。

```sh
npm run dev:online  # 本地双人版
npm run deploy     # IaC 核对、构建、迁移并发布
```

详见 [多人对战、测试与部署说明](docs/multiplayer.md)。单机入口与既有地图交互保留。

A 3D world map with a state-editing sandbox and a play screen containing the HUD and localized cards.
The map draws supplied state; the play screen runs a complete local match against an interchangeable AI. See [single-player and AI integration](docs/single-player.md). Spec: [`plans/maps.md`](plans/maps.md).

## Run it

```sh
npm install
npm run assets:fetch         # one-off, ~600 MB of public geo data into assets/raw/
npm run mapgen -- coldwar    # ~12 s, writes public/maps/coldwar/
npm run dev                  # http://localhost:5173
```

`npm run build` type-checks and produces `dist/`. The globe button switches English / Español / 中文 and remembers your choice.
Direct links also accept `?lang=en`, `?lang=es` or `?lang=zh`;
`?scenario=<id>` loads another generated pack. See [localization architecture and tests](docs/i18n.md).

There are two pages. `/` is the map sandbox described here. `/game.html` is the
[play screen](#the-play-screen): the same map with the HUD over it.

After changing the Cold War scenario, run `npm run mapgen -- coldwar` and `npm test`. The tests
compare every country, stability value, battleground flag, region and connection in both the
source scenario and generated runtime pack against the audited board reference.

The map fills the whole window. Nodes and the links between them are always drawn; the terrain is
the backdrop. The sandbox panel is a drawer behind the button at the top right.

Controls: drag to pan, wheel to zoom around the cursor, hover a node (or, zoomed in, its land) for
the info card, click to pin it, Esc to clear, double-click to fly in. Fully zoomed out, hovering
bare land shows the region instead.

Hold **Shift** for a tactical view: hide the terrain, regional lettering and decorative effects,
leaving the country nodes and connections on a dark background. Pan, zoom and node selection still
work. Release Shift to restore the map; leaving the window also restores it. The shortcut is inactive
while typing in a field.

East and west the map has no end: keep dragging and the view goes on round the world, so Japan is
a short drag west of America. North and south it stops at the map's edge. The farthest zoom never
takes in more than one turn of the world, so no country is on screen twice. Fully zoomed out the
view only slides east and west: the overview keeps one north-south framing on any window shape,
and panning north and south opens up as soon as you zoom in.

## Nodes

A node always shows its stability and both influence values, zeros included, at every zoom. Above
them stands the country's name when there is room for names, and its flag when there is not:

- **Far view.** Each token is narrowed to fit the room the board layout keeps for a node (3.2 x 2.1
  world units), with the flag flying from a short staff on top. On a small window, where even the
  narrow token is wider than that room, tokens are held at a legible size and overlap a little
  where nodes crowd; the one further north lies on top, so a flag never covers a neighbour's numbers.
- **Zooming in.** Tokens widen as room opens up, then the flags give way to names. A name that would
  run into a more important neighbour's is left out, and that node keeps its flag.
- **Focus.** A node under the pointer opens out to full size with its name, at any zoom.

A battleground wears the battle mark, two crossed rifles, on the top-left corner of its token,
plus a thicker gold outer ring and a red stability badge with pale numerals. The inner blue/red ring still shows who controls the country;
non-battlegrounds keep their pale outer border. The mark is one drawing, `src/map/battleMark.ts`, and the cards and lists that say
"battleground" (the country card, the region card's count, the sandbox panel) show the same one.

`src/map/plates.ts` sizes and places the tokens, `src/map/map.css` draws them, and
`src/map/flags.ts` holds one small drawing per country id: bands, fields and one plain shape where
an emblem would be, in the form the flag had for most of the period. A node that stands for several
states flies two of their flags, halved along the diagonal. A node without an entry flies plain cloth.

## Layout

```
tools/mapgen/      offline generator: geo data + scenario -> textures and map.json
data/scenarios/    scenario packs (the only place a map's content is defined)
assets/            download list, checksums, SOURCES.md
src/map/           the map module
src/sandbox/       the sandbox page and panel
src/hud/           the play screen's HUD: score, clock, meters, hand, piles
src/cards/         the deck: what the cards are and how one is drawn
src/play/          how a card being played is staged: choice, targets, dice, consequences
src/game/          the play screen, single-player rules, event handlers and AI interfaces
public/maps/       generated packs (output of mapgen)
prototypes/        standalone design studies; nothing in the game depends on them
```

`prototypes/country-identity/` compares ten ways of giving each country its own character. Open its
`index.html` directly. Two of them, the ink vignette and the ambient motion, are now in the game.

`prototypes/battleground-marks/` compares ten marks for a battleground on the live map
(http://localhost:5173/prototypes/battleground-marks/, G lays them side by side). Mark 02, the crossed
rifles, is the one that was picked and is in the game; the page keeps the other nine and the gold ring
that marked a battleground before.

`prototypes/hud-layouts/` compares ten ways of arranging the score, the clock, the meters, the hand and
the three piles over the live map. It imports the map module, so it needs the dev server:
`npm run dev`, then http://localhost:5173/prototypes/hud-layouts/. Keys 1-9 and 0 switch layouts.
Layout 04 (four corners) is the one that was picked, with its meters redrawn as the things they
stand for and a two-line country card in place of the map's own. It now lives in `src/hud/`; the
prototype stays as the record of the other nine.

`prototypes/year-styles/` takes that layout as its stage and tries ten ways of saying what year it is in
place of the turn wheel (split-flap, tear-off calendar, radio tuner, front page, filmstrip, stamp and
postmark, dossier, television, three medallions, panel clock): http://localhost:5173/prototypes/year-styles/.
Keys 1-9 and 0 switch, G shows all ten in an early, a middle and a late year.

## Country flavour

Decoration only; nothing here is game data and nothing depends on it.

- **Ink vignettes.** Zoomed in, every country has a small pen-and-ink drawing lying on its land, under
  the links and nodes, in faded sepia. When the country comes into focus (hover or click) the drawing
  is inked in afresh, stroke by stroke. They fade out as the view pulls back, well before the far
  view.
- **Ambient motion.** While one country is in focus, something of its own drifts across it: petals,
  blown sand, snow, rain, butterflies, lanterns. It stops when the focus moves on.

Both are defined per country id in `src/map/countryFlavor.ts`: a list of shapes in a 100 x 100 box
for the drawing, and a particle kind with its colours. A country without an entry simply has
neither. `src/map/vignettes.ts` rasterises the drawings into one texture at start-up and
`src/map/vignetteLayout.ts` finds each one a place: the roomiest spot on the country's own land
that is clear of the nodes, or the nearest open water for a country too small to hold it.
`src/map/motes.ts` runs the particles. `map.setFlavor(false)` turns both off; the sandbox panel has
a checkbox for it under View.

## Using the map module

```ts
import { WorldMap } from './src/map/WorldMap';

const map = await WorldMap.create(container, '/maps/coldwar');
map.setState(state);                       // MapState, see src/map/types.ts
map.on('hover', (target) => {});           // { kind: 'country' | 'region', id } | null
map.on('select', (target) => {});
map.flyTo('fra');                          // a country id, a region id, or anything else for the whole world
map.setHighlights(['fra', 'ita'], 'target'); // reserved for the rules engine: marks legal targets
```

The module never computes rules. Control, flip margins and region status all arrive in `MapState`;
in the sandbox they come from `src/sandbox/placeholderRule.ts`, a stand-in to be replaced by the
rules engine.

## The play screen

`/game.html` puts the HUD over the map: time and cards on the left, with one shared status panel
at the top right. A live thumbnail shows the score, nuclear crisis and both sides' space/military
progress. Hover or keyboard focus expands the full meters; leaving collapses them. Touch users
can tap to open, then tap the heading or outside to close. Space explanations remain accessible
while expanded, and outcome animations reveal the full panel automatically before moving it.

| Corner | Subject | What is drawn |
|---|---|---|
| top left | time | the turn wheel (ten turns, a gap where an era ends), the action round, whose move it is |
| top right | status | victory points and Space Race above; nuclear crisis, cumulative regional restrictions and military operations below |
| bottom left | cards | the card on the table, the three piles (draw, discard, removed), and over the piles the bar that opens every card |

The opponent's hand hangs from the top edge as card backs. The player's hand fans out along the
bottom: hover a card to read it, drag it out and let go to play it. Hovering a country shows a
two-line card under the time corner (name, stability, who controls it, both influences); the map's
own card, with its list of neighbours, stays in the sandbox.

Ongoing card effects use shelf 01 from `prototypes/passive-effects/`: your cards sit above the
bottom-left piles, and the opponent's sit below their hand. Attribution follows the actual player,
even when a player activates the other faction's event. Empty shelves are completely hidden.
Hover or tap a miniature for its full card, duration, scope and current pile; cancellations and
turn expiry remove the reminder automatically. The shelf reflects live rule flags, without
changing where the physical card belongs. Source metadata survives saves and both online seats.
`src/game/solo/passives.ts` projects the effects into `HudState.passives`; `src/hud/parts/passives.ts`
renders them. `SOLO_CDP_PORT=<private-Chrome-port> node tools/passives-browser.mjs` checks real
NORAD play, restore, both perspectives, empty shelves, nested term help and responsive placement.

Zoomed out, bare terrain is its region, and the card is the region's:

| Row | What it says |
|---|---|
| scores | what presence, domination and control are worth there, with a bar in a side's colour under the one that side holds now |
| one row per side | the standing it holds (or none), the countries it controls, and how many of the region's battlegrounds are among them |

Presence, domination and control are marked as the cards mark their terms. A card that is only
hovered steps across to the other top corner when the pointer comes near; click to select and it
stays, and its marked words then open the same explanation the cards' words do (hover, click, or Tab
and Enter; Esc closes the explanation first and the selection second).

The three values are not a table of their own: `src/game/regions.ts` reads them off each region's
scoring card in `src/cards/catalog.json`, so the map and the card cannot disagree. The same file
works out each side's standing from the countries it controls. The match engine applies scoring modifiers and awards VP.

Southeast Asia is a selectable **subarea of Asia**, not another primary region. Selecting Burma,
Laos/Cambodia, Thailand, Vietnam, Malaysia, Indonesia or the Philippines shows `亚洲 › 东南亚`
and buttons for the two scoring scopes. The Asia view includes all seven; the Southeast Asia
view highlights just those seven and previews each side's total from controlled countries
(Thailand 2 VP, each other country 1 VP). Switching scopes frames that entire area on the map.
The preview does not change the VP track. Southeast Asia uses no presence/domination/control
tiers, its scoring card is removed after play, and final scoring includes it only within Asia
([GMT rules, §§2.1.2, 7.2 and 10.3.2](https://s3-us-west-2.amazonaws.com/gmtwebsiteassets/nnts/TS_Rules-2015.pdf)).

`src/map/scoringAreas.ts` derives this nested selection from the existing `subregions` tags;
canonical regions and connections stay unchanged. Card 38's structured `scoringRule` in
`src/cards/catalog.json` supplies the per-country weights to `src/game/regions.ts`. The sandbox
also has a nested Southeast Asia legend row and scope buttons. Open
`/game.html?area=southeast-asia` to inspect the scoring preview directly.

`src/game/solo/` now runs the match from initial deployment through a winner (or a final-score draw).
The player is the US; the local, replaceable AI is the USSR. Early turns have six action rounds,
later turns seven, with the eighth-round privileges handled by the engine. All 110 catalog cards
are used, including the separately held China Card. Events change the real state, and scoring,
DEFCON, military operations, Space Race privileges and turn-ten final scoring determine the result.

The existing spotlight interaction is retained. Only missing event choices and the end-of-game
screen are added. Completed actions automatically save locally; refreshing restores that checkpoint.
Regional scoring now stages a map-backed four-step explanation before applying VP: controlled
countries, the highest eligible standing, battleground/adjacency bonuses, and the net change.
Pause, back, and next controls let either player read it at their own pace. Southeast Asia,
European control, Taiwan, Shuttle Diplomacy and final scoring use the same public calculation
as the engine. Network replay broadcasts that snapshot to both seats before the VP frame.
`npm run test:scoring:browser` checks this flow locally, including the explicit UN Intervention
card selection and Taiwan's dynamic battleground badge. The badge is scoring-only: it does not
alter coup/DEFCON rules. It reverts when US control or Formosan Resolution ends.

The local rules now prevent accidental loss from held scoring cards or nuclear war: only
scoring cards remain playable when all remaining actions are needed for them; leftover scoring
cards resolve at cleanup. DEFCON has a floor of 2, unsafe coup targets are blocked, and a Cuban
Missile Crisis coup first pays its release cost. These are deliberate simplified rules. The hand,
AI legal actions and online validation share the same eligibility; single-use choices resolve
without a redundant menu. See the linked document for details.

See [rules architecture, AI interface, save semantics and testing](docs/single-player.md).

| Do | What happens |
|---|---|
| drag a card out of the hand | headline: it is played, with nothing to confirm. Action round: the screen divides, the event on the left and operations on the right |
| `E`, or `Z` `X` `C` `V` | the event, or one of the four ways to act: place influence, realign, coup, space race |
| click a lit country | choose it; `Backspace` takes back a placed point, `Enter` finishes, `Esc` takes the card back while nothing has happened yet |
| Space | cut the current pause short |
| R, or click the turn dial | open the game menu: continue, reload the last complete action, or start a new match |
| hover / focus / tap a space milestone or mission order | inspect its requirements and rewards; no progress change |
| click the discard or removed pile | look through it |
| click 战斗日志 (the former current-play slot) | review both players' actions and cards you saw, filter by turn or player, search cards/countries, and export your journal |

The battle journal records settled influence and control changes, dice and modifiers, VP,
DEFCON, military operations, space progress and passive effects alongside the played card.
Cancelled plays and undone placement previews are excluded. It persists in single-player saves
and the authoritative online state. Hand-reveal events save an immutable snapshot of exactly
the cards shown (including an empty or scoring-cards-only reveal). The corresponding event
shows those card faces with click-to-enlarge; subsequent draws and discards cannot change it.
Only the entitled viewer receives these lines in their history, search and export. The other
seat never receives that private snapshot; unseen hands and unrevealed headlines are not recorded.
Older saves retain their existing summaries, marked as legacy rather than inventing missing details.
`src/game/history.ts` defines entries and per-seat filtering, `src/hud/parts/battleLog.ts` renders them, and
`SOLO_CDP_PORT=<private Chrome port> node tools/battle-log-browser.mjs` verifies the review UI.
`npm run test:reveals:browser` checks historical card galleries, zoom, search/export privacy and
phone layouts against the local Vite server, using a temporary browser that it closes afterwards.

Public event-driven card movements use the same awaited `Presenter.cardMove` contract locally
and online: the actual card briefly glows and flies to its destination in 620 ms at normal
pace, then commits once. A short landing cue fades without blocking the next effect; there
is no reading screen, forced pause or confirmation. Reduced motion skips the flight. Resolving
cards handed to the opponent use their existing settle journey, without a second animation.
Transfers, recoveries and forced discards are recorded under the event that caused them;
China-card transfers also state whether it is usable immediately or next turn. Ordinary hidden
draws keep their card identities private. `npm run test:transfers:browser` checks the presentation.

`?pace=0.5` runs the pauses twice as fast. Demo-only forced dice and starting-phase query
parameters are no longer used by the real match.

The track names are data in `src/game/tracks.ts`; the engine supplies the current action-round limit.

The space race uses the standard Deluxe track from `src/game/spaceRace.ts`: all eight Ops / die
thresholds, first- and second-arrival VP rewards, and the four privileges. Active privileges appear
as faction-enamel mission orders and disappear when the opponent reaches the same milestone.
See [the full table and official sources](docs/space-race.md). The single-player engine executes these privileges; the HUD derives the badges from the same positions.

### How a card is played (`src/play`)

The staging is the "spotlight" one, picked from ten in `prototypes/card-play`: one thing on screen at
a time, everything else dark.

- **Choosing.** The card rises to the middle between two halves of large type. Operations open into
  four bands; pointing at one lights the countries it could be used on. An opponent's card has a red
  left half: its event happens anyway.
- **Countries.** The countries that can be chosen are lit by the map itself, along their own borders,
  the way it lights a country in focus, and the rest step back (`map.offer()`); no light of the
  staging's own is laid over them. One line says what is asked and what the country under the
  pointer would mean (the roll needed, a battleground's cost to the crisis level, why a region is barred).
- **Dice.** A solid die is thrown in from the roller's side, lands, bounces, rolls on and tips over;
  the number is struck when it falls flat, then one line of arithmetic and the verdict.
- **Consequences**, one at a time. Influence: the view goes to the country, which stands up lit as a
  country in focus does, and the number lands on it. A meter: its corner of the HUD travels to the middle of the screen, changes there, and goes
  back. Once a card's effects are being carried out no card is on show, only the small one on the table.
- **The opponent** is staged through the same calls, under a red title card; what it changed keeps a
  red tag on the map until the player's next card.

`src/play/types.ts` is the contract: a `Presenter` (what the rules side asks to have staged, for
either side) and `PlayQueries` (what the staging may ask about the game). `createSpotlight(host)` in
`spotlight.ts` is the one presenter; `board.ts` is its use of the map (`map.offer()`, the `pick`
event, `panTo`, `view`), `dice.ts` the die. `src/game/solo/engine.ts` now supplies the rules behind that contract. `standIn.ts` remains only as a legacy prototype and is not imported by the game page.

All live dice results pass through `SoloGame.roll`: it records the public arithmetic, awaits
`Presenter.roll`, checks cancellation, and only then lets the rule apply consequences. Event
handlers use `EventContext.roll` with the same serializable `RollSpec`; online replay broadcasts
that presentation to both seats without rerolling on reconnect. Use `check` with an inclusive
modified-total range for wars and trap escapes, or `contest` with an explicit winner/tie for
Olympics and Summit. A targeted check can supply the country's before/after situation so the
presenter focuses the actual map. Each event retains its own outcome and tie rules; adding an
event must not silently replace this call with a log-only roll.

### Using the HUD module

```ts
import { Hud } from './src/hud/Hud';

const hud = Hud.create(container, { rules, sides: scenario.sides, cards, lang: 'zh' });
hud.setState(state);                    // HudState, see src/hud/types.ts
hud.on('play', (cardId) => {});         // the player dragged a card out of the hand
hud.on('deck', () => {});               // the draw pile was clicked
hud.on('catalog', () => {});            // "all cards" was clicked; shown only when the `catalog` option gives a count
hud.briefFor(map).setState(mapState, standings); // the country and region card: the map's MapState,
                                                 // and each side's standing per region (RegionStandings)
```

Two optional inputs feed the region card: `rules.scoring` (what each standing is worth, by region id)
and `term` (how a word of the rules is marked up; the play screen passes the cards' own, from
`src/game/terms.ts`). Without the first the scores row is left out, without the second the words are
only set in gold.

Like the map, the HUD computes no rules: it draws the `HudState` it is given, animates what changed
since the last one, and reports what the player did. `demo: true` makes the meters clickable (the
`poke` and `step` events) for looking at their states before anything drives them.

It is drawn in `rem` and expects the page to tie `1rem` to the window, 10 px at 1600 x 900; see the
top of `src/hud/hud.css` and `src/game/game.css`. The page also hides the map's own card.

The HUD never looks inside a card. It is handed a `CardSource` (`face`, `back`, `fit`, `describe`),
which the play screen takes from `src/cards/deck.ts`. That file is the only seam between the two.

`src/hud/cardMotion.ts` presents deals, discard/removal flights and recycling the discard pile.
The pure route planner consumes the receiving seat's HUD state; opponent draws use anonymous
backs. `deckRecycles` is a public counter, not deck order. The presenter waits for queued card
journeys before advancing, and supplies special destinations for China and cards retained in play.
Resolving cards remain readable at the side; hovering or focusing one holds it until the reader
leaves (Escape also releases it). The journal cover retains the latest public action card.
Run `npm run test:card-motion:browser` with the local Vite server running for the isolated browser
checks, including card flights, the coup panel, journal cover, map hover and mobile expansion.

## Making another map

A scenario is one `scenario.json` (sides, regions, countries, connections) plus an optional
`shapes.geojson` for outlines that present-day borders cannot produce. Each country lists the
Natural Earth shapes it is made of: `adm0:FRA` for a whole country, `unit:FXX` for one map unit
(mainland France without its overseas departments), `custom:gdr` for a polygon from `shapes.geojson`.
Land that no country claims is drawn as an old parchment chart.

The connection graph is set by `landLinks` in the scenario:

- `derive` (default): every shared border becomes a land link; `links` only lists sea links.
- `thinned`: as above, then the longest side of every triangle of bordering countries is dropped.
  The board stays connected but loses most of its redundant and crossing lines.
- `manual`: `links` is the whole graph, for a hand-designed board.

Node positions are worked out by the generator: each node starts inside its country and crowded
nodes are eased apart so none overlap, even with the whole world on screen. Give a country an
explicit `node: [lon, lat]` to place it by hand.

Run `npm run mapgen -- <id>` and open `?scenario=<id>`. Add `--debug` to also write preview images
of the intermediate layers to `assets/cache/debug/<id>/`.

The map is a cylinder cut in the Pacific (`LON0` in `tools/mapgen/build.ts`), and the runtime draws
it again beside itself wherever the view crosses that cut. The generator therefore measures its
distance fields (coast, shallows, borders) across the cut as well, so the sea looks the same on
both sides of it. A link marked `wrap` is drawn as two pieces, one to each edge; they meet at the cut.

The `coldwar` scenario follows the [board audit](plans/maps.md#11-audit): 84 countries, 29
battlegrounds, six scoring regions and two superpowers, with exactly 121 undirected connections.
It uses `manual` links: solid cream within regions, red dashed between regions, and black with a
light outline for superpowers. Every link is a line inside a casing of the opposite tone, so it reads
on any ground and is not taken for a border (`src/map/links.ts`). USA–Japan is one connection drawn at both Pacific map edges.
Connections route around unrelated markers, so a line passing through another country cannot
suggest an extra adjacency. Hovered and standing connections use the same routes.

USA and USSR are fixed home spaces outside the scoring regions, with no influence editor or
stability number. China and Mongolia are outside the Soviet territory. The optional Chinese Civil
War space is kept in the [reference JSON](data/reference/twilight-struggle-connectivity.json),
but is not enabled in this standard map. Multi-country spaces use approximate modern geographic
footprints; those shapes never determine adjacency. Demo and random situations remain sandbox
presets, not game setup.

## Chinese card catalog and term help

All 110 cards can be looked through from both pages: on the play screen from the **全部卡牌** bar in
the HUD's bottom-left corner (`mountCardLibrary({ trigger: false })`, opened on the HUD's `catalog`
event), in the sandbox from the floating **牌库** button. Open
`/game.html?card=21` for a specific card. Search by Chinese title, number, English title or Chinese
rule text; filter by era and side. The HUD hand, table and piles use these same card faces.

- `src/cards/catalog.json`: canonical content. The review room's `final/cards.json` symlinks here.
- `src/cards/render.js`, `card.css`, `deck.ts`: shared face renderer and HUD CardSource adapter.
- `src/cards/glossary.json`, `terms.js`, `terms.css`: definitions and five semantic highlight colors.
- `src/cards/tooltips.js`: delegated hover/focus/touch help, including inside modal dialogs.
- `public/cards/`: shipped art, fonts, back, and compressed help videos. No runtime prototype imports.
- `videos/card-help/`: editable HyperFrames sources using captures of this project's map, cards and HUD.

Video starts only when help is opened and stops when it closes. Reduced-motion preferences display
a poster until explicit playback. Esc closes help before its surrounding card viewer. Rule explanations
link to the [GMT rulebook](https://s3-us-west-2.amazonaws.com/gmtwebsiteassets/nnts/TS_Rules-2015.pdf).

`npm run cards:assets` refreshes runtime art/font copies after bulk prototype changes; individual
`save-art.mjs` and `build-zh-font.mjs` changes sync automatically. `npm run cards:review` keeps the local
commenting room at port 4311. `npm run cards:check` verifies localization, term grouping, metadata,
review persistence and media serving. Card presentation and event resolution are integrated. The renderer draws cards; the separate single-player engine applies their rules.

## Game audio

Single-player and online play share the same presentation-timed sound system. Card paper,
influence pieces, physical die contacts, coup results, control changes, scoring, space launches,
DEFCON drops and match results have separate short cues. Background music follows the player's
US/Soviet seat. The speaker in the time panel opens mute, independent volume controls, previews
and attribution. Browser gesture unlocking, background pause, music ducking, loop crossfades and
local preference persistence are handled without touching the rules engine or multiplayer state.

See [audio provenance and rebuild instructions](assets/audio/README.md). Run `npm run test:audio`;
with private Chrome on 9350 run `node tools/audio/browser.mjs`. For the two-seat browser regression,
set `AUDIO_CHECK=1 ONLINE_CDP_PORT=9350 ONLINE_ORIGIN=http://127.0.0.1:8787` before
`node tools/online-browser.mjs`.
