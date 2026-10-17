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
SURFMEDIA_FEED_URL = "https://surfmedia.jp/feed/"
SURFMEDIA_COMPETITION_KEYWORDS = (
    "WSL", "CT", "ISA", "S.LEAGUE", "エスリーグ",
    "ワールド・サーフ・リーグ", "チャンピオンシップ・ツアー", "ワールド・サーフィン・ゲームズ",
)
SURFMEDIA_RESULT_KEYWORDS = (
    "敗退", "優勝", "準優勝", "決勝", "ラウンド", "ヒート", "結果", "スタート", "開幕", "進出", "フィニッシュ",
)
OPEN_METEO_OSAKA_URL = (
    "https://api.open-meteo.com/v1/forecast"
    "?latitude=34.6937&longitude=135.5023"
    "&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m"
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
    "&timezone=Asia%2FTokyo&forecast_days=1"
)
OPEN_METEO_SOURCE = "https://open-meteo.com/"
PROD_SPOT_BASE = "https://kansai.rss7.net/data"
SPOT_CONFIGS = [
    {"key":"isonoura","name":"磯ノ浦","offshore_start":340,"offshore_end":60,"swell_min":150,"swell_max":240},
    {"key":"kounohama","name":"国府の浜","offshore_start":240,"offshore_end":300,"swell_min":60,"swell_max":150},
    {"key":"ikumi","name":"生見","offshore_start":240,"offshore_end":300,"swell_min":60,"swell_max":150},
    {"key":"komatsu","name":"小松海岸","offshore_start":0,"offshore_end":90,"swell_min":180,"swell_max":270},
    {"key":"irago","name":"伊良湖","offshore_start":270,"offshore_end":30,"swell_min":90,"swell_max":200},
    {"key":"shizunami","name":"静波","offshore_start":270,"offshore_end":50,"swell_min":150,"swell_max":220},
    {"key":"hamadutu","name":"浜詰","offshore_start":120,"offshore_end":200,"swell_min":280,"swell_max":360},
    {"key":"takahama","name":"高浜","offshore_start":120,"offshore_end":200,"swell_min":270,"swell_max":360},
    {"key":"hakuto","name":"白兎","offshore_start":120,"offshore_end":200,"swell_min":270,"swell_max":360},
]
DIRS_JP = ["北","北北東","北東","東北東","東","東南東","南東","南南東","南","南南西","南西","西南西","西","西北西","北西","北北西"]

SPOTS = ["磯ノ浦","国府の浜","生見","小松海岸","伊良湖","静波","浜詰","高浜","白兎"]
REGION_WORDS = [
    "和歌山","三重","徳島","愛知","静岡","京都","福井","鳥取","高知",
    "紀伊水道","熊野灘","遠州灘","東海海域東部","東海海域西部","四国沖",
    "若狭湾","山陰沖東部","山陰沖西部","山陰沖東部及び若狭湾付近"
]
JMA_TITLES = ("津波警報・注意報・予報", "気象警報・注意報", "地方海上警報")
MARINE_WARNING_WORDS = ("波浪", "高潮", "暴風", "強風")
SURF_INCIDENT_WORDS = ("サーファー", "サーフィン", "SUP", "ＳＵＰ")
INCIDENT_WORDS = ("海難事故", "水難事故", "溺れ", "溺水", "行方不明", "漂流者", "人が漂流", "救助", "死亡", "負傷事故")
JCG_ALERT_WORDS = ("荒天", "高波", "強風", "暴風", "波浪", "高潮")
JCG_IGNORE_WORDS = ("訓練", "工事", "航行警報", "灯浮標", "射撃", "ロケット", "漂流物")


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


def fetch_json(url):
    return json.loads(fetch(url).decode("utf-8"))


def weather_label(code):
    try:
        code = int(code)
    except (TypeError, ValueError):
        return "天気不明"
    if code == 0:
        return "晴れ"
    if code in (1, 2, 3):
        return "晴れ時々くもり" if code == 1 else "くもり"
    if code in (45, 48):
        return "霧"
    if 51 <= code <= 57:
        return "霧雨"
    if 61 <= code <= 67 or 80 <= code <= 82:
        return "雨"
    if 71 <= code <= 77 or 85 <= code <= 86:
        return "雪"
    if code >= 95:
        return "雷雨"
    return "くもり"


