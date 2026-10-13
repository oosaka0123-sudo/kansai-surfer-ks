#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "prototype" / "ks-redesign" / "data" / "morning-brief.json"
REQUIRED_SPOTS = ["磯ノ浦","国府の浜","生見","小松海岸","伊良湖","静波","浜詰","高浜","白兎"]
BANNED_PHRASES = ["今朝チェックしてきました","今朝見てきました","仲間から連絡が来ました","仲間から聞きました"]

data = json.loads(DATA.read_text(encoding="utf-8"))

errors = []
opening = data.get("opening") or {}
if opening.get("greeting") != "おはようございます、木山です。":
    errors.append("opening.greeting must be the fixed Kiyama greeting")

spots = [x.get("name") for x in data.get("spots", [])]
if spots != REQUIRED_SPOTS:
    errors.append("spots must contain the 9 fixed KS spots in canonical order")

for item in data.get("competition_fallback", []):
    if int(item.get("repeat_after_days", 0)) < 3:
        errors.append(f"competition fallback {item.get('kind')} repeat_after_days must be >= 3")

for item in data.get("safety_news", []):
    for key in ("source_name", "source_url", "published_at", "checked_at"):
        if not item.get(key):
            errors.append(f"safety_news entry missing {key}")
    if item.get("source_url") and not str(item["source_url"]).startswith("https://"):
        errors.append("safety source_url must use https")

blob = json.dumps(data, ensure_ascii=False)
for phrase in BANNED_PHRASES:
    if phrase in blob:
        errors.append(f"fabricated-experience phrase is forbidden: {phrase}")

if errors:
    print("Morning brief validation FAILED")
    for e in errors:
        print(f"- {e}")
    raise SystemExit(1)

print("Morning brief validation passed")
