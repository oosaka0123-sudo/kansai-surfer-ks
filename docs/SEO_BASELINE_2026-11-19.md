# Kansai Surfer KS — SEO pre-change baseline

Checkpoint date: 2026-11-19 (JST)

This backup branch preserves the nine existing surf-spot HTML pages before SEO title/H1 changes. It branches from `chore/import-production-baseline-major-pages` at commit `8d7161ac70cb785254c8a1d0a41b823859251d53`.

## Verification

Read-only checks compared the production HTML served by `https://kansai.rss7.net/<slug>.html` with this branch for:
`isonoura`, `kounohama`, `ikumi`, `komatsu`, `irago`, `shizunami`, `hamadutu`, `takahama`, `hakuto`.

All nine spot HTML files matched the publicly fetched production HTML except for one trailing newline added to each fetched response. This establishes an HTML baseline only; it does not assert that all production assets, runtime data, APIs, or hosting configurations are backed up in this branch.

## Boundaries

- No production changes or deployments.
- No SEO edits in this checkpoint.
- `main` is untouched.
- Do not directly deploy this partial-source branch over production.
- Review all future SEO changes via a PR and confirm the live-source deployment plan separately.
