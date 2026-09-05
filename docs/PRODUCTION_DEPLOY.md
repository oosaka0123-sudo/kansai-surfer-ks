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