def dir_jp(deg):
    try:
        deg = float(deg)
    except (TypeError, ValueError):
        return None
    return DIRS_JP[round(deg / 22.5) % 16]


def number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def local_time(value):
    if not value:
        return None
    text = str(value)
    dt = parse_iso_any(text)
    if not dt:
        try:
            dt = datetime.fromisoformat(text)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=JST)
            dt = dt.astimezone(JST)
        except ValueError:
            return text
    return iso(dt)


def nearest_hour_idx(times, now):
    if not isinstance(times, list) or not times:
        return None
    best = None
    for i, value in enumerate(times):
        dt = parse_iso_any(str(value))
        if not dt:
            try:
                dt = datetime.fromisoformat(str(value))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=JST)
            except ValueError:
                continue
        dt = dt.astimezone(JST)
        if dt <= now:
            best = i
        elif best is None:
            best = i
            break
        else:
            break
    return best


def is_offshore(cfg, deg):
    if deg is None:
        return False
    start, end = cfg["offshore_start"], cfg["offshore_end"]
    if start > end:
        return deg >= start or deg <= end
    return start <= deg <= end


def is_onshore(cfg, deg):
    if deg is None:
        return False
    start, end = cfg["offshore_start"], cfg["offshore_end"]
    center = ((start + end + 360) / 2) % 360 if start > end else (start + end) / 2
    onshore = (center + 180) % 360
    diff = abs(deg - onshore)
    if diff > 180:
        diff = 360 - diff
    return diff <= 60


def swell_dir_score(cfg, deg):
    if deg is None:
        return 0.7
    low, high = cfg["swell_min"], cfg["swell_max"]
    if low <= deg <= high:
        return 1.0
    if low - 30 <= deg <= high + 30:
        return 0.7
    return 0.4


def site_score(cfg, h, p, ws, wd, sd):
    if h is None or h < 0.2:
        return 0.5
    if h < 0.3:
        return min(1.5, h * 4)
    if h < 0.4:
        size_score = 1.5
    elif h < 0.6:
        size_score = 2.5
    elif h < 1.0:
        size_score = 4.0
    elif h < 1.5:
        size_score = 5.0
    elif h < 2.0:
        size_score = 4.5
    elif h < 2.5:
        size_score = 3.5
    else:
        size_score = 2.5

    period_score = 1.0
    if p is not None:
        if p < 5:
            period_score = 0.3
        elif p < 7:
            period_score = 0.8
        elif p < 9:
            period_score = 1.3
        elif p < 11:
            period_score = 1.7
        else:
            period_score = 2.0

    ws_ = 5 if ws is None else ws
    if ws_ < 1.5:
        wind_mult = 1.0
    elif is_offshore(cfg, wd):
        wind_mult = 1.0 if ws_ < 4 else 0.95 if ws_ < 7 else 0.85 if ws_ < 10 else 0.7
    elif is_onshore(cfg, wd):
        wind_mult = 0.85 if ws_ < 3 else 0.65 if ws_ < 5 else 0.4 if ws_ < 8 else 0.2
    else:
        wind_mult = 0.95 if ws_ < 3 else 0.8 if ws_ < 6 else 0.6 if ws_ < 9 else 0.4

    score = (size_score + period_score) * wind_mult * swell_dir_score(cfg, sd)
    if h >= 1.5 and is_onshore(cfg, wd) and ws_ >= 4:
        score *= 0.5
    return min(10, max(0, score))


