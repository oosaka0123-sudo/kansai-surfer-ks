# Kansai Surfer KS deployment configuration

Kansai Surfer KS keeps real server connection values in GitHub Environments, not in repository files.

This document is the canonical repository reference for deployment configuration names and safety rules. It does not contain passwords, FTP user names, or other secret values.

## Environments

Use two separate GitHub Environments:

- `production` — production site `https://kansai.rss7.net/`
- `nami` — test/staging site `https://nami.rss7.net/`

Production and `nami` credentials, remote directories, and deployment controls must remain separate.

## `production` configuration

Secrets:

- `KS_PROD_FTP_USER`
- `KS_PROD_FTP_PASSWORD`

Variables:

- `KS_PROD_FTP_HOST`
- `KS_PROD_FTP_PORT`
- `KS_PROD_FTP_REMOTE_DIR`
- `KS_PROD_BASE_URL`

All values must be copied from the verified hosting configuration. Do not guess the remote directory.

## `nami` configuration

The `nami` environment is the first deployment target used for connection testing. It must remain separate from production.

Secrets:

- `KS_NAMI_FTP_HOST`
- `KS_NAMI_FTP_USER`
- `KS_NAMI_FTP_PASSWORD`

Variables:

- `KS_NAMI_FTP_SCHEME` = `ftp` for Lolipop explicit FTPS
- `KS_NAMI_FTP_PORT` = `21`
- `KS_NAMI_FTP_REMOTE_DIR` = `/nami`
- `KS_NAMI_BASE_URL` = `https://nami.rss7.net/`

The Lolipop public upload folder for `nami.rss7.net` has been verified as `nami`, so the FTP-session remote path is `/nami`.

### Manual connection test

`.github/workflows/test-nami-ftp.yml` is manual-only (`workflow_dispatch`). It does not deploy the site.

The workflow:

1. requires the GitHub Environment named `nami`;
2. fails closed unless the URL is exactly `https://nami.rss7.net/` and the remote directory is exactly `/nami`;
3. connects using explicit FTPS with TLS forced by `lftp`;
4. writes one uniquely named temporary probe file into `/nami`;
5. immediately deletes that probe file;
6. never mirrors or deletes existing site content.

This provides a real write-permission check without treating the incomplete repository as deployable site source.

## Safety rules

- Never commit real FTP/FTPS credentials, passwords, tokens, or server-only secret values.
- Do not copy secret values into Markdown, Issues, PR descriptions, logs, or chat-persistence files.
- Deployment must fail closed when a required secret, variable, or verified remote directory is missing.
- Deployment scripts must not echo or persist secret values.
- Do not use destructive mirror/delete synchronization unless it is separately reviewed and explicitly approved.
- Keep production deployment manual unless the project owner explicitly approves a change.
- A merge to `main` does not by itself mean production deployment.
- `nami` workflows must remain manual-only unless separately reviewed.
- Do not create a production upload workflow until the repository contains the audited production-equivalent source and its upload exclusions are reviewed.

## Repository policy

Do not add FTP `.env` example files merely to mirror GitHub Environment configuration. The GitHub Environment is the source for connection values; this document is the source for the required variable names and operational rules.
