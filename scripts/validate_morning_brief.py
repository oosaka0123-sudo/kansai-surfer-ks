#!/usr/bin/env python3
import argparse
import copy
import json
import re
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "prototype" / "ks-redesign" / "data" / "morning-brief.json"
SCHEMA_VERSION = "ks-morning-brief-v2"
REQUIRED_SPOTS = ["磯ノ浦","国府の浜","生見","小松海岸","伊良湖","静波","浜詰","高浜","白兎"]
BANNED_PHRASES = [
    "今朝チェックしてきました", "今朝見てきました", "仲間から連絡が来ました", "仲間から聞きました",
    "今朝見に行ったら", "現地で見たところ", "さっき海を見て"
]
BANNED_PATTERNS = [
    re.compile(r"今朝.{0,12}(見|チェック|行)"),
    re.compile(r"(仲間|友人|知人|ローカル).{0,12}(連絡|聞)")
]
FALLBACK_KINDS = {"monthly_schedule", "sleague_top3", "kanoa_ranking", "kanoa_next_event"}
SOCIAL_ONLY_HOSTS = {"x.com", "twitter.com", "www.twitter.com", "instagram.com", "www.instagram.com", "facebook.com", "www.facebook.com", "tiktok.com", "www.tiktok.com"}

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

def validate(data, mode="preview"):
    errors = []
    opening = data.get("opening") or {}

    if data.get("schema_version") != SCHEMA_VERSION:
        errors.append(f"schema_version must be {SCHEMA_VERSION}")
    if not isinstance(data.get("verified"), bool):
        errors.append("verified must be boolean")
    if mode == "preview":
        if data.get("preview") is not True:
            errors.append("morning brief NAMI fixture must keep preview=true")
        if data.get("verified") is not False:
            errors.append("morning brief NAMI fixture must keep verified=false")
    elif mode == "production":
        if data.get("preview") is not False:
            errors.append("production morning context must keep preview=false")
        if data.get("verified") is not True:
            errors.append("production morning context must keep verified=true")
    else:
        errors.append(f"unknown validation mode: {mode}")

    if opening.get("greeting") != "おはようございます、木山です。":
        errors.append("opening.greeting must be the fixed Kiyama greeting")

    spots = data.get("spots") or []
    if not all(isinstance(x, dict) for x in spots):
        errors.append("spots must be an array of objects")
        spots = []
    if [x.get("name") for x in spots] != REQUIRED_SPOTS:
        errors.append("spots must contain the 9 fixed KS spots in canonical order")
    spot_map = {x.get("name"): x for x in spots}

    ranking = data.get("ranking") or []
    if not all(isinstance(x, dict) for x in ranking):
        errors.append("ranking must be an array of objects")
        ranking = []
    if len(ranking) > 5:
        errors.append("ranking must contain at most 5 entries")
    if ranking and [x.get("rank") for x in ranking] != list(range(1, len(ranking) + 1)):
        errors.append("ranking ranks must be consecutive starting at 1")
    if len({x.get("spot") for x in ranking if isinstance(x, dict)}) != len(ranking):
        errors.append("ranking must not contain duplicate spots")
    for item in ranking:
        spot_name = item.get("spot")
        basis = item.get("basis")
        if spot_name not in REQUIRED_SPOTS:
            errors.append(f"ranking spot is not a KS spot: {spot_name}")
            continue
        if basis not in ("current", "forecast"):
            errors.append(f"ranking {spot_name} requires basis=current|forecast")
            continue
        spot = spot_map.get(spot_name)
        if not spot:
            errors.append(f"ranking {spot_name} has no matching spot data")
            continue
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
        or any(isinstance(x, dict) and x.get("publish") is True for x in (data.get("competition_fallback") or []))
        or has_value(data.get("headline"))
        or has_value(data.get("closing"))
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
    fallbacks = data.get("competition_fallback") or []
    fallback_kinds = [item.get("kind") for item in fallbacks if isinstance(item, dict)]
    if set(fallback_kinds) != FALLBACK_KINDS or len(fallback_kinds) != len(FALLBACK_KINDS):
        errors.append("competition_fallback must contain each canonical fallback kind exactly once")
    for item in fallbacks:
        if not isinstance(item, dict):
            errors.append("competition_fallback items must be objects")
            continue
        kind = item.get("kind")
        if kind not in FALLBACK_KINDS:
            errors.append(f"unknown competition fallback kind: {kind}")
        if not isinstance(item.get("publish"), bool):
            errors.append(f"competition fallback {kind} publish must be boolean")
        if not isinstance(item.get("meaningful_change"), bool):
            errors.append(f"competition fallback {kind} meaningful_change must be boolean")
        try:
            repeat_days = int(item.get("repeat_after_days") or 0)
        except (TypeError, ValueError):
            repeat_days = 0
        if repeat_days < 3:
            errors.append(f"competition fallback {kind} repeat_after_days must be >= 3")
        populated = has_value(item.get("title")) or has_value(item.get("body"))
        if populated:
            for key in ("source", "checked_at"):
                if not item.get(key):
                    errors.append(f"competition fallback {kind} requires {key}")
        if item.get("publish") is True:
            if not (has_value(item.get("title")) and has_value(item.get("body"))):
                errors.append(f"competition fallback {kind} publish=true requires title and body")
            last_day = parse_day(item.get("last_published_at"))
            if item.get("last_published_at") and not last_day:
                errors.append(f"competition fallback {kind} has invalid last_published_at")
            if item.get("last_published_at") and not article_day:
                errors.append("article date must be valid when fallback repeat control is used")
            if last_day and article_day and not item.get("meaningful_change"):
                if (article_day - last_day).days < repeat_days:
                    errors.append(f"competition fallback {kind} violates repeat interval")

    for item in data.get("surf_news", []):
        if has_value(item.get("title")) or has_value(item.get("body")):
            for key in ("source", "published_at", "checked_at"):
                if not item.get(key):
                    errors.append(f"surf_news item requires {key}")

    safety_news = data.get("safety_news", [])
    if safety_news and not generated_at:
        errors.append("safety_news requires valid generated_at")
    for item in safety_news:
        for key in ("source_name", "source_url", "source_type", "published_at", "checked_at", "status"):
            if not item.get(key):
                errors.append(f"safety_news entry missing {key}")
        if item.get("source_url") and not str(item["source_url"]).startswith("https://"):
            errors.append("safety source_url must use https")
        if item.get("source_type") != "primary":
            errors.append("safety_news source_type must be primary")
        host = urlparse(str(item.get("source_url") or "")).hostname or ""
        if host.lower() in SOCIAL_ONLY_HOSTS:
            errors.append("social-media-only safety sources are not allowed")
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
    raw_status_checked = safety_status.get("checked_at")
    status_checked = parse_dt(raw_status_checked)
    sources = safety_status.get("sources") or []
    status_has_claim = bool(summary or raw_status_checked or sources)

    if raw_status_checked and not status_checked:
        errors.append("safety_status checked_at must be timezone-aware ISO")
    for source in sources:
        if not isinstance(source, dict) or not source.get("name") or not str(source.get("url", "")).startswith("https://"):
            errors.append("each safety_status source requires name and https url")
            continue
        if source.get("type") != "primary":
            errors.append("each safety_status source must have type=primary")
        host = urlparse(str(source.get("url") or "")).hostname or ""
        if host.lower() in SOCIAL_ONLY_HOSTS:
            errors.append("social-media-only safety status sources are not allowed")

    if status_has_claim:
        if not summary:
            errors.append("verified safety_status requires a non-empty summary")
        if not generated_at:
            errors.append("verified safety_status requires valid generated_at")
        if not status_checked:
            errors.append("verified safety_status requires valid checked_at")
        if not sources:
            errors.append("verified safety_status requires at least one primary source")
        if generated_at and status_checked:
            age = (generated_at - status_checked).total_seconds()
            if age < 0:
                errors.append("safety_status checked_at cannot be later than generated_at")
            elif age > 5400:
                errors.append("safety_status checked_at must be within 90 minutes of generated_at")

    blob = json.dumps(data, ensure_ascii=False)
    for phrase in BANNED_PHRASES:
        if phrase in blob:
            errors.append(f"fabricated-experience phrase is forbidden: {phrase}")
    for pattern in BANNED_PATTERNS:
        if pattern.search(blob):
            errors.append(f"fabricated-experience pattern is forbidden: {pattern.pattern}")

    return errors

