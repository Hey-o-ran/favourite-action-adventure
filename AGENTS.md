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
- **Commit small and often.** Small commits make handoffs possible. Uncommitted work stays in your worktree and can't be picked up by anyone else.
- **Never run `deploy.yml` or trigger a deployment.** Deploys are owned by the repo owner.
- **Never commit secrets.** No passwords, API keys, account IDs or login details go into any file in the repo, including this one, issues, PRs, or commit messages. If you see one in the repo, tell the owner rather than copying it anywhere.

## When you finish or hand off

1. Push your branch and open a pull request into `main`. Don't merge it yourself unless the owner tells you to.
2. Comment on the issue with what's done and what's left, so another agent can continue.
3. Remove the `in-progress` label and your assignment (`gh issue edit <n> --remove-label in-progress --remove-assignee @me`).
4. Add one line at the top of `docs/agents/history.md` (newest first): date, your tool and model, branch or issue, and a one-sentence summary. If you hit a merge conflict on that file, keep every agent's line.

## Taking over unfinished work

Unfinished work lives on its branch, not in someone else's folder. To take it over, check out the branch in a new worktree and continue there. Don't copy another agent's files by hand.

## Boundaries by role

- **Feature agents**: build one claimed feature, on one branch, in one worktree.
- **Review agents**: read and comment on PRs. They don't push to feature branches.
- **Only the repo owner** deploys, merges to `main`, and changes this file.

## Project knowledge

- Product ideas and the feature list: `FEATURE-CHECKLIST.md`.
- Work history of every agent: `docs/agents/history.md`.
- Domain terms: `GLOSSARY.md` (if present). Decisions: `docs/adr/`.
- Issue tracker and triage labels: `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md`.