def collect_osaka_weather(now, status):
    checked = iso(now)
    try:
        data = fetch_json(OPEN_METEO_OSAKA_URL)
        current = data.get("current") or {}
        daily = data.get("daily") or {}
        temp = number(current.get("temperature_2m"))
        wind = number(current.get("wind_speed_10m"))
        wind_dir = dir_jp(current.get("wind_direction_10m"))
        current_time = local_time(current.get("time")) or checked
        current_text = weather_label(current.get("weather_code"))
        parts = [f"大阪は{current_text}"]
        if temp is not None:
            parts.append(f"気温{temp:.1f}℃")
        if wind is not None and wind_dir:
            parts.append(f"{wind_dir}の風{wind:.1f}m/s")

        max_t = number((daily.get("temperature_2m_max") or [None])[0])
        min_t = number((daily.get("temperature_2m_min") or [None])[0])
        pop = number((daily.get("precipitation_probability_max") or [None])[0])
        day_code = (daily.get("weather_code") or [None])[0]
        forecast_parts = [f"今日の予想は{weather_label(day_code)}"]
        if max_t is not None and min_t is not None:
            forecast_parts.append(f"最高{max_t:.0f}℃・最低{min_t:.0f}℃")
        if pop is not None:
            forecast_parts.append(f"降水確率最大{pop:.0f}%")

        status["open_meteo_osaka"] = {"ok": True, "source": OPEN_METEO_SOURCE}
        return {
            "current": "、".join(parts) + "。",
            "forecast": "、".join(forecast_parts) + "。",
            "source": OPEN_METEO_SOURCE,
            "observed_at": current_time,
            "checked_at": checked,
            "forecast_at": now.strftime("%Y-%m-%d"),
        }
    except Exception as exc:
        status["open_meteo_osaka"] = {"ok": False, "error": type(exc).__name__}
        return {"current": None, "forecast": None, "source": None, "observed_at": None, "checked_at": None, "forecast_at": None}


def collect_spot_forecasts(now, status):
    checked = iso(now)
    spots = []
    ranked = []
    source_items = {}
    for cfg in SPOT_CONFIGS:
        url = f"{PROD_SPOT_BASE}/spot_{cfg['key']}.json"
        empty = {
            "name": cfg["name"], "current": None, "current_at": None,
            "wind_current": None, "wind_current_at": None,
            "forecast": None, "forecast_at": None,
            "wind_forecast": None, "wind_forecast_at": None,
        }
        try:
            data = fetch_json(url)
            marine = data.get("marine") or {}
            weather = data.get("weather") or {}
            mh = marine.get("hourly") or {}
            wh = weather.get("hourly") or {}
            m_idx = nearest_hour_idx(mh.get("time"), now)
            w_idx = nearest_hour_idx(wh.get("time"), now)
            if m_idx is None:
                raise ValueError("marine hourly time missing")

            def at(values, idx):
                return values[idx] if isinstance(values, list) and idx is not None and idx < len(values) else None

            wave_h = number(at(mh.get("wave_height"), m_idx))
            wave_p = number(at(mh.get("wave_period"), m_idx))
            swell_d = number(at(mh.get("swell_wave_direction"), m_idx))
            wind_s = number(at(wh.get("wind_speed_10m"), w_idx))
            wind_d = number(at(wh.get("wind_direction_10m"), w_idx))
            if wind_s is None or wind_d is None:
                wc = weather.get("current") or {}
                wind_s = number(wc.get("wind_speed_10m"))
                wind_d = number(wc.get("wind_direction_10m"))

            if wave_h is None:
                raise ValueError("wave_height missing")
            forecast_at = local_time(at(mh.get("time"), m_idx)) or checked
            wind_at = local_time(at(wh.get("time"), w_idx)) or forecast_at
            wave_parts = [f"波高{wave_h:.1f}m"]
            if wave_p is not None:
                wave_parts.append(f"周期{wave_p:.0f}秒")
            wind_name = dir_jp(wind_d)
            wind_text = f"{wind_name} {wind_s:.1f}m/s" if wind_name and wind_s is not None else None
            spot = dict(empty)
            spot.update({
                "forecast": "・".join(wave_parts),
                "forecast_at": forecast_at,
                "wind_forecast": wind_text,
                "wind_forecast_at": wind_at if wind_text else None,
            })
            spots.append(spot)
            score = site_score(cfg, wave_h, wave_p, wind_s, wind_d, swell_d)
            ranked.append({
                "spot": cfg["name"], "wave_h": wave_h, "wave_p": wave_p,
                "wind": wind_text, "score": score,
            })
            source_items[cfg["key"]] = {
                "ok": True, "source": url, "updated_at": data.get("updated_at"),
                "forecast_at": forecast_at,
            }
        except Exception as exc:
            spots.append(empty)
            source_items[cfg["key"]] = {"ok": False, "source": url, "error": type(exc).__name__}

    ranked.sort(key=lambda x: (-x["score"], x["spot"]))
    ranking = []
    for idx, item in enumerate(ranked[:5], start=1):
        ranking.append({
            "rank": idx,
            "spot": item["spot"],
            "size": f"波高{item['wave_h']:.1f}m",
            "wind": item["wind"] or "風データなし",
            "note": f"既存KS評価ロジック {item['score']:.1f}/10",
            "basis": "forecast",
        })
    status["spot_forecasts"] = {
        "ok": len(ranked) == len(SPOT_CONFIGS),
        "available": len(ranked),
        "expected": len(SPOT_CONFIGS),
        "checked_at": checked,
        "items": source_items,
    }
    return spots, ranking


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


