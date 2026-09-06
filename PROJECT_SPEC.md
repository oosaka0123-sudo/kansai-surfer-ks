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
- Do not enable automatic production deployment during the initial migration.
- Production uploads remain manual until the project owner explicitly changes this policy.

## Test / staging target: `nami`
- `nami` is the dedicated test target for Kansai Surfer KS.
- Test uploads must target `nami` only and must not overwrite or deploy to the production site `kansai.rss7.net`.
- Public test URL: `https://nami.rss7.net/`.
- Verified FTP host: `ftp.lolipop.jp`.
- Verified explicit-FTPS connection scheme used by `lftp`: `ftp` with TLS forced.
- Verified FTP port: `21`.
- Verified FTP-session remote directory: `/nami`.
- The Lolipop public upload folder for `nami.rss7.net` is `nami`.
- `nami` workflows remain manual-only unless separately reviewed.
- Destructive mirror/delete behavior is not allowed for the test target unless separately reviewed and explicitly approved.

## Deployment configuration
Real deployment credentials are stored in GitHub Actions secret storage, never in repository files.

### `nami`
Only these two repository Actions secrets are required:

- `KS_NAMI_FTP_USER`
- `KS_NAMI_FTP_PASSWORD`

The verified non-secret `nami` target values are fixed in `.github/workflows/test-nami-ftp.yml` and documented in `docs/PRODUCTION_DEPLOY.md`.

The manual `Test nami FTP` workflow performs a temporary write/delete probe only. It does not deploy the site. The connection/write/delete probe has been confirmed successful.

### `production`
Production deployment remains separate from `nami` and manual. Reserved production secret names are:

- `KS_PROD_FTP_USER`
- `KS_PROD_FTP_PASSWORD`

Do not create or enable automatic production upload until the repository contains the audited production-equivalent source and the upload exclusions and verified production target path have been reviewed.

Production and `nami` credentials, remote directories, and deployment controls must remain separate. Real credentials must never be committed to this repository.

Canonical deployment configuration names and safety policy: `docs/PRODUCTION_DEPLOY.md`.

## Current deployment milestone
Confirmed:

1. GitHub Actions can authenticate to Lolipop for the `nami` target using repository secrets.
2. The manual probe can write a temporary file into `/nami` and remove it again.
3. The probe is isolated from production and performs no site mirror or deletion.

Next implementation milestone:

- Add a separately reviewed, manual-only workflow that deploys the audited Kansai Surfer site source to `/nami` only.
- The first site deployment must be non-destructive and must fail closed if the target is anything other than the verified `nami` destination.
- Verify `https://nami.rss7.net/` after deployment before designing or enabling any production deployment flow.

## Design redesign pilot — Top + Isonoura only

This pilot establishes the visual and interaction standard before any wider rollout.

### Scope
- Implement only the top page and the Isonoura page first.
- Do not redesign the other surf-point pages during this pilot.
- The current repository does not yet contain the audited production-equivalent site source. Until that source is safely imported, redesign work must stay isolated as a non-production prototype and must not be treated as a production replacement.
- Production deployment remains manual and out of scope for the pilot.

### Priority order
1. Readability
2. Display speed
3. Mobile usability
4. Fast access to surf information
5. Design quality
6. Motion and interaction

The target is: `読みやすいのに、圧倒的にかっこいい`.

### Visual direction
- Dark / near-black background.
- White or soft-white typography.
- Ocean photography as the primary visual material.
- Cyan / ocean-blue accent only where useful; do not overuse it.
- Modern, editorial, premium, surf-culture-oriented visual language.
- Avoid generic AI-template styling such as excessive rounded cards, purple gradients, repeated glassmorphism, icon overload, and identical fade-up effects everywhere.

### Top page Hero
- Keep the existing top-page main heading wording as the primary H1: `関西サーフィン波情報｜磯ノ浦・生見・国府の浜・伊良湖の無料波予報`.
- Keep the current explanatory information; redesign its presentation rather than replacing it with invented surf values.
- Use the approved sunrise/ocean/surfer Hero image asset stored under `prototype/ks-redesign/assets/`.
- The Hero image itself must contain no embedded title or UI text. All visible page text must be real HTML layered over the image.
- Mobile and desktop use separate optimized crops derived from the same approved scene.
- Use a dark gradient/overlay so white text stays readable across the photograph.
- Motion should be subtle: very slow zoom or pan, not a fast slider and not a blocking video.

### Header interaction
- At the top of the Hero, use a transparent or near-transparent header with white text/icons.
- As the user scrolls, transition naturally to a fixed dark header with clear navigation.
- Avoid layout jumps and CLS during the transition.

### Scroll position indicator
- Provide a minimal scroll-linked position indicator so users can understand the current section.
- Preferred treatment: section number + thin vertical line + short section name.
- It must not obstruct content on small screens.

### Heading motion
- H2 headings should reveal from left to right when they enter the viewport.
- The effect must be quick enough that information is never delayed for style.
- After reveal, the heading remains normally readable.
- Support `prefers-reduced-motion`.

### Card / content motion
- Cards and content blocks may reveal with restrained `transform`, `opacity`, clipping/masking, or small stagger effects.
- Do not make every block use the same generic animation.
- Motion must help rhythm and hierarchy without delaying information.

### Isonoura page
- `1 page = 1 spot = 1 primary Hero photo`.
- The Isonoura page must use an Isonoura-specific approved photo; do not reuse the top-page Hero just to fill the space.
- Do not rotate through photos from other spots on the Isonoura page.
- Do not add score, points, wave size, or other surf values to the Hero unless they come from the real existing data flow and are part of the information design.
- Preserve existing Isonoura data/functions and redesign the presentation around them after the production-equivalent source is imported.

### Performance requirements
- No loading splash screen.
- Core title/navigation/information must render immediately from HTML.
- Hero media must not wait on runtime AI or API generation.
- Prefer CSS for motion; add JavaScript only when it creates real value.
- Prefer AVIF with WebP fallback where practical.
- Use responsive images / `picture` / `srcset` where appropriate.
- Hero image is high priority; non-Hero imagery should be lazy-loaded when appropriate.
- Keep layout dimensions explicit to reduce CLS.
- Target Core Web Vitals remains LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1 where practical.

### Agent / orchestration policy for this pilot
- GPT/ChatGPT acts as project manager and GitHub coordinator when connected.
- Claude Code is the preferred primary implementation agent when the Project-scoped connection is verified.
- Jules is suitable for repetitive cross-file work after the pilot standard is approved.
- Codex is suitable for independent JavaScript/performance/responsive verification when available.
- GitHub Copilot is suitable for PR review when available.
- Do not claim an agent was used unless its task actually ran.
- Use GitHub as SSOT and keep one active implementation owner for the same scope.
- The owner-only `@claude-implement` GitHub workflow may be used to start Claude Code implementation tasks after the workflow and repository authentication are verified.

## Content operations
Primary operational output is short Instagram Reels copy for Kansai surf conditions.

Target spots:

- 磯ノ浦
- 国府の浜
- 生見
- 小松海岸
- 伊良湖
- 静波
- 浜詰
- 高浜
- 白兎

Regular ranking schedule:

- 06:50 JST: `今日の関西波ランキングTOP5`
- 16:50 JST: `明日の関西波ランキングTOP5`

Reel format:

- Keep the Reel within 10 seconds.
- Show rank, spot name, and wave size concisely.
- Use no more than 5 hashtags.
- Do not invent wave observations, forecasts, scores, or sizes when source data is unavailable.

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
