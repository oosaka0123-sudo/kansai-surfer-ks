# KS gear page release handoff
Scope: add /gear/ and insert the supplied banner into the CURRENT production homepage only.
Owner request: commit and manually deploy this scoped change; do not change automatic deployment policy.

Observed 2026-10-24:
- ai-master AGENTS / project index / web standards and KS AGENTS / PROJECT_SPEC / production deployment docs read.
- main has no production index.html. Existing full-site deploy fails its source guard; do not use it.
- GitHub connection can read/write repository files; remote PC04 execution previously returned monthly quota error.
- Local shell cannot resolve github.com; no clone succeeded.
- Existing recent branch fix/top-share-move-to-strip-20261021 contains an index.html, but equivalence to current production is unverified. Do not overwrite production from that historical copy.
- No matching gear issue/PR was found before implementation.
- Amazon category URL returned 503. No official ranking or product inventory was verified.

Implementation:
- gear/index.html + gear/gear.css: dependency-free static page, 10 categories, Store ID surf73-22.
- gear/banner.html: scoped inline-styled homepage banner.
- scripts/patch_gear_banner.cjs: writes a NEW homepage file, refuses duplicate links, ambiguous/missing anchor, and unrecognized input. Does not upload anything.
- Remaining candidates: leash (FCS official collection), wet bag (Rip Curl official wet/dry storage). These are editorial choices, not Amazon sales claims.

Release steps:
1. On authorized PC04, inspect actual checkout status and repository rules; preserve unrelated work.
2. Download CURRENT production index.html immediately before patching, retaining a local backup and hash. Review header/footer and insertion anchor against live page.
3. Run: node scripts/patch_gear_banner.cjs CURRENT_INDEX gear/banner.html NEW_INDEX
4. Check diff contains only the banner, verify desktop/mobile preview, all 10 Amazon searches (tag survives, keyword and destination relevant), keyboard focus and existing home functions.
5. Upload ONLY gear/index.html and gear/gear.css, verify /gear/ first; then upload patched homepage with backup and rollback available. Do not use a full-site mirror.
6. Verify https://kansai.rss7.net/ and https://kansai.rss7.net/gear/ visibly; preserve PHP, API, PWA, data, cron, blog and approved hero assets.

Not complete until actual browser QA, Amazon destination checks, independent review, manual production deployment and live URL verification pass.
Resume: Read this file and current PR; finish PC04 production-source comparison and scoped manual release. Never report live deployment from a repository commit alone.