def strip_html_fragment(value):
    raw = str(value or "").encode("utf-8", errors="ignore")
    _, text = parse_html(raw)
    return re.sub(r"\\s+", " ", text).strip()


def parse_surfmedia_feed(raw):
    root = ET.fromstring(raw)
    channel = root.find("channel")
    if channel is None:
        raise ValueError("SURFMEDIA RSS channel missing")
    entries = []
    for item in channel.findall("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub_raw = (item.findtext("pubDate") or "").strip()
        description = strip_html_fragment(item.findtext("description") or "")
        categories = [(x.text or "").strip() for x in item.findall("category") if (x.text or "").strip()]
        if not title or not link.startswith("https://surfmedia.jp/") or not pub_raw:
            continue
        try:
            published = parsedate_to_datetime(pub_raw)
            if published.tzinfo is None:
                published = published.replace(tzinfo=JST)
            published = published.astimezone(JST)
        except (TypeError, ValueError, OverflowError):
            continue
        entries.append({
            "title": title,
            "url": link,
            "published": published,
            "description": description,
            "categories": categories,
        })
    return entries


def surfmedia_competition_score(entry):
    blob = " ".join([entry.get("title") or "", " ".join(entry.get("categories") or [])])
    categories = entry.get("categories") or []
    has_event_signal = any(word in blob for word in SURFMEDIA_COMPETITION_KEYWORDS)
    has_result_signal = any(word in blob for word in SURFMEDIA_RESULT_KEYWORDS)
    has_competition_category = any(cat in ("WSL MENS CT", "WSL WOMENS CT", "COMPETITION") for cat in categories)
    if not (has_event_signal or has_result_signal or has_competition_category):
        return 0

    score = 0
    if "五十嵐カノア" in blob:
        score += 120
    if "コナー・オレアリー" in blob:
        score += 100
    if has_event_signal:
        score += 60
    if has_result_signal:
        score += 30
    if has_competition_category:
        score += 30
    return score


def collect_surfmedia_competition(now, status):
    checked = iso(now)
    try:
        raw = fetch(SURFMEDIA_FEED_URL)
        entries = parse_surfmedia_feed(raw)
        fresh = []
        for entry in entries:
            age = now - entry["published"]
            if age < timedelta(minutes=-10) or age > timedelta(hours=36):
                continue
            score = surfmedia_competition_score(entry)
            if score <= 0:
                continue
            fresh.append((score, entry["published"], entry))
        fresh.sort(key=lambda x: (x[0], x[1]), reverse=True)
        selected = [x[2] for x in fresh[:2]]
        output = []
        for entry in selected:
            body = entry.get("description") or entry["title"]
            body = re.sub(r"\\s+", " ", body).strip()
            if len(body) > 320:
                body = body[:317].rstrip() + "…"
            output.append({
                "type": "WSL / COMPETITION",
                "title": entry["title"],
                "body": body,
                "source": entry["url"],
                "published_at": iso(entry["published"]),
                "checked_at": checked,
            })
        status["surfmedia_competition"] = {
            "ok": True,
            "entries": len(entries),
            "fresh_candidates": len(fresh),
            "selected": len(output),
            "source": SURFMEDIA_FEED_URL,
        }
        return output
    except Exception as exc:
        status["surfmedia_competition"] = {"ok": False, "error": type(exc).__name__, "source": SURFMEDIA_FEED_URL}
        return []


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
            if "気象警報・注意報" in entry["title"]:
                # JMA detail Title can be a specific alert such as 雷注意報.
                # When it is specific, require the title itself to be marine-relevant;
                # only fall back to the headline for the generic aggregate title.
                marine_text = detail["headline"] if title == "気象警報・注意報" else title
                if not any(w in marine_text for w in MARINE_WARNING_WORDS):
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
        if any(k in title for k in JCG_IGNORE_WORDS):
            continue
        surf_specific = any(k.lower() in hay.lower() for k in SURF_INCIDENT_WORDS)
        region_match = any(r in hay for r in REGION_WORDS + SPOTS)
        incident_specific = (
            (region_match and any(k in title for k in INCIDENT_WORDS))
            or (surf_specific and any(k in hay for k in INCIDENT_WORDS))
        )
        regional_alert = region_match and any(k in title for k in JCG_ALERT_WORDS)
        if not (incident_specific or regional_alert):
            continue
        if not link.startswith("https://"):
            continue
        kind = "incident" if incident_specific else "alert"
        output.append({
            "kind": kind,
            "title": title,
            "body": (description or title)[:500],
            "source_name": "海上保安庁 海の安全情報",
            "source_url": link,
            "source_type": "primary",
            "published_at": iso(published),
            "checked_at": checked,
            "status": "reported" if kind == "incident" else "active",
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
    osaka_weather = collect_osaka_weather(now, source_status)
    spots, ranking = collect_spot_forecasts(now, source_status)
    competition_news = collect_surfmedia_competition(now, source_status)
    fallbacks = build_sleague_fallbacks(now, previous, source_status)
    if competition_news:
        for item in fallbacks:
            item["publish"] = False
    safety = collect_jma(now, source_status) + collect_jcg(now, source_status)

    published_fallback = next((x for x in fallbacks if x.get("publish") is True), None)
    topic = {"text": None, "source": None, "published_at": None, "checked_at": None}
    if competition_news:
        topic = {
            "text": competition_news[0].get("title"),
            "source": competition_news[0].get("source"),
            "published_at": competition_news[0].get("published_at"),
            "checked_at": competition_news[0].get("checked_at"),
        }
    elif published_fallback:
        topic = {
            "text": published_fallback.get("title"),
            "source": published_fallback.get("source"),
            "published_at": None,
            "checked_at": published_fallback.get("checked_at"),
        }

    headline = None
    if ranking:
        headline = f"9スポットのAPI予報を比較。今日の予報ランキング1位は{ranking[0]['spot']}。"
    closing = "ランキングはAPI予報データ基準です。出発前に最新の風・現地状況・安全情報を確認してください。" if ranking else None

    return {
        "schema_version": SCHEMA_VERSION,
        "verified": True,
        "preview": False,
        "date": now.strftime("%Y-%m-%d"),
        "weekday": "月火水木金土日"[now.weekday()],
        "generated_at": iso(now),
        "opening": {
            "greeting": "おはようございます、木山です。",
            "osaka_weather": osaka_weather,
            "topic": topic,
            "transition": "では今日の波を見ていきましょう。",
        },
        "headline": headline,
        "ranking": ranking,
        "spots": spots,
        "competition_news": competition_news,
        "competition_fallback": fallbacks,
        "surf_news": [],
        "safety_news": safety,
        "safety_status": {"summary": None, "checked_at": None, "sources": []},
        "closing": closing,
        "sources_note": "Verified-source candidate: Open-Meteo / KS公開9スポットAPI / SURFMEDIA / S.LEAGUE / 気象庁防災情報XML / 海上保安庁 海の安全情報。現在観測とAPI予報を混同せず、取得失敗項目は推測で補完しません。",
        "collection_meta": {
            "collector": "ks-morning-official-v2",
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
    print(f"OSAKA_WEATHER={'OK' if data['opening']['osaka_weather'].get('current') else 'UNAVAILABLE'}")
    print(f"SPOT_FORECASTS={sum(1 for x in data['spots'] if x.get('forecast'))}/9")
    print(f"RANKING_COUNT={len(data['ranking'])}")
    if data["ranking"]:
        print("RANKING_TOP=" + " / ".join(f"{x['rank']}位 {x['spot']} {x['size']}" for x in data["ranking"]))
    print("PUBLISHED_FALLBACKS=" + (",".join(published) if published else "(none)"))
    print(f"COMPETITION_NEWS={len(data['competition_news'])}")
    for item in data["competition_news"]:
        print("COMPETITION_ITEM=" + " | ".join([str(item.get("title") or "")[:180], str(item.get("published_at") or "")]))
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
