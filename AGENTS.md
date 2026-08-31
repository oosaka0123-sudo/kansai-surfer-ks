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
