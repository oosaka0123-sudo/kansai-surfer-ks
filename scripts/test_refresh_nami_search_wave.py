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

bcm_sample="""生見 波情報 ※1日前の情報をサンプル表示 Image Image コシ～ハラたまのsetムネ CHECK 10/19(月) 10:00 ▽ 25 SAMPLE 画像はサンプルです 弱 南南東/サイドオン"""
real_fetch=collector.fetch_text
collector.fetch_text=lambda url: bcm_sample
try:
    bcm=collector.parse_source({
        "id":"bcm:生見","spot":"生見","url":"https://m.bc01.com/wave/11/125","name":"BCM",
        "parser":"bcm_sample","source_spot":"生見","mapping_kind":"exact"
    },datetime(2026,10,20,9,16,tzinfo=JST))
finally:
    collector.fetch_text=real_fetch
assert bcm["normalized_size"]=="腰〜胸"
assert bcm["normalized_low"]==4 and bcm["normalized_high"]==6
assert bcm["observed_at"]=="2026-10-19T10:00:00+09:00"
assert bcm["source_kind"]=="bcm_delayed_public_sample_reference"
assert bcm["confidence"]=="delayed_sample_reference"
assert bcm["sample_delay_days"]==1
assert bcm["mapping_kind"]=="exact"

base={
 "schema_version":"ks-current-search-v1","verified":True,"preview":True,
 "date":"2026-10-14","checked_at":"2026-10-14T11:51:00+09:00",
 "observations":[],
 "consensus_policy":{"fresh_minutes":90,"aging_minutes":180,"minimum_independent_sources":2,"single_source":"reference_only","source_visibility":"backend_only","reference_midpoint":{"enabled":True,"method":"50_50_midpoint","ks_fresh_minutes":90,"bcm_sample_max_age_minutes":2160,"bcm_requires_delayed_sample_kind":True,"proxy_mapping_allowed":True,"output":"reference_estimate_only","current_confirmation":"unchanged"}}
}
real_parse=collector.parse_source
collector.SOURCES=[{"id":"test:伊良湖","spot":"伊良湖","url":"https://example.com/","name":"test","parser":"1173"}]
collector.parse_source=lambda src,now,source_dir=None:item
try:
    out=collector.refresh(base,datetime(2026,10,14,19,31,tzinfo=JST))
finally:
    collector.parse_source=real_parse
assert out["date"]=="2026-10-14"
assert out["checked_at"]=="2026-10-14T19:31:00+09:00"
assert out["source_fetch_status"]["test:伊良湖"]["ok"] is True
assert out["refresh_mode"]=="hourly_allowlist_with_bcm_delayed_sample_reference"
assert out["consensus_policy"]["reference_midpoint"]["bcm_sample_max_age_minutes"]==2160
print("NAMI search-wave refresh tests passed")
