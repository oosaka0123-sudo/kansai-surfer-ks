#!/usr/bin/env python3
"""Build a verified, fail-closed KS morning external context from official public sources.

This collector never invents missing facts. Each adapter may fail independently; failed
sources are recorded in collection_meta and their fields remain empty/unpublished.
"""
import argparse
import html
import json
import re
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

JST = timezone(timedelta(hours=9))
SCHEMA_VERSION = "ks-morning-brief-v2"
SLEAGUE_RANKING_URL = "https://sleague.jp/ranking/?league=s1"
SLEAGUE_SCHEDULE_URL = "https://sleague.jp/schedule/"
JMA_EXTRA_FEED = "https://www.data.jma.go.jp/developer/xml/feed/extra.xml"
JMA_EQVOL_FEED = "https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml"
JCG_RSS_URL = "https://www6.kaiho.mlit.go.jp/rss.xml"

SPOTS = ["磯ノ浦","国府の浜","生見","小松海岸","伊良湖","静波","浜詰","高浜","白兎"]
REGION_WORDS = [
    "和歌山","三重","徳島","愛知","静岡","京都","福井","鳥取","高知",
    "紀伊水道","熊野灘","遠州灘","東海海域東部","東海海域西部","四国沖",
    "若狭湾","山陰沖東部","山陰沖西部","山陰沖東部及び若狭湾付近"
]
JMA_TITLES = ("津波警報・注意報・予報", "気象警報・注意報", "地方海上警報")
MARINE_WARNING_WORDS = ("波浪", "高潮", "暴風", "強風", "風")
SURF_INCIDENT_WORDS = ("サーファー", "サーフィン", "SUP", "ＳＵＰ")
INCIDENT_WORDS = ("海難", "水難", "溺れ", "溺水", "行方不明", "漂流", "救助", "負傷事故")


def iso(dt):
    return dt.astimezone(JST).replace(microsecond=0).isoformat()


def fetch(url, timeout=20, max_bytes=3_000_000, attempts=3):
    last_error = None
    for attempt in range(attempts):
        req = urllib.request.Request(url, headers={
            "User-Agent": "KansaiSurferKS/1.0 (+https://kansai.rss7.net/)",
            "Accept": "text/html,application/xml,text/xml,application/rss+xml;q=0.9,*/*;q=0.5",
        })
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                final = res.geturl()
                if urlparse(final).scheme != "https":
                    raise ValueError(f"refused non-https redirect: {final}")
                data = res.read(max_bytes + 1)
                if len(data) > max_bytes:
                    raise ValueError(f"response too large: {url}")
                return data
        except Exception as exc:
            last_error = exc
            if attempt + 1 < attempts:
                time.sleep(1 + attempt)
    raise last_error


