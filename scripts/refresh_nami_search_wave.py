#!/usr/bin/env python3
"""Refresh NAMI current-search wave observations from allowlisted public pages.

This is a staging collector. It makes a small number of polite requests, extracts only
current wave-size metadata, keeps source URLs in backend JSON, and never writes production.
"""
import argparse
import html
import json
import re
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path

JST=timezone(timedelta(hours=9))
SCHEMA_VERSION="ks-current-search-v1"
DEFAULT_INPUT=Path("prototype/ks-redesign/data/current-search-observations.json")
SOURCES=[
    {"id":"1173:磯ノ浦","spot":"磯ノ浦","url":"https://www.1173life.com/wakayama-wave-info","name":"1173life","parser":"1173","file":"isonoura.html","mapping_kind":"exact"},
    {"id":"1173:伊良湖","spot":"伊良湖","url":"https://www.1173life.com/irako-wave-info","name":"1173life","parser":"1173","file":"irago.html","mapping_kind":"exact"},
    {"id":"1173:静波","spot":"静波","url":"https://www.1173life.com/shizunami-wave-info","name":"1173life","parser":"1173","file":"shizunami.html","mapping_kind":"exact"},
    {"id":"bcm:磯ノ浦","spot":"磯ノ浦","url":"https://m.bc01.com/wave/10/123","name":"BCM","parser":"bcm_sample","file":"bcm-isonoura.html","source_spot":"和歌山・磯ノ浦","mapping_kind":"exact"},
    {"id":"bcm:国府の浜","spot":"国府の浜","url":"https://m.bc01.com/wave/10/114","name":"BCM","parser":"bcm_sample","file":"bcm-kou.html","source_spot":"国府の浜・テトラ前","mapping_kind":"exact"},
    {"id":"bcm:生見","spot":"生見","url":"https://m.bc01.com/wave/11/125","name":"BCM","parser":"bcm_sample","file":"bcm-ikumi.html","source_spot":"生見","mapping_kind":"exact"},
    {"id":"bcm:伊良湖","spot":"伊良湖","url":"https://m.bc01.com/wave/9/103","name":"BCM","parser":"bcm_sample","file":"bcm-irago.html","source_spot":"ロングビーチ","mapping_kind":"exact"},
    {"id":"bcm:静波","spot":"静波","url":"https://m.bc01.com/wave/8/90","name":"BCM","parser":"bcm_sample","file":"bcm-shizunami.html","source_spot":"静波","mapping_kind":"exact"},
    {"id":"bcm:浜詰","spot":"浜詰","url":"https://m.bc01.com/wave/13/193","name":"BCM","parser":"bcm_sample","file":"bcm-hatchohama.html","source_spot":"京都・八丁浜","mapping_kind":"nearby_proxy"},
    {"id":"bcm:高浜","spot":"高浜","url":"https://m.bc01.com/wave/13/142","name":"BCM","parser":"bcm_sample","file":"bcm-torihama.html","source_spot":"福井・鳥居浜","mapping_kind":"nearby_proxy"},
    {"id":"bcm:白兎","spot":"白兎","url":"https://m.bc01.com/wave/14/1007","name":"BCM","parser":"bcm_sample","file":"bcm-hakuto.html","source_spot":"鳥取・白兎","mapping_kind":"exact"},
]
BODY_VALUES={"スネ":1,"ヒザ":2,"モモ":3,"腰":4,"腹":5,"胸":6,"肩":7,"頭":8}
BODY_PATTERN=r"(?:フラット|スネ|すね|ヒザ|ひざ|膝|モモ|もも|コシ|こし|腰|ハラ|はら|腹|ムネ|むね|胸|カタ|かた|肩|アタマ|あたま|頭)(?:\s*[〜～~\-]\s*(?:スネ|すね|ヒザ|ひざ|膝|モモ|もも|コシ|こし|腰|ハラ|はら|腹|ムネ|むね|胸|カタ|かた|肩|アタマ|あたま|頭)(?:肩|胸|腹|腰|モモ|ヒザ|スネ)?)?"

class TextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts=[]
    def handle_data(self,data):
        if data and data.strip():
            self.parts.append(data.strip())

def iso(dt):
    return dt.astimezone(JST).replace(microsecond=0).isoformat()

