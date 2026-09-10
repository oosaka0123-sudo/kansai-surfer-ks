# Kansai Surfer KS - Current Handoff

Updated: 2026-09-10 20:36 JST

## Restart first
This handoff is for `oosaka0123-sudo/kansai-surfer-ks` only.

At the next session, read this file first, then inspect current GitHub Issue #27, draft PR #28, the redesign branch, and the latest Actions runs before making changes.

Do not return to the old isolated prototype as the implementation target. The real target is the verified production-equivalent Top + Isonoura baseline.

## Current repository state
- Repository: `oosaka0123-sudo/kansai-surfer-ks`
- Production: `https://kansai.rss7.net/`
- Test host: `https://nami.rss7.net/`
- Current `main` observed before this handoff update: `c406ba2c7ae5e2134b29a486f66a07080059392e` (`ci: add real-browser Hero video verification`)
- Production has NOT been deployed from the redesign work in this session.
- Do not run production deployment without explicit owner approval in the current turn.

## Real redesign workstream
Issue:
- #27 `Implement Top + Isonoura redesign from verified production baseline`

Draft PR:
- #28 `feat: production Top + Isonoura redesign`
- State at handoff: OPEN / DRAFT / not merged
- Branch: `feat/top-isonoura-production-redesign`
- Head observed at handoff: `7c70457bec450eec389c1722826ac94077dafdc8`
- PR remained mergeable, but must stay draft until browser QA and owner visual approval are complete.

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
The approved Top Hero must remain the source of truth:
- dark navy/black upper area with generous negative space;
- approved sunrise/ocean/paddling-surfer scene in the lower area;
- photo should sit relatively high within the lower Hero area;
- HTML/CSS text overlay, never baked into the image;
- white KS logo / Kansai Surf branding;
- Instagram, Facebook and hamburger visible on mobile;
- `Good Waves Better Days` faint script;
- kicker: `波がある、人生が動き出す。`;
- H1: `関西サーフィン波情報｜磯ノ浦・生見・国府の浜・伊良湖の無料波予報`;
- subtitle: `全9ポイントの波をAPIでリアルタイムチェック`;
- lower labels: `SCROLL` and `SURF / LOCAL / LIVE BETTER`.

Do not regenerate or replace the approved Hero scene unless the owner explicitly asks.

Responsive approved scene assets are already present on the redesign branch:
- `img/hero-surf-mobile.avif`
- `img/hero-surf-mobile.webp`
- `img/hero-surf-desktop.avif`
- `img/hero-surf-desktop.webp`

Isonoura needs its own spot-specific photo. Do not reuse the generic Top Hero for Isonoura.

## Current blocker: Hero video is still not moving
The owner reported immediately before handoff: `動いてないね`.

The redesign branch currently contains a Hero video element for:
- `img/hero-surf-real.mp4`

But the observed `index.html` still uses deferred loading logic:
- `<source data-src="img/hero-surf-real.mp4">`
- video source is assigned after page load / idle scheduling;
- poster image remains underneath until the video receives `canplay` and `.is-ready` is added.

So the next session must treat `Hero video does not visibly autoplay` as the active bug, not as completed work.

### Failed repair attempts that must not be described as successful
1. Claude retry:
   - Workflow: `Claude Implementation`
   - Run: `34449978508`
   - Result: FAILURE in `Run Claude Code implementation`
   - No reliable Hero-video fix was produced by that run.

2. One-shot workflow added on main:
   - `.github/workflows/fix-hero-video-autoplay.yml`
   - creation commit: `e85ffb6cf1b14dcc66c9372f239aa5eea57d4ffc`
   - first observed Actions run: `34450109784`
   - result: FAILURE with no jobs, indicating the workflow did not execute the intended branch repair.
   - Also, the trigger comment had already been posted before the new workflow existed, so it could not have repaired the branch at that point.

Do not claim the one-shot fix was applied.

## Recommended next sequence
1. Inspect current branch `feat/top-isonoura-production-redesign` and confirm `img/hero-surf-real.mp4` actually exists and is a valid playable MP4.
2. Inspect `.github/workflows/fix-hero-video-autoplay.yml` syntax/parser failure and either repair it safely or edit the redesign branch directly through an auditable branch commit.
3. Simplify Hero video loading for reliability: direct `src`, `muted autoplay loop playsinline`, poster fallback, and a small `play()` retry. Avoid delaying the only motion until idle if the owner expects it to move immediately.
4. Verify in a REAL browser on the `nami` preview, especially Android/Chrome/Opera-sized mobile viewport. Static HTML checks are not enough for autoplay.
5. Confirm the approved still image remains the fallback and first-paint visual if autoplay is blocked by browser policy or data-saving/reduced-motion settings.
6. Only after the video visibly moves and the owner approves the Hero, continue Top + Isonoura QA.
7. Keep PR #28 draft. Do not merge or deploy production without explicit approval.

## Preview / QA
Production-equivalent redesign preview workflow exists:
- `.github/workflows/deploy-production-redesign-preview.yml`
- intended preview: `https://nami.rss7.net/ks-production-redesign/`

There is also historical isolated-prototype preview infrastructure under `/nami/ks-redesign`; do not confuse that with the production-baseline redesign target.

Real-browser Hero verification infrastructure was added to `main` by commit `c406ba2c7ae5e2134b29a486f66a07080059392e`. Inspect its current workflow/run state at restart rather than assuming it passed.

## Production deployment workflow
A manual production workflow exists:
- `.github/workflows/deploy-lolipop-production.yml`
- destination guard: `/kansai`
- URL guard: `https://kansai.rss7.net/`
- no remote delete
- runtime `data/`, `realtime/`, `logs/` excluded/preserved
- production secrets: `KS_PROD_FTP_USER`, `KS_PROD_FTP_PASSWORD`

The production workflow is manual by design. Do not trigger it as part of handoff/restart.

## Other Lolipop deployment context from this chat
Deployment workflows were also added directly to Lolipop-hosted site repositories rather than to `ai-master`:
- `sleague-now`: `.github/workflows/deploy-lolipop.yml`, commit `d09c5a411a312799d6fb3d435bac24aa2c863762`
- `kansai-surfer-ks`: `.github/workflows/deploy-lolipop-production.yml`, commit `f9d5494d6a4855202857825855b8329f8765b647`

Existing Lolipop workflows were already present in:
- `claudecode-kyoshitsu`
- `50plus`
- `rss7-ai-works`

Do not modify `ai-master` merely to duplicate these site deployment workflows.

## AI Works side note from this chat
For `oosaka0123-sudo/rss7-ai-works`, Lolipop FTP authentication was confirmed working. The failed production run was blocked by missing production Environment secret `RSS7_ADMIN_PASSWORD`, not by the FTP password.

Observed failed run:
- `Deploy production` run `34079106845`
- FTP configuration/authentication reached the server/API-directory inspection stage;
- failure occurred at `Ensure server-only API config exists`;
- required secret: `RSS7_ADMIN_PASSWORD` (workflow requires 12+ characters).

Never put the secret value in chat or repository docs.

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
`kansai-surfer-ks の HANDOFF.md を読んで、Issue #27 / PR #28 の Hero動画が動かない所から再開して。実ブラウザ確認まで進めて、PRはdraft・本番は触らない。`
