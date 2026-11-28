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

## Wave observation candidates and historical import (2026-11-28)

The NOWPHAS 2024 annual report, Table 1 (https://www.pari.go.jp/PDF/TECHNICALNOTE1434.pdf), reports year-long missing observations at GPS stations Ise Bay entrance offshore, Mie Owase offshore, Wakayama southwest offshore, Tokushima Kaiyo offshore and Kochi Muroto offshore. Do not approve these as current operational sources until recovery is verified. Historical station metadata is not proof of 2026 availability. Prioritize Shibayama outside harbor (Hamadutu, depth 42m), Tottori (Hakuto, 30.9m), Komatsushima (Komatsu, 20.8m), Omaezaki (Shizunami, 22.6m); check wave exposure, current data and metadata before approval. Isonoura, Kounohama, Ikumi and Irago remain unmapped; nearby stations in another exposure regime are not equivalent. Takahama ADCP is already tested separately (#131). No automated NOWPHAS realtime polling: https://nowphas.mlit.go.jp/info/. Historical page https://nowphas.mlit.go.jp/pastdata/ as of 2026-11-28 lists data through August 2026; November preliminary data expected early February 2027. Thus monthly published downloads can validate frozen forecasts retrospectively, not provide immediate daily truth.

Offline import accepts the official 20-minute continuous fixed-width format (I4,4I2,2I6,4(F6.2,F6.1),I6), Shift-JIS, including the official sample wrapper. Inspect a locally downloaded file before importing; no network in the importer. Source specification: https://nowphas.mlit.go.jp/pastdatars/data/sample/data_form01.txt. Only normal flag 0, exact 07/08/09/10 JST, actual H1/3 and valid period; missing not zero. Station code in header is distinct from the annual report row number. No candidate is silently approved. Metadata must match station name/code, date, official data URL, verified location URL, coordinates, exposure note, and provisional/final class. All outputs are proxies. Keep input/output outside repo. Use official download conditions, attribution and report submission requirements.

    node scripts/nowphas-import.cjs inspect FILE.txt CODE YYYY-MM-DD
    node scripts/nowphas-import.cjs import FILE.txt CODE YYYY-MM-DD META.json OBS.json
    node scripts/forecast-accuracy-audit.cjs compare SNAPSHOT.json OBS.json

Metadata keys: spot, station_code, station_name, verified_for_date, verified_metadata_url, latitude, longitude, source_url, location_note, data_class. A historic observation is not a historic forecast. Do not reconstruct yesterday's forecast from later model data. No automatic coefficient changes.
