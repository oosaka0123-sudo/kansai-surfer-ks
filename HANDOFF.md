# Kansai Surfer KS - Current Handoff

Updated: 2026-09-10 20:58 JST

## Restart first
This handoff is for `oosaka0123-sudo/kansai-surfer-ks` only.

At the next session, read this file first, then inspect Issue #27, draft PR #28, the redesign branch, and current GitHub Actions state before making changes.

Do not return to the old isolated prototype as the implementation target. The real target is the verified production-equivalent Top + Isonoura baseline.

## Current repository state
- Repository: `oosaka0123-sudo/kansai-surfer-ks`
- Production: `https://kansai.rss7.net/`
- Test host: `https://nami.rss7.net/`
- Production has NOT been deployed from this redesign work.
- Do not run production deployment without explicit owner approval in the current turn.

## Real redesign workstream
Issue:
- #27 `Implement Top + Isonoura redesign from verified production baseline`

Draft PR:
- #28 `feat: production Top + Isonoura redesign`
- State verified 2026-09-10: OPEN / DRAFT / not merged / mergeable
- Branch: `feat/top-isonoura-production-redesign`
- Head verified: `7c70457bec450eec389c1722826ac94077dafdc8`
- Keep PR #28 draft until remaining browser QA and owner visual approval are complete.

Verified production baseline used for the redesign:
- `af260549139a577745c2241593557d5c4a52fe54`

Actual production-source files are the target:
- `index.html`
- `isonoura.html`
- `nami_common.css`
- `nami_common.js`
- real `img/` assets

Do not implement the final site inside `prototype/ks-redesign/`.

## Owner-approved Top Hero direction
The approved Top Hero remains the source of truth:
- dark navy/black upper area with generous negative space;
- approved sunrise/ocean/paddling-surfer scene in the lower area;
- photo relatively high within the lower Hero area;
- HTML/CSS text overlay, never baked into the image;
- white KS logo / Kansai Surf branding;
- Instagram, Facebook and hamburger visible on mobile;
- `Good Waves Better Days` faint script;
- kicker: `波がある、人生が動き出す。`;
- H1: `関西サーフィン波情報｜磯ノ浦・生見・国府の浜・伊良湖の無料波予報`;
- subtitle: `全9ポイントの波をAPIでリアルタイムチェック`;
- lower labels: `SCROLL` and `SURF / LOCAL / LIVE BETTER`.

Do not regenerate or replace the approved Hero scene unless the owner explicitly asks.

Responsive approved still assets are already present on the redesign branch:
- `img/hero-surf-mobile.avif`
- `img/hero-surf-mobile.webp`
- `img/hero-surf-desktop.avif`
- `img/hero-surf-desktop.webp`

Isonoura needs its own spot-specific photo. Do not reuse the generic Top Hero for Isonoura.

## Hero video blocker status: RESOLVED on current isolated preview
The earlier handoff said the Hero video was still using deferred `data-src` loading. That description is now stale relative to the current PR branch.

Current `feat/top-isonoura-production-redesign/index.html` uses the reliable direct source form:
- `<source src="img/hero-surf-real.mp4" type="video/mp4">`
- `autoplay muted loop playsinline preload="auto"`
- poster fallback remains present
- JavaScript attempts `play()` and retries
- `loadeddata` / `canplay` add `.is-ready`

### HTTP / preview verification
Preview checked:
- `https://nami.rss7.net/ks-production-redesign/`

Verified from the authorized Surface:
- preview HTML returns HTTP 200;
- deployed HTML references `img/hero-surf-real.mp4` directly;
- MP4 returns HTTP 200;
- content type is `video/mp4`;
- the file is served with normal media headers including content length / byte range support.

### REAL browser playback verification
Verified on the Surface using fresh browser profiles and a 390x844 mobile viewport.

Chrome:
- `paused=false`;
- `readyState=4`;
- `currentTime` advanced from about 4.35s to 6.36s over a two-second interval;
- `.is-ready=true`;
- video dimensions were non-zero;
- no media error.

