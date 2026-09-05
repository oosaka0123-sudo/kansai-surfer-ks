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

Secrets:

- `KS_NAMI_FTP_USER`
- `KS_NAMI_FTP_PASSWORD`

Variables:

- `KS_NAMI_FTP_HOST`
- `KS_NAMI_FTP_PORT`
- `KS_NAMI_FTP_REMOTE_DIR`
- `KS_NAMI_BASE_URL`

All values must be copied from the verified hosting configuration. `nami` uploads must never target the production directory.

## Safety rules

- Never commit real FTP/FTPS credentials, passwords, tokens, or server-only secret values.
- Do not copy secret values into Markdown, Issues, PR descriptions, logs, or chat-persistence files.
- Deployment must fail closed when a required secret, variable, or verified remote directory is missing.
- Deployment scripts must not echo or persist secret values.
- Do not use destructive mirror/delete synchronization unless it is separately reviewed and explicitly approved.
- Keep production deployment manual unless the project owner explicitly approves a change.
- A merge to `main` does not by itself mean production deployment.
- Any future `nami` deployment workflow should be manual-only by default until separately reviewed.

## Repository policy

Do not add FTP `.env` example files merely to mirror GitHub Environment configuration. The GitHub Environment is the source for connection values; this document is the source for the required variable names and operational rules.
