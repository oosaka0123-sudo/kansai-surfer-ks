# Kansai Surfer KS - AI Agent Rules

## Purpose
Safely maintain the existing Kansai Surfer KS website without breaking production behavior.

## Core rules
1. Preserve the current production directory structure and existing PHP paths.
2. Do not reorganize directories during the initial migration.
3. Never commit passwords, API keys, authentication secrets, private runtime data, logs, or secret_data.
4. Do not modify production deployment settings or add automatic deployment unless explicitly approved.
5. Existing CLI-only cron scripts must remain CLI-only. Do not convert them to browser/URL execution.
6. Before changing PHP path logic, verify all require/include/file paths and external data dependencies.
7. Do not invent or replace runtime data merely to make code appear functional.
8. Prefer small, reviewable changes.
9. Review changes before proposing merge.
10. Production deployment is manual until the project owner explicitly changes this policy.

## Workflow
- Work on a feature/fix branch.
- Self-review the diff.
- Check for accidental secrets and path breakage.
- Open a pull request.
- main represents the confirmed source version.
- Merging to main does NOT automatically mean production deployment.

## AI collaboration
Claude Code, Codex/ChatGPT, Gemini, and GitHub Copilot may review the project. Avoid having multiple agents independently rewrite the same files at the same time. One agent implements; other agents review when practical.

## Chat persistence and knowledge routing
When the user says `このチャット内容をリポジトリに保存して` or gives an equivalent instruction, do not copy the conversation log into the repository. Normalize only durable or restart-critical information and route it to the existing Project source of truth.

- Current confirmed project specification -> update `PROJECT_SPEC.md` in place.
- Important long-lived design rationale -> create or update `DECISIONS.md` only when such a decision actually exists.
- Reproducible operational procedure -> create or update `RUNBOOK.md` only when a reusable procedure actually exists.
- Unfinished work needed by the next AI/session -> use the Project handoff location defined by `ai-master`; if this Project has no dedicated handoff rule, use `HANDOFF.md`. Create it only when needed.
- Work history already recoverable from code, Issue, Pull Request, Actions, or Commit history -> do not duplicate it into Markdown.

Before writing, separate confirmed decisions, unresolved items, and next actions. Prefer state replacement for current specification and handoff state; avoid append-only chat summaries that can become stale. After saving, report which files were changed and what information was intentionally not duplicated.
