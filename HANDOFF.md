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

## Top Hero media — MERGED / DEPLOYED
The approved Top Hero is the sunrise/ocean/paddling-surfer visual selected by the owner. All page text remains HTML layered over the image; no title/UI text is baked into the asset.

PR #19 merged all four responsive Hero assets into `main` under `prototype/ks-redesign/assets/`:

- `hero-surf-mobile.avif`
- `hero-surf-mobile.webp`
- `hero-surf-desktop.avif`
- `hero-surf-desktop.webp`

The existing prototype CSS references these filenames. Mobile and desktop use separate crops from the same approved scene, with AVIF primary and WebP fallback.

The Isonoura-specific Hero image is still pending approval/import. Do not reuse the Top Hero or an unrelated spot photo on the Isonoura page.

## Claude implementation evidence
The owner-triggered `.github/workflows/claude-implement.yml` connection is verified and uses Sonnet explicitly.

Observed Issue #11 implementation runs:
- first actionable Claude run reached the 30-turn ceiling before pushing a branch;
- retry reached the 60-turn ceiling before pushing a branch;
- the second retry used `claude-sonnet-5`, had no permission-denial blocker, but again reached the configured turn ceiling;
- because no Claude implementation branch was pushed, the project-manager fallback implementation was used to finish the isolated prototype and avoid further API spend on the same blocked path.

Do not describe those turn-limited Claude runs as a successful implementation.

## `nami` redesign preview — HERO REFRESH VERIFIED
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

After PR #19 merged, Issue #20 triggered refresh run `34042451147` against `main` commit `d1d470a5d60e7111636a284a18d9d117bfee522c`.

Observed run evidence:
- source and exact nami-target validation: success;
- isolated preview directory check: success;
- non-destructive preview upload: success;
- all four Top Hero asset files were explicitly transferred;
- public Top HTTP/HTML verification: success;
- public Isonoura HTTP/HTML verification: success;
- overall job conclusion: success.

Opera live page reading also confirmed the refreshed Top preview loads with the expected H1, navigation, sections, and links. Browser screenshot capture failed twice because the screenshot connector reported that the browser was not connected, so pixel-level live screenshot verification is not claimed.

Production was not touched and remote delete behavior was not used. Issue #20 was closed as completed after the successful deployment evidence was observed.

## Current next action
1. Review the Top Hero visually on the owner’s mobile and desktop browsers.
2. If composition needs tuning, change only crop/background-position or overlay/readability details first; do not replace the approved scene casually.
3. Select and import one Isonoura-specific Hero photo.
4. Refine Top + Isonoura until the pilot visual standard is approved.
5. After visual approval, connect only real existing surf data/functions; do not fabricate values.
6. Only then consider rollout to the remaining spot pages.
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
