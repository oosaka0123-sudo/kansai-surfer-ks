#!/usr/bin/env python3
import importlib.util
import json
import pathlib
import tempfile
from datetime import datetime

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("collector", ROOT / "scripts" / "build_morning_official_context.py")
collector = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(collector)

RANKING_HTML = """
<table>
<tr><th>順位</th><th>選手</th><th>第1戦</th><th>合計</th></tr>
<tr><td>1</td><td>松永　大輝</td><td>5,000</td><td>5,000</td></tr>
<tr><td>2</td><td>川俣　海徳(S.TWO)</td><td>4,300</td><td>4,300</td></tr>
<tr><td>3</td><td>大音　凜太</td><td>3,600</td><td>3,600</td></tr>
<tr><td>3</td><td>加藤　翔平</td><td>3,600</td><td>3,600</td></tr>
<tr><td>5</td><td>森　友二</td><td>3,200</td><td>3,200</td></tr>
</table>
"""

SCHEDULE_HTML = """
<h2>S.ONE ショートボード</h2>
<div>第2戦</div><div>ALL JAPAN さわかみ 仙台プロ</div>
<div>10月21日(水)〜23日(金)　予備日:24日(土)</div><div>宮城県仙台市 仙台新港</div><div>開催予定</div>
<h2>S.ONE ロングボード</h2>
"""

JMA_FEED = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
 <entry><title>気象警報・注意報</title><updated>2026-10-13T06:05:00+09:00</updated>
 <link href="https://example.test/jma-warning.xml"/></entry>
</feed>"""

JMA_DETAIL = """<?xml version="1.0" encoding="UTF-8"?>
<Report xmlns="http://xml.kishou.go.jp/jmaxml1/">
 <Control><Status>通常</Status></Control>
 <Head><Title>気象警報・注意報</Title><ReportDateTime>2026-10-13T06:05:00+09:00</ReportDateTime>
 <InfoType>発表</InfoType><Headline><Text>和歌山県に波浪注意報。</Text></Headline></Head>
 <Body><Text>和歌山 波浪</Text></Body>
</Report>"""

JCG_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss><channel>
 <item><title>和歌山県沿岸でサーファーを救助</title>
 <link>https://www6.kaiho.mlit.go.jp/example-incident.html</link>
 <description>サーファーの海難事故について発表。</description>
 <pubDate>Mon, 12 Oct 2026 23:00:00 +0900</pubDate></item>
 <item><title>荒天に関する注意情報（和歌山県沿岸）</title>
 <link>https://www6.kaiho.mlit.go.jp/example-weather.html</link>
 <description>和歌山県沿岸では荒天に注意してください。</description>
 <pubDate>Tue, 13 Oct 2026 06:00:00 +0900</pubDate></item>
 <item><title>救難訓練：若狭湾北方（八管区地域航行警報）</title>
 <link>https://www6.kaiho.mlit.go.jp/example-training.html</link>
 <description>若狭湾北方で訓練を実施。</description>
 <pubDate>Tue, 13 Oct 2026 06:00:00 +0900</pubDate></item>
 <item><title>漂流物：悪石島東方</title>
 <link>https://www6.kaiho.mlit.go.jp/example-object.html</link>
 <description>漂流物を確認。</description>
 <pubDate>Mon, 12 Oct 2026 23:30:00 +0900</pubDate></item>
</channel></rss>"""


OSAKA_WEATHER = {
    "current": {
        "time": "2026-10-13T06:15",
        "temperature_2m": 22.4,
        "weather_code": 1,
        "wind_speed_10m": 2.6,
        "wind_direction_10m": 45,
    },
    "daily": {
        "weather_code": [2],
        "temperature_2m_max": [26.2],
        "temperature_2m_min": [19.1],
        "precipitation_probability_max": [20],
    },
}


def spot_payload(wave_height, period=8, wind_speed=2, wind_dir=0, swell_dir=180):
    return {
        "updated_at": "2026-10-13 06:10:00",
        "marine": {
            "hourly": {
                "time": ["2026-10-13T05:00", "2026-10-13T06:00", "2026-10-13T07:00"],
                "wave_height": [wave_height, wave_height, wave_height],
                "wave_period": [period, period, period],
                "swell_wave_direction": [swell_dir, swell_dir, swell_dir],
            }
        },
        "weather": {
            "hourly": {
                "time": ["2026-10-13T05:00", "2026-10-13T06:00", "2026-10-13T07:00"],
                "wind_speed_10m": [wind_speed, wind_speed, wind_speed],
                "wind_direction_10m": [wind_dir, wind_dir, wind_dir],
            },
            "current": {
                "wind_speed_10m": wind_speed,
                "wind_direction_10m": wind_dir,
            }
        }
    }


