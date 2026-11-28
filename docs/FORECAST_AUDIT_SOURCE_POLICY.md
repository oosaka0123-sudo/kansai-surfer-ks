# KS forecast audit: source policy and operating gates (2026-11-28)

Scope: nine original spots only. Shimanto and Takahama's existing #131 audit are not duplicated.

## Source admission
- Open-Meteo/KS: forecast cohort, never ground truth. Record underlying model, initialization if available, generation/collection/valid time; never infer independent models from different frontends.
- JMA AMeDAS: independent land wind proxies, not beach wind. Keep fixed station and supplemental station groups separate.
- NOWPHAS: historical downloads with attribution and applicable use conditions. Its realtime site requests no periodic automated collection (https://nowphas.mlit.go.jp/info/). Use offline importer; seek an approved feed for daily automation.
- Fukui Takahama ADCP: existing #131, separate. Do not create another periodic collector.
- Surfline: no public forecast API per https://support.surfline.com/hc/en-us/articles/13883685219227-Does-Surfline-have-a-forecast-API; terms restrict extraction (https://www.surfline.com/terms-of-use). No ingestion without permission.
- Namidensetsu: check written permission for AI/data analysis and service development under https://www.namidensetsu.com/mypage/agreement.html. No ingestion until cleared.
- Namiaru: identifies Surfline as its wave/wind forecast provider (https://liff.namiaru.com/mypage.html). Do not count as independent of Surfline. Automated access not approved.
- BCM/Windy: no automated ingestion until applicable terms and permission are checked; model identity must be verified. A visual forecast is not an independent observation.
- KS field observations: only contributor-owned or explicitly authorized reports, with observation time, spot, size range, wind and quality. Do not infer Hs from body-height labels or treat a forecast as observation.

## Operational gates
Wind rolling summary: 16:17 JST, daily; 28 date window, valid scheduled artifacts only. No-data and validation-error reports are not success. Real cloud execution still needs verification.
Wave summary: offline manifest with authentic scheduled run/attempt and original snapshot, dated observations. CLI does not authenticate manifest; verify against actual immutable artifacts before use. Direction/period strata are forecast values; no pooled station, grid, quality, or proxy categories.
Use `node scripts/wave-28day-summary.cjs YYYY-MM-DD MANIFEST.json` with JSON array items `{forecast_event,forecast_run_id,forecast_run_attempt,snapshot,observations}`. This is not an automatic wave-data collector.

## Retention blocker
Repository is public and current artifact retention is 90 days. Monthly NOWPHAS publication may be more than 90 days after the earliest forecast in a month. Do not silently extend retention, publish raw observations, or backfill a past forecast. Establish an authorized archive of KS's own frozen forecasts before expiry (separate retention decision), or report historical pairs as unavailable. No new paid service or third-party extraction.

## Calibration gate
No auto-tuning. Require representative independent observations, sufficient distinct dates and weather regimes per station and stratum, and held-out verification versus unchanged baseline; do not tune surf size from land wind or offshore Hs alone. Keep candidate corrections in a non-production report and review before deployment. ChatGPT/Claude/Gemini independent checks remain required before production tuning.
