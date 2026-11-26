# Room chat

A floating conversation on the left of multiplayer games. The blue/red sender label comes from the authenticated US/Soviet seat; the body stays warm white. New messages never fade or auto-collapse. The minus button explicitly collapses the conversation; new messages add an unread count without expanding it. This preference is saved per room.

The panel grows with its contents, up to a bounded scroll area. It sits above the piles and follows the timeline footer, passive shelves, country brief and resolution card; narrow screens also leave room for the status panel. Idle text is pointer-transparent to the map. Click the conversation heading to read/scroll/select history, or the compose button to type. Enter opens input when the game is not already using Enter to confirm an action. Enter sends; Escape closes input without hiding history. Chinese composition is protected. Leaving the input retains its draft.

## Transport

`src/net/chat.ts` owns UI state and `chat.css` owns its appearance. It receives messages from the existing authenticated socket in `src/net/client.ts`. Chat does not call the game presenter, animation queue or rules engine, and never increments the game revision.

The socket opts in with `auth.chat: true`, so older open clients do not receive unrecognized packets. `chat-send` carries plain text and a request ID; the worker derives the seat from the socket attachment. The server stores the latest 100 messages separately under the room's `chat` storage key. A history packet restores messages on authentication/reconnect, and acknowledged retries are deduplicated by seat and request ID within retained history. Room expiry also removes chat.

The server permits 300 UTF-16 code units per message and at most five new messages per seat in five seconds. The client renders plain text, reports rejected/unconfirmed sends inline, and retries with the same ID. A disconnected input keeps its draft. Chat failures use their own packet type and do not reset a pending game action. Messages may still be sent after a game finishes, until the room expires.

## Local verification

- `npm run test:online`: chat normalization/rate/retention unit checks and existing match replay tests.
- `npm run build && npm run typecheck:worker`
- `npx wrangler dev --local --port 8787` serves the complete local room experience.
- `npm run test:chat:server -- http://localhost:8787`: both seats, sender authenticity, retry, reconnect, rate/length rejection, legacy clients and unchanged game state.
- `CHAT_CDP_PORT=<private Chrome port> npm run test:chat:browser`: two independent player contexts, real typing/clicks, IME, explicit folding/reload, disconnect draft, retries, scroll position, persistent messages and desktop/mobile layout.
- `ONLINE_ORIGIN=http://127.0.0.1:8787 ONLINE_CDP_PORT=<private Chrome port> npm run test:online:browser`: existing placement/headline/reconnect interactions.

This change is prepared and tested locally; it has not been deployed.