class TextParser(HTMLParser):
    BLOCKS = {"tr","li","p","h1","h2","h3","h4","div","section","article","td","th","br"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tokens = []
        self.rows = []
        self._row = None
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in ("script", "style", "noscript"):
            self._skip += 1
        if tag == "tr":
            self._row = []
        if tag in self.BLOCKS:
            self.tokens.append("\n")

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in ("script", "style", "noscript") and self._skip:
            self._skip -= 1
        if tag == "tr" and self._row is not None:
            row = [x for x in self._row if x]
            if row:
                self.rows.append(row)
            self._row = None
        if tag in self.BLOCKS:
            self.tokens.append("\n")

    def handle_data(self, data):
        if self._skip:
            return
        value = re.sub(r"\s+", " ", data).strip()
        if not value:
            return
        self.tokens.append(value)
        if self._row is not None:
            self._row.append(value)


def parse_html(raw):
    parser = TextParser()
    parser.feed(raw.decode("utf-8", errors="replace"))
    text = "\n".join(x for x in parser.tokens if x != "\n")
    return parser, text


def numeric(value):
    return bool(re.fullmatch(r"[\d,]+", value.strip()))


def parse_sleague_top3(raw):
    parser, _ = parse_html(raw)
    results = []
    started = False
    for row in parser.rows:
        cells = [re.sub(r"\s+", " ", x).strip() for x in row if x.strip()]
        rank_index = next((i for i, x in enumerate(cells) if re.fullmatch(r"\d{1,3}", x)), None)
        if rank_index is None:
            continue
        rank = int(cells[rank_index])
        if not started:
            if rank != 1:
                continue
            started = True
        if started and rank > 3:
            break
        if rank < 1 or rank > 3:
            continue
        after = cells[rank_index + 1:]
        name = next((x for x in after if not numeric(x) and "第" not in x and "合計" not in x), None)
        points = [x for x in after if numeric(x)]
        if name:
            results.append({"rank": rank, "name": name, "points": points[-1] if points else None})

    if not results:
        # Conservative fallback for layouts without table rows.
        _, text = parse_html(raw)
        lines = [re.sub(r"\s+", " ", x).strip() for x in text.splitlines() if x.strip()]
        for i, token in enumerate(lines):
            if token not in ("1", "2", "3"):
                continue
            rank = int(token)
            window = lines[i + 1:i + 10]
            name = next((x for x in window if not numeric(x) and not re.search(r"^(第|合計|ショート|ロング|メンズ|ウィメンズ)", x)), None)
            if name:
                results.append({"rank": rank, "name": name, "points": next((x for x in reversed(window) if numeric(x)), None)})
            if rank == 3 and results:
                # Continue only for immediate same-rank ties.
                continue

    dedup = []
    seen = set()
    for item in results:
        key = (item["rank"], item["name"])
        if key not in seen:
            dedup.append(item)
            seen.add(key)
    ranks = {x["rank"] for x in dedup}
    if not {1, 2, 3}.issubset(ranks):
        raise ValueError(f"could not safely parse S.ONE top ranks: ranks={sorted(ranks)}")
    return [x for x in dedup if x["rank"] <= 3]


def parse_sleague_month_schedule(raw, month):
    parser, _ = parse_html(raw)
    tokens = [x for x in parser.tokens if x != "\n" and x.strip()]
    start = next((i for i in range(len(tokens)) if "S.ONE" in " ".join(tokens[i:i+3]) and "ショートボード" in " ".join(tokens[i:i+3])), None)
    if start is None:
        raise ValueError("S.ONE shortboard schedule section not found")
    end = next((i for i in range(start + 1, len(tokens)) if "S.ONE" in " ".join(tokens[i:i+3]) and "ロングボード" in " ".join(tokens[i:i+3])), len(tokens))
    section = tokens[start:end]
    month_key = f"{month}月"
    events = []
    for i, token in enumerate(section):
        if month_key not in token or not re.search(r"\d{1,2}月\d{1,2}日", token):
            continue
        before = section[max(0, i - 3):i]
        after = section[i + 1:min(len(section), i + 4)]
        event_name = next((x for x in reversed(before) if not re.fullmatch(r"(開幕戦|第\d+戦|最終戦)", x) and "S.ONE" not in x), None)
        round_name = next((x for x in reversed(before) if re.fullmatch(r"(開幕戦|第\d+戦|最終戦)", x)), "")
        location = next((x for x in after if re.search(r"(都|道|府|県|市|町|海岸|ポイント|新港)", x)), None)
        status = next((x for x in after if "開催" in x or x == "終了"), None)
        if event_name:
            parts = [x for x in (round_name, event_name, token, location, status) if x]
            event = " ".join(parts)
            if event not in events:
                events.append(event)
    return events[:4]


def fallback_template(kind):
    return {
        "kind": kind, "title": None, "body": None, "source": None,
        "checked_at": None, "last_published_at": None,
        "repeat_after_days": 3, "meaningful_change": False, "publish": False,
    }


def previous_last(previous, kind):
    if not previous:
        return None
    for item in previous.get("competition_fallback", []):
        if item.get("kind") != kind:
            continue
        if item.get("publish") is True:
            return previous.get("generated_at") or previous.get("date")
        return item.get("last_published_at")
    return None


def cooldown_ok(last_value, now, days=3):
    if not last_value:
        return True
    try:
        dt = datetime.fromisoformat(str(last_value).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=JST)
        last_day = dt.astimezone(JST).date()
    except ValueError:
        try:
            last_day = datetime.fromisoformat(str(last_value)[:10]).date()
        except ValueError:
            return False
    return (now.date() - last_day).days >= days


def build_sleague_fallbacks(now, previous, status):
    checked = iso(now)
    items = {k: fallback_template(k) for k in ("monthly_schedule","sleague_top3","kanoa_ranking","kanoa_next_event")}
    for kind in items:
        items[kind]["last_published_at"] = previous_last(previous, kind)

    try:
        raw = fetch(SLEAGUE_SCHEDULE_URL)
        events = parse_sleague_month_schedule(raw, now.month)
        status["sleague_schedule"] = {"ok": True, "events": len(events), "source": SLEAGUE_SCHEDULE_URL}
        if events:
            item = items["monthly_schedule"]
            item.update({
                "title": f"{now.month}月のS.LEAGUE S.ONEショートボード日程",
                "body": " / ".join(events),
                "source": SLEAGUE_SCHEDULE_URL,
                "checked_at": checked,
            })
    except Exception as exc:
        status["sleague_schedule"] = {"ok": False, "error": type(exc).__name__}

    try:
        raw = fetch(SLEAGUE_RANKING_URL)
        ranks = parse_sleague_top3(raw)
        status["sleague_ranking"] = {"ok": True, "entries": len(ranks), "source": SLEAGUE_RANKING_URL}
        body_parts = []
        for x in ranks:
            point = f" {x['points']}pt" if x.get("points") else ""
            body_parts.append(f"{x['rank']}位 {x['name']}{point}")
        item = items["sleague_top3"]
        item.update({
            "title": "S.LEAGUE S.ONE ショートボード メンズ TOP3",
            "body": " / ".join(body_parts),
            "source": SLEAGUE_RANKING_URL,
            "checked_at": checked,
        })
    except Exception as exc:
        status["sleague_ranking"] = {"ok": False, "error": type(exc).__name__}

    # WSL/Kanoa stays fail-closed until a stable official machine-readable source is verified.
    status["wsl_kanoa"] = {"ok": False, "reason": "official_stable_source_not_verified"}

    for kind in ("monthly_schedule", "sleague_top3"):
        item = items[kind]
        if item["title"] and cooldown_ok(item["last_published_at"], now, item["repeat_after_days"]):
            item["publish"] = True
            break
    return [items[k] for k in ("monthly_schedule","sleague_top3","kanoa_ranking","kanoa_next_event")]


def atom_entries(raw):
    root = ET.fromstring(raw)
    ns = {"a": "http://www.w3.org/2005/Atom"}
    out = []
    for entry in root.findall("a:entry", ns):
        title = (entry.findtext("a:title", default="", namespaces=ns) or "").strip()
        updated = (entry.findtext("a:updated", default="", namespaces=ns) or "").strip()
        link = entry.find("a:link", ns)
        href = link.get("href", "") if link is not None else ""
        if title and href.startswith("https://"):
            out.append({"title": title, "updated": updated, "url": href})
    return out


def first_local(root, local_name):
    for elem in root.iter():
        if elem.tag.rsplit("}", 1)[-1] == local_name and elem.text and elem.text.strip():
            return elem.text.strip()
    return ""


def first_element(root, local_name):
    for elem in root.iter():
        if elem.tag.rsplit("}", 1)[-1] == local_name:
            return elem
    return None


def parse_jma_detail(raw):
    root = ET.fromstring(raw)
    head = first_element(root, "Head")
    if head is None:
        raise ValueError("JMA XML Head element missing")
    title = first_local(head, "Title")
    info_type = first_local(head, "InfoType")
    report_time = first_local(head, "ReportDateTime") or first_local(head, "TargetDateTime")
    headline_node = first_element(head, "Headline")
    headline = first_local(headline_node, "Text") if headline_node is not None else ""
    all_text = " ".join(x.strip() for x in root.itertext() if x and x.strip())
    regions = sorted({x for x in REGION_WORDS if x in all_text})
    return {
        "title": title, "info_type": info_type, "report_time": report_time,
        "headline": headline, "text": all_text, "regions": regions,
    }


def parse_iso_any(value):
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=JST)
        return dt.astimezone(JST)
    except ValueError:
        return None