def fetch_text(url, attempts=3):
    last=None
    for i in range(attempts):
        req=urllib.request.Request(url,headers={
            "User-Agent":"KansaiSurferKS-NAMI/1.0 (+https://kansai.rss7.net/)",
            "Accept":"text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        })
        try:
            with urllib.request.urlopen(req,timeout=20) as res:
                raw=res.read(2_000_000)
                charset=res.headers.get_content_charset() or "utf-8"
                page=raw.decode(charset,errors="replace")
                p=TextParser(); p.feed(page)
                return re.sub(r"\s+"," ",html.unescape(" ".join(p.parts)))
        except Exception as exc:
            last=exc
            if i+1<attempts:
                time.sleep(1+i)
    raise last

def canonical_size(raw):
    s=str(raw or "")
    replacements=[
        ("すね","スネ"),("ひざ","ヒザ"),("膝","ヒザ"),("もも","モモ"),
        ("コシ","腰"),("こし","腰"),("ハラ","腹"),("はら","腹"),
        ("ムネ","胸"),("むね","胸"),("カタ","肩"),("かた","肩"),
        ("アタマ","頭"),("あたま","頭"),("ほぼフラット","フラット"),
        ("～","〜"),("~","〜"),("－","-"),
    ]
    for a,b in replacements:
        s=s.replace(a,b)
    s=re.sub(r"\s+","",s)
    return s

def size_bounds(label):
    s=canonical_size(label)
    vals=[]
    for token,val in BODY_VALUES.items():
        if token in s:
            vals.append(val)
    if not vals:
        if "フラット" in s:
            return 0,0
        return None,None
    return min(vals),max(vals)

def parse_observed_at(text, now):
    patterns=[
        r"最終更新\s*[：:]?\s*(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})日?\s*(\d{1,2})[:時](\d{2})",
        r"(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})日?\s*(\d{1,2})[:時](\d{2})\s*(?:更新|時点)",
    ]
    for pat in patterns:
        m=re.search(pat,text)
        if m:
            y,mo,d,h,mi=map(int,m.groups())
            return datetime(y,mo,d,h,mi,tzinfo=JST)
    m=re.search(r"いまの波\s*(\d{1,2})[:時](\d{2})\s*時点",text)
    if m:
        h,mi=map(int,m.groups())
        candidate=now.astimezone(JST).replace(hour=h,minute=mi,second=0,microsecond=0)
        if candidate>now.astimezone(JST)+timedelta(minutes=10):
            candidate-=timedelta(days=1)
        return candidate
    return None

def rendered_text(path):
    page=Path(path).read_text(encoding="utf-8",errors="replace")
    p=TextParser(); p.feed(page)
    return re.sub(r"\s+"," ",html.unescape(" ".join(p.parts)))

def load_source_text(source, source_dir=None):
    if source_dir and source.get("file"):
        path=Path(source_dir)/source["file"]
        if path.exists() and path.stat().st_size>100:
            return rendered_text(path)
    return fetch_text(source["url"])

def bounds_label(low, high):
    if low==0 and high==0:
        return "フラット"
    rev={v:k for k,v in BODY_VALUES.items()}
    if low==high:
        return rev.get(low, "?")
    return f"{rev.get(low,'?')}〜{rev.get(high,'?')}"

def parse_bcm_check_at(text, now):
    m=re.search(r"CHECK\s*(\d{1,2})/(\d{1,2})(?:\([^)]*\))?\s*(\d{1,2}):(\d{2})", text, re.I)
    if not m:
        raise ValueError("BCM CHECK timestamp not found")
    mo,d,h,mi=map(int,m.groups())
    local_now=now.astimezone(JST)
    year=local_now.year
    candidate=datetime(year,mo,d,h,mi,tzinfo=JST)
    if candidate>local_now+timedelta(days=2):
        candidate=candidate.replace(year=year-1)
    return candidate

def parse_bcm_sample_source(source, now, source_dir=None):
    text=load_source_text(source,source_dir=source_dir)
    if "1日前の情報をサンプル表示" not in text:
        raise ValueError("BCM delayed public sample marker missing")

    check=re.search(r"CHECK\s*\d{1,2}/\d{1,2}(?:\([^)]*\))?\s*\d{1,2}:\d{2}",text,re.I)
    if not check:
        raise ValueError("BCM CHECK block missing")

    before=text[max(0,check.start()-140):check.start()]
    terms=list(re.finditer(r"(?:ほぼ)?フラット|スネ|すね|ヒザ|ひざ|膝|モモ|もも|コシ|こし|腰|ハラ|はら|腹|ムネ|むね|胸|カタ|かた|肩|アタマ|あたま|頭",before))
    if not terms:
        raise ValueError("BCM sample size expression not found")

    selected=[terms[-1]]
    for prev in reversed(terms[:-1]):
        if selected[0].start()-prev.end()<=18:
            selected.insert(0,prev)
        else:
            break
    raw_size=before[selected[0].start():selected[-1].end()].strip()
    low,high=size_bounds(raw_size)
    if low is None:
        raise ValueError("BCM sample size normalization failed")
    normalized=bounds_label(low,high)
    observed=parse_bcm_check_at(text,now)

    return {
        "spot":source["spot"],
        "raw_size":raw_size,
        "normalized_size":normalized,
        "wave_m":None,
        "wind":None,
        "observed_at":iso(observed),
        "source_url":source["url"],
        "source_checked_at":iso(now),
        "source_name":source["name"],
        "source_spot":source.get("source_spot") or source["spot"],
        "mapping_kind":source.get("mapping_kind") or "exact",
        "source_kind":"bcm_delayed_public_sample_reference",
        "confidence":"delayed_sample_reference",
        "sample_delay_days":1,
        "normalized_low":low,
        "normalized_high":high,
    }

def parse_1173_source(source, now, source_dir=None):
    text=load_source_text(source,source_dir=source_dir)

    markers=["いまの波","今の波","現在の波"]
    windows=[]
    for token in markers:
        for match in re.finditer(token,text):
            windows.append(text[match.start():match.start()+12000])
    if not windows:
        windows=[text]

    window=None
    combined=None
    for candidate in windows:
        combined=re.search(r"([0-9]+(?:\.[0-9]+)?)\s*m\b.{0,2500}?("+BODY_PATTERN+r")",candidate)
        if combined:
            window=candidate
            break
    if window is None:
        window=max(windows,key=len)
        size_match=re.search(BODY_PATTERN,window)
        if not size_match:
            body_terms=[term for term in BODY_VALUES if term in text]
            raise ValueError("current size expression not found; body terms="+",".join(body_terms[:8]))
        raw_size=size_match.group(0)
        wave_m=None
    else:
        wave_m=float(combined.group(1))
        raw_size=combined.group(2)

    normalized=canonical_size(raw_size)
    low,high=size_bounds(normalized)
    if low is None:
        raise ValueError("size normalization failed")

    wind=None
    wm=re.search(r"風\s*([^。\n]{0,55}?[0-9]+(?:\.[0-9]+)?\s*m/s)",window)
    if wm:
        wind=re.sub(r"\s+"," ",wm.group(1)).strip()

    observed=parse_observed_at(text,now)
    if not observed:
        raise ValueError("observation timestamp not found")

    return {
        "spot":source["spot"],
        "raw_size":raw_size,
        "normalized_size":normalized,
        "wave_m":wave_m,
        "wind":wind,
        "observed_at":iso(observed),
        "source_url":source["url"],
        "source_checked_at":iso(now),
        "source_name":source["name"],
        "source_kind":"free_public_wave_search",
        "confidence":"single_source_reference",
        "mapping_kind":source.get("mapping_kind") or "exact",
        "normalized_low":low,
        "normalized_high":high,
    }

def parse_source(source, now, source_dir=None):
    parser=source.get("parser") or "1173"
    if parser=="bcm_sample":
        return parse_bcm_sample_source(source,now,source_dir=source_dir)
    if parser=="1173":
        return parse_1173_source(source,now,source_dir=source_dir)
    raise ValueError(f"unknown source parser: {parser}")

def canonical_consensus_policy():
    fixture=json.loads(DEFAULT_INPUT.read_text(encoding="utf-8"))
    policy=fixture.get("consensus_policy")
    if not isinstance(policy,dict):
        raise ValueError("canonical consensus policy missing")
    return policy

def refresh(base, now, source_dir=None):
    if base.get("schema_version")!=SCHEMA_VERSION:
        raise ValueError("unexpected base schema")
    old={(x.get("spot"),x.get("source_url")):x for x in base.get("observations") or []}
    observations=[]
    status={}
    for src in SOURCES:
        key=(src["spot"],src["url"])
        try:
            item=parse_source(src,now,source_dir=source_dir)
            observations.append(item)
            status[src.get("id") or f'{src["name"]}:{src["spot"]}']={"ok":True,"spot":src["spot"],"source_name":src["name"],"source_url":src["url"],"observed_at":item["observed_at"]}
        except Exception as exc:
            if key in old:
                observations.append(old[key])
            status[src.get("id") or f'{src["name"]}:{src["spot"]}']={"ok":False,"spot":src["spot"],"source_name":src["name"],"source_url":src["url"],"error":type(exc).__name__,"detail":str(exc)[:160]}

    # Preserve observations from other independent sources (for future GPT/search enrichers).
    source_urls={s["url"] for s in SOURCES}
    for item in base.get("observations") or []:
        if item.get("source_url") not in source_urls:
            observations.append(item)

    observations.sort(key=lambda x:(x.get("spot") or "",x.get("source_url") or ""))
    out=dict(base)
    out["consensus_policy"]=canonical_consensus_policy()
    out.update({
        "verified":True,
        "preview":True,
        "date":now.astimezone(JST).strftime("%Y-%m-%d"),
        "checked_at":iso(now),
        "observations":observations,
        "source_fetch_status":status,
        "refresh_mode":"hourly_allowlist_with_bcm_delayed_sample_reference",
    })
    return out

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--input",type=Path,default=DEFAULT_INPUT)
    p.add_argument("--output",type=Path,required=True)
    p.add_argument("--source-dir",type=Path)
    args=p.parse_args()
    base=json.loads(args.input.read_text(encoding="utf-8"))
    now=datetime.now(JST)
    out=refresh(base,now,source_dir=args.source_dir)
    args.output.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    ok=sum(1 for x in out["source_fetch_status"].values() if x["ok"])
    print(f"SEARCH_REFRESH_OK={ok}/{len(SOURCES)}")
    for source_id,s in out["source_fetch_status"].items():
        print(f"SOURCE[{source_id}]={'OK' if s['ok'] else 'FAIL'} {s.get('observed_at') or s.get('error')} {s.get('detail','')}")

if __name__=="__main__":
    main()
