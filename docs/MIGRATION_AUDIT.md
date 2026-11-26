# KS Migration Audit

## Source reviewed
Uploaded KS ZIP (51 files in this batch).

## Current decision
Migration is being performed on branch `migration/baseline-audit`. Production and automatic deployment remain untouched.

## Classification summary
- 13 static source files: safe candidates (HTML/CSS)
- 13 PHP source files: safe after dependency/path/write review
- 12 runtime/generated JSON files: hold for per-file classification
- 5 binary assets: defer until asset migration phase
- 4 excluded files: live credentials/logs/backups
- 2 security-fix files: authentication/password handling must be corrected before public-source import
- 2 separately reviewed JSON files (`assetlinks.json`, blog article index)

## Blocked from public GitHub
- `admin/config.php` (contains live API credentials)
- all `*.log`
- backup archives / backup runtime files
- secret/private runtime data

## Security findings
- `admin/config.php` contains live service credentials and must never be committed.
- `admin/index.php` contains password handling that exposes the server-side admin password into rendered client-side content. Hold until redesigned.
- `admin/line_posts_admin.php` contains authentication/password logic and remains held for security review.
- Credentials found in uploaded backup material should be rotated/reissued before long-term production use. Never copy their values into GitHub.

## AI/CMS architecture confirmed
The uploaded source already contains an implemented AI/CMS path rather than a new-build requirement. Relevant files include AI drafting, automated wave-post generation, image generation, article save/delete, sitemap update, and blog metadata handling. These files reference server-side configuration and must be imported only after dependency review.

## Safe files already staged
- `.well-known/assetlinks.json`
- `css/line_posts.css`
- `css/line_posts_public.css`

## Runtime data
`data/*.json` is not being blindly committed. Each file will be classified as source data, generated data, or private/runtime state before migration.

## Import blocker
The current connector safety layer is blocking direct creation of additional executable PHP files from the uploaded archive. This is a tooling restriction, not a repository or code failure. Static/documentation work can continue, and the executable-source import should be completed through the Work/local Git workflow or another approved Git path.

## Deployment boundary
No change in this branch automatically deploys to production. Production remains on Lolipop and deployment remains manual until the baseline is verified.
