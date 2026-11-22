# Frontend priorities and handoff

This is a working list of frontend ideas, not a commitment to implement every item. Check open GitHub issues and claims before starting work.

## Current work

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

## Handoff for Sonnet

The first change is scoped to game navigation CSS, not individual game tables. Start with the browser and keyboard check above, then choose one candidate with the owner and claim its issue before coding. Do not treat unchecked ideas as approved specifications. Check `AGENTS.md` and the in-progress issue list before touching shared files.

## Validation for issue #60

- Production build passed.
- Game filter and navigation tests passed (36 tests).
- Still needed: real-browser visual and keyboard checks on narrow screens, including Chinese labels.
