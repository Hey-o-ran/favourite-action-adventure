# Agent coordination rules

This repo is worked on by several AI agents at once (Claude Code and Codex sessions). These rules apply to every agent, whichever tool it runs in. `CLAUDE.md` holds the same rules for Claude Code.

## Before you start

1. **Check the open claims.** Run `gh issue list --label in-progress --state open`. If an issue you want is already assigned or labelled `in-progress`, don't start it. Pick another issue or ask the owner.
2. **Claim your work.** Assign yourself to the GitHub issue (`gh issue edit <n> --add-assignee @me`) and add the `in-progress` label (`gh issue edit <n> --add-label in-progress`). Do this before writing any code.
3. **Use your own worktree.** Create one for your branch:
   `git worktree add ../favourite-action-adventure-<topic> -b <topic>`
   Never edit files in the main checkout (`D:\Haoran\projects\favourite-action-adventure`).
4. **Sync first.** Run `git pull --rebase` before you start, and `git status` before each edit.

## While you work

- **Stay inside your claim.** Only edit the files your issue needs. If you need a file another agent has claimed, stop and comment on the issue instead of editing it.
- **Commit small and often.** Small commits make handoffs possible. Uncommitted work stays in your worktree and can't be picked up by anyone else.
- **Never run `deploy.yml` or trigger a deployment.** Deploys are owned by the repo owner. Merging to `main` starts `deploy.yml` when the change touches `card-casino/**` or `.github/workflows/deploy.yml`, so those changes count as deploys.
- **Never commit secrets.** No passwords, API keys, account IDs or login details go into any file in the repo, including this one, issues, PRs, or commit messages. If you see one in the repo, tell the owner rather than copying it anywhere.

## Reporting progress

- **Say your task at the start.** Tell the user which issue you're working on and which role you're in (for example "Backend, issue #12, Opus").
- **Show progress as a percentage.** Post progress in chat and as a comment on the issue at each milestone, in this form: `Progress: 40% (2 of 5 steps). Done: <what>. Next: <what>.`
- **Report blockers right away.** If you're stuck, comment on the issue and say what you need.

## Future task ideas

Ideas for later work go in your area's list, not in the feature checklist:

- Frontend agents: `docs/tasks/frontend.md`
- Backend agents: `docs/tasks/backend.md`

Each list item is one line: `- [ ] <task>, found while working on #<issue>`. Only edit your own area's list. Tick an item off (`- [x]`) when it's been claimed, and link the issue that claims it.

## When you finish or hand off

1. Push your branch and open a pull request into `main`.
   - **Before merging anything**, run the checks in `card-casino/`: `npm ci`, `npm test` and `npm run build`. All three must pass. If any fails, don't merge; fix it or report it on the issue.
   - **If the PR touches neither `card-casino/**` nor `.github/workflows/deploy.yml`**, you may merge it yourself once the checks pass (`gh pr merge <n> --squash`).
   - **If it touches either of those**, don't merge it. Comment on the PR that it's ready, and the owner will merge and deploy it.
   - Check which files a PR touches with `gh pr diff <n> --name-only` before merging.
2. Comment on the issue with what's done and what's left, so another agent can continue.
3. Remove the `in-progress` label and your assignment (`gh issue edit <n> --remove-label in-progress --remove-assignee @me`).

## Taking over unfinished work

Unfinished work lives on its branch, not in someone else's folder. To take it over, check out the branch in a new worktree and continue there. Don't copy another agent's files by hand.

## Roles

This repo, `favourite-action-adventure`, is the **frontend**. The backend is a separate repo, `battle-bricks-backliners` (API Gateway, Lambda, Cognito, DynamoDB, deployed with CDK). Each repo has its own `AGENTS.md`, and that file governs the work done in that repo.

Each agent has one area. Only claim issues in your own area. If an issue spans both repos, split it into a backend issue in `battle-bricks-backliners` and a frontend issue here, and claim your half.

- **Backend: Opus and Sol.** Work in `battle-bricks-backliners`, following its `AGENTS.md`. Don't make backend changes in this repo.
- **Frontend: Sonnet and Terra.** Work in this repo: screens, games, styling, and the client code that calls the backend. Files: everything under `card-casino/src/`, including `api.ts`, `validate.ts`, `abuse.ts`, `adminGate.ts`, `balanceSync.ts`, `components/`, `games/`, `i18n/`, `App.tsx`, `main.tsx` and `index.css`.
- **Shared files** (`package.json`, `vite.config.ts`, `.github/workflows/`, `AGENTS.md`, `CLAUDE.md`, `FEATURE-CHECKLIST.md`, `docs/` except `docs/tasks/`): only the repo owner changes these, unless the owner assigns the issue to you.
- **Task lists** (`docs/tasks/frontend.md` for frontend, `docs/tasks/backend.md` for backend): each area's agents edit their own list.
- **Stay in your area for review too.** Agents review PRs in their own area. Backend agents review backend PRs, and frontend agents review frontend PRs.

## Boundaries by role

- **Feature agents**: build one claimed feature, on one branch, in one worktree.
- **Review agents**: read and comment on PRs. They don't push to feature branches.
- **Only the repo owner** deploys, merges PRs that touch `card-casino/` or `deploy.yml`, and changes this file.
- **Any agent** may merge a PR in this repo that touches neither of those paths, following the rule above. Merging in `battle-bricks-backliners` follows that repo's `AGENTS.md`.

## Project knowledge

- Product ideas and the feature list: `FEATURE-CHECKLIST.md`.
- Domain terms: `GLOSSARY.md` (if present). Decisions: `docs/adr/`.
- Issue tracker and triage labels: `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md`.