def self_test(base):
    cases = []

    def add(name, payload, expected):
        cases.append((name, payload, expected))

    def assert_no_error(name, payload, forbidden):
        case_errors = validate(payload)
        if any(forbidden in error for error in case_errors):
            raise SystemExit(f"self-test failed: {name} unexpectedly returned {forbidden}: {case_errors}")

    bad = copy.deepcopy(base); bad["schema_version"] = "wrong"
    add("schema version", bad, "schema_version must be")

    bad = copy.deepcopy(base); bad["verified"] = True
    add("preview verified flag", bad, "verified=false")

    bad = copy.deepcopy(base); bad["preview"] = False
    add("preview flag", bad, "preview=true")

    bad = copy.deepcopy(base); bad["opening"]["greeting"] = "おはよう"
    add("wrong greeting", bad, "fixed Kiyama greeting")

    bad = copy.deepcopy(base); bad["opening"]["topic"].update({"text":"今朝ポイントを見てきました","source":"https://example.com/","checked_at":"2026-10-13T06:00:00+09:00"}); bad["generated_at"]="2026-10-13T06:30:00+09:00"
    add("fabricated phrase variant", bad, "fabricated-experience pattern")

    bad = copy.deepcopy(base); bad["opening"]["topic"].update({"text":"仲間から聞きました","source":"https://example.com/","checked_at":"2026-10-13T06:00:00+09:00"}); bad["generated_at"]="2026-10-13T06:30:00+09:00"
    add("fabricated exact phrase", bad, "fabricated-experience phrase")

    bad = copy.deepcopy(base); bad["spots"][0]["current"]="モモ"; bad["generated_at"]="2026-10-13T06:30:00+09:00"
    add("spot time missing", bad, "current requires current_at")

    bad = copy.deepcopy(base); bad["opening"]["osaka_weather"].update({"current":"晴れ","observed_at":"2026-10-13T06:00:00+09:00","checked_at":"2026-10-13T06:10:00+09:00"}); bad["generated_at"]="2026-10-13T06:30:00+09:00"
    add("weather source missing", bad, "Osaka current weather requires source")

    bad = copy.deepcopy(base); bad["competition_news"]=[{"title":"x","body":"y","published_at":"2026-10-13T05:00:00+09:00","checked_at":"2026-10-13T06:00:00+09:00"}]; bad["generated_at"]="2026-10-13T06:30:00+09:00"
    add("competition source missing", bad, "competition_news item requires source")

    bad = copy.deepcopy(base); bad["surf_news"]=[{"title":"x","body":"y","source":"https://example.com/","checked_at":"2026-10-13T06:00:00+09:00"}]; bad["generated_at"]="2026-10-13T06:30:00+09:00"
    add("surf published time missing", bad, "surf_news item requires published_at")

    bad = copy.deepcopy(base); bad["ranking"]=[{"rank":i+1,"spot":REQUIRED_SPOTS[i % len(REQUIRED_SPOTS)],"size":"モモ","basis":"current"} for i in range(6)]
    add("ranking too long", bad, "at most 5 entries")

    bad = copy.deepcopy(base); bad["ranking"]=[{"rank":2,"spot":"磯ノ浦","size":"モモ","basis":"current"}]
    add("ranking nonconsecutive", bad, "ranks must be consecutive")

    bad = copy.deepcopy(base); bad["ranking"]=[{"rank":1,"spot":"存在しない","size":"モモ","basis":"current"}]
    add("ranking unknown spot", bad, "not a KS spot")

    bad = copy.deepcopy(base); bad["spots"][0].update({"current":"モモ","current_at":"2026-10-13T06:00:00+09:00"}); bad["ranking"]=[{"rank":1,"spot":"磯ノ浦","size":"モモ","basis":"forecast"}]; bad["generated_at"]="2026-10-13T06:30:00+09:00"
    add("ranking forecast basis without forecast", bad, "basis=forecast requires spot forecast data")

    bad = copy.deepcopy(base); bad["spots"][0].update({"current":"モモ","current_at":"2026-10-13T06:00:00+09:00"}); bad["ranking"]=[{"rank":1,"spot":"磯ノ浦","size":"モモ","basis":"current"},{"rank":2,"spot":"磯ノ浦","size":"モモ","basis":"current"}]; bad["generated_at"]="2026-10-13T06:30:00+09:00"
    add("duplicate ranking spot", bad, "must not contain duplicate spots")

    bad = copy.deepcopy(base); bad["spots"]=list(reversed(bad["spots"]))
    add("wrong spot order", bad, "canonical order")

    bad = copy.deepcopy(base); bad["competition_fallback"][0]["repeat_after_days"]=2
    add("fallback minimum interval", bad, "repeat_after_days must be >= 3")

    bad = copy.deepcopy(base); bad["competition_fallback"]=bad["competition_fallback"][:-1]
    add("fallback kind missing", bad, "canonical fallback kind exactly once")

    bad = copy.deepcopy(base); bad["competition_fallback"][0]["kind"]="unknown_kind"
    add("fallback kind unknown", bad, "canonical fallback kind exactly once")

    bad = copy.deepcopy(base); bad["competition_fallback"][0]["publish"]="true"
    add("fallback publish type", bad, "publish must be boolean")

    bad = copy.deepcopy(base); bad["competition_fallback"][0].update({"publish":True,"title":"x","body":None,"source":"https://example.com/","checked_at":"2026-10-13T06:00:00+09:00"}); bad["generated_at"]="2026-10-13T06:30:00+09:00"
    add("fallback publish missing body", bad, "publish=true requires title and body")

    bad = copy.deepcopy(base); f=bad["competition_fallback"][0]; f.update({"title":"schedule","body":"body","source":"https://example.com/","checked_at":"2026-10-13T06:00:00+09:00","publish":True,"last_published_at":"2026-10-12","meaningful_change":False}); bad["generated_at"]="2026-10-13T06:30:00+09:00"
    add("fallback cooldown blocks publish", bad, "violates repeat interval")

    changed = copy.deepcopy(bad); changed["competition_fallback"][0]["meaningful_change"]=True
    assert_no_error("meaningful change override", changed, "violates repeat interval")

    eligible = copy.deepcopy(bad); eligible["competition_fallback"][0]["last_published_at"]="2026-10-10"
    assert_no_error("fallback after cooldown", eligible, "violates repeat interval")

    suppressed = copy.deepcopy(bad); suppressed["competition_fallback"][0]["publish"]=False
    assert_no_error("suppressed fallback ignores cooldown", suppressed, "violates repeat interval")

    safety_base = {
        "title":"test","body":"test","source_name":"JMA","source_url":"https://www.jma.go.jp/","source_type":"primary",
        "published_at":"2026-10-13T06:00:00+09:00","checked_at":"2026-10-13T06:10:00+09:00","status":"active","valid_until":"2026-10-13T08:00:00+09:00"
    }

    bad = copy.deepcopy(base); bad["generated_at"]=None; bad["safety_news"]=[copy.deepcopy(safety_base)]
    add("safety without generated_at", bad, "safety_news requires valid generated_at")

    bad = copy.deepcopy(base); bad["generated_at"]="2026-10-13T06:30:00+09:00"; item=copy.deepcopy(safety_base); item["checked_at"]="2026-10-13T04:00:00+09:00"; bad["safety_news"]=[item]
    add("stale safety news", bad, "within 90 minutes")

    bad = copy.deepcopy(base); bad["generated_at"]="2026-10-13T06:30:00+09:00"; item=copy.deepcopy(safety_base); item["source_url"]="http://example.com/"; bad["safety_news"]=[item]
    add("safety https", bad, "must use https")

    bad = copy.deepcopy(base); bad["generated_at"]="2026-10-13T06:30:00+09:00"; item=copy.deepcopy(safety_base); item["status"]="lifted"; bad["safety_news"]=[item]
    add("safety active status", bad, "active safety_news items may be published as current")

    bad = copy.deepcopy(base); bad["generated_at"]="2026-10-13T06:30:00+09:00"; item=copy.deepcopy(safety_base); item["valid_until"]="2026-10-13T06:20:00+09:00"; bad["safety_news"]=[item]
    add("safety expiry", bad, "expired safety_news")

    bad = copy.deepcopy(base); bad["generated_at"]="2026-10-13T06:30:00+09:00"; item=copy.deepcopy(safety_base); item["checked_at"]="2026-10-13T06:40:00+09:00"; bad["safety_news"]=[item]
    add("future safety check", bad, "cannot be later than generated_at")

    bad = copy.deepcopy(base); bad["generated_at"]="2026-10-13T06:30:00+09:00"; item=copy.deepcopy(safety_base); item["source_type"]="social"; bad["safety_news"]=[item]
    add("safety nonprimary source", bad, "source_type must be primary")

    bad = copy.deepcopy(base); bad["generated_at"]="2026-10-13T06:30:00+09:00"; item=copy.deepcopy(safety_base); item["source_url"]="https://x.com/example"; bad["safety_news"]=[item]
    add("social host with primary label", bad, "social-media-only safety sources are not allowed")

    bad = copy.deepcopy(base); bad["generated_at"]="2026-10-13T06:30:00+09:00"; bad["safety_status"]={"summary":None,"checked_at":"2026-10-13T06:10:00+09:00","sources":[{"name":"JMA","url":"https://www.jma.go.jp/","type":"primary"}]}
    add("safety status missing summary", bad, "non-empty summary")

    bad = copy.deepcopy(base); bad["generated_at"]=None; bad["safety_status"]={"summary":"特記事項なし","checked_at":"2026-10-13T06:10:00+09:00","sources":[{"name":"JMA","url":"https://www.jma.go.jp/","type":"primary"}]}
    add("safety status without generated_at", bad, "requires valid generated_at")

    bad = copy.deepcopy(base); bad["generated_at"]="2026-10-13T06:30:00+09:00"; bad["safety_status"]={"summary":"特記事項なし","checked_at":"2026-10-10T06:00:00+09:00","sources":[{"name":"JMA","url":"https://www.jma.go.jp/","type":"primary"}]}
    add("stale safety status", bad, "within 90 minutes")

    bad = copy.deepcopy(base); bad["generated_at"]="2026-10-13T06:30:00+09:00"; bad["safety_status"]={"summary":"特記事項なし","checked_at":"2026-10-13T06:10:00+09:00","sources":[{"name":"JMA","url":"https://www.jma.go.jp/"}]}
    add("safety status source type", bad, "type=primary")

    failures = []
    for name, payload, expected_fragment in cases:
        case_errors = validate(payload)
        if not any(expected_fragment in error for error in case_errors):
            failures.append(f"{name} (missing expected error: {expected_fragment}; got: {case_errors})")
    if failures:
        raise SystemExit("self-test failed: " + "; ".join(failures))

    production = copy.deepcopy(base)
    production["preview"] = False
    production["verified"] = True
    production_errors = validate(production, mode="production")
    if production_errors:
        raise SystemExit("production-mode self-test failed: " + "; ".join(production_errors))

    bad_production = copy.deepcopy(production)
    bad_production["verified"] = False
    if not any("verified=true" in e for e in validate(bad_production, mode="production")):
        raise SystemExit("production verified gate self-test failed")

    print(f"Morning brief negative self-tests passed ({len(cases)} cases)")
    print("Morning brief production-mode gate self-test passed")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--mode", choices=("preview", "production"), default="preview")
    parser.add_argument("--file", type=Path, default=DATA)
    args = parser.parse_args()

    data = json.loads(args.file.read_text(encoding="utf-8"))
    errors = validate(data, mode=args.mode)
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
