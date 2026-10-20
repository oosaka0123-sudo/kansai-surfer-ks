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
- The approved sunrise/ocean/surfer Hero visual direction is fixed. The asset contract and planned filenames are documented under `prototype/ks-redesign/assets/README.md`; the binary source asset itself must be imported before the prototype claims the approved photograph is present.
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

## Morning blog / 関西サーファー朝刊

The morning blog is being redesigned as a short, fact-grounded surf morning edition that can normally be read in about 2–3 minutes.

### Opening voice
- Begin with: `おはようございます、木山です。`
- Follow with a short Osaka weather note, one verified current/seasonal/surf-related topic, and a transition into the surf report.
- Keep the opening to roughly 3–4 short sentences.
- Use a friendly, popular-host tone, but never fabricate personal observation, friend reports, or lived experience.
- Weather and current-affairs facts must be sourced/verified before publication.

### Reader-facing metadata policy
- Keep observation, publication, forecast-check, and collector timestamps in backend JSON for verification and freshness logic.
- Do not show raw ISO timestamps or labels such as `観測`, `発表`, `確認`, or `記事生成` in the normal morning-blog reading flow; they make the article feel machine-generated.
- Normal weather/topic/competition/surf-news sections should read like editorial prose without source-timing metadata.
- Safety alerts may retain issued/checked timing when it is materially important to understanding whether a warning is current.

### Morning brief editorial UI
- NAMI morning brief should read like a surf-media morning blog, not a developer dashboard.
- Use an editorial paper layout with strong masthead/date, human opening, clear TOP5, compact nine-spot entries, article-style news, safety block, closing comment, and a small expandable data-method note.
- Keep technical labels secondary. `現在確定`, `検索参考`, `API予報`, and `API風` may remain as compact labels so semantics are never lost.
- Do not put `NAMI TEST / API + SEARCH DATA` or long collection-method text in the first-view reading flow; keep it in the expandable data-method note.
- Prefer light/off-white paper colors with deep ocean ink/accent for morning readability while keeping the KS dark global header.
- Reduce generic rounded-card repetition; use typography, whitespace, and thin rules for editorial rhythm.
- The redesign is presentation-only: factual values, timestamps, current-vs-forecast meaning, source hiding rules, and S.LEAGUE body links must remain unchanged.

### Standard article order
1. Human opening by Kiyama.
2. `今日の関西 波ランキングTOP5`.
3. Nine fixed surf spots, with current conditions and forecast clearly separated.
4. Competition news.
5. Surfing-related news.
6. Sea accidents / safety information.
7. Short closing comment.

Normal days should remain concise. Major typhoon, earthquake, tsunami, high-wave, marine-accident, or surfer-accident information may exceed the normal length because safety has priority.

### Surf competition news collection
- NAMI morning context monitors the public SURFMEDIA RSS feed for fresh competition news.
- Prefer fresh items involving 五十嵐カノア / コナー・オレアリー, WSL/CT, ISA, and other meaningful competition results.
- Fresh competition news takes priority over routine S.LEAGUE / Kanoa fallback items.
- Keep the source URL and checked/published timestamps in backend metadata, but do not render reference-source labels or URLs in the reader-facing morning article.
- The collector stays fail-closed: stale, malformed, or non-competition feed items must not be promoted into the competition section.

### Competition news fallback
- Prefer real current competition developments first: WSL, S.LEAGUE, domestic and international events.
- When there is no meaningful new competition story, use one or two useful fallback items such as the current month's event schedule, S.LEAGUE Top 3, KS-supported Kanoa Igarashi's current WSL ranking, or his next event.
- Do not repeat unchanged fallback items every day. Track the last-published date and normally leave at least about three days between repeats unless a meaningful change occurs.
- The generator owns fallback state: keep candidates as `publish=false`, set `publish=true` only for items selected for the article, update `last_published_at` after publication, and set `meaningful_change=true` only when verified source data actually changed.
- A stronger surf-news item may replace a routine Kanoa or S.LEAGUE fallback on that day.
- Visible body-text occurrences of `S.LEAGUE` / `エスリーグ` link to S.LEAGUE NOW: `https://sleague.rss7.net/`. Do not blindly rewrite URLs, attributes, alt text, or code.

