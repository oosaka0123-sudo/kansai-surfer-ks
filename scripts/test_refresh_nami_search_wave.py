#!/usr/bin/env python3
import importlib.util
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("collector",ROOT/"scripts"/"refresh_nami_search_wave.py")
collector=importlib.util.module_from_spec(spec); spec.loader.exec_module(collector)
JST=timezone(timedelta(hours=9))

sample="""最終更新：2026-10-14 19:00 いまの波 19:00時点 0.88 m 腰〜胸肩 風 サイドオン 南西 7.3m/s 今日のベスト時間帯"""
assert collector.canonical_size("ひざ〜もも")=="ヒザ〜モモ"
assert collector.canonical_size("コシ〜ハラ")=="腰〜腹"
assert collector.size_bounds("腰〜胸肩")== (4,7)
assert collector.size_bounds("ヒザ〜モモ")== (2,3)
dt=collector.parse_observed_at(sample,datetime(2026,10,14,19,31,tzinfo=JST))
assert dt.isoformat()=="2026-10-14T19:00:00+09:00"

real_fetch=collector.fetch_text
collector.fetch_text=lambda url: sample
try:
    item=collector.parse_source({"spot":"伊良湖","url":"https://example.com/","name":"test"},datetime(2026,10,14,19,31,tzinfo=JST))
finally:
    collector.fetch_text=real_fetch
assert item["normalized_size"]=="腰〜胸肩"
assert item["normalized_low"]==4 and item["normalized_high"]==7
assert item["wave_m"]==0.88
assert item["observed_at"]=="2026-10-14T19:00:00+09:00"
assert "南西" in (item["wind"] or "")

base={
 "schema_version":"ks-current-search-v1","verified":True,"preview":True,
 "date":"2026-10-14","checked_at":"2026-10-14T11:51:00+09:00",
 "observations":[],
 "consensus_policy":{"fresh_minutes":90,"aging_minutes":180,"minimum_independent_sources":2,"single_source":"reference_only","source_visibility":"backend_only"}
}
real_parse=collector.parse_source
collector.SOURCES=[{"spot":"伊良湖","url":"https://example.com/","name":"test"}]
collector.parse_source=lambda src,now:item
try:
    out=collector.refresh(base,datetime(2026,10,14,19,31,tzinfo=JST))
finally:
    collector.parse_source=real_parse
assert out["date"]=="2026-10-14"
assert out["checked_at"]=="2026-10-14T19:31:00+09:00"
assert out["source_fetch_status"]["伊良湖"]["ok"] is True
assert out["refresh_mode"]=="hourly_allowlist_plus_gpt_search_enrichment"
print("NAMI search-wave refresh tests passed")
