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
- Do not enable GitHub Actions deployment during the initial migration.
- Production uploads remain manual.

## Test / staging target: `nami`
- `nami` is the dedicated test target for Kansai Surfer KS.
- Test uploads must target `nami` only and must not overwrite or deploy to the production site `kansai.rss7.net`.
- The exact public test URL and absolute server path must be verified from the hosting configuration before they are hardcoded. Do not infer them from memory.
- The logical remote test location is `nami`; the verified server-side path is supplied through `KS_NAMI_FTP_REMOTE_DIR`.
- Any future test deployment workflow should be manual-only by default until separately reviewed. This section does not enable production auto-deployment.
- Destructive mirror/delete behavior is not allowed for the test target unless separately reviewed and explicitly approved.

## FTP credential design for `nami`
Use a dedicated GitHub Actions Environment named `nami` (or equivalent secret storage) for connection credentials. Never commit credential values into this repository.

Secret names:
- `KS_NAMI_FTP_HOST`
- `KS_NAMI_FTP_USER`
- `KS_NAMI_FTP_PASSWORD`

Non-secret environment/repository configuration when verified:
- `KS_NAMI_FTP_PORT`
- `KS_NAMI_FTP_REMOTE_DIR`
- `KS_NAMI_BASE_URL`

Rules:
- `KS_NAMI_FTP_PASSWORD` contains the real FTP/FTPS password only in secret storage; Markdown, source code, Issues, PRs, logs, and chat-persistence files must never contain the value.
- Deployment must fail closed when a required credential or verified remote path is missing.
- Deployment scripts must not echo, print, or persist secret values.
- Production and `nami` credentials/paths must remain separate.

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
