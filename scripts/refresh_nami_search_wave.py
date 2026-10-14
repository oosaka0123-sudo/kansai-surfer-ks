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
    {"spot":"磯ノ浦","url":"https://www.1173life.com/wakayama-wave-info","name":"1173life","file":"isonoura.html"},
    {"spot":"伊良湖","url":"https://www.1173life.com/irako-wave-info","name":"1173life","file":"irago.html"},
    {"spot":"静波","url":"https://www.1173life.com/shizunami-wave-info","name":"1173life","file":"shizunami.html"},
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
        ("アタマ","頭"),("あたま","頭"),("～","〜"),("~","〜"),
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

def parse_source(source, now, source_dir=None):
    text=None
    if source_dir and source.get("file"):
        path=Path(source_dir)/source["file"]
        if path.exists() and path.stat().st_size>100:
            text=rendered_text(path)
    if not text:
        text=fetch_text(source["url"])

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
        "normalized_low":low,
        "normalized_high":high,
    }

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
            status[src["spot"]]={"ok":True,"source_url":src["url"],"observed_at":item["observed_at"]}
        except Exception as exc:
            if key in old:
                observations.append(old[key])
            status[src["spot"]]={"ok":False,"source_url":src["url"],"error":type(exc).__name__,"detail":str(exc)[:160]}

    # Preserve observations from other independent sources (for future GPT/search enrichers).
    source_urls={s["url"] for s in SOURCES}
    for item in base.get("observations") or []:
        if item.get("source_url") not in source_urls:
            observations.append(item)

    observations.sort(key=lambda x:(x.get("spot") or "",x.get("source_url") or ""))
    out=dict(base)
    out.update({
        "verified":True,
        "preview":True,
        "date":now.astimezone(JST).strftime("%Y-%m-%d"),
        "checked_at":iso(now),
        "observations":observations,
        "source_fetch_status":status,
        "refresh_mode":"hourly_allowlist_plus_gpt_search_enrichment",
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
    for spot,s in out["source_fetch_status"].items():
        print(f"SOURCE[{spot}]={'OK' if s['ok'] else 'FAIL'} {s.get('observed_at') or s.get('error')} {s.get('detail','')}")

if __name__=="__main__":
    main()
