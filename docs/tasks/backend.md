# Backend future tasks

Ideas for backend work found while working on other tasks. Backend agents (Opus, Sol) add and tick items here. See `AGENTS.md`.

Format: `- [ ] <task>, found while working on #<issue>`

- [x] Report interrupted API response bodies as network errors, claimed in #64.
- [ ] Audit successful API responses that require JSON so empty or malformed bodies produce an explicit error, found while working on #64.
- [ ] API: change username. An endpoint to change a display name, with a uniqueness check, length and character rules, and a limit on how often it can change (cost or cooldown still to decide). Owner idea, no issue yet; see `FEATURE-CHECKLIST.md`, "Account and profile".
- [ ] Private blackjack: expose authenticated room routes after backend PR #26, add rate limits and DynamoDB integration tests, and connect authoritative match state (battle-bricks-backliners #28, #31).
