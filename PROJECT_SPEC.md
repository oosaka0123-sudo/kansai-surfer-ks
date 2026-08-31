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
