---
name: check-translations
description: Check that card-casino's English and Simplified Chinese text is complete and in step (UI text, rules pages, rules text files, What's new). Use after editing anything in card-casino/src/i18n, a rules page, or the update log, or when asked about missing Chinese, mismatched keys or English left in the Chinese text.
---

# Check card-casino translations

Run this from the repo root. Work in `card-casino/` for the test commands.

## 1. Run the existing translation tests

```
cd card-casino
npx vitest run src/i18n.test.tsx src/rulesAndUpdates.test.tsx src/translatedGames.test.tsx
```

These already check:

- `en-GB.ts` and `zh-CN.ts` have the same keys, none empty, with the same `{placeholders}` (`i18n.test.tsx`).
- Every rules page and What's new has no English words left in Chinese (`rulesAndUpdates.test.tsx`).
- Every update in `UPDATES` has a Chinese version with the same number of points (`rulesAndUpdates.test.tsx`).

## 2. Check what the tests don't cover

Tests do not check that `rules.ts` and `rules.zh.ts` have the same keys. Compare them from the repo root:

```
diff <(grep -oE "^\s+'[^']+':" card-casino/src/i18n/rules.ts | sort) <(grep -oE "^\s+'[^']+':" card-casino/src/i18n/rules.zh.ts | sort)
```

No output means the key lists match. Each key that differs is a missing translation.

Then check the `{placeholders}` in each key that is in both files match. The `i18n.test.tsx` check only covers the UI text, not `rules.ts`.

## 3. Fix or report

- If a key is missing on one side, add it to the other side with the same structure and the same `{placeholders}`.
- Write Chinese only where the meaning is clear. For wording with a game-rule meaning (payouts, odds, what counts as a win), flag it to the owner instead of guessing.
- Don't regenerate `__fixtures__/english-text.json`. It is a frozen snapshot, and changing it needs the owner's agreement.

## 4. Report

Give the exact test results and the diff result, with any failing test names. Say which checks you did not run.
