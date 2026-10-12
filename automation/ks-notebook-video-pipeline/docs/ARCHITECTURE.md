# Architecture

## Main flow
INPUT -> NOTEBOOK -> GENERATION -> DOWNLOAD -> VALIDATION -> YOUTUBE_UPLOAD -> READY_FOR_REVIEW -> DONE

Failure states:
- AUTH_REQUIRED
- NEEDS_HUMAN
- FAILED

## Runtime artifacts
`runs/YYYY-MM-DD/`
- source.md
- studio-prompt.md
- youtube-metadata.json
- state.json
- video.mp4
- screenshots/
- trace.zip

## NotebookLM sources
Each daily Notebook must receive three source groups:

1. `source.md` — daily factual data only (ranking, typhoon/swell facts, tomorrow forecast data)
2. `templates/ks-reading-dictionary.md` — fixed KS pronunciation dictionary, added every run
3. `templates/fixed-web-sources.md` — fixed list of 9 web sources, added every run as NotebookLM web sources

Source priority:
- `source.md` is authoritative for the user's confirmed ranking, score, wave size, and wind direction.
- Fixed web sources are supplemental for weather, typhoon/swell context, area overview, and tomorrow forecast.
- Web sources must never overwrite or recalculate the confirmed daily ranking.
- If a web source cannot be fetched because of login, paywall, access denial, or source failure, record the failure and continue with the remaining sources.

The pronunciation dictionary is a fixed source and must not be merged into `source.md`.
Studio instructions remain separate from all source groups.

## State design
Keep a coarse phase plus detailed progress flags.

Example:
```json
{
  "run_id": "2026-10-12-01",
  "date": "2026-10-12",
  "phase": "GENERATION",
  "notebook_url": null,
  "progress": {
    "source_created": true,
    "notebook_created": false,
    "generation_requested": false,
    "video_downloaded": false,
    "video_validated": false,
    "youtube_uploaded": false
  },
  "attempts": {
    "chrome_start": 0,
    "generation": 0,
    "youtube_upload": 0
  },
  "errors": []
}
```

## Idempotency
- notebook name: `KS-YYYY-MM-DD`
- run_id stored in YouTube description metadata
- check existing state before any side effect
- generation request is written to state before clicking
- YouTube video_id is persisted immediately after API response

## NotebookLM Studio fixed generation options
- Style: Anime
- Length: choose the longer option, never the short option
These are required selections for every daily run.
