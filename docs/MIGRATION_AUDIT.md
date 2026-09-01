# KS Migration Audit

## Source reviewed
Uploaded KS ZIP (51 files in this batch).

## Current decision
Migration is being performed on branch `migration/baseline-audit`. Production and automatic deployment remain untouched.

## Blocked from public GitHub
- `admin/config.php` (contains live API credentials)
- all `*.log`
- backup archives
- secret/private runtime data

## Requires manual code review before commit
Files containing authentication/secret/token/password-related logic, including admin AI/CMS endpoints, are held back until values and dependencies are separated safely.

## Safe files already staged
- `.well-known/assetlinks.json`
- `css/line_posts.css`
- `css/line_posts_public.css`

## Runtime data
`data/*.json` is not being blindly committed. Each file will be classified as source data, generated data, or private/runtime state before migration.

## Security action
Any credentials found in uploaded backups should be treated as exposed-to-backup copies and rotated before long-term production use. Values must never be copied into this repository.
