#!/usr/bin/env python3
import argparse
import copy
import json
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "prototype" / "ks-redesign" / "data" / "morning-brief.json"
REQUIRED_SPOTS = ["磯ノ浦","国府の浜","生見","小松海岸","伊良湖","静波","浜詰","高浜","白兎"]
BANNED_PHRASES = [
    "今朝チェックしてきました", "今朝見てきました", "仲間から連絡が来ました", "仲間から聞きました",
    "今朝見に行ったら", "現地で見たところ", "さっき海を見て"
]

def parse_dt(value):
    if not value:
        return None
    text = str(value).replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is None:
        return None
    return dt.astimezone(timezone.utc)

def parse_day(value):
    if not value:
        return None
    text = str(value)
    try:
        if "T" in text:
            return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
        return date.fromisoformat(text[:10])
    except ValueError:
        return None

def has_value(value):
    return value is not None and value != ""

def validate(data):
    errors = []
    opening = data.get("opening") or {}

    if opening.get("greeting") != "おはようございます、木山です。":
        errors.append("opening.greeting must be the fixed Kiyama greeting")

    spots = data.get("spots", [])
    if [x.get("name") for x in spots] != REQUIRED_SPOTS:
        errors.append("spots must contain the 9 fixed KS spots in canonical order")
    spot_map = {x.get("name"): x for x in spots}

    ranking = data.get("ranking", [])
    if len(ranking) > 5:
        errors.append("ranking must contain at most 5 entries")
    if ranking and [x.get("rank") for x in ranking] != list(range(1, len(ranking) + 1)):
        errors.append("ranking ranks must be consecutive starting at 1")
    for item in ranking:
        spot_name = item.get("spot")
        basis = item.get("basis")
        if spot_name not in REQUIRED_SPOTS:
            errors.append(f"ranking spot is not a KS spot: {spot_name}")
            continue
        if basis not in ("current", "forecast"):
            errors.append(f"ranking {spot_name} requires basis=current|forecast")
            continue
        spot = spot_map[spot_name]
        if basis == "current" and not has_value(spot.get("current")):
            errors.append(f"ranking {spot_name} basis=current requires spot current data")
        if basis == "forecast" and not has_value(spot.get("forecast")):
            errors.append(f"ranking {spot_name} basis=forecast requires spot forecast data")
        if not has_value(item.get("size")):
            errors.append(f"ranking {spot_name} requires size")

    for spot in spots:
        name = spot.get("name")
        pairs = [
            ("current", "current_at"),
            ("wind_current", "wind_current_at"),
            ("forecast", "forecast_at"),
            ("wind_forecast", "wind_forecast_at"),
        ]
        for value_key, time_key in pairs:
            if has_value(spot.get(value_key)) and not spot.get(time_key):
                errors.append(f"{name}: {value_key} requires {time_key}")

    weather = opening.get("osaka_weather") or {}
    if has_value(weather.get("current")):
        for key in ("source", "observed_at", "checked_at"):
            if not weather.get(key):
                errors.append(f"Osaka current weather requires {key}")
    if has_value(weather.get("forecast")):
        for key in ("source", "forecast_at", "checked_at"):
            if not weather.get(key):
                errors.append(f"Osaka forecast requires {key}")

    topic = opening.get("topic") or {}
    if has_value(topic.get("text")) and (not topic.get("source") or not topic.get("checked_at")):
        errors.append("opening topic requires source and checked_at")

    generated_at = parse_dt(data.get("generated_at"))
    has_fact_content = bool(
        ranking
        or any(has_value(s.get(k)) for s in spots for k in ("current","wind_current","forecast","wind_forecast"))
        or data.get("competition_news")
        or data.get("surf_news")
        or data.get("safety_news")
        or has_value(weather.get("current"))
        or has_value(weather.get("forecast"))
        or has_value(topic.get("text"))
    )
    if has_fact_content and not generated_at:
        errors.append("generated_at must be a valid timezone-aware ISO timestamp when factual content is present")

    for item in data.get("competition_news", []):
        if has_value(item.get("title")) or has_value(item.get("body")):
            for key in ("source", "published_at", "checked_at"):
                if not item.get(key):
                    errors.append(f"competition_news item requires {key}")

    article_day = parse_day(data.get("date"))
    for item in data.get("competition_fallback", []):
        try:
            repeat_days = int(item.get("repeat_after_days") or 0)
        except (TypeError, ValueError):
            repeat_days = 0
        if repeat_days < 3:
            errors.append(f"competition fallback {item.get('kind')} repeat_after_days must be >= 3")
        populated = has_value(item.get("title")) or has_value(item.get("body"))
        if populated:
            for key in ("source", "checked_at"):
                if not item.get(key):
                    errors.append(f"competition fallback {item.get('kind')} requires {key}")
            last_day = parse_day(item.get("last_published_at"))
            if item.get("last_published_at") and not last_day:
                errors.append(f"competition fallback {item.get('kind')} has invalid last_published_at")
            if last_day and article_day and not item.get("meaningful_change"):
                if (article_day - last_day).days < repeat_days:
                    errors.append(f"competition fallback {item.get('kind')} violates repeat interval")
            if item.get("last_published_at") and not article_day:
                errors.append("article date must be valid when fallback repeat control is used")

    for item in data.get("surf_news", []):
        if has_value(item.get("title")) or has_value(item.get("body")):
            for key in ("source", "published_at", "checked_at"):
                if not item.get(key):
                    errors.append(f"surf_news item requires {key}")

    safety_news = data.get("safety_news", [])
    if safety_news and not generated_at:
        errors.append("safety_news requires valid generated_at")
    for item in safety_news:
        for key in ("source_name", "source_url", "published_at", "checked_at", "status"):
            if not item.get(key):
                errors.append(f"safety_news entry missing {key}")
        if item.get("source_url") and not str(item["source_url"]).startswith("https://"):
            errors.append("safety source_url must use https")
        if item.get("status") != "active":
            errors.append("only active safety_news items may be published as current")

        published_at = parse_dt(item.get("published_at"))
        checked_at = parse_dt(item.get("checked_at"))
        if item.get("published_at") and not published_at:
            errors.append("safety_news published_at must be timezone-aware ISO")
        if item.get("checked_at") and not checked_at:
            errors.append("safety_news checked_at must be timezone-aware ISO")
        if generated_at and checked_at:
            age = (generated_at - checked_at).total_seconds()
            if age < 0:
                errors.append("safety_news checked_at cannot be later than generated_at")
            elif age > 5400:
                errors.append("safety_news checked_at must be within 90 minutes of generated_at")

        if item.get("valid_until"):
            valid_until = parse_dt(item.get("valid_until"))
            if not valid_until:
                errors.append("safety_news valid_until must be timezone-aware ISO")
            elif generated_at and valid_until < generated_at:
                errors.append("expired safety_news item must not be published as current")

    safety_status = data.get("safety_status") or {}
    summary = str(safety_status.get("summary") or "")
    status_checked = parse_dt(safety_status.get("checked_at"))
    sources = safety_status.get("sources") or []
    if safety_status.get("checked_at") and not status_checked:
        errors.append("safety_status checked_at must be timezone-aware ISO")
    for source in sources:
        if not isinstance(source, dict) or not source.get("name") or not str(source.get("url", "")).startswith("https://"):
            errors.append("each safety_status source requires name and https url")
    if "特記事項なし" in summary:
        if not status_checked or not sources:
            errors.append("safety_status cannot claim no issues without valid checked_at and sources")
        if not generated_at:
            errors.append("verified safety_status requires valid generated_at")
        elif status_checked:
            age = (generated_at - status_checked).total_seconds()
            if age < 0:
                errors.append("safety_status checked_at cannot be later than generated_at")
            elif age > 5400:
                errors.append("safety_status checked_at must be within 90 minutes of generated_at")

    blob = json.dumps(data, ensure_ascii=False)
    for phrase in BANNED_PHRASES:
        if phrase in blob:
            errors.append(f"fabricated-experience phrase is forbidden: {phrase}")

    return errors

