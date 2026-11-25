# Agent coordination rules

This repo is worked on by several AI agents at once (Claude Code and Codex sessions). These rules apply to every agent, whichever tool it runs in. `CLAUDE.md` holds the same rules for Claude Code.

## Before you start

1. **Check the open claims.** Run `gh issue list --label in-progress --state open`. If an issue you want is already assigned or labelled `in-progress`, don't start it. Pick another issue or ask the owner.
2. **Claim your work.** Assign yourself to the GitHub issue (`gh issue edit <n> --add-assignee @me`) and add the `in-progress` label (`gh issue edit <n> --add-label in-progress`). Do this before writing any code.
3. **Use your own worktree.** Create one for your branch:
   `git worktree add ../favourite-action-adventure-<topic> -b <topic>`
   Never edit files in the main checkout (`D:\Haoran\projects\favourite-action-adventure`).
4. **Sync first.** Run `git pull --rebase` before you start, and `git status` before each edit.
5. **Read the history.** Check the newest entries in `docs/agents/history.md` so you don't repeat or undo another agent's work.

## While you work

- **Stay inside your claim.** Only edit the files your issue needs. If you need a file another agent has claimed, stop and comment on the issue instead of editing it.
- **Commit small and often.** Small commits make handoffs possible. Uncommitted work stays in your worktree and can't be picked up by anyone else. Commit only the files your task changed, and check `git status` before each commit so no stray or generated files get in.
- **Never run `deploy.yml` or trigger a deployment.** Deploys are owned by the repo owner. Merging to `main` starts `deploy.yml` when the change touches `card-casino/**` or `.github/workflows/deploy.yml`, so those changes count as deploys.
- **Never commit secrets.** No passwords, API keys, account IDs or login details go into any file in the repo, including this one, issues, PRs, or commit messages. If you see one in the repo, tell the owner rather than copying it anywhere.
- **Both languages.** Put every player-facing text into both `card-casino/src/i18n/en-GB.ts` and `card-casino/src/i18n/zh-CN.ts`.
- **The server decides results and money.** The browser never decides ranked results, balances or settlement. Show what the backend returns.
- **No new dependencies without approval.** Don't add a package to `card-casino/` without the owner's OK, and say why you need it.
- **Keep the project cheap.** Choose the lowest-cost option that meets the goal: the fewest database reads and writes, no new tables, indexes, services or packages unless the PR explains why, and no extra build or runtime work.
- **Narrow widths for UI changes.** Check the screen at phone width, including long translated labels, before you open the PR.
- **Saved data needs a plan.** If your change alters data that is already stored, describe the migration in the PR and flag it for the owner.

## Reporting progress

- **Say your task at the start.** Tell the user which issue you're working on and which role you're in (for example "Backend, issue #12, Opus").
- **Show progress as a percentage.** Post progress in chat and as a comment on the issue at each milestone, in this form: `Progress: 40% (2 of 5 steps). Done: <what>. Next: <what>.`
- **Report blockers right away.** If you're stuck, comment on the issue and say what you need. If the same step fails twice, stop and report what you tried. Don't guess.

## Owning a pull request

All agents push under the same GitHub login, so GitHub can't show which agent opened a PR. Mark it yourself:

- Put `Agent: <name>` (for example `Agent: Sonnet`) at the top of the PR description, and `Closes #<n>` underneath.
- Assign yourself to the PR and add the label: `gh pr edit <n> --add-assignee @me --add-label in-progress`.
- Only push to a PR branch you created. To ask for a change on someone else's PR, comment on the PR.
- Before you act on a PR, check its owner with `gh pr view <n> --json assignees,body`. If it's assigned to another agent, leave it alone.

## When you finish or hand off

1. Push your branch and open a pull request into `main`.
   - **Before merging anything**, run the checks in `card-casino/`: `npm ci`, `npm test` and `npm run build`. All three must pass. If any fails, don't merge it; fix it or report it on the issue.
   - **If the PR touches neither `card-casino/**` nor `.github/workflows/deploy.yml`**, you may merge it yourself once the checks pass (`gh pr merge <n> --squash`).
   - **If it touches either of those**, don't merge it. Comment on the PR that it's ready, and the owner will merge and deploy it.
   - Check which files a PR touches with `gh pr diff <n> --name-only` before merging.