def collect_jma(now, status):
    checked = iso(now)
    candidates = []
    feed_status = {}
    for feed_url in (JMA_EXTRA_FEED, JMA_EQVOL_FEED):
        try:
            entries = atom_entries(fetch(feed_url))
            feed_status[feed_url] = {"ok": True, "entries": len(entries)}
        except Exception as exc:
            feed_status[feed_url] = {"ok": False, "error": type(exc).__name__}
            continue
        for entry in entries[:40]:
            if not any(key in entry["title"] for key in JMA_TITLES):
                continue
            entry_time = parse_iso_any(entry.get("updated"))
            if entry_time and (now - entry_time > timedelta(minutes=30) or entry_time - now > timedelta(minutes=5)):
                continue
            try:
                detail = parse_jma_detail(fetch(entry["url"]))
            except Exception:
                continue
            title = detail["title"] or entry["title"]
            if not detail["regions"]:
                continue
            if "気象警報・注意報" in title and not any(w in detail["text"] for w in MARINE_WARNING_WORDS):
                continue
            published = parse_iso_any(detail["report_time"]) or parse_iso_any(entry["updated"])
            if not published:
                continue
            candidates.append({
                "title": title, "info_type": detail["info_type"], "published": published,
                "regions": detail["regions"], "headline": detail["headline"], "url": entry["url"],
            })

    status["jma"] = {"feeds": feed_status}
    # Newest information wins independently for each title+region. A cancellation suppresses older entries.
    candidates.sort(key=lambda x: x["published"], reverse=True)
    seen = set()
    output = []
    for item in candidates:
        fresh_regions = []
        for region in item["regions"]:
            key = (item["title"], region)
            if key in seen:
                continue
            seen.add(key)
            fresh_regions.append(region)
        if not fresh_regions:
            continue
        if item["info_type"] in ("取消", "解除"):
            continue
        # The high-frequency feed only describes very recent changes; stay fail-closed.
        if now - item["published"] > timedelta(minutes=90):
            continue
        body = item["headline"] or f"{'・'.join(fresh_regions)}に関する{item['title']}。"
        output.append({
            "kind": "alert",
            "title": item["title"],
            "body": body[:500],
            "source_name": "気象庁",
            "source_url": item["url"],
            "source_type": "primary",
            "published_at": iso(item["published"]),
            "checked_at": checked,
            "status": "active",
        })
        if len(output) >= 4:
            break
    status["jma"]["selected"] = len(output)
    return output


