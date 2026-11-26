# Kansai Surfer KS deployment configuration

Kansai Surfer KS keeps real server credentials in GitHub secret storage, not in repository files.

This document is the canonical repository reference for deployment configuration names and safety rules. It does not contain passwords, FTP user names, or other secret values.

## Targets

- `production` — production site `https://kansai.rss7.net/`
- `nami` — test/staging site `https://nami.rss7.net/`

Production and `nami` credentials, remote directories, and deployment controls must remain separate.

## `production` configuration

Production deployment remains manual. Do not add or enable an automatic production upload workflow until the repository contains the audited production-equivalent source and its upload exclusions are reviewed.

Reserved production secret names:

- `KS_PROD_FTP_USER`
- `KS_PROD_FTP_PASSWORD`

Verified non-secret production settings may be documented or hardcoded only after the hosting configuration is confirmed. Do not guess the production remote directory.

## `nami` configuration

`nami` is the first deployment target used for connection testing. It remains isolated from production.

To minimize manual setup, the verified non-secret `nami` connection values are fixed in `.github/workflows/test-nami-ftp.yml`:

- host: `ftp.lolipop.jp`
- explicit FTPS scheme: `ftp`
- port: `21`
- remote directory: `/nami`
- base URL: `https://nami.rss7.net/`

Only two repository Actions secrets are required:

- `KS_NAMI_FTP_USER`
- `KS_NAMI_FTP_PASSWORD`

The Lolipop public upload folder for `nami.rss7.net` has been verified as `nami`, so the FTP-session remote path is `/nami`.

### Manual connection test

`.github/workflows/test-nami-ftp.yml` is manual-only (`workflow_dispatch`). It does not deploy the site.

The workflow:

1. reads only the two `KS_NAMI_*` repository secrets above;
2. hard-checks the verified `ftp.lolipop.jp:21`, `/nami`, and `https://nami.rss7.net/` target values;
3. connects using explicit FTPS with TLS forced by `lftp`;
4. writes one uniquely named temporary probe file into `/nami`;
5. immediately deletes that probe file;
6. never mirrors or deletes existing site content.

This provides a real write-permission check without treating the incomplete repository as deployable site source.

### Isolated redesign preview

`.github/workflows/deploy-nami-preview.yml` is a manual owner-only preview deployment path for the isolated redesign prototype under `prototype/ks-redesign/`.

Trigger phrase:

- `@deploy-nami-preview`

The workflow runs only when the repository owner posts the trigger on a GitHub Issue. It is not triggered by pushes or merges.

Preview destination:

- FTP path: `/nami/ks-redesign`
- Public URL: `https://nami.rss7.net/ks-redesign/`
- Isonoura preview: `https://nami.rss7.net/ks-redesign/isonoura.html`

Safety properties:

1. deployment source is restricted to `prototype/ks-redesign/`;
2. required prototype files must exist before upload;
3. the host, port, `/nami` root, `ks-redesign` subdirectory, and public preview URL are hard-checked;
4. upload uses the existing `KS_NAMI_*` secrets and explicit FTPS/TLS settings;
5. remote delete/mirror-delete behavior is not used;
6. production files and the production FTP target are never referenced;
7. after upload, GitHub Actions verifies both public preview URLs return HTML successfully.

This preview path is intentionally separate from a future audited full-site deployment to `nami`.

## Safety rules

- Never commit real FTP/FTPS credentials, passwords, tokens, or server-only secret values.
- Do not copy secret values into Markdown, Issues, PR descriptions, logs, or chat-persistence files.
- Deployment must fail closed when a required secret or verified target setting is missing.
- Deployment scripts must not echo or persist secret values.
- Do not use destructive mirror/delete synchronization unless it is separately reviewed and explicitly approved.
- Keep production deployment manual unless the project owner explicitly approves a change.
- A merge to `main` does not by itself mean production deployment.
- `nami` workflows must remain manual-only unless separately reviewed.
- Do not create a production upload workflow until the repository contains the audited production-equivalent source and its upload exclusions are reviewed.