### Surf news and safety
- Surfing-related news is a separate section and should include only worthwhile verified stories, not filler.
- Sea accidents and safety information have the highest factuality requirement.
- Prefer primary sources such as JMA, Japan Coast Guard, police, municipalities, official lifesaving bodies, and official competition organizers.
- Safety entries should include source/issuer, issued time, checked time, and source URL when available.
- Unknown-source social posts alone are not sufficient for accident reporting.
- If no meaningful safety item exists, keep the section brief rather than inventing content.

### Hybrid API + web-search wave data
- Use API data for the deterministic forecast layer: wave height, period, swell direction and wind.
- Use GPT/web search to collect publicly visible surf-size expressions such as `ヒザ`, `モモ〜腰`, and `腹〜胸`.
- Keep search-derived size data and API forecast data separate in storage and on the NAMI test UI.
- Keep search source names and URLs in backend data only; do not render them in the reader-facing article.
- A single search source is reference-only and must not be labeled as confirmed current size.
- Confirm `current` only when at least two independent search sources checked within 90 minutes overlap after normalization.
- Search data 91–180 minutes old may remain visible as a time-aged reference; older data is stale and must not drive current size.
- Normalize search sizes using スネ=1 / ヒザ=2 / モモ=3 / 腰=4 / 腹=5 / 胸=6 / 肩=7 / 頭=8.
- Deterministic overlap example: `腹〜胸` + `胸〜肩` => `胸前後`.
- If independent search ranges do not overlap, leave current size unconfirmed rather than guessing.
- NAMI is the test surface for this hybrid pipeline. Production remains unchanged until explicit owner approval.
- NAMI search-wave data is refreshed automatically every hour from the allowlisted public pages; the API/official context is also refreshed hourly.
- Scheduled refreshes write only to the isolated NAMI runtime JSON and must never write production.
- A NAMI site redeploy must not overwrite the runtime `data/current-search-observations.json`; that file is owned by the refresh workflow.

### BCM approximate reference policy
- BCM's publicly visible delayed sample may be used as an internal approximate wave-size reference; it is not treated as a live current observation.
- The NAMI collector reads only the delayed public sample's compact size/check metadata. Do not copy or republish BCM article text, images, advice, condition prose, or source labels into the reader-facing morning page. Source metadata remains backend-only.
- BCM exact mappings currently used: 磯ノ浦, 国府の浜・テトラ前→国府の浜, 生見, ロングビーチ→伊良湖, 静波, 鳥取・白兎→白兎.
- Approximate nearby proxies may be used only as `参考推定`: 京都・八丁浜→浜詰 and 福井・鳥居浜→高浜. 小松海岸 has no BCM proxy in this rule.
- Normalize BCM and KS-side search size ranges onto the existing body-size scale before combining them.
- The default estimate is a 50/50 midpoint between the center of the BCM delayed-sample range and the center of the freshest non-BCM KS search range.
- Example: BCM `腰〜腹` (center 4.5) + KS `モモ〜腰` (center 3.5) => midpoint 4.0 => `腰前後`.
- KS-side data used for the midpoint may be up to 180 minutes old because the result is reference-only. A BCM delayed sample may be used for this approximate calculation for up to 36 hours from its CHECK time.
- The result is stored/displayed only as `reference_estimate` / `参考推定`; it must never by itself become `current` / `現在確定`.
- BCM delayed-sample observations are excluded from the current-confirmation consensus even if their timestamps or page behavior change unexpectedly.
- Existing current-confirmation rule remains unchanged: at least two independent fresh non-BCM search sources must overlap after normalization.
- Never mix API forecast values into the BCM+KS reference midpoint.

### Data and generation guardrails
- Current observations, forecasts, alerts, and news must remain separate fields in source data.
- Show observation/issue times where relevant.
- Missing spot data must be shown as unavailable / `本日データなし`; do not infer or fill it with invented values.
- Claude/Haiku may turn confirmed structured data into prose but must not change numeric values, independently invent facts, or add fabricated first-person experience.
- Breaking safety information must be freshness-checked close to publication so lifted or superseded alerts are not presented as current.
- Production remains untouched until the NAMI test implementation is reviewed and verified.

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
