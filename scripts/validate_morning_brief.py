#!/usr/bin/env python3
import json
from datetime import datetime, timezone
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
        dt = dt.replace(tzinfo=timezone.utc)
    return dt

data = json.loads(DATA.read_text(encoding="utf-8"))
errors = []
opening = data.get("opening") or {}

if opening.get("greeting") != "おはようございます、木山です。":
    errors.append("opening.greeting must be the fixed Kiyama greeting")

spots = data.get("spots", [])
if [x.get("name") for x in spots] != REQUIRED_SPOTS:
    errors.append("spots must contain the 9 fixed KS spots in canonical order")

ranking = data.get("ranking", [])
if len(ranking) > 5:
    errors.append("ranking must contain at most 5 entries")
if ranking and [x.get("rank") for x in ranking] != list(range(1, len(ranking) + 1)):
    errors.append("ranking ranks must be consecutive starting at 1")

for spot in spots:
    if spot.get("current") and not spot.get("current_at"):
        errors.append(f"{spot.get('name')}: current requires current_at")
    if spot.get("forecast") and not spot.get("forecast_at"):
        errors.append(f"{spot.get('name')}: forecast requires forecast_at")

weather = opening.get("osaka_weather") or {}
if weather.get("current") or weather.get("forecast"):
    if not weather.get("source") or not weather.get("checked_at"):
        errors.append("Osaka weather values require source and checked_at")

topic = opening.get("topic") or {}
if topic.get("text") and (not topic.get("source") or not topic.get("checked_at")):
    errors.append("opening topic requires source and checked_at")

for item in data.get("competition_news", []):
    if item.get("title") or item.get("body"):
        if not item.get("source") or not item.get("checked_at"):
            errors.append("competition_news items require source and checked_at")

for item in data.get("competition_fallback", []):
    try:
        repeat_days = int(item.get("repeat_after_days") or 0)
    except (TypeError, ValueError):
        repeat_days = 0
    if repeat_days < 3:
        errors.append(f"competition fallback {item.get('kind')} repeat_after_days must be >= 3")
    if item.get("title") or item.get("body"):
        if not item.get("source") or not item.get("checked_at"):
            errors.append(f"competition fallback {item.get('kind')} requires source and checked_at")

for item in data.get("surf_news", []):
    if item.get("title") or item.get("body"):
        if not item.get("source") or not item.get("checked_at"):
            errors.append("surf_news items require source and checked_at")

generated_at = parse_dt(data.get("generated_at"))
for item in data.get("safety_news", []):
    for key in ("source_name", "source_url", "published_at", "checked_at", "status"):
        if not item.get(key):
            errors.append(f"safety_news entry missing {key}")
    if item.get("source_url") and not str(item["source_url"]).startswith("https://"):
        errors.append("safety source_url must use https")
    if item.get("status") != "active":
        errors.append("only active safety_news items may be published as current")
    checked_at = parse_dt(item.get("checked_at"))
    if generated_at and checked_at and abs((generated_at - checked_at).total_seconds()) > 5400:
        errors.append("safety_news checked_at must be within 90 minutes of generated_at")
    valid_until = parse_dt(item.get("valid_until"))
    if generated_at and valid_until and valid_until < generated_at:
        errors.append("expired safety_news item must not be published as current")

safety_status = data.get("safety_status") or {}
summary = str(safety_status.get("summary") or "")
if "特記事項なし" in summary:
    if not safety_status.get("checked_at") or not safety_status.get("sources"):
        errors.append("safety_status cannot claim no issues without checked_at and sources")

blob = json.dumps(data, ensure_ascii=False)
for phrase in BANNED_PHRASES:
    if phrase in blob:
        errors.append(f"fabricated-experience phrase is forbidden: {phrase}")

if errors:
    print("Morning brief validation FAILED")
    for error in errors:
        print(f"- {error}")
    raise SystemExit(1)

print("Morning brief validation passed")