def strip_html(value):
    parser = TextParser()
    parser.feed(html.unescape(value or ""))
    return re.sub(r"\s+", " ", " ".join(x for x in parser.tokens if x != "\n")).strip()


def rss_time(value):
    if not value:
        return None
    try:
        dt = parsedate_to_datetime(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=JST)
        return dt.astimezone(JST)
    except (TypeError, ValueError):
        return parse_iso_any(value)


def collect_jcg(now, status):
    checked = iso(now)
    try:
        root = ET.fromstring(fetch(JCG_RSS_URL))
    except Exception as exc:
        status["jcg"] = {"ok": False, "error": type(exc).__name__}
        return []
    output = []
    items = root.findall(".//item")
    for item in items:
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        description = strip_html(item.findtext("description") or "")
        published = rss_time(item.findtext("pubDate") or item.findtext("{http://purl.org/dc/elements/1.1/}date"))
        hay = f"{title} {description}"
        if not published or now - published > timedelta(hours=48) or published - now > timedelta(minutes=5):
            continue
        surf_specific = any(k.lower() in hay.lower() for k in SURF_INCIDENT_WORDS)
        regional_incident = any(k in hay for k in INCIDENT_WORDS) and any(r in hay for r in REGION_WORDS + SPOTS)
        if not (surf_specific or regional_incident):
            continue
        if not link.startswith("https://"):
            continue
        output.append({
            "kind": "incident",
            "title": title,
            "body": (description or title)[:500],
            "source_name": "海上保安庁 海の安全情報",
            "source_url": link,
            "source_type": "primary",
            "published_at": iso(published),
            "checked_at": checked,
            "status": "reported",
        })
        if len(output) >= 4:
            break
    status["jcg"] = {"ok": True, "entries": len(items), "selected": len(output), "source": JCG_RSS_URL}
    return output


