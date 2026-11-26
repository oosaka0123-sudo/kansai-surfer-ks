# Top + Isonoura production baseline source audit

Working issue: #25  
Branch: `chore/import-production-baseline-top-isonoura`

## Status

**VERIFIED BASELINE — 2026-09-07**

The Top page, Isonoura page, shared CSS/JS, manifest, service worker, logo/favicon PNGs, and PWA icons on this branch were fetched directly from the current public production site `https://kansai.rss7.net/` by a standard GitHub-hosted runner and validated before commit.

Verified baseline commit: `60d16ce4d6268b81da2bb0085d145ef0bb9264a3`

The rejected `prototype/ks-redesign` pages are not the baseline and are not the implementation target.

## Production-fetched files

The following files were fetched directly from production and stored at their real production-relative repository paths:

- `index.html`
- `isonoura.html`
- `nami_common.css` from `nami_common.css?v=1018`
- `nami_common.js` from `nami_common.js?v=1018`
- `manifest.json`
- `sw.js`
- `img/logo-ks-white.png`
- `img/favicon.png`
- `img/favicon-32.png`
- `img/icon-192.png`
- `img/icon-192-maskable.png`
- `img/icon-512.png`
- `img/icon-512-maskable.png`

`favicon.ico` is referenced by the current Top HTML, but the public production endpoint returned HTTP 500 during the audit. It was therefore not fabricated or substituted.

## Validation evidence

The GitHub-hosted runner completed all required checks successfully:

- `index.html` and `isonoura.html` contain HTML document markers.
- `nami_common.js` contains `Common JS repaired v1007`.
- `node --check nami_common.js` passed.
- `nami_common.css` passed the non-empty CSS sanity check.
- `manifest.json` parsed successfully as JSON.
- All fetched PNG assets passed image MIME validation.
- Required production resources were fetched successfully over HTTPS.
- No production deployment or write occurred; the workflow only read public production files and wrote them to this GitHub audit branch.

Exact SHA-256 values are stored in `docs/PRODUCTION_BASELINE_SHA256.txt`.

## Exact SHA-256 values

- `index.html`: `6b2a978c14cce9532c1bee65f605c3259071c7b186b8fb58d9e1546fbfc2d31b`
- `isonoura.html`: `d3e2dea24b3667c379c3c2ebfb328d7a5e1c4aa5e2b2297b3e170e511e0b4893`
- `nami_common.css`: `37e40973c4aad47750935feb95b12381c0e6ee76764f14e5ab056bd5a84f297d`
- `nami_common.js`: `034ecc6cd950fbacf6b082336802f0d5fd9927bbd3bf962629e8fc56d44e09fd`
- `manifest.json`: `9c386cfaf65d30092de61be62876a9a4b8d8afc92fa8c9893726fae355a34139`
- `sw.js`: `6651c83357681fa053934fe9631ecdd46d6a4e7cb85302b6823789a8476a1f95`
- `img/logo-ks-white.png`: `8bfa4af9f964566385c87658aa97c405b6bbc1ab20b5a53a8d11811d78004c8a`
- `img/favicon.png`: `7c62482665ce844b5c6beda7df4f6762f74bbf76db5bad982e3e6e6d16232683`
- `img/favicon-32.png`: `3a6e72200778cee87d805746744648b29128a1f090338ea34952a2d241246bd2`
- `img/icon-192.png`: `b51e1a01a074638f69a71980972ddd9c91922fecdda4bd7b9ece4f1c2be30e89`
- `img/icon-192-maskable.png`: `00de36a687a5c687177df2a17723f5a15fefe09b6361c12210d6070a4012b800`
- `img/icon-512.png`: `005a3a516e41f990e98da91d60207355eaa198885ebde6d177d12b1942e297b9`
- `img/icon-512-maskable.png`: `8d3b5c87c425b4999e95a131886c5b1e8573d16b60c3ca0ec5e853b9b620a357`

## Superseded Claude sandbox finding

An earlier Claude Code execution sandbox could not reach `kansai.rss7.net` and consequently could not perform the production fetch. That environment-specific network blocker is now superseded by the successful GitHub-hosted-runner fetch described above.

The same earlier session also flagged the Library-imported HTML as apparently corrupted. The stronger verification is the direct production fetch and comparison performed by the GitHub-hosted runner. The production-fetched files are now the source of truth for this branch. Do not use the earlier Library-candidate interpretation to reject this verified baseline.

## Runtime dependencies

Top/Isonoura still depend on runtime/public data such as:

- `data/spot_*.json`
- `data/line_posts.json`
- `blog/articles.json`
- external/public report and forecast data used by the existing scripts

These live runtime files are deliberately not committed as part of the static baseline. For `nami` parity testing, fetch/copy them into the isolated preview at deploy time rather than storing changing runtime data in Git.

## Next gate

1. Treat this branch/commit as the real static production baseline for Top + Isonoura.
2. Create the redesign branch from this verified baseline rather than from `prototype/ks-redesign`.
3. Preserve existing data flow, SEO, PWA/service-worker behavior, paths, and spot logic.
4. Implement the approved Top + Isonoura redesign only.
5. Deploy the redesign only to an isolated `nami` preview with public runtime data staged at deploy time.
6. Browser/responsive/performance review before any production change.

Production remains untouched by this audit.
