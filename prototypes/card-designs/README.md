# Card frames

**Latest: [NATO · card 021](nato.html)** — the first finished study adapting the
user-supplied Twilight Struggle card to a simpler version of the selected V2 01 frame.
A large NATO flag, US blue, a fine brass edge, a horizontal black title and the existing
neutral black/gold back put recognition first. Its complete original event text is in
[`nato/card.js`](nato/card.js); the 81 original concepts below remain a separate deck.

Open `nato.html` to tilt, flip and inspect the flag illustration. Enter/Space flips a focused
card; Escape closes the illustration. The page works at mobile widths and respects
reduced motion. [`nato/front.png`](nato/front.png) and
[`nato/back.png`](nato/back.png) are 1500 × 2100 exports. The illustration and exact
built-in imagegen prompt are recorded in [`nato/art-direction.md`](nato/art-direction.md).
The image is bundled locally; the page has no external dependencies or build step.
`nato.html?export=front` / `?export=back` render a 500 × 700 face without page furniture
for export at device scale 3. Serve the repository with `npm run dev` or a static server.

A standalone comparison sheet for one question: what should an event card look like? Frame designs,
each with a front and a back, all mocked up on the same sample card so they can be compared like for
like. There are two rounds:

- **V1** (`index.html`): ten unrelated directions.
- **V2** (`v2.html`): ten variations on the direction picked from V1. See [V2](#v2-the-poster-framed).
- **The deck** (`deck.html`): the design picked from V2 (01, Red Enamel) carrying a full deck of 81 cards.
  See [The deck](#the-deck).

Open any of the pages in a browser. There is no build step and nothing is fetched from the network.

- Move the pointer over a card to tilt it and catch the light; click (or tap, or press Enter) to turn it over.
- **Wall view** shows only the cards, side by side. **Turn all over** flips every card.
- `index.html?only=3` shows one design, `?only=1,10` several; add `&w=460` to set the card width in pixels,
  `&view=wall` for the wall, `&side=front` or `&side=back` for one card per design.

This folder does not depend on the game's code, and the game does not depend on it.

## The deck

`deck.html` is design 01 turned from a mock-up into a card that is drawn from data, with a deck to
prove it: 81 event cards from Potsdam (1945) to Madrid (1991).

**The cards are original.** Each one is a real event of the Cold War with a title, value, effect and
illustration written for this project. None of it is taken from another game's card list, and the deck
is not meant to match one card for card.

| | Early, 1945 to 1961 | Middle, 1962 to 1978 | Late, 1979 to 1991 | Total |
|---|---|---|---|---|
| US events (blue) | 10 | 10 | 10 | 30 |
| Soviet events (red) | 10 | 10 | 10 | 30 |
| Neutral events (ivory) | 5 | 5 | 5 | 15 |
| Tallies (black) | 2 | 2 | 2 | 6 |

The field colour says what kind of card it is before anything is read. A tally is a conference that
scores one region: Potsdam (Europe), Bandung (Asia), Addis Ababa (Africa), Punta del Este (South
America), Esquipulas (Central America) and Madrid (the Middle East). The back is the neutral one from
V2: black enamel and a gold compass rose.

On the page: filter by era and kind, click a card to enlarge it, click the large card to turn it over,
arrow keys step through the filtered cards. `?era=late&side=us` filters, `?open=25` opens a card,
`?art=1` shows the illustrations alone, `?eager=1` builds every card at once instead of on scroll.

What is still a draft:

- **The effects.** The game has no rules engine yet. The texts use five terms (influence, control,
  Tension, prestige, tally) and countries and regions as the map names them, but the numbers have not
  been played and are not balanced.
- **The illustrations** are composed from about sixty flat drawings (skylines, figures, machines), so
  a tank or a speaker appears on several cards in different settings. The scene on each card is its own.
- **Card count and split** are a starting point, not a requirement of the frame.

Files:

```
deck.html
deck/cards.js            the 81 cards: side, era, value, title, place, date, text, and one line of art
deck/frame.js            front(card, uid), back(uid), fit(face): design 01 in four colourways
deck/art.js              scene(line): sky, sun, skyline, ground, parts and foreground into one picture
deck/parts-places.js     17 skylines and 3 foregrounds
deck/parts-machines.js   25 machines and structures
deck/parts-people.js     23 figures and objects
deck/art.css             the four ink palettes; deck/deck.css: the colourways and the page
deck/app.js              the page: lazy build, filters, the large view
deck/art-sheet.html      every drawing on its own, for working on them (`?src=people&scale=2`)
```

A card's art is one line, for example
`sky:rays sun:220,215,120 far:berlin transport@250,112*1.25 crate@340,230*.85:chute fore:crowd-low`.
The grammar is in the header of `deck/art.js`. Titles longer than 14 characters break into two lines,
and both the title and the rules text step their size down until they fit (`fit` in `deck/frame.js`), so
a new card needs no layout work.

## V2: the poster, framed

Feedback on V1: the poster style of 08 is the one to keep, but it needs a frame like 01 to 03 so a card
can be read quickly; and the backs should be plainer and more three-dimensional. V2 is ten answers to
that, all in the same three inks (red, black, paper) and all with the same fixed slots.

Feedback on the first V2 backs (red fields, five-point stars): the back is shared by the whole deck, so
it must be neutral. Only the front carries a side. The ten backs were redrawn on that rule.

| # | Name | Frame material | Title | Back |
|---|---|---|---|---|
| 01 | Red Enamel | Gold band on red enamel | Black bar, slanted | Gold compass rose in a gold ring, on black enamel |
| 02 | Black Lacquer | Black lacquer, red inlay line | Red bar, slanted | One gem, half blue and half red, capped in bone |
| 03 | Foundry | Riveted cast iron on red paint | Steel arrow plate | Cast gear, cream dial, a needle with a blue end and a red end |
| 04 | Letterpress | Stained wood round a paper sheet | One wood-type block per letter | Ivory block: a blue disc and a red disc overprinted |
| 05 | Banner | Red cloth, gold braid and fringe | Black satin sash | Linen, a black satin roundel, the globe in gold thread |
| 06 | Red Wedge | Black mat board over cut paper | Black bar, straight | Embossed disc, a blue wedge and a red wedge |
| 07 | Bronze | Cast bronze, red above, stone below | Black enamel plaque | The atom in bronze over a dark patina well |
| 08 | Passbook | Oxblood leather holding a sheet | Black bar, straight | Brown leather, pressed-in disc, a blank gold foil seal |
| 09 | Concrete | Poured slab with a sunk window | Stencil on a slanted black band | A disc split in two, half blue and half red, standing in a recess |
| 10 | Porcelain | White glaze under a gilt rim | Black lettering, red underline | White dial, gold hours, black hands just short of twelve |

What every V2 front has, in the same place:

- **Value** top left, as an object standing off the card (it has its own shadow and shifts on tilt).
- **Illustration** in a framed window, in the three poster inks with a halftone screen.
- **Title** on a bar or plate directly under the illustration.
- **Type line**: side and card type on the left (`SOVIET EVENT`), era on the right.
- **Rules** on their own plate or panel, with the single-use note as its last line.
- **Serial number** and place and date as small print.

The red field stands for the Soviet side on this sample card; a US card would swap it for blue and a
neutral one for paper, leaving black, the metals and the layout alone.

What every V2 back has: one emblem in relief on a plain field, and nothing else. No lettering, no
corner ornaments. The emblem sits on its own layer above the card, so it slides over its cast shadow as
the card tilts.

The back belongs to neither side. The field is the frame's own material in a neutral colour (black,
paper, wood, metal, leather, concrete, white), never the red or blue of a front. The emblems come in two
kinds, so there is a choice to make:

- **No side at all** (01, 05, 07, 08, 10): compass rose, globe, atom, seal, clock. Gold, bronze, black
  and white only.
- **Both sides in balance** (02, 03, 04, 06, 09): one shape in two halves, blue to the west and red to
  the east, the way they sit on a map.

The strip at the top of `v2.html` shows the ten fronts at hand size, which is where "can I tell what
this card is" gets decided.

V2 files live in `v2/`: `kit.js` and `kit.css` (shared inks, slot type, the halftone photo, parallax,
two more material filters) and one `NN-name.js` + `.css` pair per design. They reuse `art.js`,
`cards.css`, `card.js` and `app.js` from V1.

## V1: the ten

| # | Name | Material and idea | Reads best | Main risk |
|---|---|---|---|---|
| 01 | State Order | Red cloisonné enamel in bevelled gold, an order star for the value | At any size; strongest silhouette | Ornate: needs restraint on cards with long text |
| 02 | Monument | Green marble, cast bronze, rules cut into limestone | At any size | Heavy; a whole hand of them is a lot of stone |
| 03 | War Room | Walnut, brass and tooled green leather | At any size | Warm and quiet: least "Cold War" at a glance |
| 04 | Iron Curtain | Riveted gunmetal, stencil paint, a lit warning lamp | At any size | Cold palette flattens the art |
| 05 | Embassy | Midnight blue with gold Art Deco line work | Medium and up | Hairlines thin out when the card is small |
| 06 | Treasury | Banknote engraving: guilloche, vignette, red serial | Medium and up | Art must be redrawn as line work to sell it |
| 07 | Eyes Only | Manila file, clipped photograph, typed sheet, stamps | Large | Smallest rules text of the ten |
| 08 | Agitprop | Constructivist poster in red, black and paper | At any size | Loud; reads as one side's voice, not a neutral frame |
| 09 | Phosphor | CRT monitor: green phosphor, amber readouts, live radar | Medium and up | Monochrome art; animation on every card may tire |
| 10 | Prismatic | Full-bleed art, crystal value gem, holographic foil | At any size | Depends entirely on the quality of the illustration |

Every design keeps the same slots in the same order of importance: the value top left (so it stays
visible in a fanned hand), then the title, then the rules text, with era, serial number and the
single-use note as small print.

## V1: suggested direction

- **01 State Order** as the standard frame. It has the clearest hierarchy at hand size, and the enamel
  recolours naturally by side (red, cobalt, ivory for neutral) without touching the gold.
- **10 Prismatic** as the premium printing of any card: same slots, art run to the edge, foil on tilt.
- **02 Monument** or **03 War Room** are the alternatives if 01 feels too ceremonial; both recolour by
  swapping the stone or the leather.
- 06, 07, 08 and 09 are stronger as treatments for a special class of card (an espionage event as a
  dossier, a crisis as a monitor feed) than as the frame for all of them.

## What is real and what is a stand-in

- **The sample card** is an original stand-in written for this sheet: a real event (Havana, January
  1959) with our own title, wording and numbers. All of it lives in `card.js`; every design reads from
  that one object.
- **The illustration** is a vector drawing made for this sheet and generated in `art.js`. It shows the
  composition and how each frame re-inks the same art (colour, sepia, engraving, phosphor, duotone), not
  final art. Painted illustrations would replace it.
- **The emblem** on the backs (a wireframe globe with laurel and star, the dates in Roman numerals, the
  motto "Orbis divisus") is a placeholder mark. The game has no title on the cards yet.
- **Materials** (marble, walnut, leather, brushed steel, bevelled metal) are SVG filters, not images, so
  they stay sharp at any size. Final cards could bake them to textures.

## How it is built

- A card is 100 x 140 units. Every length inside it is in `cqw`, so the same markup scales from a hand
  thumbnail to a full-screen inspect view.
- Frames are inline SVG in a 500 x 700 viewBox; rules text is HTML laid over the frame so it wraps.
- The illustration takes its colours from CSS custom properties (`--sky-a`, `--fig-m`, `--crowd-b` ...),
  set per design.
- Tilt and glare only move transforms, so hovering never repaints the filtered artwork. The far side of
  each card is built the first time the pointer reaches it.
- Verified in Chrome. The SVG lighting filters and `cqw` units need a current browser.

## Files

```
index.html  styles.css  app.js     the sheet
cards.css                          fonts, the 3D slot, the illustration's colour hooks
card.js                            the sample card's content
art.js                             the illustration, ornaments, shared filters and metals
designs/NN-name.js + .css          one pair per design: front(), back() and its styling
assets/fonts/                      subset woff2 files and their licences
```

`v2.html` and `v2/` are the second round (see above).

To add a design, copy a pair in `designs/` (or `v2/`), change the id, and list both files in the page.
A design may set `cls` (the class its CSS is scoped under) and `key` (a prefix for the SVG ids it
defines, passed to `front(card, key)` and `back(card, key)` so one design can appear on a page twice).

## Fonts

All are open-licensed and subset to Latin (Oswald and Russo One also carry Cyrillic). Licence texts are
in `assets/fonts/licenses/`.

| Family | Used by | Licence |
|---|---|---|
| Cinzel | 01, 02, 03 and the sheet itself | OFL 1.1 |
| EB Garamond | 01, 02, 03 | OFL 1.1 |
| Playfair Display | 03, 06 | OFL 1.1 |
| Oswald | 04, 07, 08, 09, 10; all of V2 | OFL 1.1 |
| Stardos Stencil | 04; V2 09 | OFL 1.1 |
| Limelight, Josefin Sans | 05 | OFL 1.1 |
| Share Tech Mono | 06 | OFL 1.1 |
| Special Elite | 07 | Apache 2.0 |
| Russo One | 08; all of V2 except 09 | OFL 1.1 |
| VT323 | 09 | OFL 1.1 |
| Bebas Neue | 10 | OFL 1.1 |
