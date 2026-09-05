# Kansai Surfer KS

## Project goal
GitHub is the safe source-history and backup location for the existing Kansai Surfer KS website.

Production site: kansai.rss7.net
Hosting: Lolipop
Repository: oosaka0123-sudo/kansai-surfer-ks

## Initial migration policy
- Preserve the current production structure.
- Import the existing HTML, CSS, JavaScript, images, and required PHP source as-is wherever practical.
- Do not perform directory restructuring as part of the baseline migration.
- Do not enable automatic production deployment during the initial migration.
- Production uploads remain manual until the project owner explicitly changes this policy.

## Test / staging target: `nami`
- `nami` is the dedicated test target for Kansai Surfer KS.
- Test uploads must target `nami` only and must not overwrite or deploy to the production site `kansai.rss7.net`.
- Public test URL: `https://nami.rss7.net/`.
- Verified FTP host: `ftp.lolipop.jp`.
- Verified explicit-FTPS connection scheme used by `lftp`: `ftp` with TLS forced.
- Verified FTP port: `21`.
- Verified FTP-session remote directory: `/nami`.
- The Lolipop public upload folder for `nami.rss7.net` is `nami`.
- `nami` workflows remain manual-only unless separately reviewed.
- Destructive mirror/delete behavior is not allowed for the test target unless separately reviewed and explicitly approved.

## Deployment configuration
Real deployment credentials are stored in GitHub Actions secret storage, never in repository files.

### `nami`
Only these two repository Actions secrets are required:

- `KS_NAMI_FTP_USER`
- `KS_NAMI_FTP_PASSWORD`

The verified non-secret `nami` target values are fixed in `.github/workflows/test-nami-ftp.yml` and documented in `docs/PRODUCTION_DEPLOY.md`.

The manual `Test nami FTP` workflow performs a temporary write/delete probe only. It does not deploy the site. The connection/write/delete probe has been confirmed successful.

### `production`
Production deployment remains separate from `nami` and manual. Reserved production secret names are:

- `KS_PROD_FTP_USER`
- `KS_PROD_FTP_PASSWORD`

Do not create or enable automatic production upload until the repository contains the audited production-equivalent source and the upload exclusions and verified production target path have been reviewed.

Production and `nami` credentials, remote directories, and deployment controls must remain separate. Real credentials must never be committed to this repository.

Canonical deployment configuration names and safety policy: `docs/PRODUCTION_DEPLOY.md`.

## Current deployment milestone
Confirmed:

1. GitHub Actions can authenticate to Lolipop for the `nami` target using repository secrets.
2. The manual probe can write a temporary file into `/nami` and remove it again.
3. The probe is isolated from production and performs no site mirror or deletion.

Next implementation milestone:

- Add a separately reviewed, manual-only workflow that deploys the audited Kansai Surfer site source to `/nami` only.
- The first site deployment must be non-destructive and must fail closed if the target is anything other than the verified `nami` destination.
- Verify `https://nami.rss7.net/` after deployment before designing or enabling any production deployment flow.

## Content operations
Primary operational output is short Instagram Reels copy for Kansai surf conditions.

Target spots:

- 磯ノ浦
- 国府の浜
- 生見
- 小松海岸
- 伊良湖
- 静波
- 浜詰
- 高浜
- 白兎

Regular ranking schedule:

- 06:50 JST: `今日の関西波ランキングTOP5`
- 16:50 JST: `明日の関西波ランキングTOP5`

Reel format:

- Keep the Reel within 10 seconds.
- Show rank, spot name, and wave size concisely.
- Use no more than 5 hashtags.
- Do not invent wave observations, forecasts, scores, or sizes when source data is unavailable.

## Security boundary
Never commit:
- passwords
- API keys or tokens
- secret_data
- authentication secrets
- server-only secret configuration
- logs
- backup archives containing production data

Runtime/generated JSON data must be inspected before deciding whether it belongs in Git. Do not exclude it blindly.

## PHP / cron compatibility
Existing server paths, relative paths, require/include relationships, and CLI cron behavior are compatibility requirements. CLI-only cron guards must remain intact.

## Git policy
- main = confirmed source
- changes should normally go through branches and pull requests
- review before merge
- merge does not deploy automatically

## Baseline
After the production source has been safely audited and imported, record a baseline representing the known production-equivalent state.
