---
name: add-card-game
description: Add a new game to the card-casino site (rules logic, game screen, rules page, English and Chinese text, What's new entry, tests). Use when asked to add, build or scaffold a new casino game in card-casino.
---

# Add a card-casino game

A new game touches about ten files. Follow these steps in order so nothing is missed. Red Dog is the reference for a simple "bet, reveal, pay out" game. Use Higher/Lower or Baccarat as the reference when the game is closer to them.

## 0. Before you write code (repo rules in AGENTS.md)

1. Check for claims: `gh issue list --label in-progress --state open`. Don't start an issue someone else has claimed.
2. Claim the issue: `gh issue edit <n> --add-assignee @me --add-label in-progress`.
3. Work in a worktree, never the main checkout: `git worktree add ../favourite-action-adventure-<topic> -b <topic>`.
4. Read the newest entries in `docs/agents/history.md`.
5. Run `git status` before each edit. If a file you need already has uncommitted changes from someone else, stop and comment on the issue.

## 1. Read the template files first

Read these before copying anything, and match their patterns exactly:

- `card-casino/src/games/RedDog.tsx` (game screen, hooks, bet panel)
- `card-casino/src/games/redDogRules.ts` (pure rules logic)
- `card-casino/src/games/logic.test.ts` (how rules are tested)

## 2. Rules logic: `card-casino/src/games/<camelName>Rules.ts`

- Pure functions and types only. No React, no `window`, no randomness inside. Pass the deck in, as `startRedDog(deck, bet)` does.
- Put the numbers (payouts, multipliers) in exported constants, so the rules page can show them.

## 3. Game screen: `card-casino/src/games/<PascalName>.tsx`

- Export a named component, as `RedDog` does.
- Use the same wallet, deal-lock and bet hooks and components as the template. Don't invent new ones.
- All visible text goes through `t('game.<id>.…')`. No hard-coded English.

## 4. Register the game: `card-casino/src/App.tsx`

Add an entry to the games list with: `id`, `name`, `blurb`, `category`, `origin`, `originNote`, `players`, `type`, `skill`, `difficulty`, `popularity`, `length`, `Component`. Use category and difficulty values that the existing entries already use.

## 5. Text

- `card-casino/src/i18n/en-GB.ts` and `card-casino/src/i18n/zh-CN.ts`: add `game.<id>.name`, `game.<id>.blurb` and `game.<id>.note` to both. The keys must match exactly.
- `card-casino/src/i18n/rules.ts` (English) and `card-casino/src/i18n/rules.zh.ts` (Chinese): add `rules.<id>.*` and `diagram.<id>.*` to both. Use the same keys in both files. Keep the same `{placeholder}` names in both languages.

## 6. Rules page: `card-casino/src/components/Rules.tsx`

- Add an entry for the new id to the rules map (the one that already has `'red-dog'`, `'higher-lower'` and so on).
- If the game has a picture, add a diagram component next to `RedDogDiagram`, and give its `aria-label` a `diagram.<id>.label` key.

## 7. What's new

- `card-casino/src/components/UpdateLog.tsx`: add a new entry at the top of `UPDATES` with a new `id`, written short and plain for kids.
- `card-casino/src/i18n/zh-CN.updates.ts`: add the same `id` to `ZH_UPDATES`, with the same number of points. A test checks both.

## 8. Tests

- Add rules tests for the new `<camelName>Rules.ts`, following `logic.test.ts`.
- Add a Chinese render test for the new game, following the Red Dog case in `card-casino/src/translatedGames.test.tsx`.
- Do not add the new id to `GAME_IDS` in `rulesAndUpdates.test.tsx`. That test compares against a frozen English snapshot in `__fixtures__/english-text.json`, which only covers existing games. Changing it means regenerating the snapshot, and that needs the owner's agreement.

## 9. Verify

From `card-casino/`:

```
npm test
npm run build
```

`build` runs `tsc --noEmit` and then `vite build`. Report the exact results, including any failures. Then run the `check-translations` skill.

Never run `deploy.yml` or trigger a deployment.

## 10. Finish (AGENTS.md "When you finish" and "After each task")

1. Summarise the files changed, the tests and build results, and anything not verified.
2. Suggest one or two next steps, and mark which need the owner's decision. Write follow-ups as unchecked `- [ ]` items in `frontend.md` (UI and screens) or `docs/tasks/backend.md` (rules, money and stored state).
3. Push the branch and open a PR into `main`. Don't merge it.
4. Comment on the issue, remove `in-progress` and your assignment.
5. Add one line at the top of `docs/agents/history.md`.
