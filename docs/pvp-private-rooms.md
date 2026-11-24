# Private rooms for turn-based PvP: evaluation

## Recommendation

Start with authenticated, two-player private rooms for one selected turn-based game, without matchmaking or real-money transactions. A host creates a room and shares an invite code; a second player joins, both confirm readiness, and the server starts the match. Agree on the first game, stakes and timeout rules with the owner before implementation. Codes are invitations, not identity or authorization.

The frontend currently calls the separate account API (`card-casino/src/api.ts`). Multiplayer requires coordinated backend changes there; no existing room service is established in this repository. Verify the backend's actual persistence and wallet guarantees before selecting infrastructure or promising atomic settlement.

## Lifecycle and rules

- Create: an authenticated host chooses game and permitted settings. The server creates an expiring, high-entropy code and a waiting room. Limit creation and code guesses; never expose codes in public listings or logs.
- Join: an authenticated second account submits the code. Atomically check expiry, capacity, host identity and room state; reject duplicate seats and simultaneous joins beyond capacity. Return only the caller's permitted view. The host can cancel while waiting; unused rooms expire.
- Ready and start: both players confirm the same settings. The server atomically transitions the room into a match once, assigns seats, initializes random game state on the server and records its version. Reject stale readiness after settings change.
- Play: each action carries a unique action ID and expected version. Authenticate the player, check membership, turn, phase and legality, then atomically persist the action and next state. Duplicate action IDs return the original outcome; stale versions return a conflict and a fresh authorized view. Never trust a client result or client-generated shuffle.
- Finish: the server determines the result from persisted state. Persist a unique match settlement record and use an idempotent wallet operation so retries cannot pay twice. If wallet and match state cannot be committed together, use a durable pending-settlement workflow with retries and reconciliation; do not mark a match paid until confirmed. Define reservation, refunds, draws and abandoned games before enabling stakes.

## Privacy and reconnection

Store authoritative state server-side and build a separate response for each seat: never send the opponent's hidden cards, deck order or secret random seed. Authorize every read and action against room membership, including after reconnect. A reconnecting player fetches their current view and version; the server remains authoritative if a response was lost. Polling is a reasonable first transport for turn-based play; measure latency and load before adding push. Define a server-clock deadline, grace period, forfeit and appeal policy before enforcing disconnect penalties. Room expiry must not erase unsettled matches.

## Proposed delivery

1. Select a game and agree on rules, invite expiry, cancellation, disconnect handling and whether the first release has stakes.
2. Inspect the separate backend's authentication, data model, transaction limits and wallet APIs; design the match and settlement boundary there.
3. Implement the room and game state machine with access-controlled player views and concurrency tests; integrate a minimal lobby and reconnect flow in this frontend.
4. Test simultaneous joins and moves, duplicate requests, stale versions, hidden-information leaks, reconnects, expiry and settlement failures. Release behind a feature flag and monitor stuck rooms and pending settlements.

Matchmaking can later place eligible players into the same server-controlled match flow. It should not depend on sharing invite codes or weaken membership checks.

## Open decisions

- Which game and supported player count should be first? Are guests allowed, or only registered accounts?
- Are matches initially free, or do both players reserve in-game currency? How are draws, cancellations and abandoned matches settled?
- How long do invitations and turns last, and when does a disconnect become a forfeit?
- Can hosts change settings after a player joins? Are spectators or rematches in scope?
- What privacy, abuse reporting and rate limits should apply to invitations and player names?
