# Kansai Surfer KS - Current Handoff

Updated: 2026-09-06 JST

## Scope
This handoff is only for `oosaka0123-sudo/kansai-surfer-ks` and the Kansai Surfer test/production targets.

Do not mix in unrelated deployment work from other repositories.

## Confirmed current state
- Production site: `https://kansai.rss7.net/`.
- Dedicated test target: `https://nami.rss7.net/`.
- Production deployment remains separate and manual.
- A merge to `main` does not mean production deployment.
- The repository currently contains governance/deployment documentation and the `nami` FTP probe workflow, but it does not yet contain the audited production-equivalent website source.
- The current production top page and `isonoura.html` were re-checked on 2026-09-06 before defining the redesign pilot.
- No existing open Issue or Pull Request was found for the same top + Isonoura redesign scope before starting this task.

## Redesign pilot decision
The first design implementation scope is intentionally limited to:

1. Top page
2. Isonoura page

The durable visual/interaction rules are now recorded in `PROJECT_SPEC.md` under `Design redesign pilot — Top + Isonoura only`.

Key decisions:
- Readability is the top priority.
- Dark / near-black background with white typography.
- Top Hero uses the approved sunrise/ocean/surfer visual direction with text layered as HTML, not baked into the image.
- Mobile and desktop use optimized crops from the same approved Hero scene after the binary source asset is imported.
- Transparent Hero header transitions to a fixed dark header on scroll.
- Add a minimal scroll-position indicator.
- H2 headings reveal from left to right.
- Cards/content may use restrained scroll motion.
- Isonoura follows `1 page = 1 spot = 1 primary Hero photo` and must not reuse another spot's photo merely as filler.
- No invented score/size/value is added for visual effect.
- Motion must remain progressive enhancement and must not hurt loading speed or readability.

## Claude / agent orchestration
A new owner-triggered GitHub Actions workflow is being introduced as `.github/workflows/claude-implement.yml`.

Intended use:
- Create a scoped GitHub Issue with acceptance criteria.
- The repository owner comments `@claude-implement` on that Issue.
- If a supported Claude credential is configured for this repository, GitHub Actions starts Claude Code using `sonnet` explicitly.
- Claude Code is the active implementation owner for that Issue; other agents are used for review/testing rather than duplicate implementation.
- Never report Jules, Codex, Copilot, MCP, or Claude work as completed unless the run is actually observed.

## Current branch
Preparation branch:
- `chore/ks-redesign-orchestration`

Purpose:
- Save the confirmed redesign specification.
- Add the Claude implementation trigger workflow.
- Define the approved Hero asset contract and target filenames under `prototype/ks-redesign/assets/README.md`.
- Create an implementation Issue after this preparation change is merged.

Current media state:
- The approved top-Hero visual has been selected in the design conversation.
- Its binary image file is not yet committed to this Repository.
- Do not claim the approved photograph exists in Git until that binary asset is actually imported.
- The Isonoura-specific Hero image is still pending approval/import.

## Next action
1. Complete and review the preparation branch.
2. Open a Pull Request to `main`.
3. Merge only after checking the diff and workflow safety.
4. Create one scoped implementation Issue for the top + Isonoura pilot.
5. Trigger `@claude-implement` and verify the actual GitHub Actions result.
6. If Claude authentication is unavailable in this repository, record that exact blocker; do not invent a successful run.
7. Until audited production source is imported, keep code work isolated as a prototype and do not deploy it to production.
8. Import the approved top-Hero binary asset before treating the visual prototype as final; keep the Isonoura Hero slot ready until an Isonoura-specific asset is approved.
9. When a safe prototype exists, test mobile/desktop readability, scroll header, position indicator, H2 reveal, card motion, console errors, and image loading performance.
10. Only after the pilot standard is approved should the design be rolled out to the remaining spot pages.

## Deployment milestone remains separate
The existing `nami` deployment milestone is still valid and is not silently replaced by this redesign work:
- the first real site deployment to `nami` must be manual-only;
- it must be non-destructive;
- it must use audited site source;
- it must not touch production.

## Content operations
Keep these regular Instagram outputs in scope:

- 06:50 JST — `今日の関西波ランキングTOP5`
- 16:50 JST — `明日の関西波ランキングTOP5`

Reels should stay within 10 seconds and show rank, spot, and size concisely, with no more than 5 hashtags.

## Security reminder
Never put FTP passwords, usernames, tokens, private runtime values, or server-only secrets into this handoff, Issues, PR text, logs, or repository example files.

## Restart instruction
On the next session, treat current GitHub `main` as SSOT. Re-read `AGENTS.md`, `PROJECT_SPEC.md`, `HANDOFF.md`, the current branch/PR state, and relevant Actions before continuing.