## Repository policy

Do not add FTP `.env` example files merely to mirror GitHub secret configuration. Keep secret values in GitHub secret storage and keep verified non-secret target configuration in reviewed workflow/docs files.

## Nine-spot maintenance (current production-equivalent scope)

Use current main for the nine spot pages; the rest of the site is still a partial migration. Keep manual, explicitly scoped production deployment. Never use generic whole-site deployment to publish these pages: a broad exclusion of data directories would omit the dedicated hourly tide JSON files.

The manifest at docs/nine-spot-unification-release-manifest.json lists all 65 spot files and their current SHA256 in the second element of each pair. The first element describes the previous release baseline. Validate against Git blob bytes (not Windows working-tree CRLF bytes). The shared nami_common.js digest is recorded separately for read-only verification; do not import or overwrite that shared file as part of this scope.

Run the 15 named regression files in tests (105 tests at the November 2026 baseline):

    node --test tests/isonoura-consistency.test.cjs tests/isonoura-unify-20261126.test.cjs tests/kounohama-20261125.test.cjs tests/kounohama-unify-20261126.test.cjs tests/ikumi-20261126.test.cjs tests/ikumi-unify-20261126.test.cjs tests/komatsu-20261126.test.cjs tests/komatsu-unify-20261126.test.cjs tests/irago-20261126.test.cjs tests/irago-unify-20261126.test.cjs tests/shizunami-20261126.test.cjs tests/hamadutu-20261126.test.cjs tests/takahama-20261126.test.cjs tests/hakuto-20261126.test.cjs tests/nine-spot-final-regression.test.cjs

For live verification run node scripts/audit-nine-spot-release.cjs from a clean main checkout. This is read-only: no FTP, no credential access, no production writes.

Before a later release, explicitly confirm destination and current source, back up all files that will change, verify existing HTTPS and FTPS bytes, upload only the scoped assets and page, confirm all new hashes and real browser behavior, and retain a rollback copy. Update the manifest for any changed file. Historical successful guarded release recipes are on the ops branches linked from PR #163. Do not rerun old recipes as their hashes and source commits are pinned to the previous release. Existing general production credentials/settings and workflow triggers must not be changed without a separate task.

Protect the spot-specific forecast coordinates, wind/swell rules, JMA station metadata, Isonoura beach-wave estimator, and Takahama D-audit input (35.65,135.45 marine; 35.49133,135.55782 weather). Tide JSON is astronomical prediction, not beach observation. At the end of each year, check the next year's official JMA tide tables. Missing data must remain unavailable; never fabricate a forecast.

### Issue #168 current-condition safety isolation

The manifest v3 adds one dedicated asset (nami_spot_current.js), used by the eight non-Isonoura pages. Isonoura continues its dedicated script and beach estimator. The legacy shared nami_common.js is not modified. The audit counts 66 spot assets plus the unchanged legacy shared file. Validate the 16 existing/new regression files (116 cases at this release). New assets must be verified before replacing the HTML that references them. Keep a previous HTML and script backup.

### Issue #168 forecast resilience and spot UX

The follow-up release updates the existing nine spot pages without changing forecast coordinates, scoring, tide tables, ranking, home, or legacy shared JS. Use all 20 regression files introduced by the nine-spot integration and #168 fixes (150 tests at this baseline). Hourly data re-fetches at JST rollover and every 15 minutes, rejects empty responses, and re-reads the applicable tide year. The map enlargement is keyboard accessible; only the preview is lazy-loaded until expansion. The Isonoura, Kounohama, Shizunami camera title convention is retained. Irago external HTTP camera embedding is replaced by a labeled link because a valid HTTPS certificate was not verified. Do not bypass TLS verification. Performance gains have not been quantified; independent provider outages can still delay initial chart rendering.
