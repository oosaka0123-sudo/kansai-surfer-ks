# Forecast accuracy audit (Issue #173)

Read-only CLI, no production write, no cron or API changes. Run Node 22+ from the repository. Capture a new immutable file before the target day; do not overwrite prior issues or mix issuance times. Standard candidate: evening JST snapshot (record exact time, not an assumed 19:30).

    node scripts/forecast-accuracy-audit.cjs capture PATH_OUTSIDE_REPO.json
    node scripts/forecast-accuracy-audit.cjs compare SNAPSHOT.json OBSERVATIONS.json

Capture reads nine public KS JSON endpoints, preserves issued time, capture time, returned marine/weather grid, and next-day 07–10 JST fields. Unknown units/missing values are null, wrong location or stale data excluded. Exit 2 means partial snapshot; retain it with missing reasons rather than silently substituting. A forecast is not an observation. No data committed by default.

Observations input is an array, with spot, station_id, time_jst (YYYY-MM-DDTHH:00), kind=observed_significant_wave_height, unit=m, hs_m, latitude, longitude, source_url, representativeness (same_location or proxy), location_note. Record only independently sourced valid hourly observations with documented location and wave statistic. The 1 km same-location threshold is a conservative technical gate, not proof of hydrodynamic equivalence. Proxy results are separated by spot/station/type; never use them as direct beach accuracy. Negative bias means underprediction. Each report records rejected rows; do not treat missing as zero. Actual station mappings and acquisition are not automated by this tool. Beach category, wind accuracy and multi-day aggregation require separate validated procedures. See #173 for protocol, #131 for existing Takahama audit. No coefficient change before independent observations and adequate held-out validation.

## Scheduled capture

GitHub Actions forecast-audit-capture runs daily at 19:30 with explicit Asia/Tokyo timezone, subject to GitHub scheduler delay. Manual dispatch is a separate sample, never a replacement for the evening run. Scheduled runs outside 19:30–22:00 JST fail rather than recording a mislabeled forecast. Every run has its own artifact (requested retention 90 days, subject to repository limits); partial captures are retained and the run fails visibly. Download records before expiry for long-term comparisons. No production deployment, secrets, paid AI, private or third-party data collection. Actual observations and station mapping remain separate. Exit 2 also indicates missing individual forecast fields.

## Independent observed wind (AMeDAS)

A separate audit reads the JMA public browser JSON (not a guaranteed API) once per station table and four nationwide hourly maps, 07–10 JST. Source: https://www.jma.go.jp/jma/kishou/info/coment.html and https://www.jma.go.jp/jma/kishou/know/amedas/kaisetsu.html . All nine fixed candidates are explicitly land-station proxies, not beach observations: Wakayama, Toba, Kaiyo, Tokushima, Irako, Omaezaki, Taiza, Obama, Tottori. Station IDs/names/coordinates and distance to the forecast grid are preserved. Only quality flag 0 is accepted; calm direction is unavailable, not north. Report speed bias/MAE and circular direction MAE separately from wave Hs. Do not tune surf conditions based only on land wind. No retries or bulk collection. Missing response stays missing.

    node scripts/amedas-wind-audit.cjs capture OUTPUT.json YYYY-MM-DD
    node scripts/amedas-wind-audit.cjs compare SNAPSHOT.json WIND_OBS.json

NOWPHAS explicitly requests avoidance of periodic automated collection on the realtime site (https://nowphas.mlit.go.jp/info/). Use authorized historical downloads/import, not a crawler. JMA legacy coastal wave-meter observation ended March 2026 (https://www.data.jma.go.jp/kaiyou/shindan/index_wave.html); replacement model information is not independent Hs observation. Existing Takahama buoy audit #131 remains separate. BCM/Surfline reports are reference only; no automated collection or redistribution in this release.

Morning wind audit is scheduled at 11:13 Asia/Tokyo (avoiding the top of the hour). Both schedules retain the actual JST execution-window guards; delayed or missing runs must not masquerade as valid forecasts. The first capture schedule on 2026-11-27 ran at 04:34 JST the following day and was rejected. The first morning schedule had no recorded run as of 2026-11-28 15:50 JST. Explicit timezone syntax is a mitigation, not a guarantee of punctual scheduling. Manual afternoon captures remain a separate lead-time cohort and are not substituted for evening captures.
