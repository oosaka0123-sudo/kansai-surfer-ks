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

## Fetch attempt log (2026-09-07)

An implementation session attempted to replace the Library candidates in this branch with byte-for-byte production files fetched from `https://kansai.rss7.net/`, per Issue #25's `@claude-implement` instructions.

- Environment: Claude Code execution sandbox for this repository's `@claude-implement` GitHub Action run.
- DNS resolution for `kansai.rss7.net` succeeded (`157.7.107.44`).
- `curl --fail --location` to `https://kansai.rss7.net/` and `http://kansai.rss7.net/` both failed with a TCP-level connection timeout (curl error 28) after 20-25s, retried 4 times across both schemes.
- Control check: `https://github.com` was reachable from the same sandbox in the same session, confirming general outbound network access exists but this specific host is blocked.
- Retried once more with the local tool's sandbox restrictions relaxed; result was identical (still blocked), indicating the block is enforced at the network/infrastructure level for this execution environment, not by the local tool wrapper.
- No files were fetched. No production bytes were obtained. No Library candidate was substituted or relabeled as a verified production file as a result of this attempt.
- Conclusion: this specific sandboxed session cannot reach `kansai.rss7.net`. The exact deployed `nami_common.js?v=1018`, PWA icon assets, `nami_common.css?v=1018`, and fresh copies of `index.html`/`isonoura.html`/`manifest.json`/`sw.js` remain unverified against production. The candidate hashes recorded above are unchanged and still represent Library candidates only, not confirmed production bytes.
- Recommended next step: perform the fetch from an environment with confirmed outbound access to `kansai.rss7.net` (for example, a manually-triggered GitHub Actions workflow on a standard GitHub-hosted runner, distinct from this agent's execution sandbox), then re-run this audit step.

## Local static validation results (2026-09-07)

Static validation was run against the files already present on this branch (no network fetch was possible; see above).

- `manifest.json`: parses as valid JSON. Valid UTF-8.
- `sw.js`: passes `node --check` (valid JS syntax). Valid UTF-8.
- Secret-pattern scan across `index.html`, `isonoura.html`, `manifest.json`, `sw.js`: no credential/token/API-key assignments found. One literal match on the string "SECRET MODE" / an in-page link path `/secret/test.php` in `isonoura.html` — this is page content/link text, not a credential, and was left as-is.
- **`index.html` and `isonoura.html` FAIL UTF-8 validation.** Both files declare `<meta charset="UTF-8">` but are not valid UTF-8 throughout:
  - `index.html` (15,008 bytes): well-formed UTF-8/HTML text up to byte offset ~7501 (ends mid-word inside a `<style>` block, `align-`), then contains non-UTF-8 binary bytes for large stretches of the remainder of the file (4,503 bytes decode as replacement characters under lossy decoding).
  - `isonoura.html` (25,047 bytes): well-formed UTF-8/HTML/Japanese text up to byte offset ~7708, then similarly corrupts into non-UTF-8 binary bytes (6,672 replacement characters under lossy decoding).
  - This is not a false positive from Shift-JIS or other legacy encoding — the leading portion of each file is genuinely valid UTF-8 including multi-byte Japanese characters; the corruption is confined to binary garbage appended/spliced into the tail majority of each file.
  - No gzip or other known container magic bytes were found at the point of corruption, so this does not look like an un-decompressed HTTP response.
  - **Conclusion: the `index.html` and `isonoura.html` currently committed on this branch (from commit `59f131f`) cannot be treated as reliable production-equivalent candidates as-is.** They must not be used for `nami` parity testing until re-verified against a clean production fetch or a known-good Library source. This finding does not change the recorded candidate hashes above (hashes are still accurate for the bytes as committed); it flags that those bytes themselves are suspect.

## Next gate

1. Put the candidate Top/Isonoura/shared text source on this branch at the real production-relative paths.
2. Recover/verify required logo/PWA assets.
3. Deploy only this branch/baseline to the isolated `nami` test target using a non-destructive workflow.
4. Compare Top + Isonoura structure and working data/UI behavior with production.
5. If JS parity is confirmed, mark this source set as the baseline and then start the redesign task with Claude Code as the single implementation owner.

Production remains untouched throughout this audit.
