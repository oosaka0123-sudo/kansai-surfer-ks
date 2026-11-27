# Forecast accuracy audit (Issue #173)

Read-only CLI, no production write, no cron or API changes. Run Node 22+ from the repository. Capture a new immutable file before the target day; do not overwrite prior issues or mix issuance times. Standard candidate: evening JST snapshot (record exact time, not an assumed 19:30).

    node scripts/forecast-accuracy-audit.cjs capture PATH_OUTSIDE_REPO.json
    node scripts/forecast-accuracy-audit.cjs compare SNAPSHOT.json OBSERVATIONS.json

Capture reads nine public KS JSON endpoints, preserves issued time, capture time, returned marine/weather grid, and next-day 07–10 JST fields. Unknown units/missing values are null, wrong location or stale data excluded. Exit 2 means partial snapshot; retain it with missing reasons rather than silently substituting. A forecast is not an observation. No data committed by default.

Observations input is an array, with spot, station_id, time_jst (YYYY-MM-DDTHH:00), kind=observed_significant_wave_height, unit=m, hs_m, latitude, longitude, source_url, representativeness (same_location or proxy), location_note. Record only independently sourced valid hourly observations with documented location and wave statistic. The 1 km same-location threshold is a conservative technical gate, not proof of hydrodynamic equivalence. Proxy results are separated by spot/station/type; never use them as direct beach accuracy. Negative bias means underprediction. Each report records rejected rows; do not treat missing as zero. Actual station mappings and acquisition are not automated by this tool. Beach category, wind accuracy and multi-day aggregation require separate validated procedures. See #173 for protocol, #131 for existing Takahama audit. No coefficient change before independent observations and adequate held-out validation.

## Scheduled capture

GitHub Actions forecast-audit-capture runs daily at 10:30 UTC (19:30 JST), subject to GitHub scheduler delay. Manual dispatch is a separate sample, never a replacement for the evening run. Scheduled runs outside 19:30–22:00 JST fail rather than recording a mislabeled forecast. Every run has its own artifact (requested retention 90 days, subject to repository limits); partial captures are retained and the run fails visibly. Download records before expiry for long-term comparisons. No production deployment, secrets, paid AI, private or third-party data collection. Actual observations and station mapping remain separate. Exit 2 also indicates missing individual forecast fields.
