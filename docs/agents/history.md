# Agent work history

A running log of what each AI agent has done in this repo, so the next agent can see it and build on it.

**How to use it**

- Before you start, read the newest entries.
- When you finish or hand off, add one line at the top of the list (newest first).
- Format: `- YYYY-MM-DD · <tool and model> · <branch or issue> · <one-line summary>`
- Keep each summary to one short sentence. Details belong in the commit, PR or issue.

## Entries

- 2026-11-24 · Codex (GPT-6.1) · #77 · Added bilingual update log entries for games, leaderboard stats and game finder options.

- 2026-11-24 · Claude Code (Sonnet 5.5) · track-update-log · Added a frontend.md task for the missing What's new entries (Landlord, Shengji, leaderboard stats, game finder).
- 2026-11-24 · Claude Code (Haiku 5.5) · owner-agent-rules · Added seven rules to `AGENTS.md`: both languages, server decides results and money, no new dependencies, narrow-width checks, saved-data plans, stop after a repeated failure, and never edit another agent's history line.

- 2026-11-24 · Codex (GPT-6) · #73 · Reconciled the private blackjack handoff with the current agent history and task lists.

- 2026-11-23 · Codex (GPT-6) · #72 · Recorded the private blackjack room storage handoff and follow-up tasks.

- 2026-11-24 · Codex (GPT-6) · #69 · Resolved conflicts in the private-room evaluation while retaining current coordination rules and feature plans.

- 2026-11-23 · Claude Code (Sonnet 5.5) · agent-coordination · Merged the older rules branch with main: added roles, progress reporting, PR ownership and merge rules to `AGENTS.md`.

- 2026-11-23 · Claude Code (Haiku 5.5) · account-profile-ideas · Added an "Account and profile" username idea to `FEATURE-CHECKLIST.md`, with its UI part in `frontend.md` and its API part in `docs/tasks/backend.md`; not reviewed.
- 2026-11-23 · Claude Code (Haiku 5.5) · agent-work-history-and-checklist · Opened a PR into main with the agent rules (splitting big tasks, after each task), the API rules pointing at `docs/tasks/backend.md`, and the real-life feature split; `snake.html` left out as unrelated.
- 2026-11-22 · Claude Code (Haiku 5.5) · agent-work-history-and-checklist · Added a "Splitting big tasks" rule to `AGENTS.md` (numbered parts in the issue, small non-overlapping parts, dependencies, one claim per part); committed in this PR.
- 2026-11-22 · Claude Code (Haiku 5.5) · agent-work-history-and-checklist · Added an "After each task" rule to `AGENTS.md` (summary, next steps, tasks into `frontend.md`/`backend.md`) and created `backend.md`; committed in this PR.
- 2026-11-22 · Claude Code (Sonnet 5.5) · #62, #64, #65 · Reviewed and merged PRs #63, #66 and #67; fixed existing Higher/Lower test queries that the new guide button broke.
- 2026-11-22 · Claude Code (Haiku 5.5) · agent-work-history-and-checklist · Split the feature ideas: UI items moved to `frontend.md`, API items kept in `FEATURE-CHECKLIST.md` under API headings; committed in this PR.
- 2026-11-22 · Codex (GPT-6) · #68 · Evaluated private rooms for turn-based PvP.
- 2026-11-21 · Claude Code (Haiku 5.5) · main · Re-ran `setup-matt-pocock-skills`: config was already in place; created the four missing triage labels on GitHub (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`).
- 2026-11-21 · Claude Code (Haiku 5.5) · main · Added real-life feature ideas (banking and debt, crime and jail, property, life systems) to `FEATURE-CHECKLIST.md`; not committed.
- 2026-11-21 · Claude Code (Haiku 5.5) · main · Created this log. Removed checklist ideas that the site already has (card games with coins, sorting and filters, admin panel, AWS deploy, play-time stats).
