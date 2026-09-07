# Top + Isonoura production baseline source audit

Working issue: #25
Branch: `chore/import-production-baseline-top-isonoura`

## Purpose

Establish the real-site source baseline before any further redesign. The rejected `prototype/ks-redesign` pages are not the implementation target.

## Verified observations

- The public Top currently contains the existing H1/subheading/copy followed by the YouTube section, Today's Best, all-spots list, local reports, contact/sponsor, SEO intro, and latest blog.
- Library file `index(20260818-103417).html` matches the public Top H1/subheading/copy and the following YouTube section. It was stored on 2026-08-18 and is the strongest current Top source candidate found.
- Library file `isonoura(5).html` was stored in the same 2026-08-18 site snapshot and matches the public Isonoura page hierarchy. It references `nami_common.css?v=1018` and `nami_common.js?v=1018`.
- The 2026-08-18 Library snapshot also contains the other real site pages, supporting that the Top/Isonoura files came from a site-wide source set rather than an isolated mockup.
- `nami_common(5).css` is the latest non-generated common CSS candidate found before the snapshot. It adds the mobile guide-badge layout used by the current page structure.
- `nami_common(10).js` is the latest non-generated common JS candidate found. After newline normalization it is byte-content-equivalent to the later `nami_common_v1017.js` candidate, except the filename/version context. The public HTML requests it as `nami_common.js?v=1018`; the exact deployed v1018 bytes have not yet been independently downloaded, so this JS remains a parity candidate rather than a claimed byte-for-byte production copy.
- `manifest(3).json` and `sw(4).js` were stored together on 2026-07-06. They reference the same current PWA icon set and `nami_common.css/js?v=1018`; `sw(4).js` uses cache name `ks-pwa-v1020`.
- Secret-pattern scan of the candidate HTML/CSS/JS set found no API key/password/token assignments.

## Candidate hashes

- `index.html`: `ad7a0df5392600089192bf98baa2310ef8bc98b5e9823c97e465695f2c330f4a`
- `isonoura.html`: `f77ae718955922b214a6eace38762fdb1ef0ba90afb43ea2d60332a569180725`
- `nami_common.css`: `a26d6ea38f7656598be94135fde15cda2ea62e1c986f376114ad4246a084f54f`
- `nami_common.js` candidate: `e02f6815aff0859cbed415955caa63837d7bf53a9aa1b79580587e8c5fd929df`
- `manifest.json`: `9c386cfaf65d30092de61be62876a9a4b8d8afc92fa8c9893726fae355a34139`
- `sw.js`: `6651c83357681fa053934fe9631ecdd46d6a4e7cb85302b6823789a8476a1f95`

## Required local dependencies seen in Top/Isonoura

- `img/logo-ks-white.png`
- `img/favicon.png` / `img/favicon-32.png` / root favicon usage
- PWA icons from `manifest.json`
- `blog/articles.json`
- `data/line_posts.json`
- `data/spot_isonoura.json` through common JS
- other spot JSON used by the Top comparison logic

Runtime JSON must not be committed blindly; use safe test fixtures or existing `nami` runtime data only when required for parity testing.

## Next gate

1. Put the candidate Top/Isonoura/shared text source on this branch at the real production-relative paths.
2. Recover/verify required logo/PWA assets.
3. Deploy only this branch/baseline to the isolated `nami` test target using a non-destructive workflow.
4. Compare Top + Isonoura structure and working data/UI behavior with production.
5. If JS parity is confirmed, mark this source set as the baseline and then start the redesign task with Claude Code as the single implementation owner.

Production remains untouched throughout this audit.
