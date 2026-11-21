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

## Handoff for Sonnet

The first change is scoped to game navigation CSS, not individual game tables. Start with the browser and keyboard check above, then choose one candidate with the owner and claim its issue before coding. Do not treat unchecked ideas as approved specifications. Check `AGENTS.md` and the in-progress issue list before touching shared files.
