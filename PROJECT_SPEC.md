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
- The public test URL is `https://nami.rss7.net/`.
- The server-side remote directory must come from the verified hosting configuration stored in the GitHub Environment; do not infer an unverified path from memory.
- Any future test deployment workflow should be manual-only by default until separately reviewed.
- Destructive mirror/delete behavior is not allowed for the test target unless separately reviewed and explicitly approved.

## Deployment configuration
Deployment connection values are stored in GitHub Environments rather than repository `.env` example files.

- `production` Environment: production credentials and verified deployment variables
- `nami` Environment: test/staging credentials and verified deployment variables
- Canonical variable names, separation rules, and deployment safety policy: `docs/PRODUCTION_DEPLOY.md`

Production and `nami` credentials, remote directories, and deployment controls must remain separate. Real credentials must never be committed to this repository.

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