Opera:
- `paused=false`;
- `readyState=4`;
- `currentTime` advanced across checks;
- `.is-ready=true`;
- computed `opacity=1`, visible/displayed, with a positive on-screen rectangle;
- video dimensions were non-zero;
- no media error.

Visual-frame confirmation in Opera:
- two full viewport screenshots were captured two seconds apart;
- screenshot hashes differed;
- `FRAME_CHANGED=True`.

Conclusion: the current isolated `nami` production-redesign preview visibly plays the Hero video in real Chrome and Opera browser engines. No further Hero code patch is justified at this point.

The earlier `動いてないね` observation was likely from an older preview revision or stale browser/cache state, but the exact original cause is NOT proven. Do not claim a Service Worker was definitively the cause.

If the owner's normal day-to-day Opera profile still shows a frozen Hero, the next diagnostic should reproduce specifically in that existing profile before changing code again.

## Failed historical repair attempts — keep for audit only
These failures happened before the current working branch state and must not be described as the mechanism that fixed the Hero:

1. Claude retry:
- Workflow: `Claude Implementation`
- Run: `34449978508`
- Result: FAILURE in `Run Claude Code implementation`.

2. One-shot workflow on main:
- `.github/workflows/fix-hero-video-autoplay.yml`
- creation commit: `e85ffb6cf1b14dcc66c9372f239aa5eea57d4ffc`
- observed run: `34450109784`
- result: FAILURE with no jobs.

The current PR head `7c70457bec450eec389c1722826ac94077dafdc8` had no GitHub check-runs attached when rechecked after browser verification. Therefore browser verification above is the authoritative current Hero result; do not invent a passing CI check.

## Recommended next sequence
1. Do NOT reopen Hero loading code unless the owner's normal browser profile reproduces the freeze.
2. Keep PR #28 Draft and production untouched.
3. Continue remaining Top + Isonoura browser/visual QA from the production-equivalent preview.
4. Verify responsive layout, navigation, live-data hooks, Isonoura spot-specific imagery, reduced-motion behavior, and no regression to existing public functionality.
5. Obtain owner visual approval before moving PR #28 out of Draft.
6. Merge/deploy production only after explicit owner approval in that turn.

## Preview / QA
Production-equivalent redesign preview workflow:
- `.github/workflows/deploy-production-redesign-preview.yml`
- preview: `https://nami.rss7.net/ks-production-redesign/`

There is also historical isolated-prototype preview infrastructure under `/nami/ks-redesign`; do not confuse it with the production-baseline redesign target.

## Production deployment workflow
Manual workflow:
- `.github/workflows/deploy-lolipop-production.yml`
- destination guard: `/kansai`
- URL guard: `https://kansai.rss7.net/`
- no remote delete
- runtime `data/`, `realtime/`, `logs/` excluded/preserved
- production secrets: `KS_PROD_FTP_USER`, `KS_PROD_FTP_PASSWORD`

Do not trigger production deployment as part of restart/handoff.

## KS non-negotiable implementation rules
- preserve live data/API hooks, PWA, SEO, blog/report sections and public links;
- no fake wave sizes, rankings, scores, or runtime JSON values;
- mobile first;
- readability and speed before decorative motion;
- CSS-first motion where practical;
- `prefers-reduced-motion` support;
- do not break existing PHP/data/report paths;
- do not make broad unrelated redesign changes while fixing one Hero issue.

## Regular KS content operation reminder
Instagram Reels priority:
- 06:50 JST — `今日の関西波ランキングTOP5`
- 16:50 JST — `明日の関西波ランキングTOP5`
- 10 seconds or less
- concise rank / spot / size
- max 5 hashtags

## Security
Never commit or expose FTP passwords, tokens, GitHub secrets, admin passwords, private runtime values, or server-only config.

## One-line restart instruction
`kansai-surfer-ks の HANDOFF.md を読んで、Issue #27 / PR #28 を再開して。Hero動画は現行namiプレビューでChrome/Opera実ブラウザ再生確認済み。PRはDraft・本番は触らず、Top + Isonouraの残りQAから進めて。`
