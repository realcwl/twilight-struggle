# Twilight Struggle — Deluxe 110 / prototype V2

Scope: the classic Deluxe deck, cards #001–110: 103 base cards and 7 official optional cards (#104–110). Early War: 39; Mid War: 48; Late War: 23, counting The China Card with Early War. Seven scoring cards are included. This collection does not include Turn Zero, Red Sun Rising or anniversary promotional cards.

## Rules and catalog sources

- [GMT official Deluxe product](https://www.gmtgames.com/p-927-twilight-struggle-deluxe-edition-8th-printing.aspx).
- [GMT official Deluxe VASSAL module 3.04a](https://s3-us-west-2.amazonaws.com/gmtwebsiteassets/vassal/Twilight-Struggle-Deluxe-3.04a.vmod.zip): primary source for all card numbers, Operations, factions, war periods, removal stars, persistent underlines and card mechanics. Read from the module's CardSlot metadata and individual card SVG text, without reusing its artwork.
- [GMT Deluxe rules, 2015](https://s3-us-west-2.amazonaws.com/gmtwebsiteassets/nnts/TS_Rules-2015.pdf): timing, scoring, free Coups, The China Card and general play rules.
- [Twilight Strategy full card list](https://twilightstrategy.com/card-list/): independent metadata cross-check and individual card commentary links. The review interface links directly to the corresponding card article.

Checked on 2026-11-14. Rules are concise mechanical paraphrases, not original flavor-text reproductions. The user-provided NATO rule text is retained. English card titles and effects are paired with Chinese navigation labels; these Chinese labels are interface translations, not a claim to a licensed Chinese edition.

### Cross-check details

All 110 numbers, Operations and factions agree with the independent list. Differences were adjudicated in favor of the publisher's module: #016 Warsaw Pact Formed and #017 De Gaulle Leads France have persistent underlines; #043 SALT Negotiations does not. #077 uses its full printed title instead of the secondary list's abbreviation. See `catalog-audit.json` for the per-card checklist and preserved differences. Module spelling errors in “De Gaulle” and “Debt” were corrected.

The text pass checked the quantities, targets, limits, prerequisites, duration, VP awards, discard behavior and interactions of each card. Added rulebook clarifications include NORAD cancellation by Quagmire, Shuttle Diplomacy's total-country adjustment, free-Coup geographic restrictions and the China Card handoff. These cards are a visual review prototype; they do not implement an automatic rules engine.

## Visual direction — second full pass

V2 replaces the first flag-heavy illustration pass. It uses environmental portraits, historical places, industrial machinery, everyday objects, landscape, infrastructure and close action details. Each card has its own composition, local palette and light. Regional scoring cards use regional landscapes. Flags are not used as recurring hero art. The NATO card now uses the recognizable compass sculpture and headquarters.

Every illustration is a new symbolic historical reconstruction generated with the built-in `image_gen` tool. It is not an archival photograph. No original GMT card artwork is embedded. The common frame keeps the approved horizontal title band, restrained gold border and ivory text panel, without corner number/region labels. All factions share the neutral black-and-gold back.

- Final briefs: `tools/card-review/art-direction-v2.json`.
- Complete catalog and per-card prompt: `cards.json`.
- Saved asset provenance: `art-manifest.json`.
- Website artwork: `assets/v2/001.webp` through `110.webp`.
- The first visual pass is retained only for comparison in `assets/` and `art-manifest-v1.json`; the website uses V2.

## Review and the next address pass

Start from the repository root:

```sh
npm run cards:review
```

Open <http://localhost:4311>. The server binds to the local machine. Use a different port with `PORT=4313 npm run cards:review` if needed.

Click a card to open it. Click “标注位置” and then a point on either face to attach a precise location, or comment on the whole card. Comments accept typed text and up to six images via file picker, clipboard paste or drag-and-drop. Attachments are saved as WebP images, capped at 2,000 pixels on the long side. GIF attachments become still images.

The durable review files are:

- `data/card-review/comments.json`: source of truth, with stable comment ID, card ID, card revision, face, normalized x/y point, text, attachment paths, timestamps and status.
- `data/card-review/uploads/`: attached image files.
- `data/card-review/pending-comments.md`: generated open-comment digest for the next agent pass.

When the user says “帮我 address”, read the pending digest, then the corresponding JSON entries and attached images. Change the relevant card, increase its revision, verify its preview, and resolve the specific comments with a short `resolution` note. Do not delete comments or image files. The local PATCH endpoint supports `status`, `text` and `resolution`, and regenerates the digest. Reopen resolved comments through the UI if needed.

Unsent text drafts are retained in this browser. Saved comments and images survive refreshes and server restarts. The site periodically refreshes saved comments, so another local editing pass appears without losing the review history.

Validation:

```sh
npm run cards:check
```

The checks cover catalog identity, persistence across server restart, image attachment decoding, pinned locations, resolving/reopening comments, and rejecting invalid submissions. Visual fit and actual paste/upload behavior are checked in Chrome separately.