2. Comment on the issue with what's done and what's left, so another agent can continue.
3. Remove the `in-progress` label and your assignment (`gh issue edit <n> --remove-label in-progress --remove-assignee @me`).
4. Add one line at the top of `docs/agents/history.md` (newest first): date, your tool and model, branch or issue, and a one-sentence summary. If you hit a merge conflict on that file, keep every agent's line. Never edit or delete another agent's history line.

## Splitting big tasks

If a task is too big for one agent, or touches several areas (for example UI and API, or several screens), split it into parts before you write code:

1. **Write the parts down.** Add them as a numbered checklist in the GitHub issue. Each part needs a clear goal, the files it will change, and what "done" means.
2. **Keep parts small.** Each part should fit on one branch in one worktree, and parts should not edit the same files.
3. **Name the dependencies.** For example, "part 2 needs the API from part 1". Start the parts that have no dependencies first.
4. **Claim one part at a time.** Claim a part with its own branch and worktree, and note the part number in the issue. Don't work on a part another agent has claimed.
5. **Shared files.** Keep edits to the shared files (`AGENTS.md`, `FEATURE-CHECKLIST.md`, `frontend.md`, `docs/tasks/backend.md`) small and commit them quickly. When you merge, keep every agent's lines.
6. **Report your part.** When you finish a part, use the "After each task" steps below. Say which part is done and which parts are still open.

## After each task

As soon as you finish a task or hand it off, before you end your turn:

1. **Summarise what you did.** Say which files changed, the branch or PR, the tests or checks you ran and their results, and anything you did not verify.
2. **Suggest what comes next.** Give one or two concrete next steps, and say which of them need the owner's decision.
3. **Add the new tasks to the right file.** Write each follow-up as an unchecked `- [ ]` item in `frontend.md` (UI, CSS, screens, and browser checks) or `docs/tasks/backend.md` (API, money, rules, timers, and stored state). Add the issue number if one exists. Do not claim an issue or add the `in-progress` label for these items. The owner decides which ones to start.

## Taking over unfinished work

Unfinished work lives on its branch, not in someone else's folder. To take it over, check out the branch in a new worktree and continue there. Don't copy another agent's files by hand.

## Roles

This repo, `favourite-action-adventure`, is the **frontend**. The backend is a separate repo, `battle-bricks-backliners` (API Gateway, Lambda, Cognito, DynamoDB, deployed with CDK). Each repo has its own `AGENTS.md`, and that file governs the work done in that repo.

Each agent has one area. Only claim issues in your own area. If an issue spans both repos, split it into a backend issue in `battle-bricks-backliners` and a frontend issue here, and claim your half.

- **Backend: Opus and Sol.** Work in `battle-bricks-backliners`, following its `AGENTS.md`. Don't make backend changes in this repo.
- **Frontend: Sonnet and Terra.** Work in this repo: screens, games, styling, and the client code that calls the backend, which is everything under `card-casino/src/`.
- **Shared files** (`package.json`, `vite.config.ts`, `.github/workflows/`, `AGENTS.md`, `CLAUDE.md`, `FEATURE-CHECKLIST.md`, and `docs/` except the task lists): only the repo owner changes these, unless the owner assigns the issue to you.
- **Task lists** (`frontend.md` for frontend, `docs/tasks/backend.md` for backend): each area's agents edit their own list.
- **Stay in your area for review too.** Agents review PRs in their own area.

## Boundaries by role

- **Feature agents**: build one claimed feature, on one branch, in one worktree.
- **Review agents**: read and comment on PRs. They don't push to feature branches.
- **Only the repo owner** deploys, merges PRs that touch `card-casino/` or `deploy.yml`, and changes this file.
- **Any agent** may merge a PR in this repo that touches neither of those paths, following the rule above.

## Project knowledge

- Product ideas and the feature list: `FEATURE-CHECKLIST.md`.
- Frontend and backend task lists: `frontend.md` and `docs/tasks/backend.md`.
- Work history of every agent: `docs/agents/history.md`.
- Domain terms: `GLOSSARY.md` (if present). Decisions: `docs/adr/`.
- Issue tracker and triage labels: `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md`.