def self_test(base):
    cases = []

    bad = copy.deepcopy(base); bad["opening"]["greeting"] = "おはよう"; cases.append(("wrong greeting", bad))
    bad = copy.deepcopy(base); bad["competition_fallback"][0]["repeat_after_days"] = 2; cases.append(("fallback interval", bad))
    bad = copy.deepcopy(base); bad["opening"]["topic"]["text"] = "仲間から聞きました"; cases.append(("fabricated phrase", bad))

    bad = copy.deepcopy(base)
    bad["generated_at"] = "2026-10-13T06:30:00+09:00"
    bad["safety_news"] = [{
        "title":"test","body":"test","source_name":"official","source_url":"https://example.com/",
        "published_at":"2026-10-13T04:00:00+09:00","checked_at":"2026-10-13T04:00:00+09:00","status":"active"
    }]
    cases.append(("stale safety", bad))

    bad = copy.deepcopy(base)
    bad["generated_at"] = None
    bad["safety_news"] = [{
        "title":"test","body":"test","source_name":"official","source_url":"https://example.com/",
        "published_at":"2026-10-13T06:00:00+09:00","checked_at":"2026-10-13T06:00:00+09:00","status":"active"
    }]
    cases.append(("safety without generated_at", bad))

    bad = copy.deepcopy(base)
    bad["generated_at"] = "2026-10-13T06:30:00+09:00"
    bad["spots"][0]["current"] = "モモ"
    bad["spots"][0]["current_at"] = "2026-10-13T06:00:00+09:00"
    bad["ranking"] = [{"rank":1,"spot":"磯ノ浦","size":"モモ","basis":"forecast"}]
    cases.append(("ranking basis without data", bad))

    failures = []
    for name, payload in cases:
        if not validate(payload):
            failures.append(name)
    if failures:
        raise SystemExit("self-test expected validation failures but passed: " + ", ".join(failures))
    print(f"Morning brief negative self-tests passed ({len(cases)} cases)")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    data = json.loads(DATA.read_text(encoding="utf-8"))
    errors = validate(data)
    if errors:
        print("Morning brief validation FAILED")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)
    print("Morning brief validation passed")
    if args.self_test:
        self_test(data)

if __name__ == "__main__":
    main()