def load_previous(path):
    if not path or not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def empty_spots():
    return [{
        "name": name, "current": None, "current_at": None,
        "wind_current": None, "wind_current_at": None,
        "forecast": None, "forecast_at": None,
        "wind_forecast": None, "wind_forecast_at": None,
    } for name in SPOTS]


def build(now, previous=None):
    source_status = {}
    fallbacks = build_sleague_fallbacks(now, previous, source_status)
    safety = collect_jma(now, source_status) + collect_jcg(now, source_status)
    return {
        "schema_version": SCHEMA_VERSION,
        "verified": True,
        "preview": False,
        "date": now.strftime("%Y-%m-%d"),
        "weekday": "月火水木金土日"[now.weekday()],
        "generated_at": iso(now),
        "opening": {
            "greeting": "おはようございます、木山です。",
            "osaka_weather": {"current": None, "forecast": None, "source": None, "observed_at": None, "checked_at": None, "forecast_at": None},
            "topic": {"text": None, "source": None, "published_at": None, "checked_at": None},
            "transition": "では今日の波を見ていきましょう。",
        },
        "headline": None,
        "ranking": [],
        "spots": empty_spots(),
        "competition_news": [],
        "competition_fallback": fallbacks,
        "surf_news": [],
        "safety_news": safety,
        "safety_status": {"summary": None, "checked_at": None, "sources": []},
        "closing": None,
        "sources_note": "Official-source candidate: S.LEAGUE / 気象庁防災情報XML / 海上保安庁 海の安全情報。取得失敗項目は推測で補完しません。",
        "collection_meta": {
            "collector": "ks-morning-official-v1",
            "checked_at": iso(now),
            "sources": source_status,
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--previous", type=Path)
    parser.add_argument("--now", help="timezone-aware ISO timestamp for deterministic tests")
    args = parser.parse_args()

    now = parse_iso_any(args.now) if args.now else datetime.now(JST)
    if not now:
        raise SystemExit("--now must be timezone-aware ISO")
    previous = load_previous(args.previous)
    data = build(now, previous)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    published = [x["kind"] for x in data["competition_fallback"] if x.get("publish")]
    print("KS_MORNING_OFFICIAL_CONTEXT_BUILT")
    print("PUBLISHED_FALLBACKS=" + (",".join(published) if published else "(none)"))
    for item in data["competition_fallback"]:
        if item.get("publish"):
            print("FALLBACK_TITLE=" + str(item.get("title") or "")[:180])
            print("FALLBACK_BODY=" + str(item.get("body") or "")[:500])
    print(f"SAFETY_ITEMS={len(data['safety_news'])}")
    for item in data["safety_news"]:
        print("SAFETY_ITEM=" + " | ".join([
            str(item.get("kind") or ""),
            str(item.get("title") or "")[:180],
            str(item.get("source_name") or ""),
            str(item.get("published_at") or ""),
        ]))
    for key, value in data["collection_meta"]["sources"].items():
        print(f"SOURCE[{key}]=" + ("OK" if value.get("ok", all(v.get('ok', False) for v in value.get('feeds', {}).values())) else "UNAVAILABLE"))


if __name__ == "__main__":
    main()
