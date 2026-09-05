# Kansai Surfer KS - Current Handoff

Updated: 2026-09-05 JST

## Scope
This handoff is only for `oosaka0123-sudo/kansai-surfer-ks` and the Kansai Surfer test/production targets.

Do not mix in unrelated deployment work from other repositories such as `rss7-ai-works`.

## Confirmed current state
- Production site: `https://kansai.rss7.net/`.
- Dedicated test target: `https://nami.rss7.net/`.
- Lolipop public upload folder for the test target: `nami`.
- `nami` FTP endpoint is verified as `ftp.lolipop.jp:21`.
- The FTP-session test directory is `/nami`.
- TLS is forced by `lftp` while using the `ftp` scheme.
- Repository Actions secrets in use for the test target:
  - `KS_NAMI_FTP_USER`
  - `KS_NAMI_FTP_PASSWORD`
- `.github/workflows/test-nami-ftp.yml` is manual-only and performs a temporary write/delete probe.
- The `nami` connection/write/delete probe has been confirmed successful.
- Production deployment remains separate and manual.
- A merge to `main` does not mean production deployment.

## Next action
Complete a safe first site deployment to `nami` before touching production deployment automation.

Implementation requirements:

1. Fresh-read `AGENTS.md`, `PROJECT_SPEC.md`, `docs/PRODUCTION_DEPLOY.md`, and the current `main` tree.
2. Confirm which audited site files are actually present in the repository before treating the repository as deployable source.
3. Create a feature branch for the `nami` site-deploy workflow.
4. Keep it `workflow_dispatch` manual-only.
5. Hard-fail unless the destination is exactly the verified `nami` target.
6. Do not use destructive mirror/delete behavior in the first deployment.
7. Exclude Git metadata, GitHub workflow files, internal documentation, secrets, server-only configuration, logs, and backup archives from upload.
8. Do not fabricate missing runtime data merely to make the test site appear complete.
9. Open a PR, inspect the exact diff and checks, and merge only if safe.
10. After deployment, verify `https://nami.rss7.net/` before designing any production deployment flow.

## Content operations
Keep these regular Instagram outputs in scope:

- 06:50 JST — `今日の関西波ランキングTOP5`
- 16:50 JST — `明日の関西波ランキングTOP5`

Reels should stay within 10 seconds and show rank, spot, and size concisely, with no more than 5 hashtags.

## Security reminder
Never put FTP passwords, usernames, tokens, private runtime values, or server-only secrets into this handoff, Issues, PR text, logs, or repository example files.

## Restart instruction
On the next session, treat current GitHub `main` as SSOT. Re-read the repository rather than relying only on this handoff, then continue from the `nami` site-deploy milestone above.
