# Frontend priorities and handoff

This is a working list of frontend ideas, not a commitment to implement every item. Check open GitHub issues and claims before starting work.

## Current work

- [ ] Verify card appearance at phone widths in both languages and rerun the full suite after the private-blackjack countdown failure (issue #101).

- [ ] Check the private blackjack lobby and match at 320 px in both languages before opening the PR, then smoke-test a host and guest on the deployed API (issue #80).
- [x] Improve narrow-screen game finder filters and shortcut touch targets (issue #60). The filters use a two-column layout on small screens; game shortcuts and controls have larger touch targets.
- [x] Landlord, favourites, recent games, a Blackjack guide, and server-settled ranked Slots are present on main.
- [ ] Verify the mobile game finder in a real browser at narrow widths, including long translated labels and keyboard navigation. The current change has not been visually checked in a browser.

## Candidate next features

- [ ] More guided first-game tutorials, starting with another game after checking which players find difficult. Follow the existing optional Blackjack guide and support both languages.
- [ ] Achievements or personal challenges for exploring different games. Agree the goals and rewards before implementation; avoid tying rewards to unverified results.
- [ ] Practice experience: make the distinction between practice coins and ranked Slots clearer throughout the interface. Confirm the desired flow and wallet behavior before changing it.
- [ ] PvP: begin with a design for private turn-based rooms with invite codes. Coordinate the server-owned game state, hidden cards, reconnects, and settlement before building a UI. Matchmaking can be considered later.
- [ ] Broader mobile and accessibility pass across individual game tables, including overflow, touch targets, focus order, and reduced motion.

- [ ] Personal statistics dashboard: build on existing per-game records with trends, favourite games, personal bests and play time. Explain which results are browser-reported and avoid presenting them as verified.
- [ ] Locations and travel: explore a post-login destination picker with a clear way to switch locations and see each location's games. Agree the locations and how they relate to the existing filters first.
- [ ] Friends and sharing: explore a friends list and ways to invite or share with friends. Coordinate account, privacy and backend requirements before designing flows.
- [ ] Card cosmetics: let players choose card-front and card-back styles; decide how preferences and any unlocks are saved.
- [ ] Currency presentation: explore the planned Blibbucks, Bintar and Gigglebucks denominations. Confirm their relationship to existing practice and ranked balances before displaying or converting them.
- [ ] Expand the game catalogue with well-known board, card or arcade games; agree the first game and its rules before implementation.
- [ ] Competitive events or tournaments: only consider these after server-authoritative game results and wallet settlement are available for the relevant games. Clearly distinguish ranked standings from practice statistics.
- [ ] Change username: a name field on the profile or settings screen, messages for invalid and taken names in English and Chinese, and a confirmation step. Build after the backend endpoint in `docs/tasks/backend.md` exists. Idea source: `FEATURE-CHECKLIST.md`, "Account and profile".

## Real-life feature ideas (UI side)

These come from `FEATURE-CHECKLIST.md`. The UI shows state and takes player input. The API side owns money, rules, timers and stored state. These are unchecked ideas, not approved specifications.

- [ ] Home screen after login: a header "Where do you want to go?" with a coloured button for each location.
- [ ] Location screen: each location shows its own games (for example "Arcazo's Area").
- [ ] Travel button to move a player to a different location.
- [ ] Game category browsing: family board games, classic board games, family card games, casino games, standard deck card games, arcade games.
- [ ] Share with friends: a share action from a game or profile.
- [ ] Card style cosmetics for card fronts and backs.
- [ ] Avatars shown on player profiles and at tables.

## Handoff for Sonnet

The first change is scoped to game navigation CSS, not individual game tables. Start with the browser and keyboard check above, then choose one candidate with the owner and claim its issue before coding. Do not treat unchecked ideas as approved specifications. Check `AGENTS.md` and the in-progress issue list before touching shared files.

## Validation for issue #60

- Production build passed.
- Game filter and navigation tests passed (36 tests).
- Still needed: real-browser visual and keyboard checks on narrow screens, including Chinese labels.
- [ ] Private blackjack: add room creation and invite joining, player-ready and gameplay screens, and reconnect handling after the backend room and match APIs exist (battle-bricks-backliners #28).
- [x] Added bilingual update log entries for Landlord, Shengji, leaderboard stats and game finder improvements (#77).
- [ ] Check Shengji in the game picker in a real browser (#77).
- [ ] For local frontend tests on this machine, run npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=3 to avoid worker hangs.
- [ ] Check the new Landlord and Shengji rules tables (`.rulestable` style, PRs #81 and #92) inside the running app on a real phone. A 390px render of the Rules page in Chrome, in English and Chinese, showed no overflow; the full app, login and menu were not checked.
- [ ] Check the private blackjack stake picker, leave warning and claim countdown inside the running app with two accounts, on a phone, once the backend stakes (battle-bricks-backliners #51) are deployed. A 320px render of the lobby, a staked match with the leave warning and claim countdown, and a settled match showed no overflow; the deployed API was not tried.
- [ ] Once backend PR #58 (battle-bricks-backliners) is deployed, try the "Check the room" button and the claim countdown that starts straight away (`awaiting`/`claimableAt`) against the real API with two accounts. The join form with the new button row and the longest preview text was rendered at 320 px in both languages with no overflow (static markup and the built CSS, not the running app). Until then the claim button falls back to the board and the `TOO_EARLY` reply, and "Check the room" shows "Room unavailable" because the route does not exist yet. Then the fallback can be removed (PR #97).
- [ ] If the backend puts the idle deadline on the room response (`claimableAt`, now only in the `TOO_EARLY` error), start the claim countdown without needing one failed claim first (battle-bricks-backliners #52).
