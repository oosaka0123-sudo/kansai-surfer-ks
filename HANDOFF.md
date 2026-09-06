# Kansai Surfer KS - Current Handoff

Updated: 2026-09-07 JST

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

## Redesign prototype on `main`
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

## Top Hero media
The approved Top Hero is the sunrise/ocean/paddling-surfer visual selected by the owner. All page text remains HTML layered over the image; no title/UI text is baked into the asset.

Branch `feat/add-approved-top-hero-assets` now contains all four responsive Hero assets under `prototype/ks-redesign/assets/`:

- `hero-surf-mobile.avif`
- `hero-surf-mobile.webp`
- `hero-surf-desktop.avif`
- `hero-surf-desktop.webp`

The existing prototype CSS already references these filenames. Mobile and desktop use separate crops from the same approved scene, with AVIF primary and WebP fallback.

The Isonoura-specific Hero image is still pending approval/import. Do not reuse the Top Hero or an unrelated spot photo on the Isonoura page.

## Claude implementation evidence
The owner-triggered `.github/workflows/claude-implement.yml` connection is verified and uses Sonnet explicitly.

Observed Issue #11 implementation runs:
- first actionable Claude run reached the 30-turn ceiling before pushing a branch;
- retry reached the 60-turn ceiling before pushing a branch;
- the second retry used `claude-sonnet-5`, had no permission-denial blocker, but again reached the configured turn ceiling;
- because no Claude implementation branch was pushed, the project-manager fallback implementation was used to finish the isolated prototype and avoid further API spend on the same blocked path.

Do not describe those turn-limited Claude runs as a successful implementation.

## `nami` redesign preview
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

The preview workflow has already been proven with successful GitHub Actions run `34036724875`. The earlier FTP `SITE MKDIR` incompatibility was fixed in PR #17 by using a standard single-child `MKD` flow.

Production was not touched and remote delete behavior was not used.

## Current next action
1. Review and merge `feat/add-approved-top-hero-assets` through a PR if the diff contains only the intended Hero assets and current-state documentation.
2. Re-run the isolated `nami` redesign preview deployment.
3. Verify the Top and Isonoura preview URLs and the four Hero asset URLs over HTTPS.
4. Visually review mobile and desktop Top Hero composition; adjust only crop/background position if needed.
5. Select and import an Isonoura-specific Hero photo separately.
6. After visual approval, connect only real existing surf data/functions; do not fabricate values.
7. Keep production untouched until audited production-equivalent source and deployment plan are separately approved.

## Deployment boundaries
The successful redesign preview does not mean the full site is ready for deployment.

Keep these boundaries:
- `nami/ks-redesign` is an isolated static design preview only;
- do not treat it as production-equivalent source;
- do not enable production auto-deploy;
- do not mirror/delete the `/nami` root;
- a future full-site `nami` deployment still requires audited site source and separate review.

## Content operations
Keep these regular Instagram outputs in scope:

- 06:50 JST — `今日の関西波ランキングTOP5`
- 16:50 JST — `明日の関西波ランキングTOP5`

Reels should stay within 10 seconds and show rank, spot, and size concisely, with no more than 5 hashtags.

## Security reminder
Never put FTP passwords, usernames, tokens, private runtime values, or server-only secrets into this handoff, Issues, PR text, logs, or repository example files.

## Restart instruction
On the next session, treat current GitHub `main` as SSOT. Re-read `AGENTS.md`, `PROJECT_SPEC.md`, `HANDOFF.md`, `docs/PRODUCTION_DEPLOY.md`, the current Issue/PR state, and relevant Actions before continuing.
