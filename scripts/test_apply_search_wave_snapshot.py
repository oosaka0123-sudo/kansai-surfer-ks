#!/usr/bin/env python3
import importlib.util
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("hybrid",ROOT/"scripts"/"apply_search_wave_snapshot.py")
mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)

base={
 "schema_version":"ks-morning-brief-v2","verified":True,"preview":False,
 "date":"2026-10-14","weekday":"水","generated_at":"2026-10-14T11:50:00+09:00",
 "opening":{"greeting":"おはようございます、木山です。","osaka_weather":{},"topic":{},"transition":"では今日の波を見ていきましょう。"},
 "headline":None,
 "ranking":[{"rank":1,"spot":"伊良湖","size":"波高1.0m","wind":"北","note":"既存KS評価ロジック 5.0/10","basis":"forecast"}],
 "spots":[{"name":n,"current":None,"current_at":None,"wind_current":None,"wind_current_at":None,"forecast":"波高1.0m","forecast_at":"2026-10-14T11:00:00+09:00","wind_forecast":"北 2.0m/s","wind_forecast_at":"2026-10-14T11:00:00+09:00"} for n in ["磯ノ浦","国府の浜","生見","小松海岸","伊良湖","静波","浜詰","高浜","白兎"]],
 "competition_news":[],"competition_fallback":[],"surf_news":[],"safety_news":[],"safety_status":{},"closing":None,
 "collection_meta":{"sources":{}},"sources_note":""
}
snapshot={
 "schema_version":"ks-search-wave-v1","generated_at":"2026-10-14T11:50:00+09:00",
 "policy":{"current_fresh_minutes":90,"current_aging_minutes":180},
 "spots":[
   {"name":"伊良湖","current_observations":[
     {"observed_at":"2026-10-14T11:10:00+09:00","normalized_label":"腰〜胸","normalized_low":4,"normalized_high":6,"source_name":"A","source_url":"https://a.example/"},
     {"observed_at":"2026-10-14T11:20:00+09:00","normalized_label":"胸〜肩","normalized_low":6,"normalized_high":7,"source_name":"B","source_url":"https://b.example/"}
   ],"forecast_observations":[]}
 ]
}
out=mod.apply(json.loads(json.dumps(base)),snapshot)
irago=next(x for x in out["spots"] if x["name"]=="伊良湖")
assert irago["current"]=="胸前後", irago
assert irago["search_wave"]["consensus"]["source_count"]==2
assert out["ranking"][0]["basis"]=="current"
assert out["ranking"][0]["size"]=="胸前後"

single=json.loads(json.dumps(snapshot))
single["spots"][0]["current_observations"]=single["spots"][0]["current_observations"][:1]
out2=mod.apply(json.loads(json.dumps(base)),single)
irago2=next(x for x in out2["spots"] if x["name"]=="伊良湖")
assert irago2["current"] is None
assert irago2["search_wave"]["status"]=="reference"

stale=json.loads(json.dumps(snapshot))
for x in stale["spots"][0]["current_observations"]:
    x["observed_at"]="2026-10-14T07:00:00+09:00"
out3=mod.apply(json.loads(json.dumps(base)),stale)
irago3=next(x for x in out3["spots"] if x["name"]=="伊良湖")
assert irago3["current"] is None
assert irago3["search_wave"]["reference"]["freshness"]=="stale"

print("Hybrid API + search tests passed")
