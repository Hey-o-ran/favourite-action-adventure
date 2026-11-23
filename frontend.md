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
