# Country identity: ten directions

A standalone comparison sheet for one question: how should each country on the map get its own
character? Ten treatments, each mocked up on the same six countries (Japan, Egypt, France, the
Soviet Union, Brazil, India) over real backdrops from the game map.

Open `index.html` in a browser. There is no build step and nothing is fetched from the network.
Hover a tile to see its in-focus state, or tick the box at the top to show them all at once
(`index.html?focus=1` does the same).

This folder does not depend on the game's code, and the game does not depend on it.

## The ten

| # | Treatment | Seen | Cost to make for ~90 countries | Main risk |
|---|---|---|---|---|
| 1 | Low-poly 3D miniature | Zoomed in | High: one model each | Clashes with the painted map; this is the version removed from the game |
| 2 | Paper stand-up that folds out of the map | Zoomed in | Medium: one flat illustration each | Needs a clear spot on each country's land |
| 3 | Landmark silhouette built into the node | Always | Low: one single-colour icon each | Makes every node wider |
| 4 | Antique-atlas ink vignette drawn on the land | Zoomed in | Medium: one line drawing each | Faint on dark water; small countries have little room |
| 5 | Emblem medallion on the node | Always | Low: one symbol each | Choosing a symbol per country needs care |
| 6 | Flag pennant on the node | Always | Very low | Period flags differ from today's; several are similar |
| 7 | Name in the country's own script and typeface | Zoomed in | Low, plus a font per script | Unfamiliar scripts must stay secondary to the plain name |
| 8 | Traditional pattern woven into the territory | Zoomed in | Low: one tiling pattern each | Competes with the control colours, which carry game state |
| 9 | Ambient motion on focus (petals, sand, snow) | On focus | Low: a handful of particle types | Says nothing while the country is at rest |
| 10 | Period postage stamp in the info card | In the card | Medium: reuses the landmark art | Not visible on the map at all |

## Suggested combination

6 + 7 + 4 + 10, shown as the last row of the sheet:

- a flag pennant on the node, readable at any zoom and adding nothing to the node's width;
- once zoomed in, the name in its own script above the plain name, and an ink vignette on the land;
- the stamp in the information card.

None of these uses the two side colours, so control and influence stay unambiguous. Treatments 2
and 4 are alternatives for the same job (art on the land); 2 is louder, 4 sits closer to the map's
existing parchment style.

## What is real and what is a stand-in

- The landmark shapes, emblems, flags and patterns are simple vector drawings made for this sheet.
  They show the idea and the level of detail, not final art.
- Native-script names use fonts already on the machine, so they look different on other systems.
  The game would need to ship its own font subsets, as it already does for Chinese.
- The low-poly images are renders of the models that were removed. Their source is kept in
  `reference/lowpoly-models.ts` in case that direction is revived; nothing loads it.

## Files

```
index.html  styles.css  app.js     the sheet
assets/terrain-*.jpg               backdrops captured from the game map
assets/lowpoly-*.png               renders of the removed 3D models
reference/lowpoly-models.ts        source of those models, unused
```
