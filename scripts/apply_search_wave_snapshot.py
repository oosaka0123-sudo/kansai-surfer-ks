#!/usr/bin/env python3
import argparse
import copy
import json
from datetime import datetime, timezone
from pathlib import Path

BODY_LABEL = {1:"スネ",2:"ヒザ",3:"モモ",4:"腰",5:"腹",6:"胸",7:"肩",8:"頭"}

def parse_dt(value):
    if not value:
        return None
    try:
        dt=datetime.fromisoformat(str(value).replace("Z","+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        return None
    return dt

def age_minutes(now, then):
    if not now or not then:
        return None
    return max(0, (now.astimezone(timezone.utc)-then.astimezone(timezone.utc)).total_seconds()/60)

def range_label(low, high):
    if low is None or high is None:
        return None
    low=int(low); high=int(high)
    if low==high:
        return f"{BODY_LABEL.get(low,'?')}前後"
    return f"{BODY_LABEL.get(low,'?')}〜{BODY_LABEL.get(high,'?')}"

def latest(items, key):
    valid=[]
    for item in items or []:
        dt=parse_dt(item.get(key))
        if dt:
            valid.append((dt,item))
    return max(valid,key=lambda x:x[0])[1] if valid else None

def build_search_state(snapshot_spot, generated_at, policy):
    currents=[]
    for item in snapshot_spot.get("current_observations") or []:
        dt=parse_dt(item.get("observed_at"))
        if not dt:
            continue
        age=age_minutes(generated_at,dt)
        row=copy.deepcopy(item)
        row["age_minutes"]=round(age,1) if age is not None else None
        if age is None:
            row["freshness"]="unavailable"
        elif age <= policy["current_fresh_minutes"]:
            row["freshness"]="fresh"
        elif age <= policy["current_aging_minutes"]:
            row["freshness"]="aging"
        else:
            row["freshness"]="stale"
        currents.append(row)

    usable=[x for x in currents if x["freshness"] in ("fresh","aging") and x.get("normalized_low") and x.get("normalized_high")]
    consensus=None
    if len(usable) >= 2:
        low=max(int(x["normalized_low"]) for x in usable)
        high=min(int(x["normalized_high"]) for x in usable)
        if low <= high:
            consensus={
                "label":range_label(low,high),
                "low":low,
                "high":high,
                "source_count":len(usable),
                "confidence":"confirmed",
                "observed_at":max(x["observed_at"] for x in usable),
            }

    reference=latest(currents,"observed_at")
    forecast=latest(snapshot_spot.get("forecast_observations") or [],"forecast_at")
    if forecast:
        forecast=copy.deepcopy(forecast)

    return {
        "status":"confirmed" if consensus else ("reference" if reference else "unavailable"),
        "consensus":consensus,
        "reference":reference,
        "forecast_reference":forecast,
        "searched_at":None,
        "source_visibility":"hidden",
    }

def apply(context, snapshot):
    if snapshot.get("schema_version")!="ks-search-wave-v1":
        raise ValueError("unsupported search snapshot schema")
    generated_at=parse_dt(context.get("generated_at"))
    if not generated_at:
        raise ValueError("context generated_at must be timezone-aware")
    policy=snapshot.get("policy") or {}
    policy={
        "current_fresh_minutes":int(policy.get("current_fresh_minutes",90)),
        "current_aging_minutes":int(policy.get("current_aging_minutes",180)),
    }
    searched_at=snapshot.get("generated_at")
    by_name={x.get("name"):x for x in snapshot.get("spots") or []}
    confirmed=0
    references=0
    forecast_refs=0

    for spot in context.get("spots") or []:
        src=by_name.get(spot.get("name"),{"name":spot.get("name")})
        state=build_search_state(src,generated_at,policy)
        state["searched_at"]=searched_at
        spot["search_wave"]=state

        if state["consensus"]:
            confirmed += 1
            spot["current"]=state["consensus"]["label"]
            spot["current_at"]=state["consensus"]["observed_at"]
        elif state["reference"]:
            references += 1
        if state["forecast_reference"]:
            forecast_refs += 1

    # Preserve the existing deterministic API ranking order. If a ranked spot
    # has a confirmed multi-source current-size consensus, surface that current
    # size without inventing a cross-scale re-ranking.
    spot_map={x.get("name"):x for x in context.get("spots") or []}
    for item in context.get("ranking") or []:
        spot=spot_map.get(item.get("spot")) or {}
        state=spot.get("search_wave") or {}
        consensus=state.get("consensus")
        if consensus:
            item["size"]=consensus["label"]
            item["basis"]="current"
            item["note"]="検索合議を現在サイズに採用／順位順はAPI評価を維持"
        else:
            item["basis"]="forecast"

    context["headline"]="API予報＋無料波情報検索を分けて照合するNAMIデータ検証版です。"
    context["closing"]="検索で確認できたサイズとAPI予報は別データとして扱い、古い検索情報や単独ソースは現在サイズに確定しません。"
    context.setdefault("collection_meta",{})["hybrid_search"]={
        "schema_version":snapshot.get("schema_version"),
        "searched_at":searched_at,
        "confirmed_current_spots":confirmed,
        "reference_current_spots":references,
        "search_forecast_spots":forecast_refs,
        "source_visibility":"backend_only",
        "policy":"2以上の新鮮な検索サイズが重なる場合のみ current に昇格。API予報は別表示。",
    }
    context["sources_note"]=(context.get("sources_note") or "")+" / GPT web-search wave snapshot is retained only in backend metadata; source names/URLs are not rendered."
    return context

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--context",type=Path,required=True)
    p.add_argument("--search",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    context=json.loads(args.context.read_text(encoding="utf-8"))
    snapshot=json.loads(args.search.read_text(encoding="utf-8"))
    result=apply(context,snapshot)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    meta=result["collection_meta"]["hybrid_search"]
    print("KS_HYBRID_SEARCH_APPLIED")
    print("CONFIRMED_CURRENT_SPOTS="+str(meta["confirmed_current_spots"]))
    print("REFERENCE_CURRENT_SPOTS="+str(meta["reference_current_spots"]))
    print("SEARCH_FORECAST_SPOTS="+str(meta["search_forecast_spots"]))
    for spot in result.get("spots",[]):
        state=spot.get("search_wave") or {}
        ref=state.get("reference") or {}
        fc=state.get("forecast_reference") or {}
        if ref.get("normalized_label"):
            print(f"SEARCH_REF[{spot['name']}]={ref['normalized_label']}|{ref.get('freshness')}|{ref.get('observed_at')}")
        elif fc.get("normalized_label"):
            print(f"SEARCH_FORECAST[{spot['name']}]={fc['normalized_label']}|{fc.get('forecast_at')}")

if __name__=="__main__":
    main()
