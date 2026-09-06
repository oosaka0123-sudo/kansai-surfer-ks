# Kansai Surfer KS - Current Handoff

Updated: 2026-09-06 JST

## Scope
This handoff is only for `oosaka0123-sudo/kansai-surfer-ks` and the Kansai Surfer test/production targets.

Do not mix in unrelated deployment work from other repositories.

## Confirmed current state
- Production site: `https://kansai.rss7.net/`.
- Dedicated test target: `https://nami.rss7.net/`.
- Production deployment remains separate and manual.
- A merge to `main` does not by itself deploy production.
- The repository still does not contain the audited production-equivalent website source.
- The first redesign pilot remains limited to Top + Isonoura.

## Redesign prototype now on `main`
The isolated prototype is stored under:

- `prototype/ks-redesign/index.html`
- `prototype/ks-redesign/isonoura.html`
- `prototype/ks-redesign/styles.css`
- `prototype/ks-redesign/script.js`

Implemented pilot behavior includes:
- dark / near-black editorial surf direction;
- exact approved Top H1 wording;
- transparent Hero header that becomes a fixed dark header on scroll;
- responsive mobile navigation;
- compact desktop section-position indicator;
- left-to-right H2 reveal;
- restrained content/card motion;
- `prefers-reduced-motion` support;
- no invented score, wave size, ranking, or live condition values;
- explicit data slots for later real-data integration.

The Isonoura prototype preserves the intended information hierarchy for advice, reports/live-camera links, forecast, spot information, map, SNS, and related content without fabricating live values.

## Media state
- The approved Top Hero visual direction is sunrise/ocean/surfer with HTML text layered above the image.
- The prototype is wired for `hero-surf-mobile.avif`, `hero-surf-mobile.webp`, `hero-surf-desktop.avif`, and `hero-surf-desktop.webp`.
- Those approved binary Hero files are not yet committed to the repository, so the current preview uses the designed dark fallback when they are absent.
- The Isonoura-specific Hero image is still pending approval/import and must not be replaced by an unrelated spot photo.

## Claude implementation evidence
The owner-triggered `.github/workflows/claude-implement.yml` connection is verified and uses Sonnet explicitly.

Observed Issue #11 implementation runs:
- first actionable Claude run reached the 30-turn ceiling before pushing a branch;
- retry reached the 60-turn ceiling before pushing a branch;
- the second retry used `claude-sonnet-5`, had no permission-denial blocker, but again reached the configured turn ceiling;
- because no Claude implementation branch was pushed, the project-manager fallback implementation was used to finish the isolated prototype and avoid further API spend on the same blocked path.

Do not describe either failed Claude run as a successful implementation.

## `nami` redesign preview — SUCCESS
The isolated preview deployment workflow is:

- `.github/workflows/deploy-nami-preview.yml`

Trigger:

- owner Issue comment containing `@deploy-nami-preview`

Source:

- `prototype/ks-redesign/`

Destination:

- FTP path: `/nami/ks-redesign`
- Top preview: `https://nami.rss7.net/ks-redesign/`
- Isonoura preview: `https://nami.rss7.net/ks-redesign/isonoura.html`

The first upload attempt reached Lolipop but failed because lftp `mkdir -p` produced an unsupported `SITE MKDIR` command. This was fixed in PR #17 by checking for the target directory first and creating the single `ks-redesign` child with standard FTP `MKD` when needed.

Verified successful deployment run:

- GitHub Actions run `34036724875`

Observed successful steps:
- checkout: success;
- source and exact nami-target validation: success;
- lftp installation: success;
- isolated preview directory check/create: success;
- non-destructive preview upload: success;
- public Top URL HTTP/HTML verification: success;
- public Isonoura URL HTTP/HTML verification: success;
- overall job conclusion: success.

Production was not touched. Remote delete behavior was not used.

Issue #15 was closed as completed after this successful run.

## Deployment boundaries
The successful redesign preview does not mean the full site is ready for deployment.

Keep these boundaries:
- `nami/ks-redesign` is an isolated static design preview only;
- do not treat it as production-equivalent source;
- do not enable production auto-deploy;
- do not mirror/delete the `/nami` root;
- a future full-site `nami` deployment still requires audited site source and separate review.

## Next action
1. Open the two `nami` preview URLs on mobile and desktop and review the visual result.
2. Import the approved Top Hero binary assets when a repository-safe binary upload path is available.
3. Select and import an Isonoura-specific Hero photo.
4. Refine the prototype based on the visual review before rolling the design to other spot pages.
5. After visual approval, connect only real existing surf data/functions; do not fabricate values to complete the design.
6. Keep production untouched until the audited production-equivalent source and deployment plan are separately approved.

## Content operations
Keep these regular Instagram outputs in scope:

- 06:50 JST — `今日の関西波ランキングTOP5`
- 16:50 JST — `明日の関西波ランキングTOP5`

Reels should stay within 10 seconds and show rank, spot, and size concisely, with no more than 5 hashtags.

## Security reminder
Never put FTP passwords, usernames, tokens, private runtime values, or server-only secrets into this handoff, Issues, PR text, logs, or repository example files.

## Restart instruction
On the next session, treat current GitHub `main` as SSOT. Re-read `AGENTS.md`, `PROJECT_SPEC.md`, `HANDOFF.md`, `docs/PRODUCTION_DEPLOY.md`, the current Issue/PR state, and relevant Actions before continuing.
