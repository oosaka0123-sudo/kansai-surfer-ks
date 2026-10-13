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


def main():
    test_ranking()
    test_schedule()
    test_official_collectors()
    test_cooldown()
    print("Morning official context unit tests passed")


if __name__ == "__main__":
    main()
