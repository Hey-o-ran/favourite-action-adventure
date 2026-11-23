# Feature checklist

- [ ] Add turn-based player-versus-player games. Start by evaluating private rooms with invite codes; consider matchmaking, server-validated moves, hidden cards, reconnection, and match settlement.

## Product ideas (from planning notes)

How this list is split between agents:

- **UI items** (screens, layout, buttons, visuals) are in `frontend.md` under "Real-life feature ideas (UI side)".
- **API items** (money, debts, timers, rules, friends and other stored state) are in this file, under the API headings below.
- Items that need both are listed here, with the UI part noted.

### Core concept (product)
- [ ] Games must be popular and well known.

### API: currency, friends and PvP
- [ ] Integrate the Gigglebucks currency: Blibbucks $1, Bintar $10, Gigglebucks $100. Bank name: "Bintarland Bank - Bibergly Betting Business".
- [ ] Friends and friends lists. (UI: the friends screen and share action are in `frontend.md`.)
- [ ] PvP game mode (see the PvP item above).

Design rules for everything in this section: money stays in-game (Gigglebucks, Blibbucks, Bintar). Do not add real-money deposits or withdrawals. Each item below is an idea to check with the owner before building. Balance numbers (interest rates, bail, fines) are placeholders.

### API: banking and debt (Bintarland Bank)
- [ ] Loans: a player borrows currency, sees the total to repay (principal plus interest) and the due date before accepting.
- [ ] Interest: loans accrue interest over time, with a clear rate shown in the bank.
- [ ] Repayments: pay back early, on time, in parts, or in full. Show the remaining balance.
- [ ] Late penalties: missed repayments add a fee and grow the debt. Repeated misses lead to collection actions (for example losing an asset or being blocked from new loans).
- [ ] Credit score: on-time repayments raise it, defaults lower it. The score sets how much a player can borrow and at what rate.
- [ ] Savings account: deposits earn interest, with withdrawal limits.
- [ ] Bankruptcy: a player can clear debts, but the score drops and loans are blocked for a set time.
- [ ] Bank statements: a history of deposits, loans, repayments, fines and winnings.

### API: money pressure and income
- [ ] Bills and rent: recurring costs taken automatically. Missed bills become debt.
- [ ] Jobs and shifts: short mini-games or waiting periods that pay steady income, with energy or time cost.
- [ ] Taxes: a share of large winnings or property income goes to the government.
- [ ] Pawn shop: trade items for quick cash at a loss, with a buy-back option.
- [ ] Insurance: pay a premium to cover part of losses from theft, fines or accidents.
- [ ] Lottery and random events: rare wins or losses (lost wallet, medical bill) that add variety.

### API: crime and consequences
- [ ] Robbery: a player tries to rob a bank, a shop or another player's wallet. Success depends on skill or stats, and the reward is capped.
- [ ] Failed crimes: a failed attempt brings a fine, a wanted level or arrest.
- [ ] Wanted level: rises with crimes and falls slowly over time. It raises the chance of arrest.
- [ ] Jail: an arrested player is locked out of games and crimes for a set time. Jail time ends early by paying bail or completing a task.
- [ ] Bail and lawyers: bail releases a player early. A lawyer lowers fines or sentence length for a fee.
- [ ] Fines and warrants: unpaid fines build up and can become a warrant. Warrants raise arrest chance until cleared.
- [ ] Police events: a raid or sting that can catch players who are carrying a large sum or have a high wanted level.

### API: property and economy
- [ ] Property: buy houses, cars or businesses. They earn income or cost upkeep.
- [ ] Shops and items: buy and sell items, with prices that change by location or demand.
- [ ] Investments: buy and sell shares in fictional companies with price changes over time.
- [ ] Auctions: players list items for sale to each other.
- [ ] News ticker: in-game news for events such as bank raids, price spikes, holidays or market crashes. (UI: the ticker display is the UI part.)

### API: life and personal
- [ ] Health and energy: energy is spent on jobs and crimes. Health drops after accidents or jail, and hospital visits cost money.
- [ ] Classes: pay for lessons to unlock better jobs or small game bonuses.
- [ ] Pets: pets need food and vet visits, which cost money.
- [ ] Gifts: send small gifts to friends (ties into Friends above).

#### Open questions for the owner
- [ ] Should a jailed player be blocked from ranked or PvP games, or only from crimes and jobs?
- [ ] Should the bank's loan rates depend on credit score, location, or both?
- [ ] Should robbery and crimes be shown as clearly fictional, with no real-world references?
