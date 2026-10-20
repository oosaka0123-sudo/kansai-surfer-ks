#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"prototype"/"ks-redesign"/"data"/"current-search-observations.json"
BODY={0:"フラット",1:"スネ",2:"ヒザ",3:"モモ",4:"腰",5:"腹",6:"胸",7:"肩",8:"頭"}

def center(low,high):
    return (float(low)+float(high))/2

def label(value):
    v=round(float(value)*2)/2
    v=max(0,min(8,v))
    if v==0:
        return "フラット"
    if v.is_integer():
        return f"{BODY[int(v)]}前後"
    lo=int(v//1); hi=lo+1
    return f"{BODY[lo]}〜{BODY[hi]}"

def midpoint(bcm_low,bcm_high,ks_low,ks_high):
    return label((center(bcm_low,bcm_high)+center(ks_low,ks_high))/2)

data=json.loads(DATA.read_text(encoding="utf-8"))
policy=data["consensus_policy"]["reference_midpoint"]
assert policy["enabled"] is True
assert policy["method"]=="50_50_midpoint"
assert policy["bcm_role"]=="delayed_public_sample_approx_reference"
assert policy["ks_role"]=="freshest_non_bcm_search_reference"
assert policy["ks_reference_max_age_minutes"]==180
assert policy["bcm_sample_max_age_minutes"]==2160
assert policy["bcm_requires_delayed_sample_kind"] is True
assert policy["proxy_mapping_allowed"] is True
assert policy["output"]=="reference_estimate_only"
assert policy["current_confirmation"]=="unchanged"

assert midpoint(4,5,3,4)=="腰前後"
assert midpoint(4,4,5,5)=="腰〜腹"
assert midpoint(2,3,2,3)=="ヒザ〜モモ"
assert midpoint(0,0,0,0)=="フラット"

print("BCM + KS midpoint reference policy tests passed")