def test_ranking():
    rows = collector.parse_sleague_top3(RANKING_HTML.encode())
    assert [(x["rank"], x["name"], x["points"]) for x in rows] == [
        (1, "松永 大輝", "5,000"),
        (2, "川俣 海徳(S.TWO)", "4,300"),
        (3, "大音 凜太", "3,600"),
        (3, "加藤 翔平", "3,600"),
    ]


def test_schedule():
    events = collector.parse_sleague_month_schedule(SCHEDULE_HTML.encode(), 10)
    assert len(events) == 1
    assert "ALL JAPAN さわかみ 仙台プロ" in events[0]
    assert "10月21日" in events[0]


def test_official_collectors():
    now = datetime.fromisoformat("2026-10-13T06:30:00+09:00")
    real_fetch = collector.fetch

    def fake_fetch(url, *args, **kwargs):
        if url in (collector.JMA_EXTRA_FEED, collector.JMA_EQVOL_FEED):
            return JMA_FEED.encode()
        if url == "https://example.test/jma-warning.xml":
            return JMA_DETAIL.encode()
        if url == collector.JCG_RSS_URL:
            return JCG_RSS.encode()
        raise AssertionError(url)

    collector.fetch = fake_fetch
    try:
        status = {}
        jma = collector.collect_jma(now, status)
        jcg = collector.collect_jcg(now, status)
    finally:
        collector.fetch = real_fetch
    assert jma and jma[0]["kind"] == "alert" and jma[0]["status"] == "active"
    assert jma[0]["source_name"] == "気象庁"
    assert len(jcg) == 2, jcg
    by_kind = {x["kind"]: x for x in jcg}
    assert by_kind["incident"]["status"] == "reported"
    assert "サーファー" in by_kind["incident"]["title"]
    assert by_kind["alert"]["status"] == "active"
    assert "荒天" in by_kind["alert"]["title"]
    assert all("訓練" not in x["title"] and "漂流物" not in x["title"] for x in jcg)
    assert all(x["source_name"].startswith("海上保安庁") for x in jcg)


def test_cooldown():
    now = datetime.fromisoformat("2026-10-13T06:30:00+09:00")
    assert collector.cooldown_ok(None, now)
    assert not collector.cooldown_ok("2026-10-12T06:30:00+09:00", now, 3)
    assert collector.cooldown_ok("2026-10-10T06:30:00+09:00", now, 3)


def test_weather_and_spot_forecasts():
    now = datetime.fromisoformat("2026-10-13T06:30:00+09:00")
    real_fetch_json = collector.fetch_json
    wave_by_key = {
        "isonoura": 0.6,
        "kounohama": 0.8,
        "ikumi": 1.2,
        "komatsu": 0.7,
        "irago": 1.0,
        "shizunami": 0.9,
        "hamadutu": 0.5,
        "takahama": 0.4,
        "hakuto": 0.3,
    }

    def fake_fetch_json(url):
        if url == collector.OPEN_METEO_OSAKA_URL:
            return OSAKA_WEATHER
        for cfg in collector.SPOT_CONFIGS:
            if url.endswith(f"spot_{cfg['key']}.json"):
                return spot_payload(
                    wave_by_key[cfg["key"]],
                    period=9,
                    wind_speed=1,
                    wind_dir=cfg["offshore_start"],
                    swell_dir=cfg["swell_min"],
                )
        raise AssertionError(url)

    collector.fetch_json = fake_fetch_json
    try:
        status = {}
        weather = collector.collect_osaka_weather(now, status)
        spots, ranking = collector.collect_spot_forecasts(now, status)
    finally:
        collector.fetch_json = real_fetch_json

    assert "大阪は" in weather["current"]
    assert weather["source"] == collector.OPEN_METEO_SOURCE
    assert status["open_meteo_osaka"]["ok"] is True
    assert len(spots) == 9
    assert all(x["current"] is None for x in spots)
    assert all(x["forecast"] and x["forecast_at"] for x in spots)
    assert all(x["wind_forecast"] and x["wind_forecast_at"] for x in spots)
    assert len(ranking) == 5
    assert [x["rank"] for x in ranking] == [1, 2, 3, 4, 5]
    assert all(x["basis"] == "forecast" for x in ranking)
    assert all(x["size"].startswith("波高") for x in ranking)
    assert status["spot_forecasts"]["available"] == 9
    assert status["spot_forecasts"]["ok"] is True


def main():
    test_ranking()
    test_schedule()
    test_official_collectors()
    test_cooldown()
    test_weather_and_spot_forecasts()
    print("Morning official context unit tests passed")


if __name__ == "__main__":
    main()
